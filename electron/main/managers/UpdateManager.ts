import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, unlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { arch, platform } from 'node:os'
import path from 'node:path'
import { app, net, shell } from 'electron'
import type { AppUpdater, ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater'
import { marked } from 'marked'
import semver from 'semver'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import * as yaml from 'yaml'
import windowManager from '#/windowManager'
import { createLogger, isAppQuitting } from '../logger'
import { errorMessage, sleep } from '../utils'

type LatestYml = {
  version: string
  files: Array<{
    url: string
    sha512: string
    size: number
  }>
  path: string
  sha512: string
  releaseDate: string
}

const _PRODUCT_OWNER = '秀儿直播助手'
const PRODUCT_NAME = '秀儿直播助手'

const logger = createLogger('update')

// marked 生成的 html 要在新页面打开链接
marked.use({
  renderer: {
    link: ({ href, title, text }) => {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer"${title ? ` title="${title}"` : ''}>${text}</a>`
    },
  },
})

function _extractChanges(changelogContent: string, userVersion: string): string {
  const lines = changelogContent.split('\n')
  const result = []

  for (const line of lines) {
    const versionMatch = line.match(/^##\s+v?([0-9]+\.[0-9]+\.[0-9]+)/) // 匹配版本 "## vX.Y.Z" 或 "## X.Y.Z"

    if (versionMatch) {
      const versionInLog = versionMatch[1] // X.Y.Z
      // 遇到小于等于当前版本的就停止
      if (semver.lte(versionInLog, userVersion)) {
        break
      }
    }

    result.push(line)
  }

  // slice(1) 负责过滤开头的 # Changelog
  return result.slice(1).join('\n')
}

async function _fetchWithRetry(url: string | URL, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = (await timeoutFetch(url)) as Response
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (e) {
      if (i === retries - 1) throw e
      await sleep(delay)
    }
  }
}

async function timeoutFetch(url: string | URL, timeout = 5000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await net.fetch(url.toString(), {
      signal: controller.signal,
      // 不加上 User-Agent 会访问超时
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    })
    clearTimeout(timeoutId)
    return response
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('Fetch timeout')
    }
    throw err
  }
}

const _releaseNotes: Record<string, string> = {}
const latestVersion: string | null = null

// Get latest version from GitHub Releases
async function _getLatestVersion(): Promise<string | null> {
  try {
    const response = await net.fetch(
      'https://api.github.com/repos/Xiuer-Chinese/Xiuer-live-tools/releases/latest',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'application/vnd.github.v3+json',
        },
      },
    )
    if (!response.ok) {
      logger.error(`Failed to fetch latest version: ${response.status}`)
      return null
    }
    const data = (await response.json()) as { tag_name: string }
    return data.tag_name.replace(/^v/, '')
  } catch (error) {
    logger.error('Failed to get latest version:', error)
    return null
  }
}

// Fetch changelog from GitHub Releases
async function fetchChangelog(): Promise<string | undefined> {
  try {
    const response = await net.fetch(
      'https://api.github.com/repos/Xiuer-Chinese/Xiuer-live-tools/releases/latest',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'application/vnd.github.v3+json',
        },
      },
    )
    if (!response.ok) return undefined
    const data = (await response.json()) as { body: string }
    return data.body
  } catch {
    return undefined
  }
}

// Get GitHub Release assets URL
function getAssetsURL(): string {
  return 'https://github.com/Xiuer-Chinese/Xiuer-live-tools/releases/latest'
}

interface Updater {
  checkForUpdates(source: string): Promise<void>
  downloadUpdate(): void
  quitAndInstall(): void
}

class UpdateManager {
  constructor(private updater: Updater) {}

  public async checkForUpdates(source = 'github') {
    await this.updater.checkForUpdates(source)
  }

  public async checkUpdateVersion() {
    // 首发版：启用更新检查
    logger.info('检查更新版本...')
    return this.checkForUpdates('github')
  }

  public async silentCheckForUpdate() {
    // 首发版：静默检查更新（启动时调用）
    logger.info('启动时静默检查更新...')
    try {
      await this.checkForUpdates('github')
    } catch (error) {
      // 静默检查失败不提示用户
      logger.warn('静默检查更新失败:', error)
    }
  }

  public startDownload() {
    logger.info('开始下载更新……')
    this.updater.downloadUpdate()
  }

  public async quitAndInstall() {
    logger.info('准备退出并安装更新')
    this.updater.quitAndInstall()
  }
}

class WindowsUpdater implements Updater {
  private autoUpdater: AppUpdater
  constructor() {
    const { autoUpdater }: { autoUpdater: AppUpdater } = createRequire(import.meta.url)(
      'electron-updater',
    )
    this.autoUpdater = autoUpdater
    this.configureUpdater()
    this.registerEventListener()
  }

  private configureUpdater() {
    this.autoUpdater.forceDevUpdateConfig = true
    this.autoUpdater.disableWebInstaller = false
    this.autoUpdater.allowDowngrade = false
  }

  private registerEventListener() {
    this.autoUpdater.on('checking-for-update', () => {
      logger.debug('检查更新流程已启动...')
    })

    this.autoUpdater.on('update-available', async (info: UpdateInfo) => {
      if (isAppQuitting) return
      logger.info(`有可用更新！当前版本：${app.getVersion()}，新版本：${info.version}`)

      const releaseNote = await fetchChangelog()
      windowManager.send(IPC_CHANNELS.updater.updateAvailable, {
        update: true,
        version: app.getVersion(),
        newVersion: info.version,
        releaseNote,
      })
    })

    this.autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      if (isAppQuitting) return
      logger.info(`无可用更新。当前版本：${app.getVersion()}，新版本：${info.version}`)
      windowManager.send(IPC_CHANNELS.updater.updateAvailable, {
        update: false,
        version: app.getVersion(),
        newVersion: info.version,
      })
    })

    this.autoUpdater.on('download-progress', (progressInfo: ProgressInfo) => {
      if (isAppQuitting) return
      windowManager.send(IPC_CHANNELS.updater.downloadProgress, progressInfo)
    })

    this.autoUpdater.on('update-downloaded', (event: UpdateDownloadedEvent) => {
      if (isAppQuitting) return
      logger.info(`${event.version} 更新下载完成!`)
      windowManager.send(IPC_CHANNELS.updater.updateDownloaded, event)
    })

    this.autoUpdater.on('error', (error: Error) => {
      if (isAppQuitting) return
      logger.error('更新出错：', error.message)
      windowManager.send(IPC_CHANNELS.updater.updateError, {
        message: error.message,
        error,
      })
    })
  }

  private async checkUpdateForGithub() {
    // 首发版：启用 GitHub Releases 自动更新
    logger.info('正在从 GitHub Releases 检查更新...')
    try {
      return await this.autoUpdater.checkForUpdates()
    } catch (error) {
      if (isAppQuitting) return
      const message = `检查 GitHub 更新失败：${errorMessage(error).split('\n')[0]}`
      logger.error(message)
      windowManager.send(IPC_CHANNELS.updater.updateError, { message })
    }
  }

  private async checkUpdateForGhProxy(source: string) {
    let sourceURL: URL
    try {
      sourceURL = new URL(source)
    } catch {
      const msg = `更新源设置错误，你的更新源为 ${source}`
      throw new Error(msg)
    }
    const assetsURL = getAssetsURL()
    // 自定义更新源
    this.autoUpdater.setFeedURL({
      provider: 'generic',
      url: `${sourceURL}${assetsURL}`,
    })
    try {
      return await this.autoUpdater.checkForUpdates()
    } catch (error) {
      if (isAppQuitting) return
      const message = `网络错误：${errorMessage(error).split('\n')[0]}`
      const downloadURL = `${sourceURL}${assetsURL}${PRODUCT_NAME}_${latestVersion}_windows_x64.exe`
      windowManager.send(IPC_CHANNELS.updater.updateError, { message, downloadURL })
    }
  }

  public async checkForUpdates(source: string) {
    // 默认情况会在请求的资源 URL 后面添加查询参数 noCache
    // 但是很多 proxy 站点并没有针对 query 优化，就会导致 404
    // 本身通过 proxy 访问的 URL 就带有版本号，所以 noCache 完全没作用
    // 通过下面的 hack 可以不附带 noCache 查询
    // https://github.com/electron-userland/electron-builder/issues/3415#issuecomment-433082387
    this.autoUpdater.requestHeaders = { authorization: '' }
    try {
      if (!app.isPackaged) {
        if (!this.autoUpdater.forceDevUpdateConfig) {
          const message = '更新功能仅在应用打包后可用。'
          windowManager.send(IPC_CHANNELS.updater.updateError, { message })
          return
        }
        // 开发环境下的更新，要先启动 slow-server (pnpm slow-server)
        // await this.autoUpdater.checkForUpdates()
        // return
      }
      logger.debug(`检查更新中…… (更新源: ${source})`)

      if (source === 'github') {
        await this.checkUpdateForGithub()
      } else {
        await this.checkUpdateForGhProxy(source)
      }
    } catch (error) {
      const message = `检查更新时发生错误: ${errorMessage(error)}`
      logger.error(message)
      windowManager.send(IPC_CHANNELS.updater.updateError, { message })
    }
  }

  public async downloadUpdate() {
    this.autoUpdater.downloadUpdate()
  }

  public async quitAndInstall() {
    this.autoUpdater.quitAndInstall(false, true)
  }
}

class MacOSUpdater implements Updater {
  private versionInfo: LatestYml | null = null
  private assetsURL: string | null = null
  private savePath: string | null = null
  private safeSource = ''
  /**
   * MacOS 如果使用 autoUpdater 需要提供 zip 文件，但是下载了 zip 之后又不能安装，因为没有签名
   * 所以干脆就手动下载 dmg 文件，下载完毕后退出应用，手动安装
   */
  public async checkForUpdates(source: string) {
    // 先从 latest-mac.yml 中获取目标文件
    try {
      const assetsURL = getAssetsURL()
      this.safeSource = source === 'github' ? '' : new URL(source).href
      this.assetsURL = assetsURL
      const latestYmlURL = `${this.safeSource}${new URL('latest-mac.yml', this.assetsURL)}`
      const ymlContent = (await net.fetch(latestYmlURL).then(res => res.text())) as string
      const latestYml = yaml.parse(ymlContent) as LatestYml

      if (!latestYml) {
        const message = '获取文件更新信息失败'
        throw new Error(message)
      }
      this.versionInfo = latestYml
      if (semver.lt(latestYml.version, app.getVersion())) {
        logger.info(`${app.getVersion()} 已经是最新版本，无需更新`)
        return
      }
    } catch (err) {
      if (isAppQuitting) return
      const message = errorMessage(err)
      logger.error(message)
      windowManager.send(IPC_CHANNELS.updater.updateError, { message: message })
      return
    }
    this.downloadUpdate()
  }

  public async downloadUpdate() {
    let fileUrl: string | undefined
    let setupFile: any | undefined
    try {
      // 根据平台选择正确的文件扩展名
      const ext = platform() === 'darwin' ? '.dmg' : '.exe'
      const archName = arch()

      // 支持多种架构命名约定
      setupFile = this.versionInfo?.files.find(file => {
        if (!file.url.endsWith(ext)) return false

        // 检查是否包含当前架构或通用包标识
        const possibleArchs = [archName, 'universal', '']
        return possibleArchs.some(arch => file.url.includes(arch))
      })

      if (!setupFile) {
        const message = `找不到安装包文件 (${platform()}-${archName})`
        throw new Error(message)
      }
      // 先检查本地是否已经有了这个文件（计算 Sha512）
      this.savePath = path.join(app.getPath('downloads'), '秀儿直播助手-update-setup.dmg')
      if (existsSync(this.savePath)) {
        const localFileSha512 = await this.calculateFileHash(this.savePath)
        logger.debug(`检测到本地文件，计算 Sha512 哈希值为 ${localFileSha512}`)
        if (localFileSha512 === setupFile.sha512) {
          logger.debug('本地已存在安装包，无需重复下载')
          if (!isAppQuitting) {
            windowManager.send(IPC_CHANNELS.updater.updateDownloaded)
          }
          return
        }
      }
      fileUrl = `${this.safeSource}${new URL(setupFile.url, this.assetsURL!)}`
      const resp = await net.fetch(fileUrl)
      if (!resp.ok) {
        const message = `网络错误: ${resp.statusText}`
        throw new Error(message)
      }

      const totalBytes = Number.parseInt(resp.headers.get('Content-Length') ?? '0', 10)
      logger.debug(`开始下载文件 ${fileUrl}，文件大小 ${totalBytes / 1024 / 1024} MB`)
      let downloadBytes = 0

      const reader = resp.body?.getReader()
      if (!reader) {
        const message = '获取文件流失败'
        throw new Error(message)
      }
      // 删除已存在的文件
      if (existsSync(this.savePath)) {
        unlinkSync(this.savePath)
      }
      const fileWriter = createWriteStream(this.savePath)

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        downloadBytes += value.length
        fileWriter.write(value)

        if (totalBytes > 0) {
          const progress = (downloadBytes / totalBytes) * 100
          if (!isAppQuitting) {
            windowManager.send(IPC_CHANNELS.updater.downloadProgress, {
              delta: totalBytes - downloadBytes,
              percent: progress,
              bytesPerSecond: 0,
              transferred: downloadBytes,
              total: totalBytes,
            })
          }
        }
      }
      fileWriter.end()
      logger.debug(`文件 ${fileUrl} 下载完成，保存到 ${this.savePath}`)
      if (!isAppQuitting) {
        windowManager.send(IPC_CHANNELS.updater.updateDownloaded)
      }
    } catch (err) {
      if (isAppQuitting) return
      const message = `下载文件失败：${errorMessage(err)}`
      logger.error(message)
      windowManager.send(IPC_CHANNELS.updater.updateError, { message, downloadURL: fileUrl })
    }
  }

  public async quitAndInstall() {
    // 找到下载文件的路径
    if (!this.savePath) {
      const message = '未指定下载文件路径'
      throw new Error(message)
    }
    if (existsSync(this.savePath)) {
      // 打开文件
      await shell.openPath(this.savePath)
      // 等待一会后退出应用
      await sleep(3000)
      if (isAppQuitting) return
      app.quit()
    } else {
      logger.error(`下载文件 ${this.savePath} 不存在`)
    }
    return
  }

  private calculateFileHash(filePath: string) {
    return new Promise<string>((resolve, reject) => {
      const hash = createHash('sha512')
      const stream = createReadStream(filePath)

      stream.on('data', chunk => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('base64')))
      stream.on('error', reject)
    })
  }
}

export const updateManager = new UpdateManager(
  platform() === 'darwin' ? new MacOSUpdater() : new WindowsUpdater(),
)
