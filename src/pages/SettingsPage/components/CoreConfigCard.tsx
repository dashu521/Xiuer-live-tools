import { useMemoizedFn } from 'ahooks'
import {
  EraserIcon,
  FolderSearchIcon,
  Globe,
  SearchIcon,
  ShieldAlert,
  TrashIcon,
} from 'lucide-react'
import { useId, useState } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { SimpleIconsGooglechrome, SimpleIconsMicrosoftedge } from '@/components/icons/simpleIcons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  AUTH_LAST_IDENTIFIER_KEY,
  AUTH_REMEMBER_ME_KEY,
  AUTH_ZUSTAND_PERSIST_KEY,
} from '@/constants/authStorageKeys'
import { useAccounts } from '@/hooks/useAccounts'
import { useCurrentChromeConfig, useCurrentChromeConfigActions } from '@/hooks/useChromeConfig'
import { useCurrentLiveControl } from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import { useAuthStore } from '@/stores/authStore'
import { SettingRow } from './SettingRow'

export function CoreConfigCard() {
  const path = useCurrentChromeConfig(context => context.path)
  const { setPath, setStorageState } = useCurrentChromeConfigActions()
  const [isDetecting, setIsDetecting] = useState(false)
  const [edgeFirst, setEdgeFirst] = useState(false)
  const { toast } = useToast()
  const edgeFirstId = useId()

  const handleSelectChrome = async () => {
    try {
      const p = await window.ipcRenderer.invoke(IPC_CHANNELS.chrome.selectPath)
      if (p) {
        setPath(p)
        toast.success('Chrome 路径设置成功')
      }
    } catch {
      toast.error('选择 Chrome 路径失败')
    }
  }

  const handleAutoDetect = async () => {
    try {
      setIsDetecting(true)
      const result = await window.ipcRenderer.invoke(IPC_CHANNELS.chrome.getPath, edgeFirst)
      if (result) {
        setPath(result)
        toast.success('已自动检测到路径')
      } else {
        toast.error('未检测到 Chrome，请确保 Chrome 已打开')
      }
    } catch {
      toast.error('检测 Chrome 路径失败')
    } finally {
      setIsDetecting(false)
    }
  }

  const handleCookiesReset = () => {
    setStorageState('')
    toast.success('登录状态已重置')
  }

  const { accounts, removeAccount, currentAccountId, defaultAccountId } = useAccounts()
  const connectState = useCurrentLiveControl(context => context.connectState)
  const isConnected = connectState.status === 'connected'
  const currentAccount = accounts.find(acc => acc.id === currentAccountId)
  const isDefaultAccount = defaultAccountId === currentAccountId
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const handleDeleteAccount = useMemoizedFn(async () => {
    if (isDefaultAccount) return
    if (isConnected) {
      await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.liveControl.disconnect, currentAccountId)
    }
    removeAccount(currentAccountId)
    setIsDeleteDialogOpen(false)
    toast.success('删除账号成功')
  })

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/50 px-6 py-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          核心配置
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* 浏览器设置分组 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <div className="h-4 w-1 rounded-full bg-primary" />
            浏览器设置
          </div>

          <div className="pl-3 space-y-4">
            {/* 检测按钮和 Edge 优先 */}
            <div className="flex items-center gap-4 flex-wrap">
              <Button
                variant="default"
                size="sm"
                onClick={handleAutoDetect}
                disabled={isDetecting}
                className="h-9"
              >
                <SearchIcon className={`mr-2 h-4 w-4 ${isDetecting ? 'animate-spin' : ''}`} />
                {isDetecting ? '检测中...' : '自动检测'}
              </Button>
              <div className="flex items-center gap-2">
                <Switch id={edgeFirstId} checked={edgeFirst} onCheckedChange={setEdgeFirst} />
                <Label
                  htmlFor={edgeFirstId}
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  优先使用 Edge
                </Label>
              </div>
            </div>

            {/* 路径输入和浏览 */}
            <div className="flex gap-3 items-center">
              <Input
                value={path}
                onChange={e => setPath(e.target.value)}
                placeholder="浏览器可执行文件路径"
                className="font-mono text-sm h-10 flex-1 min-w-0"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-10 shrink-0 px-4"
                onClick={handleSelectChrome}
              >
                <FolderSearchIcon className="mr-2 h-4 w-4" />
                浏览
              </Button>
            </div>

            {/* 支持的浏览器提示 */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <span>支持：</span>
              <span className="flex items-center gap-1">
                <SimpleIconsGooglechrome className="w-3.5 h-3.5" />
                Chrome
              </span>
              <span className="text-muted-foreground/50">|</span>
              <span className="flex items-center gap-1">
                <SimpleIconsMicrosoftedge className="w-3.5 h-3.5" />
                Edge
              </span>
            </div>
          </div>
        </div>

        {/* 分隔线 */}
        <div className="h-px bg-border" />

        {/* 账号管理分组 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <div className="h-4 w-1 rounded-full bg-primary" />
            账号管理
          </div>

          <div className="pl-3 space-y-3">
            <SettingRow label="重置登录状态" description="清除已保存的登录信息，下次需重新登录">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <EraserIcon className="mr-2 h-4 w-4" />
                    重置
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认重置登录状态？</AlertDialogTitle>
                    <AlertDialogDescription>
                      将清除已保存的登录信息，下次启动需重新登录。此操作无法撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCookiesReset}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      确认重置
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SettingRow>

            <SettingRow label="清除本地数据" description="清除 token、记住登录等，登录框将为空">
              <ClearLocalLoginButton />
            </SettingRow>

            <SettingRow
              label="删除当前账号"
              description={currentAccount ? `当前账号：${currentAccount.name}` : '无账号'}
            >
              {!isDefaultAccount ? (
                isConnected ? (
                  <Button variant="outline" size="sm" className="h-9" disabled>
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    请先断开连接
                  </Button>
                ) : (
                  <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9">
                        <TrashIcon className="mr-2 h-4 w-4" />
                        删除账号
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认删除该账号？</AlertDialogTitle>
                        <AlertDialogDescription>
                          账号删除后无法恢复，请确保该账号的任务已停止。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAccount}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          确认删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )
              ) : (
                <Button variant="outline" size="sm" className="h-9" disabled>
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  默认账号不可删
                </Button>
              )}
            </SettingRow>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ClearLocalLoginButton() {
  const { toast } = useToast()
  const clearTokensAndUnauth = useAuthStore(s => s.clearTokensAndUnauth)
  const handleClear = async () => {
    try {
      if (window.ipcRenderer) {
        await window.ipcRenderer.invoke(IPC_CHANNELS.app.clearLocalLoginData)
      }
      localStorage.removeItem(AUTH_REMEMBER_ME_KEY)
      localStorage.removeItem(AUTH_LAST_IDENTIFIER_KEY)
      localStorage.removeItem(AUTH_ZUSTAND_PERSIST_KEY)
      clearTokensAndUnauth()
      toast.success('已清除本地登录数据')
    } catch (e) {
      console.error(e)
      toast.error('清除失败，请重试')
    }
  }
  return (
    <Button variant="outline" size="sm" className="h-9" onClick={handleClear}>
      <EraserIcon className="mr-2 h-4 w-4" />
      清除
    </Button>
  )
}
