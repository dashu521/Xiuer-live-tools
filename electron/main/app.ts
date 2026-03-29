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
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createLogger, setAppQuitting } from './logger'

// ==================== 启动期日志系统 ====================
// 【修复】日志路径必须在最早期确定，确保打包后也能正常落地
// 优先使用临时目录，因为 app.getPath('userData') 在某些情况下可能不可用
const TEMP_LOG_DIR = process.env.TEMP || process.env.TMP || os.tmpdir()
const FALLBACK_LOG_PATH = path.join(TEMP_LOG_DIR, 'xiuer-live-assistant')

let STARTUP_LOG_DIR = ''
let STARTUP_LOG_PATH = ''
let MAIN_LOG_PATH = ''
const STARTUP_DEBUG = process.env.LOG_LEVEL === 'debug' || process.env.STARTUP_DEBUG === '1'
let logDirEnsured = false

function initLogPaths() {
  try {
    STARTUP_LOG_DIR = path.join(app.getPath('userData'), 'logs')
    STARTUP_LOG_PATH = path.join(STARTUP_LOG_DIR, 'startup.log')
    MAIN_LOG_PATH = path.join(STARTUP_LOG_DIR, 'main.log')
  } catch (_e) {
    STARTUP_LOG_DIR = FALLBACK_LOG_PATH
    STARTUP_LOG_PATH = path.join(FALLBACK_LOG_PATH, 'startup.log')
    MAIN_LOG_PATH = path.join(FALLBACK_LOG_PATH, 'main.log')
  }
}

function ensureLogDir() {
  if (logDirEnsured) return
  const dirs = [STARTUP_LOG_DIR, FALLBACK_LOG_PATH]
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    } catch (_e) {
      // 继续尝试下一个目录
    }
  }
  logDirEnsured = true
}

function writeStartupLog(message: string) {
  ensureLogDir()
  const timestamp = new Date().toISOString()
  const logLine = `[${timestamp}] [STARTUP] [PID:${process.pid}] ${message}\n`

  // 尝试写入多个位置，确保至少有一个成功
  const logPaths = [STARTUP_LOG_PATH, MAIN_LOG_PATH, path.join(FALLBACK_LOG_PATH, 'startup.log')]

  for (const logPath of logPaths) {
    try {
      appendFileSync(logPath, logLine)
    } catch (_e) {
      // 继续尝试下一个路径
    }
  }

  console.log(`[STARTUP] ${message}`)
}

function writeMainLog(level: string, message: string) {
  ensureLogDir()
  const timestamp = new Date().toISOString()
  const logLine = `[${timestamp}] [${level}] [PID:${process.pid}] ${message}\n`

  const logPaths = [MAIN_LOG_PATH, path.join(FALLBACK_LOG_PATH, 'main.log')]

  for (const logPath of logPaths) {
    try {
      appendFileSync(logPath, logLine)
    } catch (_e) {
      // 继续尝试下一个路径
    }
  }
}

function debugStartupLog(message: string) {
  if (STARTUP_DEBUG) {
    writeStartupLog(message)
  }
}

// 【修复】初始化日志路径
initLogPaths()

writeStartupLog('========== 应用启动 ==========')
writeStartupLog(
  `pid=${process.pid} electron=${process.versions.electron} node=${process.versions.node} platform=${process.platform}/${process.arch} packaged=${app.isPackaged}`,
)
debugStartupLog(`应用路径: ${app.getAppPath()}`)
debugStartupLog(`用户数据目录: ${app.getPath('userData')}`)
debugStartupLog(`资源目录: ${process.resourcesPath || 'N/A'}`)
debugStartupLog(`当前工作目录: ${process.cwd()}`)
debugStartupLog(`命令行参数: ${process.argv.join(' ')}`)
debugStartupLog(`日志目录: ${STARTUP_LOG_DIR}`)

function createBoxedString(lines: string[]) {
  const maxLength = Math.max(...lines.map(line => line.length))
  const horizontalLine = `+${'-'.repeat(maxLength + 2)}+`
  const content = lines.map(line => `| ${line.padEnd(maxLength)} |`).join('\n')
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

// 资源路径配置
// 注意：dist-electron 被 files 配置包含，打包进 app.asar，不是 app.asar.unpacked
export const MAIN_DIST = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar', 'dist-electron')
  : path.join(process.env.APP_ROOT, 'dist-electron')

export const RENDERER_DIST = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar', 'dist')
  : path.join(process.env.APP_ROOT, 'dist')

export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'public')
    : path.join(process.env.APP_ROOT, 'public')

// 仅在开发模式下启用远程调试端口
if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

// Windows 7 禁用 GPU 加速
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Windows 10+ 通知设置
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

// ==================== 单实例锁 ====================
const gotTheLock = app.requestSingleInstanceLock()
writeStartupLog(`单实例锁获取结果: ${gotTheLock}`)

if (!gotTheLock) {
  writeStartupLog('未能获取单实例锁，退出应用')
  app.quit()
  process.exit(0)
}

app.on('second-instance', (_event, commandLine, _workingDirectory) => {
  writeStartupLog(`second-instance 触发，命令行: ${commandLine.join(' ')}`)
  writeMainLog('INFO', 'second-instance: 检测到第二个实例启动，唤醒主窗口')

  // 【修复】增强二次启动唤醒逻辑，确保窗口可见并记录结果
  if (win && !win.isDestroyed()) {
    writeStartupLog('second-instance: 主窗口存在，准备显示')

    // 如果窗口被最小化，恢复它
    if (win.isMinimized()) {
      win.restore()
      writeStartupLog('second-instance: 窗口已从最小化恢复')
    }

    // 如果窗口不可见，显示它
    if (!win.isVisible()) {
      win.show()
      writeStartupLog('second-instance: 窗口已从隐藏状态显示')
    }

    // 确保任务栏显示
    win.setSkipTaskbar(false)

    // 聚焦并置顶
    win.focus()
    win.moveTop()

    // 【修复】记录唤醒结果
    const result = {
      visible: win.isVisible(),
      minimized: win.isMinimized(),
      focused: win.isFocused(),
    }
    writeStartupLog(`second-instance: 主窗口唤醒结果: ${JSON.stringify(result)}`)
    writeMainLog(
      'INFO',
      `second-instance: 窗口唤醒成功 - visible=${result.visible}, minimized=${result.minimized}`,
    )
  } else {
    writeStartupLog('second-instance: 主窗口不存在，创建新窗口')
    writeMainLog('WARN', 'second-instance: mainWindow not created yet, creating new window')
    createWindow()
  }
})

const XIUER_DEBUG_PATH = path.join(process.env.TEMP ?? os.tmpdir(), 'xiuer-window-debug.txt')
function logWindowDebug(phase: string, w: BrowserWindow | null = win): void {
  if (!STARTUP_DEBUG) return
  const ts = new Date().toISOString()
  const isVisible = w && !w.isDestroyed() ? w.isVisible() : false
  const isMinimized = w && !w.isDestroyed() ? w.isMinimized() : false
  const isFocused = w && !w.isDestroyed() ? w.isFocused() : false
  const line = `${ts} pid=${process.pid} ${phase} mainWindow=${!!w} visible=${isVisible} minimized=${isMinimized} focused=${isFocused}\n`
  try {
    appendFileSync(XIUER_DEBUG_PATH, line)
  } catch (_e) {
    // 忽略
  }
  writeStartupLog(
    `[WindowDebug] ${phase} - visible=${isVisible}, minimized=${isMinimized}, focused=${isFocused}`,
  )
}

/** 开发模式：等待开发服务器可连接 */
function waitForDevServer(
  url: string,
  maxWaitMs = 60000,
  intervalMs = 1000,
  initialDelayMs = 500,
): Promise<void> {
  let host = '127.0.0.1'
  let port = 5173
  try {
    const u = new URL(url)
    host = u.hostname || host
    port = u.port ? Number.parseInt(u.port, 10) : 5173
  } catch {
    // 用默认
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

// ==================== Preload 路径解析 ====================
const possiblePreloadPaths = [
  path.join(__dirname, '../preload/index.js'),
  path.join(__dirname, '../preload/index.mjs'),
  path.join(MAIN_DIST, 'preload/index.js'),
  path.join(MAIN_DIST, 'preload/index.mjs'),
  path.join(process.resourcesPath || '', 'app.asar.unpacked/dist-electron/preload/index.js'),
  path.join(process.resourcesPath || '', 'app/dist-electron/preload/index.js'),
]

let preload = ''
for (const p of possiblePreloadPaths) {
  if (existsSync(p)) {
    preload = p
    debugStartupLog(`找到 preload: ${p}`)
    break
  }
}

if (!preload) {
  writeStartupLog('警告: 未找到 preload 文件，将尝试使用默认路径')
  preload = possiblePreloadPaths[0]
}

const indexHtml = path.join(RENDERER_DIST, 'index.html')
debugStartupLog(`index.html 路径: ${indexHtml}`)
debugStartupLog(`index.html 存在: ${existsSync(indexHtml)}`)
debugStartupLog(`RENDERER_DIST: ${RENDERER_DIST}`)
debugStartupLog(`MAIN_DIST: ${MAIN_DIST}`)

if (STARTUP_DEBUG) {
  writeStartupLog('========== 路径诊断开始 ==========')
  debugStartupLog(`__dirname: ${__dirname}`)
  debugStartupLog(`process.env.APP_ROOT: ${process.env.APP_ROOT}`)
  debugStartupLog(`app.getAppPath(): ${app.getAppPath()}`)
  debugStartupLog(`process.resourcesPath: ${process.resourcesPath || 'N/A'}`)
  debugStartupLog(`process.execPath: ${process.execPath}`)
  debugStartupLog(`process.cwd(): ${process.cwd()}`)

  try {
    if (existsSync(RENDERER_DIST)) {
      const files = require('node:fs').readdirSync(RENDERER_DIST)
      debugStartupLog(`RENDERER_DIST 目录内容: ${files.join(', ')}`)
    } else {
      debugStartupLog(`RENDERER_DIST 目录不存在: ${RENDERER_DIST}`)
    }
  } catch (e) {
    debugStartupLog(`无法读取 RENDERER_DIST: ${e}`)
  }

  const asarPath = path.join(process.resourcesPath || '', 'app.asar')
  debugStartupLog(`app.asar 路径: ${asarPath}`)
  debugStartupLog(`app.asar 存在: ${existsSync(asarPath)}`)

  const unpackedPath = path.join(process.resourcesPath || '', 'app.asar.unpacked')
  debugStartupLog(`app.asar.unpacked 路径: ${unpackedPath}`)
  debugStartupLog(`app.asar.unpacked 存在: ${existsSync(unpackedPath)}`)
  writeStartupLog('========== 路径诊断结束 ==========')
}

// 持久化配置文件路径
const getConfigPath = () => path.join(app.getPath('userData'), 'app-config.json')

// 【长期方案】应用配置接口，预留 closeBehavior 设置项
interface AppConfig {
  hideToTrayTipDismissed: boolean
  // 关闭窗口行为: 'tray' = 最小化到托盘, 'quit' = 直接退出
  // 默认值: 'tray'（符合产品规则：关闭窗口时最小化到托盘）
  closeBehavior?: 'tray' | 'quit'
}

function getConfig(): AppConfig {
  const configPath = getConfigPath()
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(content) as AppConfig
      // 确保 closeBehavior 有默认值
      if (!parsed.closeBehavior) {
        parsed.closeBehavior = 'tray'
      }
      return parsed
    } catch (error) {
      createLogger('config').error('Failed to read config file:', error)
    }
  }
  // 默认配置
  return {
    hideToTrayTipDismissed: false,
    closeBehavior: 'tray',
  }
}

function setConfig(config: AppConfig) {
  const configPath = getConfigPath()
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
  } catch (error) {
    createLogger('config').error('Failed to write config file:', error)
  }
}

async function createWindow() {
  writeStartupLog('========== createWindow 开始 ==========')
  logWindowDebug('createWindow called')

  const isDev = !!VITE_DEV_SERVER_URL
  debugStartupLog(`VITE_DEV_SERVER_URL: ${VITE_DEV_SERVER_URL || 'N/A'}`)
  debugStartupLog(`isDev: ${isDev}`)
  debugStartupLog(`preload 路径: ${preload}`)
  debugStartupLog(`preload 存在: ${existsSync(preload)}`)

  // 【修复】Windows 打包版首屏显示规则
  // 规则：Windows 打包版首次启动必须显示主窗口，不依赖任何复杂状态
  // 参考：基线提交 fe6f675f 中的 forceShowOnWindows 逻辑
  const isWindowsPackaged = app.isPackaged && process.platform === 'win32'
  const isDevMode = isDev || !app.isPackaged
  // Windows 打包版强制显示，开发模式强制显示，其他平台按正常流程
  const showOnStart = isDevMode || isWindowsPackaged

  debugStartupLog(
    `[窗口显示规则] isWindowsPackaged=${isWindowsPackaged}, isDevMode=${isDevMode}, showOnStart=${showOnStart}`,
  )

  try {
    const iconPath = path.join(process.env.VITE_PUBLIC ?? '', 'favicon.png')
    debugStartupLog(`图标路径: ${iconPath}`)
    debugStartupLog(`图标存在: ${existsSync(iconPath)}`)

    win = new BrowserWindow({
      title: `秀儿直播助手 - v${app.getVersion()}`,
      width: 1280,
      height: 800,
      x: showOnStart ? 80 : undefined,
      y: showOnStart ? 60 : undefined,
      show: showOnStart,
      autoHideMenuBar: app.isPackaged,
      icon: existsSync(iconPath) ? iconPath : undefined,
      webPreferences: {
        preload,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: app.isPackaged,
      },
    })

    writeStartupLog('BrowserWindow 创建成功')
    writeMainLog('INFO', 'BrowserWindow created successfully')
    logWindowDebug('BrowserWindow created')

    // 窗口事件监听
    win.once('ready-to-show', () => {
      debugStartupLog('事件: ready-to-show 触发')
      logWindowDebug('ready-to-show')

      if (win && !win.isDestroyed()) {
        // 【修复】ready-to-show 时再次确保窗口显示
        win.show()
        debugStartupLog('窗口已显示 (ready-to-show)')

        // 开发模式或 Windows 打包版时聚焦窗口
        if (showOnStart) {
          win.focus()
          debugStartupLog('窗口已聚焦')
        }
      }
    })

    win.on('show', () => {
      debugStartupLog('事件: show 触发')
      logWindowDebug('show')
      writeMainLog('INFO', 'Window shown')
    })

    win.on('focus', () => {
      debugStartupLog('事件: focus 触发')
      logWindowDebug('focus')
    })

    win.on('closed', () => {
      debugStartupLog('事件: closed 触发')
      logWindowDebug('window closed')

      if (win?.isDestroyed()) {
        win = null
        debugStartupLog('窗口引用已清理')
      }

      // Windows 打包版兜底：若窗口被异常关闭且应用未退出，自动重建主窗口
      if (app.isPackaged && process.platform === 'win32' && !isQuitting) {
        writeMainLog('WARN', '检测到窗口异常关闭，准备重建窗口')
        setTimeout(() => {
          if (!win && !isQuitting) {
            logWindowDebug('window closed recovery: recreate window')
            writeMainLog('WARN', 'Window closed unexpectedly, recreating...')
            void createWindow()
          }
        }, 1000)
      }
    })

    win.on('unresponsive', () => {
      writeMainLog('ERROR', 'Window became unresponsive')
    })

    win.on('responsive', () => {
      debugStartupLog('事件: responsive 触发（窗口恢复响应）')
    })

    // 确保任务栏显示
    win.setSkipTaskbar(false)
    windowManager.setMainWindow(win)
    debugStartupLog('窗口已设置到 WindowManager')

    // 页面加载逻辑
    const DEV_LOAD_RETRY_MAX = 5
    const DEV_LOAD_RETRY_DELAY_MS = 6000
    let devLoadRetryCount = 0

    if (VITE_DEV_SERVER_URL) {
      debugStartupLog('开发模式：从 Vite 开发服务器加载')
      console.log('[main] 等待 Vite 开发服务器 (localhost:5173)...')
      await waitForDevServer(VITE_DEV_SERVER_URL).catch(() => {})
      console.log('[main] 正在加载页面:', VITE_DEV_SERVER_URL)
      debugStartupLog(`正在加载页面: ${VITE_DEV_SERVER_URL}`)

      win
        .loadURL(VITE_DEV_SERVER_URL)
        .then(() => {
          debugStartupLog('loadURL 成功')
        })
        .catch(err => {
          writeStartupLog(`loadURL 失败: ${err.message}`)
          writeMainLog('ERROR', `loadURL failed: ${err.message}`)
          logWindowDebug('loadURL failed')
        })

      // 开发环境：首次加载失败时自动重试
      win.webContents.on(
        'did-fail-load',
        (_, errorCode, errorDescription, validatedURL, isMainFrame) => {
          debugStartupLog(
            `did-fail-load: errorCode=${errorCode}, errorDescription=${errorDescription}`,
          )

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
              '次，请检查 Vite 是否已启动',
            )
            debugStartupLog(`开发页面加载已重试 ${DEV_LOAD_RETRY_MAX} 次，放弃重试`)
            return
          }
          devLoadRetryCount += 1
          console.log('[main] 开发页面加载失败，', DEV_LOAD_RETRY_DELAY_MS / 1000, '秒后重试')
          debugStartupLog(
            `开发页面加载失败，${DEV_LOAD_RETRY_DELAY_MS / 1000}秒后重试 (${devLoadRetryCount}/${DEV_LOAD_RETRY_MAX})`,
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
      // 生产环境：从本地文件加载
      debugStartupLog('生产模式：从本地文件加载')
      debugStartupLog(`正在加载文件: ${indexHtml}`)

      // 检查文件是否存在
      if (!existsSync(indexHtml)) {
        const errorMsg = `index.html 不存在: ${indexHtml}`
        writeStartupLog(`错误: ${errorMsg}`)
        writeMainLog('ERROR', errorMsg)

        // 尝试列出目录内容以便诊断
        try {
          const parentDir = path.dirname(indexHtml)
          if (existsSync(parentDir)) {
            const files = require('node:fs').readdirSync(parentDir)
            debugStartupLog(`目录 ${parentDir} 内容: ${files.join(', ')}`)
          } else {
            debugStartupLog(`父目录不存在: ${parentDir}`)
          }
        } catch (e) {
          debugStartupLog(`无法列出目录: ${e}`)
        }
      }

      win
        .loadFile(indexHtml)
        .then(() => {
          debugStartupLog('loadFile 成功')
        })
        .catch(err => {
          writeStartupLog(`loadFile 失败: ${err.message}`)
          writeMainLog('ERROR', `loadFile failed: ${err.message}`)
          logWindowDebug('loadFile failed')

          // 打包版主页面加载失败时重试
          if (app.isPackaged && process.platform === 'win32') {
            debugStartupLog('准备重试加载...')
            setTimeout(() => {
              if (win && !win.isDestroyed()) {
                debugStartupLog('重试加载文件...')
                win.loadFile(indexHtml).catch(retryErr => {
                  debugStartupLog(`重试失败: ${retryErr.message}`)
                  writeMainLog('ERROR', `loadFile retry failed: ${retryErr.message}`)
                })
              }
            }, 1200)
          }
        })
    }

    // webContents 事件监听
    win.webContents.on('did-finish-load', async () => {
      writeStartupLog('页面加载完成')

      // 启动时静默检查更新
      if (!isQuitting) {
        await updateManager.silentCheckForUpdate()
      }
    })

    win.webContents.on(
      'did-fail-load',
      (_, errorCode, errorDescription, validatedURL, isMainFrame) => {
        debugStartupLog(
          `事件: did-fail-load 触发 - errorCode=${errorCode}, errorDescription=${errorDescription}, isMainFrame=${isMainFrame}`,
        )
        debugStartupLog(`事件: did-fail-load - validatedURL=${validatedURL}`)
        writeMainLog(
          'ERROR',
          `Page failed to load: ${errorDescription} (${errorCode}) at ${validatedURL}`,
        )

        // 打包版加载失败时显示错误信息
        if (app.isPackaged && win && !win.isDestroyed()) {
          debugStartupLog('加载失败，尝试显示错误信息')
          win.webContents
            .executeJavaScript(`
          document.body.innerHTML = '<div style="padding:20px;font-family:sans-serif;">' +
            '<h1>页面加载失败</h1>' +
            '<p>错误码: ${errorCode}</p>' +
            '<p>错误描述: ${errorDescription}</p>' +
            '<p>URL: ${validatedURL}</p>' +
            '<p>主框架: ${isMainFrame}</p>' +
            '<p>时间: ${new Date().toISOString()}</p>' +
            '</div>';
        `)
            .catch(() => {})
          win.show()
        }
      },
    )

    win.webContents.on('render-process-gone', (_, details) => {
      debugStartupLog(
        `事件: render-process-gone 触发 - reason=${details.reason}, exitCode=${details.exitCode}`,
      )
      debugStartupLog(`事件: render-process-gone - details: ${JSON.stringify(details)}`)
      writeMainLog('ERROR', `render-process-gone: ${JSON.stringify(details)}`)
      logWindowDebug(`render-process-gone: ${details.reason}`)

      // 打包版渲染进程崩溃时显示错误信息
      if (app.isPackaged && win && !win.isDestroyed()) {
        debugStartupLog('渲染进程崩溃，尝试显示错误信息')
        try {
          win.webContents
            .executeJavaScript(`
            document.body.innerHTML = '<div style="padding:20px;font-family:sans-serif;">' +
              '<h1>渲染进程崩溃</h1>' +
              '<p>原因: ${details.reason}</p>' +
              '<p>退出码: ${details.exitCode}</p>' +
              '<p>时间: ${new Date().toISOString()}</p>' +
              '</div>';
          `)
            .catch(() => {})
          win.show()
        } catch (e) {
          writeStartupLog(`显示错误信息失败: ${e}`)
        }
      }

      if (app.isPackaged && process.platform === 'win32' && !isQuitting) {
        setTimeout(() => {
          if (!win || win.isDestroyed()) {
            logWindowDebug('render-process-gone recovery: recreate window')
            writeMainLog('WARN', 'Recreating window after render process crash')
            void createWindow()
          }
        }, 1000)
      }
    })

    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      const levelStr = ['debug', 'info', 'warning', 'error'][level] || 'unknown'

      // [SECURITY] 过滤敏感信息
      const SENSITIVE_PATTERNS = [
        /token[=:]\s*["']?[a-zA-Z0-9_\-.]+["']?/gi,
        /password[=:]\s*["']?[^"'\s]+["']?/gi,
        /code[=:]\s*["']?\d{4,8}["']?/gi,
        /secret[=:]\s*["']?[^"'\s]+["']?/gi,
        /authorization[:\s]+["']?bearer\s+[a-zA-Z0-9_\-.]+["']?/gi,
        /([?&])(token|password|code|secret)=[^&]*/gi,
      ]

      let sanitizedMessage = message
      for (const pattern of SENSITIVE_PATTERNS) {
        sanitizedMessage = sanitizedMessage.replace(pattern, '[REDACTED]')
      }

      // [LOG-LEVEL] debug 日志不记录到主日志
      if (levelStr !== 'debug') {
        writeMainLog('RENDERER', `[${levelStr}] ${sanitizedMessage} (${sourceId}:${line})`)
      }
    })

    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https:')) shell.openExternal(url)
      return { action: 'deny' }
    })

    // 关闭窗口事件处理
    win.on('close', e => {
      writeStartupLog(`事件: close 触发 - isQuitting=${isQuitting}, platform=${process.platform}`)

      if (win?.isDestroyed()) {
        return
      }

      // 如果正在退出，允许窗口关闭
      if (isQuitting) {
        writeStartupLog('应用正在退出，允许关闭窗口')
        return
      }

      // 根据配置决定关闭行为
      const config = getConfig()
      const closeBehavior = config.closeBehavior || 'tray'

      // 如果配置为直接退出，不拦截关闭事件
      if (closeBehavior === 'quit') {
        writeStartupLog('配置为直接退出，允许关闭窗口')
        return
      }

      // 拦截关闭事件，改为隐藏到托盘（默认行为）
      e.preventDefault()
      writeStartupLog('拦截关闭事件，改为隐藏到托盘')

      const shouldShowTip = !config.hideToTrayTipDismissed

      if (win && !win.isDestroyed()) {
        win.hide()
        win.setSkipTaskbar(true)
        writeStartupLog('窗口已隐藏到托盘')
      }

      if (shouldShowTip && Notification.isSupported()) {
        const notification = new Notification({
          title: '已最小化到托盘',
          body: '应用仍在后台运行，可从托盘图标打开。可在设置中关闭此提示。',
          icon: path.join(process.env.VITE_PUBLIC, 'favicon.png'),
          silent: false,
        })

        notification.on('click', () => {
          if (win && !win.isDestroyed()) {
            win.show()
            win.setSkipTaskbar(false)
            win.focus()
          }
        })

        notification.show()
      }
    })

    writeStartupLog('========== createWindow 完成 ==========')
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    writeStartupLog(`createWindow 错误: ${errorMsg}`)
    writeMainLog('ERROR', `createWindow failed: ${errorMsg}`)
    logWindowDebug('createWindow error')

    if (!app.isPackaged) {
      dialog.showErrorBox('窗口创建失败', errorMsg)
    }
  }
}

/** 内存日志间隔 */
const MEMORY_LOG_INTERVAL_MS = 60_000
let memoryLogInterval: NodeJS.Timeout | null = null

function startMemoryLogInterval() {
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

writeStartupLog('before whenReady')
logWindowDebug('before whenReady')

app
  .whenReady()
  .then(() => {
    writeStartupLog('========== app.whenReady 触发 ==========')
    logStartupInfo()
    logWindowDebug('after whenReady')

    // 【修复】开发模式下设置 Dock 图标（macOS）
    if (process.platform === 'darwin' && !app.isPackaged) {
      const dockIconPath = path.join(process.env.VITE_PUBLIC ?? '', 'icon.png')
      if (existsSync(dockIconPath) && app.dock) {
        try {
          const dockIcon = nativeImage.createFromPath(dockIconPath)
          app.dock.setIcon(dockIcon)
          debugStartupLog('Dock 图标已设置')
        } catch (err) {
          debugStartupLog(`设置 Dock 图标失败: ${err}`)
        }
      }
    }

    writeStartupLog('开始创建窗口')
    void createWindow()

    debugStartupLog('开始创建托盘')
    createTray()

    debugStartupLog('启动内存日志')
    startMemoryLogInterval()

    writeStartupLog('========== 应用启动完成 ==========')
  })
  .catch(err => {
    const errorMsg = err instanceof Error ? err.message : String(err)
    writeStartupLog(`app.whenReady 错误: ${errorMsg}`)
    writeMainLog('ERROR', `app.whenReady failed: ${errorMsg}`)
    console.error('app.whenReady failed:', err)
  })

app.on('window-all-closed', async () => {
  writeStartupLog(
    `事件: window-all-closed 触发 - platform=${process.platform}, isQuitting=${isQuitting}`,
  )

  // 【长期方案】所有平台：窗口关闭时应用保持运行（托盘模式）
  // 用户通过托盘菜单的"退出应用"才能彻底退出
  writeStartupLog('窗口全部关闭，应用保持运行（托盘模式）')
})

app.on('before-quit', _event => {
  writeStartupLog(`事件: before-quit 触发 - isQuitting=${isQuitting}`)

  if (!isQuitting) {
    isQuitting = true
    setAppQuitting(true)
    stopMemoryLogInterval()

    try {
      accountManager.cleanup()
      writeStartupLog('账户管理器已清理')
    } catch (error) {
      writeMainLog('ERROR', `清理账户管理器失败: ${error}`)
    }
  }
})

app.on('will-quit', _event => {
  writeStartupLog('事件: will-quit 触发')
  writeMainLog('INFO', '应用即将退出，执行最终清理...')

  if (tray) {
    try {
      tray.destroy()
      tray = null
      writeStartupLog('托盘已销毁')
    } catch (error) {
      writeMainLog('ERROR', `销毁托盘失败: ${error}`)
    }
  }

  if (win) {
    try {
      win.removeAllListeners()
      win = null
      writeStartupLog('窗口已清理')
    } catch (error) {
      writeMainLog('ERROR', `清理窗口失败: ${error}`)
    }
  }
})

app.on('activate', () => {
  writeStartupLog('事件: activate 触发')

  const allWindows = BrowserWindow.getAllWindows()
  writeStartupLog(`activate: 现有窗口数=${allWindows.length}`)

  if (allWindows.length) {
    const w = allWindows[0]
    if (!w.isDestroyed()) {
      w.show()
      w.focus()
      writeStartupLog('activate: 聚焦现有窗口')
    }
  } else {
    writeStartupLog('activate: 无窗口，创建新窗口')
    createWindow()
  }
})

// 崩溃和错误处理
const XIUER_CRASH_PATH = path.join(process.env.TEMP ?? os.tmpdir(), 'xiuer-crash.txt')
function writeCrashToTemp(tag: string, err: unknown): void {
  try {
    const ts = new Date().toISOString()
    const stack = err instanceof Error ? err.stack : String(err)
    const msg = err instanceof Error ? err.message : String(err)
    appendFileSync(XIUER_CRASH_PATH, `\n[${ts}] ${tag}\n${msg}\n${stack}\n`)
  } catch {
    // 忽略
  }
}

process.on('uncaughtException', error => {
  const errorMsg = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : 'No stack trace'
  writeStartupLog('========== uncaughtException ==========')
  writeStartupLog(`uncaughtException 消息: ${errorMsg}`)
  writeStartupLog(`uncaughtException 堆栈: ${errorStack}`)
  writeCrashToTemp('uncaughtException', error)
  const logger = createLogger('uncaughtException')
  logger.error('--------------意外的未捕获异常---------------')
  logger.error(error)
  logger.error('---------------------------------------------')

  if (!isQuitting) {
    try {
      dialog.showErrorBox(
        '应用程序错误',
        `发生了一个意外的错误，请联系技术支持：\n${error.message}`,
      )
    } catch (dialogError) {
      logger.error('显示错误对话框失败:', dialogError)
    }
  }
})

process.on('unhandledRejection', (reason, _promise) => {
  const reasonMsg = reason instanceof Error ? reason.message : String(reason)
  const reasonStack = reason instanceof Error ? reason.stack : 'No stack trace'
  writeStartupLog('========== unhandledRejection ==========')
  writeStartupLog(`unhandledRejection 原因: ${reasonMsg}`)
  writeStartupLog(`unhandledRejection 堆栈: ${reasonStack}`)

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
  writeStartupLog('createTray 开始')

  const iconPath = path.join(process.env.VITE_PUBLIC, 'favicon.png')
  let trayIcon: NativeImage

  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    if (trayIcon.getSize().width > 16) {
      trayIcon = trayIcon.resize({ width: 16, height: 16 })
    }
    writeStartupLog('托盘图标加载成功')
  } catch (error) {
    writeStartupLog(`托盘图标加载失败: ${error}`)
    writeMainLog('WARN', `Failed to load tray icon: ${error}`)
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)
  tray.setToolTip(app.getName())
  writeStartupLog('托盘已创建')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        writeStartupLog('托盘菜单: 显示主窗口')
        if (win && !win.isDestroyed()) {
          win.show()
          win.setSkipTaskbar(false)
          win.focus()
          win.moveTop()
          writeStartupLog('主窗口已显示')
        } else {
          writeStartupLog('主窗口不存在，创建新窗口')
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
        writeStartupLog('托盘菜单: 退出程序')
        quitApp()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    writeStartupLog('托盘点击事件')
    if (win && !win.isDestroyed()) {
      if (win.isVisible()) {
        win.focus()
        writeStartupLog('托盘点击: 窗口已可见，执行聚焦')
      } else {
        win.show()
        win.setSkipTaskbar(false)
        win.focus()
        writeStartupLog('托盘点击: 窗口已显示并聚焦')
      }
    } else {
      writeStartupLog('托盘点击: 窗口不存在，创建新窗口')
      createWindow()
    }
  })

  writeStartupLog('createTray 完成')
}

/**
 * 统一的退出应用方法
 */
function quitApp() {
  writeStartupLog(`quitApp 调用 - isQuitting=${isQuitting}`)

  if (isQuitting) {
    return
  }

  writeMainLog('INFO', '开始退出应用...')
  isQuitting = true
  setAppQuitting(true)

  stopMemoryLogInterval()

  try {
    accountManager.cleanup()
    writeStartupLog('账户管理器已清理')
  } catch (error) {
    writeMainLog('ERROR', `清理账户管理器失败: ${error}`)
  }

  if (tray && !tray.isDestroyed()) {
    try {
      tray.destroy()
      tray = null
      writeStartupLog('托盘已销毁')
    } catch (error) {
      writeMainLog('ERROR', `销毁托盘失败: ${error}`)
    }
  }

  if (win && !win.isDestroyed()) {
    try {
      win.removeAllListeners()
      win.close()
      win = null
      writeStartupLog('窗口已关闭')
    } catch (error) {
      writeMainLog('ERROR', `关闭窗口失败: ${error}`)
    }
  }

  writeStartupLog('调用 app.quit()')
  app.quit()
}

// IPC 处理
ipcMain.handle('app:setHideToTrayTipDismissed', (_, dismissed: boolean) => {
  writeStartupLog(`IPC: setHideToTrayTipDismissed=${dismissed}`)
  const config = getConfig()
  config.hideToTrayTipDismissed = dismissed
  setConfig(config)
})

ipcMain.handle('app:getHideToTrayTipDismissed', () => {
  const config = getConfig()
  writeStartupLog(`IPC: getHideToTrayTipDismissed=${config.hideToTrayTipDismissed}`)
  return config.hideToTrayTipDismissed
})

// 【长期方案】IPC: 获取/设置关闭窗口行为（预留设置项）
ipcMain.handle('app:getCloseBehavior', () => {
  const config = getConfig()
  writeStartupLog(`IPC: getCloseBehavior=${config.closeBehavior}`)
  return config.closeBehavior || 'tray'
})

ipcMain.handle('app:setCloseBehavior', (_, behavior: 'tray' | 'quit') => {
  writeStartupLog(`IPC: setCloseBehavior=${behavior}`)
  const config = getConfig()
  config.closeBehavior = behavior
  setConfig(config)
})
