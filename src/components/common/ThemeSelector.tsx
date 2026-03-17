import { Monitor, Moon, Sun } from 'lucide-react'
import { memo, useCallback } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { type ThemeMode, useTheme } from '@/hooks/useTheme'

const themeOptions: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'fashion', label: '时尚主题', icon: <Moon className="h-3.5 w-3.5" /> },
  { value: 'daylight', label: '日间浅色', icon: <Sun className="h-3.5 w-3.5" /> },
  { value: 'system', label: '跟随系统', icon: <Monitor className="h-3.5 w-3.5" /> },
]

function getThemeIcon(themeMode: ThemeMode) {
  switch (themeMode) {
    case 'fashion':
      return <Moon className="h-4 w-4" />
    case 'daylight':
      return <Sun className="h-4 w-4" />
    case 'system':
      return <Monitor className="h-4 w-4" />
  }
}

export const ThemeSelector = memo(function ThemeSelector() {
  const { themeMode, setThemeMode } = useTheme()

  const handleValueChange = useCallback(
    (value: ThemeMode) => {
      setThemeMode(value)
    },
    [setThemeMode],
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <Select value={themeMode} onValueChange={handleValueChange}>
          <TooltipTrigger asChild>
            <SelectTrigger size="sm" className="h-9 w-9 p-0 justify-center" aria-label="切换主题">
              <SelectValue>{getThemeIcon(themeMode)}</SelectValue>
            </SelectTrigger>
          </TooltipTrigger>
          <SelectContent align="end">
            {themeOptions.map(option => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="flex items-center gap-2"
              >
                <span className="flex items-center gap-2">
                  {option.icon}
                  <span>{option.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TooltipContent side="bottom">
          <p>切换主题</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})
