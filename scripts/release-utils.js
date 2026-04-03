#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
}

const VALID_REPO_SLUGS = ['Xiuer-Chinese/Xiuer-live-tools', 'dashu521/Xiuer-live-tools']

function exec(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe', ...options }).trim()
  } catch (error) {
    if (options.ignoreError) return ''
    throw error
  }
}

function execWithOutput(command, options = {}) {
  return execSync(command, { encoding: 'utf-8', stdio: 'inherit', ...options })
}

function getVersion() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
  return packageJson.version
}

function getTagName(version = getVersion()) {
  return `v${version}`
}

function getOriginUrl() {
  return exec('git remote get-url origin', { ignoreError: true })
}

function getRepoWebUrl() {
  const originUrl = getOriginUrl()
  const matchedSlug = VALID_REPO_SLUGS.find(slug => originUrl.includes(slug)) || VALID_REPO_SLUGS[0]
  return `https://github.com/${matchedSlug}`
}

function getReleaseNotesPath(version = getVersion()) {
  return path.join('release-notes', `v${version}.md`)
}

function getReleaseAssets(tagName = getTagName()) {
  try {
    const assetsJson = exec(`gh release view ${tagName} --json assets,isDraft,name,tagName,url`)
    const data = JSON.parse(assetsJson)
    const assets = data.assets || []
    return {
      exists: true,
      isDraft: Boolean(data.isDraft),
      name: data.name,
      tagName: data.tagName,
      url: data.url,
      assets,
      assetNames: assets.map(asset => asset.name),
    }
  } catch (error) {
    return {
      exists: false,
      error: error.message,
      isDraft: false,
      name: null,
      tagName,
      url: null,
      assets: [],
      assetNames: [],
    }
  }
}

function getBuildWindowsStatus(tagName = getTagName()) {
  try {
    const runsJson = exec(
      'gh run list --workflow "Build Windows" --json databaseId,status,conclusion,headBranch,createdAt,url --limit 10',
    )
    const runs = JSON.parse(runsJson)
    const run = runs.find(item => item.headBranch === tagName)
    if (!run) {
      return { found: false, status: null, conclusion: null, databaseId: null, url: null }
    }
    return {
      found: true,
      status: run.status,
      conclusion: run.conclusion,
      databaseId: run.databaseId,
      url: run.url,
    }
  } catch (error) {
    return {
      found: false,
      status: null,
      conclusion: null,
      databaseId: null,
      url: null,
      error: error.message,
    }
  }
}

function getLatestUploadMacOssRun() {
  try {
    const runsJson = exec(
      'gh run list --workflow "Upload Mac to OSS" --limit 5 --json databaseId,status,conclusion,createdAt,url,event',
    )
    const runs = JSON.parse(runsJson)
    return runs[0] || null
  } catch {
    return null
  }
}

function triggerUploadMacOss(version = getVersion()) {
  exec(`gh workflow run "Upload Mac to OSS" -f version=${version}`)
}

function waitForRun(databaseId) {
  execWithOutput(`gh run watch ${databaseId} --exit-status`)
}

function ensureMacOssSynced(version = getVersion(), log = console.log) {
  const latestRun = getLatestUploadMacOssRun()

  if (latestRun && latestRun.status === 'in_progress') {
    log(`等待现有 Mac OSS 同步任务完成: ${latestRun.url}`)
    waitForRun(latestRun.databaseId)
    return latestRun
  }

  triggerUploadMacOss(version)

  let triggeredRun = null
  const startedAt = Date.now()
  while (Date.now() - startedAt < 30000) {
    triggeredRun = getLatestUploadMacOssRun()
    if (
      triggeredRun &&
      (triggeredRun.status === 'queued' || triggeredRun.status === 'in_progress')
    ) {
      break
    }
    exec('sleep 2')
  }

  if (!triggeredRun) {
    throw new Error('已触发 Upload Mac to OSS，但未能在 30 秒内定位到 workflow run')
  }

  log(`等待 Mac OSS 同步完成: ${triggeredRun.url}`)
  waitForRun(triggeredRun.databaseId)
  return triggeredRun
}

function checkMacCdnSync() {
  try {
    exec('node scripts/verify-mac-cdn.js')
    return { ok: true, error: null }
  } catch (error) {
    const output = error.stdout || error.stderr || error.message
    return {
      ok: false,
      error: String(output).trim() || error.message,
    }
  }
}

function getLocalMacArtifacts(version = getVersion()) {
  const releaseDir = path.join('release', version)
  if (!fs.existsSync(releaseDir)) {
    return []
  }

  const artifacts = []
  const patterns = [/_macos_arm64\.dmg$/, /_macos_x64\.dmg$/, /latest-mac\.yml$/, /\.blockmap$/]

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scanDir(fullPath)
      } else if (entry.isFile()) {
        if (patterns.some(pattern => pattern.test(entry.name))) {
          artifacts.push(fullPath)
        }
      }
    }
  }

  scanDir(releaseDir)
  return artifacts
}

function summarizeReleaseAssets(assetNames) {
  const has = name => assetNames.includes(name)
  const includes = suffix => assetNames.some(name => name.endsWith(suffix))

  return {
    windowsExe: includes('.exe') && !assetNames.some(name => name.includes('default')),
    windowsZip: includes('.zip'),
    latestYml: has('latest.yml'),
    macDmg: includes('.dmg'),
    latestMacYml: has('latest-mac.yml'),
    blockmap: includes('.blockmap'),
  }
}

module.exports = {
  colors,
  exec,
  execWithOutput,
  getVersion,
  getTagName,
  getOriginUrl,
  getRepoWebUrl,
  getReleaseNotesPath,
  getReleaseAssets,
  getBuildWindowsStatus,
  getLatestUploadMacOssRun,
  triggerUploadMacOss,
  waitForRun,
  ensureMacOssSynced,
  checkMacCdnSync,
  getLocalMacArtifacts,
  summarizeReleaseAssets,
}
