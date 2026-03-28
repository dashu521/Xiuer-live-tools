import { TrashIcon } from 'lucide-react'
import AIModelInfo from '@/components/ai-chat/AIModelInfo'
import { APIKeyDialog } from '@/components/ai-chat/APIKeyDialog'
import { Title } from '@/components/common/Title'
import { Button } from '@/components/ui/button'
import { useAIChatStore } from '@/hooks/useAIChat'
import ChatBox from './components/ChatBox'

export default function AIChat() {
  const messages = useAIChatStore(state => state.messages)
  const clearMessages = useAIChatStore(state => state.clearMessages)

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex min-h-full flex-col gap-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="shrink-0">
              <Title title="AI 助手" description="与 AI 助手进行对话，获取帮助。" />
            </div>
            <div className="flex items-center gap-2 self-start">
              <APIKeyDialog />
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMessages}
                disabled={messages.length === 0}
                className="text-muted-foreground hover:text-destructive"
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                清空对话
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            <AIModelInfo />
            <ChatBox />
          </div>
        </div>
      </div>
    </div>
  )
}
