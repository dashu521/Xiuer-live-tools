import { net } from 'electron'
import { createLogger } from '../logger'

const logger = createLogger('cdn-manager')

export interface CDNSource {
  id: string
  name: string
  baseUrl: string
  priority: number
  enabled: boolean
  weight: number
}

export interface CDNHealthStatus {
  cdnId: string
  latency: number
  available: boolean
  lastCheck: number
  errorCount: number
  successCount: number
}

export interface CDNConfig {
  sources: CDNSource[]
  autoSwitch: boolean
  healthCheckInterval: number
  timeout: number
}

const DEFAULT_CONFIG: CDNConfig = {
  sources: [
    {
      id: 'official',
      name: '官方源',
      baseUrl: '',
      priority: 1,
      enabled: true,
      weight: 100,
    },
    {
      id: 'cdn-1',
      name: 'CDN 镜像 1',
      baseUrl: 'https://cdn.example.com',
      priority: 2,
      enabled: true,
      weight: 80,
    },
    {
      id: 'cdn-2',
      name: 'CDN 镜像 2',
      baseUrl: 'https://mirror.example.com',
      priority: 3,
      enabled: true,
      weight: 60,
    },
    {
      id: 'gh-proxy',
      name: 'GitHub Proxy',
      baseUrl: 'https://ghproxy.com',
      priority: 4,
      enabled: true,
      weight: 40,
    },
  ],
  autoSwitch: true,
  healthCheckInterval: 60000,
  timeout: 5000,
}

class CDNManager {
  private config: CDNConfig
  private healthStatus: Map<string, CDNHealthStatus> = new Map()
  private currentCDN = 'official'
  private healthCheckTimer: NodeJS.Timeout | null = null

  constructor(config: Partial<CDNConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.initializeHealthStatus()
    this.startHealthCheck()
  }

  private initializeHealthStatus(): void {
    for (const source of this.config.sources) {
      this.healthStatus.set(source.id, {
        cdnId: source.id,
        latency: -1,
        available: true,
        lastCheck: 0,
        errorCount: 0,
        successCount: 0,
      })
    }
  }

  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    this.healthCheckTimer = setInterval(() => {
      this.checkAllCDNHealth()
    }, this.config.healthCheckInterval)
  }

  private async checkAllCDNHealth(): Promise<void> {
    const checkPromises = this.config.sources
      .filter(s => s.enabled)
      .map(source => this.checkCDNHealth(source))

    await Promise.allSettled(checkPromises)

    if (this.config.autoSwitch) {
      this.selectBestCDN()
    }
  }

  private async checkCDNHealth(source: CDNSource): Promise<void> {
    const status = this.healthStatus.get(source.id)
    if (!status) return

    const testUrl = this.buildTestUrl(source.baseUrl)
    const startTime = Date.now()

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      await net.fetch(testUrl, {
        signal: controller.signal,
        method: 'HEAD',
      })

      clearTimeout(timeoutId)

      const latency = Date.now() - startTime

      status.latency = latency
      status.available = true
      status.lastCheck = Date.now()
      status.successCount++

      logger.debug(`CDN ${source.name} health check passed, latency: ${latency}ms`)
    } catch (error) {
      status.available = false
      status.errorCount++
      status.lastCheck = Date.now()

      logger.warn(`CDN ${source.name} health check failed:`, error)
    }
  }

  private buildTestUrl(baseUrl: string): string {
    if (!baseUrl) {
      return 'https://api.github.com'
    }
    return `${baseUrl}/health-check`
  }

  private selectBestCDN(): void {
    const availableCDNs = Array.from(this.healthStatus.values())
      .filter(status => status.available && status.latency > 0)
      .sort((a, b) => a.latency - b.latency)

    if (availableCDNs.length > 0) {
      const previousCDN = this.currentCDN
      this.currentCDN = availableCDNs[0].cdnId

      if (previousCDN !== this.currentCDN) {
        logger.info(`Switched to CDN: ${this.currentCDN}, latency: ${availableCDNs[0].latency}ms`)
      }
    }
  }

  getBestDownloadUrl(path: string): string {
    const source = this.config.sources.find(s => s.id === this.currentCDN)

    if (!source || !source.baseUrl) {
      return path
    }

    if (path.startsWith('http')) {
      return path
    }

    return `${source.baseUrl}${path}`
  }

  async downloadWithCDN(
    url: string,
    onProgress?: (progress: { percent: number; speed: number }) => void,
  ): Promise<{ data: ArrayBuffer; finalUrl: string }> {
    const triedCDNs: string[] = []
    const sources = this.getCDNPriorityList()

    for (const source of sources) {
      triedCDNs.push(source.id)

      const fullUrl = this.buildDownloadUrl(url, source.baseUrl)
      logger.info(`Attempting download from CDN: ${source.name}, url: ${fullUrl}`)

      try {
        const result = await this.downloadFromSource(fullUrl, source.id, onProgress)
        this.recordSuccess(source.id)
        logger.info(`Download successful from CDN: ${source.name}`)
        return result
      } catch (error) {
        logger.warn(`Download failed from CDN ${source.name}:`, error)
        this.recordFailure(source.id)
      }
    }

    throw new Error(`All CDNs failed. Tried: ${triedCDNs.join(', ')}`)
  }

  private getCDNPriorityList(): CDNSource[] {
    return this.config.sources
      .filter(s => s.enabled)
      .sort((a, b) => {
        const statusA = this.healthStatus.get(a.id)
        const statusB = this.healthStatus.get(b.id)

        if (!statusA?.available && statusB?.available) return 1
        if (statusA?.available && !statusB?.available) return -1

        const latencyA = statusA?.latency ?? -1
        const latencyB = statusB?.latency ?? -1

        if (latencyA > 0 && latencyB > 0) {
          return latencyA - latencyB
        }

        return a.priority - b.priority
      })
  }

  private buildDownloadUrl(path: string, baseUrl: string): string {
    if (path.startsWith('http')) {
      return path
    }

    if (!baseUrl) {
      return path
    }

    const cleanPath = path.startsWith('/') ? path : `/${path}`
    return `${baseUrl}${cleanPath}`
  }

  private async downloadFromSource(
    url: string,
    _cdnId: string,
    onProgress?: (progress: { percent: number; speed: number }) => void,
  ): Promise<{ data: ArrayBuffer; finalUrl: string }> {
    const response = await net.fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }

    const contentLength = response.headers.get('content-length')
    const totalBytes = contentLength ? Number.parseInt(contentLength, 10) : 0

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response reader')
    }

    const chunks: Uint8Array[] = []
    let downloadedBytes = 0
    const startTime = Date.now()
    let lastBytes = 0
    let lastTime = startTime

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      chunks.push(value)
      downloadedBytes += value.length

      if (onProgress && totalBytes > 0) {
        const now = Date.now()
        const timeDiff = now - lastTime

        if (timeDiff >= 500) {
          const bytesDiff = downloadedBytes - lastBytes
          const speed = Math.round((bytesDiff / timeDiff) * 1000)
          const percent = (downloadedBytes / totalBytes) * 100

          onProgress({ percent, speed })
          lastBytes = downloadedBytes
          lastTime = now
        }
      }
    }

    const data = Buffer.concat(chunks)

    return {
      data: data.buffer,
      finalUrl: url,
    }
  }

  private recordSuccess(cdnId: string): void {
    const status = this.healthStatus.get(cdnId)
    if (status) {
      status.successCount++
      status.errorCount = Math.max(0, status.errorCount - 1)
    }
  }

  private recordFailure(cdnId: string): void {
    const status = this.healthStatus.get(cdnId)
    if (status) {
      status.errorCount++

      if (status.errorCount >= 3) {
        status.available = false
        logger.warn(`CDN ${cdnId} marked as unavailable due to multiple failures`)
      }
    }
  }

  getHealthStatus(): CDNHealthStatus[] {
    return Array.from(this.healthStatus.values())
  }

  getCurrentCDN(): string {
    return this.currentCDN
  }

  setCDN(cdnId: string): boolean {
    const source = this.config.sources.find(s => s.id === cdnId)
    if (source?.enabled) {
      this.currentCDN = cdnId
      logger.info(`Manual CDN switch to: ${cdnId}`)
      return true
    }
    return false
  }

  updateConfig(config: Partial<CDNConfig>): void {
    this.config = { ...this.config, ...config }

    for (const source of this.config.sources) {
      if (!this.healthStatus.has(source.id)) {
        this.healthStatus.set(source.id, {
          cdnId: source.id,
          latency: -1,
          available: source.enabled,
          lastCheck: 0,
          errorCount: 0,
          successCount: 0,
        })
      }
    }
  }

  addCDNSource(source: CDNSource): void {
    this.config.sources.push(source)
    this.healthStatus.set(source.id, {
      cdnId: source.id,
      latency: -1,
      available: source.enabled,
      lastCheck: 0,
      errorCount: 0,
      successCount: 0,
    })
    logger.info(`Added CDN source: ${source.name}`)
  }

  removeCDNSource(cdnId: string): void {
    const index = this.config.sources.findIndex(s => s.id === cdnId)
    if (index >= 0) {
      this.config.sources.splice(index, 1)
      this.healthStatus.delete(cdnId)
      logger.info(`Removed CDN source: ${cdnId}`)
    }
  }

  getAvailableCDNs(): CDNSource[] {
    return this.config.sources.filter(s => s.enabled)
  }

  forceHealthCheck(): void {
    this.checkAllCDNHealth()
  }

  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }
  }
}

export const cdnManager = new CDNManager()
