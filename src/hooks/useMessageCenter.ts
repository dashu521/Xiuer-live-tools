import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import {
  connectMessageStream,
  getMessages,
  type MessageCenterItem,
  type MessageListResponse,
  markAllMessagesRead,
  markMessageRead,
} from '@/services/apiClient'
import { useAuthCheckDone, useAuthStore } from '@/stores/authStore'
import { useToast } from './useToast'

const STREAM_RETRY_DELAY_MS = 3_000
const STREAM_FALLBACK_POLL_INTERVAL_MS = 15_000
const STREAM_STALE_REFRESH_INTERVAL_MS = 60_000

interface RefreshResult {
  success: boolean
  increased: number
  latestTitle?: string
}

interface MessageCenterState {
  items: MessageCenterItem[]
  unreadCount: number
  fetchedAt: string | null
  isLoading: boolean
  initialized: boolean
  streamConnected: boolean
  applySnapshot: (payload: MessageListResponse) => { increased: number; latestTitle?: string }
  setStreamConnected: (connected: boolean) => void
  refresh: () => Promise<RefreshResult>
  markRead: (id: string) => Promise<boolean>
  markAllRead: () => Promise<boolean>
  reset: () => void
}

const initialState = {
  items: [] as MessageCenterItem[],
  unreadCount: 0,
  fetchedAt: null as string | null,
  isLoading: false,
  initialized: false,
  streamConnected: false,
}

export const useMessageCenterStore = create<MessageCenterState>()((set, get) => ({
  ...initialState,

  applySnapshot: payload => {
    const previousUnread = get().unreadCount
    const nextItems = payload.items ?? []
    const nextUnread = payload.unread_count ?? 0
    set({
      items: nextItems,
      unreadCount: nextUnread,
      fetchedAt: payload.fetched_at,
      initialized: true,
    })

    const latestUnreadTitle = nextItems.find(item => !item.is_read)?.title
    return {
      increased: Math.max(0, nextUnread - previousUnread),
      latestTitle: latestUnreadTitle,
    }
  },

  setStreamConnected: connected => {
    set({ streamConnected: connected })
  },

  refresh: async () => {
    if (get().isLoading) {
      return { success: true, increased: 0 }
    }

    set({ isLoading: true })

    try {
      const result = await getMessages()
      if (!result.ok) {
        return { success: false, increased: 0 }
      }

      const snapshot = get().applySnapshot(result.data)
      return {
        success: true,
        increased: snapshot.increased,
        latestTitle: snapshot.latestTitle,
      }
    } finally {
      set({ isLoading: false })
    }
  },

  markRead: async id => {
    const current = get().items.find(item => item.id === id)
    if (!current || current.is_read) {
      return true
    }

    const result = await markMessageRead(id)
    if (!result.ok) {
      return false
    }

    set(state => ({
      items: state.items.map(item => (item.id === id ? { ...item, is_read: true } : item)),
      unreadCount: result.data.unread_count,
    }))
    return true
  },

  markAllRead: async () => {
    const result = await markAllMessagesRead()
    if (!result.ok) {
      return false
    }

    set(state => ({
      items: state.items.map(item => ({ ...item, is_read: true })),
      unreadCount: result.data.unread_count,
    }))
    return true
  },

  reset: () => set(initialState),
}))

export function useMessageCenterPolling() {
  const { toast } = useToast()
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const userId = useAuthStore(state => state.user?.id ?? null)
  const authCheckDone = useAuthCheckDone()
  const reset = useMessageCenterStore(state => state.reset)
  const applySnapshot = useMessageCenterStore(state => state.applySnapshot)
  const setStreamConnected = useMessageCenterStore(state => state.setStreamConnected)
  const toastReadyRef = useRef(false)
  const streamConnectedRef = useRef(false)
  const lastSnapshotAtRef = useRef(0)

  useEffect(() => {
    if (!authCheckDone) {
      return
    }

    if (!isAuthenticated || !userId) {
      toastReadyRef.current = false
      setStreamConnected(false)
      reset()
      return
    }

    let disposed = false
    let abortController: AbortController | null = null
    let fallbackTimer: number | null = null

    const load = async (reason: 'initial' | 'fallback' | 'stale' | 'reconnect') => {
      const result = await useMessageCenterStore.getState().refresh()
      if (disposed || !result.success) {
        if (!disposed && reason !== 'initial') {
          console.warn('[MessageCenter] Refresh failed:', { reason })
        }
        return
      }

      lastSnapshotAtRef.current = Date.now()
      if (reason !== 'initial') {
        console.info('[MessageCenter] Refresh snapshot applied:', { reason })
      }

      if (toastReadyRef.current && result.increased > 0) {
        toast.info({
          title: '收到新消息',
          description:
            result.increased > 1
              ? `有 ${result.increased} 条新消息，请在消息中心查看。`
              : result.latestTitle || '有 1 条新消息，请在消息中心查看。',
          dedupeKey: `message-center:new:${result.latestTitle ?? 'batch'}`,
        })
      }

      toastReadyRef.current = true
    }

    const run = async () => {
      await load('initial')

      fallbackTimer = window.setInterval(() => {
        if (disposed) {
          return
        }

        const now = Date.now()
        const isStale =
          lastSnapshotAtRef.current > 0 &&
          now - lastSnapshotAtRef.current >= STREAM_STALE_REFRESH_INTERVAL_MS

        if (!streamConnectedRef.current) {
          void load('fallback')
          return
        }

        if (isStale) {
          void load('stale')
        }
      }, STREAM_FALLBACK_POLL_INTERVAL_MS)

      while (!disposed) {
        abortController = new AbortController()
        try {
          await connectMessageStream(event => {
            if (disposed || event.type !== 'snapshot') {
              return
            }

            if (!streamConnectedRef.current) {
              console.info('[MessageCenter] Stream connected')
            }
            streamConnectedRef.current = true
            setStreamConnected(true)
            lastSnapshotAtRef.current = Date.now()
            const result = applySnapshot(event.payload)
            if (toastReadyRef.current && result.increased > 0) {
              toast.info({
                title: '收到新消息',
                description:
                  result.increased > 1
                    ? `有 ${result.increased} 条新消息，请在消息中心查看。`
                    : result.latestTitle || '有 1 条新消息，请在消息中心查看。',
                dedupeKey: `message-center:new:${result.latestTitle ?? 'batch'}`,
              })
            }
            toastReadyRef.current = true
          }, abortController.signal)
        } catch (error) {
          if (disposed || abortController.signal.aborted) {
            break
          }
          console.warn('[MessageCenter] Stream disconnected:', error)
          await load('reconnect')
        } finally {
          streamConnectedRef.current = false
          setStreamConnected(false)
        }

        if (disposed) {
          break
        }

        await new Promise(resolve => {
          window.setTimeout(resolve, STREAM_RETRY_DELAY_MS)
        })
      }
    }

    void run()

    return () => {
      disposed = true
      abortController?.abort()
      if (fallbackTimer) {
        window.clearInterval(fallbackTimer)
      }
      streamConnectedRef.current = false
      setStreamConnected(false)
    }
  }, [applySnapshot, authCheckDone, isAuthenticated, reset, setStreamConnected, toast, userId])
}
