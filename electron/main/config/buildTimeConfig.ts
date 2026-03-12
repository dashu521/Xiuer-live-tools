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
    console.log('[buildTimeConfig] Using environment variable:', authApiBaseUrl)
    return cachedConfig
  }

  try {
    const fs = require('fs') as typeof import('fs')
    const path = require('path') as typeof import('path')
    
    let configPath: string | null = null

    if (app?.isPackaged && process.resourcesPath) {
      configPath = path.join(process.resourcesPath, 'app.asar', 'dist-electron', 'build-config.json')
      if (!fs.existsSync(configPath)) {
        configPath = path.join(process.resourcesPath, 'build-config.json')
      }
    } else {
      configPath = path.join(process.cwd(), 'dist-electron', 'build-config.json')
    }

    if (configPath && fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8')
      const config = JSON.parse(content) as BuildTimeConfig
      cachedConfig = config
      console.log('[buildTimeConfig] Loaded from:', configPath, '=>', config.authApiBaseUrl)
      return config
    } else {
      console.warn('[buildTimeConfig] Config file not found at:', configPath)
    }
  } catch (err) {
    console.warn('[buildTimeConfig] Failed to load build-config.json:', err)
  }

  console.warn('[buildTimeConfig] Using default config:', defaultConfig.authApiBaseUrl)
  return defaultConfig
}

export function getAuthApiBaseUrl(): string {
  const config = getBuildTimeConfig()
  let url = config.authApiBaseUrl.replace(/\/$/, '')
  
  if (url?.includes(':8080')) {
    url = url.replace(/:8080(\/|$)/, ':8000$1')
    console.warn('[buildTimeConfig] 认证 API 应在 8000 端口，已自动将 8080 纠正为 8000')
  }
  
  return url
}
