import { TrashIcon } from 'lucide-react'
import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// 商品列表项组件
const GoodsListItem = React.memo(function GoodsListItem({
  id,
  index,
  onChange,
  onDelete,
}: {
  id: number
  index: number
  onChange: (index: number, value: string) => void
  onDelete: () => void
}) {
  return (
    <div className="ui-hover-item group flex items-center gap-2 rounded-lg px-2 py-1">
      <Input
        type="number"
        value={id}
        onChange={e => onChange(index, e.target.value)}
        className="w-24 h-8 text-sm"
        min="1"
        placeholder="序号"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <TrashIcon className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
})

export default GoodsListItem
