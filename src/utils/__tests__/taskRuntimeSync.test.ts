import { describe, expect, it } from 'vitest'
import { deriveDirectTaskRuntimeState } from '@/utils/taskRuntimeSync'

describe('deriveDirectTaskRuntimeState', () => {
  it('maps active main-process tasks to direct task running state', () => {
    expect(deriveDirectTaskRuntimeState(['auto-comment', 'auto-popup'])).toEqual({
      autoSpeakRunning: true,
      autoPopupRunning: true,
    })
  })

  it('treats missing tasks as stopped', () => {
    expect(deriveDirectTaskRuntimeState(['comment-listener'])).toEqual({
      autoSpeakRunning: false,
      autoPopupRunning: false,
    })
  })
})
