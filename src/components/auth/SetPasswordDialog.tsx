import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/useToast'
import { changePassword, setPassword } from '@/services/apiClient'

interface SetPasswordDialogProps {
  isOpen: boolean
  onClose: () => void
  /** true = 首次设置（无旧密码），false = 修改密码（需旧密码） */
  mode: 'set' | 'change'
}

export function SetPasswordDialog({ isOpen, onClose, mode }: SetPasswordDialogProps) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (isOpen) {
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowOld(false)
      setShowNew(false)
      setShowConfirm(false)
      setError(null)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError('密码至少 6 位')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    if (mode === 'change' && !oldPassword) {
      setError('请输入旧密码')
      return
    }

    setIsSubmitting(true)
    try {
      const result =
        mode === 'set'
          ? await setPassword(newPassword)
          : await changePassword(oldPassword, newPassword)

      if (result.ok) {
        toast.success(mode === 'set' ? '密码设置成功，下次可用密码登录' : '密码修改成功')
        onClose()
      } else {
        const msg = result.error?.message || '操作失败，请稍后重试'
        setError(msg)
        toast.error(msg)
      }
    } catch {
      setError('操作失败，请稍后重试')
      toast.error('操作失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const isSetMode = mode === 'set'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
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
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1
            className="text-xl font-semibold mb-0"
            style={{
              color: 'var(--text-primary)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            {isSetMode ? '设置登录密码' : '修改密码'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSetMode ? '设置密码后，下次可用手机号 + 密码直接登录' : '请输入旧密码和新密码'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-3 border border-destructive/20 rounded-lg">
              <p className="text-[13px] text-destructive">{error}</p>
            </div>
          )}

          {!isSetMode && (
            <div>
              <Label
                htmlFor="old-pwd"
                className="text-[13px]"
                style={{ color: 'var(--text-muted)' }}
              >
                旧密码
              </Label>
              <div className="relative mt-1">
                <Input
                  id="old-pwd"
                  type={showOld ? 'text' : 'password'}
                  placeholder="请输入旧密码"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  className="h-10 rounded-lg text-sm pr-10"
                  style={{
                    backgroundColor: 'var(--input-bg)',
                    borderColor: 'var(--input-border)',
                    color: 'var(--text-primary)',
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="new-pwd" className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              {isSetMode ? '密码' : '新密码'}
            </Label>
            <div className="relative mt-1">
              <Input
                id="new-pwd"
                type={showNew ? 'text' : 'password'}
                placeholder={isSetMode ? '请设置密码（至少6位）' : '请输入新密码（至少6位）'}
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
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label
              htmlFor="confirm-pwd"
              className="text-[13px]"
              style={{ color: 'var(--text-muted)' }}
            >
              确认{isSetMode ? '密码' : '新密码'}
            </Label>
            <div className="relative mt-1">
              <Input
                id="confirm-pwd"
                type={showConfirm ? 'text' : 'password'}
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
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-10 rounded-lg text-sm font-medium mt-4"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                提交中...
              </div>
            ) : isSetMode ? (
              '设置密码'
            ) : (
              '修改密码'
            )}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-[13px] text-muted-foreground hover:text-foreground h-auto p-0"
          >
            {isSetMode ? '稍后再说' : '取消'}
          </Button>
        </div>
      </div>
    </div>
  )
}
