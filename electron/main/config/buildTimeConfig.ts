import { app } from 'electron'

export interface BuildTimeConfig {
  authApiBaseUrl: string
}

let cachedConfig: BuildTimeConfig | null = null
const PRODUCTION_AUTH_API_BASE_URL = 'http://121.41.179.197:8000'
const DEVELOPMENT_AUTH_API_BASE_URL = 'http://localhost:8000'

export function getBuildTimeConfig(): BuildTimeConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  const defaultConfig: BuildTimeConfig = {
    authApiBaseUrl: app?.isPackaged ? PRODUCTION_AUTH_API_BASE_URL : DEVELOPMENT_AUTH_API_BASE_URL,
  }

  if (typeof process === 'undefined') {
    return defaultConfig
  }

  const authApiBaseUrl = process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL

  if (authApiBaseUrl) {
    cachedConfig = { authApiBaseUrl }
    return cachedConfig
  }

  const fs = require('node:fs') as typeof import('fs')
  const path = require('node:path') as typeof import('path')

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
  // 【修复】增加 trim() 处理，避免前后空格导致 URL 解析失败
  let url = config.authApiBaseUrl.trim().replace(/\/$/, '')

  if (url?.includes(':8080')) {
    url = url.replace(/:8080(\/|$)/, ':8000$1')
  }

  if (app?.isPackaged && (url.includes('localhost') || url.includes('127.0.0.1'))) {
    throw new Error(`Packaged auth API base URL cannot use local address, got: ${url}`)
  }

  return url
}
