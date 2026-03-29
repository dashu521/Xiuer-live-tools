/**
 * [SECURITY-FIX] 直播数据导出 IPC 处理
 * 修复内容：
 * 1. 使用安全路径解析，防止目录逃逸
 * 2. 文件名白名单清洗
 * 3. 校验 resolvedPath 必须位于 baseDir 内
 */

import fs from 'node:fs'
import path from 'node:path'
import { app, shell } from 'electron'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { typedIpcMainHandle } from '#/utils'
// [SECURITY-FIX] 引入安全路径工具
import { resolveSafePath } from '#/utils/securityValidators'

// 导出数据结构（与渲染进程保持一致）
interface LiveStatsExportData {
  accountName: string
  startTime: number | null
  endTime: number
  duration: number
  stats: {
    likeCount: number
    commentCount: number
    enterCount: number
    followCount: number
    fansClubCount: number
    orderCount: number
    paidOrderCount: number
    brandVipCount: number
  }
  danmuList: Array<{
    nickName: string
    content: string
    time: string
  }>
  fansClubChanges: Array<{
    id: string
    nickName: string
    userId?: string
    content?: string
    time: string
  }>
  events: Array<{
    id: string
    type: string
    nickName: string
    userId?: string
    content?: string
    time: string
    extra?: Record<string, unknown>
  }>
}

type LiveStatsExportFormat = 'csv' | 'excel'

// 获取导出目录
function getExportFolder(): string {
  const documentsPath = app.getPath('documents')
  const exportFolder = path.join(documentsPath, 'TASI直播数据')

  // 确保目录存在
  if (!fs.existsSync(exportFolder)) {
    fs.mkdirSync(exportFolder, { recursive: true })
  }

  return exportFolder
}

// 格式化日期时间用于文件名
function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
}

/**
 * [SECURITY-FIX] 安全文件名生成
 * 1. 白名单清洗：只保留安全字符
 * 2. 限制长度
 * 3. 防止空文件名
 */
function sanitizeFileName(input: string): string {
  // 只保留字母、数字、中文、下划线、连字符、点、空格
  const sanitized = input.replace(/[^a-zA-Z0-9\u4e00-\u9fa5._\- ]/g, '_')
  // 限制长度
  const truncated = sanitized.slice(0, 100)
  // 防止空文件名
  return truncated || 'unknown'
}

const COMMENT_TYPES = new Set([
  'comment',
  'wechat_channel_live_msg',
  'xiaohongshu_comment',
  'taobao_comment',
])

interface UserBehaviorRow {
  user_id: string
  enter_time: string
  has_comment: boolean
  comment_text: string
  comment_count: number
  has_follow: boolean
  has_order: boolean
  order_time: string
  comment_type: string
}

function buildUserBehaviorRows(events: LiveStatsExportData['events']): UserBehaviorRow[] {
  const userMap = new Map<
    string,
    {
      userId: string
      enterTime: string
      comments: { text: string; type: string }[]
      hasFollow: boolean
      hasOrder: boolean
      orderTime: string
    }
  >()

  for (const ev of events) {
    const key = ev.userId || ev.nickName
    let u = userMap.get(key)
    if (!u) {
      u = {
        userId: key,
        enterTime: '',
        comments: [],
        hasFollow: false,
        hasOrder: false,
        orderTime: '',
      }
      userMap.set(key, u)
    }

    if (ev.type === 'room_enter') {
      if (!u.enterTime || ev.time < u.enterTime) u.enterTime = ev.time
    } else if (COMMENT_TYPES.has(ev.type)) {
      u.comments.push({ text: ev.content || '', type: ev.type })
    } else if (ev.type === 'room_follow') {
      u.hasFollow = true
    } else if (ev.type === 'live_order') {
      u.hasOrder = true
      if (!u.orderTime) {
        const ts = ev.extra?.orderTs as number | undefined
        u.orderTime = typeof ts === 'number' ? new Date(ts).toLocaleString('zh-CN') : ev.time
      }
    }
  }

  return Array.from(userMap.entries()).map(([, u]) => ({
    user_id: u.userId,
    enter_time: u.enterTime,
    has_comment: u.comments.length > 0,
    comment_text: u.comments.map(c => c.text).join(' | '),
    comment_count: u.comments.length,
    has_follow: u.hasFollow,
    has_order: u.hasOrder,
    order_time: u.hasOrder ? u.orderTime : '',
    comment_type: u.comments[0]?.type ?? '',
  }))
}

// 验证文件路径是否在目标目录内
function validateFilePath(filePath: string, baseDir: string): void {
  const resolvedFilePath = path.resolve(filePath)
  const resolvedBaseDir = path.resolve(baseDir)
  if (!resolvedFilePath.startsWith(resolvedBaseDir + path.sep)) {
    throw new Error('Invalid file path: path traversal detected')
  }
}

function toCsvCell(value: string | number | boolean | null | undefined): string {
  const normalized = value == null ? '' : String(value)
  const escaped = normalized.replace(/"/g, '""')
  return `"${escaped}"`
}

function buildCsvRow(values: Array<string | number | boolean | null | undefined>): string {
  return values.map(toCsvCell).join(',')
}

async function exportToCsv(data: LiveStatsExportData): Promise<string> {
  const exportFolder = getExportFolder()
  const dateTimeStr = formatDateTime(data.endTime)
  const safeAccountName = sanitizeFileName(data.accountName || '未知账号')
  const fileName = `直播数据_${safeAccountName}_${dateTimeStr}.csv`
  const pathValidation = resolveSafePath(exportFolder, fileName)
  if (!pathValidation.valid) {
    throw new Error(`Invalid file path: ${pathValidation.error}`)
  }
  const filePath = pathValidation.fullPath!
  validateFilePath(filePath, exportFolder)

  const rows: string[] = []
  rows.push('\uFEFF')

  rows.push('概览')
  rows.push(buildCsvRow(['账号', data.accountName]))
  rows.push(
    buildCsvRow([
      '开始时间',
      data.startTime ? new Date(data.startTime).toLocaleString('zh-CN') : '',
    ]),
  )
  rows.push(buildCsvRow(['结束时间', new Date(data.endTime).toLocaleString('zh-CN')]))
  rows.push(buildCsvRow(['监控时长(秒)', data.duration]))
  rows.push(buildCsvRow(['点赞', data.stats.likeCount]))
  rows.push(buildCsvRow(['弹幕', data.stats.commentCount]))
  rows.push(buildCsvRow(['进入直播间', data.stats.enterCount]))
  rows.push(buildCsvRow(['新增关注', data.stats.followCount]))
  rows.push(buildCsvRow(['粉丝团', data.stats.fansClubCount]))
  rows.push(buildCsvRow(['品牌会员', data.stats.brandVipCount]))
  rows.push(buildCsvRow(['订单', data.stats.orderCount]))
  rows.push(buildCsvRow(['已付款订单', data.stats.paidOrderCount]))
  rows.push('')

  rows.push('弹幕明细')
  rows.push(buildCsvRow(['时间', '昵称', '内容']))
  for (const item of data.danmuList) {
    rows.push(buildCsvRow([item.time, item.nickName, item.content]))
  }
  rows.push('')

  rows.push('粉丝团变化')
  rows.push(buildCsvRow(['时间', '昵称', '用户ID', '内容']))
  for (const item of data.fansClubChanges) {
    rows.push(buildCsvRow([item.time, item.nickName, item.userId, item.content]))
  }
  rows.push('')

  rows.push('事件时间线')
  rows.push(buildCsvRow(['时间', '事件类型', '昵称', '用户ID', '内容', '附加信息']))
  for (const item of data.events) {
    rows.push(
      buildCsvRow([
        item.time,
        item.type,
        item.nickName,
        item.userId,
        item.content,
        item.extra ? JSON.stringify(item.extra) : '',
      ]),
    )
  }

  fs.writeFileSync(filePath, rows.join('\n'), 'utf8')
  return filePath
}

// 导出数据到 Excel
async function exportToExcel(data: LiveStatsExportData): Promise<string> {
  const { Workbook } = await import('exceljs')

  const exportFolder = getExportFolder()
  const dateTimeStr = formatDateTime(data.endTime)

  // [SECURITY-FIX] 使用安全文件名生成
  const safeAccountName = sanitizeFileName(data.accountName || '未知账号')
  const fileName = `直播数据_${safeAccountName}_${dateTimeStr}.xlsx`

  // [SECURITY-FIX] 安全路径解析，防止目录逃逸
  const pathValidation = resolveSafePath(exportFolder, fileName)
  if (!pathValidation.valid) {
    throw new Error(`Invalid file path: ${pathValidation.error}`)
  }
  const filePath = pathValidation.fullPath!

  // 验证文件路径，防止目录遍历攻击
  validateFilePath(filePath, exportFolder)

  const allRows = buildUserBehaviorRows(data.events)
  const cols = [18, 20, 10, 40, 12, 10, 10, 20, 20]

  const workbook = new Workbook()
  workbook.creator = 'TASI'
  workbook.created = new Date()

  const addSheet = (
    name: string,
    columnWidths: number[],
    rows: Array<Array<string | number | boolean>>,
  ) => {
    const sheet = workbook.addWorksheet(name)
    sheet.addRows(rows)
    sheet.columns = columnWidths.map(width => ({ width }))
    return sheet
  }

  const header = [
    'user_id',
    'enter_time',
    'has_comment',
    'comment_text',
    'comment_count',
    'has_follow',
    'has_order',
    'order_time',
    'comment_type',
  ]

  // Sheet1: 用户行为明细-全量
  addSheet('用户行为明细-全量', cols, [
    header,
    ...allRows.map(r => [
      r.user_id,
      r.enter_time,
      r.has_comment,
      r.comment_text,
      r.comment_count,
      r.has_follow,
      r.has_order,
      r.order_time,
      r.comment_type,
    ]),
  ])

  // Sheet2: 已下单用户
  const sheet2Rows = allRows.filter(r => r.has_order)
  addSheet('已下单用户', cols, [
    header,
    ...sheet2Rows.map(r => [
      r.user_id,
      r.enter_time,
      r.has_comment,
      r.comment_text,
      r.comment_count,
      r.has_follow,
      r.has_order,
      r.order_time,
      r.comment_type,
    ]),
  ])

  // Sheet3: 有评论未下单
  const sheet3Rows = allRows.filter(r => r.has_comment && !r.has_order)
  addSheet('有评论未下单', cols, [
    header,
    ...sheet3Rows.map(r => [
      r.user_id,
      r.enter_time,
      r.has_comment,
      r.comment_text,
      r.comment_count,
      r.has_follow,
      r.has_order,
      r.order_time,
      r.comment_type,
    ]),
  ])

  // Sheet4: 已关注未下单
  const sheet4Rows = allRows.filter(r => r.has_follow && !r.has_order)
  addSheet('已关注未下单', cols, [
    header,
    ...sheet4Rows.map(r => [
      r.user_id,
      r.enter_time,
      r.has_comment,
      r.comment_text,
      r.comment_count,
      r.has_follow,
      r.has_order,
      r.order_time,
      r.comment_type,
    ]),
  ])

  // Sheet5: 高意向未成交（规则版）
  const sheet5Rows = allRows.filter(r => (r.comment_count >= 1 || r.has_follow) && !r.has_order)
  addSheet('高意向未成交', cols, [
    header,
    ...sheet5Rows.map(r => [
      r.user_id,
      r.enter_time,
      r.has_comment,
      r.comment_text,
      r.comment_count,
      r.has_follow,
      r.has_order,
      r.order_time,
      r.comment_type,
    ]),
  ])

  // Sheet6: 行为构成汇总（仅进入=有进入且无评论/关注/成交；其他为各自维度计数）
  const onlyEnter = allRows.filter(
    r => r.enter_time && !r.has_comment && !r.has_follow && !r.has_order,
  ).length
  const hasComment = allRows.filter(r => r.has_comment).length
  const hasFollow = allRows.filter(r => r.has_follow).length
  const hasOrder = allRows.filter(r => r.has_order).length
  const sheet6Data = [
    ['行为类型', '用户数'],
    ['仅进入', onlyEnter],
    ['有评论', hasComment],
    ['有关注', hasFollow],
    ['有成交', hasOrder],
  ]
  addSheet('行为构成汇总', [15, 12], sheet6Data)

  // Sheet7: 评论 × 成交
  const ccOrder = allRows.filter(r => r.has_comment && r.has_order).length
  const ccNoOrder = allRows.filter(r => r.has_comment && !r.has_order).length
  const noCOrder = allRows.filter(r => !r.has_comment && r.has_order).length
  const noCNoOrder = allRows.filter(r => !r.has_comment && !r.has_order).length
  const sheet7Data = [
    ['has_comment \\ has_order', '已下单', '未下单'],
    ['有评论', ccOrder, ccNoOrder],
    ['无评论', noCOrder, noCNoOrder],
  ]
  addSheet('评论×成交', [18, 12, 12], sheet7Data)

  // Sheet8: 关注 × 成交
  const cfOrder = allRows.filter(r => r.has_follow && r.has_order).length
  const cfNoOrder = allRows.filter(r => r.has_follow && !r.has_order).length
  const noFOrder = allRows.filter(r => !r.has_follow && r.has_order).length
  const noFNoOrder = allRows.filter(r => !r.has_follow && !r.has_order).length
  const sheet8Data = [
    ['has_follow \\ has_order', '已下单', '未下单'],
    ['有关注', cfOrder, cfNoOrder],
    ['无关注', noFOrder, noFNoOrder],
  ]
  addSheet('关注×成交', [18, 12, 12], sheet8Data)

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  fs.writeFileSync(filePath, buffer)
  return filePath
}

export function setupLiveStatsIpcHandlers() {
  // 导出数据
  typedIpcMainHandle(
    IPC_CHANNELS.liveStats.exportData,
    async (_, payload: { data: LiveStatsExportData; format?: LiveStatsExportFormat }) => {
      const format = payload.format || 'csv'
      const data = payload.data
      try {
        const filePath = format === 'excel' ? await exportToExcel(data) : await exportToCsv(data)
        return { success: true, filePath }
      } catch (error) {
        console.error('[LiveStats] Export failed:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '导出失败',
        }
      }
    },
  )

  // 打开导出目录
  typedIpcMainHandle(IPC_CHANNELS.liveStats.openExportFolder, () => {
    const exportFolder = getExportFolder()
    shell.openPath(exportFolder)
  })
}
