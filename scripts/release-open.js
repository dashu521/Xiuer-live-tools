#!/usr/bin/env node

const fs = require('fs')
const {
  colors,
  exec,
  getVersion,
  getTagName,
  getReleaseNotesPath,
  getReleaseAssets,
  getRepoWebUrl,
} = require('./release-utils')

function logPass(message) {
  console.log(`${colors.green}✅ PASS${colors.reset} ${message}`)
}

function logFail(message) {
  console.log(`${colors.red}❌ FAIL${colors.reset} ${message}`)
}

function logInfo(message) {
  console.log(`${colors.blue}ℹ️  INFO${colors.reset} ${message}`)
}

function main() {
  console.log(`${colors.bold}`)
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║              🏷️  打开发布汇总点                            ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log(`${colors.reset}\n`)

  const version = getVersion()
  const tagName = getTagName(version)
  const notesPath = getReleaseNotesPath(version)

  if (!fs.existsSync(notesPath)) {
    logFail(`Release Notes 不存在: ${notesPath}`)
    process.exit(1)
  }

  try {
    exec(`git rev-parse ${tagName}`)
    logPass(`Tag ${tagName} 已存在`)
  } catch {
    logFail(`Tag ${tagName} 不存在，请先执行 publish:confirm 或手动推 tag`)
    process.exit(1)
  }

  const release = getReleaseAssets(tagName)

  if (release.exists) {
    logInfo(`Release ${tagName} 已存在，更新 release notes`)
    exec(`gh release edit ${tagName} --notes-file "${notesPath}"`)
    logPass('Release Notes 已更新')
    console.log(`\nRelease URL: ${release.url || `${getRepoWebUrl()}/releases/tag/${tagName}`}`)
    return
  }

  exec(`gh release create ${tagName} --draft --title "${tagName}" --notes-file "${notesPath}"`)
  const created = getReleaseAssets(tagName)
  logPass(`Draft Release ${tagName} 已创建`)
  if (created.url) {
    console.log(`\nRelease URL: ${created.url}`)
  }
}

main()
