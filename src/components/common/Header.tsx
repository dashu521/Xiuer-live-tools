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
      className="w-full px-6 flex min-h-[3.75rem] h-[3.75rem] shrink-0 items-center justify-between relative z-10"
      style={{
        backgroundColor: 'var(--header-bg)',
        boxShadow: 'var(--header-top-shadow), var(--header-separator)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center overflow-hidden">
          <img src="./favicon.svg" alt="Logo" className="h-full w-full" />
        </div>
        <div className="leading-tight">
          <h1
            className="text-base font-semibold sm:text-lg tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            秀儿直播助手
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* 账号选择器 - 始终可见 */}
        <div data-tour="account-switcher" className="w-[200px]">
          <AccountSwitcher />
        </div>

        {/* 用户区域 */}
        <div
          className="flex items-center h-9 rounded-lg px-2"
          style={{
            backgroundColor: 'var(--header-action-bg)',
            border: '1px solid var(--header-action-border)',
            color: 'var(--header-action-fg)',
          }}
        >
          {isAuthenticated && user ? (
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
              <span className="text-sm font-medium truncate max-w-[7.5rem]">{user.username}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLoginClick}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--header-action-bg)]"
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
              <span className="text-sm font-medium">登录</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
})
