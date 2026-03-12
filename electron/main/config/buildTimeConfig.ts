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

  try {
    const fs = require('fs')
    const path = require('path')
    let configPath: string

    if (process.resourcesPath) {
      configPath = path.join(process.resourcesPath, 'build-config.json')
    } else if (process.cwd) {
      configPath = path.join(process.cwd(), 'build-config.json')
    } else {
      return defaultConfig
    }

    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8')
      const config = JSON.parse(content) as BuildTimeConfig
      cachedConfig = config
      return config
    }
  } catch (err) {
    console.warn('[buildTimeConfig] Failed to load build-config.json:', err)
  }

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
