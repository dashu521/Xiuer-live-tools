import { HelpSupportContent } from '@/components/common/HelpSupportContent'
import { Title } from '@/components/common/Title'

export default function HelpSupport() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex min-h-full flex-col gap-6 py-6">
          <div className="shrink-0">
            <Title title="帮助与支持" description="使用教程、常见问题与联系方式" />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-6 min-w-0">
            <HelpSupportContent />
          </div>
        </div>
      </div>
    </div>
  )
}
