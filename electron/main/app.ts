import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  type NativeImage,
  Notification,
  nativeImage,
  shell,
  Tray,
} from 'electron'
import { accountManager } from './managers/AccountManager'
import { updateManager } from './managers/UpdateManager'
import windowManager from './windowManager'
import './ipc'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createLogger, setAppQuitting } from './logger'

// const _require = createRequire(import.meta.url)

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//

function createBoxedString(lines: string[]) {
  // 1. 计算最长的一行文字长度
  const maxLength = Math.max(...lines.map(line => line.length))

  // 2. 定义边框样式
  // 顶部和底部边框 (例如: +----------------+)
  const horizontalLine = `+${'-'.repeat(maxLength + 2)}+`

  // 3. 生成中间的内容行
  const content = lines
    .map(line => {
      // 使用 padEnd 补齐空格，使得右边框对齐
      return `| ${line.padEnd(maxLength)} |`
    })
    .join('\n')

  // 4. 拼接结果
  return `\n${horizontalLine}\n${content}\n${horizontalLine}`
}

function logStartupInfo() {
  const appInfo = [
    `App Name:     ${app.getName()}`,
    `App Version:  ${app.getVersion()}`,
    `Electron Ver: ${process.versions.electron}`,
    `Node Ver:     ${process.versions.node}`,
    `Platform:     ${process.platform} (${process.arch})`,
    `Environment:  ${app.isPackaged ? 'Production' : 'Development'}`,
  ]
  const logger = createLogger('startup')
  logger.debug(createBoxedString(appInfo))
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist')
    : RENDERER_DIST

// 仅在开发模式下启用远程调试端口
if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

// 开发模式下不启用单实例锁，确保每次 npm run dev 都能弹出新窗口（避免旧实例在托盘导致看不到窗口）
if (app.isPackaged && !app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

const XIUER_DEBUG_PATH = path.join(process.env.TEMP ?? os.tmpdir(), 'xiuer-window-debug.txt')
function logWindowDebug(phase: string, w: BrowserWindow | null = win): void {
  const ts = new Date().toISOString()
  const line = `${ts} pid=${process.pid} ${phase} mainWindow=${!!w} visible=${w ? w.isVisible() : false} minimized=${w ? w.isMinimized() : false}\n`
  appendFileSync(XIUER_DEBUG_PATH, line)
}

/** 开发模式：等待 localhost:5173 可连接再 loadURL，避免 ERR_CONNECTION_REFUSED 白屏 */
function waitForDevServer(
  url: string,
  maxWaitMs = 60000,
  intervalMs = 1000,
  initialDelayMs = 5000,
): Promise<void> {
  let host = '127.0.0.1'
  let port = 5173
  try {
    const u = new URL(url)
    host = u.hostname || host
    port = u.port ? Number.parseInt(u.port, 10) : 5173
  } catch {
    /* 用默认 */
  }
  return new Promise(resolve => {
    const start = Date.now()
    function tryConnect() {
      if (Date.now() - start >= maxWaitMs) {
        resolve()
        return
      }
      const socket = new net.Socket()
      const t = setTimeout(() => {
        socket.destroy()
        setTimeout(tryConnect, intervalMs)
      }, 3000)
      socket.once('connect', () => {
        clearTimeout(t)
        socket.destroy()
        resolve()
      })
      socket.once('error', () => {
        clearTimeout(t)
        socket.destroy()
        setTimeout(tryConnect, intervalMs)
      })
      socket.connect(port, host)
    }
    setTimeout(tryConnect, initialDelayMs)
  })
}

let win: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
// vite-plugin-electron outputs preload as .js file
const preload = path.join(__dirname, '../preload/index.js')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

// 持久化配置文件的路径
const getConfigPath = () => path.join(app.getPath('userData'), 'app-config.json')

// 读取配置
function getConfig(): { hideToTrayTipDismissed: boolean } {
  const configPath = getConfigPath()
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      createLogger('config').error('Failed to read config file:', error)
    }
  }
  return { hideToTrayTipDismissed: false }
}

// 写入配置
function setConfig(config: { hideToTrayTipDismissed: boolean }) {
  const configPath = getConfigPath()
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
  } catch (error) {
    createLogger('config').error('Failed to write config file:', error)
  }
}

async function createWindow() {
  const isDev = !!VITE_DEV_SERVER_URL
  // 未打包（npm run dev）时一律视为开发环境，保证窗口一定会显示，不依赖 VITE_DEV_SERVER_URL 是否注入
  const showUnpackaged = !app.isPackaged
  // Windows 打包版优先可见，避免“进程在跑但没有窗口”的误判
  const forceShowOnWindows = app.isPackaged && process.platform === 'win32'
  const showOnStart = isDev || showUnpackaged || forceShowOnWindows
  try {
    logWindowDebug('createWindow called')
    win = new BrowserWindow({
      title: `秀儿直播助手 - v${app.getVersion()}`,
      width: 1280,
      height: 800,
      x: showOnStart ? 80 : undefined,
      y: showOnStart ? 60 : undefined,
      show: showOnStart,
      autoHideMenuBar: app.isPackaged,
      icon: path.join(process.env.VITE_PUBLIC ?? '', 'favicon.png'),
      webPreferences: {
        preload,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: app.isPackaged,
      },
    })

    win.once('ready-to-show', () => {
      logWindowDebug('ready-to-show')
      win?.show()
      if (isDev || showUnpackaged) win?.focus()
    })

    win.on('closed', () => {
      logWindowDebug('window closed')
      win = null
      // Windows 打包版兜底：若窗口被异常关闭且应用未退出，自动重建主窗口
      if (app.isPackaged && process.platform === 'win32' && !isQuitting) {
        setTimeout(() => {
          if (!win && !isQuitting) {
            logWindowDebug('window closed recovery: recreate window')
            void createWindow()
          }
        }, 1000)
      }
    })

    win.setSkipTaskbar(false)
    windowManager.setMainWindow(win)

    // 仅开发环境：从 Vite 开发服务器加载（localhost:5173）。打包后 VITE_DEV_SERVER_URL 未注入，走 else 分支 loadFile，不会出现“连不上 5173”的白屏。
    const DEV_LOAD_RETRY_MAX = 5
    const DEV_LOAD_RETRY_DELAY_MS = 6000
    let devLoadRetryCount = 0

    if (VITE_DEV_SERVER_URL) {
      console.log('[main] 等待 Vite 开发服务器 (localhost:5173)…')
      await waitForDevServer(VITE_DEV_SERVER_URL).catch(() => {})
      console.log('[main] 正在加载页面:', VITE_DEV_SERVER_URL)
      win.loadURL(VITE_DEV_SERVER_URL).catch(err => {
        createLogger('window').error('loadURL failed:', err)
        logWindowDebug('loadURL failed')
      })

      // 开发环境：首次加载失败（ERR_CONNECTION_REFUSED）时自动重试，减少“关进程/删 dist/重启”的困扰
      win.webContents.on(
        'did-fail-load',
        (_, errorCode, errorDescription, validatedURL, isMainFrame) => {
          if (
            !VITE_DEV_SERVER_URL ||
            !isMainFrame ||
            errorCode !== -102 ||
            errorDescription !== 'ERR_CONNECTION_REFUSED' ||
            !validatedURL?.startsWith('http://localhost:')
          ) {
            return
          }
          if (devLoadRetryCount >= DEV_LOAD_RETRY_MAX) {
            console.log(
              '[main] 开发页面加载已重试',
              DEV_LOAD_RETRY_MAX,
              '次，请检查 Vite 是否已启动或执行 npm run dev:force',
            )
            return
          }
          devLoadRetryCount += 1
          console.log(
            '[main] 开发页面加载失败，',
            DEV_LOAD_RETRY_DELAY_MS / 1000,
            '秒后重试 (',
            devLoadRetryCount,
            '/',
            DEV_LOAD_RETRY_MAX,
            ')',
          )
          setTimeout(() => {
            if (
              win &&
              !win.isDestroyed() &&
              !win.webContents.isDestroyed() &&
              VITE_DEV_SERVER_URL
            ) {
              win.loadURL(VITE_DEV_SERVER_URL).catch(err => {
                createLogger('window').error('loadURL retry failed:', err)
              })
            }
          }, DEV_LOAD_RETRY_DELAY_MS)
        },
      )

      win.webContents.openDevTools()
    } else {
      win.loadFile(indexHtml).catch(err => {
        createLogger('window').error('loadFile failed:', err)
        logWindowDebug('loadFile failed')
        // 打包版主页面加载失败时重试，减少“启动无窗口”概率
        if (app.isPackaged && process.platform === 'win32') {
          setTimeout(() => {
            if (win && !win.isDestroyed()) {
              win.loadFile(indexHtml).catch(retryErr => {
                createLogger('window').error('loadFile retry failed:', retryErr)
              })
            }
          }, 1200)
        }
      })
    }

    win.webContents.on('render-process-gone', (_, details) => {
      createLogger('window').error('render-process-gone:', details)
      logWindowDebug(`render-process-gone: ${details.reason}`)
      if (app.isPackaged && process.platform === 'win32' && !isQuitting) {
        setTimeout(() => {
          if (!win || win.isDestroyed()) {
            logWindowDebug('render-process-gone recovery: recreate window')
            void createWindow()
          }
        }, 1000)
      }
    })

    win.webContents.on('did-finish-load', async () => {
      // 应用退出时不发起更新检查
      if (!isQuitting) {
        await updateManager.silentCheckForUpdate()
      }
    })

    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https:')) shell.openExternal(url)
      return { action: 'deny' }
    })

    // 未打包时：300ms 与 1500ms 两次强制显示并置前，避免 ready-to-show 未触发导致窗口一直不出现
    if (showUnpackaged) {
      const forceShow = () => {
        if (win && !win.isDestroyed()) {
          if (!win.isVisible()) {
            logWindowDebug('fallback show')
            win.show()
          }
          win.focus()
          win.moveTop()
        }
      }
      setTimeout(forceShow, 300)
      setTimeout(forceShow, 1500)
    } else {
      setTimeout(() => {
        if (win && !win.isDestroyed() && !win.isVisible()) {
          logWindowDebug('fallback show')
          win.show()
          win.focus()
        }
      }, 1500)

      // 打包版启动兜底：若异常情况下没有任何可见窗口，强制恢复窗口
      setTimeout(() => {
        const windows = BrowserWindow.getAllWindows()
        const visible = windows.some(w => !w.isDestroyed() && w.isVisible())
        if (!visible) {
          logWindowDebug('startup visibility watchdog: no visible window, recovering')
          if (win && !win.isDestroyed()) {
            win.show()
            win.setSkipTaskbar(false)
            win.focus()
          } else {
            createWindow()
          }
        }
      }, 5000)
    }

    // 仅在窗口创建成功后注册：拦截关闭事件，改为隐藏到托盘
    win.on('close', e => {
      if (!isQuitting) {
        e.preventDefault()

        // 检查是否需要显示首次提示（在隐藏前检查，确保能立即显示）
        const config = getConfig()
        const shouldShowTip = !config.hideToTrayTipDismissed

        // 隐藏窗口并设置不在任务栏显示
        win?.hide()
        win?.setSkipTaskbar(true)

        // 立即显示系统通知（不依赖渲染进程）
        if (shouldShowTip && Notification.isSupported()) {
          const notification = new Notification({
            title: '已最小化到托盘',
            body: '应用仍在后台运行，可从托盘图标打开。可在设置中关闭此提示。',
            icon: path.join(process.env.VITE_PUBLIC, 'favicon.png'),
            silent: false,
          })

          notification.on('click', () => {
            // 点击通知时显示主窗口
            if (win) {
              win.show()
              win.setSkipTaskbar(false)
              win.focus()
            }
          })

          notification.show()
        }
      }
    })
  } catch (err) {
    logWindowDebug('createWindow error')
    createLogger('window').error('createWindow failed:', err)
    dialog.showErrorBox('窗口创建失败', err instanceof Error ? err.message : String(err))
  }
}

/** 有连接账号时，每 60 秒打点主进程内存，便于观测多账号资源占用 */
const MEMORY_LOG_INTERVAL_MS = 60_000
let memoryLogInterval: NodeJS.Timeout | null = null

function startMemoryLogInterval() {
  // 避免重复启动
  if (memoryLogInterval) return

  memoryLogInterval = setInterval(() => {
    const n = accountManager.accountSessions.size
    if (n === 0) return
    const mem = process.memoryUsage()
    createLogger('资源').info(
      `[资源] 连接数=${n} heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB rss=${Math.round(mem.rss / 1024 / 1024)}MB`,
    )
  }, MEMORY_LOG_INTERVAL_MS)
}

function stopMemoryLogInterval() {
  if (memoryLogInterval) {
    clearInterval(memoryLogInterval)
    memoryLogInterval = null
  }
}

logWindowDebug('before whenReady')
app
  .whenReady()
  .then(logStartupInfo)
  .then(() => {
    logWindowDebug('after whenReady')
    createWindow()
    createTray()
    startMemoryLogInterval()
  })

app.on('window-all-closed', async () => {
  // Windows/Linux: 不退出应用，保持托盘运行
  // macOS: 保持默认行为（dock 图标仍存在）
  if (process.platform === 'darwin') {
    // macOS 保持默认行为
  } else {
    // Windows/Linux: 不退出，应用继续在后台运行（托盘）
    // 只有通过托盘菜单"退出程序"才会真正退出
  }
})

app.on('before-quit', () => {
  isQuitting = true
  setAppQuitting(true)
  stopMemoryLogInterval()
})

app.on('second-instance', () => {
  logWindowDebug('second-instance triggered')
  if (win) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.setSkipTaskbar(false)
    win.focus()
  } else {
    createLogger('app').info('second-instance: mainWindow not created yet, ensuring createWindow')
    app.whenReady().then(() => createWindow())
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

const XIUER_CRASH_PATH = path.join(process.env.TEMP ?? os.tmpdir(), 'xiuer-crash.txt')
function writeCrashToTemp(tag: string, err: unknown): void {
  try {
    const ts = new Date().toISOString()
    const stack = err instanceof Error ? err.stack : String(err)
    const msg = err instanceof Error ? err.message : String(err)
    appendFileSync(XIUER_CRASH_PATH, `\n[${ts}] ${tag}\n${msg}\n${stack}\n`)
  } catch {
    // 忽略写入错误，避免在崩溃处理中引发新的错误导致无限递归
  }
}

process.on('uncaughtException', error => {
  writeCrashToTemp('uncaughtException', error)
  const logger = createLogger('uncaughtException')
  logger.error('--------------意外的未捕获异常---------------')
  logger.error(error)
  logger.error('---------------------------------------------')

  dialog.showErrorBox('应用程序错误', `发生了一个意外的错误，请联系技术支持：\n${error.message}`)
})

process.on('unhandledRejection', reason => {
  // playwright-extra 插件问题：在 browser.close() 时概率触发
  // https://github.com/berstend/puppeteer-extra/issues/858
  if (
    reason instanceof Error &&
    reason.message.includes('cdpSession.send: Target page, context or browser has been closed')
  ) {
    return createLogger('unhandledRejection').verbose(reason)
  }
  writeCrashToTemp('unhandledRejection', reason)
  const logger = createLogger('unhandledRejection')
  logger.error('--------------未被处理的错误---------------')
  logger.error(reason)
  logger.error('-------------------------------------------')
})

// 创建系统托盘
function createTray() {
  // 使用应用图标作为托盘图标
  const iconPath = path.join(process.env.VITE_PUBLIC, 'favicon.png')
  let trayIcon: NativeImage

  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    // 如果图标太大，调整尺寸（Windows 推荐 16x16）
    if (trayIcon.getSize().width > 16) {
      trayIcon = trayIcon.resize({ width: 16, height: 16 })
    }
  } catch (error) {
    createLogger('tray').warn('Failed to load tray icon, using default:', error)
    // 如果加载失败，创建一个简单的默认图标
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)
  tray.setToolTip(app.getName())

  // 创建托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (win) {
          win.show()
          win.setSkipTaskbar(false) // 恢复任务栏显示
          win.focus()
        } else {
          createWindow()
        }
      },
    },
    {
      type: 'separator',
    },
    {
      label: '退出程序',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  // 托盘图标单击：显示/聚焦主窗口
  tray.on('click', () => {
    if (win) {
      if (win.isVisible()) {
        win.focus()
      } else {
        win.show()
        win.setSkipTaskbar(false) // 恢复任务栏显示
        win.focus()
      }
    } else {
      createWindow()
    }
  })
}

// IPC 处理：设置"不再提示"标记
ipcMain.handle('app:setHideToTrayTipDismissed', (_, dismissed: boolean) => {
  const config = getConfig()
  config.hideToTrayTipDismissed = dismissed
  setConfig(config)
})

// IPC 处理：获取"不再提示"标记
ipcMain.handle('app:getHideToTrayTipDismissed', () => {
  const config = getConfig()
  return config.hideToTrayTipDismissed
})
