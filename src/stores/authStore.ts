import { IPC_CHANNELS } from 'shared/ipcChannels'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  AUTH_LAST_IDENTIFIER_KEY,
  AUTH_REMEMBER_ME_KEY,
  AUTH_ZUSTAND_PERSIST_KEY,
} from '@/constants/authStorageKeys'
import { getEffectivePlan, normalizePlan } from '@/constants/subscription'
import { useAccounts } from '../hooks/useAccounts'
import { useAutoMessageStore } from '../hooks/useAutoMessage'
import { useAutoPopUpStore } from '../hooks/useAutoPopUp'
import { useAutoReplyConfigStore } from '../hooks/useAutoReplyConfig'
import { useChromeConfigStore } from '../hooks/useChromeConfig'
import { useLiveControlStore } from '../hooks/useLiveControl'
import { useSubAccountStore } from '../hooks/useSubAccount'
import type { LoginResponseBackend } from '../services/apiClient'
import { getMe, getTrialStatus, getUserStatus, startTrial } from '../services/apiClient'
import type {
  AuthResponse,
  AuthState,
  LoginCredentials,
  RegisterData,
  SafeUser,
  UserStatus,
} from '../types/auth'
import { mapAuthError } from '../utils/mapAuthError'
import { usePlatformPreferenceStore } from './platformPreferenceStore'
import { useTrialStore } from './trialStore'

type LoginResponseExtended = AuthResponse & {
  data?: LoginCredentials
  status?: number
  requestUrl?: string
  detail?: string
}
type RegisterResponseExtended = AuthResponse & {
  data?: RegisterData
  status?: number
  requestUrl?: string
  detail?: string
}

/** 从 /me 返回的 username（即 sub）构建前端展示用 SafeUser */
function safeUserFromUsername(username: string): SafeUser {
  return {
    id: username,
    username,
    email: '',
    createdAt: new Date().toISOString(),
    lastLogin: null,
    status: 'active',
    // @deprecated 使用 plan
    // 统一使用 plan 字段
    plan: 'free',
    // @deprecated 使用 expire_at
    expire_at: null,
    deviceId: '',
    machineFingerprint: '',
    balance: 0,
  }
}

/** 将后端 /login 返回的 user 转为 SafeUser */
function _backendUserToSafeUser(
  backendUser: LoginResponseBackend['user'] | undefined,
  fallbackUsername: string,
): SafeUser {
  if (!backendUser) return safeUserFromUsername(fallbackUsername)
  const username =
    (backendUser.phone ?? backendUser.email ?? backendUser.id ?? fallbackUsername) ||
    fallbackUsername

  // 从后端获取 plan，兼容处理
  const plan = normalizePlan(backendUser.plan) || 'free'

  return {
    id: String(backendUser.id),
    username,
    email: backendUser.email ?? '',
    createdAt:
      typeof backendUser.created_at === 'string'
        ? backendUser.created_at
        : backendUser.created_at != null
          ? new Date(backendUser.created_at).toISOString()
          : new Date().toISOString(),
    lastLogin:
      backendUser.last_login_at == null
        ? null
        : typeof backendUser.last_login_at === 'string'
          ? backendUser.last_login_at
          : new Date(backendUser.last_login_at).toISOString(),
    status: (backendUser.status as SafeUser['status']) ?? 'active',
    // @deprecated 使用 plan
    // 统一使用 plan 字段
    plan,
    // @deprecated 使用 expire_at
    expire_at: backendUser.expire_at ?? null,
    deviceId: '',
    machineFingerprint: '',
    balance: 0,
  }
}

interface AuthStore extends AuthState {
  /** 仅用于 refresh 流程，与 token（access）一起持久化 */
  refreshToken: string | null
  /** 启动时鉴权是否已完成（用于区分 loading / 登录页 / 主界面） */
  authCheckDone: boolean
  /** 有 token 但 /me 非 401 失败（断网/5xx）：保持已登录，仅提示离线 */
  isOffline: boolean
  /** GET /auth/status 返回的用户状态（只读感知，不做限制） */
  userStatus: UserStatus | null
  // Actions
  login: (
    credentials: LoginCredentials,
  ) => Promise<{ success: boolean; error?: string; rawError?: string; showRegisterHint?: boolean }>
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  /** 启动时调用：无 token→未登录；有 token→GET /me，200→已登录，401→尝试 refresh 后恢复或回登录页，其他→已登录但离线 */
  checkAuth: () => Promise<void>
  setUser: (user: SafeUser | null) => void
  setToken: (token: string | null) => void
  setRefreshToken: (refreshToken: string | null) => void
  /** refresh 失败时由 apiClient 调用：清空 token/refreshToken，回到登录页 */
  clearTokensAndUnauth: () => void
  setUserStatus: (userStatus: UserStatus | null) => void
  /** 拉取 /auth/status 并写入 store，同时同步更新 user.plan */
  refreshUserStatus: () => Promise<UserStatus | null>
  /** 调用 POST /auth/trial/start，成功则写入 userStatus；失败不改登录态，返回 errorCode（如 trial_already_used）供弹窗提示 */
  startTrialAndRefresh: () => Promise<
    { success: true; status: UserStatus } | { success: false; errorCode?: string; message?: string }
  >
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      user: null,
      token: null,
      refreshToken: null,
      isLoading: false,
      error: null,
      authCheckDone: false,
      isOffline: false,
      userStatus: null,

      // Login action - 首发版：仅使用主进程认证，移除渲染进程降级逻辑
      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null })
        const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

        console.log(`[AuthStore] Login request [${requestId}]:`, {
          method: 'POST',
          body: { username: credentials.username, password: '***' },
        })

        try {
          const response = (await (
            window as unknown as {
              authAPI: { login: (c: LoginCredentials) => Promise<unknown> }
            }
          ).authAPI.login(credentials)) as LoginResponseExtended

          console.log(`[AuthStore] Login response [${requestId}]:`, {
            success: response.success,
            hasToken: !!response.token,
            status: (response as { status?: number }).status,
            detail:
              (response as { detail?: string }).detail ??
              (response as { error?: string }).error ??
              null,
          })

          const refreshToken = response.refresh_token ?? null
          // 成功条件与后端一致：status==200 且 res.data.token 存在；不依赖 hasUser
          if (response.success && response.token) {
            const user = response.user ?? safeUserFromUsername(credentials.username)

            // [SECURITY] 将敏感 token 保存到主进程安全存储
            console.log('[AuthStore] Saving tokens to main process...')
            if (typeof window !== 'undefined') {
              const authAPI = (
                window as unknown as {
                  authAPI?: {
                    setTokens?: (tokens: {
                      token: string | null
                      refreshToken: string | null
                    }) => Promise<void>
                  }
                }
              ).authAPI
              console.log('[AuthStore] authAPI exists:', !!authAPI)
              console.log('[AuthStore] setTokens exists:', !!authAPI?.setTokens)
              if (authAPI?.setTokens) {
                try {
                  await authAPI.setTokens({
                    token: response.token,
                    refreshToken: refreshToken ?? null,
                  })
                  console.log('[AuthStore] Tokens saved successfully')
                } catch (err) {
                  console.error('[AuthStore] Failed to save tokens to main process:', err)
                }
              } else {
                console.warn('[AuthStore] authAPI.setTokens not available')
              }
            } else {
              console.warn('[AuthStore] window is undefined')
            }

            set({
              isAuthenticated: true,
              user,
              token: response.token,
              refreshToken: refreshToken ?? get().refreshToken,
              isLoading: false,
              error: null,
            })

            // 【数据隔离】登录成功后加载该用户的账号数据和偏好设置
            const userId = user.id || credentials.username
            console.log('[AuthStore] 登录成功，加载用户数据:', userId)
            useAccounts.getState().loadUserAccounts(userId)
            usePlatformPreferenceStore.getState().loadUserPreferences(userId)

            // 【修复】同步获取用户状态，确保登录后状态完整
            try {
              const status = await getUserStatus()
              if (status) {
                get().setUserStatus(status)
                // 同步更新 user.plan - 使用 getEffectivePlan 确保正式套餐优先于试用
                const currentUser = get().user
                if (currentUser && status.plan) {
                  const effectivePlan = getEffectivePlan(status.plan, status.trial)
                  set({
                    user: {
                      ...currentUser,
                      plan: effectivePlan,
                      expire_at: status.expire_at ?? null,
                    },
                  })
                }
                console.log('[USER-STATUS] 登录后同步完成:', status)
              }
            } catch (error) {
              console.error('[AuthStore] Failed to fetch user status after login:', error)
              // 用户状态获取失败不影响登录成功，但会在控制台记录
            }
            return { success: true }
          }
          const status = (response as { status?: number }).status
          const errorObj = (response as { error?: { code?: string; message?: string } }).error
          const detail = errorObj?.message ?? (response as { detail?: string }).detail ?? ''
          const errorCode = errorObj?.code
          const requestUrl = (response as { requestUrl?: string }).requestUrl
          const errorType = (
            response as {
              errorType?:
                | 'USER_NOT_FOUND'
                | 'INVALID_PASSWORD'
                | 'ACCOUNT_DISABLED'
                | 'SERVER_ERROR'
                | 'UNKNOWN_ERROR'
            }
          ).errorType
          const raw = { status, detail, requestUrl, errorType, errorCode }
          console.log(`[AuthStore] Login failed [${requestId}]:`, {
            status,
            detail: detail || '(none)',
            errorType,
            raw,
          })
          const { userMessage, rawForDev, showRegisterHint } = mapAuthError(raw)
          console.log(`[AuthStore] Mapped error [${requestId}]:`, {
            userMessage,
            rawForDev,
            showRegisterHint,
          })
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            refreshToken: null,
            isLoading: false,
            error: userMessage,
          })
          return { success: false, error: userMessage, rawError: rawForDev, showRegisterHint }
        } catch (error) {
          const { userMessage, rawForDev } = mapAuthError(
            error instanceof Error ? error : { error: String(error) },
          )
          console.log(`[AuthStore] Login failed [${requestId}] (throw):`, rawForDev)
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            refreshToken: null,
            isLoading: false,
            error: userMessage,
          })
          return { success: false, error: userMessage, rawError: rawForDev }
        }
      },

      // Register action
      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null })

        // 【步骤D】生成请求追踪 ID
        const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

        // 【步骤B】统一错误处理：准备错误信息提取函数
        const extractErrorMessage = (error: unknown, defaultMessage: string): string => {
          // 如果是 AuthResponse 格式的错误
          const err = error as { error?: string } | null | undefined
          if (err?.error) {
            return err.error
          }
          // 如果是 Error 对象
          if (error instanceof Error) {
            return error.message || defaultMessage
          }
          // 如果是字符串
          if (typeof error === 'string') {
            return error
          }
          // 默认错误信息
          return defaultMessage
        }

        try {
          // 【步骤B】记录请求信息（去掉密码，打码处理）
          const payloadForLog = {
            ...data,
            password: '***',
            confirmPassword: '***',
          }
          console.log(`[AuthStore] Register request [${requestId}]:`, payloadForLog)

          const response = (await (
            window as unknown as { authAPI: { register: (d: RegisterData) => Promise<unknown> } }
          ).authAPI.register(data)) as RegisterResponseExtended

          // 【步骤B】记录响应信息（证据链：与后端一致，不看 hasUser/hasToken）
          console.log(`[AuthStore] Register response [${requestId}]:`, {
            success: response.success,
            status: (response as { status?: number }).status,
            responseData: {
              success: response.success,
              user: !!response.user,
              token: !!response.token,
            },
          })

          const refreshToken = response.refresh_token ?? null
          // 成功条件与后端一致：res.status==200 且 res.data.success===true；不依赖 user/token
          if (response.success) {
            if (response.token && response.user) {
              // [SECURITY] 将敏感 token 保存到主进程安全存储
              if (
                typeof window !== 'undefined' &&
                (
                  window as unknown as {
                    authAPI?: {
                      setTokens?: (tokens: {
                        token: string | null
                        refreshToken: string | null
                      }) => Promise<void>
                    }
                  }
                ).authAPI?.setTokens
              ) {
                try {
                  await (
                    window as unknown as {
                      authAPI: {
                        setTokens: (tokens: {
                          token: string | null
                          refreshToken: string | null
                        }) => Promise<void>
                      }
                    }
                  ).authAPI.setTokens({
                    token: response.token,
                    refreshToken: refreshToken ?? null,
                  })
                } catch (err) {
                  console.error('[AuthStore] Failed to save tokens to main process:', err)
                }
              }

              set({
                isAuthenticated: true,
                user: response.user,
                token: response.token,
                refreshToken: refreshToken ?? get().refreshToken,
                isLoading: false,
                error: null,
              })
            } else {
              set({ isLoading: false, error: null })
            }
            console.log(`[AuthStore] Register success [${requestId}]`)
            return { success: true }
          }
          // 【步骤B】统一错误处理：展示 status + 后端 detail + requestUrl；status 0 时引导尝试手机验证码注册
          const status = (response as { status?: number }).status
          const errorObj = (response as { error?: { code?: string; message?: string } }).error
          const detail = errorObj?.message ?? (response as { detail?: string }).detail ?? extractErrorMessage(response, '') ?? ''
          const errorCode = errorObj?.code
          const requestUrl = (response as { requestUrl?: string }).requestUrl
          const isNetworkError = status === 0 || /fetch failed|network|timeout/i.test(detail || '')

          // 使用 mapAuthError 获取友好的错误提示
          let errorMessage: string
          if (isNetworkError) {
            errorMessage = '无法连接认证服务器，请检查网络后重试；也可尝试下方「手机验证码注册」。'
          } else if (errorCode) {
            const { userMessage } = mapAuthError({ status, detail, requestUrl, errorCode })
            errorMessage = userMessage
          } else {
            errorMessage = typeof status === 'number'
              ? `注册失败（${status}）：${detail || '(无详情)'}${typeof requestUrl === 'string' ? `（请求地址：${requestUrl}）` : ''}`
              : (detail || '注册失败') +
                (typeof requestUrl === 'string' ? ` (请求地址: ${requestUrl})` : '')
          }
          console.error(`[AuthStore] Register failed [${requestId}]:`, {
            error: errorMessage,
            response: response,
          })

          set({
            isAuthenticated: false,
            user: null,
            token: null,
            isLoading: false,
            error: errorMessage,
          })
          return { success: false, error: errorMessage }
        } catch (error) {
          // 【步骤B】统一错误处理：区分网络错误和其他错误
          // 【步骤E】如果后端不可用/未启动，也要能提示
          let errorMessage: string

          if (error instanceof Error) {
            // 检查是否是网络错误（IPC 调用失败）
            if (
              error.message.includes('IPC') ||
              error.message.includes('invoke') ||
              error.message.includes('timeout')
            ) {
              errorMessage = '无法连接服务器，请确认后端服务已启动/网络可用'
              console.error(`[AuthStore] Register network error [${requestId}]:`, error)
              console.error('[AuthStore] Error stack:', error.stack)
            } else {
              errorMessage = error.message || '注册失败，请稍后重试'
              console.error(`[AuthStore] Register error [${requestId}]:`, error)
            }
          } else {
            errorMessage = extractErrorMessage(error, '注册失败，请稍后重试')
            console.error(`[AuthStore] Register unknown error [${requestId}]:`, error)
          }

          // 【步骤B】记录完整的错误信息
          console.error(`[AuthStore] Register failed [${requestId}]:`, {
            error: errorMessage,
            errorObject: error,
            requestId,
          })

          set({
            isAuthenticated: false,
            user: null,
            token: null,
            isLoading: false,
            error: errorMessage,
          })
          return { success: false, error: errorMessage }
        }
      },

      // Logout action
      logout: async () => {
        try {
          // 【修复】先停止所有正在运行的任务和断开连接
          console.log('[AuthStore] 正在停止所有任务和断开连接...')
          const _accounts = useAccounts.getState().accounts
          const currentAccountId = useAccounts.getState().currentAccountId

          // 停止当前账号的所有任务
          if (currentAccountId) {
            try {
              // 停止评论监听（自动回复和数据监控）
              await window.ipcRenderer.invoke(
                IPC_CHANNELS.tasks.autoReply.stopCommentListener,
                currentAccountId,
              )
            } catch (e) {
              console.log('[AuthStore] 停止评论监听失败（可能未运行）:', e)
            }

            try {
              // 停止自动发言
              await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.autoMessage.stop, currentAccountId)
            } catch (e) {
              console.log('[AuthStore] 停止自动发言失败（可能未运行）:', e)
            }

            try {
              // 停止自动弹窗
              await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.autoPopUp.stop, currentAccountId)
            } catch (e) {
              console.log('[AuthStore] 停止自动弹窗失败（可能未运行）:', e)
            }

            try {
              // 断开直播中控台连接
              await window.ipcRenderer.invoke(
                IPC_CHANNELS.tasks.liveControl.disconnect,
                currentAccountId,
              )
            } catch (e) {
              console.log('[AuthStore] 断开连接失败（可能未连接）:', e)
            }
          }

          console.log('[AuthStore] 所有任务已停止')

          // [SECURITY] 调用主进程登出，清理安全存储中的 token
          try {
            const token = get().token
            if (token) {
              await window.authAPI.logout(token)
            }
          } catch (error) {
            console.error('[AuthStore] Logout API error:', error)
          }
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          // 【数据隔离】先保存账号数据，再清空用户状态
          // 重要：必须在设置 user: null 之前保存数据
          const currentUserId = get().user?.id

          // 先保存账号数据到 localStorage
          if (currentUserId) {
            console.log('[AuthStore] 登出前保存账号数据:', currentUserId)
            const accountsState = useAccounts.getState()
            // 手动保存数据，不调用 reset（reset 会清空状态）
            const storageKey = `accounts-storage-${currentUserId}`
            const dataToSave = {
              state: {
                accounts: accountsState.accounts,
                currentAccountId: accountsState.currentAccountId,
                defaultAccountId: accountsState.defaultAccountId,
              },
              version: 0,
            }
            localStorage.setItem(storageKey, JSON.stringify(dataToSave))
            console.log('[AuthStore] 账号数据已保存，账号数:', accountsState.accounts.length)
          }

          set({
            isAuthenticated: false,
            user: null,
            token: null,
            refreshToken: null,
            userStatus: null,
            isLoading: false,
            error: null,
            isOffline: false,
          })

          // 【修复】清理当前用户的业务配置数据，但保留账号列表
          // 这样用户重新登录后可以看到之前添加的账号
          if (currentUserId) {
            console.log('[AuthStore] 清理用户业务配置数据（保留账号列表）:', currentUserId)
            // 只删除业务配置数据，不删除账号列表
            const prefixesToRemove = [
              'account-config',
              'chrome-config',
              'auto-reply',
              'auto-message',
              'auto-popup',
              'live-control',
              'sub-account',
              'account-pref',
            ]

            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i)
              if (!key) continue

              // 检查是否是该用户的业务配置数据
              for (const prefix of prefixesToRemove) {
                if (key.startsWith(`${prefix}-${currentUserId}`)) {
                  localStorage.removeItem(key)
                  break
                }
              }
            }
          }

          // 清空试用状态，避免 B 账号登录后沿用 A 账号的试用缓存导致不弹试用弹窗
          useTrialStore.getState().reset()
          // 清空所有业务数据，实现用户间完全数据隔离
          useAccounts.getState().reset()
          // 使用可选链操作符安全调用各 store 的 resetAllContexts 方法
          useLiveControlStore.getState().resetAllContexts?.()
          useAutoMessageStore.getState().resetAllContexts?.()
          useAutoPopUpStore.getState().resetAllContexts?.()
          useAutoReplyConfigStore.getState().resetAllContexts?.()
          useChromeConfigStore.getState().resetAllContexts()
          useSubAccountStore.getState().resetAllContexts?.()
          // 退出登录后：若未勾选「记住账号」，清空本地保存的账号与记住状态
          if (
            typeof localStorage !== 'undefined' &&
            localStorage.getItem(AUTH_REMEMBER_ME_KEY) !== 'true'
          ) {
            localStorage.removeItem(AUTH_LAST_IDENTIFIER_KEY)
            localStorage.setItem(AUTH_REMEMBER_ME_KEY, 'false')
          }
        }
      },

      // 启动时鉴权：无 token→未登录；有 token→GET /me（内部 401 会尝试 refresh 后重试），200→已登录，401→回登录页，其他→已登录但离线
      checkAuth: async () => {
        set({ isLoading: true, authCheckDone: false })

        try {
          // [SECURITY] 优先从主进程安全存储获取 token
          let mainToken: string | null = null
          let mainRefreshToken: string | null = null
          if (
            typeof window !== 'undefined' &&
            (
              window as unknown as {
                authAPI?: {
                  getTokenInternal?: () => Promise<{
                    token: string | null
                    refreshToken: string | null
                  }>
                }
              }
            ).authAPI?.getTokenInternal
          ) {
            try {
              const tokens = await (
                window as unknown as {
                  authAPI: {
                    getTokenInternal: () => Promise<{
                      token: string | null
                      refreshToken: string | null
                    }>
                  }
                }
              ).authAPI.getTokenInternal()
              mainToken = tokens.token
              mainRefreshToken = tokens.refreshToken
              // 同步到内存
              if (mainToken) {
                set({ token: mainToken, refreshToken: mainRefreshToken })
              }
              console.log(
                '[AuthStore] checkAuth: got token from main process:',
                mainToken ? 'exists' : 'null',
              )
            } catch (err) {
              console.error('[AuthStore] Failed to get tokens from main process:', err)
            }
          }

          const { token, refreshToken } = get()
          const effectiveToken = mainToken ?? token
          const effectiveRefreshToken = mainRefreshToken ?? refreshToken

          if (!effectiveToken && !effectiveRefreshToken) {
            set({
              isAuthenticated: false,
              user: null,
              isLoading: false,
              authCheckDone: true,
              isOffline: false,
            })
            return
          }

          const result = await getMe()

          if (result.ok && result.data?.username != null) {
            const userId = result.data.username
            set({
              isAuthenticated: true,
              user: get().user ?? safeUserFromUsername(userId),
              isLoading: false,
              authCheckDone: true,
              isOffline: false,
              error: null,
            })

            // 【修复】启动时加载用户所有数据
            console.log('[AuthStore] 启动鉴权成功，加载用户数据:', userId)
            useAccounts.getState().loadUserAccounts(userId)
            usePlatformPreferenceStore.getState().loadUserPreferences(userId)
            useAutoReplyConfigStore.getState().loadUserContexts(userId)
            useAutoMessageStore.getState().loadUserContexts(userId)
            useAutoPopUpStore.getState().loadUserContexts(userId)
            useChromeConfigStore.getState().loadUserConfigs(userId)
            useLiveControlStore.getState().loadUserContexts(userId)
            useSubAccountStore.getState().loadUserContexts(userId)

            // 获取并同步用户状态
            getUserStatus()
              .then(status => {
                if (status) {
                  get().setUserStatus(status)
                  // 同步更新 user.plan - 使用 getEffectivePlan 确保正式套餐优先于试用
                  const currentUser = get().user
                  if (currentUser && status.plan) {
                    const effectivePlan = getEffectivePlan(status.plan, status.trial)
                    // 如果 username 是手机号格式，更新 phone 和 username 显示
                    const isPhone = /^1[3-9]\d{9}$/.test(status.username)
                    set({
                      user: {
                        ...currentUser,
                        plan: effectivePlan,
                        expire_at: status.expire_at ?? null,
                        // 如果 username 是手机号，同时更新 phone 和 username 显示
                        ...(isPhone && {
                          phone: status.username,
                          username: status.username,
                        }),
                      },
                    })
                  }
                  console.log('[USER-STATUS]', status)
                }
              })
              .catch(error => {
                console.error('[AuthStore] Failed to fetch user status:', error)
              })
            return
          }

          if (result.status === 401) {
            get().clearTokensAndUnauth()
            set({ isLoading: false, authCheckDone: true })
            return
          }

          // 断网/超时/5xx：不踢回登录页，保持已登录但离线
          set({
            isAuthenticated: true,
            isLoading: false,
            authCheckDone: true,
            isOffline: true,
          })
        } catch (error) {
          // 【修复】捕获所有异常，确保 authCheckDone 被设置为 true，避免页面一直卡在加载中
          console.error('[AuthStore] checkAuth failed:', error)
          set({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            authCheckDone: true,
            isOffline: false,
            error: error instanceof Error ? error.message : '认证检查失败',
          })
        }
      },

      // Set user
      setUser: (user: SafeUser | null) => set({ user }),

      // Set token
      setToken: (token: string | null) => set({ token }),

      setRefreshToken: (refreshToken: string | null) => set({ refreshToken }),

      /** refresh 失败时由 apiClient 调用：清空 token/refreshToken，回到登录页 */
      clearTokensAndUnauth: () =>
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          refreshToken: null,
          userStatus: null,
          isOffline: false,
        }),

      setUserStatus: (userStatus: UserStatus | null) => set({ userStatus }),

      /** 拉取 /auth/status 并写入 store，同时同步更新 user.plan */
      refreshUserStatus: async () => {
        const status = await getUserStatus()
        if (status) {
          set({ userStatus: status })
          // 同步更新 user.plan - 使用 getEffectivePlan 确保正式套餐优先于试用
          const currentUser = get().user
          if (currentUser && status.plan) {
            const effectivePlan = getEffectivePlan(status.plan, status.trial)
            set({
              user: {
                ...currentUser,
                plan: effectivePlan,
                expire_at: status.expire_at ?? null,
              },
            })
          }
        }
        return status
      },

      startTrialAndRefresh: async () => {
        const token = get().token
        if (!token) {
          return { success: false as const, message: '请先登录' }
        }
        const result = await startTrial()
        console.log('[AuthStore] startTrial result:', result)
        if (!result.ok) {
          return {
            success: false as const,
            errorCode: result.error?.code,
            message: result.error?.message ?? `请求失败（${result.status}）`,
          }
        }
        if (!result.data?.success) {
          return { success: false as const, message: '开通试用失败' }
        }
        const username = get().user?.username ?? ''
        const statusResult = await getTrialStatus(username)
        console.log('[AuthStore] getTrialStatus result:', statusResult)
        const statusData = statusResult.ok ? statusResult.data : null
        const userStatus: UserStatus = statusData
          ? {
              username: get().user?.username ?? username,
              status: 'active',
              plan: statusData.active ? 'trial' : 'free',
              trial: {
                start_at:
                  statusData.start_ts != null
                    ? new Date(statusData.start_ts * 1000).toISOString()
                    : null,
                end_at:
                  statusData.end_ts != null
                    ? new Date(statusData.end_ts * 1000).toISOString()
                    : null,
                is_active: statusData.active,
                is_expired: statusData.has_trial && !statusData.active,
              },
            }
          : {
              username: get().user?.username ?? username,
              status: 'active',
              plan: 'trial',
              trial: { is_active: true },
            }
        console.log('[AuthStore] Setting userStatus after trial:', userStatus)
        set({ userStatus })

        // 同步更新 user.plan
        const currentUser = get().user
        if (currentUser) {
          set({
            user: {
              ...currentUser,
              plan: userStatus.plan,
            },
          })
        }

        return { success: true as const, status: userStatus }
      },

      // Set loading state
      setLoading: (loading: boolean) => set({ isLoading: loading }),

      // Set error
      setError: (error: string | null) => set({ error }),

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: AUTH_ZUSTAND_PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      // [SECURITY] 敏感认证信息不再持久化到 localStorage
      // token/refreshToken 仅存储在主进程安全存储中
      // user 对象包含敏感信息，也不再持久化
      partialize: state => ({
        // 仅保留 UI 状态，认证状态通过主进程恢复
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)

// Selectors for easier access
export const useAuth = () => useAuthStore()
export const useUser = () => useAuthStore(state => state.user)
export const useIsAuthenticated = () => useAuthStore(state => state.isAuthenticated)
export const useAuthLoading = () => useAuthStore(state => state.isLoading)
export const useAuthError = () => useAuthStore(state => state.error)
export const useAuthCheckDone = () => useAuthStore(state => state.authCheckDone)
export const useIsOffline = () => useAuthStore(state => state.isOffline)
