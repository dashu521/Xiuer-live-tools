/**
 * 用户友好的错误信息映射表
 *
 * 设计原则：
 * 1. 避免技术术语（如"IPC"、"Target page"、"browser context"等）
 * 2. 说明问题原因 + 提供解决方案
 * 3. 使用口语化、易懂的中文表达
 * 4. 区分错误严重程度（error/warning/info）
 */

export interface ErrorMessageConfig {
  /** 用户友好的错误标题 */
  title: string
  /** 用户友好的错误描述 */
  message: string
  /** 解决方案/建议 */
  solution: string
  /** 错误级别 */
  level: 'error' | 'warning' | 'info'
  /** 是否显示重试按钮 */
  showRetry?: boolean
  /** 是否显示联系支持按钮 */
  showSupport?: boolean
}

/**
 * 连接相关错误映射
 */
export const CONNECTION_ERROR_MAP: Record<string, ErrorMessageConfig> = {
  // 浏览器相关错误
  'browser has been closed': {
    title: '浏览器已关闭',
    message: '直播助手检测到浏览器窗口被关闭了',
    solution: '请重新点击"连接直播中控台"按钮，系统将重新打开浏览器',
    level: 'warning',
    showRetry: true,
  },
  'Target page, context or browser has been closed': {
    title: '连接已中断',
    message: '与直播平台的连接意外中断',
    solution: '请检查网络连接，然后重新连接。如果问题持续，请重启软件',
    level: 'warning',
    showRetry: true,
  },
  'Browser is not connected': {
    title: '浏览器未连接',
    message: '无法与浏览器建立通信',
    solution: '请重新连接直播中控台，或重启软件后重试',
    level: 'error',
    showRetry: true,
  },

  // 网络相关错误
  'net::ERR_CONNECTION_REFUSED': {
    title: '无法连接到直播平台',
    message: '直播平台拒绝了连接请求',
    solution: '请检查：1. 网络是否正常 2. 直播平台是否可用 3. 稍后重试',
    level: 'error',
    showRetry: true,
  },
  'net::ERR_INTERNET_DISCONNECTED': {
    title: '网络已断开',
    message: '您的电脑似乎断开了网络连接',
    solution: '请检查网络连接（WiFi/网线），恢复网络后重试',
    level: 'error',
    showRetry: true,
  },
  'net::ERR_TIMED_OUT': {
    title: '连接超时',
    message: '连接直播平台花费时间过长',
    solution: '网络可能较慢，请检查网络状况后重试，或稍后再试',
    level: 'warning',
    showRetry: true,
  },
  'Navigation failed': {
    title: '页面加载失败',
    message: '无法打开直播平台页面',
    solution: '请检查网络连接，或尝试刷新页面。如果问题持续，请联系技术支持',
    level: 'error',
    showRetry: true,
  },
  timeout: {
    title: '操作超时',
    message: '操作花费时间过长，系统已自动取消',
    solution: '网络可能不稳定，请检查网络后重试',
    level: 'warning',
    showRetry: true,
  },

  // 登录相关错误
  LOGIN_TIMEOUT: {
    title: '登录超时',
    message: '等待登录的时间过长',
    solution: '请重新连接，并在弹出的浏览器中尽快完成扫码登录',
    level: 'warning',
    showRetry: true,
  },
  登录超时: {
    title: '登录超时',
    message: '等待登录的时间过长',
    solution: '请重新连接，并在弹出的浏览器中尽快完成扫码登录',
    level: 'warning',
    showRetry: true,
  },
  需要登录: {
    title: '需要登录账号',
    message: '检测到您尚未登录直播平台',
    solution: '请在弹出的浏览器窗口中完成登录，然后返回本软件',
    level: 'info',
    showRetry: false,
  },

  // 平台特定错误
  视频号助手无法一号多登: {
    title: '账号在其他地方登录',
    message: '您的视频号账号在另一个设备或浏览器中登录了',
    solution: '视频号不支持同时多处登录。请确保只在直播助手中登录，关闭其他地方的登录',
    level: 'warning',
    showRetry: true,
  },
  人机验证: {
    title: '需要进行安全验证',
    message: '直播平台检测到异常，需要您完成安全验证',
    solution: '请在弹出的浏览器中按照提示完成验证（如拖动滑块、选择图片等）',
    level: 'info',
    showRetry: false,
  },
  淘宝中控台: {
    title: '淘宝中控台提示',
    message: '淘宝平台需要特殊处理',
    solution: '请完成人机验证后，不要关闭浏览器，让软件自动操作',
    level: 'info',
    showRetry: false,
  },

  // 通用连接错误
  连接已取消: {
    title: '连接已取消',
    message: '您取消了连接操作',
    solution: '如需连接，请重新点击"连接直播中控台"按钮',
    level: 'info',
    showRetry: false,
  },
  连接超时: {
    title: '连接超时',
    message: '建立连接花费时间过长',
    solution: '请检查网络状况，或稍后重试',
    level: 'warning',
    showRetry: true,
  },
  网络连接失败: {
    title: '网络连接失败',
    message: '无法连接到网络或直播平台',
    solution: '请检查：1. WiFi/网线是否连接正常 2. 能否正常访问其他网站 3. 稍后重试',
    level: 'error',
    showRetry: true,
  },
  连接失败: {
    title: '连接失败',
    message: '无法连接到直播中控台',
    solution: '请检查网络连接，确认直播平台可用后重试。如问题持续，请联系技术支持',
    level: 'error',
    showRetry: true,
    showSupport: true,
  },
  找不到对应账号: {
    title: '账号信息异常',
    message: '无法找到当前选中的账号信息',
    solution: '请尝试切换账号或重新添加账号，如问题持续请重启软件',
    level: 'error',
    showRetry: true,
  },
}

/**
 * 任务相关错误映射
 */
export const TASK_ERROR_MAP: Record<string, ErrorMessageConfig> = {
  'TaskManager not initialized': {
    title: '任务管理器未就绪',
    message: '任务管理系统还在初始化中',
    solution: '请稍等片刻后重试，或重启软件',
    level: 'warning',
    showRetry: true,
  },
  'Task already running': {
    title: '任务已在运行',
    message: '您尝试启动的任务已经在运行中了',
    solution: '无需重复启动，您可以在左侧导航栏看到运行状态（绿色指示点）',
    level: 'info',
    showRetry: false,
  },
  'Task not found': {
    title: '任务不存在',
    message: '找不到您要操作的任务',
    solution: '请刷新页面后重试，或重启软件',
    level: 'error',
    showRetry: true,
  },
  请先连接直播中控台: {
    title: '需要先连接中控台',
    message: '使用此功能前，请先连接直播中控台',
    solution: '请先点击左侧"打开中控台"，完成连接后再使用此功能',
    level: 'info',
    showRetry: false,
  },
  请先登录: {
    title: '需要先登录',
    message: '使用此功能前，请先登录您的账号',
    solution: '请点击右上角登录按钮完成登录',
    level: 'info',
    showRetry: false,
  },
}

/**
 * 浏览器/Chrome相关错误映射
 */
export const BROWSER_ERROR_MAP: Record<string, ErrorMessageConfig> = {
  'Chrome not found': {
    title: '未找到Chrome浏览器',
    message: '系统中没有检测到Google Chrome浏览器',
    solution: '请安装Chrome浏览器，或在"设置"中手动指定Chrome安装路径',
    level: 'error',
    showRetry: false,
  },
  'Chrome path not configured': {
    title: 'Chrome路径未设置',
    message: '需要指定Chrome浏览器的安装位置',
    solution: '请前往"设置"页面，配置Chrome浏览器路径',
    level: 'error',
    showRetry: false,
  },
  'Failed to launch browser': {
    title: '浏览器启动失败',
    message: '无法启动Chrome浏览器',
    solution: '请检查Chrome是否完整安装，或尝试重启电脑后重试',
    level: 'error',
    showRetry: true,
  },
  'browser disconnected': {
    title: '浏览器已断开',
    message: '与浏览器的通信连接已断开',
    solution: '请重新连接直播中控台',
    level: 'warning',
    showRetry: true,
  },
}

/**
 * 存储相关错误映射
 */
export const STORAGE_ERROR_MAP: Record<string, ErrorMessageConfig> = {
  'Storage quota exceeded': {
    title: '存储空间不足',
    message: '浏览器存储空间已满，无法保存数据',
    solution: '请清理浏览器缓存，或删除一些历史数据后重试',
    level: 'error',
    showRetry: true,
  },
  'localStorage is not available': {
    title: '存储功能不可用',
    message: '无法访问本地存储',
    solution: '请检查浏览器设置，确保没有禁用本地存储功能',
    level: 'error',
    showRetry: true,
  },
  'Failed to encrypt data': {
    title: '数据加密失败',
    message: '无法加密您的敏感数据',
    solution: '请重启软件后重试，如问题持续请联系技术支持',
    level: 'error',
    showRetry: true,
    showSupport: true,
  },
  'Failed to decrypt data': {
    title: '数据解密失败',
    message: '无法读取已加密的数据',
    solution: '数据可能已损坏，请尝试重新配置。如问题持续请联系技术支持',
    level: 'error',
    showRetry: false,
    showSupport: true,
  },
}

/**
 * 小号互动相关错误映射
 */
export const SUBACCOUNT_ERROR_MAP: Record<string, ErrorMessageConfig> = {
  请先添加小号: {
    title: '需要先添加小号',
    message: '您还没有添加任何小号账号',
    solution: '请先点击"添加小号"按钮，添加至少一个小号账号',
    level: 'info',
    showRetry: false,
  },
  请至少登录一个小号: {
    title: '小号未登录',
    message: '您添加的小号尚未登录',
    solution: '请先点击小号的"登录"按钮，在弹出的浏览器中完成登录',
    level: 'info',
    showRetry: false,
  },
  直播间地址格式错误: {
    title: '直播间地址不正确',
    message: '输入的直播间地址格式有误',
    solution: '请输入正确的直播间地址，格式如：https://live.douyin.com/房间号',
    level: 'error',
    showRetry: false,
  },
  请输入真正的直播间地址: {
    title: '地址类型错误',
    message: '您输入的是中控台地址，而非直播间地址',
    solution: '请打开直播间页面（观众看到的页面），复制地址栏中的链接',
    level: 'error',
    showRetry: false,
  },
}

/**
 * 通用错误映射（兜底）
 */
export const GENERIC_ERROR_MAP: Record<string, ErrorMessageConfig> = {
  UNKNOWN_ERROR: {
    title: '发生未知错误',
    message: '系统遇到了意外情况',
    solution: '请尝试刷新页面或重启软件。如果问题持续存在，请联系技术支持',
    level: 'error',
    showRetry: true,
    showSupport: true,
  },
  NETWORK_ERROR: {
    title: '网络异常',
    message: '网络连接出现问题',
    solution: '请检查网络连接，确认能正常访问互联网后重试',
    level: 'error',
    showRetry: true,
  },
  SERVER_ERROR: {
    title: '服务器繁忙',
    message: '服务器暂时无法处理您的请求',
    solution: '请稍等片刻后重试，如问题持续请联系技术支持',
    level: 'warning',
    showRetry: true,
  },
}

/**
 * 合并所有错误映射
 */
export const ALL_ERROR_MAP: Record<string, ErrorMessageConfig> = {
  ...CONNECTION_ERROR_MAP,
  ...TASK_ERROR_MAP,
  ...BROWSER_ERROR_MAP,
  ...STORAGE_ERROR_MAP,
  ...SUBACCOUNT_ERROR_MAP,
  ...GENERIC_ERROR_MAP,
}

/**
 * 根据错误信息获取用户友好的错误配置
 * @param error - 错误对象或错误字符串
 * @returns 用户友好的错误配置
 */
export function getFriendlyErrorConfig(error: unknown): ErrorMessageConfig {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorLower = errorMessage.toLowerCase()

  // 1. 精确匹配
  if (ALL_ERROR_MAP[errorMessage]) {
    return ALL_ERROR_MAP[errorMessage]
  }

  // 2. 关键字匹配（部分匹配）
  for (const [key, config] of Object.entries(ALL_ERROR_MAP)) {
    if (errorLower.includes(key.toLowerCase())) {
      return config
    }
  }

  // 3. 特殊模式匹配
  if (errorLower.includes('net::err_')) {
    return CONNECTION_ERROR_MAP['net::ERR_CONNECTION_REFUSED'] || GENERIC_ERROR_MAP.NETWORK_ERROR
  }

  if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
    return CONNECTION_ERROR_MAP.timeout
  }

  if (errorLower.includes('browser') && errorLower.includes('close')) {
    return CONNECTION_ERROR_MAP['browser has been closed']
  }

  // 4. 兜底返回通用错误
  return {
    ...GENERIC_ERROR_MAP.UNKNOWN_ERROR,
    // 在开发环境下，附加原始错误信息（仅用于调试）
    ...(import.meta.env.DEV && {
      message: `${GENERIC_ERROR_MAP.UNKNOWN_ERROR.message} (调试信息: ${errorMessage})`,
    }),
  }
}

/**
 * 获取简洁的错误提示（用于Toast）
 * @param error - 错误对象或错误字符串
 * @returns 简洁的错误提示文本
 */
export function getFriendlyErrorMessage(error: unknown): string {
  const config = getFriendlyErrorConfig(error)
  return `${config.title}：${config.message}`
}

/**
 * 获取完整的错误信息（包含解决方案）
 * @param error - 错误对象或错误字符串
 * @returns 完整的错误信息对象
 */
export function getFullErrorInfo(error: unknown): {
  title: string
  message: string
  solution: string
  level: 'error' | 'warning' | 'info'
} {
  const config = getFriendlyErrorConfig(error)
  return {
    title: config.title,
    message: config.message,
    solution: config.solution,
    level: config.level,
  }
}

export default {
  getFriendlyErrorConfig,
  getFriendlyErrorMessage,
  getFullErrorInfo,
  CONNECTION_ERROR_MAP,
  TASK_ERROR_MAP,
  BROWSER_ERROR_MAP,
  STORAGE_ERROR_MAP,
  SUBACCOUNT_ERROR_MAP,
  GENERIC_ERROR_MAP,
}
