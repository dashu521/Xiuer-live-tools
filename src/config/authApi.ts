/**
 * Auth API 基址：与 authApiBase.ts 约定一致，渲染进程 getMe/refresh/status 等用此 base。
 * 认证服务现在通过 8080 端口对外暴露（例如 Nginx / 反向代理转发到容器内部 8000）。
 */
import { AUTH_API_BASE } from './authApiBase'

const rawBase = import.meta.env.VITE_AUTH_API_BASE_URL ?? AUTH_API_BASE

// 直接使用配置的基址（默认来自 AUTH_API_BASE），不再强制改写端口
export const API_BASE_URL = rawBase

export const isCloudAuthEnabled = (): boolean => {
  const url = import.meta.env.VITE_AUTH_API_BASE_URL ?? AUTH_API_BASE
  return typeof url === 'string' && url.length > 0
}
