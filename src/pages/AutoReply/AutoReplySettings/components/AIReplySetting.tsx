import { useId } from 'react'
import AIModelInfo from '@/components/ai-chat/AIModelInfo'
import { APIKeyDialog } from '@/components/ai-chat/APIKeyDialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAIChatStore } from '@/hooks/useAIChat'
import { useAutoReplyConfig } from '@/hooks/useAutoReplyConfig'

export function AIReplySetting() {
  const { config, updateAIReplySettings } = useAutoReplyConfig()
  const aiReplyEnabled = config.comment.aiReply.enable
  const autoSend = config.comment.aiReply.autoSend
  const useSharedConfig = config.comment.aiReply.useSharedConfig ?? false

  // 获取AI对话的配置用于显示
  const aiChatConfig = useAIChatStore(state => state.config)
  const aiChatProvider = aiChatConfig.provider
  const aiChatModel = aiChatConfig.model

  // 处理AI自动回复开关
  const handleAiReplyChange = (checked: boolean) => {
    updateAIReplySettings({ enable: checked })
  }

  const handleAutoSendChange = (checked: boolean) => {
    updateAIReplySettings({ autoSend: checked })
  }

  // 【P1-1 AI联动】处理使用AI对话配置开关
  const handleUseSharedConfigChange = (checked: boolean) => {
    updateAIReplySettings({ useSharedConfig: checked })
  }

  const aiReplyId = useId()
  const autoSendId = useId()
  const useSharedConfigId = useId()

  return (
    <>
      <div className="flex flex-col space-y-4">
        <div className="flex items-center space-x-2">
          <Switch id={aiReplyId} checked={aiReplyEnabled} onCheckedChange={handleAiReplyChange} />
          <Label htmlFor={aiReplyId}>启用AI自动回复</Label>
        </div>

        {/* 【P1-1 AI联动】使用AI对话配置开关 */}
        {aiReplyEnabled && (
          <div className="flex items-center space-x-2 pl-4 border-l-2 border-primary/20">
            <Switch
              id={useSharedConfigId}
              checked={useSharedConfig}
              onCheckedChange={handleUseSharedConfigChange}
            />
            <div className="flex flex-col">
              <Label htmlFor={useSharedConfigId}>使用AI对话的配置</Label>
              <span className="text-xs text-muted-foreground">
                {useSharedConfig
                  ? `当前使用：${aiChatProvider} / ${aiChatModel}`
                  : '使用自动回复的独立配置'}
              </span>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center space-x-2">
            <Switch id={autoSendId} checked={autoSend} onCheckedChange={handleAutoSendChange} />
            <Label htmlFor={autoSendId}>自动发送</Label>
          </div>
          <div className="text-xs text-muted-foreground mt-2 pl-2">
            <p>
              请注意：开启自动发送后，AI生成的所有回复都会自动发送到直播间，这可能会带来以下
              <strong>风险</strong>：
            </p>
            <ul className="list-disc pl-6 mt-1">
              <li>
                AI可能会生成<strong>不恰当或不相关</strong>的回复
              </li>
              <li>
                回复内容可能会<strong>违反平台规则</strong>
              </li>
              <li>可能会影响与观众的真实互动体验</li>
            </ul>
            <p className="font-medium mt-1">
              ※ 建议在开启自动发送前，先观察一段时间AI的回复质量。您也可以通过点击每条回复预览旁边的
              <strong>小飞机按钮</strong>来手动发送。
            </p>
          </div>
        </div>
      </div>
      {aiReplyEnabled && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">提示词配置</div>
          <Textarea
            placeholder="输入AI提示词..."
            value={config.comment.aiReply.prompt}
            onChange={e => updateAIReplySettings({ prompt: e.target.value })}
            className="min-h-[7.5rem]"
          />
          <p className="text-xs text-muted-foreground">提示词将指导AI如何回复用户评论</p>
          <div className="flex justify-between items-center space-x-2">
            <APIKeyDialog />
            <AIModelInfo />
          </div>
        </div>
      )}
    </>
  )
}
