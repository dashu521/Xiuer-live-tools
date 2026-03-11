/**
 * 最小 Smoke Test：打包后启动 exe，约 3 秒内检查主进程存活（可选检查窗口调试日志）。
 * 需先执行 npm run dist 或 build-exe 生成 release/<version>/ 下的 exe。
 * 使用方式：TASI_DEBUG=1 可让主进程写窗口日志；TASI_SMOKE_SILENT=1 仅检查进程存活不读日志。
 */
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const releaseDir = path.join(__dirname, '..', 'release')
const silent = process.env.TASI_SMOKE_SILENT === '1'
const debugLog = process.env.TASI_DEBUG === '1'

function findExe() {
  if (!fs.existsSync(releaseDir)) {
    console.error('release/ 目录不存在，请先执行 npm run dist 或 build-exe')
    process.exit(1)
  }
  const versions = fs.readdirSync(releaseDir).filter(f => {
    const p = path.join(releaseDir, f)
    return fs.statSync(p).isDirectory()
  })
  if (versions.length === 0) {
    console.error('release/ 下无版本目录')
    process.exit(1)
  }
  const latest = versions.sort().reverse()[0]
  const dir = path.join(releaseDir, latest)
  const files = fs.readdirSync(dir)
  const exe = files.find(f => f.endsWith('.exe'))
  if (!exe) {
    console.error('未找到 .exe，目录:', dir)
    process.exit(1)
  }
  return path.join(dir, exe)
}

const exePath = findExe()
console.log('启动:', exePath)

const env = { ...process.env }
if (debugLog) env.TASI_DEBUG = '1'

const child = spawn(exePath, [], { env, detached: true, stdio: 'ignore' })
child.unref()

const timeout = 3500
const start = Date.now()

function check() {
  try {
    process.kill(child.pid, 0)
  } catch (_) {
    console.error('主进程已退出，Smoke 失败')
    process.exit(1)
  }
  if (Date.now() - start >= timeout) {
    try { process.kill(child.pid, 'SIGTERM') } catch (_) {}
    console.log('Smoke 通过: 主进程 PID 存活超过', timeout / 1000, '秒')
    if (!silent && debugLog) {
      const logPath = path.join(process.env.TEMP || require('os').tmpdir(), 'tasi-window-debug.txt')
      if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf8')
        const hasReady = /ready-to-show/.test(content)
        console.log('窗口调试日志存在，含 ready-to-show:', hasReady)
      }
    }
    process.exit(0)
  }
  setTimeout(check, 200)
}
setTimeout(check, 500)
