import { UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { type FansClubChange, useLiveStats } from '@/hooks/useLiveStats'

interface FansClubItemProps {
  change: FansClubChange
}

function FansClubItem({ change }: FansClubItemProps) {
  return (
    <div className="ui-hover-item flex items-center gap-3 rounded-lg px-3 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300 shadow-sm">
        <UserPlus className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">{change.nickName}</span>
          <Badge variant="warning" className="text-xs">
            加入粉丝团
          </Badge>
        </div>
        {change.content && (
          <p className="mt-0.5 text-sm text-muted-foreground truncate">{change.content}</p>
        )}
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{change.time}</span>
    </div>
  )
}

export default function FansGroupChanges() {
  const { fansClubChanges, stats, isListening } = useLiveStats()

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              粉丝团变化
              <Badge variant={isListening ? 'default' : 'outline'}>{stats.fansClubCount} 人</Badge>
            </CardTitle>
            <CardDescription>实时显示新加入粉丝团的用户</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full">
          <div className="space-y-1 px-4 py-2">
            {fansClubChanges.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <UserPlus className="h-8 w-8 mb-2 opacity-50" />
                <p>{isListening ? '等待新用户加入粉丝团...' : '请先开始监控'}</p>
              </div>
            ) : (
              fansClubChanges.map(change => <FansClubItem key={change.id} change={change} />)
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
