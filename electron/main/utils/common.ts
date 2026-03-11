import { Result } from '@praha/byethrow'
import { AbortError } from '#/errors/AppError'
import 'dotenv/config'
import { mergeWith } from 'lodash-es'

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function abortableSleep(
  ms: number,
  signal?: AbortSignal,
): Result.ResultAsync<void, Error> {
  function sleepPromise() {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new AbortError())
        return
      }
      const timer = setTimeout(resolve, ms)
      const onAbort = () => {
        cleanup()
        reject(new AbortError())
      }
      const cleanup = () => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
      }
      signal?.addEventListener('abort', onAbort)
    })
  }
  return Result.try({
    immediate: true,
    try: async () => await sleepPromise(),
    catch: () => new AbortError(),
  })
}

export function isDev() {
  return process.env.NODE_ENV === 'development'
}

/**
 * 检查是否启用 Mock 测试模式
 *
 * @returns 是否启用 Mock 测试模式
 *
 * @remarks
 * - 通过环境变量 MOCK_TEST 控制
 * - 仅在开发/测试环境使用，生产环境不应设置此变量
 * - 此函数用于后端（Electron main 进程）的 Mock 测试控制
 */
export function isMockTest() {
  return process.env.MOCK_TEST === 'true'
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

export function insertRandomSpaces(text: string, insertionProbability = 0.2): string {
  // 不处理空字符串或概率为0的情况
  if (!text || insertionProbability <= 0) return text
  // 不能超过 50 个字符，且不要添加太多的空格
  let maxSpaces = Math.min(50 - text.length, 5)
  if (maxSpaces <= 0) return text

  // 限制概率在合理范围内
  const probability = Math.min(Math.max(insertionProbability, 0), 0.5)

  const result: string[] = []
  let lastWasSpace = false // 避免连续多个空格

  const SPACE_CHAR = ' '

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    result.push(char)
    if (maxSpaces <= 0) {
      continue
    }
    // 不在空格后立即再插入空格，避免过多空格影响阅读
    if (
      !lastWasSpace &&
      char !== SPACE_CHAR &&
      i < text.length - 1 && // 不在末尾插入
      text[i + 1] !== SPACE_CHAR && // 下一个字符不是空格
      Math.random() < probability
    ) {
      // 随机决定插入1个还是2个空格(小概率)
      const spacesToInsert = Math.min(maxSpaces, Math.random() < 0.9 ? 1 : 2)
      result.push(SPACE_CHAR.repeat(spacesToInsert))
      maxSpaces -= spacesToInsert
      lastWasSpace = true
    } else {
      lastWasSpace = char === SPACE_CHAR
    }
  }

  // 如果没插入空格，就随便找个地方插一个
  if (result.length === text.length && result.length > 0) {
    const index = randomInt(0, result.length - 1)
    result.splice(index, 0, SPACE_CHAR)
  }

  return result.join('')
}

// 消息存在变量，用 {A/B/C} 表示
const VAR_REG = /\{([^}]+)\}/g

/**
 * 基础变量替换：支持 {A/B/C} 语法，随机选择其中一个
 */
export function replaceVariant(msg: string): string {
  return msg.replace(VAR_REG, (_match, group) => {
    const options = group.split('/')
    const randomIndex = randomInt(0, options.length - 1)
    return options[randomIndex]
  })
}

/**
 * 消息模板上下文
 */
export interface MessageTemplateContext {
  /** 主播名称 */
  streamerName?: string
  /** 直播间标题 */
  roomTitle?: string
  /** 当前时间 */
  currentTime?: Date
  /** 自定义变量 */
  customVars?: Record<string, string>
}

/**
 * 增强的消息模板替换
 * 支持变量：
 * - {streamer} - 主播名
 * - {time} - 当前时间 (HH:mm)
 * - {date} - 当前日期 (MM-DD)
 * - {random:min-max} - 随机数字
 * - {custom:key} - 自定义变量
 * - {A/B/C} - 基础随机选择
 */
export function replaceMessageTemplate(msg: string, context: MessageTemplateContext = {}): string {
  let result = msg

  // 基础变量替换 {A/B/C}
  result = result.replace(VAR_REG, (_match, group) => {
    // 检查是否是特殊变量
    if (group.startsWith('streamer')) {
      return context.streamerName || '主播'
    }
    if (group.startsWith('time')) {
      const now = context.currentTime || new Date()
      return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    if (group.startsWith('date')) {
      const now = context.currentTime || new Date()
      return now.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
    }
    if (group.startsWith('random:')) {
      const range = group.substring(7).split('-')
      if (range.length === 2) {
        const min = Number.parseInt(range[0], 10)
        const max = Number.parseInt(range[1], 10)
        if (!Number.isNaN(min) && !Number.isNaN(max)) {
          return String(randomInt(min, max))
        }
      }
      return group
    }
    if (group.startsWith('custom:')) {
      const key = group.substring(7)
      return context.customVars?.[key] || `{${group}}`
    }

    // 默认：随机选择
    const options = group.split('/')
    const randomIndex = randomInt(0, options.length - 1)
    return options[randomIndex]
  })

  return result
}

function arrayReplaceCustomizer<Value1, Value2>(_objValue: Value1, srcValue: Value2) {
  if (Array.isArray(srcValue)) {
    // 如果源对象的属性值是一个数组 (即 configUpdates 里的值是数组)，
    // 则直接返回这个源数组，它将替换掉目标对象中的对应数组。
    return srcValue
  }
}

/**
 * 使用 lodash.merge 合并对象，但是不会合并数组
 */
export function mergeWithoutArray<Object1, Object2>(
  objValue: Object1,
  srcValue: Object2,
): Object1 & Object2 {
  return mergeWith({}, objValue, srcValue, arrayReplaceCustomizer)
}
