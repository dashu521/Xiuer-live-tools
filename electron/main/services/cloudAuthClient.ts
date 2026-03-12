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
  const url = getAuthApiBaseUrl()
  console.log('[cloudAuthClient] getBaseUrl() returning:', url)
  return url
}

/** 登录/注册接口路径（服务端无 /auth 前缀）：base + 本路径 = 如 http://121.41.179.197:8000/login */
const AUTH_ENDPOINTS = {
  login: '/login',
  register: '/register',
} as const

/** 服务端 refresh/me 等均在根路径，无 /auth 前缀 */
function getAuthPathPrefix(): string {
  return ''
}

/** 对 responseData 脱敏：含 password/token/secret 的键替换为 *** */
function maskResponseData(data: unknown): unknown {
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
        out[k] = maskResponseData(v)
      }
    }
    return out
  }
  if (Array.isArray(data)) return data.map(maskResponseData)
  return data
}

/** 统一鉴权请求日志：requestId、URL、method、脱敏 body、status、responseData（脱敏） */
function logAuthCall(
  requestId: string,
  method: string,
  url: string,
  bodySanitized: string | undefined,
  status: number,
  responseData: unknown,
): void {
  console.log('[AUTH-AUDIT]', {
    requestId,
    method,
    url,
    body: bodySanitized ?? '(no body)',
    status,
    responseData: maskResponseData(responseData),
    timestamp: new Date().toISOString(),
  })
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
  const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  const base = getBaseUrl()
  if (!base) {
    return { status: 0, error: { code: 'invalid_params', message: 'AUTH_API_BASE_URL 未配置' } }
  }
  const url = `${base}${path}`
  const bodyForLog =
    options.body && typeof options.body === 'object'
      ? JSON.stringify({
          ...options.body,
          password: (options.body as { password?: string }).password
            ? '***'
            : (options.body as { password?: string }).password,
        })
      : undefined
  console.log(
    '[AUTH-AUDIT] BEFORE',
    requestId,
    method,
    url,
    bodyForLog ?? '(no body)',
    new Date().toISOString(),
  )
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`
  }
  const startMs = Date.now()
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
    const durationMs = Date.now() - startMs
    let json: T | { detail?: unknown } | null = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      // ignore
    }
    const responseData = json ?? (text || null)
    logAuthCall(requestId, method, url, bodyForLog, res.status, responseData)
    console.log('[AUTH-AUDIT] AFTER', requestId, res.status, `${durationMs}ms`)
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
    const durationMs = Date.now() - startMs
    const message = err instanceof Error ? err.message : String(err)
    const errName = err instanceof Error ? err.name : 'Error'
    logAuthCall(requestId, method, url, bodyForLog, 0, { error: errName, message })
    console.log('[AUTH-AUDIT] NETWORK_ERROR', requestId, errName, message, `${durationMs}ms`)
    return {
      status: 0,
      error: { code: 'network_error', message },
      requestUrl: url,
      responseDetail: message,
    }
  }
}

/** 后端 /register 实际返回：200 + { user, access_token, refresh_token }（无 success 字段） */
export async function cloudRegister(
  identifier: string,
  password: string,
): Promise<{
  success: boolean
  user?: CloudAuthResponse['user']
  access_token?: string
  refresh_token?: string
  error?: string
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
      error: error?.message ?? '注册失败',
      requestUrl,
      status,
      responseDetail,
    }
  }
  // 成功条件：status==200 且返回了 access_token（后端返回 user + access_token + refresh_token）
  const hasToken = data != null && !!(data as Partial<CloudAuthResponse>).access_token
  const ok = status === 200 && hasToken
  if (!ok) {
    return {
      success: false,
      error: '注册失败',
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

/** 后端 /login 实际返回：200 + { token: "..." }，字段名为 token 非 access_token */
type LoginBackendResponse = { token?: string }

export async function cloudLogin(
  identifier: string,
  password: string,
): Promise<{
  success: boolean
  user?: CloudAuthResponse['user']
  access_token?: string
  refresh_token?: string
  error?: string
  requestUrl?: string
  status?: number
  responseDetail?: string
}> {
  const base = getBaseUrl()
  const loginUrl = `${base}${AUTH_ENDPOINTS.login}`
  console.log('[cloudAuthClient] cloudLogin called')
  console.log('[cloudAuthClient] identifier:', identifier)
  console.log('[cloudAuthClient] final login URL:', loginUrl)
  
  const { data, status, error, requestUrl, responseDetail } = await request<
    LoginBackendResponse & Partial<CloudAuthResponse>
  >('POST', AUTH_ENDPOINTS.login, { body: { username: identifier, password } })
  
  console.log('[cloudAuthClient] login response status:', status)
  console.log('[cloudAuthClient] login response error:', error?.message)
  console.log('[cloudAuthClient] login responseDetail:', responseDetail)
  
  if (error) {
    // 保留完整的错误信息，以便上层判断错误类型
    const errorMessage = error?.message ?? responseDetail ?? '登录失败'
    return {
      success: false,
      error: errorMessage,
      requestUrl,
      status,
      responseDetail: responseDetail || errorMessage,
    }
  }
  // 成功条件与后端一致：status==200 且 res.data.token 存在
  const token =
    data != null
      ? ((data as LoginBackendResponse).token ?? (data as CloudAuthResponse).access_token)
      : undefined
  const ok = status === 200 && data != null && !!token
  if (!ok) {
    return {
      success: false,
      error: '登录失败',
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
  error?: string
}> {
  const prefix = getAuthPathPrefix()
  const { data, error } = await request<CloudRefreshResponse>('POST', `${prefix}/refresh`, {
    body: { refresh_token: refreshToken },
  })
  if (error || !data) {
    return { success: false, error: error?.message ?? 'refresh 失败' }
  }
  return { success: true, access_token: data.access_token }
}

export async function cloudMe(accessToken: string): Promise<{
  success: boolean
  user?: CloudMeResponse['user']
  subscription?: CloudMeResponse['subscription']
  error?: string
}> {
  const { data, status, error } = await request<CloudMeResponse>('GET', '/me', {
    accessToken: accessToken,
  })
  if (status === 401 || error || !data) {
    return {
      success: false,
      error: error?.message ?? 'token 失效',
    }
  }
  return {
    success: true,
    user: data.user,
    subscription: data.subscription,
  }
}
