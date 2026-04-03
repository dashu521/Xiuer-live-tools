import { describe, expect, it } from 'vitest'
import { getAuthExpiredLoginPatterns, matchesAuthExpiredLoginPage } from '../services/authPlatform'

describe('authPlatform', () => {
  it('matches taobao login urls', () => {
    expect(
      matchesAuthExpiredLoginPage(
        'taobao',
        'https://login.taobao.com/member/login.jhtml?redirect=https%3A%2F%2Flive.taobao.com',
      ),
    ).toBe(true)
  })

  it('matches wxchannel login urls', () => {
    expect(
      matchesAuthExpiredLoginPage('wxchannel', 'https://channels.weixin.qq.com/login.html'),
    ).toBe(true)
  })

  it('returns empty patterns for unsupported platforms', () => {
    expect(getAuthExpiredLoginPatterns('dev')).toEqual([])
    expect(matchesAuthExpiredLoginPage('dev', 'https://example.com/login')).toBe(false)
  })
})
