/**
 * 直播流状态类型（从 shared 类型中抽离，供模块化导入）
 */
export type StreamStatus = 'unknown' | 'offline' | 'live' | 'ended'
