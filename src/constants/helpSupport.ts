/**
 * 帮助与支持：FAQ 文案与联系方式（集中管理，便于后续修改）
 * 不引入后端，仅前端展示。
 */

/** 支持邮箱 */
export const SUPPORT_EMAIL = '276976379@qq.com'

/** 软件名，用于「添加微信时请备注」提示 */
export const SUPPORT_PRODUCT_NAME = '秀儿直播助手'

/**
 * 微信二维码图片路径（对应 public/support-wechat-qr.png）。
 * 使用 BASE_URL 保证开发与打包后均能正确加载（file:// 协议下绝对路径 / 会解析到系统根目录）。
 */
export const WECHAT_QR_IMAGE_PATH = `${import.meta.env.BASE_URL}support-wechat-qr.png`

export interface FaqItem {
  question: string
  answer: string
}

/** 常见问题列表（仅展示，不搜索） */
export const HELP_FAQ_ITEMS: FaqItem[] = [
  {
    question: '登录失败怎么办？',
    answer: '请确认账号与密码正确，检查网络连接后重试。若多次失败，可尝试「忘记密码」或联系支持。',
  },
  {
    question: '忘记密码怎么办？',
    answer: '请通过登录页的「忘记密码」入口按提示找回；若无法找回，请联系支持重置。',
  },
  {
    question: '网络异常时无法登录怎么办？',
    answer: '请检查本机网络与防火墙设置，确认可访问鉴权服务后重试；必要时切换网络环境再试。',
  },
  {
    question: '试用或订阅到期会发生什么？',
    answer: '到期后部分功能将受限或不可用，需续费或重新订阅后恢复；具体以产品说明为准。',
  },
  {
    question: '如何联系支持？',
    answer: '可通过下方邮箱或微信联系支持，添加微信时请备注软件名与问题简述以便更快处理。',
  },
]
