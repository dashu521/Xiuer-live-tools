#!/usr/bin/env node
/**
 * 构建时配置生成脚本
 * 在打包前运行，将环境变量写入 build-config.json
 * 主进程在运行时读取此配置文件
 */

const fs = require('fs')
const path = require('path')

const PRODUCTION_API = 'http://121.41.179.197:8000'

function main() {
  console.log('\n🔧 [generate-build-config] Generating build-time configuration...\n')

  const authApiBaseUrl = process.env.VITE_AUTH_API_BASE_URL || process.env.AUTH_API_BASE_URL

  if (!authApiBaseUrl) {
    console.error('❌ [generate-build-config] ERROR: VITE_AUTH_API_BASE_URL or AUTH_API_BASE_URL must be set')
    console.error(`   Expected: ${PRODUCTION_API}`)
    console.error('   Example: export VITE_AUTH_API_BASE_URL=' + PRODUCTION_API)
    process.exit(1)
  }

  if (authApiBaseUrl.includes('localhost') || authApiBaseUrl.includes('127.0.0.1')) {
    console.error('❌ [generate-build-config] ERROR: API base URL cannot be localhost')
    console.error(`   Current: ${authApiBaseUrl}`)
    console.error(`   Expected: ${PRODUCTION_API}`)
    process.exit(1)
  }

  const config = {
    authApiBaseUrl,
    buildTime: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || 'production',
  }

  const configJson = JSON.stringify(config, null, 2)

  const distElectronDir = path.join(process.cwd(), 'dist-electron')
  if (!fs.existsSync(distElectronDir)) {
    fs.mkdirSync(distElectronDir, { recursive: true })
  }

  const configPath = path.join(distElectronDir, 'build-config.json')
  fs.writeFileSync(configPath, configJson)

  console.log('✅ [generate-build-config] Configuration generated:')
  console.log(`   Path: ${configPath}`)
  console.log(`   API Base URL: ${authApiBaseUrl}`)
  console.log(`   Build Time: ${config.buildTime}\n`)
}

main()
