/**
 * ============================================================================
 * Mock 数据生成工具（仅用于测试平台）
 * ============================================================================
 *
 * 【重要说明】
 * - 此文件包含 Mock 数据生成函数，用于测试平台（DevPlatform）
 * - 仅在测试平台（platform === 'dev'）时使用
 * - 生产环境不会调用此函数
 *
 * 【存档说明】
 * - 此文件是"可复现的稳定版本"的一部分，包含测试代码
 * - 测试平台通过平台选择机制隔离，不会在生产环境启用
 * ============================================================================
 */

/**
 * 生成随机的抖音直播消息（Mock 数据）
 *
 * @returns 随机生成的 DouyinLiveMessage 对象
 *
 * @remarks
 * - 仅用于测试平台的功能验证
 * - 生成的消息类型包括：评论、进入直播间、点赞、下单等
 * - 生产环境不会使用此函数
 */
export function getRandomDouyinLiveMessage(): DouyinLiveMessage {
  const now = new Date().toISOString()
  const msg_id = Math.random().toString(36).substring(2, 10)
  const nick_name = ['小红', '大壮', '用户123', '测试用户', '阿狸'][Math.floor(Math.random() * 5)]
  const user_id = Math.floor(Math.random() * 1000000).toString()
  const contentSamples = ['你好主播！', '真好看！', '已下单', '冲鸭', '关注了~']

  const types = [
    'comment',
    'room_enter',
    'room_like',
    'live_order',
    'subscribe_merchant_brand_vip',
    'room_follow',
    'ecom_fansclub_participate',
  ] as const

  const msg_type = types[Math.floor(Math.random() * types.length)]

  switch (msg_type) {
    case 'comment':
      return {
        time: now,
        msg_type,
        msg_id,
        nick_name,
        content: contentSamples[Math.floor(Math.random() * contentSamples.length)],
      }
    case 'room_enter':
      return {
        time: now,
        msg_type,
        msg_id,
        nick_name,
        user_id,
      }
    case 'room_like':
      return {
        time: now,
        msg_type,
        msg_id,
        nick_name,
        user_id,
      }
    case 'subscribe_merchant_brand_vip':
      return {
        time: now,
        msg_type,
        msg_id,
        nick_name,
        user_id,
        content: '开通了品牌会员！',
      }
    case 'room_follow':
      return {
        time: now,
        msg_type,
        msg_id,
        nick_name,
        user_id,
      }
    case 'ecom_fansclub_participate':
      return {
        time: now,
        msg_type,
        msg_id,
        nick_name,
        user_id,
        content: '加入粉丝团',
      }
    case 'live_order':
      return {
        time: now,
        msg_type,
        msg_id,
        nick_name,
        order_status: (['已下单', '已付款', '未知状态'] as const)[Math.floor(Math.random() * 3)],
        order_ts: Date.now(),
        product_id: `pid_${Math.floor(Math.random() * 10000)}`,
        product_title: ['保温杯', '面膜', '美妆蛋', '手机支架'][Math.floor(Math.random() * 4)],
      }
  }
}
