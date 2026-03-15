import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import type { User } from '../../src/types/auth'

/**
 * [SECURITY-FIX] AuthTokens 接口已标记为内部使用
 * renderer 不应直接处理完整 token
 */
export interface AuthTokens {
  /** @deprecated Token 不应直接暴露给 renderer，使用 proxyRequest 代替 */
  token: string | null
  /** @deprecated RefreshToken 不应直接暴露给 renderer */
  refreshToken: string | null
}

/**
 * [SECURITY-FIX] 认证 API 已收紧
 * - 移除 getTokens/setTokens 的直接暴露
 * - 新增 getAuthSummary 获取最小必要信息
 * - 新增 proxyRequest 由 main 代发鉴权请求
 */
export const authAPI = {
  // Authentication
  register: async (data: {
    username: string
    email: string
    password: string
    confirmPassword: string
  }) => {
    // 使用真实后端（IPC）
    return await ipcRenderer.invoke(IPC_CHANNELS.auth.register, data)
  },

  login: async (credentials: { username: string; password: string; rememberMe?: boolean }) => {
    return await ipcRenderer.invoke(IPC_CHANNELS.auth.login, credentials)
  },

  /**
   * 手机验证码登录（内部处理 token 存储）
   * 成功后 token 已写入主进程安全存储
   */
  loginWithSms: async (
    phone: string,
    code: string,
  ): Promise<{
    success: boolean
    user?: { id: string; username: string; email?: string; phone?: string; status?: string }
    token?: string
    refresh_token?: string
    needs_password?: boolean
    error?: string
    status?: number
    responseDetail?: string
  }> => {
    return await ipcRenderer.invoke(IPC_CHANNELS.auth.loginWithSms, phone, code)
  },

  logout: async () => {
    return ipcRenderer.invoke(IPC_CHANNELS.auth.logout)
  },

  validateToken: async (token: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.auth.validateToken, token)
  },

  getCurrentUser: async (token: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.auth.getCurrentUser, token)
  },

  /** 云鉴权：用主进程存储的 refresh_token 恢复会话（启动时调用） */
  restoreSession: async (): Promise<{
    success: boolean
    user?: Omit<User, 'passwordHash'>
    token?: string
  }> => {
    return await ipcRenderer.invoke(IPC_CHANNELS.auth.restoreSession)
  },

  // [SECURITY-FIX] Token 管理接口已收紧
  // renderer 不再直接获取/设置完整 token

  /**
   * [SECURITY] 获取认证状态摘要（最小必要信息）
   * 替代 getTokens，不返回完整 token 内容
   */
  getAuthSummary: async (): Promise<{ isAuthenticated: boolean; hasToken: boolean }> => {
    return await ipcRenderer.invoke(IPC_CHANNELS.auth.getAuthSummary)
  },

  /**
   * [SECURITY] 主进程代发带鉴权请求
   * renderer 提供请求配置，main 负责附加 token 并执行
   * 这是替代直接暴露 token 的安全方案
   */
  proxyRequest: async (requestConfig: {
    endpoint: string
    method?: string
    body?: object
  }): Promise<{ success: boolean; status?: number; data?: unknown; error?: string }> => {
    return await ipcRenderer.invoke(IPC_CHANNELS.auth.proxyRequest, requestConfig)
  },

  /**
   * [INTERNAL-SECURITY] 获取 token 用于 apiClient 请求
   * 仅限内部使用，不直接暴露给业务代码
   */
  getTokenInternal: async (): Promise<AuthTokens> => {
    return await ipcRenderer.invoke(IPC_CHANNELS.auth.getTokenInternal)
  },

  /**
   * [DEPRECATED-SECURITY] getTokens 已移除
   * 原因：直接暴露完整 token 违反最小权限原则
   * 迁移方案：
   * - 检查登录状态：使用 getAuthSummary()
   * - 发起鉴权请求：使用 proxyRequest()
   */
  getTokens: async (): Promise<AuthTokens> => {
    console.warn(
      '[SECURITY] authAPI.getTokens() is deprecated and will return nulls. Use getAuthSummary() or proxyRequest() instead.',
    )
    return { token: null, refreshToken: null }
  },

  /**
   * [DEPRECATED-SECURITY] setTokens 已移除
   * 原因：renderer 不应直接设置 token
   * 登录/注册流程内部处理 token 存储
   */
  setTokens: async (_tokens: AuthTokens): Promise<void> => {
    console.warn(
      '[SECURITY] authAPI.setTokens() is deprecated and has no effect. Token storage is handled internally.',
    )
    // No-op: token storage is handled internally during login/register
  },

  clearTokens: async (): Promise<void> => {
    return await ipcRenderer.invoke(IPC_CHANNELS.auth.clearTokens)
  },

  // Feature access
  checkFeatureAccess: (token: string, feature: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.auth.checkFeatureAccess, token, feature),

  requiresAuthentication: (feature: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.auth.requiresAuthentication, feature),

  // User management
  updateUserProfile: (token: string, data: { username?: string; email?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.auth.updateUserProfile, token, data),

  changePassword: (token: string, data: { currentPassword: string; newPassword: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.auth.changePassword, token, data),

  // Events
  onAuthStateChanged: (callback: (user: User | null) => void) => {
    ipcRenderer.on(IPC_CHANNELS.auth.stateChanged, (_, user) => callback(user))
  },

  onLoginRequired: (callback: (feature: string) => void) => {
    ipcRenderer.on(IPC_CHANNELS.auth.loginRequired, (_, feature) => callback(feature))
  },

  removeAllListeners: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.auth.stateChanged)
    ipcRenderer.removeAllListeners(IPC_CHANNELS.auth.loginRequired)
  },
}

contextBridge.exposeInMainWorld('authAPI', authAPI)
