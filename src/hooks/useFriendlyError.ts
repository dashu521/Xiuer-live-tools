import React, { useCallback } from 'react'
import { ToastAction } from '@/components/ui/toast'
import {
  type ErrorMessageConfig,
  getFriendlyErrorConfig,
  getFriendlyErrorMessage,
} from '@/utils/errorMessages'
import { useToast } from './useToast'

/**
 * 用户友好的错误处理 Hook
 *
 * 特性：
 * 1. 自动将技术错误转换为用户友好的提示
 * 2. 支持显示解决方案
 * 3. 区分错误级别（error/warning/info）
 * 4. 支持重试和联系支持的操作
 */
export function useFriendlyError() {
  const { toast } = useToast()

  /**
   * 显示用户友好的错误提示
   * @param error - 错误对象或错误字符串
   * @param options - 可选配置
   */
  const showError = useCallback(
    (
      error: unknown,
      options?: {
        /** 自定义标题（覆盖默认） */
        title?: string
        /** 自定义消息（覆盖默认） */
        message?: string
        /** 是否显示解决方案 */
        showSolution?: boolean
        /** 自定义操作按钮 */
        action?: {
          label: string
          onClick: () => void
        }
      },
    ) => {
      const config = getFriendlyErrorConfig(error)

      const title = options?.title ?? config.title
      const message = options?.message ?? config.message
      const solution = config.solution
      const description =
        options?.showSolution && solution ? `${message}\n建议：${solution}` : message
      const action = options?.action
        ? React.createElement(
            ToastAction,
            {
              altText: options.action.label,
              onClick: options.action.onClick,
            },
            options.action.label,
          )
        : undefined

      // 根据错误级别选择不同的提示样式
      switch (config.level) {
        case 'error':
          toast.error({
            title,
            description,
            action,
            dedupeKey: `friendly-error:${title}`,
          })
          break
        case 'warning':
          toast.warning({
            title,
            description,
            action,
            dedupeKey: `friendly-warning:${title}`,
          })
          break
        case 'info':
          toast.info({
            title,
            description,
            action,
            dedupeKey: `friendly-info:${title}`,
          })
          break
      }

      return config
    },
    [toast],
  )

  /**
   * 处理错误并返回配置（用于需要自定义展示的场景）
   * @param error - 错误对象或错误字符串
   * @returns 错误配置对象
   */
  const handleError = useCallback((error: unknown): ErrorMessageConfig => {
    return getFriendlyErrorConfig(error)
  }, [])

  /**
   * 获取友好的错误消息（用于表单验证等场景）
   * @param error - 错误对象或错误字符串
   * @returns 友好的错误消息字符串
   */
  const getErrorMessage = useCallback((error: unknown): string => {
    return getFriendlyErrorMessage(error)
  }, [])

  /**
   * 包装异步函数，自动处理错误
   * @param asyncFn - 异步函数
   * @param errorOptions - 错误显示选项
   * @returns 包装后的函数
   */
  const withErrorHandling = useCallback(
    <T extends unknown[], R>(
      asyncFn: (...args: T) => Promise<R>,
      errorOptions?: {
        showSolution?: boolean
        onError?: (error: unknown, config: ErrorMessageConfig) => void
      },
    ) => {
      return async (...args: T): Promise<R | undefined> => {
        try {
          return await asyncFn(...args)
        } catch (error) {
          const config = showError(error, { showSolution: errorOptions?.showSolution })
          errorOptions?.onError?.(error, config)
          return undefined
        }
      }
    },
    [showError],
  )

  return {
    showError,
    handleError,
    getErrorMessage,
    withErrorHandling,
  }
}

export default useFriendlyError
