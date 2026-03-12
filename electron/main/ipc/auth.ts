import { ipcMain } from 'electron'
import type { LoginCredentials, RegisterData, User } from '../../../src/types/auth'
import { AuthService } from '../services/AuthService'
import { clearStoredTokens, getStoredTokens, setStoredTokens } from '../services/CloudAuthStorage'
import { cloudLogin, cloudMe, cloudRefresh, cloudRegister } from '../services/cloudAuthClient'
import { cloudUserToSafeUser } from '../services/cloudAuthMappers'
import { getAuthApiBaseUrl } from '../config/buildTimeConfig'

const getEffectiveBase = (): string => {
  return getAuthApiBaseUrl()
}
const USE_CLOUD_AUTH = !!getEffectiveBase()

/** [AUTH-AUDIT] 启动时打印当前鉴权配置 */
function logAuthAuditConfig(): void {
  const base = getEffectiveBase() || '(none)'
  console.log('[AUTH-AUDIT] startup config:', {
    USE_CLOUD_AUTH,
    effectiveBase: base,
  })
}

export function setupAuthHandlers() {
  logAuthAuditConfig()
  // ----- 云鉴权：恢复会话（启动时 refresh -> me） -----
  ipcMain.handle('auth:restoreSession', async () => {
    if (!USE_CLOUD_AUTH) {
      return { success: false, user: null, token: null }
    }
    const { refresh_token } = await getStoredTokens()
    if (!refresh_token) return { success: false, user: null, token: null }
    const refreshRes = await cloudRefresh(refresh_token)
    if (!refreshRes.success || !refreshRes.access_token) {
      clearStoredTokens()
      return { success: false, user: null, token: null }
    }
    const meRes = await cloudMe(refreshRes.access_token)
    if (!meRes.success || !meRes.user) {
      return { success: false, user: null, token: null }
    }
    await setStoredTokens({
      access_token: refreshRes.access_token,
      refresh_token,
    })
    return {
      success: true,
      user: cloudUserToSafeUser(meRes.user),
      token: refreshRes.access_token,
    }
  })

  // Register
  ipcMain.handle('auth:register', async (_, data: RegisterData) => {
    if (USE_CLOUD_AUTH) {
      const identifier = (data.email || '').trim()
      if (!identifier) {
        return { success: false, error: '请输入手机号或邮箱' }
      }
      const res = await cloudRegister(identifier, data.password)
      if (!res.success) {
        return {
          success: false,
          error: res.error,
          requestUrl: res.requestUrl,
          status: res.status,
          detail: res.responseDetail,
        }
      }
      // 成功条件与后端一致：res.status==200 且 res.data.success===true；不要求 user/access_token/refresh_token 全有
      if (res.access_token && res.refresh_token) {
        await setStoredTokens({
          access_token: res.access_token,
          refresh_token: res.refresh_token,
        })
      }
      return {
        success: true,
        user: res.user ? cloudUserToSafeUser(res.user) : undefined,
        token: res.access_token,
        refresh_token: res.refresh_token,
      }
    }
    return await AuthService.register(data)
  })

  // Login
  ipcMain.handle('auth:login', async (_, credentials: LoginCredentials) => {
    console.log('[auth:login] IPC handler called')
    console.log('[auth:login] USE_CLOUD_AUTH:', USE_CLOUD_AUTH)
    console.log('[auth:login] identifier:', credentials.username)
    
    if (USE_CLOUD_AUTH) {
      const identifier = (credentials.username || '').trim()
      if (!identifier) {
        return { success: false, error: '请输入手机号或邮箱' }
      }
      console.log('[auth:login] Calling cloudLogin...')
      const res = await cloudLogin(identifier, credentials.password)
      console.log('[auth:login] cloudLogin result:', {
        success: res.success,
        status: res.status,
        hasToken: !!res.access_token,
        error: res.error
      })
      if (!res.success) {
        // 根据后端返回的错误信息判断错误类型
        let errorType: string | undefined
        // error 可能是字符串或对象 {code, message}
        const errorStr = typeof res.error === 'string' ? res.error : JSON.stringify(res.error || '')
        const errorMsg = errorStr.toLowerCase()
        const responseDetail = (res.responseDetail || '').toLowerCase()
        const combinedError = `${errorMsg} ${responseDetail}`

        // 调试日志：查看实际返回的错误信息
        console.error('[AUTH-DEBUG] Login error:', {
          status: res.status,
          error: res.error,
          errorStr,
          responseDetail: res.responseDetail,
          combinedError,
        })

        // 根据状态码和错误信息判断错误类型
        // 注意：后端对于"账号不存在"和"密码错误"都返回 401 + "Invalid credentials"
        // 所以无法准确区分，不设置具体的 errorType，让前端显示通用提示
        if (res.status === 403) {
          errorType = 'ACCOUNT_DISABLED'
        }
        // 401 错误不设置 errorType，前端会显示"账号或密码错误"并引导注册

        console.error('[AUTH-DEBUG] Determined errorType:', errorType)

        // 提取友好的错误消息
        let errorMessage: string
        if (typeof res.error === 'string') {
          errorMessage = res.error
        } else if (res.error && typeof res.error === 'object' && 'message' in res.error) {
          errorMessage = (res.error as { message: string }).message
        } else {
          errorMessage = res.responseDetail || '登录失败'
        }

        return {
          success: false,
          error: errorMessage,
          errorType,
          requestUrl: res.requestUrl,
          status: res.status,
          detail: res.responseDetail,
        }
      }
      // 成功条件与后端一致：res.status==200 且 res.data.token 存在；不要求 refresh_token/user 全有
      if (res.access_token) {
        await setStoredTokens({
          access_token: res.access_token,
          refresh_token: res.refresh_token ?? res.access_token,
        })
      }
      return {
        success: true,
        user: res.user ? cloudUserToSafeUser(res.user) : undefined,
        token: res.access_token,
        refresh_token: res.refresh_token ?? res.access_token,
      }
    }
    return await AuthService.login(credentials)
  })

  // Logout
  ipcMain.handle('auth:logout', async (_, token: string) => {
    if (USE_CLOUD_AUTH) {
      clearStoredTokens()
      return true
    }
    return await AuthService.logout(token)
  })

  // Get current user（401 时自动 refresh 并重试一次）
  ipcMain.handle('auth:getCurrentUser', async (_, token: string) => {
    if (USE_CLOUD_AUTH) {
      if (!token) return null
      let meRes = await cloudMe(token)
      if (meRes.success && meRes.user) {
        return cloudUserToSafeUser(meRes.user)
      }
      const { refresh_token } = await getStoredTokens()
      if (!refresh_token) return null
      const refreshRes = await cloudRefresh(refresh_token)
      if (!refreshRes.success || !refreshRes.access_token) return null
      meRes = await cloudMe(refreshRes.access_token)
      if (!meRes.success || !meRes.user) return null
      await setStoredTokens({
        access_token: refreshRes.access_token,
        refresh_token,
      })
      return cloudUserToSafeUser(meRes.user)
    }
    return AuthService.getCurrentUser(token)
  })

  // Validate token
  ipcMain.handle('auth:validateToken', async (_, token: string) => {
    if (USE_CLOUD_AUTH) {
      const meRes = await cloudMe(token)
      return meRes.success && meRes.user ? cloudUserToSafeUser(meRes.user) : null
    }
    return AuthService.validateToken(token)
  })

  // Check feature access（IPC 只暴露 SafeUser；本地 AuthService 返回 User 时在此映射为 SafeUser）
  ipcMain.handle('auth:checkFeatureAccess', async (_, token: string, feature: string) => {
    const rawUser = await (async () => {
      if (USE_CLOUD_AUTH && token) {
        const meRes = await cloudMe(token)
        if (meRes.success && meRes.user) return cloudUserToSafeUser(meRes.user)
      }
      if (USE_CLOUD_AUTH) return null
      return AuthService.getCurrentUser(token)
    })()
    const user: Omit<User, 'passwordHash'> | null =
      rawUser == null
        ? null
        : 'passwordHash' in rawUser
          ? AuthService.sanitizeUser(rawUser as User)
          : (rawUser as Omit<User, 'passwordHash'>)
    const requiresAuth = AuthService.requiresAuthentication(feature)
    const requiredPlan = AuthService.getRequiredPlan(feature)
    return {
      canAccess: !requiresAuth || AuthService.hasPlanLevel(user, requiredPlan),
      requiresAuth,
      requiredPlan,
      user,
    }
  })

  ipcMain.handle('auth:requiresAuthentication', async (_, feature: string) => {
    return AuthService.requiresAuthentication(feature)
  })

  ipcMain.handle('auth:updateUserProfile', async (_, _token: string, _data: unknown) => {
    return { success: false, error: '功能开发中' }
  })

  ipcMain.handle('auth:changePassword', async (_, _token: string, _data: unknown) => {
    return { success: false, error: '功能开发中' }
  })

  // [SECURITY-FIX] Token 管理接口已收紧
  // renderer 不再直接获取/设置完整 token，仅通过最小必要接口操作

  /**
   * [SECURITY] 获取认证状态摘要（最小必要信息）
   * 替代 auth:getTokens，不返回完整 token
   */
  ipcMain.handle('auth:getAuthSummary', async () => {
    const tokens = await getStoredTokens()
    // 不返回 token 内容，只返回是否存在
    return {
      isAuthenticated: !!tokens.access_token,
      hasToken: !!tokens.access_token,
    }
  })

  /**
   * [SECURITY] 内部使用：主进程代发带鉴权请求
   * renderer 提供请求配置，main 负责附加 token 并执行
   * 这是替代直接暴露 token 的安全方案
   */
  ipcMain.handle(
    'auth:proxyRequest',
    async (_, requestConfig: { endpoint: string; method?: string; body?: object }) => {
      const tokens = await getStoredTokens()
      if (!tokens.access_token) {
        return { success: false, error: 'Not authenticated' }
      }

      const base = getEffectiveBase()
      const url = `${base}${requestConfig.endpoint}`

      try {
        const res = await fetch(url, {
          method: requestConfig.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.access_token}`,
          },
          body: requestConfig.body ? JSON.stringify(requestConfig.body) : undefined,
        })

        const text = await res.text()
        let json = null
        try {
          json = text ? JSON.parse(text) : null
        } catch {
          // ignore
        }

        return {
          success: res.ok,
          status: res.status,
          data: json,
          error: res.ok ? undefined : text || res.statusText,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },
  )

  /**
   * [DEPRECATED-SECURITY] auth:getTokens 已移除
   * 原因：直接暴露完整 token 给 renderer 违反最小权限原则
   * 迁移方案：
   * - 如需检查登录状态：使用 auth:getAuthSummary
   * - 如需发起鉴权请求：使用 auth:proxyRequest（由 main 代发）
   */
  // ipcMain.handle('auth:getTokens', ... ) // REMOVED for security

  /**
   * [DEPRECATED-SECURITY] auth:setTokens 已收紧
   * 仅允许内部使用，renderer 不应直接设置 token
   * 登录/注册流程由 main 进程内部完成 token 存储
   */
  // ipcMain.handle('auth:setTokens', ... ) // REMOVED - 登录流程内部处理

  ipcMain.handle('auth:clearTokens', async () => {
    await clearStoredTokens()
  })
}
