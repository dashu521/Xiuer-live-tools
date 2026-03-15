import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoReplyStore } from '@/hooks/useAutoReply'
import { useLiveStatsStore } from '@/hooks/useLiveStats'
import { useCommentListenerRuntimeStore } from '@/utils/commentListenerRuntime'
import { AutoReplyTask } from '../autoReplyTask'
import type { TaskContext } from '../types'

const accountId = 'account-a'

const createContext = (ipcInvoke: TaskContext['ipcInvoke']): TaskContext => ({
  accountId,
  gateState: {
    connectionState: 'connected',
    streamState: 'live',
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  ipcInvoke,
})

describe('AutoReplyTask', () => {
  beforeEach(() => {
    ;(
      globalThis as typeof globalThis & {
        window?: {
          ipcRenderer?: {
            on: () => () => void
          }
        }
      }
    ).window = {
      ipcRenderer: {
        on: () => () => {},
      },
    }
    useAutoReplyStore.setState({ contexts: {} })
    useLiveStatsStore.setState({ contexts: {} })
    useCommentListenerRuntimeStore.setState({ contexts: {} })
  })

  it('数据监控正在监听时，启动自动回复仍应走真实的评论监听启动', async () => {
    const ipcInvoke = vi.fn().mockResolvedValue(true)
    const task = new AutoReplyTask()

    useLiveStatsStore.getState().setListening(accountId, true)

    await task.start(createContext(ipcInvoke))

    expect(ipcInvoke).toHaveBeenCalledTimes(1)
    expect(useAutoReplyStore.getState().contexts[accountId]?.isListening).toBe('listening')
    expect(useAutoReplyStore.getState().contexts[accountId]?.isRunning).toBe(true)
    expect(useLiveStatsStore.getState().contexts[accountId]?.isListening).toBe(true)
  })

  it('启动自动回复本身不应主动拉起数据监控状态', async () => {
    const ipcInvoke = vi.fn().mockResolvedValue(true)
    const task = new AutoReplyTask()

    await task.start(createContext(ipcInvoke))

    expect(ipcInvoke).toHaveBeenCalledTimes(1)
    expect(useAutoReplyStore.getState().contexts[accountId]?.isListening).toBe('listening')
    expect(useAutoReplyStore.getState().contexts[accountId]?.isRunning).toBe(true)
    expect(useLiveStatsStore.getState().contexts[accountId]?.isListening ?? false).toBe(false)
  })
})
