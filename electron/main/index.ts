// 最早加载 .env，使主进程能读到 AUTH_API_BASE_URL 等（开发时未通过 npm script 注入时兜底）
import 'dotenv/config'

import path from 'node:path'
import { app } from 'electron'

// 打包后主进程 require 从 app.asar.unpacked/node_modules 解析（native、playwright 等 external）
const UNPACKED_EXTERNALS = new Set([
  'better-sqlite3',
  'electron-updater',
  'playwright',
  'playwright-core',
  'playwright-extra',
  'playwright-extra-plugin-stealth',
  'puppeteer-extra-plugin-stealth',
])
if (app?.isPackaged && process.resourcesPath) {
  const Mod = require('node:module') as { prototype: { require: (id: string) => unknown } }
  const unpackedNodeModules = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules')
  const originalRequire = Mod.prototype.require
  Mod.prototype.require = function (id: string) {
    if (UNPACKED_EXTERNALS.has(id)) {
      return originalRequire.call(this, path.join(unpackedNodeModules, id))
    }
    return originalRequire.call(this, id)
  }
}

if (typeof process.setSourceMapsEnabled === 'function') {
  process.setSourceMapsEnabled(true)
}

// 崩溃处理在 app.ts 中统一处理，避免重复注册
void import('./app')
