import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import './MessageContent.css'
import 'highlight.js/styles/vs.css'

export function MessageContent({ content }: { content: string }) {
  return (
    <div className="whitespace-normal leading-relaxed text-[0.9375rem]">
      <div className="markdown-body">
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {content}
        </Markdown>
      </div>
    </div>
  )
}
