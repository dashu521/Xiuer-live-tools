/**
 * 主进程内云 Auth API 客户端：register / login / refresh / me，401 时自动 refresh 并重试一次
 * 基准地址来自 buildTimeConfig 或环境变量，路径仅 /login、/register（无 /auth 前缀）
 */
import type {
  CloudAuthResponse,
  CloudErrorDetail,
  CloudMeResponse,
  CloudRefreshResponse,
} from '../../../src/types/auth'
import { getAuthApiBaseUrl } from '../config/buildTimeConfig'

const getBaseUrl = (): string => {
  return getAuthApiBaseUrl()
}

const AUTH_ENDPOINTS = {
  login: '/login',
  register: '/register',
} as const

function getAuthPathPrefix(): string {
  return ''
}

function _maskResponseData(data: unknown): unknown {
  if (data === null || data === undefined) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(data)) {
      const keyLower = k.toLowerCase()
      if (
        keyLower.includes('password') ||
        keyLower.includes('token') ||
        keyLower.includes('secret') ||
        keyLower.includes('refresh')
      ) {
        out[k] = '***'
      } else {
        out[k] = _maskResponseData(v)
      }
    }
    return out
  }
  if (Array.isArray(data)) return data.map(_maskResponseData)
  return data
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: object; accessToken?: string } = {},
): Promise<{
  data?: T
  status: number
  error?: CloudErrorDetail
  requestUrl?: string
  responseDetail?: string
}> {
  const base = getBaseUrl()
  if (!base) {
    return { status: 0, error: { code: 'invalid_params', message: 'AUTH_API_BASE_URL 未配置' } }
  }
  const url = `${base}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`
  }
  const doFetch = async (): Promise<Response> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })
      clearTimeout(timeout)
      return res
    } catch (e) {
      clearTimeout(timeout)
      throw e
    }
  }
  try {
    let res: Response
    try {
      res = await doFetch()
    } catch (firstErr) {
      const msg = firstErr instanceof Error ? firstErr.message : String(firstErr)
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('ECONNREFUSED')) {
        await new Promise(r => setTimeout(r, 1500))
        res = await doFetch()
      } else {
        throw firstErr
      }
    }
    const text = await res.text()
    let json: T | { detail?: unknown } | null = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      // ignore
    }
    if (!res.ok) {
      const rawDetail =
        json && typeof json === 'object' && 'detail' in json ? json.detail : undefined
      const responseDetail =
        typeof rawDetail === 'string'
          ? rawDetail
          : Array.isArray(rawDetail) && rawDetail.length > 0
            ? rawDetail
                .map(
                  (d: { msg?: string; message?: string }) =>
                    d?.msg ?? d?.message ?? JSON.stringify(d),
                )
                .join('; ')
            : rawDetail !== null && typeof rawDetail === 'object'
              ? ((rawDetail as { message?: string }).message ?? JSON.stringify(rawDetail))
              : text || res.statusText
      return {
        status: res.status,
        error:
          typeof rawDetail === 'object' && rawDetail && 'code' in rawDetail
            ? (rawDetail as CloudErrorDetail)
            : { code: 'request_failed', message: text || res.statusText },
        requestUrl: url,
        responseDetail,
      }
    }
    return { data: json as T, status: res.status }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      status: 0,
      error: { code: 'network_error', message },
      requestUrl: url,
      responseDetail: message,
    }
  }
}

export async function cloudRegister(
  identifier: string,
  password: string,
): Promise<{
  success: boolean
  user?: CloudAuthResponse['user']
  access_token?: string
  refresh_token?: string
  error?: CloudErrorDetail
  requestUrl?: string
  status?: number
  responseDetail?: string
}> {
  const { data, status, error, requestUrl, responseDetail } = await request<
    Partial<CloudAuthResponse>
  >('POST', AUTH_ENDPOINTS.register, { body: { username: identifier, password } })
  if (error) {
    return {
      success: false,
      error,
      requestUrl,
      status,
      responseDetail,
    }
  }
  const hasToken = data != null && !!(data as Partial<CloudAuthResponse>).access_token
  const ok = status === 200 && hasToken
  if (!ok) {
    return {
      success: false,
      error: { code: 'register_failed', message: '注册失败' },
      requestUrl,
      status,
      responseDetail,
    }
  }
  return {
    success: true,
    user: data?.user,
    access_token: data?.access_token,
    refresh_token: data?.refresh_token,
  }
}

type LoginBackendResponse = { token?: string }

export async function cloudLogin(
  identifier: string,
  password: string,
): Promise<{
  success: boolean
  user?: CloudAuthResponse['user']
  access_token?: string
  refresh_token?: string
  error?: CloudErrorDetail
  requestUrl?: string
  status?: number
  responseDetail?: string
}> {
  const { data, status, error, requestUrl, responseDetail } = await request<
    LoginBackendResponse & Partial<CloudAuthResponse>
  >('POST', AUTH_ENDPOINTS.login, { body: { username: identifier, password } })

  if (error) {
    return {
      success: false,
      error,
      requestUrl,
      status,
      responseDetail: responseDetail || error.message,
    }
  }
  const token =
    data != null
      ? ((data as LoginBackendResponse).token ?? (data as CloudAuthResponse).access_token)
      : undefined
  const ok = status === 200 && data != null && !!token
  if (!ok) {
    return {
      success: false,
      error: { code: 'login_failed', message: '登录失败' },
      requestUrl,
      status,
      responseDetail,
    }
  }
  return {
    success: true,
    user: (data as Partial<CloudAuthResponse>).user,
    access_token: token,
    refresh_token: (data as Partial<CloudAuthResponse>).refresh_token,
  }
}

export async function cloudRefresh(refreshToken: string): Promise<{
  success: boolean
  access_token?: string
  error?: CloudErrorDetail
}> {
  const prefix = getAuthPathPrefix()
  const { data, error } = await request<CloudRefreshResponse>('POST', `${prefix}/refresh`, {
    body: { refresh_token: refreshToken },
  })
  if (error || !data) {
    return { success: false, error: error ?? { code: 'refresh_failed', message: 'refresh 失败' } }
  }
  return { success: true, access_token: data.access_token }
}

export async function cloudMe(accessToken: string): Promise<{
  success: boolean
  user?: CloudMeResponse['user']
  subscription?: CloudMeResponse['subscription']
  error?: CloudErrorDetail
}> {
  const { data, status, error } = await request<CloudMeResponse>('GET', '/me', {
    accessToken: accessToken,
  })
  if (status === 401 || error || !data) {
    return {
      success: false,
      error: error ?? { code: 'token_invalid', message: 'token 失效' },
    }
  }
  return {
    success: true,
    user: data.user,
    subscription: data.subscription,
  }
}

/**
 * 手机验证码登录
 * 后端端点: POST /auth/sms/login?phone=xxx&code=xxx
 * 后端返回: { user, token, refresh_token, needs_password } - 注意是 token 不是 access_token
 */
export async function cloudSmsLogin(
  phone: string,
  code: string,
): Promise<{
  success: boolean
  user?: CloudAuthResponse['user']
  access_token?: string
  refresh_token?: string
  needs_password?: boolean
  error?: CloudErrorDetail
  status?: number
  responseDetail?: string
}> {
  const prefix = getAuthPathPrefix()
  const url = `${prefix}/auth/sms/login?phone=${encodeURIComponent(phone)}&code=${encodeURIComponent(code)}`

  console.log('[cloudSmsLogin] 开始请求:', {
    action: 'cloudSmsLogin',
    phoneSuffix: phone.slice(-4),
    codeLength: code.length,
    method: 'POST',
    url: url,
    paramType: 'query',
  })

  const { data, status, error, responseDetail } = await request<{
    user: CloudAuthResponse['user']
    token: string
    refresh_token?: string
    needs_password?: boolean
  }>('POST', url)

  console.log('[cloudSmsLogin] 后端响应:', {
    status,
    hasData: !!data,
    hasToken: !!data?.token,
    hasRefreshToken: !!data?.refresh_token,
    hasUser: !!data?.user,
    needsPassword: data?.needs_password,
    error: error?.message,
    responseDetail,
  })

  if (error) {
    console.error('[cloudSmsLogin] 请求失败:', error?.message, responseDetail)
    return {
      success: false,
      error,
      status,
      responseDetail: responseDetail || error.message,
    }
  }

  // [FIX] 后端返回的是 token，不是 access_token
  const ok = status === 200 && data != null && !!data.token
  if (!ok) {
    console.error('[cloudSmsLogin] 响应数据不完整:', {
      status,
      hasData: !!data,
      hasToken: !!data?.token,
    })
    return {
      success: false,
      error: { code: 'sms_login_failed', message: responseDetail || '验证码登录失败（响应数据不完整）' },
      status,
      responseDetail,
    }
  }

  console.log('[cloudSmsLogin] 登录成功, token已获取')

  return {
    success: true,
    user: data.user,
    access_token: data.token, // [FIX] 后端返回 token，映射到 access_token
    refresh_token: data.refresh_token,
    needs_password: data.needs_password,
  }
}
