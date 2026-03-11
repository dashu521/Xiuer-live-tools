import { useNavigate } from 'react-router'
import { AUTH_BUTTON_CLASSES, AuthCard, AuthHeader, AuthLayout } from '@/components/auth/AuthStyles'
import { Button } from '@/components/ui/button'

export default function ForgotPassword() {
  const navigate = useNavigate()

  const handleBackToLogin = () => {
    // 触发登录弹窗事件，而不是路由跳转
    window.dispatchEvent(new CustomEvent('auth:required', { detail: { feature: 'login' } }))
    navigate('/')
  }

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader title="忘记密码" subtitle="功能开发中" />
        <div className="space-y-4">
          <p className="text-center text-gray-400 text-sm">找回密码功能正在开发中，敬请期待。</p>
          <div className="flex justify-center gap-3 pt-3">
            <Button
              variant="outline"
              onClick={handleBackToLogin}
              className="bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              返回登录
            </Button>
            <Button onClick={() => navigate('/')} className={AUTH_BUTTON_CLASSES}>
              返回首页
            </Button>
          </div>
        </div>
      </AuthCard>
    </AuthLayout>
  )
}
