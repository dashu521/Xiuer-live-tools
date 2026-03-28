/**
 * 账号选择器组件
 *
 * 设计目标：
 * 1. 未登录状态：保持可见，显示登录引导
 * 2. 已登录无账号：保持可见，显示添加账号引导
 * 3. 已登录有账号：显示账号列表
 * 4. 平滑过渡动画
 * 5. 响应式设计
 */

import { useMemoizedFn } from 'ahooks'
import { Plus, UserCircle2, Users } from 'lucide-react'
import React, { useState } from 'react'
import { normalizeAccountSelection, useAccounts } from '@/hooks/useAccounts'
import { useCurrentLiveControl } from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectSeparator, SelectTrigger } from '../ui/select'
import { AccountLimitDialog } from './AccountLimitDialog'

// 调试日志开关
const DEBUG = import.meta.env.DEV

interface AccountSelectorProps {
  className?: string
}

export const AccountSelector = React.memo(({ className }: AccountSelectorProps) => {
  // 状态获取
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const accounts = useAccounts(state => state.accounts)
  const currentAccountId = useAccounts(state => state.currentAccountId)
  const addAccount = useAccounts(state => state.addAccount)
  const switchAccount = useAccounts(state => state.switchAccount)
  const connectState = useCurrentLiveControl(state => state.connectState)
  const { toast } = useToast()

  // 本地状态
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false)
  const [isSelectOpen, setIsSelectOpen] = useState(false)

  // 获取当前账号
  const normalizedSelection = normalizeAccountSelection(accounts, currentAccountId, null)
  const currentAccount = accounts.find(a => a.id === normalizedSelection.currentAccountId)
  const hasAccounts = accounts.length > 0

  // 检查是否还可以添加账号
  const canAddAccount = useAccounts(state => state.canAddAccount)

  // 处理添加账号
  const handleAddAccount = useMemoizedFn(() => {
    const trimmedName = newAccountName.trim()
    if (!trimmedName) {
      toast.error('请输入账号名称')
      return
    }

    // 检查账号名称是否已存在
    if (accounts.some(account => account.name === trimmedName)) {
      toast.error('账号名称已存在')
      return
    }

    // 调用添加账号并处理返回值
    const result = addAccount(trimmedName)
    if (result.success) {
      setIsAddDialogOpen(false)
      setNewAccountName('')
      toast.success({
        title: '账号已添加',
        description: `已添加直播账号“${trimmedName}”。`,
        dedupeKey: `account-added:${trimmedName}`,
      })
      if (DEBUG) console.log('[AccountSelector] 添加账号:', trimmedName)
    } else {
      // 显示错误提示（包含套餐限制信息）
      toast.error({
        title: '添加账号失败',
        description: result.error || '添加账号失败，请稍后重试。',
        dedupeKey: 'account-add-failed',
      })
    }
  })

  // 处理账号切换
  const handleSwitchAccount = useMemoizedFn((accountId: string) => {
    // 特殊值：添加账号
    if (accountId === '__add_account__') {
      openAddDialog()
      return
    }
    if (accountId === currentAccountId) return
    switchAccount(accountId)
  })

  // 打开添加账号对话框（先检查会员等级）
  const openAddDialog = useMemoizedFn(() => {
    const checkResult = canAddAccount()
    if (!checkResult.allowed) {
      // 达到上限，显示会员等级提示弹窗
      setIsLimitDialogOpen(true)
      return
    }
    // 可以添加，正常打开添加对话框
    setIsAddDialogOpen(true)
  })

  if (DEBUG) {
    console.log('[AccountSelector] 渲染:', {
      isAuthenticated,
      hasAccounts,
      accountCount: accounts.length,
      currentAccount: currentAccount?.name,
    })
  }

  // ==================== 未登录状态 ====================
  if (!isAuthenticated) {
    return (
      <Card
        className={cn(
          'flex items-center gap-2 px-3 py-2 w-full h-9',
          'border-dashed border-2 border-muted-foreground/20',
          'opacity-60',
          className,
        )}
        style={{
          backgroundColor: 'var(--surface)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-foreground truncate">直播账号</span>
        </div>
      </Card>
    )
  }

  // ==================== 已登录但无账号状态 ====================
  if (isAuthenticated && !hasAccounts) {
    return (
      <>
        <Card
          className={cn(
            'ui-hover-surface flex items-center gap-2 px-3 py-2 cursor-pointer',
            'border-dashed border-2 border-amber-500/20 hover:border-amber-500/35 hover:bg-amber-500/10',
            'transition-all duration-300 ease-in-out',
            className,
          )}
          onClick={openAddDialog}
        >
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-amber-500/25 bg-amber-500/10 text-amber-200">
            <Plus className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-foreground truncate">添加直播账号</span>
            <span className="text-xs text-muted-foreground truncate">添加第一个账号</span>
          </div>
        </Card>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCircle2 className="h-5 w-5" />
                添加直播账号
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">账号名称</label>
                <Input
                  placeholder="例如：抖音主账号"
                  value={newAccountName}
                  onChange={e => setNewAccountName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddAccount()}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">此名称仅用于标识，可随时修改</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleAddAccount} disabled={!newAccountName.trim()}>
                  添加
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // ==================== 已登录且有账号状态 ====================
  return (
    <>
      <Select
        disabled={connectState.status === 'connecting'}
        value={normalizedSelection.currentAccountId}
        onValueChange={handleSwitchAccount}
        open={isSelectOpen}
        onOpenChange={setIsSelectOpen}
      >
        <SelectTrigger
          className={cn(
            'w-full h-auto px-3 py-2',
            'transition-all duration-200',
            connectState.status === 'connecting' && 'opacity-50 cursor-not-allowed',
            className,
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium truncate max-w-[120px]">
                {currentAccount?.name || '选择账号'}
              </span>
              <span className="text-xs text-muted-foreground">当前账号</span>
            </div>
          </div>
        </SelectTrigger>
        <SelectContent>
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">切换账号</div>

          {accounts.map(account => {
            const isCurrent = account.id === normalizedSelection.currentAccountId

            return (
              <div
                key={account.id}
                className="focus:bg-accent focus:text-accent-foreground flex w-full cursor-pointer items-center justify-between rounded-sm py-2 pr-8 pl-2 text-sm outline-hidden hover:bg-accent group"
                onClick={() => {
                  handleSwitchAccount(account.id)
                  setIsSelectOpen(false)
                }}
              >
                <div className="flex items-center gap-2">
                  <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate max-w-[100px]">{account.name}</span>
                </div>

                <div className="flex items-center gap-1">
                  {isCurrent ? (
                    <span className="px-2 py-0.5 text-[11px] rounded bg-primary/20 text-primary font-medium">
                      当前
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}

          <SelectSeparator />

          <div
            className="focus:bg-accent focus:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm text-primary outline-hidden hover:bg-accent"
            onClick={() => {
              openAddDialog()
              setIsSelectOpen(false)
            }}
          >
            <Plus className="h-4 w-4" />
            <span>添加新账号</span>
          </div>
        </SelectContent>
      </Select>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle2 className="h-5 w-5" />
              添加直播账号
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">账号名称</label>
              <Input
                placeholder="例如：抖音主账号"
                value={newAccountName}
                onChange={e => setNewAccountName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddAccount()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">此名称仅用于标识，可随时修改</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleAddAccount} disabled={!newAccountName.trim()}>
                添加
              </Button>
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
    </>
  )
})

AccountSelector.displayName = 'AccountSelector'
