import type { IpcInvoke } from 'shared/electron-api'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type CommentListenerConsumer = 'autoReply' | 'liveStats'
export type CommentListenerStatus = 'idle' | 'starting' | 'listening' | 'error'

interface CommentListenerContext {
  status: CommentListenerStatus
  consumers: Record<CommentListenerConsumer, boolean>
}

interface CommentListenerRuntimeState {
  contexts: Record<string, CommentListenerContext>
}

interface CommentListenerRuntimeActions {
  setStatus: (accountId: string, status: CommentListenerStatus) => void
  setConsumerActive: (accountId: string, consumer: CommentListenerConsumer, active: boolean) => void
  clearConsumers: (accountId: string) => void
}

const createDefaultContext = (): CommentListenerContext => ({
  status: 'idle',
  consumers: {
    autoReply: false,
    liveStats: false,
  },
})

function ensureContext(
  contexts: Record<string, CommentListenerContext>,
  accountId: string,
): CommentListenerContext {
  if (!contexts[accountId]) {
    contexts[accountId] = createDefaultContext()
  }
  return contexts[accountId]
}

export const useCommentListenerRuntimeStore = create<
  CommentListenerRuntimeState & CommentListenerRuntimeActions
>()(
  immer(set => ({
    contexts: {},
    setStatus: (accountId, status) =>
      set(state => {
        const context = ensureContext(state.contexts, accountId)
        context.status = status
      }),
    setConsumerActive: (accountId, consumer, active) =>
      set(state => {
        const context = ensureContext(state.contexts, accountId)
        context.consumers[consumer] = active
      }),
    clearConsumers: accountId =>
      set(state => {
        const context = ensureContext(state.contexts, accountId)
        context.consumers.autoReply = false
        context.consumers.liveStats = false
      }),
  })),
)

const startPromises = new Map<string, Promise<boolean>>()

function hasAnyActiveConsumer(accountId: string): boolean {
  const context = useCommentListenerRuntimeStore.getState().contexts[accountId]
  return Boolean(context?.consumers.autoReply || context?.consumers.liveStats)
}

export async function acquireCommentListener(
  accountId: string,
  consumer: CommentListenerConsumer,
  config: CommentListenerConfig,
  ipcInvoke: IpcInvoke,
): Promise<boolean> {
  const store = useCommentListenerRuntimeStore.getState()
  const context = store.contexts[accountId]

  store.setConsumerActive(accountId, consumer, true)

  if (context?.status === 'listening') {
    return true
  }

  const pending = startPromises.get(accountId)
  if (pending) {
    const ok = await pending
    if (!ok) {
      useCommentListenerRuntimeStore.getState().setConsumerActive(accountId, consumer, false)
    }
    return ok
  }

  store.setStatus(accountId, 'starting')

  const startPromise = ipcInvoke(IPC_CHANNELS.tasks.commentListener.start, accountId, config)
    .then((ok: boolean) => {
      const runtimeStore = useCommentListenerRuntimeStore.getState()
      runtimeStore.setStatus(accountId, ok ? 'listening' : 'error')
      if (!ok) {
        runtimeStore.clearConsumers(accountId)
      }
      return ok
    })
    .catch((error: unknown) => {
      const runtimeStore = useCommentListenerRuntimeStore.getState()
      runtimeStore.setStatus(accountId, 'error')
      runtimeStore.clearConsumers(accountId)
      throw error
    })
    .finally(() => {
      startPromises.delete(accountId)
    })

  startPromises.set(accountId, startPromise)
  return startPromise
}

export async function releaseCommentListener(
  accountId: string,
  consumer: CommentListenerConsumer,
  ipcInvoke: IpcInvoke,
): Promise<void> {
  const store = useCommentListenerRuntimeStore.getState()
  store.setConsumerActive(accountId, consumer, false)

  if (hasAnyActiveConsumer(accountId)) {
    return
  }

  const context = store.contexts[accountId]
  if (!context || context.status === 'idle') {
    return
  }

  await ipcInvoke(IPC_CHANNELS.tasks.commentListener.stop, accountId)
  store.setStatus(accountId, 'idle')
}

export function markCommentListenerStopped(accountId: string): void {
  const store = useCommentListenerRuntimeStore.getState()
  store.setStatus(accountId, 'idle')
  store.clearConsumers(accountId)
}
