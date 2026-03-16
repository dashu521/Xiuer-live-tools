import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useUpdateConfigStore, useUpdateStore } from '@/hooks/useUpdate'
import { version } from '../../../../package.json'

const updateSources = [
  { value: 'official', label: '官方渠道' },
  { value: 'custom', label: '自定义' },
] as const

export function UpdateSetting() {
  const {
    enableAutoCheckUpdate,
    setEnableAutoCheckUpdate,
    source,
    setSource,
    customSource,
    setCustomSource,
  } = useUpdateConfigStore()
  const updateStatus = useUpdateStore.use.status()
  const checkUpdateManually = useUpdateStore.use.checkUpdateManually()
  const [isUpToDate, setIsUpToDate] = useState(false)
  const isCustom = source === 'custom'

  const checkUpdate = async () => {
    const result = await checkUpdateManually()
    if (result) {
      setIsUpToDate(result.upToDate)
    }
  }

  return (
    <Card id="update-section">
      <CardHeader>
        <CardTitle>软件更新</CardTitle>
        <CardDescription>检查并安装最新版本的应用程序</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {/* 手动更新 */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>更新源</Label>
              <p className="text-sm text-muted-foreground">选择合适的更新源以获取最新版本</p>
            </div>

            <div className="flex items-center gap-3">
              <Select value={source} onValueChange={value => setSource(value)}>
                <SelectTrigger className="w-[9rem]">
                  <SelectValue placeholder="选择更新源" />
                </SelectTrigger>
                <SelectContent>
                  {updateSources.map(item => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                disabled={updateStatus === 'checking'}
                onClick={checkUpdate}
                size="sm"
              >
                {updateStatus === 'checking' ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    检查更新中
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {isUpToDate ? '已是最新版本' : '检查更新'}
                  </>
                )}
              </Button>
            </div>

            {isCustom && (
              <Input
                value={customSource}
                onChange={e => setCustomSource(e.target.value)}
                placeholder="https://your-update-source.example/releases/latest/"
              />
            )}
          </div>
        </div>

        <Separator className="my-6" />

        <div className="flex justify-between items-center ">
          <div className="space-y-1">
            <Label>有新版本时弹窗提示</Label>
            <p className="text-sm text-muted-foreground">弹窗显示新版本更新了什么内容</p>
          </div>
          <Switch checked={enableAutoCheckUpdate} onCheckedChange={setEnableAutoCheckUpdate} />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-sm font-medium leading-none">当前版本</h4>
            <p className="text-sm text-muted-foreground">{version}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
