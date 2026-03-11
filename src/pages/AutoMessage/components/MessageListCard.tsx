import { useMemoizedFn } from 'ahooks'
import {
  Lightbulb,
  MessageSquare,
  PinIcon,
  PinOffIcon,
  Plus,
  Shuffle,
  Space,
  Timer,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Message } from '@/hooks/useAutoMessage'
import { useAutoMessageActions, useCurrentAutoMessage } from '@/hooks/useAutoMessage'

const MessageEditor = ({
  messages,
  onChange,
}: {
  messages: Message[]
  onChange: (messages: Message[]) => void
}) => {
  const [localMessages, setLocalMessages] = useState<Message[]>(messages)
  const [text, setText] = useState(() => messages.map(msg => msg.content).join('\n'))

  // 当外部 messages 变化时（如账号切换），同步更新本地状态
  useEffect(() => {
    setLocalMessages(messages)
    setText(messages.map(msg => msg.content).join('\n'))
  }, [messages])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setText(text)
    const newMessages = text
      .split('\n')
      .map((content, i) =>
        localMessages[i]
          ? { ...localMessages[i], content }
          : { content, id: crypto.randomUUID(), pinTop: false },
      )
    setLocalMessages(newMessages)
    onChange(newMessages)
  }

  const handlePinToggle = (index: number) => {
    const updated = [...localMessages]
    updated[index] = { ...updated[index], pinTop: !updated[index].pinTop }
    setLocalMessages(updated)
    onChange(updated)
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex min-h-[200px]">
        {/* 行号和置顶按钮 */}
        <div className="bg-muted border-r shrink-0">
          {localMessages.map((msg, i) => (
            <div key={msg.id} className="h-8 flex items-center px-2 gap-1">
              <button
                type="button"
                title={msg.pinTop ? '取消置顶' : '置顶'}
                onClick={() => handlePinToggle(i)}
                className="p-1 rounded hover:bg-muted-foreground/10 transition-colors"
              >
                {msg.pinTop ? (
                  <PinIcon className="h-3.5 w-3.5 text-primary" fill="currentColor" />
                ) : (
                  <PinOffIcon className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              <span className="text-xs text-muted-foreground font-mono w-5 text-right">
                {i + 1}
              </span>
            </div>
          ))}
        </div>

        {/* 文本编辑区 */}
        <Textarea
          value={text}
          onChange={handleChange}
          spellCheck={false}
          className="flex-1 min-h-0 border-0 rounded-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm leading-8 py-0 px-3"
          style={{ lineHeight: '2rem' }}
          placeholder="输入消息内容，每行一条..."
        />
      </div>
    </div>
  )
}

// 消息列表卡片组件（包含发送设置）
const MessageListCard = React.memo(() => {
  const messages = useCurrentAutoMessage(context => context.config.messages)
  const { scheduler, random, extraSpaces } = useCurrentAutoMessage(context => context.config)
  const { setMessages, setScheduler, setRandom, setExtraSpaces } = useAutoMessageActions()

  const handleIntervalChange = useMemoizedFn((index: 0 | 1, value: string) => {
    const numValue = Number(value) * 1000
    setScheduler({
      interval: index === 0 ? [numValue, scheduler.interval[1]] : [scheduler.interval[0], numValue],
    })
  })

  const minInterval = Math.round(scheduler.interval[0] / 1000)
  const maxInterval = Math.round(scheduler.interval[1] / 1000)

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/50 px-6 py-4">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          消息列表
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {/* 消息编辑区 */}
        <div className="space-y-2">
          {/* 标题行：左侧消息内容，右侧发送设置 */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">消息内容</Label>
              <span className="text-xs text-muted-foreground">共 {messages.length} 条</span>
            </div>

            {/* 发送设置集成到标题行 */}
            <TooltipProvider>
              <div className="flex items-center gap-5 border rounded-lg px-4 py-3 bg-muted/30 -my-1.5">
                {/* 发送间隔 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 cursor-pointer">
                      <Timer className="h-5 w-5 text-muted-foreground" />
                      <Input
                        type="number"
                        value={minInterval}
                        onChange={e => handleIntervalChange(0, e.target.value)}
                        className="w-16 h-8 text-base text-center bg-background"
                        min="1"
                      />
                      <span className="text-base text-muted-foreground">-</span>
                      <Input
                        type="number"
                        value={maxInterval}
                        onChange={e => handleIntervalChange(1, e.target.value)}
                        className="w-16 h-8 text-base text-center bg-background"
                        min="1"
                      />
                      <span className="text-base text-muted-foreground">秒</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>发送间隔时间范围（秒）</p>
                  </TooltipContent>
                </Tooltip>

                {/* 随机发送 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 cursor-pointer">
                      <Shuffle className="h-5 w-5 text-muted-foreground" />
                      <Switch checked={random} onCheckedChange={setRandom} className="scale-110" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>随机发送消息</p>
                  </TooltipContent>
                </Tooltip>

                {/* 插入随机空格 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 cursor-pointer">
                      <Space className="h-5 w-5 text-muted-foreground" />
                      <Switch
                        checked={extraSpaces}
                        onCheckedChange={setExtraSpaces}
                        className="scale-110"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>插入随机空格，避免被检测</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          <p className="text-xs text-muted-foreground">每行一条消息，点击左侧图钉可置顶该消息</p>

          {/* 空状态引导 */}
          {messages.length === 0 || (messages.length === 1 && messages[0].content.trim() === '') ? (
            <div className="border rounded-lg p-8 text-center space-y-4 bg-muted/20">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium">还没有配置消息</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  配置自动发言消息后，系统会按设定的时间间隔自动发送，帮助您活跃直播间气氛
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newMessage: Message = {
                    id: crypto.randomUUID(),
                    content: '欢迎来到直播间！今天有超值优惠活动，不要错过哦~',
                    pinTop: false,
                  }
                  setMessages([newMessage])
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                添加第一条消息
              </button>
              <p className="text-xs text-muted-foreground">
                点击左侧图钉可置顶重要消息，使用{' '}
                <code className="bg-muted px-1 rounded">{'{候选A/候选B}'}</code> 语法可实现随机内容
              </p>
            </div>
          ) : (
            <MessageEditor messages={messages} onChange={setMessages} />
          )}
        </div>

        {/* 变量提示 */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          <div className="space-y-1">
            <p>
              <strong>变量功能：</strong>使用{' '}
              <code className="bg-muted px-1 rounded">{'{候选A/候选B}'}</code> 语法实现随机内容
            </p>
            <p className="text-muted-foreground/70">
              例如：欢迎{'{宝宝/家人/老铁}'}进入直播间，{'{今天/现在}'}有优惠活动！
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

export default MessageListCard
