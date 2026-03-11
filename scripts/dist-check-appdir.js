/**
 * 打包前环境校验：确认 electron-builder 的 appDir 下 node_modules 及主进程 external 依赖存在。
 * 在 npm run dist 中于 electron-builder 前执行；缺失则中断打包。
 */
const fs = require('fs')
const path = require('path')

const appDir = process.cwd()
const nodeModulesDir = path.join(appDir, 'node_modules')
const bcryptjsPkg = path.join(appDir, 'node_modules', 'bcryptjs', 'package.json')

const hasNodeModules = fs.existsSync(nodeModulesDir)
const hasBcryptjs = fs.existsSync(bcryptjsPkg)

console.log('--- electron-builder appDir 校验 ---')
console.log('AppDir (cwd):', appDir)
console.log('node_modules 存在:', hasNodeModules)
console.log('node_modules/bcryptjs/package.json 存在:', hasBcryptjs)
console.log('-----------------------------------')

if (!hasBcryptjs) {
  console.error('FATAL: node_modules/bcryptjs/package.json 不存在，主进程 require("bcryptjs") 将失败。请先执行 npm install。')
  process.exit(1)
}

console.log('校验通过，继续打包。')
