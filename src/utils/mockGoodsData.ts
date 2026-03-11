/**
 * ============================================================================
 * 测试商品数据（仅用于测试/开发环境）
 * ============================================================================
 *
 * 【重要说明】
 * - 此文件包含 Mock 测试数据，用于功能验证和开发调试
 * - 生产环境（production build）不会启用这些 Mock 数据
 * - 仅在以下条件下启用：
 *   1. 平台为 'dev'（测试平台）
 *   2. 开发模式（import.meta.env.DEV === true）
 *   3. 非生产模式（import.meta.env.MODE !== 'production'）
 *
 * 【存档说明】
 * - 此文件是"可复现的稳定版本"的一部分，包含测试代码
 * - 生产构建时会通过环境变量检查自动禁用 Mock 数据
 * - 如需在生产环境禁用，请确保：
 *   - Vite 构建时设置 MODE=production
 *   - 平台选择不为 'dev'
 * ============================================================================
 */

/**
 * Mock 商品 ID 列表
 * 用于测试平台或开发模式下演示自动弹窗功能
 *
 * @remarks
 * - 仅用于功能验证，不包含真实商品信息
 * - 生产环境不会使用此数据
 */
export const MOCK_GOODS_IDS: readonly number[] = [1, 2, 3, 4, 5]

/**
 * 判断是否应该启用测试商品数据
 *
 * @param platform - 当前平台标识（如 'dev', 'douyin' 等）
 * @returns 是否启用测试商品数据
 *
 * @remarks
 * - 严格的环境检查：生产环境（MODE === 'production'）始终返回 false
 * - 仅在测试平台（platform === 'dev'）或开发模式（DEV === true）时启用
 * - 此函数确保 Mock 数据不会在生产环境泄露
 */
export function shouldUseMockGoods(platform: string | undefined): boolean {
  if (!platform) {
    return false
  }

  // 正式发行版下测试平台也可用 Mock 商品，便于用户试用体验
  if (platform === 'dev') {
    return true
  }

  // 非测试平台：生产环境禁用 Mock
  const isProduction = import.meta.env.MODE === 'production'
  if (isProduction) {
    return false
  }

  // 开发模式下其他平台不启用 Mock（仅 dev 平台已在上方处理）
  const isDev = import.meta.env.DEV === true
  return isDev
}
