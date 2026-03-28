import { useMemoizedFn } from 'ahooks'
import { BanIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { useAccounts } from '@/hooks/useAccounts'
import { useCurrentLiveControl } from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog'
import { Button } from '../../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card'

export function AccountSetting() {
  const accounts = useAccounts(state => state.accounts)
  const removeAccount = useAccounts(state => state.removeAccount)
  const currentAccountId = useAccounts(state => state.currentAccountId)
  const defaultAccountId = useAccounts(state => state.defaultAccountId)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const { toast } = useToast()
  const connectState = useCurrentLiveControl(context => context.connectState)
  const isConnected = connectState.status === 'connected'
  const currentAccount = accounts.find(acc => acc.id === currentAccountId)
  const isDefaultAccount = defaultAccountId === currentAccountId
  const handleDeleteAccount = useMemoizedFn(async () => {
    if (isDefaultAccount) return
    // 先断开连接
    if (isConnected) {
      await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.liveControl.disconnect, currentAccountId)
    }
    removeAccount(currentAccountId)
    setIsDeleteDialogOpen(false)
    toast.info({
      title: '账号已删除',
      description: '当前直播账号已移除。',
      dedupeKey: `account-deleted:${currentAccountId}`,
    })
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>删除账号</CardTitle>
        <CardDescription>删除本地的账号配置，不会影响到抖店和百应</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">当前账号：</span>
            <span className="font-medium">{currentAccount?.name}</span>
          </div>
          {!isDefaultAccount ? (
            !isConnected ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <TrashIcon className="h-4 w-4" />
                <span>删除账号</span>
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-2" disabled>
                <TrashIcon className="h-4 w-4" />
                <span>请先断开中控台连接</span>
              </Button>
            )
          ) : (
            <Button disabled size="sm" className="gap-2">
              <BanIcon className="h-4 w-4" />
              <span>无法删除默认账号</span>
            </Button>
          )}
        </div>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除该账号配置</AlertDialogTitle>
              <AlertDialogDescription>
                请确保该账号的所有任务都已停止，以免造成未知的错误
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAccount}>确认</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
