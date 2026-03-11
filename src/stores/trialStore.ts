/**
 * 试用 3 天（本地持久化 + 服务端时间验证）
 * 方案三变体：使用服务端时间戳防止时间篡改
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const TRIAL_DAYS = 3
const CACHE_VALID_DURATION = 60 * 60 * 1000 // 1小时

interface TrialState {
  trialStartedAt: number | null
  trialEndsAt: number | null
  trialActivated: boolean
  lastVerifiedAt: number | null // 上次服务端验证时间
  serverSynced: boolean // 是否已与服务器同步
}

interface TrialStore extends TrialState {
  startTrial: (serverTime?: number) => void
  isInTrial: (serverTime?: number) => boolean | null // null 表示需要重新验证
  isTrialExpired: (serverTime?: number) => boolean
  syncFromServer: (trialData: {
    trialStartedAt: number
    trialEndsAt: number
    serverTime: number
  }) => void
  needsRevalidation: () => boolean
  getTrialInfo: () => TrialState
  /** 清空试用状态（切换账号/登出时调用，避免 B 账号沿用 A 账号的试用缓存） */
  reset: () => void
}

export const useTrialStore = create<TrialStore>()(
  persist(
    (set, get) => ({
      trialStartedAt: null,
      trialEndsAt: null,
      trialActivated: false,
      lastVerifiedAt: null,
      serverSynced: false,

      startTrial: (serverTime?: number) => {
        const now = serverTime ?? Date.now()
        const endsAt = now + TRIAL_DAYS * 24 * 60 * 60 * 1000
        set({
          trialStartedAt: now,
          trialEndsAt: endsAt,
          trialActivated: true,
          lastVerifiedAt: Date.now(),
          serverSynced: !!serverTime,
        })
      },

      isInTrial: (serverTime?: number) => {
        const { trialActivated, trialEndsAt, lastVerifiedAt } = get()

        // 未激活试用
        if (!trialActivated || !trialEndsAt) return false

        // 使用服务端时间（如果提供）
        const currentTime = serverTime ?? Date.now()

        // 试用已过期
        if (currentTime >= trialEndsAt) return false

        // 如果没有服务端时间，检查缓存是否过期
        if (!serverTime && lastVerifiedAt) {
          const cacheAge = Date.now() - lastVerifiedAt
          if (cacheAge > CACHE_VALID_DURATION) {
            return null // 需要重新验证
          }
        }

        return true
      },

      isTrialExpired: (serverTime?: number) => {
        const { trialActivated, trialEndsAt } = get()
        if (!trialActivated || !trialEndsAt) return false
        const currentTime = serverTime ?? Date.now()
        return currentTime >= trialEndsAt
      },

      syncFromServer: (trialData: {
        trialStartedAt: number
        trialEndsAt: number
        serverTime: number
      }) => {
        set({
          trialStartedAt: trialData.trialStartedAt,
          trialEndsAt: trialData.trialEndsAt,
          trialActivated: true,
          lastVerifiedAt: Date.now(),
          serverSynced: true,
        })
      },

      needsRevalidation: () => {
        const { lastVerifiedAt, trialActivated } = get()
        if (!trialActivated) return false
        if (!lastVerifiedAt) return true
        const cacheAge = Date.now() - lastVerifiedAt
        return cacheAge > CACHE_VALID_DURATION
      },

      getTrialInfo: () => {
        return get()
      },

      reset: () => {
        set({
          trialStartedAt: null,
          trialEndsAt: null,
          trialActivated: false,
          lastVerifiedAt: null,
          serverSynced: false,
        })
      },
    }),
    {
      name: 'trial-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        trialStartedAt: state.trialStartedAt,
        trialEndsAt: state.trialEndsAt,
        trialActivated: state.trialActivated,
        lastVerifiedAt: state.lastVerifiedAt,
        serverSynced: state.serverSynced,
      }),
    },
  ),
)
