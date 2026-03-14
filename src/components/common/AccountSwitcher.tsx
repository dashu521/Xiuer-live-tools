import { useMemoizedFn } from 'ahooks'
import { Plus } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAccounts } from '@/hooks/useAccounts'
import { useCurrentLiveControl } from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { AccountLimitDialog } from './AccountLimitDialog'

export const AccountSwitcher = React.memo(() => {
  const {
    accounts,
    currentAccountId,
    defaultAccountId,
    addAccount,
    switchAccount,
    setDefaultAccount,
  } = useAccounts()
  const connectState = useCurrentLiveControl(state => state.connectState)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)

  // 使用useMemo稳定账号列表
  const accountItems = useMemo(() => accounts.map(a => ({ id: a.id, name: a.name })), [accounts])

  // 确保Select的value永远合法
  const hasCurrent = accounts.some(a => a.id === currentAccountId)
  const normalizedAccountId = hasCurrent ? currentAccountId : (accounts[0]?.id ?? '')

  // 增加一次性纠正 store（避免其它模块拿到非法 currentAccountId）
  const didFixInvalidSelectionRef = useRef(false)
  const firstAccountId = useMemo(() => accounts[0]?.id, [accounts])

  useEffect(() => {
    if (didFixInvalidSelectionRef.current) return
    if (!accounts.length) return
    if (currentAccountId && hasCurrent) return
    // 当前选中值不合法，纠正为第一个账号
    if (firstAccountId) {
      didFixInvalidSelectionRef.current = true
      switchAccount(firstAccountId)
    }
  }, [accounts.length, currentAccountId, hasCurrent, firstAccountId, switchAccount])

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false)
  const { toast } = useToast()

  // 检查是否还可以添加账号
  const { canAddAccount } = useAccounts()
  const checkResult = canAddAccount()
  const canAdd = checkResult.allowed

  // 处理账号切换
  const handleAccountSwitch = useMemoizedFn(async (accountId: string) => {
    // 特殊值：添加账号
    if (accountId === '__add_account__') {
      if (!canAdd) {
        // 达到上限，显示会员等级提示弹窗
        setIsLimitDialogOpen(true)
        return
      }
      // 可以添加，正常打开添加对话框
      setIsAddDialogOpen(true)
      return
    }

    // Guard: 如果已经是当前选中值，不执行切换
    if (accountId === currentAccountId) return

    // 执行切换
    switchAccount(accountId)
    toast.success('切换账号成功')
  })

  // 处理添加账号
  const handleAddAccount = useMemoizedFn(() => {
    const trimmedName = newAccountName.trim()
    if (!trimmedName) {
      toast.error('请输入账号名称')
      return
    }

    // 检查账号名称是否已存在
    if (accountItems.some(account => account.name === trimmedName)) {
      toast.error('账号名称已存在')
      return
    }

    // 调用添加账号并处理返回值
    const result = addAccount(trimmedName)
    if (result.success) {
      setIsAddDialogOpen(false)
      setNewAccountName('')
      toast.success('添加账号成功')
    } else {
      // 显示错误提示（包含套餐限制信息）
      toast.error(result.error || '添加账号失败')
    }
  })

  // 判断是否有账号
  const hasAccounts = accounts.length > 0

  return (
    <div className="flex items-center gap-2">
      <Select
        disabled={connectState.status === 'connecting'}
        value={normalizedAccountId}
        onValueChange={handleAccountSwitch}
      >
        <SelectTrigger className="w-[11.25rem]" aria-label="选择直播账号">
          <SelectValue
            placeholder={!isAuthenticated ? '请先登录' : hasAccounts ? '选择账号' : '暂无账号'}
          />
        </SelectTrigger>
        <SelectContent>
          {/* 有账号时显示账号列表 */}
          {hasAccounts &&
            accountItems.map(account => {
              const isDefault = defaultAccountId === account.id
              return (
                <SelectItem
                  key={account.id}
                  value={account.id}
                  className="flex items-center justify-between group"
                >
                  <span className="flex-1 truncate">{account.name}</span>
                  <div className="flex items-center gap-1">
                    {isDefault ? (
                      <span className="px-2 py-0.5 text-[11px] rounded bg-primary/20 text-primary font-medium">
                        默认
                      </span>
                    ) : (
                      <button
                        type="button"
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => {
                          e.stopPropagation()
                          e.preventDefault()
                          setDefaultAccount(account.id)
                          toast.success(`已将默认账号设置为：${account.name}`)
                        }}
                        className="ml-2 px-2 py-0.5 text-[11px] rounded bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 transition-all duration-200"
                      >
                        设为默认
                      </button>
                    )}
                  </div>
                </SelectItem>
              )
            })}

          {hasAccounts && <SelectSeparator />}

          {/* 未登录时显示禁用状态的添加账号 */}
          {!isAuthenticated ? (
            <div className="px-2 py-2 text-sm text-muted-foreground cursor-not-allowed opacity-50">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>添加账号（请先登录）</span>
              </div>
            </div>
          ) : (
            <SelectItem value="__add_account__" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>添加账号…</span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加新账号</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="请输入账号名称"
              value={newAccountName}
              onChange={e => setNewAccountName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleAddAccount}>确定</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 会员等级限制提示弹窗 */}
      <AccountLimitDialog
        isOpen={isLimitDialogOpen}
        onClose={() => setIsLimitDialogOpen(false)}
        onContinue={() => {
          // 用户选择继续添加，打开添加对话框
          setIsAddDialogOpen(true)
        }}
      />
    </div>
  )
})

AccountSwitcher.displayName = 'AccountSwitcher'
