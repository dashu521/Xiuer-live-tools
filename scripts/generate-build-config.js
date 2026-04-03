#!/usr/bin/env node
/**
 * 构建时配置生成脚本
 * 在打包前运行，将环境变量写入 build-config.json
 * 主进程在运行时读取此配置文件
 *
 * 正式规则：
 * - VITE_AUTH_API_BASE_URL 必须为 https://auth.xiuer.work
 * - AUTH_STORAGE_SECRET 必须存在且长度 >= 32
 */

const fs = require('fs')
const path = require('path')

const PRODUCTION_API = 'https://auth.xiuer.work'

function validateApiUrl(url) {
  if (!url) {
    return { valid: false, reason: 'VITE_AUTH_API_BASE_URL 未设置' }
  }
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return { valid: false, reason: `VITE_AUTH_API_BASE_URL 不能为本地地址，当前值: ${url}` }
  }
  if (url !== PRODUCTION_API) {
    return { valid: false, reason: `VITE_AUTH_API_BASE_URL 必须精确为 ${PRODUCTION_API}，当前值: ${url}` }
  }
  return { valid: true }
}

function validateSecret(secret) {
  if (!secret) {
    return { valid: false, reason: 'AUTH_STORAGE_SECRET 未设置' }
  }
  const trimmed = secret.trim()
  if (trimmed.length < 32) {
    return { valid: false, reason: `AUTH_STORAGE_SECRET 长度不足 32 字符，当前长度: ${trimmed.length}` }
  }
  return { valid: true, value: trimmed }
}

function main() {
  console.log('\n🔧 [generate-build-config] Generating build-time configuration...\n')

  const authApiBaseUrl = process.env.VITE_AUTH_API_BASE_URL || process.env.AUTH_API_BASE_URL
  const authStorageSecret = process.env.AUTH_STORAGE_SECRET

  const urlValidation = validateApiUrl(authApiBaseUrl)
  if (!urlValidation.valid) {
    console.error(`❌ [generate-build-config] ERROR: ${urlValidation.reason}`)
    console.error(`   正确用法：export VITE_AUTH_API_BASE_URL=${PRODUCTION_API}`)
    console.error(`   生产构建禁止使用 localhost/127.0.0.1`)
    process.exit(1)
  }

  const secretValidation = validateSecret(authStorageSecret)
  if (!secretValidation.valid) {
    console.error(`❌ [generate-build-config] ERROR: ${secretValidation.reason}`)
    console.error('   正确用法：export AUTH_STORAGE_SECRET=$(openssl rand -hex 32)')
    console.error('   生产构建必须使用长度 >= 32 的高熵随机字符串')
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
  console.log(`   AUTH_STORAGE_SECRET: [set, length=${secretValidation.value.length}]`)
  console.log(`   Build Time: ${config.buildTime}\n`)
}

main()
