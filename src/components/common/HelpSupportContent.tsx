import {
  BookOpen,
  ChevronDown,
  Copy,
  GraduationCap,
  HelpCircle,
  Mail,
  MessageCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  HELP_FAQ_ITEMS,
  SUPPORT_EMAIL,
  SUPPORT_PRODUCT_NAME,
  WECHAT_QR_IMAGE_PATH,
} from '@/constants/helpSupport'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import { UserGuideDialog } from './UserGuideDialog'

export function HelpSupportContent() {
  const { toast } = useToast()
  const [wechatOpen, setWechatOpen] = useState(false)
  const [openFaqId, setOpenFaqId] = useState<string | null>(null)

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL)
      toast.success('邮箱已复制到剪贴板')
    } catch {
      toast.error('复制失败，请手动复制')
    }
  }

  return (
    <div className="flex flex-col gap-6 min-w-0">
      {/* 使用教程卡片 */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50 px-6 py-4">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            使用教程
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium mb-1">快速上手直播工具</div>
              <p className="text-sm text-muted-foreground mb-4">
                详细了解各功能模块的使用方法，包括直播控制台连接、自动发言、自动弹窗、自动回复等功能的使用步骤。
              </p>
              <UserGuideDialog
                trigger={
                  <Button size="sm" className="h-9">
                    <BookOpen className="mr-2 h-4 w-4" />
                    查看完整教程
                  </Button>
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 联系支持卡片 */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50 px-6 py-4">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            联系支持
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* 邮箱支持 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <div className="h-4 w-1 rounded-full bg-primary" />
              邮箱支持
            </div>
            <div className="pl-3">
              <div className="flex items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">发送邮件</div>
                    <div className="text-xs text-muted-foreground">{SUPPORT_EMAIL}</div>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="h-9 px-4" onClick={handleCopyEmail}>
                  <Copy className="mr-2 h-4 w-4" />
                  复制邮箱
                </Button>
              </div>
            </div>
          </div>

          {/* 分隔线 */}
          <div className="h-px bg-border" />

          {/* 微信支持 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <div className="h-4 w-1 rounded-full bg-primary" />
              微信支持
            </div>
            <div className="pl-3">
              <Collapsible open={wechatOpen} onOpenChange={setWechatOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 mb-3">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    {wechatOpen ? '收起二维码' : '查看微信二维码'}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-4 border rounded-lg bg-muted/30 inline-block">
                    <img
                      src={WECHAT_QR_IMAGE_PATH}
                      alt="微信支持二维码"
                      className="w-44 h-44 object-contain rounded-md"
                      onError={e => {
                        const target = e.currentTarget
                        target.style.display = 'none'
                        const fallback = target.nextElementSibling as HTMLElement | null
                        if (fallback) fallback.hidden = false
                      }}
                    />
                    <p
                      className="w-44 h-44 flex items-center justify-center text-xs text-muted-foreground text-center"
                      hidden
                    >
                      二维码图片未找到
                      <br />
                      请确保 public/support-wechat-qr.png 存在
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <p className="text-xs text-muted-foreground">
                添加微信时，请备注【{SUPPORT_PRODUCT_NAME} + 问题简述】，以便更快处理。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 常见问题卡片 */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50 px-6 py-4">
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            常见问题
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-2">
            {HELP_FAQ_ITEMS.map((item, index) => {
              const id = `faq-${index}`
              const isOpen = openFaqId === id
              return (
                <Collapsible
                  key={id}
                  open={isOpen}
                  onOpenChange={open => setOpenFaqId(open ? id : null)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors">
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                          isOpen && 'rotate-180',
                        )}
                      />
                      <span className="text-sm font-medium">{item.question}</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-3 pl-11">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {item.answer}
                        </p>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
