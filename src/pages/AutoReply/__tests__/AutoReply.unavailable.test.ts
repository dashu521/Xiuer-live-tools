import { describe, expect, it } from 'vitest'
import { getAutoReplyUnavailableState } from '../index'

describe('AutoReply unavailable state', () => {
  it('returns guidance when platform is missing', () => {
    expect(getAutoReplyUnavailableState(null)).toEqual({
      title: '请先选择直播平台',
      description:
        '自动回复需要先在直播控制台选择平台并建立连接。选择支持的平台后，这里会显示评论监听和回复预览。',
    })
  })

  it('returns platform-specific unsupported message', () => {
    const state = getAutoReplyUnavailableState('pgy')
    expect(state.title).toBe('当前平台暂不支持自动回复')
    expect(state.description).toContain('小红书蒲公英')
  })
})
