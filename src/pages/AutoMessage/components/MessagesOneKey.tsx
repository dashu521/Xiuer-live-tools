import { Hash, Send, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { GateButton } from '@/components/GateButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAccounts } from '@/hooks/useAccounts'
import {
  getEffectiveAutoMessageContents,
  useAutoMessageActions,
  useCurrentAutoMessage,
} from '@/hooks/useAutoMessage'
import { useLiveFeatureGate } from '@/hooks/useLiveFeatureGate'
import { useToast } from '@/hooks/useToast'

export function MessageOneKey() {
  const [isRunning, setIsRunning] = useState(false)
  const batchCount = useCurrentAutoMessage(ctx => ctx.batchCount ?? 5)
  const { setBatchCount } = useAutoMessageActions()
  const messages = useCurrentAutoMessage(ctx => ctx.config.messages)
  const gate = useLiveFeatureGate()
  const accountId = useAccounts(s => s.currentAccountId)
  const { toast } = useToast()

  const mappedMessages = useMemo(() => getEffectiveAutoMessageContents(messages), [messages])

  const handleClick = async () => {
    if (mappedMessages.length === 0) {
      toast.error('请至少配置一条非空消息')
      return
    }

    setIsRunning(true)
    try {
      await window.ipcRenderer.invoke(
        IPC_CHANNELS.tasks.autoMessage.sendBatchMessages,
        accountId,
        mappedMessages,
        batchCount,
      )
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/50 px-6 py-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          一键刷屏
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-300">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium">连续发送多条评论</div>
              <div className="text-xs text-muted-foreground">
                一次性快速发送多条消息，适用于活跃气氛
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <Hash className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col">
                <Label className="text-xs text-muted-foreground">发送条数</Label>
                <Input
                  type="number"
                  value={batchCount}
                  onChange={e => setBatchCount(+e.target.value)}
                  className="w-20 h-9 text-sm"
                  min="1"
                  max="50"
                />
              </div>
            </div>

            <GateButton
              gate={gate}
              onClick={handleClick}
              disabled={isRunning}
              size="sm"
              className="h-10 px-4"
            >
              {isRunning ? (
                <>
                  <div className="mr-2 h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  发送中...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  一键刷屏
                </>
              )}
            </GateButton>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
