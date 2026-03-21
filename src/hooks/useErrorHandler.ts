import { useCallback } from 'react'
import { getFriendlyErrorMessage } from '@/utils/errorMessages'
import { useToast } from './useToast'

export type ErrorHandlingResult<R> = { ok: true; value: R } | { ok: false; error: unknown }

export async function executeWithErrorHandling<T extends unknown[], R>(
  asyncFn: (...args: T) => Promise<R>,
  onError: (error: unknown, message?: string) => void,
  args: T,
  errorMessage?: string,
): Promise<ErrorHandlingResult<R>> {
  try {
    return {
      ok: true,
      value: await asyncFn(...args),
    }
  } catch (error) {
    onError(error, errorMessage)
    return {
      ok: false,
      error,
    }
  }
}

/**
 * 统一的错误处理 Hook
 * 用于在应用中统一处理错误，包括日志记录和用户提示
 */
export function useErrorHandler() {
  const { toast } = useToast()

  /**
   * 处理错误
   * @param error - 错误对象或错误消息
   * @param message - 可选的自定义错误提示消息
   */
  const handleError = useCallback(
    (error: unknown, message?: string) => {
      const displayMessage = message || getFriendlyErrorMessage(error)

      // 记录错误到控制台
      console.error('错误:', error)

      // 显示错误提示给用户
      toast.error({
        title: '操作失败',
        description: displayMessage,
        dedupeKey: `error-handler:${displayMessage}`,
      })
    },
    [toast],
  )

  /**
   * 异步操作包装器，自动处理错误
   * @param asyncFn - 异步函数
   * @param errorMessage - 可选的自定义错误提示消息
   * @returns 包装后的异步函数
   */
  const withErrorHandling = useCallback(
    <T extends unknown[], R>(asyncFn: (...args: T) => Promise<R>, errorMessage?: string) => {
      return (...args: T): Promise<ErrorHandlingResult<R>> =>
        executeWithErrorHandling(asyncFn, handleError, args, errorMessage)
    },
    [handleError],
  )

  return {
    handleError,
    withErrorHandling,
  }
}
