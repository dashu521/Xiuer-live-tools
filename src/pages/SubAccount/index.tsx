import { useMemoizedFn } from 'ahooks'
import {
  BookOpen,
  Download,
  FolderOpen,
  Link2,
  MessageSquare,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { Title } from '@/components/common/Title'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAccounts } from '@/hooks/useAccounts'
import { useIpcListener } from '@/hooks/useIpc'
import type { SubAccountGroup } from '@/hooks/useSubAccount'
import {
  type SubAccount as SubAccountItem,
  useCurrentSubAccount,
  useSubAccountActions,
  useSyncSubAccountsOnMount,
} from '@/hooks/useSubAccount'
import { useToast } from '@/hooks/useToast'
import { MESSAGE_CATEGORIES, MESSAGE_VARIABLES, PRESET_MESSAGES } from './constants'

const viewerPlatforms: Record<string, string> = {
  douyin: '抖音',
  buyin: '抖音',
  xiaohongshu: '小红书',
  wxchannel: '视频号',
  taobao: '淘宝直播',
  kuaishou: '快手',
}

export default function SubAccount() {
  const { toast } = useToast()
  const currentAccountId = useAccounts(state => state.currentAccountId)

  const isRunning = useCurrentSubAccount(ctx => ctx.isRunning)
  const config = useCurrentSubAccount(ctx => ctx.config)
  const accounts = useCurrentSubAccount(ctx => ctx.accounts)
  const batchCount = useCurrentSubAccount(ctx => ctx.batchCount)
  const liveRoomUrl = useCurrentSubAccount(ctx => ctx.liveRoomUrl)
  const actions = useSubAccountActions()

  useSyncSubAccountsOnMount()

  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountPlatform, setNewAccountPlatform] =
    useState<keyof typeof viewerPlatforms>('douyin')
  const [isAdding, setIsAdding] = useState(false)
  const [showPresetLibrary, setShowPresetLibrary] = useState(false)
  const [showGroupManager, setShowGroupManager] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<{
    current: number
    total: number
    completed: number
    failed: number
  } | null>(null)

  // 监听批量发送进度
  useIpcListener(IPC_CHANNELS.tasks.subAccount.batchProgress, (accountId, data) => {
    if (accountId === currentAccountId) {
      setBatchProgress(data)
    }
  })

  // 进度完成后自动隐藏
  useEffect(() => {
    if (batchProgress && batchProgress.current >= batchProgress.total && batchProgress.total > 0) {
      const timer = setTimeout(() => setBatchProgress(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [batchProgress])

  // 监听小号状态变更事件（实时同步后端状态）
  useIpcListener(IPC_CHANNELS.tasks.subAccount.accountStatusChanged, (accountId, data) => {
    if (accountId === currentAccountId && data.status) {
      console.log('[SubAccount] ✅ 收到状态变更事件:', {
        accountId: data.accountId,
        accountName: data.accountName,
        status: data.status,
        error: data.error,
        timestamp: new Date().toISOString(),
      })
      actions.updateAccountStatus(data.accountId, data.status, data.error)

      // 【关键】如果是 connected 状态，显示成功提示
      if (data.status === 'connected') {
        console.log(`[SubAccount] ✅ 小号 ${data.accountId} 已连接`)
      }
    }
  })

  // 自动获取直播间 URL
  const fetchLiveRoomUrl = useMemoizedFn(async () => {
    if (!currentAccountId) return
    try {
      const result = await window.ipcRenderer.invoke(
        IPC_CHANNELS.tasks.liveControl.getLiveRoomUrl,
        currentAccountId,
      )
      // 后端已经处理了 URL 有效性检测，直接使用结果
      if (result.success && result.url) {
        actions.setLiveRoomUrl(result.url)
        console.log('[SubAccount] 自动获取直播间 URL 成功:', result.url)
      }
    } catch (error) {
      // 静默失败，不影响用户体验
      console.debug('获取直播间 URL 失败:', error)
    }
  })

  // 组件挂载时和 currentAccountId 变化时尝试获取
  useEffect(() => {
    fetchLiveRoomUrl()
  }, [fetchLiveRoomUrl])

  const handleTaskButtonClick = useMemoizedFn(async () => {
    if (!isRunning) {
      if (accounts.length === 0) {
        toast.error('请先添加小号')
        return
      }
      if (accounts.filter(a => a.status === 'connected').length === 0) {
        toast.error('请至少登录一个小号')
        return
      }
      // 验证消息内容
      const validMessages = config.messages.filter(m => m.content.trim().length > 0)
      if (validMessages.length === 0) {
        toast.error('请至少添加一条有效的消息内容')
        return
      }
      if (validMessages.length !== config.messages.length) {
        toast.info('已过滤空消息内容')
      }
      const messagesForIPC = validMessages.map(m => ({
        content: m.content.trim(),
        weight: m.weight,
      }))
      const result = await window.ipcRenderer.invoke(
        IPC_CHANNELS.tasks.subAccount.start,
        currentAccountId,
        {
          scheduler: config.scheduler,
          messages: messagesForIPC,
          random: config.random,
          extraSpaces: config.extraSpaces,
          rotateAccounts: config.rotateAccounts,
          rotateGroups: config.rotateGroups,
          accounts: accounts.map(a => ({ id: a.id, name: a.name, platform: a.platform })),
          groups: config.groups ?? [],
        },
      )
      if (result) {
        actions.setIsRunning(true)
        toast.success('小号互动任务已启动')
      } else {
        toast.error('启动任务失败')
      }
    } else {
      const result = await window.ipcRenderer.invoke(
        IPC_CHANNELS.tasks.subAccount.stop,
        currentAccountId,
      )
      if (result) {
        actions.setIsRunning(false)
        toast.success('小号互动任务已停止')
      }
    }
  })

  const handleAddAccount = useMemoizedFn(async () => {
    if (!newAccountName.trim()) {
      toast.error('请输入小号名称')
      return
    }

    const newAccount: SubAccountItem = {
      id: crypto.randomUUID(),
      name: newAccountName.trim(),
      platform: newAccountPlatform as LiveControlPlatform,
      status: 'idle',
      stats: {
        totalSent: 0,
        successCount: 0,
        failCount: 0,
      },
    }

    const result = await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.addAccount,
      currentAccountId,
      {
        id: newAccount.id,
        name: newAccount.name,
        platform: newAccount.platform,
      },
    )

    if (result) {
      actions.addAccount(newAccount)
      toast.success(`小号 ${newAccount.name} 添加成功`)
      setNewAccountName('')
      setIsAdding(false)
    } else {
      toast.error('添加小号失败')
    }
  })

  const handleRemoveAccount = useMemoizedFn(async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId)
    if (!account) return

    await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.removeAccount,
      currentAccountId,
      accountId,
    )
    actions.removeAccount(accountId)
    toast.success(`小号 ${account.name} 已移除`)
  })

  const handleLoginAccount = useMemoizedFn(async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId)
    if (!account) return

    actions.updateAccountStatus(accountId, 'connecting')
    toast.info(`正在登录小号 ${account.name}，请在新打开的浏览器中完成登录（观众身份）`)

    const result = await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.loginAccount,
      currentAccountId,
      accountId,
    )

    if (result.success) {
      // 【关键】使用后端返回的真实状态，而不是硬编码为 'connected'
      // 因为二次验证时，后端返回的状态可能是 'connecting'（等待验证完成）
      const newStatus = result.session?.status || 'connected'
      actions.updateAccountStatus(accountId, newStatus, result.session?.error)

      if (newStatus === 'connected') {
        toast.success(`小号 ${account.name} 登录成功`)

        // 【新增】登录成功后，如果当前没有设置直播间地址，尝试从主账号获取
        // 后端会自动检测主账号是否在中控台，并尝试提取直播间链接
        if (!liveRoomUrl.trim()) {
          try {
            const liveRoomResult = await window.ipcRenderer.invoke(
              IPC_CHANNELS.tasks.liveControl.getLiveRoomUrl,
              currentAccountId,
            )
            if (liveRoomResult.success && liveRoomResult.url) {
              actions.setLiveRoomUrl(liveRoomResult.url)
              toast.success('已自动获取直播间地址')
            } else if (liveRoomResult.error) {
              // 获取失败时给出提示
              toast.info('无法自动获取直播间地址，请手动输入')
              console.log('[SubAccount] 自动获取直播间 URL 失败:', liveRoomResult.error)
            }
          } catch (error) {
            console.debug('自动获取直播间 URL 失败:', error)
          }
        }
      } else {
        // 正在等待二次验证
        toast.info(`小号 ${account.name} 正在等待验证，请在浏览器中完成验证`)
      }
    } else {
      actions.updateAccountStatus(accountId, 'error', result.error)
      toast.error(`小号 ${account.name} 登录失败：${result.error}`)
    }
  })

  const handleDisconnectAccount = useMemoizedFn(async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId)
    if (!account) return

    const result = await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.disconnectAccount,
      currentAccountId,
      accountId,
    )

    if (result.success) {
      actions.updateAccountStatus(accountId, 'idle')
      toast.success(`小号 ${account.name} 已断开连接`)
    } else {
      toast.error(`小号 ${account.name} 断开连接失败`)
    }
  })

  const handleEnterLiveRoom = useMemoizedFn(async (accountId: string) => {
    if (!liveRoomUrl.trim()) {
      toast.error('请先输入直播间地址')
      return
    }

    // 验证 URL 格式
    try {
      new URL(liveRoomUrl.trim())
    } catch {
      toast.error('请输入有效的直播间地址（URL 格式）')
      return
    }

    // 【关键】验证是否为真正的直播间地址，排除中控台等管理页面
    const url = liveRoomUrl.trim()
    const isLiveRoomUrl =
      (url.includes('live.douyin.com') ||
        url.includes('live.kuaishou.com') ||
        (url.includes('/live/') && !url.includes('dashboard'))) &&
      !url.includes('dashboard') &&
      !url.includes('control') &&
      !url.includes('compass')

    if (!isLiveRoomUrl) {
      toast.error('请输入真正的直播间地址，而不是中控台地址')
      toast.info('直播间地址格式：https://live.douyin.com/房间号')
      console.log('[SubAccount] 无效的直播间 URL:', url)
      return
    }

    const account = accounts.find(a => a.id === accountId)
    if (!account) return

    // 【关键】再次检查账号状态，确保与后端一致
    if (account.status !== 'connected') {
      toast.error(
        `小号尚未连接完成，当前状态：${account.status === 'connecting' ? '等待验证' : account.status}`,
      )
      return
    }

    // 【新增】检查是否为主账号直播间 URL，如果是则提示用户
    let isMainAccountLiveRoom = false
    try {
      const mainLiveRoomResult = await window.ipcRenderer.invoke(
        IPC_CHANNELS.tasks.liveControl.getLiveRoomUrl,
        currentAccountId,
      )
      if (mainLiveRoomResult.success && mainLiveRoomResult.url) {
        // 如果当前设置的 URL 与主账号直播间 URL 相同或是其子路径
        if (
          liveRoomUrl === mainLiveRoomResult.url ||
          liveRoomUrl.startsWith(mainLiveRoomResult.url.split('?')[0])
        ) {
          isMainAccountLiveRoom = true
        }
      }
    } catch (_error) {
      // 静默处理，不影响流程
    }

    if (isMainAccountLiveRoom) {
      toast.info(`小号 ${account.name} 将进入主账号直播间...`)
    } else {
      toast.info(`小号 ${account.name} 正在进入直播间...`)
    }

    const result = await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.enterLiveRoom,
      currentAccountId,
      accountId,
      liveRoomUrl.trim(),
    )

    if (result.success) {
      toast.success(`小号 ${account.name} 已进入直播间`)
      if (isMainAccountLiveRoom) {
        toast.success('✓ 主账号直播间')
      }
    } else {
      toast.error(`进入直播间失败：${result.error}`)
    }
  })

  const handleEnterAllLiveRoom = useMemoizedFn(async () => {
    if (!liveRoomUrl.trim()) {
      toast.error('请先输入直播间地址')
      return
    }

    // 验证 URL 格式
    try {
      new URL(liveRoomUrl.trim())
    } catch {
      toast.error('请输入有效的直播间地址（URL 格式）')
      return
    }

    // 【关键】验证是否为真正的直播间地址，排除中控台等管理页面
    const url = liveRoomUrl.trim()
    const isLiveRoomUrl =
      (url.includes('live.douyin.com') ||
        url.includes('live.kuaishou.com') ||
        (url.includes('/live/') && !url.includes('dashboard'))) &&
      !url.includes('dashboard') &&
      !url.includes('control') &&
      !url.includes('compass')

    if (!isLiveRoomUrl) {
      toast.error('请输入真正的直播间地址，而不是中控台地址')
      toast.info('直播间地址格式：https://live.douyin.com/房间号')
      console.log('[SubAccount] 无效的直播间 URL:', url)
      return
    }

    const connected = accounts.filter(a => a.status === 'connected')
    if (connected.length === 0) {
      toast.error('没有已连接的小号')
      return
    }

    toast.info(`正在让 ${connected.length} 个小号进入直播间...`)

    let successCount = 0
    for (const account of connected) {
      const result = await window.ipcRenderer.invoke(
        IPC_CHANNELS.tasks.subAccount.enterLiveRoom,
        currentAccountId,
        account.id,
        liveRoomUrl.trim(),
      )
      if (result.success) successCount++
    }

    toast.success(`${successCount}/${connected.length} 个小号已进入直播间`)
  })

  const handleLoadPreset = useMemoizedFn((categoryKey: keyof typeof PRESET_MESSAGES) => {
    const presetMessages = PRESET_MESSAGES[categoryKey]
    const existingContents = new Set(config.messages.map(m => m.content.trim().toLowerCase()))
    const newMessages = presetMessages
      .filter(msg => !existingContents.has(msg.content.trim().toLowerCase()))
      .map(msg => {
        existingContents.add(msg.content.trim().toLowerCase())
        return {
          id: crypto.randomUUID(),
          content: msg.content,
          weight: msg.weight,
        }
      })

    const mergedMessages = [...config.messages, ...newMessages]
    actions.setMessages(mergedMessages)

    const label = MESSAGE_CATEGORIES.find(c => c.key === categoryKey)?.label ?? '话术'
    if (newMessages.length === 0) {
      toast.info(`所选${label}与现有消息重复，未新增`)
    } else {
      toast.success(`已加载 ${newMessages.length} 条${label}话术`)
    }
    setShowPresetLibrary(false)
  })

  const handleClearMessages = useMemoizedFn(() => {
    if (config.messages.length <= 1) return
    actions.setMessages([{ id: crypto.randomUUID(), content: '', weight: 1 }])
    toast.success('已清空消息列表')
  })

  const handleSendBatch = useMemoizedFn(async () => {
    const connectedCount = accounts.filter(a => a.status === 'connected').length
    if (connectedCount === 0) {
      toast.error('没有已连接的小号')
      return
    }

    // 重置进度
    setBatchProgress({ current: 0, total: connectedCount * batchCount, completed: 0, failed: 0 })

    toast.info(`开始批量发送，${connectedCount} 个小号将各发送 ${batchCount} 条消息`)

    const messagesForIPC = config.messages.map(m => ({
      content: m.content,
      weight: m.weight,
    }))

    const result = await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.sendBatch,
      currentAccountId,
      batchCount,
      messagesForIPC,
    )

    if (result.success) {
      toast.success('批量发送已启动')
    } else {
      toast.error(`批量发送失败: ${result.error}`)
      setBatchProgress(null)
    }
  })

  const handleAddGroup = useMemoizedFn(() => {
    if (!newGroupName.trim()) {
      toast.error('请输入分组名称')
      return
    }

    const newGroup: SubAccountGroup = {
      id: crypto.randomUUID(),
      name: newGroupName.trim(),
      accountIds: [],
      enabled: true,
    }

    actions.addGroup(newGroup)
    toast.success(`分组 ${newGroup.name} 创建成功`)
    setNewGroupName('')
  })

  const handleRemoveGroup = useMemoizedFn((groupId: string) => {
    actions.removeGroup(groupId)
    toast.success('分组已删除')
  })

  const handleToggleGroup = useMemoizedFn((groupId: string, enabled: boolean) => {
    actions.updateGroup(groupId, { enabled })
  })

  const handleAssignToGroup = useMemoizedFn((accountId: string, groupId: string | undefined) => {
    actions.setAccountGroup(accountId, groupId)
    toast.success(groupId ? '已分配到分组' : '已移出分组')
  })

  const handleExportAccounts = useMemoizedFn(async () => {
    const result = await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.exportAccounts,
      currentAccountId,
    )
    if (result.success && result.data) {
      const blob = new Blob([result.data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sub-accounts-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('小号配置已导出')
    } else {
      toast.error('导出失败')
    }
  })

  const handleImportAccounts = useMemoizedFn(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const result = await window.ipcRenderer.invoke(
        IPC_CHANNELS.tasks.subAccount.importAccounts,
        currentAccountId,
        text,
      )
      if (result.success) {
        toast.success(`成功导入 ${result.added} 个小号`)
        const accountsResult = await window.ipcRenderer.invoke(
          IPC_CHANNELS.tasks.subAccount.getAllAccounts,
          currentAccountId,
        )
        if (accountsResult) {
          actions.setAccounts(
            accountsResult.map((a: any) => ({
              ...a,
              stats: a.stats || { totalSent: 0, successCount: 0, failCount: 0 },
            })),
          )
        }
      } else {
        toast.error(`导入失败: ${result.error}`)
      }
    } catch {
      toast.error('文件读取失败')
    }
    event.target.value = ''
  })

  const connectedCount = accounts.filter(a => a.status === 'connected').length

  return (
    <div className="w-full py-6 flex flex-col gap-6 min-h-0 overflow-auto">
      <div className="shrink-0">
        <Title title="小号互动" description="使用多个小号在直播间发送弹幕互动" />
      </div>

      <div className="flex flex-col gap-6 min-w-0 flex-1 min-h-0">
        {/* 直播间地址配置 */}
        <Card>
          <CardHeader className="bg-muted/50 px-6 py-4">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              直播间配置
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col gap-3">
              <Label htmlFor="liveRoomUrl" className="text-sm text-muted-foreground">
                直播间地址（小号将以观众身份进入此直播间发送弹幕）
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="liveRoomUrl"
                  placeholder="https://live.douyin.com/xxxx 或 https://www.xiaohongshu.com/live/xxxx"
                  value={liveRoomUrl}
                  onChange={e => actions.setLiveRoomUrl(e.target.value)}
                  className="flex-1"
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={fetchLiveRoomUrl}
                        className="shrink-0"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>自动获取主账号当前直播间链接</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEnterAllLiveRoom}
                  disabled={connectedCount === 0 || !liveRoomUrl.trim()}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  全部进入
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                提示：点击 <Link2 className="h-3 w-3 inline" />{' '}
                按钮可自动获取主账号当前直播间链接，或手动粘贴直播间分享链接
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 任务控制卡片 */}
        <Card>
          <CardHeader className="bg-muted/50 px-6 py-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              任务控制
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">{isRunning ? '正在运行' : '已停止'}</div>
                  <div className="text-xs text-muted-foreground">{connectedCount} 个小号在线</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowGroupManager(!showGroupManager)}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  分组管理
                </Button>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    value={batchCount}
                    onChange={e => actions.setBatchCount(Math.max(1, Number(e.target.value)))}
                    className="w-16 h-8 text-center"
                    min={1}
                    max={50}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendBatch}
                    disabled={isRunning || connectedCount === 0 || !liveRoomUrl.trim()}
                  >
                    一键刷屏
                  </Button>
                </div>
                <Button
                  size="sm"
                  onClick={handleTaskButtonClick}
                  variant={isRunning ? 'destructive' : 'default'}
                >
                  {isRunning ? '停止任务' : '开始任务'}
                </Button>
              </div>
            </div>

            {/* 批量发送进度条 */}
            {batchProgress && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">批量发送进度</span>
                  <span className="font-medium">
                    {batchProgress.current} / {batchProgress.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="text-green-600">成功: {batchProgress.completed}</span>
                  <span className="text-destructive">失败: {batchProgress.failed}</span>
                  {batchProgress.current >= batchProgress.total && (
                    <span className="text-primary ml-auto">发送完成</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 小号管理卡片 */}
        <Card>
          <CardHeader className="bg-muted/50 px-6 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                小号管理
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportAccounts}
                  disabled={accounts.length === 0}
                >
                  <Download className="h-4 w-4 mr-1" />
                  导出
                </Button>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportAccounts}
                    className="hidden"
                  />
                  <Button variant="ghost" size="sm" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-1" />
                      导入
                    </span>
                  </Button>
                </label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* 分组管理面板 */}
            {showGroupManager && (
              <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">分组管理</h4>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="分组名称"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      className="w-32 h-8"
                    />
                    <Button size="sm" onClick={handleAddGroup}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {config.groups && config.groups.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {config.groups.map(group => (
                      <div
                        key={group.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
                          group.enabled
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <span>{group.name}</span>
                        <span className="text-muted-foreground">({group.accountIds.length})</span>
                        <button
                          onClick={() => handleToggleGroup(group.id, !group.enabled)}
                          className="hover:underline"
                        >
                          {group.enabled ? '禁用' : '启用'}
                        </button>
                        <button
                          onClick={() => handleRemoveGroup(group.id)}
                          className="text-destructive hover:underline"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {config.groups && config.groups.length > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <input
                      type="checkbox"
                      id="rotateGroups"
                      checked={config.rotateGroups}
                      onChange={e => actions.setRotateGroups(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="rotateGroups" className="text-sm">
                      启用分组轮换（按分组顺序使用小号）
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* 分组筛选 */}
            {config.groups && config.groups.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">筛选:</span>
                <button
                  onClick={() => setSelectedGroup(null)}
                  className={`text-sm px-2 py-1 rounded ${
                    selectedGroup === null ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  全部
                </button>
                {config.groups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroup(group.id)}
                    className={`text-sm px-2 py-1 rounded ${
                      selectedGroup === group.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    {group.name}
                  </button>
                ))}
              </div>
            )}

            {/* 小号列表 */}
            {accounts.length === 0 ? (
              <div className="border rounded-lg p-8 text-center space-y-4 bg-muted/20">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">还没有添加小号</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    添加小号后，可以让它们在直播间发送弹幕进行互动，帮助您活跃直播间气氛
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdding(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  添加第一个小号
                </button>
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    已连接
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    连接中
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-gray-300" />
                    未连接
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts
                  .filter(account => {
                    if (selectedGroup === null) return true
                    const group = config.groups?.find(g => g.id === selectedGroup)
                    return group?.accountIds.includes(account.id)
                  })
                  .map(account => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            account.status === 'connected'
                              ? 'bg-green-500'
                              : account.status === 'connecting'
                                ? 'bg-yellow-500 animate-pulse'
                                : account.status === 'error'
                                  ? 'bg-red-500'
                                  : 'bg-gray-300'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{account.name}</span>
                            {account.group && (
                              <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                                {account.group}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {viewerPlatforms[account.platform] || account.platform} ·{' '}
                            {account.status === 'connected'
                              ? '已连接'
                              : account.status === 'connecting'
                                ? account.error || '连接中'
                                : account.status === 'error'
                                  ? `错误: ${account.error}`
                                  : '未连接'}
                            {account.stats.totalSent > 0 && (
                              <span className="ml-2 text-green-600">
                                发送{account.stats.successCount}/{account.stats.totalSent}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {config.groups && config.groups.length > 0 && (
                          <select
                            value={
                              config.groups?.find(g => g.accountIds.includes(account.id))?.id || ''
                            }
                            onChange={e =>
                              handleAssignToGroup(account.id, e.target.value || undefined)
                            }
                            className="text-xs border rounded px-2 py-1 bg-background"
                          >
                            <option value="">未分组</option>
                            {config.groups.map(group => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {account.status === 'connected' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEnterLiveRoom(account.id)}
                              disabled={!liveRoomUrl.trim()}
                            >
                              进入直播间
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDisconnectAccount(account.id)}
                            >
                              断开
                            </Button>
                          </>
                        )}
                        {account.status !== 'connected' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLoginAccount(account.id)}
                            disabled={account.status === 'connecting'}
                          >
                            {account.status === 'connecting' ? '验证中...' : '登录'}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAccount(account.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* 添加小号 */}
            {isAdding ? (
              <div className="flex items-center gap-2 p-3 border rounded-lg">
                <Input
                  placeholder="小号名称"
                  value={newAccountName}
                  onChange={e => setNewAccountName(e.target.value)}
                  className="flex-1"
                />
                <Select
                  value={newAccountPlatform}
                  onValueChange={v => setNewAccountPlatform(v as keyof typeof viewerPlatforms)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(viewerPlatforms).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAddAccount}>
                  确认
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                  取消
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => setIsAdding(true)}>
                <Plus className="h-4 w-4 mr-2" />
                添加小号
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 消息设置卡片 */}
        <Card>
          <CardHeader className="bg-muted/50 px-6 py-4">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              消息设置
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* 话术库按钮 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">话术库</div>
                <div className="text-xs text-muted-foreground">快速加载预设互动话术</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPresetLibrary(!showPresetLibrary)}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                {showPresetLibrary ? '关闭' : '加载话术'}
              </Button>
            </div>

            {showPresetLibrary && (
              <div className="p-3 border rounded-lg space-y-2">
                <div className="text-xs text-muted-foreground mb-2">选择要加载的话术分类：</div>
                <div className="flex flex-wrap gap-2">
                  {MESSAGE_CATEGORIES.map(category => (
                    <Button
                      key={category.key}
                      variant="secondary"
                      size="sm"
                      onClick={() => handleLoadPreset(category.key as keyof typeof PRESET_MESSAGES)}
                    >
                      {category.label}
                    </Button>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  提示：加载后会合并到现有消息列表中
                </div>
              </div>
            )}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-xs text-muted-foreground cursor-help underline">
                    查看消息变量说明
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-1">
                    {MESSAGE_VARIABLES.map(v => (
                      <div key={v.variable} className="text-xs">
                        <span className="font-mono text-primary">{v.variable}</span>
                        <span className="text-muted-foreground ml-2">{v.description}</span>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="h-px bg-border" />

            {/* 消息列表 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>消息列表 ({config.messages.length})</Label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearMessages}
                    disabled={config.messages.length <= 1}
                    title="清空后保留一条空消息"
                  >
                    清空
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newMsg = {
                        id: crypto.randomUUID(),
                        content: '',
                        weight: 1,
                      }
                      actions.setMessages([...config.messages, newMsg])
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    添加
                  </Button>
                </div>
              </div>
              {config.messages.map((msg, idx) => (
                <div key={msg.id} className="flex items-center gap-2">
                  <Input
                    value={msg.content}
                    onChange={e => {
                      const value = e.target.value
                      if (value.length > 50) {
                        toast.error('消息内容不能超过50个字符')
                        return
                      }
                      const updated = [...config.messages]
                      updated[idx] = { ...msg, content: value }
                      actions.setMessages(updated)
                    }}
                    onBlur={e => {
                      const trimmed = e.target.value.trim()
                      if (trimmed !== e.target.value) {
                        const updated = [...config.messages]
                        updated[idx] = { ...msg, content: trimmed }
                        actions.setMessages(updated)
                      }
                    }}
                    placeholder={`消息 ${idx + 1}`}
                    className="flex-1"
                    maxLength={50}
                  />
                  <Input
                    type="number"
                    value={msg.weight}
                    onChange={e => {
                      const updated = [...config.messages]
                      updated[idx] = { ...msg, weight: Math.max(1, Number(e.target.value)) }
                      actions.setMessages(updated)
                    }}
                    className="w-16"
                    min={1}
                    title="权重（数字越大被选中概率越高）"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (config.messages.length <= 1) {
                        toast.error('至少保留一条消息')
                        return
                      }
                      actions.setMessages(config.messages.filter(m => m.id !== msg.id))
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-2">
              <Label>发送间隔（秒）</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={config.scheduler.interval[0] / 1000}
                  onChange={e =>
                    actions.setScheduler({
                      interval: [Number(e.target.value) * 1000, config.scheduler.interval[1]],
                    })
                  }
                  className="w-20"
                  min={5}
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  value={config.scheduler.interval[1] / 1000}
                  onChange={e =>
                    actions.setScheduler({
                      interval: [config.scheduler.interval[0], Number(e.target.value) * 1000],
                    })
                  }
                  className="w-20"
                  min={5}
                />
                <span className="text-sm text-muted-foreground">秒</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">随机发送</div>
                <div className="text-xs text-muted-foreground">
                  按权重随机选择消息发送（关闭则按顺序）
                </div>
              </div>
              <Switch checked={config.random} onCheckedChange={actions.setRandom} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">插入随机空格</div>
                <div className="text-xs text-muted-foreground">避免被平台检测为重复内容</div>
              </div>
              <Switch checked={config.extraSpaces} onCheckedChange={actions.setExtraSpaces} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">轮换账号</div>
                <div className="text-xs text-muted-foreground">
                  按顺序轮换使用小号（关闭则随机选择）
                </div>
              </div>
              <Switch checked={config.rotateAccounts} onCheckedChange={actions.setRotateAccounts} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
