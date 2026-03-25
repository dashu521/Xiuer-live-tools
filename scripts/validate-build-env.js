#!/usr/bin/env node
/**
 * 生产构建环境变量预检脚本
 * 在任何 npm build / dist / release 命令之前调用
 * 确保生产环境变量已正确设置，任何不合格直接 exit 1
 */

const PRODUCTION_API = 'http://121.41.179.197:8000'

function validate() {
  const apiBaseUrl = process.env.VITE_AUTH_API_BASE_URL
  const authStorageSecret = process.env.AUTH_STORAGE_SECRET

  const errors = []

  if (!apiBaseUrl) {
    errors.push(`VITE_AUTH_API_BASE_URL 未设置（必须为 ${PRODUCTION_API} 或 HTTPS 生产地址）`)
  } else if (
    apiBaseUrl.includes('localhost') ||
    apiBaseUrl.includes('127.0.0.1') ||
    (apiBaseUrl !== PRODUCTION_API && !apiBaseUrl.startsWith('https://'))
  ) {
    errors.push(`VITE_AUTH_API_BASE_URL 不能为本地地址: "${apiBaseUrl}"`)
  }

  if (!authStorageSecret) {
    errors.push('AUTH_STORAGE_SECRET 未设置（必须为长度 >= 32 的高熵随机字符串）')
  } else if (authStorageSecret.trim().length < 32) {
    errors.push(`AUTH_STORAGE_SECRET 长度不足: ${authStorageSecret.trim().length} < 32`)
  }

  if (errors.length > 0) {
    console.error('\n❌ [validate-build-env] 生产构建环境变量校验失败:\n')
    errors.forEach((e) => console.error('  - ' + e))
    console.error('\n正确用法:')
    console.error(`  export VITE_AUTH_API_BASE_URL=${PRODUCTION_API}`)
    console.error('  export AUTH_STORAGE_SECRET=$(openssl rand -hex 32)')
    console.error('')
    process.exit(1)
  }

  console.log(`✅ [validate-build-env] 环境变量校验通过`)
  console.log(`   VITE_AUTH_API_BASE_URL=${apiBaseUrl}`)
  console.log(`   AUTH_STORAGE_SECRET=[set, length=${authStorageSecret.trim().length}]`)
  console.log('')
}

validate()
