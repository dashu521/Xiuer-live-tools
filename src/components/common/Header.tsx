import { User } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { AccountSwitcher } from './AccountSwitcher'

/**
 * Header 组件 - 已优化
 * 1. 使用 memo 避免父组件重渲染时不必要的更新
 * 2. 使用 selector 精确订阅 store 状态，避免订阅整个 store
 * 3. 使用 useCallback 缓存事件处理函数
 */
export const Header = memo(function Header() {
  // 使用 selector 精确订阅，避免订阅整个 store 导致不必要的重渲染
  const user = useAuthStore(state => state.user)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)

  const handleOpenUserCenter = useCallback(() => {
    window.dispatchEvent(new CustomEvent('auth:user-center'))
  }, [])

  const handleLoginClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent('auth:required', { detail: { feature: 'login' } }))
  }, [])

  return (
    <header
      className="relative z-10 flex h-[3.75rem] min-h-[3.75rem] w-full shrink-0 items-center justify-between gap-3 px-3 md:px-6"
      style={{
        backgroundColor: 'var(--header-bg)',
        boxShadow: 'var(--header-top-shadow), var(--header-separator)',
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center overflow-hidden">
          <img src="./favicon.svg" alt="秀儿直播助手标志" className="h-full w-full" />
        </div>
        <div className="min-w-0 leading-tight">
          <h1
            className="truncate text-sm font-semibold tracking-tight sm:text-lg"
            style={{ color: 'var(--text-primary)' }}
          >
            秀儿直播助手
          </h1>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        {/* 账号选择器 - 始终可见 */}
        <div data-tour="account-switcher" className="w-[8.5rem] md:w-[12.5rem]">
          <AccountSwitcher />
        </div>

        {/* 用户区域 */}
        {isAuthenticated && user ? (
          <div
            className="flex h-9 items-center rounded-lg px-2"
            style={{
              backgroundColor: 'var(--header-action-bg)',
              border: '1px solid var(--header-action-border)',
              color: 'var(--header-action-fg)',
            }}
          >
            <button
              type="button"
              onClick={handleOpenUserCenter}
              className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--header-action-bg)]"
              style={{
                color: 'var(--header-action-fg)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'var(--sidebar-item-hover)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <User className="h-4 w-4" />
              <span className="max-w-[5.5rem] truncate text-sm font-medium md:max-w-[7.5rem]">
                {user.username}
              </span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleLoginClick}
            className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-background"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'var(--on-primary)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--primary-hover)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'var(--primary)'
            }}
          >
            <User className="h-4 w-4" />
            <span>登录</span>
          </button>
        )}
      </div>
    </header>
  )
})
