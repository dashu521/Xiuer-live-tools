import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class UserCenterErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[UserCenterErrorBoundary] 捕获到错误:', error)
    console.error('[UserCenterErrorBoundary] 错误信息:', errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="w-[24rem] max-w-[92vw] bg-[var(--surface)] rounded-2xl border border-[hsl(var(--border))] overflow-hidden p-6"
            style={{ boxShadow: 'var(--shadow-modal)' }}
          >
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-2">页面加载出错</h2>
              <p className="text-sm text-muted-foreground mb-4">
                个人中心加载时遇到问题，请尝试刷新页面
              </p>
              {this.state.error && (
                <p className="text-xs text-muted-foreground mb-4 font-mono bg-muted/30 p-2 rounded max-w-full overflow-hidden text-ellipsis">
                  {this.state.error.message}
                </p>
              )}
              <Button onClick={this.handleRetry} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                重试
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
