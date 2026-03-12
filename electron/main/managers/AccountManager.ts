import { Result } from '@praha/byethrow'
import { ErrorFactory } from '@praha/error-factory'
import { emitter } from '#/event/eventBus'
import { createLogger } from '#/logger'
import { AccountSession } from '#/services/AccountSession'

class AccountNotFoundError extends ErrorFactory({
  name: 'AccountNotFoundError',
  message: '账号不存在，请先连接中控台',
}) {}

export class AccountManager {
  accountSessions: Map<string, AccountSession> = new Map()
  accountNames: Map<string, string> = new Map()
  private logger = createLogger('账号管理')
  // 保存事件处理函数引用，用于清理
  private pageClosedHandler: (payload: { accountId: string; reason?: string }) => void

  constructor() {
    this.pageClosedHandler = ({ accountId, reason }) => {
      this.logger.info(`[page-closed] 收到页面关闭事件，账号: ${accountId}, 原因: ${reason || '未知'}`)
      // 浏览器被关闭时，需要关闭浏览器
      this.closeSession(accountId, reason, { closeBrowser: true })
    }
    emitter.on('page-closed', this.pageClosedHandler)
  }

  createSession(platformName: LiveControlPlatform, account: Account) {
    this.setAccountName(account.id, account.name)
    const existSession = this.accountSessions.get(account.id)
    if (existSession) {
      this.logger.warn('检测到已存在建立的连接，将关闭已建立的连接')
      existSession.disconnect('重新连接', { closeBrowser: false })
    }

    const accountSession = new AccountSession(platformName, account)
    this.accountSessions.set(account.id, accountSession)
    return accountSession
  }

  getSession(accountId: string): Result.Result<AccountSession, Error> {
    const accountSession = this.accountSessions.get(accountId)
    if (!accountSession) {
      return Result.fail(new AccountNotFoundError())
    }
    return Result.succeed(accountSession)
  }

  setAccountName(accountId: string, accountName: string) {
    this.accountNames.set(accountId, accountName)
  }

  getAccountName(accountId: string) {
    return this.accountNames.get(accountId) ?? '未定义账号'
  }

  closeSession(accountId: string, reason?: string, options?: { closeBrowser?: boolean }) {
    const accountSession = this.accountSessions.get(accountId)
    if (!accountSession) {
      this.logger.info(`[closeSession] 账号 ${accountId} 不存在，无需关闭`)
      return
    }

    this.logger.info(`[closeSession] 正在关闭账号 ${accountId} 的会话，原因: ${reason || '未知'}，关闭浏览器: ${options?.closeBrowser ?? '默认'}`)
    // 【修复】断开连接时默认不关闭浏览器，只有明确要求关闭时才关闭
    accountSession.disconnect(reason, { closeBrowser: options?.closeBrowser ?? false })
    this.accountSessions.delete(accountId)
    this.logger.info(`[closeSession] 账号 ${accountId} 会话已关闭并从管理器中移除`)
  }

  cleanup() {
    // 移除事件监听器，避免内存泄漏
    emitter.off('page-closed', this.pageClosedHandler)
    // 断开所有会话并关闭浏览器（应用退出时）
    this.accountSessions.values().forEach(session => {
      session.disconnect('应用退出', { closeBrowser: true })
    })
    this.accountSessions.clear()
    this.accountNames.clear()
  }
}

export const accountManager = new AccountManager()
