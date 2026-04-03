const AUTH_EXPIRED_LOGIN_PATTERNS: Partial<Record<LiveControlPlatform, RegExp[]>> = {
  douyin: [/passport\.jinritemai\.com/, /fxg\.jinritemai\.com\/login/],
  buyin: [/passport\.jinritemai\.com/, /buyin\.jinritemai\.com\/login/],
  eos: [/passport\.jinritemai\.com/, /compass\.jinritemai\.com\/login/],
  xiaohongshu: [/www\.xiaohongshu\.com\/login/, /ark\.xiaohongshu\.com\/login/],
  pgy: [/www\.xiaohongshu\.com\/login/, /pgy\.xiaohongshu\.com\/login/],
  wxchannel: [/channels\.weixin\.qq\.com\/login/, /mp\.weixin\.qq\.com\/login/],
  kuaishou: [/passport\.kuaishou\.com/, /live\.kuaishou\.com\/login/],
  taobao: [/login\.taobao\.com/, /login\.m\.taobao\.com/],
}

export function getAuthExpiredLoginPatterns(platform: LiveControlPlatform): RegExp[] {
  return AUTH_EXPIRED_LOGIN_PATTERNS[platform] ?? []
}

export function matchesAuthExpiredLoginPage(platform: LiveControlPlatform, url: string): boolean {
  const patterns = getAuthExpiredLoginPatterns(platform)
  return patterns.some(pattern => pattern.test(url))
}
