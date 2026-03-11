import { createHash } from 'node:crypto'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  statSync,
  unlinkSync,
} from 'node:fs'
import * as path from 'node:path'
import { net } from 'electron'
import { createLogger } from '../logger'
import { errorMessage } from '../utils'

const logger = createLogger('download-manager')

export interface DownloadTask {
  id: string
  url: string
  destination: string
  totalBytes: number
  downloadedBytes: number
  expectedHash: string
  hashAlgorithm: 'sha256' | 'sha512'
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled'
  speed: number
  progress: number
  actualHash?: string
  error?: string
}

export interface DownloadProgress {
  taskId: string
  percent: number
  transferred: number
  total: number
  speed: number
  eta: number
}

export interface DownloadOptions {
  resumeSupport: boolean
  verifyIntegrity: boolean
  maxRetries: number
  timeout: number
}

const DEFAULT_OPTIONS: DownloadOptions = {
  resumeSupport: true,
  verifyIntegrity: true,
  maxRetries: 3,
  timeout: 30000,
}

class DownloadManager {
  private tasks: Map<string, DownloadTask> = new Map()
  private options: DownloadOptions
  private progressCallbacks: Map<string, (progress: DownloadProgress) => void> = new Map()

  constructor(options: Partial<DownloadOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  async download(
    url: string,
    destination: string,
    expectedHash: string,
    options?: Partial<DownloadOptions>,
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<string> {
    const mergedOptions = { ...this.options, ...options }
    const taskId = this.generateTaskId(url)

    const task: DownloadTask = {
      id: taskId,
      url,
      destination,
      totalBytes: 0,
      downloadedBytes: 0,
      expectedHash,
      hashAlgorithm: 'sha256',
      status: 'pending',
      speed: 0,
      progress: 0,
    }

    this.tasks.set(taskId, task)

    if (onProgress) {
      this.progressCallbacks.set(taskId, onProgress)
    }

    try {
      return await this.executeDownload(task, mergedOptions)
    } finally {
      this.tasks.delete(taskId)
      this.progressCallbacks.delete(taskId)
    }
  }

  private async executeDownload(task: DownloadTask, options: DownloadOptions): Promise<string> {
    let retries = 0

    while (retries <= options.maxRetries) {
      try {
        if (task.status === 'cancelled') {
          throw new Error('Download cancelled')
        }

        task.status = 'downloading'
        logger.info(`Starting download: ${task.url}`)

        const downloadedPath = await this.downloadWithProgress(task, options)

        if (options.verifyIntegrity) {
          logger.info('Verifying file integrity...')
          const isValid = await this.verifyFile(downloadedPath, task.expectedHash)

          if (!isValid) {
            if (retries < options.maxRetries) {
              retries++
              logger.warn(`Integrity check failed, retry ${retries}/${options.maxRetries}`)
              if (existsSync(downloadedPath)) {
                unlinkSync(downloadedPath)
              }
              continue
            }
            throw new Error('File integrity verification failed after all retries')
          }
          logger.info('File integrity verified successfully')
        }

        task.status = 'completed'
        task.progress = 100
        return downloadedPath
      } catch (error) {
        if (task.status === 'cancelled') {
          throw new Error('Download cancelled')
        }

        task.status = 'failed'
        task.error = errorMessage(error)

        if (retries < options.maxRetries) {
          retries++
          logger.warn(
            `Download failed, retry ${retries}/${options.maxRetries}:`,
            errorMessage(error),
          )
          await this.sleep(1000 * retries)
        } else {
          throw error
        }
      }
    }

    throw new Error('Download failed after all retries')
  }

  private async downloadWithProgress(
    task: DownloadTask,
    options: DownloadOptions,
  ): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options.timeout)

    let startByte = 0

    if (options.resumeSupport && existsSync(task.destination)) {
      const stats = statSync(task.destination)
      if (stats.isFile()) {
        startByte = stats.size
        task.downloadedBytes = startByte
        logger.info(`Resuming download from byte ${startByte}`)
      }
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    }

    if (startByte > 0) {
      headers.Range = `bytes=${startByte}-`
    }

    const response = await net.fetch(task.url, {
      signal: controller.signal,
      headers,
    })

    if (!response.ok && response.status !== 206) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`)
    }

    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      task.totalBytes = startByte + Number.parseInt(contentLength, 10)
    }

    const hash = createHash(task.hashAlgorithm)
    const reader = response.body?.getReader()

    if (!reader) {
      throw new Error('Failed to get response body reader')
    }

    const dir = path.dirname(task.destination)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    if (startByte > 0 && existsSync(task.destination)) {
    } else {
      const fs = await import('node:fs')
      fs.writeFileSync(task.destination, Buffer.alloc(0))
    }

    const fileWriter = createWriteStream(task.destination, { flags: 'a' })
    const startTime = Date.now()
    let lastBytes = task.downloadedBytes
    let lastTime = startTime

    try {
      while (true) {
        if (task.status === 'cancelled') {
          reader.cancel()
          break
        }

        const { done, value } = await reader.read()

        if (done) {
          break
        }

        hash.update(value)
        fileWriter.write(value)

        task.downloadedBytes += value.length
        const now = Date.now()
        const timeDiff = now - lastTime

        if (timeDiff >= 500) {
          const bytesDiff = task.downloadedBytes - lastBytes
          task.speed = Math.round((bytesDiff / timeDiff) * 1000)
          lastBytes = task.downloadedBytes
          lastTime = now
        }

        if (task.totalBytes > 0) {
          task.progress = (task.downloadedBytes / task.totalBytes) * 100

          const progress: DownloadProgress = {
            taskId: task.id,
            percent: task.progress,
            transferred: task.downloadedBytes,
            total: task.totalBytes,
            speed: task.speed,
            eta:
              task.speed > 0 ? Math.ceil((task.totalBytes - task.downloadedBytes) / task.speed) : 0,
          }

          const callback = this.progressCallbacks.get(task.id)
          if (callback) {
            callback(progress)
          }
        }
      }
    } finally {
      clearTimeout(timeoutId)
      fileWriter.end()
      reader.cancel()
    }

    task.actualHash = hash.digest('hex')
    return task.destination
  }

  async pause(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (task && task.status === 'downloading') {
      task.status = 'paused'
      logger.info(`Download paused: ${taskId}`)
    }
  }

  async resume(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (task && task.status === 'paused') {
      task.status = 'pending'
      logger.info(`Download resumed: ${taskId}`)
    }
  }

  async cancel(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (task) {
      task.status = 'cancelled'
      logger.info(`Download cancelled: ${taskId}`)
    }
  }

  async verifyFile(filePath: string, expectedHash: string): Promise<boolean> {
    const actualHash = await this.computeHash(filePath, 'sha256')
    const isValid = actualHash === expectedHash

    if (!isValid) {
      logger.error(`Hash mismatch: expected ${expectedHash}, got ${actualHash}`)
    }

    return isValid
  }

  async computeHash(filePath: string, algorithm: 'sha256' | 'sha512' = 'sha256'): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash(algorithm)
      const stream = createReadStream(filePath)

      stream.on('data', chunk => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  getTask(taskId: string): DownloadTask | undefined {
    return this.tasks.get(taskId)
  }

  getAllTasks(): DownloadTask[] {
    return Array.from(this.tasks.values())
  }

  private generateTaskId(_url: string): string {
    return `dl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const downloadManager = new DownloadManager()
