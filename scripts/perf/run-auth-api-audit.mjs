#!/usr/bin/env node

import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { performance } from 'node:perf_hooks'
import jsonwebtoken from 'jsonwebtoken'

const jwt = jsonwebtoken.default ?? jsonwebtoken

const ROOT = process.cwd()
const AUTH_API_DIR = path.join(ROOT, 'auth-api')
const TMP_DIR = path.join(ROOT, 'tmp', 'perf-audit')
const DB_PATH = path.join(TMP_DIR, 'auth-api-perf.sqlite3')
let port = Number(process.env.AUTH_API_AUDIT_PORT || 18080)
const PYTHON_BIN = path.join(AUTH_API_DIR, '.venv', 'bin', 'python')

const BASELINES = {
  healthBurst: { p95Ms: 60, errorRate: 0.01, throughputRps: 300 },
  statusRead: { p95Ms: 120, errorRate: 0.01, throughputRps: 120 },
  configRead: { p95Ms: 120, errorRate: 0.01, throughputRps: 120 },
  configWrite: { p95Ms: 220, errorRate: 0.02, throughputRps: 40 },
  loginBurst: { p95Ms: 450, errorRate: 0.02, throughputRps: 18 },
  mixedSoak: { p95Ms: 250, errorRate: 0.02, availability: 0.99 },
  sseFanout: { connectSuccessRate: 1, avgFirstSnapshotMs: 500, errorRate: 0.05 },
  faultInjection: { recoveryMs: 5000, availability: 0.9, errorRate: 0.25 },
}

const serverLogs = []

function getBaseUrl() {
  return `http://127.0.0.1:${port}`
}

function nowIso() {
  return new Date().toISOString()
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index]
}

function average(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits))
}

function tryStatSize(filePath) {
  try {
    return fs.statSync(filePath).size
  } catch {
    return 0
  }
}

function appendServerLog(prefix, chunk) {
  const lines = chunk
    .toString()
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(-20)

  for (const line of lines) {
    serverLogs.push(`[${prefix}] ${line}`)
    if (serverLogs.length > 300) {
      serverLogs.shift()
    }
  }
}

function sampleProcessStats(pid) {
  try {
    const output = execFileSync('ps', ['-o', 'rss=,%cpu=', '-p', String(pid)], {
      encoding: 'utf8',
    }).trim()
    if (!output) {
      return null
    }

    const parts = output.split(/\s+/)
    const rssKb = Number(parts[0])
    const cpuPercent = Number(parts[1])
    return {
      rssMb: rssKb / 1024,
      cpuPercent,
    }
  } catch {
    return null
  }
}

function startSampler(pid) {
  const samples = []
  const timer = setInterval(() => {
    const sample = sampleProcessStats(pid)
    if (sample) {
      samples.push(sample)
    }
  }, 250)

  return () => {
    clearInterval(timer)
    return {
      sampleCount: samples.length,
      avgCpuPercent: round(average(samples.map(sample => sample.cpuPercent))),
      maxCpuPercent: round(Math.max(0, ...samples.map(sample => sample.cpuPercent))),
      avgRssMb: round(average(samples.map(sample => sample.rssMb))),
      maxRssMb: round(Math.max(0, ...samples.map(sample => sample.rssMb))),
    }
  }
}

async function httpRequest({ pathName, method = 'GET', headers = {}, body, timeoutMs = 15000 }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`timeout:${timeoutMs}`)), timeoutMs)
  const requestBody =
    body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  const startedAt = performance.now()
  try {
    const response = await fetch(`${getBaseUrl()}${pathName}`, {
      method,
      headers: {
        ...(requestBody ? { 'Content-Type': 'application/json' } : {}),
        Connection: 'close',
        ...headers,
      },
      body: requestBody,
      signal: controller.signal,
    })
    const text = await response.text()
    const latencyMs = performance.now() - startedAt
    let parsed
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = null
    }
    return {
      ok: response.ok,
      status: response.status,
      latencyMs,
      bytes: Buffer.byteLength(text),
      body: parsed,
      rawBody: text,
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: performance.now() - startedAt,
      bytes: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timer)
  }
}

async function waitForHealth(timeoutMs = 20000) {
  const start = performance.now()
  while (performance.now() - start < timeoutMs) {
    const result = await httpRequest({ pathName: '/health', timeoutMs: 1000 })
    if (result.ok) {
      return true
    }
    await sleep(250)
  }
  return false
}

async function findFreePort(preferredPort) {
  return await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(preferredPort, '127.0.0.1', () => {
      const address = server.address()
      const resolvedPort = typeof address === 'object' && address ? address.port : preferredPort
      server.close(error => {
        if (error) {
          reject(error)
          return
        }
        resolve(resolvedPort)
      })
    })
  })
}

async function startServer() {
  if (!fs.existsSync(PYTHON_BIN)) {
    throw new Error(`Python 虚拟环境不存在: ${PYTHON_BIN}`)
  }

  port = await findFreePort(port)

  const child = spawn(
    PYTHON_BIN,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(port), '--workers', '1'],
    {
      cwd: AUTH_API_DIR,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        DATABASE_URL: `sqlite:///${DB_PATH}`,
        JWT_SECRET: 'perf-test-secret-012345678901234567890123',
        ADMIN_USERNAME: 'perf-admin',
        ADMIN_PASSWORD: 'perf-admin-password',
        ADMIN_JWT_SECRET: 'perf-admin-jwt-secret',
        CORS_ORIGINS: '*',
        ENV: 'development',
        SMS_MODE: 'dev',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  child.stdout.on('data', chunk => appendServerLog('stdout', chunk))
  child.stderr.on('data', chunk => appendServerLog('stderr', chunk))

  const healthy = await waitForHealth()
  if (!healthy) {
    try {
      child.kill('SIGKILL')
    } catch {}
    throw new Error(`auth-api 启动失败，最近日志:\n${serverLogs.slice(-20).join('\n')}`)
  }

  return child
}

async function stopServer(child, signal = 'SIGTERM') {
  if (!child || child.exitCode != null) {
    return
  }

  child.kill(signal)
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    sleep(3000).then(() => {
      try {
        child.kill('SIGKILL')
      } catch {}
    }),
  ])
}

function buildAuthHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  }
}

function buildAdminToken() {
  return jwt.sign(
    {
      sub: 'perf-admin',
      type: 'admin',
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    },
    'perf-admin-jwt-secret',
    { algorithm: 'HS256' },
  )
}

async function createAnnouncement(adminToken, index) {
  return httpRequest({
    pathName: '/admin/messages',
    method: 'POST',
    headers: buildAuthHeaders(adminToken),
    body: {
      title: `性能审计公告 ${index}`,
      content: `公告内容 ${index}`,
      type: 'notice',
      status: 'published',
      target_scope: 'all',
      target_value: null,
      is_pinned: index === 0,
    },
  })
}

function summarizeScenario({ name, startedAt, finishedAt, requestMetrics, samplerMetrics, dbSizeBefore, dbSizeAfter }) {
  const latencies = requestMetrics.map(metric => metric.latencyMs)
  const successCount = requestMetrics.filter(metric => metric.ok).length
  const errorCount = requestMetrics.length - successCount
  const totalBytes = requestMetrics.reduce((sum, metric) => sum + metric.bytes, 0)
  const durationMs = finishedAt - startedAt
  const throughputRps = durationMs > 0 ? (requestMetrics.length / durationMs) * 1000 : 0

  return {
    name,
    requestCount: requestMetrics.length,
    successCount,
    errorCount,
    errorRate: round(requestMetrics.length ? errorCount / requestMetrics.length : 0, 4),
    durationMs: round(durationMs),
    throughputRps: round(throughputRps),
    bytesPerSecond: round(durationMs > 0 ? totalBytes / (durationMs / 1000) : 0),
    totalBytes,
    latencyMs: {
      avg: round(average(latencies)),
      p50: round(percentile(latencies, 50)),
      p95: round(percentile(latencies, 95)),
      p99: round(percentile(latencies, 99)),
      max: round(Math.max(0, ...latencies)),
    },
    sampler: samplerMetrics,
    dbSizeBefore,
    dbSizeAfter,
    dbGrowthBytes: dbSizeAfter - dbSizeBefore,
    statusBreakdown: Object.fromEntries(
      [...new Set(requestMetrics.map(metric => metric.status))]
        .sort((a, b) => a - b)
        .map(status => [String(status), requestMetrics.filter(metric => metric.status === status).length]),
    ),
    sampleErrors: requestMetrics
      .filter(metric => !metric.ok)
      .slice(0, 5)
      .map(metric => metric.error || `HTTP ${metric.status}`),
  }
}

async function runRequestBurst({ name, concurrency, totalRequests, buildRequest, pid }) {
  const dbSizeBefore = tryStatSize(DB_PATH)
  const stopSampler = startSampler(pid)
  const requestMetrics = []
  let currentIndex = 0
  const startedAt = performance.now()

  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = currentIndex++
      if (index >= totalRequests) {
        break
      }

      const request = await buildRequest(index)
      const result = await httpRequest(request)
      requestMetrics.push(result)
    }
  })

  await Promise.all(workers)
  const finishedAt = performance.now()
  const samplerMetrics = stopSampler()
  const dbSizeAfter = tryStatSize(DB_PATH)

  return summarizeScenario({
    name,
    startedAt,
    finishedAt,
    requestMetrics,
    samplerMetrics,
    dbSizeBefore,
    dbSizeAfter,
  })
}

async function runDurationScenario({ name, concurrency, durationMs, buildRequest, pid }) {
  const dbSizeBefore = tryStatSize(DB_PATH)
  const stopSampler = startSampler(pid)
  const requestMetrics = []
  const startedAt = performance.now()
  const deadline = startedAt + durationMs

  const workers = Array.from({ length: concurrency }, async () => {
    while (performance.now() < deadline) {
      const request = await buildRequest()
      const result = await httpRequest(request)
      requestMetrics.push(result)
    }
  })

  await Promise.all(workers)
  const finishedAt = performance.now()
  const samplerMetrics = stopSampler()
  const dbSizeAfter = tryStatSize(DB_PATH)

  return summarizeScenario({
    name,
    startedAt,
    finishedAt,
    requestMetrics,
    samplerMetrics,
    dbSizeBefore,
    dbSizeAfter,
  })
}

async function parseSseStream({ token, durationMs }) {
  return await new Promise(resolve => {
    const startedAt = performance.now()
    const result = {
      ok: false,
      snapshotCount: 0,
      heartbeatCount: 0,
      firstSnapshotMs: null,
      error: null,
    }
    let buffer = ''
    let finished = false
    let closedByTest = false

    const finalize = () => {
      if (finished) {
        return
      }
      finished = true
      resolve(result)
    }

    const request = http.request(
      `${getBaseUrl()}/messages/stream`,
      {
        method: 'GET',
        headers: {
          ...buildAuthHeaders(token),
          Accept: 'text/event-stream',
          Connection: 'close',
        },
      },
      response => {
        result.ok = response.statusCode === 200
        if (!result.ok) {
          result.error = `HTTP ${response.statusCode || 0}`
          response.resume()
          finalize()
          return
        }

        response.setEncoding('utf8')
        response.on('data', chunk => {
          buffer += chunk
          const frames = buffer.split('\n\n')
          buffer = frames.pop() || ''

          for (const frame of frames) {
            const trimmed = frame.trim()
            if (!trimmed) {
              continue
            }
            if (trimmed.startsWith(':')) {
              result.heartbeatCount += 1
              continue
            }

            const eventLine = trimmed
              .split('\n')
              .find(line => line.startsWith('event:'))
            if (eventLine?.includes('snapshot')) {
              result.snapshotCount += 1
              if (result.firstSnapshotMs == null) {
                result.firstSnapshotMs = round(performance.now() - startedAt)
              }
            }
          }
        })
        response.on('error', error => {
          if (closedByTest) {
            finalize()
            return
          }
          result.error = error instanceof Error ? error.message : String(error)
          finalize()
        })
        response.on('end', finalize)
      },
    )

    request.on('error', error => {
      if (closedByTest) {
        finalize()
        return
      }
      result.error = error instanceof Error ? error.message : String(error)
      finalize()
    })
    request.setTimeout(durationMs + 1000, () => {
      request.destroy(new Error('sse_timeout'))
    })
    request.end()

    setTimeout(() => {
      closedByTest = true
      request.destroy()
      finalize()
    }, durationMs)
  })
}

async function runSseScenario({ name, clientCount, durationMs, token, adminToken, pid }) {
  const stopSampler = startSampler(pid)
  const startedAt = performance.now()

  const publishers = (async () => {
    await sleep(1000)
    await createAnnouncement(adminToken, 100)
    await sleep(1000)
    await createAnnouncement(adminToken, 101)
  })()

  const clients = await Promise.all(
    Array.from({ length: clientCount }, () => parseSseStream({ token, durationMs })),
  )

  await publishers
  const samplerMetrics = stopSampler()
  const finishedAt = performance.now()

  return {
    name,
    durationMs: round(finishedAt - startedAt),
    clientCount,
    connectSuccessRate: round(clients.filter(client => client.ok).length / clientCount, 4),
    avgFirstSnapshotMs: round(
      average(clients.map(client => client.firstSnapshotMs).filter(value => value != null)),
    ),
    avgSnapshotCount: round(average(clients.map(client => client.snapshotCount))),
    avgHeartbeatCount: round(average(clients.map(client => client.heartbeatCount))),
    errorRate: round(clients.filter(client => client.error).length / clientCount, 4),
    sampler: samplerMetrics,
    sampleErrors: clients
      .filter(client => client.error)
      .slice(0, 5)
      .map(client => client.error),
  }
}

async function runFaultInjectionScenario({ name, token, serverRef }) {
  const requestMetrics = []
  const healthTimeline = []
  const startedAt = performance.now()
  const durationMs = 8000
  const deadline = startedAt + durationMs
  let currentServer = serverRef.current

  const healthMonitor = (async () => {
    while (performance.now() < deadline + 1000) {
      const result = await httpRequest({
        pathName: '/health',
        timeoutMs: 400,
      })
      healthTimeline.push({
        atMs: round(performance.now() - startedAt),
        ok: result.ok,
      })
      await sleep(200)
    }
  })()

  const loadWorkers = Promise.all(
    Array.from({ length: 8 }, async () => {
      while (performance.now() < deadline) {
        const result = await httpRequest({
          pathName: '/status',
          headers: buildAuthHeaders(token),
          timeoutMs: 1000,
        })
        requestMetrics.push(result)
      }
    }),
  )

  await sleep(2000)
  await stopServer(currentServer, 'SIGKILL')

  await sleep(1500)
  currentServer = await startServer()
  serverRef.current = currentServer

  await Promise.all([loadWorkers, healthMonitor])
  const finishedAt = performance.now()

  const healthyAfterRestart = healthTimeline.find(point => point.atMs >= 3500 && point.ok)
  const recoveryMs = healthyAfterRestart ? healthyAfterRestart.atMs - 2000 : null

  return {
    name,
    durationMs: round(finishedAt - startedAt),
    requestCount: requestMetrics.length,
    availability: round(requestMetrics.filter(item => item.ok).length / Math.max(1, requestMetrics.length), 4),
    errorRate: round(requestMetrics.filter(item => !item.ok).length / Math.max(1, requestMetrics.length), 4),
    recoveryMs,
    sampleErrors: requestMetrics
      .filter(item => !item.ok)
      .slice(0, 5)
      .map(item => item.error || `HTTP ${item.status}`),
  }
}

function compareWithBaseline(key, scenario) {
  const baseline = BASELINES[key]
  if (!baseline) {
    return { key, passed: true, checks: [] }
  }

  const checks = []
  if ('p95Ms' in baseline && scenario.latencyMs) {
    checks.push({
      metric: 'p95Ms',
      actual: scenario.latencyMs.p95,
      target: baseline.p95Ms,
      passed: scenario.latencyMs.p95 <= baseline.p95Ms,
    })
  }
  if ('errorRate' in baseline) {
    checks.push({
      metric: 'errorRate',
      actual: scenario.errorRate,
      target: baseline.errorRate,
      passed: scenario.errorRate <= baseline.errorRate,
    })
  }
  if ('throughputRps' in baseline && 'throughputRps' in scenario) {
    checks.push({
      metric: 'throughputRps',
      actual: scenario.throughputRps,
      target: baseline.throughputRps,
      passed: scenario.throughputRps >= baseline.throughputRps,
    })
  }
  if ('availability' in baseline && 'availability' in scenario) {
    checks.push({
      metric: 'availability',
      actual: scenario.availability,
      target: baseline.availability,
      passed: scenario.availability >= baseline.availability,
    })
  }
  if ('connectSuccessRate' in baseline) {
    checks.push({
      metric: 'connectSuccessRate',
      actual: scenario.connectSuccessRate,
      target: baseline.connectSuccessRate,
      passed: scenario.connectSuccessRate >= baseline.connectSuccessRate,
    })
  }
  if ('avgFirstSnapshotMs' in baseline) {
    checks.push({
      metric: 'avgFirstSnapshotMs',
      actual: scenario.avgFirstSnapshotMs,
      target: baseline.avgFirstSnapshotMs,
      passed: scenario.avgFirstSnapshotMs <= baseline.avgFirstSnapshotMs,
    })
  }
  if ('recoveryMs' in baseline) {
    checks.push({
      metric: 'recoveryMs',
      actual: scenario.recoveryMs,
      target: baseline.recoveryMs,
      passed: scenario.recoveryMs != null && scenario.recoveryMs <= baseline.recoveryMs,
    })
  }

  return {
    key,
    passed: checks.every(check => check.passed),
    checks,
  }
}

async function main() {
  await fsp.mkdir(TMP_DIR, { recursive: true })
  await fsp.rm(DB_PATH, { force: true })

  const serverRef = { current: await startServer() }
  try {
    const seedUser = {
      username: 'perf.audit.primary@example.com',
      password: 'PerfAudit123!',
    }

    const registerResult = await httpRequest({
      pathName: '/register',
      method: 'POST',
      body: seedUser,
    })

    if (!registerResult.ok) {
      throw new Error(`种子用户注册失败: ${registerResult.rawBody || registerResult.error}`)
    }

    const accessToken = registerResult.body?.access_token
    const refreshToken = registerResult.body?.refresh_token
    if (!accessToken || !refreshToken) {
      throw new Error('种子用户未返回 access_token / refresh_token')
    }

    const adminToken = buildAdminToken()
    for (let index = 0; index < 5; index += 1) {
      await createAnnouncement(adminToken, index)
    }

    const healthBurst = await runRequestBurst({
      name: 'health-burst',
      concurrency: 50,
      totalRequests: 1500,
      pid: serverRef.current.pid,
      buildRequest: async () => ({ pathName: '/health', timeoutMs: 1000 }),
    })

    const statusRead = await runRequestBurst({
      name: 'status-read',
      concurrency: 20,
      totalRequests: 500,
      pid: serverRef.current.pid,
      buildRequest: async () => ({
        pathName: '/status',
        headers: buildAuthHeaders(accessToken),
        timeoutMs: 2000,
      }),
    })

    const configRead = await runRequestBurst({
      name: 'config-read',
      concurrency: 20,
      totalRequests: 500,
      pid: serverRef.current.pid,
      buildRequest: async () => ({
        pathName: '/config',
        headers: buildAuthHeaders(accessToken),
        timeoutMs: 2000,
      }),
    })

    const configWrite = await runRequestBurst({
      name: 'config-write',
      concurrency: 12,
      totalRequests: 240,
      pid: serverRef.current.pid,
      buildRequest: async index => ({
        pathName: '/config/sync',
        method: 'POST',
        headers: buildAuthHeaders(accessToken),
        timeoutMs: 3000,
        body: {
          config: {
            platformPreferences: {
              douyin: {
                enabled: true,
                auditBatch: index,
              },
            },
            autoReplyConfigs: {
              [`account-${index % 3}`]: {
                enabled: true,
                keywords: ['券', '链接'],
              },
            },
            autoMessageConfigs: {
              [`account-${index % 3}`]: {
                enabled: true,
                templates: [`batch-${index}`],
              },
            },
          },
        },
      }),
    })

    const loginUsers = Array.from({ length: 80 }, (_, index) => ({
      username: `perf.audit.login.${index}@example.com`,
      password: 'PerfAudit123!',
    }))

    for (const user of loginUsers) {
      const result = await httpRequest({
        pathName: '/register',
        method: 'POST',
        body: user,
      })
      if (!result.ok) {
        throw new Error(`登录压测预注册失败: ${user.username}`)
      }
    }

    const loginBurst = await runRequestBurst({
      name: 'login-burst',
      concurrency: 20,
      totalRequests: 200,
      pid: serverRef.current.pid,
      buildRequest: async index => ({
        pathName: '/login',
        method: 'POST',
        timeoutMs: 4000,
        body: loginUsers[index % loginUsers.length],
      }),
    })

    const mixedSoak = await runDurationScenario({
      name: 'mixed-soak',
      concurrency: 10,
      durationMs: 30000,
      pid: serverRef.current.pid,
      buildRequest: async () => {
        const selector = Math.random()
        if (selector < 0.4) {
          return {
            pathName: '/status',
            headers: buildAuthHeaders(accessToken),
            timeoutMs: 2000,
          }
        }
        if (selector < 0.7) {
          return {
            pathName: '/config',
            headers: buildAuthHeaders(accessToken),
            timeoutMs: 2000,
          }
        }
        return {
          pathName: '/config/sync',
          method: 'POST',
          headers: buildAuthHeaders(accessToken),
          timeoutMs: 3000,
          body: {
            config: {
              platformPreferences: {
                douyin: {
                  enabled: true,
                  soakTs: Date.now(),
                },
              },
            },
          },
        }
      },
    })

    const sseFanout = await runSseScenario({
      name: 'sse-fanout',
      clientCount: 15,
      durationMs: 6000,
      token: accessToken,
      adminToken,
      pid: serverRef.current.pid,
    })

    const faultInjection = await runFaultInjectionScenario({
      name: 'fault-injection',
      token: accessToken,
      serverRef,
    })

    const finalConfig = await httpRequest({
      pathName: '/config',
      headers: buildAuthHeaders(accessToken),
      timeoutMs: 2000,
    })

    const report = {
      generatedAt: nowIso(),
      environment: {
        baseUrl: getBaseUrl(),
        selectedPort: port,
        database: DB_PATH,
        python: PYTHON_BIN,
        node: process.version,
      },
      baselines: BASELINES,
      scenarios: {
        healthBurst,
        statusRead,
        configRead,
        configWrite,
        loginBurst,
        mixedSoak: {
          ...mixedSoak,
          availability: round(mixedSoak.successCount / Math.max(1, mixedSoak.requestCount), 4),
        },
        sseFanout,
        faultInjection,
      },
      consistencyCheck: {
        finalConfig: finalConfig.body,
        note: 'config/sync 为覆盖式写入，未携带版本号，也没有并发冲突检测；多设备同时修改时只保留最后一次成功提交的内容。',
      },
      comparisons: {
        healthBurst: compareWithBaseline('healthBurst', healthBurst),
        statusRead: compareWithBaseline('statusRead', statusRead),
        configRead: compareWithBaseline('configRead', configRead),
        configWrite: compareWithBaseline('configWrite', configWrite),
        loginBurst: compareWithBaseline('loginBurst', loginBurst),
        mixedSoak: compareWithBaseline('mixedSoak', {
          ...mixedSoak,
          availability: round(mixedSoak.successCount / Math.max(1, mixedSoak.requestCount), 4),
        }),
        sseFanout: compareWithBaseline('sseFanout', sseFanout),
        faultInjection: compareWithBaseline('faultInjection', faultInjection),
      },
      serverLogs: serverLogs.slice(-100),
    }

    const resultPath = path.join(
      TMP_DIR,
      `auth-api-audit-${report.generatedAt.replaceAll(':', '-').replaceAll('.', '-')}.json`,
    )
    await fsp.writeFile(resultPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

    const summaryRows = [
      ['health-burst', healthBurst.latencyMs.p95, healthBurst.errorRate, healthBurst.throughputRps],
      ['status-read', statusRead.latencyMs.p95, statusRead.errorRate, statusRead.throughputRps],
      ['config-read', configRead.latencyMs.p95, configRead.errorRate, configRead.throughputRps],
      ['config-write', configWrite.latencyMs.p95, configWrite.errorRate, configWrite.throughputRps],
      ['login-burst', loginBurst.latencyMs.p95, loginBurst.errorRate, loginBurst.throughputRps],
      ['mixed-soak', mixedSoak.latencyMs.p95, mixedSoak.errorRate, mixedSoak.throughputRps],
    ]

    console.log('\nAuth API Performance Audit Summary')
    console.log('scenario\tp95(ms)\terrorRate\tthroughput(rps)')
    for (const row of summaryRows) {
      console.log(`${row[0]}\t${row[1]}\t${row[2]}\t${row[3]}`)
    }
    console.log(
      `sse-fanout\tconnect=${sseFanout.connectSuccessRate}\tfirstSnapshot=${sseFanout.avgFirstSnapshotMs}ms\terrorRate=${sseFanout.errorRate}`,
    )
    console.log(
      `fault-injection\trecovery=${faultInjection.recoveryMs}ms\tavailability=${faultInjection.availability}\terrorRate=${faultInjection.errorRate}`,
    )
    console.log(`\nResult written to ${resultPath}`)
  } finally {
    await stopServer(serverRef.current)
  }
}

main().catch(error => {
  console.error('\n[run-auth-api-audit] FAILED')
  console.error(error instanceof Error ? error.stack || error.message : error)
  if (serverLogs.length) {
    console.error('\nRecent auth-api logs:')
    console.error(serverLogs.slice(-20).join('\n'))
  }
  process.exitCode = 1
})
