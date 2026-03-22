import { Eye, EyeOff, KeyRound, Loader2, LogIn, Smartphone, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SetPasswordDialog } from '@/components/auth/SetPasswordDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAccounts } from '@/hooks/useAccounts'
import { useAutoMessageStore } from '@/hooks/useAutoMessage'
import { useAutoPopUpStore } from '@/hooks/useAutoPopUp'
import { useAutoReplyConfigStore } from '@/hooks/useAutoReplyConfig'
import { useChromeConfigStore } from '@/hooks/useChromeConfig'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { useLiveControlStore } from '@/hooks/useLiveControl'
import { useSubAccountStore } from '@/hooks/useSubAccount'
import { useToast } from '@/hooks/useToast'
import { resetPasswordWithSms, sendSmsCode } from '@/services/apiClient'
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

  const { setUser, setToken, setRefreshToken } = useAuthStore()
  const { toast } = useToast()
  const { showError } = useFriendlyError()

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
    if (!phoneRegex.test(phone)) return '手机号格式不对，请检查一下'
    return null
  }

  const validateCode = (): string | null => {
    if (!code || !code.trim()) return '请输入验证码'
    if (code.length !== 6) return '验证码是 6 位数字'
    return null
  }

  const validateResetFields = (): string | null => {
    if (newPassword.length < 6) return '密码至少要 6 位'
    if (newPassword !== confirmPassword) return '两次输入的密码不一样，请重新输入'
    return null
  }

  const handleSendCode = async () => {
    const err = validatePhone()
    if (err) {
      setValidationError(err)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await sendSmsCode(phone)
      if (result.ok && result.data?.success) {
        const devCode = result.data?.dev_code
        const smsFailed = result.data?.sms_failed
        // [SECURITY] 禁止自动填入验证码，只允许在控制台/toast中提示
        if (devCode) {
          // eslint-disable-next-line no-console
          console.log('[DEV] SMS code (for debugging only):', devCode)
          if (smsFailed) {
            toast.warning({
              title: '短信发送失败',
              description: '短信服务暂时不可用，请稍后重试或使用其他登录方式。',
              dedupeKey: 'sms-code-failed',
            })
          } else {
            toast.success({
              title: '验证码已发送',
              description: '请查看手机短信并在 60 秒内完成验证。',
              dedupeKey: 'sms-code-sent',
            })
          }
        } else {
          toast.success({
            title: '验证码已发送',
            description: '请查看手机短信并在 60 秒内完成验证。',
            dedupeKey: 'sms-code-sent',
          })
        }
        setCountdown(60)
        setValidationError(null)
      } else if (!result.ok && result.error) {
        // 处理特定的错误码
        const status = result.status
        const message = result.error.message || '发送失败，请稍后重试'

        let errorMsg = message
        if (status === 429 || message.includes('limit') || message.includes('limit_exceeded')) {
          errorMsg = '发送太快了，请稍后再试'
        }

        setValidationError(errorMsg)
        showError(errorMsg, {
          title: '发送验证码失败',
          showSolution: true,
        })
      } else {
        setValidationError('发送失败了，稍后再试')
        showError('发送失败了，稍后再试', {
          title: '发送验证码失败',
          showSolution: true,
        })
      }
    } catch (error) {
      console.error('[PhoneAuthDialog] Send code error:', error)
      const errorMsg = '发送失败了，稍后再试'
      setValidationError(errorMsg)
      showError(error, {
        title: '发送验证码失败',
        message: errorMsg,
        showSolution: true,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSmsLogin = async () => {
    const phoneErr = validatePhone()
    const codeErr = validateCode()
    if (phoneErr) {
      setValidationError(phoneErr)
      return
    }
    if (codeErr) {
      setValidationError(codeErr)
      return
    }

    setIsSubmitting(true)
    console.log(
      '[PhoneAuthDialog] 开始短信登录流程, phone末4位:',
      phone.slice(-4),
      'code长度:',
      code.length,
    )
    try {
      // [SECURITY-FIX] 使用主进程代理登录，内部处理 token 存储
      const authAPI = (
        window as unknown as {
          authAPI?: { loginWithSms?: (phone: string, code: string) => Promise<unknown> }
        }
      ).authAPI
      console.log(
        '[PhoneAuthDialog] authAPI 存在:',
        !!authAPI,
        'loginWithSms 存在:',
        !!authAPI?.loginWithSms,
      )
      if (!authAPI?.loginWithSms) {
        setValidationError('登录功能暂时不可用，请重启软件')
        showError('登录功能暂时不可用，请重启软件', {
          title: '登录暂不可用',
          showSolution: true,
        })
        setIsSubmitting(false)
        return
      }

      console.log('[PhoneAuthDialog] 调用 authAPI.loginWithSms...')
      const result = (await authAPI.loginWithSms(phone, code)) as {
        success: boolean
        user?: {
          id: string
          username: string
          email?: string
          phone?: string
          status?: string
          created_at?: string
          last_login_at?: string
        }
        token?: string
        refresh_token?: string
        needs_password?: boolean
        error?: string
      }

      console.log('[PhoneAuthDialog] 短信登录返回结果:', JSON.stringify(result, null, 2))

      if (result.success && result.token) {
        const { user, refresh_token, needs_password } = result
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
          licenseType: 'trial' as const,
          plan: 'trial' as const, // 初始值，登录后会通过 getUserStatus 获取真实套餐
          expiryDate: null,
          expire_at: null, // 统一 expire_at 字段
          deviceId: '',
          machineFingerprint: '',
          balance: 0,
        }
        console.log('[PhoneAuthDialog] 构建的 safeUser:', JSON.stringify(safeUser, null, 2))

        // [SECURITY] token 已由主进程内部存储，这里只更新 renderer 状态
        console.log('[PhoneAuthDialog] Token 已由主进程存储，更新 renderer 状态...')

        setUser(safeUser)
        setToken(result.token)
        if (refresh_token) {
          setRefreshToken(refresh_token)
        }
        useAuthStore.setState({ isAuthenticated: true, userStatus: null })

        console.log('[PhoneAuthDialog] 短信登录成功，加载用户账号数据, userId:', finalUserId)
        useAccounts.getState().loadUserAccounts(finalUserId)
        usePlatformPreferenceStore.getState().loadUserPreferences(finalUserId)
        useAutoReplyConfigStore.getState().loadUserContexts(finalUserId)
        useAutoMessageStore.getState().loadUserContexts(finalUserId)
        useAutoPopUpStore.getState().loadUserContexts(finalUserId)
        useChromeConfigStore.getState().loadUserConfigs(finalUserId)
        useLiveControlStore.getState().loadUserContexts(finalUserId)
        useSubAccountStore.getState().loadUserContexts(finalUserId)

        // 统一通过 authStore 同步会员状态，避免会员等级 / 到期时间 / 账号上限割裂。
        useAuthStore
          .getState()
          .refreshUserStatus()
          .catch(error => {
            console.error('[PhoneAuthDialog] Failed to fetch user status:', error)
          })
        window.dispatchEvent(new CustomEvent('auth:success', { detail: { feature } }))

        const isRegister = mode === 'register'
        toast.success({
          title: isRegister ? '注册成功' : '登录成功',
          description: isRegister ? '账号已创建并完成登录。' : '欢迎回来，已完成登录。',
          dedupeKey: isRegister ? 'sms-register-success' : 'sms-login-success',
        })

        if (needs_password || isRegister) {
          setShowSetPassword(true)
        } else {
          onClose()
          window.dispatchEvent(new CustomEvent('auth:closeMainDialog'))
        }
      } else if (!result.success) {
        const errorMsg = result.error || '验证码不对，请重新输入'
        setValidationError(errorMsg)
      } else {
        setValidationError('验证码不对，请重新输入')
      }
    } catch (err) {
      console.error('[PhoneAuthDialog] 短信登录异常:', err)
      const errorMsg = '操作失败了，稍后再试'
      setValidationError(errorMsg)
      showError(err, {
        title: '登录失败',
        message: errorMsg,
        showSolution: true,
      })
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
      return
    }
    if (codeErr) {
      setValidationError(codeErr)
      return
    }
    if (pwdErr) {
      setValidationError(pwdErr)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await resetPasswordWithSms(phone, code, newPassword)
      if (result.ok) {
        toast.success({
          title: '密码已重置',
          description: '可以使用新密码重新登录了。',
          dedupeKey: 'password-reset-success',
        })
        onClose()
        window.dispatchEvent(new CustomEvent('auth:closeMainDialog'))
      } else {
        const msg = result.error?.message || '重置失败了，稍后再试'
        setValidationError(msg)
        showError(msg, {
          title: '重置密码失败',
          showSolution: true,
        })
      }
    } catch (error) {
      setValidationError('重置失败了，稍后再试')
      showError(error, {
        title: '重置密码失败',
        message: '重置失败了，稍后再试',
        showSolution: true,
      })
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
    <>
      <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
        <DialogContent
          aria-describedby="phone-auth-description"
          className="w-full max-w-[26.25rem] rounded-xl border p-6"
          onPointerDownOutside={event => {
            if (isSubmitting) {
              event.preventDefault()
            }
          }}
          onEscapeKeyDown={event => {
            if (isSubmitting) {
              event.preventDefault()
            }
          }}
        >
          <DialogHeader className="mb-5 text-center">
            <div className="mb-2 flex justify-center">
              <div className="rounded-full bg-primary/10 p-3">
                <Icon className="h-6 w-6 text-primary" />
              </div>
            </div>
            <DialogTitle
              className="text-xl font-semibold"
              style={{
                color: 'var(--text-primary)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {cfg.title}
            </DialogTitle>
            <DialogDescription id="phone-auth-description">{cfg.subtitle}</DialogDescription>
          </DialogHeader>
          <div>
            {validationError && (
              <div className="mb-4 p-3 border border-destructive/20 rounded-lg">
                <p role="alert" aria-live="polite" className="text-[13px] text-destructive">
                  {validationError}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label
                  htmlFor="phone"
                  className="text-[13px]"
                  style={{ color: 'var(--text-muted)' }}
                >
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
                <Label
                  htmlFor="code"
                  className="text-[13px]"
                  style={{ color: 'var(--text-muted)' }}
                >
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
                        aria-label={showNewPwd ? '隐藏新密码' : '显示新密码'}
                        onClick={() => setShowNewPwd(!showNewPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
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
                        aria-label={showConfirmPwd ? '隐藏确认密码' : '显示确认密码'}
                        onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
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
        </DialogContent>
      </Dialog>
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
    </>
  )
}
