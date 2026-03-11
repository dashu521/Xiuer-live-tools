import { contextBridge, ipcRenderer } from 'electron'
import type { User } from '../../src/types/auth'

export interface AuthTokens {
  token: string | null
  refreshToken: string | null
}

export const authAPI = {
  // Authentication
  register: async (data: {
    username: string
    email: string
    password: string
    confirmPassword: string
  }) => {
    // 使用真实后端（IPC）
    return await ipcRenderer.invoke('auth:register', data)
  },

  login: async (credentials: { username: string; password: string; rememberMe?: boolean }) => {
    return await ipcRenderer.invoke('auth:login', credentials)
  },

  logout: async () => {
    return ipcRenderer.invoke('auth:logout')
  },

  validateToken: async (token: string) => {
    return ipcRenderer.invoke('auth:validateToken', token)
  },

  getCurrentUser: async (token: string) => {
    return ipcRenderer.invoke('auth:getCurrentUser', token)
  },

  /** 云鉴权：用主进程存储的 refresh_token 恢复会话（启动时调用） */
  restoreSession: async (): Promise<{
    success: boolean
    user?: Omit<User, 'passwordHash'>
    token?: string
  }> => {
    return await ipcRenderer.invoke('auth:restoreSession')
  },

  // Token 管理（安全存储在主进程）
  getTokens: async (): Promise<AuthTokens> => {
    return await ipcRenderer.invoke('auth:getTokens')
  },

  setTokens: async (tokens: AuthTokens): Promise<void> => {
    return await ipcRenderer.invoke('auth:setTokens', tokens)
  },

  clearTokens: async (): Promise<void> => {
    return await ipcRenderer.invoke('auth:clearTokens')
  },

  // Feature access
  checkFeatureAccess: (token: string, feature: string) =>
    ipcRenderer.invoke('auth:checkFeatureAccess', token, feature),

  requiresAuthentication: (feature: string) =>
    ipcRenderer.invoke('auth:requiresAuthentication', feature),

  // User management
  updateUserProfile: (token: string, data: { username?: string; email?: string }) =>
    ipcRenderer.invoke('auth:updateUserProfile', token, data),

  changePassword: (token: string, data: { currentPassword: string; newPassword: string }) =>
    ipcRenderer.invoke('auth:changePassword', token, data),

  // Events
  onAuthStateChanged: (callback: (user: User | null) => void) => {
    ipcRenderer.on('auth:stateChanged', (_, user) => callback(user))
  },

  onLoginRequired: (callback: (feature: string) => void) => {
    ipcRenderer.on('auth:loginRequired', (_, feature) => callback(feature))
  },

  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('auth:stateChanged')
    ipcRenderer.removeAllListeners('auth:loginRequired')
  },
}

contextBridge.exposeInMainWorld('authAPI', authAPI)
