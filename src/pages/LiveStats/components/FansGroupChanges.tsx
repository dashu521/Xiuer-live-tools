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
    <div className="flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors border-b last:border-0">
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100">
        <UserPlus className="h-5 w-5 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">{change.nickName}</span>
          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
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

      <CardContent className="flex-1 p-0 min-h-0">
        <ScrollArea className="h-[25rem]">
          <div className="py-2 px-4">
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
