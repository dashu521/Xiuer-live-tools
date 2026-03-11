import { useState } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
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
import { Label } from '@/components/ui/label'

interface HideToTrayTipDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HideToTrayTipDialog({ open, onOpenChange }: HideToTrayTipDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const handleConfirm = async () => {
    if (dontShowAgain && window.ipcRenderer) {
      // 保存"不再提示"设置
      await window.ipcRenderer.invoke(IPC_CHANNELS.app.setHideToTrayTipDismissed, true)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[26.5rem]">
        <DialogHeader>
          <DialogTitle>已最小化到托盘</DialogTitle>
          <DialogDescription className="pt-2">
            关闭按钮不会退出程序，应用已在后台运行。可在任务栏/托盘图标中重新打开。
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2 py-4">
          <Checkbox
            id="dont-show-again"
            checked={dontShowAgain}
            onCheckedChange={checked => setDontShowAgain(checked === true)}
          />
          <Label htmlFor="dont-show-again" className="text-sm font-normal cursor-pointer">
            不再提示
          </Label>
        </div>
        <DialogFooter>
          <Button onClick={handleConfirm} className="w-full">
            我知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
