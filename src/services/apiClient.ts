/**
 * 鉴权请求统一出口：所有需要登录态的后端 API 必须经主进程代理发起，
 * 禁止在渲染进程中直接持有或读取 access_token / refresh_token。
 */
import { API_BASE_URL } from '@/config/authApi'
import { useAuthStore } from '@/stores/authStore'
import type { UserStatus } from '@/types/auth'

export type ApiResult<T = unknown> =
  | { ok: true; data: T; status: number }
  | { ok: false; status: number; error?: { code?: string; message?: string } }

interface ProxyRequestError {
  code?: string
  message?: string
}

function normalizeApiPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

function normalizeApiUrl(path: string): string {
  return `${API_BASE_URL.replace(/\/$/, '')}${normalizeApiPath(path)}`
}

function extractErrorDetail(
  text: string,
  statusText: string,
  payload: unknown,
): { code?: string; message?: string } {
  const rawDetail =
    payload && typeof payload === 'object' && 'detail' in payload
      ? (payload as { detail?: unknown }).detail
      : undefined

  let message = text || statusText
  if (typeof rawDetail === 'string') {
    message = rawDetail
  } else if (rawDetail && typeof rawDetail === 'object' && 'message' in rawDetail) {
    message = (rawDetail as { message?: string }).message ?? message
  } else if (Array.isArray(rawDetail) && rawDetail.length > 0) {
    message = (rawDetail as { msg?: string }[])
      .map(item => item?.msg ?? JSON.stringify(item))
      .join('; ')
  }

  const code =
    rawDetail && typeof rawDetail === 'object' && 'code' in rawDetail
      ? (rawDetail as { code?: string }).code
      : undefined

  return { code, message }
}

function normalizeProxyError(error: unknown): ProxyRequestError {
  if (typeof error === 'string') {
    return { message: error }
  }
  if (error && typeof error === 'object') {
    const detail = error as ProxyRequestError
    if (detail.code || detail.message) {
      return detail
    }
  }
  return { message: '请求失败，请稍后再试' }
}

function isKickedOutError(error?: ProxyRequestError): boolean {
  return error?.code === 'kicked_out' || !!error?.message?.includes('其他设备')
}

const PUBLIC_REQUEST_TIMEOUT_MS = 15000
const PUBLIC_REQUEST_RETRY_DELAY_MS = 1500

function shouldRetryPublicRequest(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }
  if (error instanceof TypeError) {
    return true
  }

  const message = error instanceof Error ? error.message : String(error)
  return /fetch|network|failed to fetch|econnrefused|aborted/i.test(message)
}

async function fetchPublicWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), PUBLIC_REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timeout)
  }
}

async function requestPublic<T>(
  method: string,
  path: string,
  body?: object,
): Promise<ApiResult<T>> {
  const url = normalizeApiUrl(path)
  try {
    const requestInit: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    }

    let res: Response
    try {
      res = await fetchPublicWithTimeout(url, requestInit)
    } catch (firstErr) {
      if (!shouldRetryPublicRequest(firstErr)) {
        throw firstErr
      }
      await new Promise(resolve => window.setTimeout(resolve, PUBLIC_REQUEST_RETRY_DELAY_MS))
      res = await fetchPublicWithTimeout(url, requestInit)
    }

    const text = await res.text()
    let json: T | { detail?: unknown } | null = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      // ignore
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: extractErrorDetail(text, res.statusText, json),
      }
    }
    return { ok: true, data: json as T, status: res.status }
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === 'AbortError'
    const message = isTimeout
      ? '请求超时，请检查网络后重试'
      : err instanceof Error
        ? err.message
        : String(err)
    return {
      ok: false,
      status: 0,
      error: { code: isTimeout ? 'network_timeout' : 'network_error', message },
    }
  }
}

export const KICKED_OUT_EVENT = 'auth:kicked-out'

function dispatchKickedOutEvent(message: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(KICKED_OUT_EVENT, {
      detail: { message },
    }),
  )
}

async function requestAuthenticated<T>(
  method: string,
  path: string,
  body?: object,
): Promise<ApiResult<T>> {
  if (typeof window === 'undefined' || !window.authAPI?.proxyRequest) {
    return {
      ok: false,
      status: 0,
      error: { code: 'auth_proxy_unavailable', message: '认证通道不可用' },
    }
  }

  try {
    const result = await window.authAPI.proxyRequest({
      endpoint: normalizeApiPath(path),
      method,
      body: body ?? null,
    })

    if (!result.success) {
      const normalizedError = normalizeProxyError(result.error)
      if (isKickedOutError(normalizedError)) {
        dispatchKickedOutEvent(normalizedError.message || '您的账号已在其他设备登录')
        await useAuthStore.getState().clearTokensAndUnauth()
      } else if (result.status === 401) {
        await useAuthStore.getState().clearTokensAndUnauth()
      }
      return {
        ok: false,
        status: result.status ?? 0,
        error: normalizedError,
      }
    }

    return {
      ok: true,
      data: result.data as T,
      status: result.status ?? 200,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 0, error: { code: 'network_error', message } }
  }
}

/**
 * 历史名称保留；当前实现由主进程统一附加认证并处理 refresh。
 */
export async function requestWithRefresh<T>(
  method: string,
  path: string,
  body?: object,
): Promise<ApiResult<T>> {
  return requestAuthenticated<T>(method, path, body)
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

export interface AITrialModels {
  chat: string
  auto_reply: string
  knowledge_draft: string
}

export interface AITrialSessionResponse {
  ok: boolean
  mode: 'trial'
  token: string
  expires_in: number
  token_type: 'Bearer'
  models: AITrialModels
  limits: {
    chat_remaining: number
    auto_reply_remaining: number
    knowledge_draft_remaining: number
  }
  auto_send_default: boolean
  credential: {
    provider: string
    base_url: string
    api_key: string
  }
}

export interface AITrialStatusResponse {
  ok: boolean
  trial_enabled: boolean
  mode: 'trial'
  expires_in: number
  auto_send_default: boolean
  models: AITrialModels
  provider: string
  base_url: string
}

export interface AITrialReportUseResponse {
  ok: boolean
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

export async function createAITrialSession(params: {
  deviceId: string
  clientVersion?: string
  features?: Array<'chat' | 'auto_reply' | 'knowledge_draft'>
}): Promise<ApiResult<AITrialSessionResponse>> {
  return requestWithRefresh<AITrialSessionResponse>('POST', '/ai/trial/session', {
    device_id: params.deviceId,
    client_version: params.clientVersion,
    features: params.features ?? ['chat', 'auto_reply', 'knowledge_draft'],
  })
}

export async function getAITrialStatus(): Promise<ApiResult<AITrialStatusResponse>> {
  return requestWithRefresh<AITrialStatusResponse>('GET', '/ai/trial/status')
}

export async function reportAITrialUse(params: {
  feature: 'chat' | 'auto_reply' | 'knowledge_draft'
  deviceId?: string
  model?: string
  clientVersion?: string
}): Promise<ApiResult<AITrialReportUseResponse>> {
  return requestWithRefresh<AITrialReportUseResponse>('POST', '/ai/trial/report-use', {
    feature: params.feature,
    device_id: params.deviceId,
    model: params.model,
    client_version: params.clientVersion,
  })
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
  return requestPublic<LoginResponseBackend>('POST', '/login', { username, password })
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
  return requestPublic<RegisterResponseBackend>('POST', '/register', { username, password })
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

/** POST /auth/sms/send：发送手机验证码（当前线上服务要求 query 参数） */
export async function sendSmsCode(phone: string): Promise<ApiResult<SmsSendResponse>> {
  const path = `/auth/sms/send?phone=${encodeURIComponent(phone)}`
  return requestPublic<SmsSendResponse>('POST', path)
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

/** POST /auth/sms/login：手机验证码登录（当前线上服务要求 query 参数） */
export async function loginWithSmsCode(
  phone: string,
  code: string,
): Promise<ApiResult<SmsLoginResponse>> {
  const path = `/auth/sms/login?phone=${encodeURIComponent(phone)}&code=${encodeURIComponent(code)}`
  return requestPublic<SmsLoginResponse>('POST', path)
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

/** POST /auth/sms/reset-password：通过手机验证码重置密码（当前线上服务要求 query 参数） */
export async function resetPasswordWithSms(
  phone: string,
  code: string,
  newPassword: string,
): Promise<ApiResult<{ ok: boolean; message: string }>> {
  const path =
    `/auth/sms/reset-password?phone=${encodeURIComponent(phone)}` +
    `&code=${encodeURIComponent(code)}` +
    `&new_password=${encodeURIComponent(newPassword)}`
  return requestPublic<{ ok: boolean; message: string }>('POST', path)
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

// ===================== 消息中心 =====================

export interface MessageCenterItem {
  id: string
  title: string
  content: string
  type: 'notice' | 'update' | 'warning' | 'marketing'
  is_pinned: boolean
  is_read: boolean
  created_at: string | null
  published_at: string | null
  expires_at: string | null
}

export interface MessageListResponse {
  success: boolean
  items: MessageCenterItem[]
  unread_count: number
  fetched_at: string | null
}

export interface MessageReadResponse {
  success: boolean
  unread_count: number
  updated_at: string | null
}

export interface MessageStreamSnapshotEvent {
  type: 'snapshot'
  payload: MessageListResponse
}

type MessageStreamEvent = MessageStreamSnapshotEvent

export async function getMessages(limit = 20): Promise<ApiResult<MessageListResponse>> {
  return requestWithRefresh<MessageListResponse>('GET', `/messages?limit=${limit}`)
}

export async function markMessageRead(messageId: string): Promise<ApiResult<MessageReadResponse>> {
  return requestWithRefresh<MessageReadResponse>(
    'POST',
    `/messages/${encodeURIComponent(messageId)}/read`,
  )
}

export async function markAllMessagesRead(): Promise<ApiResult<MessageReadResponse>> {
  return requestWithRefresh<MessageReadResponse>('POST', '/messages/read-all')
}

export async function connectMessageStream(
  onEvent: (event: MessageStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (
    typeof window === 'undefined' ||
    !window.authAPI?.startMessageStream ||
    !window.authAPI?.stopMessageStream ||
    !window.authAPI?.onMessageStreamSnapshot ||
    !window.authAPI?.onMessageStreamState
  ) {
    throw new Error('message_stream_unavailable')
  }

  let disconnectReason: string | undefined
  let sawSnapshot = false
  const unsubscribeSnapshot = window.authAPI.onMessageStreamSnapshot(payload => {
    sawSnapshot = true
    onEvent({ type: 'snapshot', payload })
  })
  const unsubscribeState = window.authAPI.onMessageStreamState(({ connected, reason }) => {
    if (!connected) {
      disconnectReason = reason
    }
  })

  const stopStream = () => {
    void window.authAPI.stopMessageStream().catch(() => {})
  }

  signal?.addEventListener('abort', stopStream, { once: true })
  try {
    const result = await window.authAPI.startMessageStream()
    if (signal?.aborted) {
      return
    }

    if (!result.success) {
      throw new Error(result.error || disconnectReason || 'message_stream_start_failed')
    }

    if (!sawSnapshot && disconnectReason) {
      throw new Error(disconnectReason)
    }
  } finally {
    signal?.removeEventListener('abort', stopStream)
    unsubscribeSnapshot()
    unsubscribeState()
  }
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
