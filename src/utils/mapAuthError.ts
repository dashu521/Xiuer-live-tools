/**
 * 将登录/注册接口的原始错误映射为对用户友好的中文提示，不暴露状态码、英文原文、请求 URL。
 * 用于 UI 展示；原始信息仅用于开发环境「更多信息」或日志。
 */
export type AuthErrorInput =
  | {
      status?: number
      detail?: string
      requestUrl?: string
      error?: string
      responseDetail?: string
      errorType?:
        | 'USER_NOT_FOUND'
        | 'INVALID_PASSWORD'
        | 'ACCOUNT_DISABLED'
        | 'SERVER_ERROR'
        | 'UNKNOWN_ERROR'
    }
  | Error

const SMS_ERROR_MAP: Record<string, string> = {
  invalid_phone: '手机号格式不对，请检查一下',
  too_many_requests: '发送太快了，请等 1 分钟后再试',
  daily_limit_exceeded: '今天的验证码次数用完了，明天再来吧',
  too_many_failures: '验证码输错太多次，请 10 分钟后再试',
  invalid_code: '验证码不对，请重新输入',
  code_expired: '验证码过期了，点击重新获取',
  sms_send_failed: '短信发送失败，稍后再试一下',
}

/** 对象形式的鉴权错误入参，与 AuthErrorInput 的对象分支一致 */
type AuthErrorObject = Exclude<AuthErrorInput, Error>

export interface MapAuthErrorResult {
  /** 面向用户的简短中文提示，UI 直接展示 */
  userMessage: string
  /** 原始错误摘要，仅开发环境折叠展示或日志，可含 status/detail/url */
  rawForDev: string
  /** 是否显示注册引导 */
  showRegisterHint?: boolean
}

function isNetworkError(raw: AuthErrorInput): boolean {
  if (raw instanceof Error) {
    const msg = raw.message?.toLowerCase() ?? ''
    return (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('fetch') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('err_connection')
    )
  }
  const r = raw as AuthErrorObject
  if (typeof r.status === 'number' && r.status === 0) return true
  const err = String(r.error ?? r.detail ?? r.responseDetail ?? '').toLowerCase()
  return /network|timeout|fetch|failed|unreachable|refused/.test(err)
}

/**
 * 映射鉴权错误为用户文案 + 调试用原始信息。
 * 优先级：errorType => 网络/超时 => 401 => 403 禁用 => 5xx => 其它。
 */
export function mapAuthError(raw: AuthErrorInput): MapAuthErrorResult {
  // 获取 errorType（如果存在）
  const errorType = raw instanceof Error ? undefined : (raw as AuthErrorObject).errorType

  const status = raw instanceof Error ? undefined : (raw as { status?: number }).status
  const detail =
    raw instanceof Error
      ? raw.message
      : ((raw as { detail?: string }).detail ??
        (raw as { responseDetail?: string }).responseDetail ??
        (raw as { error?: string }).error ??
        '')
  const requestUrl = raw instanceof Error ? undefined : (raw as { requestUrl?: string }).requestUrl
  const detailStr = String(detail)

  // 短信相关错误优先处理
  if (detailStr in SMS_ERROR_MAP) {
    const rawForDev = requestUrl
      ? `[SMS] ${status} ${detailStr} (${requestUrl})`
      : `[SMS] ${status} ${detailStr}`
    return { userMessage: SMS_ERROR_MAP[detailStr], rawForDev }
  }

  // 根据 errorType 优先显示具体错误信息
  if (errorType) {
    const rawForDev = requestUrl
      ? `[${errorType}] ${status} ${detailStr} (${requestUrl})`
      : `[${errorType}] ${status} ${detailStr}`

    switch (errorType) {
      case 'USER_NOT_FOUND':
        return {
          userMessage: '这个手机号还没注册，请检查一下或立即注册',
          rawForDev,
          showRegisterHint: true,
        }
      case 'INVALID_PASSWORD':
        return {
          userMessage: '手机号或密码不对，再检查一下',
          rawForDev,
          showRegisterHint: true,
        }
      case 'ACCOUNT_DISABLED':
        return { userMessage: '账号已被停用，请联系客服处理', rawForDev }
      case 'SERVER_ERROR':
        return { userMessage: '服务器有点忙，稍后再试一下', rawForDev }
      default:
        break
    }
  }

  if (isNetworkError(raw)) {
    const rawForDev = raw instanceof Error ? raw.message : JSON.stringify(raw)
    return {
      userMessage: '网络连不上，检查一下网络后重试',
      rawForDev,
    }
  }

  if (status === 401) {
    const rawForDev = requestUrl ? `401 ${detailStr} (${requestUrl})` : `401 ${detailStr}`
    return {
      userMessage: '手机号或密码不对，再检查一下',
      rawForDev,
      showRegisterHint: true,
    }
  }

  if (status === 403 && /disabled|禁用|account_disabled/.test(detailStr)) {
    const rawForDev = requestUrl ? `403 ${detailStr} (${requestUrl})` : `403 ${detailStr}`
    return { userMessage: '账号已被停用，请联系客服处理', rawForDev }
  }

  if (typeof status === 'number' && status >= 500) {
    const rawForDev = requestUrl
      ? `${status} ${detailStr} (${requestUrl})`
      : `${status} ${detailStr}`
    const userMessage =
      status === 502 || status === 503 ? '服务器正在维护，稍后再试一下' : '服务器有点忙，稍后再试一下'
    return { userMessage, rawForDev }
  }

  const rawForDev =
    requestUrl && status !== undefined
      ? `${status} ${detailStr} (${requestUrl})`
      : status !== undefined
        ? `${status} ${detailStr}`
        : detailStr || 'unknown'
  return { userMessage: '登录失败了，稍后再试一下', rawForDev }
}
