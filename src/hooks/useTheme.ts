import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'theme'
export type ThemeMode = 'fashion' | 'daylight' | 'system'
type ResolvedTheme = 'fashion' | 'daylight'

export const themeConfig: Record<
  ResolvedTheme,
  { label: string; description: string; color: string }
> = {
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

export const themeModeConfig: Record<ThemeMode, { label: string; icon: string }> = {
  fashion: { label: '时尚主题', icon: '🌙' },
  daylight: { label: '日间浅色', icon: '☀️' },
  system: { label: '跟随系统', icon: '💻' },
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'fashion'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'daylight' : 'fashion'
}

function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'fashion'
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
  if (stored === 'fashion' || stored === 'daylight' || stored === 'system') return stored
  return 'fashion'
}

function applyTheme(value: ResolvedTheme) {
  document.documentElement.dataset.theme = value
}

export function useTheme(): {
  themeMode: ThemeMode
  resolvedTheme: ResolvedTheme
  setThemeMode: (value: ThemeMode) => void
} {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getStoredThemeMode)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const mode = getStoredThemeMode()
    return mode === 'system' ? getSystemTheme() : mode
  })

  useEffect(() => {
    const mode = getStoredThemeMode()
    const resolved = mode === 'system' ? getSystemTheme() : mode
    applyTheme(resolved)
    setResolvedTheme(resolved)
  }, [])

  useEffect(() => {
    if (themeMode !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)')
    const handleChange = () => {
      const newResolved = getSystemTheme()
      setResolvedTheme(newResolved)
      applyTheme(newResolved)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [themeMode])

  const setThemeMode = useCallback((value: ThemeMode) => {
    setThemeModeState(value)
    localStorage.setItem(STORAGE_KEY, value)

    const resolved = value === 'system' ? getSystemTheme() : value
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [])

  return { themeMode, resolvedTheme, setThemeMode }
}

export function initializeTheme(): void {
  if (typeof window !== 'undefined') {
    const mode = getStoredThemeMode()
    const resolved = mode === 'system' ? getSystemTheme() : mode
    applyTheme(resolved)
  }
}
