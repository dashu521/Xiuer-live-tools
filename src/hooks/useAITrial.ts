import type { providers } from 'shared/providers'
import { create } from 'zustand'
import { createAITrialSession, getAITrialStatus, reportAITrialUse } from '@/services/apiClient'
import type { AIProvider } from './useAIChat'

export interface AITrialSessionState {
  token: string
  expiresAt: number
  provider: AIProvider
  baseURL: string
  apiKey: string
  models: {
    chat: string
    auto_reply: string
    knowledge_draft: string
  }
  autoSendDefault: boolean
}

interface AITrialStore {
  enabled: boolean
  loading: boolean
  session: AITrialSessionState | null
  ensureSession: (
    feature: 'chat' | 'auto_reply' | 'knowledge_draft',
  ) => Promise<AITrialSessionState | null>
  refreshStatus: () => Promise<void>
  clearSession: () => void
  reportUse: (params: {
    feature: 'chat' | 'auto_reply' | 'knowledge_draft'
    model?: string
  }) => Promise<void>
}

function getDeviceId() {
  const key = 'ai_trial_device_id'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const next = crypto.randomUUID()
  localStorage.setItem(key, next)
  return next
}

export const useAITrialStore = create<AITrialStore>((set, get) => ({
  enabled: false,
  loading: false,
  session: null,
  refreshStatus: async () => {
    const result = await getAITrialStatus()
    if (result.ok) {
      set(state => ({
        ...state,
        enabled: result.data.trial_enabled,
      }))
    }
  },
  ensureSession: async feature => {
    const current = get().session
    if (current && current.expiresAt > Date.now() + 60_000) {
      return current
    }

    set({ loading: true })
    try {
      const result = await createAITrialSession({
        deviceId: getDeviceId(),
        clientVersion: 'desktop',
        features: [feature],
      })
      if (!result.ok) {
        set({ enabled: false, session: null })
        return null
      }

      const session: AITrialSessionState = {
        token: result.data.token,
        expiresAt: Date.now() + result.data.expires_in * 1000,
        provider: result.data.credential.provider as AIProvider,
        baseURL: result.data.credential.base_url,
        apiKey: result.data.credential.api_key,
        models: result.data.models,
        autoSendDefault: result.data.auto_send_default,
      }
      set({
        enabled: true,
        session,
      })
      return session
    } finally {
      set({ loading: false })
    }
  },
  clearSession: () => set({ session: null }),
  reportUse: async ({ feature, model }) => {
    await reportAITrialUse({
      feature,
      model,
      deviceId: getDeviceId(),
      clientVersion: 'desktop',
    })
  },
}))

export function getEffectiveAICredentials(params: {
  feature: 'chat' | 'auto_reply' | 'knowledge_draft'
  userProvider: keyof typeof providers | 'custom'
  userModel: string
  userApiKey?: string
  userCustomBaseURL?: string
}) {
  const { feature, userProvider, userModel, userApiKey, userCustomBaseURL } = params
  if (userApiKey?.trim()) {
    return {
      credentialMode: 'user-key' as const,
      provider: userProvider,
      model: userModel,
      apiKey: userApiKey,
      customBaseURL: userCustomBaseURL ?? '',
    }
  }

  const session = useAITrialStore.getState().session
  if (!session || session.expiresAt <= Date.now()) {
    return null
  }

  return {
    credentialMode: 'trial' as const,
    provider: session.provider,
    model: session.models[feature],
    apiKey: session.apiKey,
    customBaseURL: session.baseURL,
  }
}
