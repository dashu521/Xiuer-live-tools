import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownMessageContent({ content }: { content: string }) {
  return <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
}
