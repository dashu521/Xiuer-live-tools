import { AlertTriangle, ArrowUpCircle, Download, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useUpdateStore } from '@/hooks/useUpdate'

function formatProgress(percent: number) {
  return `${Math.max(0, Math.min(100, Math.round(percent)))}%`
}

export function UpdateStatusChip() {
  const status = useUpdateStore.use.status()
  const progress = useUpdateStore.use.progress()
  const versionInfo = useUpdateStore.use.versionInfo()
  const runtime = useUpdateStore.use.runtime()
  const setDetailsOpen = useUpdateStore.use.setDetailsOpen()

  if (status === 'idle' || status === 'checking') {
    return null
  }

  if (status === 'preparing' || status === 'downloading') {
    return (
      <div
        className="hidden min-w-[14rem] rounded-xl border px-3 py-2 md:flex md:flex-col md:gap-2"
        style={{
          backgroundColor: 'var(--header-action-bg)',
          borderColor: 'var(--header-action-border)',
          color: 'var(--header-action-fg)',
        }}
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Download className="h-4 w-4 animate-pulse" />
            <span>后台下载更新</span>
          </div>
          <span className="text-xs text-muted-foreground">{formatProgress(progress.percent)}</span>
        </div>
        <Progress value={progress.percent} className="h-1.5" />
      </div>
    )
  }

  if (status === 'available') {
    return (
      <Button
        type="button"
        variant="outline"
        className="hidden md:flex"
        onClick={() => setDetailsOpen(true)}
      >
        <ArrowUpCircle className="mr-2 h-4 w-4" />
        {versionInfo ? `发现新版本 ${versionInfo.latestVersion}` : '发现新版本'}
      </Button>
    )
  }

  if (status === 'ready') {
    return (
      <Button
        type="button"
        variant="outline"
        className="hidden border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 md:flex dark:text-emerald-300"
        disabled={!runtime.capabilities.quitAndInstall}
        onClick={() => setDetailsOpen(true)}
      >
        <Rocket className="mr-2 h-4 w-4" />
        更新已就绪
      </Button>
    )
  }

  if (status === 'error') {
    return (
      <Button
        type="button"
        variant="outline"
        className="hidden border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 md:flex"
        onClick={() => setDetailsOpen(true)}
      >
        <AlertTriangle className="mr-2 h-4 w-4" />
        更新异常
      </Button>
    )
  }

  return null
}
