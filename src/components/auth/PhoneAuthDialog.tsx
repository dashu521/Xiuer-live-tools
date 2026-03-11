import { Eye, EyeOff, KeyRound, Loader2, LogIn, Smartphone, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SetPasswordDialog } from '@/components/auth/SetPasswordDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getEffectivePlan } from '@/constants/subscription'
import { useAccounts } from '@/hooks/useAccounts'
import { useAutoMessageStore } from '@/hooks/useAutoMessage'
import { useAutoPopUpStore } from '@/hooks/useAutoPopUp'
import { useAutoReplyConfigStore } from '@/hooks/useAutoReplyConfig'
import { useChromeConfigStore } from '@/hooks/useChromeConfig'
import { useLiveControlStore } from '@/hooks/useLiveControl'
import { useSubAccountStore } from '@/hooks/useSubAccount'
import { useToast } from '@/hooks/useToast'
import {
  getUserStatus,
  loginWithSmsCode,
  resetPasswordWithSms,
  sendSmsCode,
} from '@/services/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { usePlatformPreferenceStore } from '@/stores/platformPreferenceStore'

interface PhoneAuthDialogProps {
  isOpen: boolean
  onClose: () => void
  feature?: string
  initialMode?: 'login' | 'register' | 'reset'
}

const MODE_CONFIG = {
  login: {
    icon: Smartphone,
    title: '验证码登录',
    subtitle: '未注册的手机号将自动创建账号',
    submitText: '登录',
    submittingText: '登录中...',
  },
  register: {
    icon: UserPlus,
    title: '手机号注册',
    subtitle: '注册后需设置密码，之后可用密码快捷登录',
    submitText: '注册',
    submittingText: '注册中...',
  },
  reset: {
    icon: KeyRound,
    title: '重置密码',
    subtitle: '通过手机验证码重置登录密码',
    submitText: '重置密码',
    submittingText: '重置中...',
  },
} as const

export function PhoneAuthDialog({
  isOpen,
  onClose,
  feature,
  initialMode = 'login',
}: PhoneAuthDialogProps) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showSetPassword, setShowSetPassword] = useState(false)

  const { setUser, setToken, setRefreshToken, setUserStatus } = useAuthStore()
  const { toast } = useToast()

  const mode = initialMode

  useEffect(() => {
    if (isOpen) {
      setValidationError(null)
      setPhone('')
      setCode('')
      setNewPassword('')
      setConfirmPassword('')
      setShowNewPwd(false)
      setShowConfirmPwd(false)
      setCountdown(0)
    }
  }, [isOpen])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const validatePhone = (): string | null => {
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phone || !phone.trim()) return '请输入手机号'
    if (!phoneRegex.test(phone)) return '请输入有效的手机号'
    return null
  }

  const validateCode = (): string | null => {
    if (!code || !code.trim()) return '请输入验证码'
    if (code.length !== 6) return '验证码为6位数字'
    return null
  }

  const validateResetFields = (): string | null => {
    if (newPassword.length < 6) return '密码至少 6 位'
    if (newPassword !== confirmPassword) return '两次输入的密码不一致'
    return null
  }

  const handleSendCode = async () => {
    const err = validatePhone()
    if (err) {
      setValidationError(err)
      toast.error(err)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await sendSmsCode(phone)
      if (result.ok && result.data?.success) {
        const devCode = result.data?.dev_code
        const smsFailed = result.data?.sms_failed
        if (devCode) {
          setCode(devCode)
          if (smsFailed) {
            toast.success(`短信发送失败，验证码已填入：${devCode}，请直接登录`)
          } else {
            toast.success(`验证码已填入：${devCode}（若未收到短信可直接使用）`)
          }
        } else {
          toast.success('验证码已发送')
        }
        setCountdown(60)
        setValidationError(null)
      } else if (!result.ok && result.error) {
        // 处理特定的错误码
        const status = result.status
        const message = result.error.message || '发送失败，请稍后重试'

        let errorMsg = message
        if (status === 429 || message.includes('limit') || message.includes('limit_exceeded')) {
          errorMsg = '发送过于频繁，请稍后再试（每日有发送限制）'
        }

        setValidationError(errorMsg)
        toast.error(errorMsg)
      } else {
        setValidationError('发送失败，请稍后重试')
        toast.error('发送失败，请稍后重试')
      }
    } catch (error) {
      console.error('[PhoneAuthDialog] Send code error:', error)
      const errorMsg = '发送失败，请稍后重试'
      setValidationError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSmsLogin = async () => {
    const phoneErr = validatePhone()
    const codeErr = validateCode()
    if (phoneErr) {
      setValidationError(phoneErr)
      toast.error(phoneErr)
      return
    }
    if (codeErr) {
      setValidationError(codeErr)
      toast.error(codeErr)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await loginWithSmsCode(phone, code)
      console.log('[PhoneAuthDialog] 短信登录返回结果:', JSON.stringify(result, null, 2))
      if (result.ok && result.data?.token) {
        const { user, refresh_token, needs_password } = result.data
        console.log('[PhoneAuthDialog] 解析后的 user 对象:', JSON.stringify(user, null, 2))
        console.log('[PhoneAuthDialog] user.id:', user?.id)
        console.log('[PhoneAuthDialog] user.phone:', user?.phone)

        // 优先使用手机号作为显示用户名，后端返回的 id 是 UUID
        const finalUserId = user?.id || phone
        const finalUsername = user?.phone || phone // 显示手机号而不是 UUID

        const safeUser = {
          id: finalUserId,
          username: finalUsername, // 显示手机号
          email: user?.email || '',
          phone: user?.phone || phone,
          createdAt: user?.created_at || new Date().toISOString(),
          lastLogin: user?.last_login_at || null,
          status: (user?.status as 'active' | 'inactive' | 'banned') || 'active',
          licenseType: 'free' as const,
          plan: 'free' as const, // 初始值，登录后会通过 getUserStatus 获取真实套餐
          expiryDate: null,
          expire_at: null, // 统一 expire_at 字段
          deviceId: '',
          machineFingerprint: '',
          balance: 0,
        }
        console.log('[PhoneAuthDialog] 构建的 safeUser:', JSON.stringify(safeUser, null, 2))

        // [SECURITY] 将敏感 token 保存到主进程安全存储（与密码登录保持一致）
        console.log('[PhoneAuthDialog] Saving tokens to main process...')
        if (typeof window !== 'undefined') {
          const authAPI = (
            window as {
              authAPI?: {
                setTokens?: (tokens: {
                  token: string | null
                  refreshToken: string | null
                }) => Promise<void>
              }
            }
          ).authAPI
          if (authAPI?.setTokens) {
            try {
              await authAPI.setTokens({
                token: result.data.token,
                refreshToken: refresh_token ?? null,
              })
              console.log('[PhoneAuthDialog] Tokens saved to main process successfully')
            } catch (err) {
              console.error('[PhoneAuthDialog] Failed to save tokens to main process:', err)
            }
          } else {
            console.warn('[PhoneAuthDialog] authAPI.setTokens not available')
          }
        }

        setUser(safeUser)
        setToken(result.data.token)
        if (refresh_token) {
          setRefreshToken(refresh_token)
        }
        useAuthStore.setState({ isAuthenticated: true })

        console.log('[PhoneAuthDialog] 短信登录成功，加载用户账号数据, userId:', finalUserId)
        useAccounts.getState().loadUserAccounts(finalUserId)
        usePlatformPreferenceStore.getState().loadUserPreferences(finalUserId)
        useAutoReplyConfigStore.getState().loadUserContexts(finalUserId)
        useAutoMessageStore.getState().loadUserContexts(finalUserId)
        useAutoPopUpStore.getState().loadUserContexts(finalUserId)
        useChromeConfigStore.getState().loadUserConfigs(finalUserId)
        useLiveControlStore.getState().loadUserContexts(finalUserId)
        useSubAccountStore.getState().loadUserContexts(finalUserId)

        // 获取用户状态并同步更新 user.plan
        getUserStatus()
          .then(status => {
            if (status) {
              setUserStatus(status)
              // 同步更新 user.plan
              const currentUser = useAuthStore.getState().user
              if (currentUser && status.plan) {
                const effectivePlan = getEffectivePlan(status.plan, status.trial)
                setUser({
                  ...currentUser,
                  plan: effectivePlan,
                  expire_at: status.expire_at ?? null,
                } as typeof currentUser)
              }
            }
          })
          .catch(error => {
            console.error('[PhoneAuthDialog] Failed to fetch user status:', error)
          })
        window.dispatchEvent(new CustomEvent('auth:success', { detail: { feature } }))

        const isRegister = mode === 'register'
        toast.success(isRegister ? '注册成功' : '登录成功')

        if (needs_password || isRegister) {
          setShowSetPassword(true)
        } else {
          onClose()
          window.dispatchEvent(new CustomEvent('auth:closeMainDialog'))
        }
      } else if (!result.ok && result.error) {
        const errorMsg = result.error.message || '操作失败，请检查验证码'
        setValidationError(errorMsg)
        toast.error(errorMsg)
      } else {
        setValidationError('操作失败，请检查验证码')
        toast.error('操作失败，请检查验证码')
      }
    } catch {
      const errorMsg = '操作失败，请稍后重试'
      setValidationError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    const phoneErr = validatePhone()
    const codeErr = validateCode()
    const pwdErr = validateResetFields()
    if (phoneErr) {
      setValidationError(phoneErr)
      toast.error(phoneErr)
      return
    }
    if (codeErr) {
      setValidationError(codeErr)
      toast.error(codeErr)
      return
    }
    if (pwdErr) {
      setValidationError(pwdErr)
      toast.error(pwdErr)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await resetPasswordWithSms(phone, code, newPassword)
      if (result.ok) {
        toast.success('密码重置成功，请用新密码登录')
        onClose()
        window.dispatchEvent(new CustomEvent('auth:closeMainDialog'))
      } else {
        const msg = result.error?.message || '重置失败，请稍后重试'
        setValidationError(msg)
        toast.error(msg)
      }
    } catch {
      setValidationError('重置失败，请稍后重试')
      toast.error('重置失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'reset') {
      await handleResetPassword()
    } else {
      await handleSmsLogin()
    }
  }

  if (!isOpen) return null

  const cfg = MODE_CONFIG[mode]
  const Icon = cfg.icon

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
        <div className="text-center mb-5">
          <div className="flex justify-center mb-2">
            <div className="p-3 rounded-full bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1
            className="text-xl font-semibold mb-0"
            style={{
              color: 'var(--text-primary)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            {cfg.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{cfg.subtitle}</p>
        </div>

        <div>
          {validationError && (
            <div className="mb-4 p-3 border border-destructive/20 rounded-lg">
              <p className="text-[13px] text-destructive">{validationError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="phone" className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                手机号
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                className="h-10 rounded-lg text-sm mt-1"
                style={{
                  backgroundColor: 'var(--input-bg)',
                  borderColor: 'var(--input-border)',
                  color: 'var(--text-primary)',
                }}
                maxLength={11}
                required
              />
            </div>

            <div>
              <Label htmlFor="code" className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                验证码
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="code"
                  type="text"
                  placeholder="请输入验证码"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="h-10 rounded-lg text-sm flex-1"
                  style={{
                    backgroundColor: 'var(--input-bg)',
                    borderColor: 'var(--input-border)',
                    color: 'var(--text-primary)',
                  }}
                  maxLength={6}
                  required
                />
                <Button
                  type="button"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || isSubmitting || phone.length !== 11}
                  className="h-10 rounded-lg text-sm whitespace-nowrap"
                  style={{ minWidth: '100px' }}
                >
                  {countdown > 0 ? `${countdown}秒` : '发送验证码'}
                </Button>
              </div>
            </div>

            {mode === 'reset' && (
              <>
                <div>
                  <Label
                    htmlFor="new-pwd"
                    className="text-[13px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    新密码
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="new-pwd"
                      type={showNewPwd ? 'text' : 'password'}
                      placeholder="请输入新密码（至少6位）"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="h-10 rounded-lg text-sm pr-10"
                      style={{
                        backgroundColor: 'var(--input-bg)',
                        borderColor: 'var(--input-border)',
                        color: 'var(--text-primary)',
                      }}
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd(!showNewPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label
                    htmlFor="confirm-pwd"
                    className="text-[13px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    确认密码
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="confirm-pwd"
                      type={showConfirmPwd ? 'text' : 'password'}
                      placeholder="请再次输入密码"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="h-10 rounded-lg text-sm pr-10"
                      style={{
                        backgroundColor: 'var(--input-bg)',
                        borderColor: 'var(--input-border)',
                        color: 'var(--text-primary)',
                      }}
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPwd ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full h-10 rounded-lg text-sm font-medium mt-4"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {cfg.submittingText}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {mode === 'reset' ? (
                    <KeyRound className="h-4 w-4" />
                  ) : mode === 'register' ? (
                    <UserPlus className="h-4 w-4" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  {cfg.submitText}
                </div>
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-[13px] text-muted-foreground hover:text-foreground h-auto p-0"
            >
              取消
            </Button>
          </div>
        </div>
      </div>

      {mode !== 'reset' && (
        <SetPasswordDialog
          isOpen={showSetPassword}
          onClose={() => {
            setShowSetPassword(false)
            onClose()
            window.dispatchEvent(new CustomEvent('auth:closeMainDialog'))
          }}
          mode="set"
        />
      )}
    </div>
  )
}
