import { lazy, Suspense } from 'react'
import './MessageContent.css'

const MarkdownMessageContent = lazy(async () => {
  const module = await import('./MarkdownMessageContent')
  return { default: module.MarkdownMessageContent }
})

export function MessageContent({ content }: { content: string }) {
  return (
    <div className="whitespace-normal leading-relaxed text-[0.9375rem]">
      <div className="markdown-body">
        <Suspense fallback={<div className="whitespace-pre-wrap break-words">{content}</div>}>
          <MarkdownMessageContent content={content} />
        </Suspense>
      </div>
    </div>
  )
}
