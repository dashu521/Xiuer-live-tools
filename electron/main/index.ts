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

// 【修复】同步导入 app.ts，确保主进程入口不会提前退出
// 原写法 `void import('./app')` 丢弃 Promise，导致打包后主进程过早退出
// 同步导入确保 app.ts 的顶层代码立即执行，包括 startup.log 写入和 app.whenReady() 注册
import './app'
