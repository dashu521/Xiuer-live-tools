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
    console.warn('[buildTimeConfig] process is undefined, using default')
    return defaultConfig
  }

  console.log('[buildTimeConfig] app.isPackaged:', app?.isPackaged)
  console.log('[buildTimeConfig] process.resourcesPath:', process.resourcesPath)

  const authApiBaseUrl =
    process.env.AUTH_API_BASE_URL ??
    process.env.VITE_AUTH_API_BASE_URL

  if (authApiBaseUrl) {
    cachedConfig = { authApiBaseUrl }
    console.log('[buildTimeConfig] Using environment variable:', authApiBaseUrl)
    return cachedConfig
  }

  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')

  if (app?.isPackaged && process.resourcesPath) {
    const asarPath = path.join(process.resourcesPath, 'app.asar')
    const asarInternalPath = 'dist-electron/build-config.json'
    
    console.log('[buildTimeConfig] asarPath:', asarPath)
    console.log('[buildTimeConfig] asarInternalPath:', asarInternalPath)

    try {
      const asar = require('@electron/asar')
      console.log('[buildTimeConfig] @electron/asar module loaded')
      
      const content = asar.extractFile(asarPath, asarInternalPath)
      if (content) {
        const config = JSON.parse(content.toString()) as BuildTimeConfig
        cachedConfig = config
        console.log('[buildTimeConfig] Loaded from asar via @electron/asar:', config.authApiBaseUrl)
        return config
      }
    } catch (err) {
      console.warn('[buildTimeConfig] @electron/asar extractFile failed:', err)
    }

    try {
      const directPath = path.join(asarPath, asarInternalPath)
      console.log('[buildTimeConfig] Trying direct read:', directPath)
      const content = fs.readFileSync(directPath, 'utf-8')
      const config = JSON.parse(content) as BuildTimeConfig
      cachedConfig = config
      console.log('[buildTimeConfig] Loaded via direct fs.readFileSync:', config.authApiBaseUrl)
      return config
    } catch (err) {
      console.warn('[buildTimeConfig] Direct fs.readFileSync failed:', err)
    }

    const externalPath = path.join(process.resourcesPath, 'build-config.json')
    console.log('[buildTimeConfig] Trying external path:', externalPath)
    try {
      const content = fs.readFileSync(externalPath, 'utf-8')
      const config = JSON.parse(content) as BuildTimeConfig
      cachedConfig = config
      console.log('[buildTimeConfig] Loaded from external path:', config.authApiBaseUrl)
      return config
    } catch (err) {
      console.warn('[buildTimeConfig] External path read failed:', err)
    }
  } else {
    const devPath = path.join(process.cwd(), 'dist-electron', 'build-config.json')
    console.log('[buildTimeConfig] Development mode, trying:', devPath)
    try {
      const content = fs.readFileSync(devPath, 'utf-8')
      const config = JSON.parse(content) as BuildTimeConfig
      cachedConfig = config
      console.log('[buildTimeConfig] Loaded from development path:', config.authApiBaseUrl)
      return config
    } catch (err) {
      console.warn('[buildTimeConfig] Development path read failed:', err)
    }
  }

  console.warn('[buildTimeConfig] All attempts failed, using default:', defaultConfig.authApiBaseUrl)
  return defaultConfig
}

export function getAuthApiBaseUrl(): string {
  const config = getBuildTimeConfig()
  let url = config.authApiBaseUrl.replace(/\/$/, '')
  
  if (url?.includes(':8080')) {
    url = url.replace(/:8080(\/|$)/, ':8000$1')
    console.warn('[buildTimeConfig] 认证 API 应在 8000 端口，已自动将 8080 纠正为 8000')
  }
  
  console.log('[buildTimeConfig] getAuthApiBaseUrl returning:', url)
  return url
}
