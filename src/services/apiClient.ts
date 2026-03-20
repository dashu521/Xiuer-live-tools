/**
 * 鉴权请求统一出口：所有需要登录态的后端 API 必须经 requestWithRefresh 或 getMe 发起，禁止在业务代码中手写带 token 的 fetch。
 * 自动带 Bearer Token；401 时若有 refresh_token 则自动 POST /refresh 后重试一次（加锁防并发）。
 * API_BASE_URL 来自 src/config/authApi.ts，勿在此硬编码。
 *
 * [SECURITY] Token 获取唯一来源：主进程安全存储（通过 IPC）
 * 禁止任何 fallback 到 renderer 内存 token 的逻辑，避免跨账号状态串扰
 */
import { API_BASE_URL } from '@/config/authApi'
import { useAuthStore } from '@/stores/authStore'
import type { UserStatus } from '@/types/auth'

// [SECURITY] Token 策略标记，启动时打印一次
let tokenStrategyLogged = false

/**
 * 从主进程安全存储获取 token
 * [SECURITY] 主进程是唯一可信来源，禁止 fallback 到 renderer 内存
 * 如果主进程获取失败，返回 null，由调用方处理认证失败
 */
async function getTokenFromMainProcess(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const authAPI = (
    window as {
      authAPI?: {
        getTokenInternal?: () => Promise<{ token: string | null; refreshToken: string | null }>
      }
    }
  ).authAPI

  // [CRITICAL] 强制只使用 getTokenInternal，不再 fallback 到 deprecated getTokens
  const getTokenFn = authAPI?.getTokenInternal

  if (!tokenStrategyLogged) {
    console.log('[apiClient] token strategy = getTokenInternal-only, available:', !!getTokenFn)
    tokenStrategyLogged = true
  }

  if (!getTokenFn) {
    console.error('[apiClient] authAPI.getTokenInternal not available, treating as unauthenticated')
    return null
  }
  try {
    const tokens = await getTokenFn()
    console.log('[apiClient] Got token from main process:', tokens.token ? 'exists' : 'null')
    // [SECURITY] 主进程没有 token 时，不再 fallback，视为未认证
    if (!tokens.token) {
      console.warn('[apiClient] No token in main process, treating as unauthenticated')
      return null
    }
    return tokens.token
  } catch (err) {
    console.error('[apiClient] Failed to get token from main process:', err)
    // [SECURITY] 获取失败时，不再 fallback，视为未认证
    return null
  }
}

/** 从主进程安全存储获取 refresh token */
async function getRefreshTokenFromMainProcess(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const authAPI = (
    window as {
      authAPI?: {
        getTokenInternal?: () => Promise<{ token: string | null; refreshToken: string | null }>
      }
    }
  ).authAPI

  // [CRITICAL] 强制只使用 getTokenInternal
  const getTokenFn = authAPI?.getTokenInternal
  if (!getTokenFn) return null

  try {
    const tokens = await getTokenFn()
    return tokens.refreshToken
  } catch (err) {
    console.error('[apiClient] Failed to get refresh token from main process:', err)
    return null
  }
}

export type ApiResult<T = unknown> =
  | { ok: true; data: T; status: number }
  | { ok: false; status: number; error?: { code?: string; message?: string } }

async function request<T>(
  method: string,
  path: string,
  token: string | null,
  body?: object,
): Promise<ApiResult<T>> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  // [AUTH-AUDIT] 临时审计日志：真正发起 fetch 前打印 process、method、full_url。可删除。
  const processType =
    typeof process !== 'undefined' && process && 'type' in process
      ? (process as { type?: string }).type
      : 'renderer'
  console.log('[AUTH-AUDIT]', processType ?? 'renderer', method, url)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let json: T | { detail?: { code?: string; message?: string } } | null = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      // ignore
    }
    if (!res.ok) {
      const rawDetail =
        json && typeof json === 'object' && 'detail' in json
          ? (json as { detail?: unknown }).detail
          : undefined
      let message = text || res.statusText
      if (typeof rawDetail === 'string') {
        message = rawDetail
      } else if (rawDetail && typeof rawDetail === 'object' && 'message' in (rawDetail as object)) {
        message = (rawDetail as { message?: string }).message ?? message
      } else if (Array.isArray(rawDetail) && rawDetail.length > 0) {
        message = (rawDetail as { msg?: string }[]).map(d => d?.msg ?? JSON.stringify(d)).join('; ')
      }
      const code =
        rawDetail && typeof rawDetail === 'object' && 'code' in (rawDetail as object)
          ? (rawDetail as { code?: string }).code
          : undefined
      return {
        ok: false,
        status: res.status,
        error: { code, message },
      }
    }
    return { ok: true, data: json as T, status: res.status }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 0, error: { code: 'network_error', message } }
  }
}

let refreshLock: Promise<string | null> | null = null

export const KICKED_OUT_EVENT = 'auth:kicked-out'

function dispatchKickedOutEvent(message: string): void {
  console.warn('[apiClient] Dispatching kicked-out event:', message)
  window.dispatchEvent(
    new CustomEvent(KICKED_OUT_EVENT, {
      detail: { message },
    }),
  )
}

/** 通过主进程刷新会话，成功返回新 access_token 并同步 renderer 镜像状态 */
async function doRefresh(): Promise<string | null> {
  const { setToken, clearTokensAndUnauth } = useAuthStore.getState()
  const authAPI = window.authAPI
  if (!authAPI?.refreshSession) {
    await clearTokensAndUnauth()
    return null
  }

  try {
    const result = await authAPI.refreshSession()
    if (!result.success || !result.token) {
      // 检查是否是被踢下线
      const errorObj = result.error as { code?: string; message?: string } | undefined
      const errorCode = errorObj?.code
      const errorMessage =
        errorObj?.message || (typeof result.error === 'string' ? result.error : '')
      if (errorCode === 'kicked_out' || errorMessage.includes('其他设备')) {
        dispatchKickedOutEvent(errorMessage || '您的账号已在其他设备登录')
      }
      await clearTokensAndUnauth()
      return null
    }

    setToken(result.token)
    return result.token
  } catch (err) {
    console.error('[apiClient] Failed to refresh session via main process:', err)
    await clearTokensAndUnauth()
    return null
  }
}

/**
 * 带 401 自动 refresh 的请求：先带当前 token 请求；若 401 且有 refresh_token 则刷新后重试一次（加锁防并发）
 */
export async function requestWithRefresh<T>(
  method: string,
  path: string,
  body?: object,
): Promise<ApiResult<T>> {
  // 首发版：仅从主进程安全存储获取 token
  const token = await getTokenFromMainProcess()
  const result = await request<T>(method, path, token, body)

  if (result.ok || result.status !== 401) return result

  // 检查是否是被踢下线的错误
  if (result.error?.code === 'kicked_out') {
    dispatchKickedOutEvent(result.error.message || '您的账号已在其他设备登录')
    await useAuthStore.getState().clearTokensAndUnauth()
    return result
  }

  // 首发版：仅从主进程安全存储获取 refresh token
  const refreshToken = await getRefreshTokenFromMainProcess()
  if (!refreshToken) return result

  // 加锁：并发 401 时只发起一次 refresh，其余等待
  if (!refreshLock) {
    refreshLock = doRefresh().finally(() => {
      refreshLock = null
    })
  }
  const newToken = await refreshLock
  if (!newToken) return result

  return request<T>(method, path, newToken, body)
}

/** GET /me 返回格式：{ ok: true, username: string }；401 时自动尝试 refresh 后重试一次 */
export interface MeResponse {
  ok: boolean
  username: string
}

export async function getMe(): Promise<ApiResult<MeResponse>> {
  return requestWithRefresh<MeResponse>('GET', '/me')
}

/** GET /auth/session-check 返回格式：{ ok: true, user_id: string } */
export interface SessionCheckResponse {
  ok: boolean
  user_id: string
}

/**
 * GET /auth/session-check：检查当前会话是否有效（用于心跳检测）
 * 会同时验证 access_token 和 refresh_token 是否被撤销
 * 若会话被顶掉（其他设备登录），返回 kicked_out 错误
 */
export async function sessionCheck(): Promise<ApiResult<SessionCheckResponse>> {
  return requestWithRefresh<SessionCheckResponse>('GET', '/auth/session-check')
}

/**
 * GET /status：获取当前用户状态（只读）。使用 access_token，不做 fallback/mock。
 * 失败时只记录日志，返回 null，不登出、不弹窗。
 */
export async function getUserStatus(): Promise<UserStatus | null> {
  const result = await requestWithRefresh<UserStatus>('GET', '/status')
  if (result.ok && result.data) {
    return result.data
  }
  if (!result.ok) {
    console.warn('[apiClient] getUserStatus failed:', result.status, result.error)
  }
  return null
}

/** 后端 POST /trial/start 返回 */
export interface TrialStartResponse {
  success: boolean
  start_ts?: number
  end_ts?: number
}

/** 后端 GET /trial/status 返回 */
export interface TrialStatusResponse {
  has_trial: boolean
  active: boolean
  start_ts?: number
  end_ts?: number
}

/**
 * POST /trial/start：开启 3 天试用。必须带 Authorization: Bearer <token>，Body 必须包含 { username }。
 * 从当前登录状态读取 username，不允许空 body。
 */
export async function startTrial(): Promise<ApiResult<TrialStartResponse>> {
  const username = useAuthStore.getState().user?.username
  if (!username) {
    return {
      ok: false,
      status: 0,
      error: { message: '未获取到当前用户名，请重新登录' },
    }
  }
  const result = await requestWithRefresh<TrialStartResponse>('POST', '/trial/start', {
    username,
  })
  if (!result.ok) {
    console.warn('[apiClient] startTrial failed:', result.status, result.error)
  }
  return result
}

/**
 * GET /trial/status?username=xxx：查询当前用户试用状态。必须带 Authorization。
 * 返回 { has_trial, active, start_ts, end_ts }。
 */
export async function getTrialStatus(username: string): Promise<ApiResult<TrialStatusResponse>> {
  const path = `/trial/status?username=${encodeURIComponent(username)}`
  return requestWithRefresh<TrialStatusResponse>('GET', path)
}

/** 后端 GET /server-time 返回 */
export interface ServerTimeResponse {
  server_time: number // Unix timestamp in seconds
}

/**
 * GET /server-time：获取服务端当前时间戳。
 * 用于防止客户端时间篡改，确保试用时间计算准确。
 */
export async function getServerTime(): Promise<number | null> {
  const result = await requestWithRefresh<ServerTimeResponse>('GET', '/server-time')
  if (result.ok && result.data) {
    // 转换为毫秒
    return result.data.server_time * 1000
  }
  console.warn('[apiClient] getServerTime failed:', result.status, result.ok ? '' : result.error)
  return null
}

/** 后端 POST /login 返回（账号密码登录） */
export interface LoginResponseBackend {
  token: string
  user?: {
    id: string
    email?: string | null
    phone?: string | null
    created_at?: string
    last_login_at?: string | null
    status?: string
    plan?: string | null
    expire_at?: string | null
  }
}

/**
 * POST /login：账号密码登录（供渲染进程直连后端，如浏览器环境或主进程连不上时）
 */
export async function loginWithPassword(
  username: string,
  password: string,
): Promise<ApiResult<LoginResponseBackend>> {
  return request<LoginResponseBackend>('POST', '/login', null, { username, password })
}

/** 后端 POST /register 返回（账号密码注册） */
export interface RegisterResponseBackend {
  user?: {
    id: string
    email?: string | null
    phone?: string | null
    created_at?: string
    last_login_at?: string | null
    status?: string
  }
  access_token?: string
  refresh_token?: string
}

/**
 * POST /register：账号密码注册（供渲染进程直连后端，避免主进程 fetch 失败时无法注册）
 */
export async function registerWithPassword(
  username: string,
  password: string,
): Promise<ApiResult<RegisterResponseBackend>> {
  return request<RegisterResponseBackend>('POST', '/register', null, { username, password })
}

/** 后端 POST /auth/sms/send 返回（有本地验证码时会带 dev_code，构建安装后可界面兜底展示） */
export interface SmsSendResponse {
  success: boolean
  /** 验证码（dev/aliyun 模式或发送失败兜底时返回） */
  dev_code?: string
  /** 短信发送失败但返回了 dev_code 兜底时为 true */
  sms_failed?: boolean
  sms_failed_message?: string
}

/**
 * POST /auth/sms/send：发送手机验证码（后端为 query 参数）
 */
export async function sendSmsCode(phone: string): Promise<ApiResult<SmsSendResponse>> {
  return request<SmsSendResponse>('POST', `/auth/sms/send?phone=${encodeURIComponent(phone)}`, null)
}

/** 后端 POST /auth/sms/login 返回 - 已与密码登录格式统一 */
export interface SmsLoginResponse {
  token: string
  user?: {
    id: string
    email?: string | null
    phone?: string | null
    created_at?: string
    last_login_at?: string | null
    status?: string
  }
  refresh_token?: string
  needs_password?: boolean
}

/**
 * POST /auth/sms/login：手机验证码登录（后端为 query 参数）
 */
export async function loginWithSmsCode(
  phone: string,
  code: string,
): Promise<ApiResult<SmsLoginResponse>> {
  return request<SmsLoginResponse>(
    'POST',
    `/auth/sms/login?phone=${encodeURIComponent(phone)}&code=${encodeURIComponent(code)}`,
    null,
  )
}

/** POST /set-password：SMS 注册用户首次设置密码 */
export async function setPassword(
  password: string,
): Promise<ApiResult<{ ok: boolean; message: string }>> {
  return requestWithRefresh<{ ok: boolean; message: string }>('POST', '/set-password', { password })
}

/** POST /change-password：已有密码的用户修改密码 */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<ApiResult<{ ok: boolean; message: string }>> {
  return requestWithRefresh<{ ok: boolean; message: string }>('POST', '/change-password', {
    old_password: oldPassword,
    new_password: newPassword,
  })
}

/** POST /auth/sms/reset-password：通过手机验证码重置密码（忘记密码） */
export async function resetPasswordWithSms(
  phone: string,
  code: string,
  newPassword: string,
): Promise<ApiResult<{ ok: boolean; message: string }>> {
  const params = new URLSearchParams({ phone, code, new_password: newPassword })
  return request<{ ok: boolean; message: string }>(
    'POST',
    `/auth/sms/reset-password?${params}`,
    null,
  )
}

// ===================== 礼品卡 =====================

export interface RedeemGiftCardResponse {
  success: boolean
  message?: string
  error?: string
  data?: {
    membershipType: string | null
    membershipDays: number
    newMembershipType: string
    newExpiryDate: string | null
    tier?: string // 新增：档位
    maxAccounts?: number // 新增：最大账号数
    previousMaxAccounts?: number // 新增：之前的最大账号数
    redeemedBalance: number
    newBalance: number
  }
}

/** POST /gift-card/redeem：用户兑换礼品卡 */
export async function redeemGiftCard(code: string): Promise<ApiResult<RedeemGiftCardResponse>> {
  return requestWithRefresh<RedeemGiftCardResponse>('POST', '/gift-card/redeem', { code })
}

export interface GiftCardHistoryItem {
  id: string
  gift_card_code: string
  membership_type: string | null
  membership_days: number
  redeemed_at: string | null
  previous_plan: string | null
  new_plan: string | null
}

/** GET /gift-card/history：用户查询兑换历史 */
export async function getGiftCardHistory(
  limit = 20,
): Promise<ApiResult<{ success: boolean; data: GiftCardHistoryItem[] }>> {
  return requestWithRefresh<{ success: boolean; data: GiftCardHistoryItem[] }>(
    'GET',
    `/gift-card/history?limit=${limit}`,
  )
}

// ===================== 用户配置同步 =====================

export interface UserConfigData {
  accounts?: Array<{ id: string; name: string }>
  currentAccountId?: string
  defaultAccountId?: string | null
  platformPreferences?: Record<string, { defaultPlatform: string; updatedAt: string }>
  autoReplyConfigs?: Record<string, unknown>
  autoMessageConfigs?: Record<string, unknown>
  autoPopUpConfigs?: Record<string, unknown>
  chromeConfigs?: Record<string, unknown>
  liveControlConfigs?: Record<string, unknown>
  subAccountConfigs?: Record<string, unknown>
  theme?: string
}

export interface GetUserConfigResponse {
  success: boolean
  config: UserConfigData | null
  version: number
  updated_at: string | null
}

export interface SyncConfigResponse {
  success: boolean
  message: string
  synced_at: string | null
}

/** GET /config：获取用户配置（跨设备同步） */
export async function getUserConfig(): Promise<ApiResult<GetUserConfigResponse>> {
  return requestWithRefresh<GetUserConfigResponse>('GET', '/config')
}

/** POST /config/sync：同步用户配置到云端 */
export async function syncUserConfig(
  config: UserConfigData,
): Promise<ApiResult<SyncConfigResponse>> {
  return requestWithRefresh<SyncConfigResponse>('POST', '/config/sync', { config })
}

// ===================== 用户反馈 =====================

export interface SubmitFeedbackRequest {
  category: string
  content: string
  contact?: string
  platform?: string
  app_version?: string
  os_info?: string
  diagnostic_info?: Record<string, unknown>
}

export interface SubmitFeedbackResponse {
  success: boolean
  message: string
  feedback_id?: string
}

/** POST /feedback/submit：提交用户反馈（需要登录） */
export async function submitFeedback(
  data: SubmitFeedbackRequest,
): Promise<ApiResult<SubmitFeedbackResponse>> {
  return requestWithRefresh<SubmitFeedbackResponse>('POST', '/feedback/submit', data)
}
