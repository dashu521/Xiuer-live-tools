/**
 * 直播数据导出 IPC 处理
 */

import fs from 'node:fs'
import path from 'node:path'
import { app, shell } from 'electron'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { typedIpcMainHandle } from '#/utils'

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

// 格式化时长文本
function _formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}小时${minutes}分${secs}秒`
  }
  if (minutes > 0) {
    return `${minutes}分${secs}秒`
  }
  return `${secs}秒`
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

// 安全的文件名清理函数
function sanitizeFilename(name: string): string {
  // 替换 Windows 非法字符和路径遍历
  return name
    .replace(/[<>"/\\|?*]/g, '_')  // Windows 非法字符
    .replace(/\.{2,}/g, '_')        // 路径遍历 ..
    .replace(/^\.+/, '_')           // 隐藏文件 .
}

// 验证文件路径是否在目标目录内
function validateFilePath(filePath: string, baseDir: string): void {
  const resolvedFilePath = path.resolve(filePath)
  const resolvedBaseDir = path.resolve(baseDir)
  if (!resolvedFilePath.startsWith(resolvedBaseDir + path.sep)) {
    throw new Error('Invalid file path: path traversal detected')
  }
}

// 导出数据到 Excel
async function exportToExcel(data: LiveStatsExportData): Promise<string> {
  const { Workbook } = await import('exceljs')

  const exportFolder = getExportFolder()
  const dateTimeStr = formatDateTime(data.endTime)
  const safeAccountName = sanitizeFilename(data.accountName || '未知账号')
  const fileName = `直播数据_${safeAccountName}_${dateTimeStr}.xlsx`
  const filePath = path.join(exportFolder, fileName)

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
  typedIpcMainHandle(IPC_CHANNELS.liveStats.exportData, async (_, data: LiveStatsExportData) => {
    try {
      const filePath = await exportToExcel(data)
      return { success: true, filePath }
    } catch (error) {
      console.error('[LiveStats] Export failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '导出失败',
      }
    }
  })

  // 打开导出目录
  typedIpcMainHandle(IPC_CHANNELS.liveStats.openExportFolder, () => {
    const exportFolder = getExportFolder()
    shell.openPath(exportFolder)
  })
}
