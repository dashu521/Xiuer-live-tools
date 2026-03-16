import { Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLiveStats } from '@/hooks/useLiveStats'

interface DanmuItemProps {
  message: LiveMessage
}

function DanmuItem({ message }: DanmuItemProps) {
  const isComment =
    message.msg_type === 'comment' ||
    message.msg_type === 'wechat_channel_live_msg' ||
    message.msg_type === 'xiaohongshu_comment' ||
    message.msg_type === 'taobao_comment'

  if (!isComment) return null

  const content = (message as CommentMessage).content

  return (
    <div className="ui-hover-item flex items-start gap-3 rounded-lg px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
            {message.nick_name}
          </span>
          <span className="text-xs text-muted-foreground ml-auto shrink-0">{message.time}</span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground break-all">{content}</p>
      </div>
    </div>
  )
}

export default function DanmuMonitor() {
  const { danmuList, stats, isListening } = useLiveStats()
  const [searchText, setSearchText] = useState('')

  // 过滤弹幕
  const filteredDanmu = useMemo(() => {
    if (!searchText.trim()) return danmuList
    const keyword = searchText.toLowerCase()
    return danmuList.filter(msg => {
      const content = (msg as CommentMessage).content?.toLowerCase() || ''
      const nickname = msg.nick_name.toLowerCase()
      return content.includes(keyword) || nickname.includes(keyword)
    })
  }, [danmuList, searchText])

  // 导出弹幕数据
  const handleExport = () => {
    const data = danmuList.map(msg => ({
      时间: msg.time,
      用户: msg.nick_name,
      内容: (msg as CommentMessage).content || '',
    }))

    const csv = [
      Object.keys(data[0] || {}).join(','),
      ...data.map(row =>
        Object.values(row)
          .map(v => `"${v}"`)
          .join(','),
      ),
    ].join('\n')

    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `弹幕数据_${new Date().toLocaleDateString()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              实时弹幕
              <Badge variant={isListening ? 'default' : 'outline'}>{stats.commentCount} 条</Badge>
            </CardTitle>
            <CardDescription>实时显示直播间的弹幕内容</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索弹幕..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="pl-8 w-40"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={danmuList.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              导出
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full">
          <div className="py-2 space-y-0.5 px-4">
            {filteredDanmu.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                {isListening ? (searchText ? '没有匹配的弹幕' : '等待弹幕数据...') : '请先开始监控'}
              </div>
            ) : (
              filteredDanmu.map(msg => <DanmuItem key={msg.msg_id} message={msg} />)
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
