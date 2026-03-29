import { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { createLogger } from '../logger'

const logger = createLogger('update-error-handler')

export enum UpdateErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  CHECKSUM_MISMATCH = 'CHECKSUM_MISMATCH',
  SIGNATURE_INVALID = 'SIGNATURE_INVALID',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  APPLY_FAILED = 'APPLY_FAILED',
  BACKUP_FAILED = 'BACKUP_FAILED',
  ROLLBACK_FAILED = 'ROLLBACK_FAILED',
  SPACE_INSUFFICIENT = 'SPACE_INSUFFICIENT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface UpdateError {
  code: UpdateErrorCode
  message: string
  details?: any
  recoverable: boolean
  canRollback: boolean
}

export interface ErrorHandlingResult {
  handled: boolean
  recovered: boolean
  action: 'retry' | 'rollback' | 'notify' | 'abort'
  message?: string
}

interface RecoveryStrategy {
  maxRetries: number
  backoffMs?: number
  strategy: 'retry' | 'retry_with_backoff' | 'redownload' | 'resume_or_retry'
}

const RECOVERY_STRATEGIES: Record<UpdateErrorCode, RecoveryStrategy> = {
  [UpdateErrorCode.NETWORK_ERROR]: {
    maxRetries: 3,
    backoffMs: 2000,
    strategy: 'retry_with_backoff',
  },
  [UpdateErrorCode.CHECKSUM_MISMATCH]: {
    maxRetries: 2,
    strategy: 'redownload',
  },
  [UpdateErrorCode.SIGNATURE_INVALID]: {
    maxRetries: 0,
    strategy: 'retry',
  },
  [UpdateErrorCode.DOWNLOAD_FAILED]: {
    maxRetries: 3,
    backoffMs: 1000,
    strategy: 'resume_or_retry',
  },
  [UpdateErrorCode.VERIFICATION_FAILED]: {
    maxRetries: 2,
    strategy: 'redownload',
  },
  [UpdateErrorCode.APPLY_FAILED]: {
    maxRetries: 1,
    strategy: 'retry',
  },
  [UpdateErrorCode.BACKUP_FAILED]: {
    maxRetries: 2,
    strategy: 'retry',
  },
  [UpdateErrorCode.ROLLBACK_FAILED]: {
    maxRetries: 0,
    strategy: 'retry',
  },
  [UpdateErrorCode.SPACE_INSUFFICIENT]: {
    maxRetries: 0,
    strategy: 'retry',
  },
  [UpdateErrorCode.UNKNOWN_ERROR]: {
    maxRetries: 1,
    strategy: 'retry',
  },
}

class UpdateErrorHandler {
  private errorCounts: Map<string, number> = new Map()
  private retryDelays: Map<string, number> = new Map()

  async handleError(error: UpdateError): Promise<ErrorHandlingResult> {
    const errorKey = `${error.code}-${error.message.substring(0, 50)}`
    const retryCount = this.errorCounts.get(errorKey) || 0

    logger.error(`Handling update error: ${error.code}`, {
      message: error.message,
      recoverable: error.recoverable,
      retryCount,
    })

    const strategy =
      RECOVERY_STRATEGIES[error.code] || RECOVERY_STRATEGIES[UpdateErrorCode.UNKNOWN_ERROR]

    if (retryCount >= strategy.maxRetries) {
      logger.error(`Max retries reached for error: ${error.code}`)

      if (error.canRollback) {
        return {
          handled: true,
          recovered: false,
          action: 'rollback',
          message: '更新失败，已回滚到之前版本',
        }
      }

      this.notifyUser(error)
      return {
        handled: true,
        recovered: false,
        action: 'notify',
        message: error.message,
      }
    }

    this.errorCounts.set(errorKey, retryCount + 1)

    const shouldRetry = error.recoverable && retryCount < strategy.maxRetries

    if (shouldRetry) {
      if (strategy.backoffMs) {
        const delay = strategy.backoffMs * (retryCount + 1)
        this.retryDelays.set(errorKey, delay)
        logger.info(`Retrying after ${delay}ms...`)
        await this.sleep(delay)
      }

      return {
        handled: true,
        recovered: false,
        action: 'retry',
        message: `正在重试 (${retryCount + 1}/${strategy.maxRetries})`,
      }
    }

    this.notifyUser(error)

    return {
      handled: true,
      recovered: false,
      action: error.canRollback ? 'rollback' : 'notify',
      message: error.message,
    }
  }

  async attemptRecovery(error: UpdateError): Promise<boolean> {
    logger.info(`Attempting recovery for error: ${error.code}`)

    try {
      switch (error.code) {
        case UpdateErrorCode.NETWORK_ERROR:
        case UpdateErrorCode.DOWNLOAD_FAILED:
          return true

        case UpdateErrorCode.CHECKSUM_MISMATCH:
        case UpdateErrorCode.VERIFICATION_FAILED:
          return true

        case UpdateErrorCode.ROLLBACK_FAILED:
        case UpdateErrorCode.SPACE_INSUFFICIENT:
          return false

        default:
          return error.recoverable
      }
    } catch (err) {
      logger.error('Recovery attempt failed:', err)
      return false
    }
  }

  async notifyUser(error: UpdateError): Promise<void> {
    const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]

    // 严格检查窗口状态，防止 "Object has been destroyed" 错误
    if (
      mainWindow &&
      !mainWindow.isDestroyed() &&
      mainWindow.webContents &&
      !mainWindow.webContents.isDestroyed()
    ) {
      try {
        mainWindow.webContents.send(IPC_CHANNELS.updater.updateError, {
          code: error.code,
          message: error.message,
          details: error.details,
          recoverable: error.recoverable,
        })
      } catch (err) {
        // 捕获窗口已销毁的错误
        if (err instanceof Error && err.message.includes('destroyed')) {
          console.warn('[UpdateErrorHandler] 窗口已销毁，无法发送错误通知')
        } else {
          console.error('[UpdateErrorHandler] 发送错误通知失败:', err)
        }
      }
    }

    logger.error('User notified of update error:', error.code, error.message)
  }

  async logError(error: UpdateError): Promise<void> {
    logger.error('=== Update Error Log ===', {
      code: error.code,
      message: error.message,
      details: error.details,
      recoverable: error.recoverable,
      canRollback: error.canRollback,
      timestamp: new Date().toISOString(),
    })
  }

  async collectDiagnosticInfo(): Promise<Record<string, any>> {
    const { app } = await import('electron')

    return {
      appVersion: app.getVersion(),
      appPath: app.getAppPath(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      errorCounts: Object.fromEntries(this.errorCounts),
      timestamp: new Date().toISOString(),
    }
  }

  resetErrorCount(errorKey?: string): void {
    if (errorKey) {
      this.errorCounts.delete(errorKey)
      this.retryDelays.delete(errorKey)
    } else {
      this.errorCounts.clear()
      this.retryDelays.clear()
    }
  }

  getErrorCount(errorKey: string): number {
    return this.errorCounts.get(errorKey) || 0
  }

  createError(
    code: UpdateErrorCode,
    message: string,
    options?: {
      details?: any
      recoverable?: boolean
      canRollback?: boolean
    },
  ): UpdateError {
    return {
      code,
      message,
      details: options?.details,
      recoverable: options?.recoverable ?? true,
      canRollback: options?.canRollback ?? false,
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const updateErrorHandler = new UpdateErrorHandler()
