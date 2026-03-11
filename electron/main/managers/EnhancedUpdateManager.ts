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
import { createLogger } from '../logger'
import { errorMessage, sleep } from '../utils'
import { cdnManager } from './CDNManager'
import { integrityManager } from './IntegrityManager'
import { type BackupInfo, rollbackManager } from './RollbackManager'
import { UpdateErrorCode, updateErrorHandler } from './UpdateErrorHandler'
import { type VersionInfo, versionManager } from './VersionManager'

const logger = createLogger('enhanced-update')

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

const _PRODUCT_NAME = '秀儿直播助手'

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
    const versionMatch = line.match(/^##\s+v?([0-9]+\.[0-9]+\.[0-9]+)/)

    if (versionMatch) {
      const versionInLog = versionMatch[1]
      if (semver.lte(versionInLog, userVersion)) {
        break
      }
    }

    result.push(line)
  }

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

let _latestVersion: string | null = null

async function fetchChangelog(): Promise<string | undefined> {
  return undefined
}

function getAssetsURL() {
  return ''
}

interface Updater {
  checkForUpdates(source: string): Promise<void>
  downloadUpdate(): void
  quitAndInstall(): void
}

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'paused' | 'ready' | 'error'
  versionInfo: VersionInfo | null
  progress: number
  error: string | null
}

class EnhancedUpdateManager {
  private currentState: UpdateState = {
    status: 'idle',
    versionInfo: null,
    progress: 0,
    error: null,
  }

  private autoCheckInterval: NodeJS.Timeout | null = null
  private isDownloading = false

  constructor() {
    logger.info('EnhancedUpdateManager initialized')
  }

  getState(): UpdateState {
    return { ...this.currentState }
  }

  async checkUpdateVersion(source?: string): Promise<{
    update: boolean
    version: string
    newVersion: string
    releaseNote?: string
  } | null> {
    try {
      this.updateState({ status: 'checking', error: null })
      logger.info(`Checking for updates, source: ${source || 'default'}`)

      if (!app.isPackaged) {
        logger.warn('Update check skipped: app is not packaged')
        return null
      }

      const versionInfo = await versionManager.checkForUpdates(source)

      if (versionInfo) {
        this.updateState({
          status: 'available',
          versionInfo,
        })

        const result = {
          update: true,
          version: versionInfo.currentVersion,
          newVersion: versionInfo.latestVersion,
          releaseNote: versionInfo.releaseNotes,
        }

        this.sendToRenderer(IPC_CHANNELS.updater.updateAvailable, result)

        logger.info(
          `Update available: ${versionInfo.currentVersion} -> ${versionInfo.latestVersion}`,
        )
        return result
      }

      this.updateState({ status: 'idle' })
      const result = {
        update: false,
        version: app.getVersion(),
        newVersion: app.getVersion(),
      }
      this.sendToRenderer(IPC_CHANNELS.updater.updateAvailable, result)

      return result
    } catch (error) {
      const errorMsg = errorMessage(error)
      logger.error('Failed to check for updates:', errorMsg)

      this.updateState({
        status: 'error',
        error: errorMsg,
      })

      const updateError = updateErrorHandler.createError(UpdateErrorCode.NETWORK_ERROR, errorMsg, {
        recoverable: true,
      })
      await updateErrorHandler.handleError(updateError)

      return null
    }
  }

  async checkForUpdates(source = 'github'): Promise<void> {
    const platformUpdater =
      platform() === 'darwin' ? new EnhancedMacOSUpdater() : new EnhancedWindowsUpdater()

    await platformUpdater.checkForUpdates(source)
  }

  async startDownload(source?: string): Promise<void> {
    if (this.isDownloading) {
      logger.warn('Download already in progress')
      return
    }

    try {
      this.isDownloading = true
      this.updateState({ status: 'downloading', progress: 0, error: null })

      if (source) {
        cdnManager.setCDN(source)
      }

      cdnManager.forceHealthCheck()
      await new Promise(resolve => setTimeout(resolve, 500))

      logger.info(`Starting download, using CDN: ${cdnManager.getCurrentCDN()}`)

      const platformUpdater =
        platform() === 'darwin' ? new EnhancedMacOSUpdater() : new EnhancedWindowsUpdater()

      await platformUpdater.downloadUpdate()
    } catch (error) {
      const errorMsg = errorMessage(error)
      logger.error('Download failed:', errorMsg)

      const backup = rollbackManager.getLatestBackup()
      if (backup) {
        logger.info('Attempting rollback after download failure')
        await rollbackManager.rollbackToVersion(backup.version)
      }

      this.updateState({
        status: 'error',
        error: errorMsg,
      })
    } finally {
      this.isDownloading = false
    }
  }

  async pauseDownload(): Promise<void> {
    this.updateState({ status: 'paused' })
    logger.info('Download paused')
  }

  async resumeDownload(): Promise<void> {
    this.updateState({ status: 'downloading' })
    logger.info('Download resumed')
  }

  async cancelDownload(): Promise<void> {
    this.updateState({ status: 'idle', progress: 0 })
    logger.info('Download cancelled')
  }

  async quitAndInstall(): Promise<void> {
    logger.info('Preparing to quit and install update')
    const platformUpdater =
      platform() === 'darwin' ? new EnhancedMacOSUpdater() : new EnhancedWindowsUpdater()

    await platformUpdater.quitAndInstall()
  }

  async rollback(targetVersion?: string): Promise<boolean> {
    logger.info(`Rolling back to version: ${targetVersion || 'latest'}`)

    try {
      const latestBackup = rollbackManager.getLatestBackup()
      if (!targetVersion && !latestBackup) {
        logger.warn('No backup available for rollback')
        return false
      }

      let success: boolean
      if (targetVersion) {
        success = await rollbackManager.rollbackToVersion(targetVersion)
      } else {
        success = await rollbackManager.restoreBackup(latestBackup!.id)
      }

      if (success) {
        this.updateState({ status: 'idle', versionInfo: null })
        this.sendToRenderer(IPC_CHANNELS.updater.updateAvailable, {
          update: false,
          version: app.getVersion(),
          newVersion: app.getVersion(),
        })
      }

      return success
    } catch (error) {
      logger.error('Rollback failed:', error)
      return false
    }
  }

  async listBackups(): Promise<BackupInfo[]> {
    return await rollbackManager.listBackups()
  }

  setAutoCheck(enabled: boolean, intervalMs = 3600000): void {
    if (enabled && !this.autoCheckInterval) {
      this.autoCheckInterval = setInterval(() => {
        this.checkUpdateVersion()
      }, intervalMs)
      logger.info(`Auto check enabled, interval: ${intervalMs}ms`)
    } else if (!enabled && this.autoCheckInterval) {
      clearInterval(this.autoCheckInterval)
      this.autoCheckInterval = null
      logger.info('Auto check disabled')
    }
  }

  private updateState(partial: Partial<UpdateState>): void {
    this.currentState = { ...this.currentState, ...partial }
  }

  private sendToRenderer(channel: string, data?: any): void {
    windowManager.send(channel as any, data)
  }
}

class EnhancedWindowsUpdater implements Updater {
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
    this.autoUpdater.autoDownload = false
  }

  private registerEventListener() {
    this.autoUpdater.on('checking-for-update', () => {
      logger.debug('Checking for update...')
    })

    this.autoUpdater.on('update-available', async (info: UpdateInfo) => {
      logger.info(`Update available: ${info.version}`)

      try {
        const backup = await rollbackManager.createBackup(app.getVersion())
        logger.info(`Backup created: ${backup.id}`)
      } catch (error) {
        logger.warn('Failed to create backup:', error)
      }

      const releaseNote = await fetchChangelog()
      windowManager.send(IPC_CHANNELS.updater.updateAvailable, {
        update: true,
        version: app.getVersion(),
        newVersion: info.version,
        releaseNote,
      })
    })

    this.autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      logger.info(`No update available: ${info.version}`)
      windowManager.send(IPC_CHANNELS.updater.updateAvailable, {
        update: false,
        version: app.getVersion(),
        newVersion: info.version,
      })
    })

    this.autoUpdater.on('download-progress', (progressInfo: ProgressInfo) => {
      windowManager.send(IPC_CHANNELS.updater.downloadProgress, progressInfo)
    })

    this.autoUpdater.on('update-downloaded', async (event: UpdateDownloadedEvent) => {
      logger.info(`Update downloaded: ${event.version}`)

      try {
        const isValid = await integrityManager.verifyChecksum(event.downloadedFile!, {
          algorithm: 'sha512',
          value: '',
        })

        if (isValid) {
          windowManager.send(IPC_CHANNELS.updater.updateDownloaded, event)
        } else {
          const error = updateErrorHandler.createError(
            UpdateErrorCode.CHECKSUM_MISMATCH,
            'Update package verification failed',
            { recoverable: true, canRollback: true },
          )
          await updateErrorHandler.handleError(error)
        }
      } catch (error) {
        logger.error('Verification error:', error)
      }
    })

    this.autoUpdater.on('error', async (error: Error) => {
      logger.error('Update error:', error.message)

      const updateError = updateErrorHandler.createError(
        UpdateErrorCode.UNKNOWN_ERROR,
        error.message,
        { details: error, recoverable: true, canRollback: true },
      )
      await updateErrorHandler.handleError(updateError)

      windowManager.send(IPC_CHANNELS.updater.updateError, {
        message: error.message,
      })
    })
  }

  async checkForUpdates(source: string) {
    this.autoUpdater.requestHeaders = { authorization: '' }

    try {
      if (!app.isPackaged) {
        if (!this.autoUpdater.forceDevUpdateConfig) {
          windowManager.send(IPC_CHANNELS.updater.updateError, {
            message: '更新功能仅在应用打包后可用。',
          })
          return
        }
      }

      logger.debug(`Checking for updates, source: ${source}`)

      if (source === 'github') {
        throw new Error('GitHub updates disabled in commercial release')
      }

      let sourceURL: URL
      try {
        sourceURL = new URL(source)
      } catch {
        throw new Error(`更新源设置错误: ${source}`)
      }

      const assetsURL = getAssetsURL()
      this.autoUpdater.setFeedURL({
        provider: 'generic',
        url: `${sourceURL}${assetsURL}`,
      })

      await this.autoUpdater.checkForUpdates()
    } catch (error) {
      const message = `检查更新时发生错误: ${errorMessage(error).split('\n')[0]}`
      logger.error(message)
      windowManager.send(IPC_CHANNELS.updater.updateError, { message })
    }
  }

  downloadUpdate() {
    this.autoUpdater.downloadUpdate()
  }

  quitAndInstall() {
    this.autoUpdater.quitAndInstall(false, true)
  }
}

class EnhancedMacOSUpdater implements Updater {
  private versionInfo: LatestYml | null = null
  private assetsURL: string | null = null
  private savePath: string | null = null
  private safeSource = ''

  async checkForUpdates(source: string) {
    try {
      const assetsURL = getAssetsURL()
      this.safeSource = source === 'github' ? '' : new URL(source).href
      this.assetsURL = assetsURL

      const latestYmlURL = `${this.safeSource}${new URL('latest-mac.yml', this.assetsURL)}`
      const ymlContent = (await net.fetch(latestYmlURL).then(res => res.text())) as string
      const latestYml = yaml.parse(ymlContent) as LatestYml

      if (!latestYml) {
        throw new Error('获取文件更新信息失败')
      }

      this.versionInfo = latestYml
      _latestVersion = latestYml.version

      if (semver.lt(latestYml.version, app.getVersion())) {
        logger.info(`${app.getVersion()} 已经是最新版本`)
        windowManager.send(IPC_CHANNELS.updater.updateAvailable, {
          update: false,
          version: app.getVersion(),
          newVersion: latestYml.version,
        })
        return
      }

      logger.info(`Update available: ${app.getVersion()} -> ${latestYml.version}`)

      try {
        const backup = await rollbackManager.createBackup(app.getVersion())
        logger.info(`Backup created: ${backup.id}`)
      } catch (error) {
        logger.warn('Failed to create backup:', error)
      }

      windowManager.send(IPC_CHANNELS.updater.updateAvailable, {
        update: true,
        version: app.getVersion(),
        newVersion: latestYml.version,
      })
    } catch (err) {
      const message = errorMessage(err)
      logger.error(message)
      windowManager.send(IPC_CHANNELS.updater.updateError, { message })
    }
  }

  async downloadUpdate() {
    if (!this.versionInfo) {
      throw new Error('No version info available')
    }

    let fileUrl: string | undefined
    let setupFile: any | undefined

    try {
      const ext = '.dmg'
      const archName = arch()

      setupFile = this.versionInfo.files.find(file => {
        if (!file.url.endsWith(ext)) return false
        const possibleArchs = [archName, 'universal', '']
        return possibleArchs.some(arch => file.url.includes(arch))
      })

      if (!setupFile) {
        throw new Error(`找不到安装包文件 (${platform()}-${archName})`)
      }

      this.savePath = path.join(app.getPath('downloads'), 'taisi-update-setup.dmg')

      if (existsSync(this.savePath)) {
        const localFileSha512 = await this.calculateFileHash(this.savePath)
        if (localFileSha512 === setupFile.sha512) {
          logger.debug('Local file exists and matches, skipping download')
          windowManager.send(IPC_CHANNELS.updater.updateDownloaded)
          return
        }
      }

      fileUrl = `${this.safeSource}${new URL(setupFile.url, this.assetsURL!)}`
      const resp = await net.fetch(fileUrl)

      if (!resp.ok) {
        throw new Error(`网络错误: ${resp.statusText}`)
      }

      const totalBytes = Number.parseInt(resp.headers.get('Content-Length') ?? '0', 10)
      logger.debug(`Downloading file, size: ${totalBytes / 1024 / 1024} MB`)

      let downloadBytes = 0
      const reader = resp.body?.getReader()

      if (!reader) {
        throw new Error('获取文件流失败')
      }

      if (existsSync(this.savePath)) {
        unlinkSync(this.savePath)
      }
      const fileWriter = createWriteStream(this.savePath)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        downloadBytes += value.length
        fileWriter.write(value)

        if (totalBytes > 0) {
          const progress = (downloadBytes / totalBytes) * 100
          windowManager.send(IPC_CHANNELS.updater.downloadProgress, {
            percent: progress,
            transferred: downloadBytes,
            total: totalBytes,
            bytesPerSecond: 0,
          } as any)
        }
      }

      fileWriter.end()
      logger.debug('File download complete')
      windowManager.send(IPC_CHANNELS.updater.updateDownloaded)
    } catch (err) {
      const message = `下载文件失败: ${errorMessage(err)}`
      logger.error(message)
      windowManager.send(IPC_CHANNELS.updater.updateError, { message, downloadURL: fileUrl })
    }
  }

  async quitAndInstall() {
    if (!this.savePath) {
      throw new Error('未指定下载文件路径')
    }

    if (existsSync(this.savePath)) {
      await shell.openPath(this.savePath)
      await sleep(3000)
      app.quit()
    } else {
      logger.error(`下载文件 ${this.savePath} 不存在`)
    }
  }

  private calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha512')
      const stream = createReadStream(filePath)

      stream.on('data', chunk => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('base64')))
      stream.on('error', reject)
    })
  }
}

export const enhancedUpdateManager = new EnhancedUpdateManager()
