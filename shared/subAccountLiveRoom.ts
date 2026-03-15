export function normalizeSubAccountLiveRoomUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null

  const value = rawUrl.trim()
  if (!value) return null

  try {
    const url = new URL(value)
    url.hash = ''

    const host = url.hostname.toLowerCase()
    const pathname = url.pathname.replace(/\/+$/, '') || '/'

    if (host === 'live.douyin.com' || host === 'live.kuaishou.com') {
      return `${url.protocol}//${host}${pathname}`
    }

    if (pathname.includes('/live/')) {
      return `${url.protocol}//${host}${pathname}`
    }

    return `${url.protocol}//${host}${pathname}${url.search}`
  } catch {
    return null
  }
}

export function isSameSubAccountLiveRoomUrl(
  left?: string | null,
  right?: string | null,
): boolean {
  const normalizedLeft = normalizeSubAccountLiveRoomUrl(left)
  const normalizedRight = normalizeSubAccountLiveRoomUrl(right)

  if (!normalizedLeft || !normalizedRight) {
    return false
  }

  return normalizedLeft === normalizedRight
}
