import { useDebounceEffect } from 'ahooks'
import { PinIcon, PinOffIcon } from 'lucide-react'
import type React from 'react'
import { useEffect, useState } from 'react'
import type { Message } from '@/hooks/useAutoMessage'

export default function MessageEditor({
  messages,
  onChange,
}: {
  messages: Message[]
  onChange: (messages: Message[]) => void
}) {
  const [localMessages, setLocalMessages] = useState<Message[]>(messages)
  const [text, setText] = useState(() => messages.map(msg => msg.content).join('\n'))

  // 当外部 messages 变化时（如账号切换），同步更新本地状态
  useEffect(() => {
    setLocalMessages(messages)
    setText(messages.map(msg => msg.content).join('\n'))
  }, [messages])

  useDebounceEffect(
    () => {
      onChange(localMessages)
    },
    [localMessages],
    { wait: 100 },
  )

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setText(text)
    setLocalMessages(prev =>
      text.split('\n').map((content, i) =>
        prev[i]
          ? {
              ...prev[i],
              content,
            }
          : {
              content,
              id: crypto.randomUUID(),
              pinTop: false,
            },
      ),
    )
  }

  const handleCheckboxChange = (index: number, checked: boolean) => {
    setLocalMessages(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], pinTop: checked }
      return updated
    })
  }

  return (
    <div className="min-h-[5rem]">
      <div className="border rounded flex min-h-[5rem]">
        <div className="bg-muted text-right px-1 py-0.5 font-mono text-muted-foreground select-none text-xs shrink-0">
          {localMessages.map((msg, i) => (
            <button
              type="button"
              title="置顶"
              key={msg.id}
              className="h-6 px-1 leading-6 cursor-pointer flex items-center justify-between group"
              onClick={() => handleCheckboxChange(i, !msg.pinTop)}
            >
              {msg.pinTop ? (
                <PinIcon
                  size={16}
                  className="text-gray-500 group-hover:text-gray-600"
                  fill="currentColor"
                />
              ) : (
                <PinOffIcon size={16} className="text-gray-400 group-hover:text-gray-600" />
              )}
              <span className="ml-2">{i + 1}</span>
            </button>
          ))}
        </div>

        {/* textarea 如果单行内容过长会出现横向滚动条影响行号的对齐，故隐藏该滚动条 */}
        <style>
          {`.no-scrollbar::-webkit-scrollbar {
                display: none;
            }`}
        </style>

        <textarea
          value={text}
          spellCheck={false}
          onChange={handleChange}
          rows={Math.max(3, localMessages.length || 1)}
          className="bg-background flex-1 min-h-0 outline-none resize-none px-2 py-1 text-xs whitespace-pre border-l no-scrollbar"
          style={{ lineHeight: '1.5rem' }}
        />
      </div>
    </div>
  )
}
