import { app } from 'electron'

export interface BuildTimeConfig {
  authApiBaseUrl: string
}

let cachedConfig: BuildTimeConfig | null = null

export function getBuildTimeConfig(): BuildTimeConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  const defaultConfig: BuildTimeConfig = {
    authApiBaseUrl: 'http://localhost:8000',
  }

  if (typeof process === 'undefined') {
    return defaultConfig
  }

  const authApiBaseUrl =
    process.env.AUTH_API_BASE_URL ??
    process.env.VITE_AUTH_API_BASE_URL

  if (authApiBaseUrl) {
    cachedConfig = { authApiBaseUrl }
    return cachedConfig
  }

  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')

  if (app?.isPackaged && process.resourcesPath) {
    const asarPath = path.join(process.resourcesPath, 'app.asar')
    const asarInternalPath = 'dist-electron/build-config.json'

    try {
      const asar = require('@electron/asar')
      const content = asar.extractFile(asarPath, asarInternalPath)
      if (content) {
        const config = JSON.parse(content.toString()) as BuildTimeConfig
        cachedConfig = config
        return config
      }
    } catch {
      // asar 模块不可用，尝试其他方式
    }

    try {
      const directPath = path.join(asarPath, asarInternalPath)
      const content = fs.readFileSync(directPath, 'utf-8')
      const config = JSON.parse(content) as BuildTimeConfig
      cachedConfig = config
      return config
    } catch {
      // 直接读取失败，尝试外部路径
    }

    try {
      const externalPath = path.join(process.resourcesPath, 'build-config.json')
      const content = fs.readFileSync(externalPath, 'utf-8')
      const config = JSON.parse(content) as BuildTimeConfig
      cachedConfig = config
      return config
    } catch {
      // 外部路径也失败
    }
  } else {
    try {
      const devPath = path.join(process.cwd(), 'dist-electron', 'build-config.json')
      const content = fs.readFileSync(devPath, 'utf-8')
      const config = JSON.parse(content) as BuildTimeConfig
      cachedConfig = config
      return config
    } catch {
      // 开发模式路径失败
    }
  }

  return defaultConfig
}

export function getAuthApiBaseUrl(): string {
  const config = getBuildTimeConfig()
  let url = config.authApiBaseUrl.replace(/\/$/, '')
  
  if (url?.includes(':8080')) {
    url = url.replace(/:8080(\/|$)/, ':8000$1')
  }
  
  return url
}
