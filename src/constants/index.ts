/**
 * 全局常量定义
 */

// 自动回复相关常量
export const AUTO_REPLY = {
  /** 最大评论数限制 */
  MAX_COMMENTS: 500,
  /** 最大回复数限制 */
  MAX_REPLIES: 500,
  /** 平台侧可发送的最大回复长度 */
  MAX_SEND_LENGTH: 50,
  /** 用户可补充的默认提示词 */
  DEFAULT_USER_PROMPT: '',
  /** 旧版默认提示词，用于兼容历史配置 */
  LEGACY_USER_PROMPT:
    '你是一个直播间的助手，负责回复观众的评论。请用简短友好的语气回复，不要超过50个字。',
  /** 用户名占位符 */
  USERNAME_PLACEHOLDER: '{用户名}',
} as const

// Toast 提示相关常量
export const TOAST = {
  /** 同时显示的最大 toast 数量 */
  LIMIT: 3,
  /** toast 自动移除的延迟时间（毫秒） */
  REMOVE_DELAY: 3000,
} as const

// 响应式断点常量
export const BREAKPOINTS = {
  /** 移动端断点（像素） */
  MOBILE: 768,
} as const
