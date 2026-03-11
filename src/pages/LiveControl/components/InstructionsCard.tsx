import { ChevronRight, HelpCircle } from 'lucide-react'
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const instructions = [
  { step: 1, title: '选择平台', desc: '选择平台并连接' },
  { step: 2, title: '登录账号', desc: '等待登录成功' },
  { step: 3, title: '使用功能', desc: '使用自动发言和弹窗' },
]

const InstructionsCard = React.memo(() => (
  <Card className="overflow-hidden">
    <CardHeader className="bg-muted/50 px-6 py-4">
      <CardTitle className="text-base flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-primary" />
        使用说明
      </CardTitle>
    </CardHeader>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        {instructions.map((item, index) => {
          const isLast = index === instructions.length - 1
          return (
            <React.Fragment key={item.step}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-primary">{item.step}</span>
                </div>
                <div>
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              </div>
              {!isLast && <ChevronRight className="h-5 w-5 text-muted-foreground/50 shrink-0" />}
            </React.Fragment>
          )
        })}
      </div>
    </CardContent>
  </Card>
))

export default InstructionsCard
