import { useMemoizedFn } from 'ahooks'
import { AlertTriangle, Download, Rocket, RotateCcw } from 'lucide-react'
import { useEffect } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { HtmlRenderer } from '@/components/common/HtmlRenderer'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useIpcListener } from '@/hooks/useIpc'
import { useToast } from '@/hooks/useToast'
import { type ProgressState, useUpdateConfigStore, useUpdateStore } from '@/hooks/useUpdate'

interface UpdateSource {
  value: string
  label: string
}

const updateSources: UpdateSource[] = [
  { value: 'official', label: '官方渠道' },
  { value: 'custom', label: '自定义' },
]

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`
}

function formatEta(seconds: number): string {
  if (seconds <= 0) return '--'
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
  return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分`
}

export function UpdateDialog() {
  const status = useUpdateStore.use.status()
  const progress = useUpdateStore.use.progress()
  const detailsOpen = useUpdateStore.use.detailsOpen()
  const setDetailsOpen = useUpdateStore.use.setDetailsOpen()
  const updateInfo = useUpdateStore.use.versionInfo()
  const startDownload = useUpdateStore.use.startDownload()
  const installUpdate = useUpdateStore.use.installUpdate()
  const refreshRuntimeStatus = useUpdateStore.use.refreshRuntimeStatus()
  const listBackups = useUpdateStore.use.listBackups()
  const rollback = useUpdateStore.use.rollback()
  const error = useUpdateStore.use.error()
  const handleError = useUpdateStore.use.handleError()
  const handleDownloadProgress = useUpdateStore.use.handleDownloadProgress()
  const handleDownloadReady = useUpdateStore.use.handleDownloadReady()
  const runtime = useUpdateStore.use.runtime()
  const backups = useUpdateStore.use.backups()
  const { toast } = useToast()
  const updateSource = useUpdateConfigStore(s => s.source)
  const setUpdateSource = useUpdateConfigStore(s => s.setSource)
  const customUpdateSource = useUpdateConfigStore(s => s.customSource)
  const setCustomUpdateSource = useUpdateConfigStore(s => s.setCustomSource)

  useEffect(() => {
    void refreshRuntimeStatus()
  }, [refreshRuntimeStatus])

  useEffect(() => {
    if (detailsOpen && status === 'error' && runtime.capabilities.listBackups) {
      void listBackups().catch(() => {})
    }
  }, [detailsOpen, status, runtime.capabilities.listBackups, listBackups])

  const handleOpenChange = (open: boolean) => {
    setDetailsOpen(open)
  }

  const handleStartDownload = useMemoizedFn(() => {
    void startDownload()
  })

  const handleRollbackLatest = useMemoizedFn(async () => {
    const latestBackup = backups[0]
    if (!latestBackup) {
      toast.error('当前没有可用备份')
      return
    }
    const success = await rollback(latestBackup.version)
    if (success) {
      toast.success(`已回滚到备份版本 ${latestBackup.version}，建议重新启动应用`)
    } else {
      toast.error('回滚失败，请查看日志')
    }
  })

  useIpcListener(IPC_CHANNELS.updater.downloadProgress, (info: ProgressState | any) => {
    const progressData: ProgressState = {
      percent: info.percent || 0,
      transferred: info.transferred || 0,
      total: info.total || 0,
      speed: info.bytesPerSecond || info.speed || 0,
      eta: info.eta || 0,
    }
    handleDownloadProgress(progressData)
  })

  useIpcListener(IPC_CHANNELS.updater.updateDownloaded, () => {
    handleDownloadReady()
  })

  useIpcListener(IPC_CHANNELS.updater.updateError, handleError)

  const openDownloadURL = (downloadUrl: string) => {
    window.open(downloadUrl, '_blank')
  }

  const isDownloading = status === 'downloading' || status === 'preparing'
  const isWindowsSilentInstall = runtime.platform === 'win32'

  const buttonContent = useMemoizedFn(() => {
    if (status === 'error') {
      if (error?.downloadURL) {
        return (
          <div className="flex gap-2">
            <Button onClick={() => openDownloadURL(error.downloadURL!)} variant="default">
              <Download className="mr-2 h-4 w-4" />
              手动下载
            </Button>
          </div>
        )
      }
      return (
        <div className="flex gap-2">
          <Button onClick={handleStartDownload} variant="default" disabled={!runtime.canUpdate}>
            <RotateCcw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      )
    }

    if (status === 'ready') {
      return (
        <Button
          onClick={() => void installUpdate()}
          variant="default"
          disabled={!runtime.capabilities.quitAndInstall}
        >
          <Rocket className="mr-2 h-4 w-4" />
          {isWindowsSilentInstall ? '重启并更新' : '马上安装'}
        </Button>
      )
    }

    if (status === 'downloading' || status === 'preparing') {
      return (
        <Button disabled variant="default">
          <Download className="mr-2 h-4 w-4 animate-bounce" />
          正在更新...
        </Button>
      )
    }

    return (
      <Button
        onClick={handleStartDownload}
        variant="default"
        disabled={!runtime.capabilities.startDownload}
      >
        <Download className="mr-2 h-4 w-4" />
        立即更新
      </Button>
    )
  })

  const isCustom = updateSource === 'custom'
  const canShowDetails = status === 'available' || status === 'ready' || status === 'error'

  const renderProgressInfo = () => {
    if (!isDownloading) return null

    return (
      <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {status === 'preparing' ? '准备中...' : '下载中'}
          </span>
          <span className="font-medium">{Math.round(progress.percent)}%</span>
        </div>

        <Progress value={progress.percent} className="h-2" />

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
          </span>
          <span>{`${formatSpeed(progress.speed)} · 剩余 ${formatEta(progress.eta)}`}</span>
        </div>
      </div>
    )
  }

  const renderErrorInfo = () => {
    if (status !== 'error') return null
    const latestBackup = backups[0]

    return (
      <div className="space-y-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">更新出错</span>
        </div>
        <ScrollArea className="text-sm max-h-32">
          <p className="whitespace-pre-line">{error?.message || '发生未知错误'}</p>
        </ScrollArea>
        {error?.downloadURL && (
          <p className="text-xs text-muted-foreground">可点击下方按钮通过浏览器下载更新包</p>
        )}

        {!runtime.canUpdate && (
          <div className="text-xs text-muted-foreground">
            当前平台或运行环境仅支持查看更新状态，不支持下载安装流程。
          </div>
        )}

        {runtime.capabilities.rollback && (
          <div className="pt-2 border-t border-destructive/20">
            <div className="text-xs text-muted-foreground mb-2">
              {latestBackup
                ? `可回滚到最近备份版本 ${latestBackup.version}`
                : '当前没有可用备份，无法执行回滚'}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!latestBackup}
              onClick={handleRollbackLatest}
            >
              回滚到最近备份
            </Button>
          </div>
        )}
      </div>
    )
  }

  const renderVersionInfo = () => {
    if (status === 'error' || !updateInfo) return null

    return (
      <div className="space-y-3">
        <div className="flex justify-center space-x-4 items-center py-2">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">当前版本</p>
            <p className="text-lg font-semibold">v{updateInfo.currentVersion}</p>
          </div>
          <div className="text-muted-foreground">→</div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">最新版本</p>
            <p className="text-lg font-bold text-primary">v{updateInfo.latestVersion}</p>
          </div>
        </div>

        {updateInfo.releaseNote && (
          <ScrollArea className="max-h-48 rounded-md border p-3">
            <HtmlRenderer className="markdown-body text-sm" html={updateInfo.releaseNote} />
          </ScrollArea>
        )}
      </div>
    )
  }

  return (
    <Dialog open={detailsOpen && canShowDetails} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>
          {status === 'error' ? '更新失败' : status === 'ready' ? '更新就绪' : '发现新版本'}
        </DialogTitle>
        <DialogDescription>
          {status === 'ready'
            ? isWindowsSilentInstall
              ? '更新已下载完成，重启应用后将静默完成更新。'
              : '更新已下载完成，是否立即安装？'
            : status === 'error'
              ? '更新过程中遇到问题，请重试或手动下载。'
              : '升级到最新版本以获得更好的体验。'}
        </DialogDescription>

        <div className="space-y-4">
          {renderVersionInfo()}
          {renderProgressInfo()}
          {renderErrorInfo()}

          {status !== 'ready' && status !== 'downloading' && status !== 'preparing' && (
            <div className={`flex ${isCustom ? 'flex-col gap-3' : 'items-center justify-between'}`}>
              <div className={isCustom ? 'flex flex-col gap-2 sm:flex-row' : ''}>
                <Select value={updateSource} onValueChange={value => setUpdateSource(value)}>
                  <SelectTrigger className="w-[8.75rem]">
                    <SelectValue placeholder="选择更新源" />
                  </SelectTrigger>
                  <SelectContent>
                    {updateSources.map(source => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isCustom && (
                  <Input
                    value={customUpdateSource}
                    onChange={e => setCustomUpdateSource(e.target.value)}
                    placeholder="自定义更新源地址"
                    className="w-full sm:w-[200px]"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {status !== 'downloading' && status !== 'preparing' && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              {status === 'ready' ? '稍后' : '关闭'}
            </Button>
          )}
          {buttonContent()}
        </div>
      </DialogContent>
    </Dialog>
  )
}
