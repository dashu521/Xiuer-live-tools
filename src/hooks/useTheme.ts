import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'theme'
export type Theme = 'fashion' | 'daylight'

/**
 * 主题配置信息
 */
export const themeConfig: Record<Theme, { label: string; description: string; color: string }> = {
  fashion: {
    label: '时尚主题',
    description: '现代渐变设计，彰显个性风格',
    color: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
  },
  daylight: {
    label: '日间浅色',
    description: '暖米色浅底，明亮但不刺眼',
    color: 'linear-gradient(135deg, #FFEAD7 0%, #FFF7EF 100%)',
  },
}

/**
 * 获取存储的主题设置
 * 默认主题为时尚主题 (fashion)
 */
function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'fashion'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'fashion' || stored === 'daylight') return stored
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
 * - theme: 当前主题
 * - setTheme: 设置主题
 */
export function useTheme(): [Theme, (value: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  useEffect(() => {
    applyTheme(getStoredTheme())
  }, [])

  const setTheme = useCallback((value: Theme) => {
    if (value === 'fashion' || value === 'daylight') {
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
