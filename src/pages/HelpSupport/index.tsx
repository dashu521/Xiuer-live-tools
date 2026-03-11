import { HelpSupportContent } from '@/components/common/HelpSupportContent'
import { Title } from '@/components/common/Title'

export default function HelpSupport() {
  return (
    <div className="w-full py-6 flex flex-col gap-6 min-h-0 overflow-auto">
      <div className="shrink-0">
        <Title title="帮助与支持" description="使用教程、常见问题与联系方式" />
      </div>

      <div className="flex flex-col gap-6 min-w-0 flex-1 min-h-0">
        <HelpSupportContent />
      </div>
    </div>
  )
}
