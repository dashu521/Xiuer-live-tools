import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'theme'
export type Theme = 'fashion'

/**
 * 主题配置信息
 */
export const themeConfig: Record<Theme, { label: string; description: string; color: string }> = {
  fashion: {
    label: '时尚主题',
    description: '现代渐变设计，彰显个性风格',
    color: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
  },
}

/**
 * 获取存储的主题设置
 * 默认主题为时尚主题 (fashion)
 */
function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'fashion'
  const stored = localStorage.getItem(STORAGE_KEY)
  // 只支持时尚主题，如果存储的是其他值，也返回fashion
  if (stored === 'fashion') return stored
  // 默认返回时尚主题
  return 'fashion'
}

/**
 * 应用主题到文档
 */
function applyTheme(value: Theme) {
  document.documentElement.dataset.theme = value
}

/**
 * 主题管理 Hook
 *
 * 使用说明：
 * const [theme, setTheme] = useTheme()
 *
 * - theme: 当前主题，固定为 'fashion'
 * - setTheme: 设置主题（首发版仅支持 'fashion'）
 */
export function useTheme(): [Theme, (value: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  useEffect(() => {
    applyTheme(getStoredTheme())
  }, [])

  const setTheme = useCallback((value: Theme) => {
    // 只接受fashion主题，忽略其他值
    if (value === 'fashion') {
      setThemeState(value)
      document.documentElement.dataset.theme = value
      localStorage.setItem(STORAGE_KEY, value)
    }
  }, [])

  return [theme, setTheme]
}

/**
 * 初始化主题（在应用启动时调用）
 */
export function initializeTheme(): void {
  if (typeof window !== 'undefined') {
    applyTheme(getStoredTheme())
  }
}
