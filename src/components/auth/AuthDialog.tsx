import { Eye, EyeOff, Loader2, LogIn, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FeatureCarousel } from '@/components/onboarding/FeatureCarousel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AUTH_LAST_IDENTIFIER_KEY,
  AUTH_REMEMBER_ME_KEY,
  BLOCKED_TEST_IDENTIFIERS,
  getSanitizedLastIdentifier,
} from '@/constants/authStorageKeys'
import { useToast } from '@/hooks/useToast'
import { useAuthStore } from '@/stores/authStore'
import { PhoneAuthDialog } from './PhoneAuthDialog'

interface AuthDialogProps {
  isOpen: boolean
  onClose: () => void
  feature?: string
}

export function AuthDialog({ isOpen, onClose, feature }: AuthDialogProps) {
  const [showPhoneAuth, setShowPhoneAuth] = useState(false)
  const [phoneAuthMode, setPhoneAuthMode] = useState<'login' | 'register' | 'reset'>('login')
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
    rememberMe: false,
  })

  const [showPassword, setShowPassword] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [lastLoginRawError, setLastLoginRawError] = useState<string | null>(null)
  const [devDetailsOpen, setDevDetailsOpen] = useState(false)

  const { login, isLoading, error, clearError } = useAuthStore()
  const { toast } = useToast()

  const hasAutoFilledRef = useRef(false)

  useEffect(() => {
    if (isOpen) {
      clearError()
      setValidationError(null)
      setLastLoginRawError(null)
      setDevDetailsOpen(false)
      hasAutoFilledRef.current = false
    } else {
      const rememberMe = localStorage.getItem(AUTH_REMEMBER_ME_KEY) === 'true'
      const lastIdentifier = getSanitizedLastIdentifier()
      if (rememberMe && lastIdentifier) {
        setLoginForm({ username: lastIdentifier, password: '', rememberMe: true })
      } else {
        setLoginForm({ username: '', password: '', rememberMe: false })
      }
    }
  }, [isOpen, clearError])

  useEffect(() => {
    const handleCloseMainDialog = () => {
      onClose()
    }
    window.addEventListener('auth:closeMainDialog', handleCloseMainDialog)
    return () => {
      window.removeEventListener('auth:closeMainDialog', handleCloseMainDialog)
    }
  }, [onClose])

  useEffect(() => {
    if (isOpen && !hasAutoFilledRef.current) {
      const rememberMe = localStorage.getItem(AUTH_REMEMBER_ME_KEY) === 'true'
      const lastIdentifier = getSanitizedLastIdentifier()

      if (rememberMe && lastIdentifier && !loginForm.username.trim()) {
        setLoginForm(prev => ({ ...prev, username: lastIdentifier, rememberMe: true }))
        hasAutoFilledRef.current = true

        setTimeout(() => {
          const passwordInput = document.getElementById('login-password') as HTMLInputElement
          if (passwordInput) {
            passwordInput.focus()
          }
        }, 100)
      } else if (rememberMe && !loginForm.username.trim()) {
        setLoginForm(prev => ({ ...prev, rememberMe: true }))
        hasAutoFilledRef.current = true
      } else if (!rememberMe) {
        setLoginForm(prev => ({ ...prev, rememberMe: false }))
        hasAutoFilledRef.current = true
      }
    }
  }, [isOpen, loginForm.username])

  const validateLoginForm = (): string | null => {
    const phone = loginForm.username?.trim()
    if (!phone) {
      return '请输入手机号'
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return '手机号格式不正确'
    }
    if (!loginForm.password || loginForm.password.length < 6) {
      return '密码不能少于6位'
    }
    return null
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setValidationError(null)

    const validationErr = validateLoginForm()
    if (validationErr) {
      setValidationError(validationErr)
      toast.error(validationErr)
      return
    }

    const result = await login(loginForm)
    if (result.success) {
      const { rememberMe, username } = loginForm
      if (rememberMe) {
        localStorage.setItem(AUTH_REMEMBER_ME_KEY, 'true')
        const trimmed = username.trim()
        if (trimmed && !BLOCKED_TEST_IDENTIFIERS.has(trimmed)) {
          localStorage.setItem(AUTH_LAST_IDENTIFIER_KEY, trimmed)
        } else {
          localStorage.removeItem(AUTH_LAST_IDENTIFIER_KEY)
        }
      } else {
        localStorage.setItem(AUTH_REMEMBER_ME_KEY, 'false')
        localStorage.removeItem(AUTH_LAST_IDENTIFIER_KEY)
      }

      window.dispatchEvent(new CustomEvent('auth:success', { detail: { feature } }))
      toast.success('登录成功')
      onClose()
      setLoginForm({ username: '', password: '', rememberMe: false })
    } else {
      const userMessage = result.error || '登录失败，请稍后重试'
      setLoginForm(prev => ({ ...prev, password: '' }))
      setValidationError(userMessage)
      setLastLoginRawError(result.rawError ?? null)
      setDevDetailsOpen(false)
      toast.error(userMessage)
      setTimeout(() => {
        const passwordInput = document.getElementById('login-password') as HTMLInputElement | null
        if (passwordInput) passwordInput.focus()
      }, 100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const formEvent = {
        ...e,
        currentTarget: e.currentTarget,
        target: e.target,
      } as unknown as React.FormEvent
      handleLogin(formEvent)
    }
  }

  if (!isOpen) return null

  const displayError = error || validationError

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="w-full max-w-[26.25rem] rounded-xl border p-6"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        {/* Header */}
        <div className="text-center mb-5">
          <h1
            className="text-xl font-semibold mb-0"
            style={{
              color: 'var(--text-primary)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            登录
          </h1>
        </div>

        {/* Content */}
        <div>
          {displayError && (
            <div className="mb-4 p-3 border border-destructive/20 rounded-lg space-y-2">
              <p
                className="text-[13px] text-destructive"
                style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                {displayError}
              </p>
              {import.meta.env.DEV && lastLoginRawError && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setDevDetailsOpen(prev => !prev)}
                    className="text-[12px] text-muted-foreground hover:text-foreground underline"
                  >
                    {devDetailsOpen ? '收起' : '更多信息'}
                  </button>
                  {devDetailsOpen && (
                    <pre className="mt-1 p-2 bg-muted/50 rounded text-[11px] overflow-auto max-h-24 break-all whitespace-pre-wrap">
                      {lastLoginRawError}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-3">
            <Input
              id="login-username"
              type="text"
              placeholder="手机号"
              value={loginForm.username}
              onChange={e => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
              onKeyDown={handleKeyDown}
              className="h-10 rounded-lg text-sm pr-12 focus-visible:ring-2 focus-visible:ring-ring/30"
              style={{
                backgroundColor: 'var(--input-bg)',
                borderColor: 'var(--input-border)',
                color: 'var(--text-primary)',
              }}
              required
              autoFocus
            />

            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="密码"
                value={loginForm.password}
                onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                onKeyDown={handleKeyDown}
                className="h-10 rounded-lg text-sm pr-12 focus-visible:ring-2 focus-visible:ring-ring/30"
                style={{
                  backgroundColor: 'var(--input-bg)',
                  borderColor: 'var(--input-border)',
                  color: 'var(--text-primary)',
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150 p-1 rounded focus:outline-none focus:ring-2 focus:ring-ring/50"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={loginForm.rememberMe}
                  onChange={e => setLoginForm(prev => ({ ...prev, rememberMe: e.target.checked }))}
                  className="h-4 w-4 rounded border focus:ring-2 focus:ring-ring/30"
                  style={{
                    borderColor: 'var(--input-border)',
                    backgroundColor: 'var(--input-bg)',
                  }}
                />
                <Label
                  htmlFor="remember-me"
                  className="text-[13px] cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                >
                  记住登录状态
                </Label>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPhoneAuthMode('reset')
                  setShowPhoneAuth(true)
                }}
                className="text-[13px] text-primary hover:opacity-80 transition-colors duration-150"
              >
                忘记密码？
              </button>
            </div>

            <Button
              type="submit"
              className="w-full h-10 rounded-lg text-sm font-medium mt-4"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  登录中...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  登录
                </div>
              )}
            </Button>

            {/* Footer */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-center gap-2 text-[14px]">
                <span className="text-muted-foreground">还没有账号？</span>
                <button
                  type="button"
                  onClick={() => {
                    setPhoneAuthMode('register')
                    setShowPhoneAuth(true)
                  }}
                  className="text-primary hover:opacity-80 font-medium transition-colors duration-150"
                >
                  手机号注册
                </button>
              </div>

              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setPhoneAuthMode('login')
                    setShowPhoneAuth(true)
                  }}
                  className="text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-150 flex items-center gap-1"
                >
                  <Smartphone className="h-3 w-3" />
                  验证码登录
                </button>
              </div>
            </div>
          </form>

          {/* Cancel Button */}
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-[13px] text-muted-foreground hover:text-foreground h-auto p-0"
            >
              取消
            </Button>
          </div>

          {/* 功能轮播 - 让用户了解产品价值 */}
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center mb-3">
              ✨ 登录后可使用以下超酷功能
            </p>
            <FeatureCarousel />
          </div>
        </div>
      </div>

      <PhoneAuthDialog
        isOpen={showPhoneAuth}
        onClose={() => setShowPhoneAuth(false)}
        feature={feature}
        initialMode={phoneAuthMode}
      />
    </div>
  )
}
