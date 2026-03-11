/**
 * 统一的认证页面样式常量与组件
 * 用于登录页、注册页、忘记密码页的统一视觉风格
 */

import { cn } from '@/lib/utils'

// ==================== 样式常量 ====================

// 背景渐变
export const AUTH_BG_GRADIENT = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'

// 卡片样式
export const AUTH_CARD_CLASSES =
  'w-full max-w-[26.25rem] bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-2xl p-7 border border-gray-700/50'

// 标题样式
export const AUTH_TITLE_CLASSES = 'text-[1.75rem] font-semibold text-white mb-1'
export const AUTH_SUBTITLE_CLASSES = 'text-sm text-gray-400'

// 输入框样式
export const AUTH_INPUT_CLASSES =
  'h-[2.875rem] rounded-[0.875rem] bg-gray-700/50 border-gray-600 text-white text-[0.9375rem] placeholder:text-gray-500 focus:border-primary focus:ring-2 focus:ring-primary/30'
export const AUTH_INPUT_WITH_ICON_CLASSES =
  'h-[2.875rem] rounded-[0.875rem] bg-gray-700/50 border-gray-600 text-white text-[0.9375rem] pr-12 placeholder:text-gray-500 focus:border-primary focus:ring-2 focus:ring-primary/30'

// Label 样式
export const AUTH_LABEL_CLASSES = 'text-sm font-medium text-gray-300'

// 按钮样式
export const AUTH_BUTTON_CLASSES =
  'w-full h-[3.125rem] rounded-[1rem] text-[0.9375rem] font-medium bg-primary hover:bg-primary/90'

// 错误提示样式
export const AUTH_ERROR_CLASSES = 'mb-4 p-3 border border-destructive/30 rounded-[0.875rem]'
export const AUTH_ERROR_TEXT_CLASSES = 'text-sm text-destructive'

// 链接样式
export const AUTH_LINK_CLASSES =
  'text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium transition-colors'
export const AUTH_LINK_TEXT_CLASSES = 'text-sm text-gray-400'

// 表单间距
export const AUTH_FORM_SPACING = 'space-y-4' // 从 space-y-5 改为 space-y-4，更紧凑

// ==================== 布局组件 ====================

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: AUTH_BG_GRADIENT }}
    >
      {children}
    </div>
  )
}

interface AuthCardProps {
  children: React.ReactNode
  className?: string
}

export function AuthCard({ children, className }: AuthCardProps) {
  return <div className={cn(AUTH_CARD_CLASSES, className)}>{children}</div>
}

interface AuthHeaderProps {
  title: string
  subtitle?: string
}

export function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <div className="text-center mb-6">
      <h1
        className={AUTH_TITLE_CLASSES}
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          className={AUTH_SUBTITLE_CLASSES}
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}

interface AuthErrorProps {
  message: string
}

export function AuthError({ message }: AuthErrorProps) {
  return (
    <div className={AUTH_ERROR_CLASSES}>
      <p
        className={AUTH_ERROR_TEXT_CLASSES}
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
      >
        {message}
      </p>
    </div>
  )
}

interface AuthLinkProps {
  children: React.ReactNode
  onClick: () => void
  className?: string
}

export function AuthLink({ children, onClick, className }: AuthLinkProps) {
  return (
    <button type="button" onClick={onClick} className={cn(AUTH_LINK_CLASSES, className)}>
      {children}
    </button>
  )
}
