import { useMemoizedFn } from 'ahooks'
import { Play, Settings, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { GateButton } from '@/components/GateButton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { getAccountPreference, setAccountPreference } from '@/hooks/useAccountPreference'
import { useAccounts } from '@/hooks/useAccounts'
import { getAccountAutoStartOnLive, setAccountAutoStartOnLive } from '@/hooks/useAutoStartOnLive'
import { useLiveFeatureGate } from '@/hooks/useLiveFeatureGate'
import { useOneClickStart } from '@/hooks/useOneClickStart'

const SKIP_CONFIRM_KEY = 'one-click-start-skip-confirm'
const LEGACY_SKIP_CONFIRM_KEY = 'one-click-start-skip-confirm'
const LEGACY_AUTO_START_KEY = 'auto-start-on-live-enabled'

/**
 * 获取跳过确认设置（账号隔离）
 */
function getSkipConfirm(accountId: string): boolean {
  if (!accountId) return false
  return getAccountPreference(accountId, SKIP_CONFIRM_KEY, false)
}

/**
 * 设置跳过确认（账号隔离）
 */
function setSkipConfirm(accountId: string, value: boolean): void {
  if (!accountId) return
  setAccountPreference(accountId, SKIP_CONFIRM_KEY, value)
}

/**
 * 迁移旧的全局设置到账号隔离格式
 */
function migrateLegacySettings(accountId: string): void {
  if (!accountId) return

  try {
    // 迁移跳过确认设置
    const legacySkipConfirm = localStorage.getItem(LEGACY_SKIP_CONFIRM_KEY)
    if (legacySkipConfirm !== null) {
      const currentValue = getAccountPreference(accountId, SKIP_CONFIRM_KEY, null)
      // 只有当新格式没有设置时才迁移
      if (currentValue === null) {
        setAccountPreference(accountId, SKIP_CONFIRM_KEY, legacySkipConfirm === 'true')
        console.log(`[OneClickStartButton] 迁移跳过确认设置: ${legacySkipConfirm}`)
      }
    }

    // 迁移开播自动启动设置
    const legacyAutoStart = localStorage.getItem(LEGACY_AUTO_START_KEY)
    if (legacyAutoStart !== null) {
      const currentValue = getAccountPreference(accountId, 'auto-start-on-live-enabled', null)
      // 只有当新格式没有设置时才迁移
      if (currentValue === null) {
        setAccountPreference(accountId, 'auto-start-on-live-enabled', legacyAutoStart === 'true')
        console.log(`[OneClickStartButton] 迁移开播自动启动设置: ${legacyAutoStart}`)
      }
    }
  } catch (error) {
    console.error('[OneClickStartButton] 迁移旧设置失败:', error)
  }
}

// 统一按钮尺寸样式 - h-10 与其他按钮保持一致
const BUTTON_HEIGHT = 'h-10'
const BUTTON_TEXT = 'text-sm font-medium'
const ICON_BUTTON_SIZE = 'h-10 w-10'

interface OneClickStartButtonProps {
  variant?: 'default' | 'secondary'
}

export function OneClickStartButton({ variant = 'default' }: OneClickStartButtonProps) {
  const { state, startAllTasks, stopAllTasks, isAnyTaskRunning } = useOneClickStart()
  const gate = useLiveFeatureGate()
  const { currentAccountId } = useAccounts()
  const [showConfirm, setShowConfirm] = useState(false)
  const [skipConfirm, setSkipConfirmState] = useState(false)
  const [autoStartOnLive, setAutoStartOnLiveState] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const hasMigratedRef = useRef<Set<string>>(new Set())

  // 当账号切换时，加载该账号的设置（并执行数据迁移）
  useEffect(() => {
    if (currentAccountId) {
      // 只迁移一次
      if (!hasMigratedRef.current.has(currentAccountId)) {
        migrateLegacySettings(currentAccountId)
        hasMigratedRef.current.add(currentAccountId)
      }

      setSkipConfirmState(getSkipConfirm(currentAccountId))
      setAutoStartOnLiveState(getAccountAutoStartOnLive(currentAccountId))
    }
  }, [currentAccountId])

  const handleClick = useMemoizedFn(() => {
    if (!state.canStart) {
      return
    }
    // 如果用户选择跳过确认，直接启动
    if (skipConfirm) {
      startAllTasks()
      return
    }
    setShowConfirm(true)
  })

  const handleConfirm = useMemoizedFn(async () => {
    setShowConfirm(false)
    await startAllTasks()
  })

  const handleCancel = useMemoizedFn(() => {
    setShowConfirm(false)
  })

  const handleSkipConfirmChange = useMemoizedFn((checked: boolean) => {
    setSkipConfirmState(checked)
    if (currentAccountId) {
      setSkipConfirm(currentAccountId, checked)
    }
  })

  const handleAutoStartOnLiveChange = useMemoizedFn((checked: boolean) => {
    setAutoStartOnLiveState(checked)
    if (currentAccountId) {
      setAccountAutoStartOnLive(currentAccountId, checked)
    }
  })

  // 根据 variant 确定按钮样式
  const isSecondary = variant === 'secondary'
  const mainButtonVariant = isAnyTaskRunning ? 'secondary' : isSecondary ? 'secondary' : 'default'
  const settingsButtonVariant = isSecondary ? 'secondary' : 'default'

  if (isAnyTaskRunning) {
    return (
      <div className="flex items-center gap-0">
        <Button
          variant="secondary"
          onClick={stopAllTasks}
          className={`gap-2 rounded-r-none ${BUTTON_HEIGHT} ${BUTTON_TEXT}`}
        >
          <Square className="w-4 h-4" />
          停止所有任务
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className={`rounded-l-none border-l border-secondary-foreground/20 ${ICON_BUTTON_SIZE} opacity-50 cursor-not-allowed`}
          disabled
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-0">
        <GateButton
          gate={gate}
          onClick={handleClick}
          disabled={state.isLoading}
          variant={mainButtonVariant}
          className={`gap-2 rounded-r-none ${BUTTON_HEIGHT} ${BUTTON_TEXT}`}
        >
          <Play className="w-4 h-4" />
          一键开启
        </GateButton>

        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={settingsButtonVariant}
              size="icon"
              className={`rounded-l-none border-l ${isSecondary ? 'border-secondary-foreground/20' : 'border-primary-foreground/20'} ${ICON_BUTTON_SIZE}`}
              disabled={state.isLoading}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-3">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">自动启动设置</h4>
              <Separator />
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={autoStartOnLive}
                    onCheckedChange={handleAutoStartOnLiveChange}
                  />
                  <span className="text-sm">开播自动启动</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox checked={skipConfirm} onCheckedChange={handleSkipConfirmChange} />
                  <span className="text-sm">跳过确认提示</span>
                </label>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认开启所有任务？</DialogTitle>
            <DialogDescription className="space-y-2 pt-4">
              <p>将同时开启以下功能：</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>自动回复 - 自动回复观众评论</li>
                <li>自动发言 - 按设定间隔自动发送消息</li>
                <li>自动弹窗 - 自动展示商品弹窗</li>
              </ul>
              <p className="mt-4 text-sm text-amber-200">请确保已配置好各功能的设置后再开启。</p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <Checkbox
              id="skip-confirm"
              checked={skipConfirm}
              onCheckedChange={handleSkipConfirmChange}
            />
            <label
              htmlFor="skip-confirm"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              我已知晓，下次不再提醒
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancel}>
              取消
            </Button>
            <Button onClick={handleConfirm} className="gap-2">
              <Play className="w-4 h-4" />
              确认开启
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
