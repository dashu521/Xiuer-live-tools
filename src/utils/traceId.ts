/**
 * 生成 traceId，用于全链路追踪连接请求
 * 格式：t_<timestamp>_<random>
 */
export function generateTraceId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `t_${timestamp}_${random}`
}
