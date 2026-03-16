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
import type { IpcChannels } from 'shared/electron-api'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { isSameSubAccountLiveRoomUrl } from 'shared/subAccountLiveRoom'
import { SUB_ACCOUNT_WORKSPACE_ID } from 'shared/subAccountWorkspace'
import { Title } from '@/components/common/Title'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import type { SubAccountGroup, SubAccountPresetCategory } from '@/hooks/useSubAccount'
import {
  type SubAccount as SubAccountItem,
  useCurrentSubAccount,
  useSubAccountActions,
  useSyncSubAccountsOnMount,
} from '@/hooks/useSubAccount'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import { MESSAGE_VARIABLES } from './constants'

type LoginStateBadgeVariant = 'success' | 'warning' | 'info' | 'destructive' | 'neutral'
const UNGROUPED_SELECT_VALUE = '__ungrouped__'

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
  const presetCategories = useCurrentSubAccount(ctx => ctx.presetCategories)
  const actions = useSubAccountActions()

  useSyncSubAccountsOnMount()

  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountPlatform, setNewAccountPlatform] =
    useState<keyof typeof viewerPlatforms>('douyin')
  const [isAdding, setIsAdding] = useState(false)
  const [showPresetLibrary, setShowPresetLibrary] = useState(false)
  const [selectedPresetCategoryId, setSelectedPresetCategoryId] = useState<string | null>(null)
  const [showGroupManager, setShowGroupManager] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<{
    current: number
    total: number
    completed: number
    failed: number
  } | null>(null)
  const [enterProgress, setEnterProgress] = useState<{
    current: number
    total: number
    completed: number
    failed: number
    accountId: string
    accountName: string
    success: boolean
    error?: string
  } | null>(null)
  const [verificationNotice, setVerificationNotice] = useState<{
    accountId: string
    accountName?: string
    message: string
    timestamp: number
  } | null>(null)

  const showInvalidLiveRoomUrl = useMemoizedFn(() => {
    toast.warning({
      title: '直播间地址无效',
      description: '请输入真实的直播间分享链接，例如 https://live.douyin.com/房间号。',
      dedupeKey: 'subaccount-live-room-invalid',
    })
  })

  const getValidatedLiveRoomUrl = useMemoizedFn((requireActualLiveRoom = false) => {
    const trimmedUrl = liveRoomUrl.trim()
    if (!trimmedUrl) {
      toast.warning({
        title: '请先输入直播间地址',
        description: '填写目标直播间链接后，小号才能进房或发送互动消息。',
        dedupeKey: 'subaccount-live-room-required',
      })
      return null
    }

    try {
      new URL(trimmedUrl)
    } catch {
      showInvalidLiveRoomUrl()
      return null
    }

    if (requireActualLiveRoom) {
      const isLiveRoomUrl =
        (trimmedUrl.includes('live.douyin.com') ||
          trimmedUrl.includes('live.kuaishou.com') ||
          (trimmedUrl.includes('/live/') && !trimmedUrl.includes('dashboard'))) &&
        !trimmedUrl.includes('dashboard') &&
        !trimmedUrl.includes('control') &&
        !trimmedUrl.includes('compass')

      if (!isLiveRoomUrl) {
        showInvalidLiveRoomUrl()
        console.log('[SubAccount] 无效的直播间 URL:', trimmedUrl)
        return null
      }
    }

    return trimmedUrl
  })

  const getReadyAccounts = useMemoizedFn((targetUrl: string) =>
    accounts.filter(
      account =>
        account.status === 'connected' &&
        account.liveRoomStatus === 'entered' &&
        isSameSubAccountLiveRoomUrl(account.liveRoomUrl, targetUrl),
    ),
  )

  const getValidMessages = useMemoizedFn(() => {
    const validMessages = config.messages.filter(message => message.content.trim().length > 0)
    const ignoredCount = config.messages.length - validMessages.length

    if (validMessages.length === 0) {
      toast.warning({
        title: '请至少添加一条有效消息',
        description: '空白消息不会参与发送，请补充至少一条非空内容。',
        dedupeKey: 'subaccount-valid-messages-required',
      })
      return null
    }

    if (ignoredCount > 0) {
      toast.info({
        title: '已忽略空白消息',
        description: `${ignoredCount} 条空白内容不会参与发送。`,
        dedupeKey: 'subaccount-blank-messages-ignored',
      })
    }

    return validMessages
  })

  const syncAccountsFromBackend = useMemoizedFn(async () => {
    const list = await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.getAllAccounts,
      SUB_ACCOUNT_WORKSPACE_ID,
    )
    if (!Array.isArray(list)) return

    const currentGroups = new Map(accounts.map(account => [account.id, account.group]))
    actions.setAccounts(
      list.map((account: any) => ({
        ...account,
        group: currentGroups.get(account.id),
        stats: account.stats || { totalSent: 0, successCount: 0, failCount: 0 },
      })),
    )
  })

  // 监听批量发送进度
  useIpcListener(IPC_CHANNELS.tasks.subAccount.batchProgress, (workspaceId, data) => {
    if (workspaceId === SUB_ACCOUNT_WORKSPACE_ID) {
      setBatchProgress(data)
    }
  })

  useIpcListener(IPC_CHANNELS.tasks.subAccount.enterAllProgress, (workspaceId, data) => {
    if (workspaceId === SUB_ACCOUNT_WORKSPACE_ID) {
      setEnterProgress(data)
    }
  })

  useIpcListener(
    IPC_CHANNELS.tasks.subAccount.stoppedFor(SUB_ACCOUNT_WORKSPACE_ID) as keyof IpcChannels,
    () => {
      actions.setIsRunning(false)
    },
  )

  // 进度完成后自动隐藏
  useEffect(() => {
    if (batchProgress && batchProgress.current >= batchProgress.total && batchProgress.total > 0) {
      const timer = setTimeout(() => setBatchProgress(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [batchProgress])

  useEffect(() => {
    if (enterProgress && enterProgress.current >= enterProgress.total && enterProgress.total > 0) {
      const timer = setTimeout(() => setEnterProgress(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [enterProgress])

  // 监听小号状态和发送事件，由页面自己同步独立工作区状态
  useIpcListener(IPC_CHANNELS.tasks.subAccount.accountStatusChanged, (workspaceId, data) => {
    if (workspaceId === SUB_ACCOUNT_WORKSPACE_ID) {
      if (data.verificationRequired) {
        const message =
          data.verificationMessage || '检测到平台安全验证，请先在浏览器完成处理后再重新启动任务'
        setVerificationNotice({
          accountId: data.accountId,
          accountName: data.accountName,
          message,
          timestamp: data.timestamp,
        })
        actions.setIsRunning(false)
        toast.warning({
          title: '检测到平台安全验证',
          description: `${data.accountName || '小号'} 需要先在浏览器中完成人工验证后再继续。`,
          dedupeKey: `subaccount-verification:${data.accountId}`,
        })
      }

      if (data.status) {
        console.log('[SubAccount] ✅ 收到状态变更事件:', {
          accountId: data.accountId,
          accountName: data.accountName,
          status: data.status,
          error: data.error,
          timestamp: new Date().toISOString(),
        })
      }
      void syncAccountsFromBackend()
    }
  })

  useEffect(() => {
    void syncAccountsFromBackend()
  }, [syncAccountsFromBackend])

  // 自动获取直播间 URL
  const fetchLiveRoomUrl = useMemoizedFn(async () => {
    if (!currentAccountId) {
      toast.info({
        title: '请手动填写直播间地址',
        description: '当前未选择主账号，无法自动获取直播间链接。',
        dedupeKey: 'subaccount-live-room-manual',
      })
      return
    }
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
      console.debug('获取直播间 URL 失败:', error)
      toast.info({
        title: '无法自动获取直播间地址',
        description: '请手动粘贴直播间分享链接。',
        dedupeKey: 'subaccount-live-room-fetch-failed',
      })
    }
  })

  const handleTaskButtonClick = useMemoizedFn(async () => {
    if (!isRunning) {
      setVerificationNotice(null)
      if (accounts.length === 0) {
        toast.warning({
          title: '请先添加小号',
          description: '至少添加一个小号后才能启动互动任务。',
          dedupeKey: 'subaccount-account-required',
        })
        return
      }
      if (accounts.filter(a => a.status === 'connected').length === 0) {
        toast.warning({
          title: '请至少登录一个小号',
          description: '先让至少一个小号完成登录，再启动互动任务。',
          dedupeKey: 'subaccount-login-required',
        })
        return
      }
      const targetUrl = getValidatedLiveRoomUrl()
      if (!targetUrl) {
        return
      }
      const readyAccounts = getReadyAccounts(targetUrl)
      if (readyAccounts.length === 0) {
        toast.warning({
          title: '没有可发送的小号',
          description: '请先让至少一个已登录小号进入目标直播间。',
          dedupeKey: 'subaccount-enter-room-required',
        })
        return
      }
      const validMessages = getValidMessages()
      if (!validMessages) {
        return
      }
      const messagesForIPC = validMessages.map(m => ({
        content: m.content.trim(),
        weight: m.weight,
      }))
      const result = await window.ipcRenderer.invoke(
        IPC_CHANNELS.tasks.subAccount.start,
        SUB_ACCOUNT_WORKSPACE_ID,
        {
          scheduler: config.scheduler,
          liveRoomUrl: targetUrl,
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
        toast.success({
          title: '互动任务已启动',
          description: `${readyAccounts.length} 个小号将参与互动发送。`,
          dedupeKey: 'subaccount-task-started',
        })
      } else {
        toast.error({
          title: '启动失败',
          description: '小号互动任务启动失败，请稍后重试。',
          dedupeKey: 'subaccount-task-start-failed',
        })
      }
    } else {
      const result = await window.ipcRenderer.invoke(
        IPC_CHANNELS.tasks.subAccount.stop,
        SUB_ACCOUNT_WORKSPACE_ID,
      )
      if (result) {
        actions.setIsRunning(false)
        toast.info({
          title: '互动任务已停止',
          description: '当前小号互动任务已停止。',
          dedupeKey: 'subaccount-task-stopped',
        })
      }
    }
  })

  const handleAddAccount = useMemoizedFn(async () => {
    if (!newAccountName.trim()) {
      toast.warning({
        title: '请输入小号名称',
        description: '填写名称后才能创建小号。',
        dedupeKey: 'subaccount-name-required',
      })
      return
    }

    const newAccount: SubAccountItem = {
      id: crypto.randomUUID(),
      name: newAccountName.trim(),
      platform: newAccountPlatform as LiveControlPlatform,
      status: 'idle',
      hasStorageState: false,
      liveRoomStatus: 'idle',
      stats: {
        totalSent: 0,
        successCount: 0,
        failCount: 0,
      },
    }

    const result = await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.addAccount,
      SUB_ACCOUNT_WORKSPACE_ID,
      {
        id: newAccount.id,
        name: newAccount.name,
        platform: newAccount.platform,
      },
    )

    if (result) {
      actions.addAccount(newAccount)
      toast.success({
        title: '小号已添加',
        description: `已创建小号“${newAccount.name}”。`,
        dedupeKey: `subaccount-added:${newAccount.id}`,
      })
      setNewAccountName('')
      setIsAdding(false)
    } else {
      toast.error({
        title: '添加失败',
        description: '小号创建失败，请稍后重试。',
        dedupeKey: 'subaccount-add-failed',
      })
    }
  })

  const handleRemoveAccount = useMemoizedFn(async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId)
    if (!account) return

    await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.removeAccount,
      SUB_ACCOUNT_WORKSPACE_ID,
      accountId,
    )
    actions.removeAccount(accountId)
    toast.info({
      title: '小号已移除',
      description: `已删除小号“${account.name}”。`,
      dedupeKey: `subaccount-removed:${accountId}`,
    })
  })

  const handleLoginAccount = useMemoizedFn(async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId)
    if (!account) return

    actions.updateAccountStatus(accountId, 'connecting')
    toast.info({
      title: '正在登录小号',
      description: `请在新打开的浏览器中完成“${account.name}”的观众登录。`,
      dedupeKey: `subaccount-login-start:${accountId}`,
    })

    const result = await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.loginAccount,
      SUB_ACCOUNT_WORKSPACE_ID,
      accountId,
    )

    if (result.success) {
      // 【关键】使用后端返回的真实状态，而不是硬编码为 'connected'
      // 因为二次验证时，后端返回的状态可能是 'connecting'（等待验证完成）
      const newStatus = result.session?.status || 'connected'
      actions.updateAccountStatus(accountId, newStatus, result.session?.error)

      if (newStatus === 'connected') {
        toast.success({
          title: '登录成功',
          description: `小号“${account.name}”已完成登录。`,
          dedupeKey: `subaccount-login-success:${accountId}`,
        })
      } else {
        // 正在等待二次验证
        toast.warning({
          title: '等待人工验证',
          description: `小号“${account.name}”需要在浏览器中完成平台验证。`,
          dedupeKey: `subaccount-login-verify:${accountId}`,
        })
      }
    } else {
      actions.updateAccountStatus(accountId, 'error', result.error)
      toast.error({
        title: '登录失败',
        description: `小号“${account.name}”登录失败：${result.error || '请稍后重试。'}`,
        dedupeKey: `subaccount-login-failed:${accountId}`,
      })
    }
  })

  const handleDisconnectAccount = useMemoizedFn(async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId)
    if (!account) return

    const result = await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.disconnectAccount,
      SUB_ACCOUNT_WORKSPACE_ID,
      accountId,
    )

    if (result.success) {
      actions.updateAccountStatus(accountId, 'idle')
      toast.info({
        title: '已断开连接',
        description: `小号“${account.name}”已断开。`,
        dedupeKey: `subaccount-disconnect:${accountId}`,
      })
    } else {
      toast.error({
        title: '断开失败',
        description: `小号“${account.name}”断开连接失败，请重试。`,
        dedupeKey: `subaccount-disconnect-failed:${accountId}`,
      })
    }
  })

  const handleClearSavedLoginState = useMemoizedFn(async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId)
    if (!account) return

    const result = await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.clearStorageState,
      SUB_ACCOUNT_WORKSPACE_ID,
      accountId,
    )

    if (result) {
      await syncAccountsFromBackend()
      toast.info({
        title: '登录态已清除',
        description: `“${account.name}”的已保存登录态已清除。`,
        dedupeKey: `subaccount-storage-cleared:${accountId}`,
      })
    } else {
      toast.error({
        title: '清除失败',
        description: '登录态清除失败，请重试。',
        dedupeKey: 'subaccount-storage-clear-failed',
      })
    }
  })

  const handleEnterLiveRoom = useMemoizedFn(async (accountId: string) => {
    const targetUrl = getValidatedLiveRoomUrl(true)
    if (!targetUrl) {
      return
    }

    const account = accounts.find(a => a.id === accountId)
    if (!account) return

    // 【关键】再次检查账号状态，确保与后端一致
    if (account.status !== 'connected') {
      toast.warning({
        title: '小号尚未准备完成',
        description: `“${account.name}”当前状态为${account.status === 'connecting' ? '等待验证' : account.status}，暂时无法进房。`,
        dedupeKey: `subaccount-not-ready:${accountId}`,
      })
      return
    }

    toast.info({
      title: '正在进入直播间',
      description: `小号“${account.name}”正在进入目标直播间。`,
      dedupeKey: `subaccount-enter-start:${accountId}`,
    })

    const result = await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.enterLiveRoom,
      SUB_ACCOUNT_WORKSPACE_ID,
      accountId,
      targetUrl,
    )

    if (result.success) {
      await syncAccountsFromBackend()
      toast.success({
        title: '已进入直播间',
        description: `小号“${account.name}”已进入目标直播间。`,
        dedupeKey: `subaccount-enter-success:${accountId}`,
      })
    } else {
      await syncAccountsFromBackend()
      toast.error({
        title: '进入直播间失败',
        description: `小号“${account.name}”进入直播间失败：${result.error || '请稍后重试。'}`,
        dedupeKey: `subaccount-enter-failed:${accountId}`,
      })
    }
  })

  const handleEnterAllLiveRoom = useMemoizedFn(async () => {
    const targetUrl = getValidatedLiveRoomUrl(true)
    if (!targetUrl) {
      return
    }

    const connected = accounts.filter(a => a.status === 'connected')
    if (connected.length === 0) {
      toast.warning({
        title: '没有可进房的小号',
        description: '请先让至少一个小号完成登录。',
        dedupeKey: 'subaccount-no-connected-accounts',
      })
      return
    }

    toast.info({
      title: '批量进房已开始',
      description: `正在让 ${connected.length} 个已登录小号进入目标直播间。`,
      dedupeKey: 'subaccount-enter-all-start',
    })
    setEnterProgress({
      current: 0,
      total: connected.length,
      completed: 0,
      failed: 0,
      accountId: '',
      accountName: '',
      success: true,
    })

    const result = await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.enterAllLiveRooms,
      SUB_ACCOUNT_WORKSPACE_ID,
      targetUrl,
      connected.map(account => account.id),
    )

    await syncAccountsFromBackend()

    if (result.successCount > 0) {
      toast.success({
        title: '批量进房已完成',
        description:
          result.failedCount > 0
            ? `${result.successCount}/${connected.length} 个小号进入成功，其余账号请查看列表状态。`
            : `${result.successCount}/${connected.length} 个小号已全部进入直播间。`,
        dedupeKey: 'subaccount-enter-all-finished',
      })
    } else if (!result.success && result.error) {
      toast.error({
        title: '批量进房失败',
        description: result.error,
        dedupeKey: 'subaccount-enter-all-failed',
      })
    }
  })

  const handleLoadPreset = useMemoizedFn((categoryKey: string) => {
    const category = presetCategories.find(item => item.id === categoryKey)
    if (!category) {
      toast.error({
        title: '未找到分类',
        description: '对应的话术分类不存在，请刷新后重试。',
        dedupeKey: 'subaccount-preset-not-found',
      })
      return
    }
    const presetMessages = category.messages
    const existingContents = new Set(config.messages.map(m => m.content.trim().toLowerCase()))
    const newMessages = presetMessages
      .filter(msg => msg.content.trim().length > 0)
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

    const label = category.name || '话术'
    if (newMessages.length === 0) {
      toast.info({
        title: '没有新增话术',
        description: `所选${label}与现有消息重复，未追加新内容。`,
        dedupeKey: `subaccount-preset-duplicate:${category.id}`,
      })
    } else {
      toast.success({
        title: '话术已加载',
        description: `已追加 ${newMessages.length} 条${label}话术。`,
        dedupeKey: `subaccount-preset-loaded:${category.id}`,
      })
    }
    setShowPresetLibrary(false)
  })

  const selectedPresetCategory =
    presetCategories.find(category => category.id === selectedPresetCategoryId) ??
    presetCategories[0] ??
    null

  useEffect(() => {
    if (!presetCategories.length) {
      setSelectedPresetCategoryId(null)
      return
    }
    if (
      !selectedPresetCategoryId ||
      !presetCategories.some(item => item.id === selectedPresetCategoryId)
    ) {
      setSelectedPresetCategoryId(presetCategories[0].id)
    }
  }, [presetCategories, selectedPresetCategoryId])

  const updatePresetCategory = useMemoizedFn(
    (
      categoryId: string,
      updater: (category: SubAccountPresetCategory) => SubAccountPresetCategory,
    ) => {
      actions.setPresetCategories(
        presetCategories.map(category =>
          category.id === categoryId ? updater(category) : category,
        ),
      )
    },
  )

  const handleAddPresetCategory = useMemoizedFn(() => {
    const newCategory: SubAccountPresetCategory = {
      id: crypto.randomUUID(),
      name: `自定义分类${presetCategories.length + 1}`,
      description: '可编辑的话术分类',
      messages: [{ id: crypto.randomUUID(), content: '', weight: 1 }],
    }
    actions.setPresetCategories([...presetCategories, newCategory])
    setSelectedPresetCategoryId(newCategory.id)
  })

  const handleRemovePresetCategory = useMemoizedFn((categoryId: string) => {
    if (presetCategories.length <= 1) {
      toast.warning({
        title: '至少保留一个分类',
        description: '最后一个话术分类不能删除。',
        dedupeKey: 'subaccount-preset-last-category',
      })
      return
    }
    actions.setPresetCategories(presetCategories.filter(category => category.id !== categoryId))
    if (selectedPresetCategoryId === categoryId) {
      const fallback = presetCategories.find(category => category.id !== categoryId)
      setSelectedPresetCategoryId(fallback?.id ?? null)
    }
  })

  const handleClearMessages = useMemoizedFn(() => {
    if (config.messages.length <= 1) return
    actions.setMessages([{ id: crypto.randomUUID(), content: '', weight: 1 }])
    toast.info({
      title: '消息列表已清空',
      description: '已保留一条空白消息，方便继续编辑。',
      dedupeKey: 'subaccount-messages-cleared',
    })
  })

  const handleSendBatch = useMemoizedFn(async () => {
    const targetUrl = getValidatedLiveRoomUrl()
    if (!targetUrl) {
      return
    }

    const readyAccounts = getReadyAccounts(targetUrl)
    const readyCount = readyAccounts.length
    if (readyCount === 0) {
      toast.warning({
        title: '没有可发送的小号',
        description: '请先让至少一个小号成功进入目标直播间。',
        dedupeKey: 'subaccount-batch-ready-required',
      })
      return
    }

    const validMessages = getValidMessages()
    if (!validMessages) {
      return
    }

    // 重置进度
    setBatchProgress({ current: 0, total: readyCount * batchCount, completed: 0, failed: 0 })

    toast.info({
      title: '批量发送已开始',
      description: `${readyCount} 个小号将各发送 ${batchCount} 条消息。`,
      dedupeKey: 'subaccount-batch-start',
    })

    const messagesForIPC = validMessages.map(m => ({
      content: m.content.trim(),
      weight: m.weight,
    }))

    const result = await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.sendBatch,
      SUB_ACCOUNT_WORKSPACE_ID,
      batchCount,
      messagesForIPC,
    )

    if (result.success) {
      toast.success({
        title: '批量发送已启动',
        description: '发送进度可在当前卡片中查看。',
        dedupeKey: 'subaccount-batch-started',
      })
    } else {
      toast.error({
        title: '批量发送失败',
        description: result.error || '请稍后重试。',
        dedupeKey: 'subaccount-batch-failed',
      })
      setBatchProgress(null)
    }
  })

  const handleAddGroup = useMemoizedFn(() => {
    if (!newGroupName.trim()) {
      toast.warning({
        title: '请输入分组名称',
        description: '填写名称后才能创建分组。',
        dedupeKey: 'subaccount-group-name-required',
      })
      return
    }

    const newGroup: SubAccountGroup = {
      id: crypto.randomUUID(),
      name: newGroupName.trim(),
      accountIds: [],
      enabled: true,
    }

    actions.addGroup(newGroup)
    toast.success({
      title: '分组已创建',
      description: `已创建分组“${newGroup.name}”。`,
      dedupeKey: `subaccount-group-added:${newGroup.id}`,
    })
    setNewGroupName('')
  })

  const handleRemoveGroup = useMemoizedFn((groupId: string) => {
    actions.removeGroup(groupId)
    toast.info({
      title: '分组已删除',
      description: '所选分组已移除。',
      dedupeKey: `subaccount-group-removed:${groupId}`,
    })
  })

  const handleToggleGroup = useMemoizedFn((groupId: string, enabled: boolean) => {
    actions.updateGroup(groupId, { enabled })
  })

  const handleAssignToGroup = useMemoizedFn((accountId: string, groupId: string | undefined) => {
    actions.setAccountGroup(accountId, groupId)
    toast.info({
      title: groupId ? '已加入分组' : '已移出分组',
      description: groupId ? '小号分组已更新。' : '小号已从当前分组移除。',
      dedupeKey: `subaccount-group-assignment:${accountId}`,
    })
  })

  const handleExportAccounts = useMemoizedFn(async () => {
    const result = await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.subAccount.exportAccounts,
      SUB_ACCOUNT_WORKSPACE_ID,
    )
    if (result.success && result.data) {
      const blob = new Blob([result.data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sub-accounts-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success({
        title: '导出完成',
        description: '小号配置文件已导出。',
        dedupeKey: 'subaccount-export-success',
      })
    } else {
      toast.error({
        title: '导出失败',
        description: '小号配置导出失败，请稍后重试。',
        dedupeKey: 'subaccount-export-failed',
      })
    }
  })

  const handleImportAccounts = useMemoizedFn(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const result = await window.ipcRenderer.invoke(
        IPC_CHANNELS.tasks.subAccount.importAccounts,
        SUB_ACCOUNT_WORKSPACE_ID,
        text,
      )
      if (result.success) {
        toast.success({
          title: '导入完成',
          description: `成功导入 ${result.added} 个小号。`,
          dedupeKey: 'subaccount-import-success',
        })
        await syncAccountsFromBackend()
      } else {
        toast.error({
          title: '导入失败',
          description: result.error || '导入失败，请检查文件内容。',
          dedupeKey: 'subaccount-import-failed',
        })
      }
    } catch {
      toast.error({
        title: '读取文件失败',
        description: '无法读取导入文件，请确认文件有效后重试。',
        dedupeKey: 'subaccount-import-read-failed',
      })
    }
    event.target.value = ''
  })

  const connectedCount = accounts.filter(a => a.status === 'connected').length
  const enteredCount = accounts.filter(
    account =>
      account.status === 'connected' &&
      account.liveRoomStatus === 'entered' &&
      isSameSubAccountLiveRoomUrl(account.liveRoomUrl, liveRoomUrl.trim()),
  ).length
  const isEnteringAll =
    !!enterProgress && enterProgress.total > 0 && enterProgress.current < enterProgress.total

  const getLoginStateBadge = (account: SubAccountItem) => {
    if (account.status === 'connected') {
      return {
        label: account.hasStorageState ? '登录态有效' : '已登录未保存',
        variant: (account.hasStorageState ? 'success' : 'warning') as LoginStateBadgeVariant,
      }
    }

    if (account.hasStorageState && account.status === 'connecting') {
      return {
        label: '校验登录态中',
        variant: 'warning' as LoginStateBadgeVariant,
      }
    }

    if (account.hasStorageState && account.status === 'error') {
      return {
        label: '登录态可能失效',
        variant: 'warning' as LoginStateBadgeVariant,
      }
    }

    if (account.hasStorageState) {
      return {
        label: '已保存登录态',
        variant: 'secondary' as LoginStateBadgeVariant,
      }
    }

    return {
      label: '未保存登录态',
      variant: 'neutral' as LoginStateBadgeVariant,
    }
  }

  const getAccountStatusDotClass = (status: SubAccountItem['status']) => {
    if (status === 'connected') return 'bg-emerald-400'
    if (status === 'connecting') return 'bg-amber-400 animate-pulse'
    if (status === 'error') return 'bg-red-400'
    return 'bg-muted-foreground/40'
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex min-h-full flex-col gap-6 py-6">
          <div className="shrink-0">
            <Title title="小号互动" description="使用多个小号在直播间发送弹幕互动" />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-6 min-w-0">
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
                      disabled={connectedCount === 0 || !liveRoomUrl.trim() || isEnteringAll}
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
                {verificationNotice && (
                  <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium">
                          {verificationNotice.accountName || '小号'} 需要人工完成平台安全验证
                        </p>
                        <p>{verificationNotice.message}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setVerificationNotice(null)}>
                        知道了
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{isRunning ? '正在运行' : '已停止'}</div>
                      <div className="text-xs text-muted-foreground">
                        {connectedCount} 个小号在线 · {enteredCount} 个已进目标直播间
                      </div>
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
                        disabled={
                          isRunning || enteredCount === 0 || !liveRoomUrl.trim() || isEnteringAll
                        }
                      >
                        一键刷屏
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleTaskButtonClick}
                      variant={isRunning ? 'destructive' : 'default'}
                      disabled={isEnteringAll}
                    >
                      {isRunning ? '停止任务' : '开始任务'}
                    </Button>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  开始任务后，仅已进入目标直播间的小号会参与自动发言。
                </p>

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
                      <Badge variant="success" className="font-medium">
                        成功: {batchProgress.completed}
                      </Badge>
                      <Badge variant="destructive" className="font-medium">
                        失败: {batchProgress.failed}
                      </Badge>
                      {batchProgress.current >= batchProgress.total && (
                        <span className="text-primary ml-auto">发送完成</span>
                      )}
                    </div>
                  </div>
                )}

                {enterProgress && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">
                        全部进入进度
                        {enterProgress.accountName ? ` · 当前 ${enterProgress.accountName}` : ''}
                      </span>
                      <span className="font-medium">
                        {enterProgress.current} / {enterProgress.total}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{
                          width: `${enterProgress.total > 0 ? (enterProgress.current / enterProgress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <Badge variant="success" className="font-medium">
                        成功: {enterProgress.completed}
                      </Badge>
                      <Badge variant="destructive" className="font-medium">
                        失败: {enterProgress.failed}
                      </Badge>
                      {enterProgress.current >= enterProgress.total && (
                        <span className="text-primary ml-auto">进入完成</span>
                      )}
                    </div>
                    {enterProgress.error && (
                      <div className="mt-2 text-xs text-destructive">{enterProgress.error}</div>
                    )}
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
                            className={`ui-hover-item flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
                              group.enabled
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <span>{group.name}</span>
                            <span className="text-muted-foreground">
                              ({group.accountIds.length})
                            </span>
                            <button
                              onClick={() => handleToggleGroup(group.id, !group.enabled)}
                              className="ui-hover-nav rounded px-1 py-0.5 hover:underline"
                            >
                              {group.enabled ? '禁用' : '启用'}
                            </button>
                            <button
                              onClick={() => handleRemoveGroup(group.id)}
                              className="ui-hover-nav rounded px-1 py-0.5 text-destructive hover:underline"
                            >
                              删除
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {config.groups && config.groups.length > 0 && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Checkbox
                          id="rotateGroups"
                          checked={config.rotateGroups}
                          onCheckedChange={checked => actions.setRotateGroups(checked === true)}
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
                      className={`ui-hover-nav rounded px-2 py-1 text-sm ${
                        selectedGroup === null
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      全部
                    </button>
                    {config.groups.map(group => (
                      <button
                        key={group.id}
                        onClick={() => setSelectedGroup(group.id)}
                        className={`ui-hover-nav rounded px-2 py-1 text-sm ${
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
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      添加第一个小号
                    </button>
                    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        已连接
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        连接中
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
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
                      .map(account => {
                        const loginStateBadge = getLoginStateBadge(account)
                        return (
                          <div
                            key={account.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  'h-2 w-2 rounded-full',
                                  getAccountStatusDotClass(account.status),
                                )}
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{account.name}</span>
                                  <Badge
                                    variant={loginStateBadge.variant}
                                    className="px-2 py-0.5 text-[11px] font-medium"
                                  >
                                    {loginStateBadge.label}
                                  </Badge>
                                  {account.group && (
                                    <Badge variant="secondary" className="px-2 py-0.5 text-[11px]">
                                      {account.group}
                                    </Badge>
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
                                  {account.status === 'connected' && (
                                    <span className="ml-2">
                                      ·{' '}
                                      {account.liveRoomStatus === 'entered' &&
                                      isSameSubAccountLiveRoomUrl(
                                        account.liveRoomUrl,
                                        liveRoomUrl.trim(),
                                      )
                                        ? '已进入目标直播间'
                                        : account.liveRoomStatus === 'entering'
                                          ? '进入中'
                                          : account.liveRoomStatus === 'error'
                                            ? `进入失败: ${account.lastEnterError || '未知错误'}`
                                            : '未进入直播间'}
                                    </span>
                                  )}
                                  {account.stats.totalSent > 0 && (
                                    <span className="ml-2 text-emerald-300">
                                      发送{account.stats.successCount}/{account.stats.totalSent}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {config.groups && config.groups.length > 0 && (
                                <Select
                                  value={
                                    config.groups?.find(g => g.accountIds.includes(account.id))
                                      ?.id || UNGROUPED_SELECT_VALUE
                                  }
                                  onValueChange={value =>
                                    handleAssignToGroup(
                                      account.id,
                                      value === UNGROUPED_SELECT_VALUE ? undefined : value,
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-8 min-w-[7rem] text-xs">
                                    <SelectValue placeholder="未分组" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={UNGROUPED_SELECT_VALUE}>未分组</SelectItem>
                                    {config.groups.map(group => (
                                      <SelectItem key={group.id} value={group.id}>
                                        {group.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {account.status === 'connected' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEnterLiveRoom(account.id)}
                                    disabled={
                                      !liveRoomUrl.trim() || account.liveRoomStatus === 'entering'
                                    }
                                  >
                                    {account.liveRoomStatus === 'entering'
                                      ? '进入中...'
                                      : '进入直播间'}
                                  </Button>
                                  {account.hasStorageState && (
                                    <Button
                                      variant="subtle"
                                      size="sm"
                                      onClick={() => handleClearSavedLoginState(account.id)}
                                    >
                                      清除登录态
                                    </Button>
                                  )}
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
                              {account.status !== 'connected' && account.hasStorageState && (
                                <Button
                                  variant="subtle"
                                  size="sm"
                                  onClick={() => handleClearSavedLoginState(account.id)}
                                >
                                  清除登录态
                                </Button>
                              )}
                              <Button
                                variant="subtle"
                                size="sm"
                                onClick={() => handleRemoveAccount(account.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
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
                  <div className="p-3 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">自定义话术分类</div>
                        <div className="text-xs text-muted-foreground">
                          分类名称、说明和分类内话术都可编辑
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleAddPresetCategory}>
                        <Plus className="h-4 w-4 mr-1" />
                        新增分类
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {presetCategories.map(category => (
                        <Button
                          key={category.id}
                          variant={
                            selectedPresetCategoryId === category.id ? 'default' : 'secondary'
                          }
                          size="sm"
                          onClick={() => setSelectedPresetCategoryId(category.id)}
                        >
                          {category.name}
                        </Button>
                      ))}
                    </div>
                    {selectedPresetCategory && (
                      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                        <div className="flex items-start gap-2">
                          <Input
                            value={selectedPresetCategory.name}
                            onChange={e =>
                              updatePresetCategory(selectedPresetCategory.id, category => ({
                                ...category,
                                name: e.target.value,
                              }))
                            }
                            placeholder="分类名称"
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLoadPreset(selectedPresetCategory.id)}
                          >
                            加载该分类
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemovePresetCategory(selectedPresetCategory.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <Input
                          value={selectedPresetCategory.description}
                          onChange={e =>
                            updatePresetCategory(selectedPresetCategory.id, category => ({
                              ...category,
                              description: e.target.value,
                            }))
                          }
                          placeholder="分类说明"
                        />
                        <div className="space-y-2">
                          {selectedPresetCategory.messages.map((message, messageIndex) => (
                            <div key={message.id} className="flex items-center gap-2">
                              <Input
                                value={message.content}
                                onChange={e =>
                                  updatePresetCategory(selectedPresetCategory.id, category => ({
                                    ...category,
                                    messages: category.messages.map(item =>
                                      item.id === message.id
                                        ? { ...item, content: e.target.value.slice(0, 50) }
                                        : item,
                                    ),
                                  }))
                                }
                                placeholder={`分类话术 ${messageIndex + 1}`}
                                className="flex-1"
                                maxLength={50}
                              />
                              <Input
                                type="number"
                                value={message.weight}
                                onChange={e =>
                                  updatePresetCategory(selectedPresetCategory.id, category => ({
                                    ...category,
                                    messages: category.messages.map(item =>
                                      item.id === message.id
                                        ? {
                                            ...item,
                                            weight: Math.max(1, Number(e.target.value) || 1),
                                          }
                                        : item,
                                    ),
                                  }))
                                }
                                className="w-16"
                                min={1}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  updatePresetCategory(selectedPresetCategory.id, category => ({
                                    ...category,
                                    messages:
                                      category.messages.length <= 1
                                        ? category.messages
                                        : category.messages.filter(item => item.id !== message.id),
                                  }))
                                }
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updatePresetCategory(selectedPresetCategory.id, category => ({
                                ...category,
                                messages: [
                                  ...category.messages,
                                  { id: crypto.randomUUID(), content: '', weight: 1 },
                                ],
                              }))
                            }
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            添加分类话术
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          提示：加载后会合并到现有消息列表中
                        </div>
                      </div>
                    )}
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
                        variant="subtle"
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
                            toast.warning({
                              title: '消息内容过长',
                              description: '单条消息不能超过 50 个字符。',
                              dedupeKey: 'subaccount-message-too-long',
                            })
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
                        variant="subtle"
                        size="sm"
                        onClick={() => {
                          if (config.messages.length <= 1) {
                            toast.warning({
                              title: '至少保留一条消息',
                              description: '最后一条消息不能删除。',
                              dedupeKey: 'subaccount-message-last',
                            })
                            return
                          }
                          actions.setMessages(config.messages.filter(m => m.id !== msg.id))
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
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
                  <Switch
                    checked={config.rotateAccounts}
                    onCheckedChange={actions.setRotateAccounts}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
