import { Result } from '@praha/byethrow'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { createLogger } from '#/logger'
import { accountManager } from '#/managers/AccountManager'
import { typedIpcMainHandle } from '#/utils'
import windowManager from '#/windowManager'

const TASK_NAME = '监听评论'
const TASK_TYPE = 'comment-listener'

function setupIpcHandlers() {
  typedIpcMainHandle(
    IPC_CHANNELS.tasks.commentListener.start,
    async (_, accountId: string, config: CommentListenerConfig) => {
      return Result.pipe(
        accountManager.getSession(accountId),
        Result.andThen(accountSession =>
          accountSession.startTask({ type: TASK_TYPE, config: config }),
        ),
        Result.inspectError(error => {
          const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(
            TASK_NAME,
          )
          logger.error('启动评论监听失败：', error)
        }),
        r => r.then(Result.isSuccess),
      )
    },
  )

  typedIpcMainHandle(IPC_CHANNELS.tasks.commentListener.stop, async (_, accountId: string) => {
    Result.pipe(
      accountManager.getSession(accountId),
      Result.inspect(accountSession => {
        accountSession.stopTask(TASK_TYPE)
        // 正常停止也要广播 stopped 事件，避免前端 TaskManager /
        // 自动回复 / 数据监控状态残留到下一次开播。
        windowManager.send(IPC_CHANNELS.tasks.commentListener.stoppedFor(accountId), accountId)
        windowManager.send(IPC_CHANNELS.tasks.commentListener.stopped, accountId)
      }),
      Result.inspectError(error => {
        const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
        logger.error('停止监听评论失败：', error)
      }),
    )
  })

  typedIpcMainHandle(IPC_CHANNELS.tasks.autoReply.sendReply, async (_, accountId, message) => {
    return Result.pipe(
      accountManager.getSession(accountId),
      Result.andThen(accountSession =>
        accountSession.startTask({
          type: 'send-batch-messages',
          config: {
            messages: [message],
            count: 1,
            noSpace: true,
          },
        }),
      ),
      Result.inspectError(error => {
        const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
        logger.error('发送回复失败：', error)
      }),
      r => r.then(Result.isSuccess),
    )
  })
}

export function setupCommentListenerIpcHandlers() {
  setupIpcHandlers()
}

/**
 * @deprecated 使用 setupCommentListenerIpcHandlers
 */
export const setupAutoReplyIpcHandlers = setupCommentListenerIpcHandlers
