import { IPC_CHANNELS } from 'shared/ipcChannels'

export interface AutoReplyExportRow {
  sessionId?: string
  sessionStartedAt?: string
  sessionEndedAt?: string
  commentId: string
  commentTime: string
  nickname: string
  commentContent: string
  replyTime?: string
  replyContent?: string
  isSent: boolean
  source: 'ai' | 'product-kb' | 'none'
  replyIntent?: string
  questionType?: string
  factStatus?: string
  guardrailAction?: string
  guardrailReason?: string
  knowledgeMissReason?: string
  matchedSlotIndex?: number
  matchedTitle?: string
  matchedFields?: string[]
}

export interface AutoReplyExportData {
  accountName: string
  exportedAt: number
  stats: {
    totalComments: number
    totalReplies: number
    sentReplies: number
    rewrittenReplies: number
  }
  rows: AutoReplyExportRow[]
}

export type AutoReplyExportFormat = 'csv' | 'json'

export async function exportAutoReplyData(
  data: AutoReplyExportData,
  format: AutoReplyExportFormat = 'csv',
): Promise<{
  success: boolean
  filePath?: string
  error?: string
}> {
  try {
    const result = await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.autoReply.exportData, {
      data,
      format,
    })
    return result
  } catch (error) {
    console.error('[ExportAutoReply] Failed to export:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '导出失败',
    }
  }
}

export async function openAutoReplyExportFolder(): Promise<void> {
  try {
    await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.autoReply.openExportFolder)
  } catch (error) {
    console.error('[ExportAutoReply] Failed to open folder:', error)
  }
}
