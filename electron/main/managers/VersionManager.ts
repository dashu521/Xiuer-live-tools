import { app, net } from 'electron'
import semver from 'semver'
import * as yaml from 'yaml'
import { createLogger } from '../logger'
import { errorMessage, sleep } from '../utils'

const logger = createLogger('version-manager')

export interface VersionInfo {
  currentVersion: string
  latestVersion: string
  releaseDate: string
  releaseNotes?: string
  minSupportedVersion?: string
  mandatory: boolean
  assets: AssetInfo[]
}

export interface AssetInfo {
  filename: string
  size: number
  sha256: string
  sha512?: string
  platform: 'windows' | 'mac' | 'linux'
  arch: 'x64' | 'arm64' | 'universal'
  downloadUrl: string
}

export interface UpdateChannel {
  name: 'stable' | 'beta' | 'nightly'
  priority: number
  checkUrl: string
}

export interface ComparisonResult {
  hasUpdate: boolean
  updateType: 'major' | 'minor' | 'patch' | 'none'
  isMandatory: boolean
}

interface LatestYml {
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

class VersionManager {
  private channels: UpdateChannel[] = []
  private currentChannel: UpdateChannel | null = null

  constructor() {
    this.initializeChannels()
  }

  private initializeChannels() {
    this.channels = [
      { name: 'stable', priority: 1, checkUrl: 'https://xiuer.work/releases/latest' },
      { name: 'beta', priority: 2, checkUrl: '' },
      { name: 'nightly', priority: 3, checkUrl: '' },
    ]
  }

  setChannel(channelName: 'stable' | 'beta' | 'nightly') {
    this.currentChannel = this.channels.find(c => c.name === channelName) || this.channels[0]
    logger.info(`Update channel set to: ${this.currentChannel.name}`)
  }

  getChannel(): UpdateChannel | null {
    return this.currentChannel
  }

  async checkForUpdates(source?: string): Promise<VersionInfo | null> {
    try {
      const channel = this.currentChannel || this.channels[0]
      let checkUrl = channel.checkUrl

      if (source && source !== 'github') {
        checkUrl = source
      }

      if (!checkUrl) {
        logger.debug('No update source configured, skipping check')
        return null
      }

      const versionInfo = await this.fetchVersionInfo(checkUrl)
      const currentVersion = app.getVersion()

      const comparison = this.compareVersions(currentVersion, versionInfo.latestVersion)

      if (comparison.hasUpdate) {
        logger.info(`Update available: ${currentVersion} -> ${versionInfo.latestVersion}`)
        return {
          ...versionInfo,
          currentVersion,
        }
      }

      logger.info('Application is up to date')
      return null
    } catch (error) {
      logger.error('Failed to check for updates:', error)
      throw error
    }
  }

  async fetchVersionInfo(sourceUrl: string): Promise<VersionInfo> {
    const platform = process.platform === 'darwin' ? 'mac' : 'windows'
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
    const ymlFile = platform === 'mac' ? 'latest-mac.yml' : 'latest.yml'

    let baseUrl = sourceUrl
    if (!sourceUrl.startsWith('http')) {
      baseUrl = `https://${sourceUrl}`
    }

    // 添加缓存破坏参数，防止 CDN 缓存导致版本不一致
    const cacheBuster = `_${Date.now()}`
    const ymlUrl = new URL(`${ymlFile}?_t=${cacheBuster}`, baseUrl).href
    logger.debug(`Fetching version info from: ${ymlUrl}`)

    const response = await this.fetchWithRetry(ymlUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch version info: ${response.status} ${response.statusText}`)
    }

    const ymlContent = await response.text()
    const latestYml = yaml.parse(ymlContent) as LatestYml

    if (!latestYml || !latestYml.version) {
      throw new Error('Invalid version info format')
    }

    const assets: AssetInfo[] = latestYml.files
      .filter(file => {
        if (platform === 'mac') {
          return file.url.endsWith('.dmg')
        }
        return file.url.endsWith('.exe')
      })
      .map(file => ({
        filename: file.url.split('/').pop() || '',
        size: file.size,
        sha256: file.sha512,
        sha512: file.sha512,
        platform: platform as 'windows' | 'mac',
        arch: arch as 'x64' | 'arm64',
        downloadUrl: new URL(file.url, baseUrl).href,
      }))

    return {
      currentVersion: app.getVersion(),
      latestVersion: latestYml.version,
      releaseDate: latestYml.releaseDate,
      releaseNotes: undefined,
      mandatory: false,
      assets,
    }
  }

  compareVersions(current: string, latest: string): ComparisonResult {
    if (!semver.valid(current) || !semver.valid(latest)) {
      logger.warn('Invalid semver version detected')
      return { hasUpdate: false, updateType: 'none', isMandatory: false }
    }

    const hasUpdate = semver.lt(current, latest)
    let updateType: ComparisonResult['updateType'] = 'none'

    if (hasUpdate) {
      if (semver.major(latest) > semver.major(current)) {
        updateType = 'major'
      } else if (semver.minor(latest) > semver.minor(current)) {
        updateType = 'minor'
      } else {
        updateType = 'patch'
      }
    }

    return {
      hasUpdate,
      updateType,
      isMandatory: false,
    }
  }

  shouldUpdate(current: string, latest: string): boolean {
    const comparison = this.compareVersions(current, latest)
    return comparison.hasUpdate
  }

  isMandatoryUpdate(current: string, minSupported: string): boolean {
    if (!semver.valid(current) || !semver.valid(minSupported)) {
      return false
    }
    return semver.lt(current, minSupported)
  }

  private async fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await net.fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          },
        })

        if (response.ok) {
          return response
        }

        if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}`)
        }

        return response
      } catch (error) {
        if (i === retries - 1) {
          throw error
        }
        logger.warn(`Fetch attempt ${i + 1} failed, retrying...`, errorMessage(error))
        await sleep(delay * (i + 1))
      }
    }

    throw new Error('All fetch attempts failed')
  }
}

export const versionManager = new VersionManager()
