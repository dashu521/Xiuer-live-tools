import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Title } from '@/components/common/Title'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAutoReplyConfig } from '@/hooks/useAutoReplyConfig'
import { AIReplySetting } from './components/AIReplySetting'
import { BlocklistManager } from './components/BlocklistManager'
import { CompassSetting } from './components/CompassSetting'
import { HideUsernameSetting } from './components/HideUsernameSetting'
import { KeywordReplySetting } from './components/KeywordReplySetting'
import { ListeningSourceSetting } from './components/ListeningSourceSetting'
import { WebSocketSetting } from './components/WebSocketSetting'
import { WechatChannelSetting } from './components/WechatChannelSetting'

export default function AutoReplySettings() {
  const { config } = useAutoReplyConfig()
  const navigate = useNavigate()

  const ExtraSetting = useMemo(() => {
    switch (config.entry) {
      case 'compass':
        return <CompassSetting />
      case 'wechat-channel':
        return <WechatChannelSetting />
      default:
        return null
    }
  }, [config.entry])

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex min-h-full flex-col gap-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-start gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                title="返回"
                className="mt-0.5 shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <Title title="自动回复设置" description="配置自动回复的行为、来源与拦截规则" />
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>自动回复设置</CardTitle>
              <CardDescription>配置自动回复的行为和监听来源</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ListeningSourceSetting />
              <Separator />
              <HideUsernameSetting />
              <Separator />
              <div className="space-y-4">
                <Tabs defaultValue="keyword">
                  <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-sm font-medium">自动回复评论设置</h3>
                    <TabsList>
                      <TabsTrigger value="keyword">关键词回复</TabsTrigger>
                      <TabsTrigger value="ai">AI回复</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="keyword" className="space-y-4">
                    <KeywordReplySetting />
                  </TabsContent>
                  <TabsContent value="ai" className="space-y-4">
                    <AIReplySetting />
                  </TabsContent>
                </Tabs>
              </div>

              <Separator />
              {ExtraSetting}
              {ExtraSetting && <Separator />}
              <BlocklistManager />
              <Separator />
              <WebSocketSetting />
            </CardContent>
            <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">设置会自动保存</p>
              <div className="flex w-full justify-end sm:w-auto">
                <Button variant="outline" onClick={() => navigate(-1)}>
                  返回
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
