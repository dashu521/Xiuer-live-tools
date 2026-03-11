import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * React 错误边界组件
 * 捕获子组件树中的 JavaScript 错误，并显示降级 UI
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // 更新 state 使下一次渲染能够显示降级 UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 记录错误信息到控制台
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // TODO: 这里可以集成错误监控服务（如 Sentry、LogRocket 等）
    // reportErrorToService(error, errorInfo)
  }

  resetError = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback 组件，使用它
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error!} resetError={this.resetError} />
      }

      // 默认的错误显示 UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">糟糕！出现错误</CardTitle>
              <CardDescription>应用程序遇到了意外错误，请尝试以下操作：</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">错误详情：</p>
                <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
                  <p className="text-sm font-mono text-destructive">{this.state.error?.message}</p>
                </div>
                {process.env.NODE_ENV === 'development' && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">查看错误堆栈</summary>
                    <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-32">
                      {this.state.error?.stack}
                    </pre>
                  </details>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button onClick={this.resetError} className="w-full">
                重试
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
                刷新页面
              </Button>
            </CardFooter>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// 默认的错误 fallback 组件
export const DefaultErrorFallback: React.FC<{
  error: Error
  resetError: () => void
}> = ({ error, resetError }) => (
  <div className="min-h-screen flex items-center justify-center p-4 bg-background">
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          应用程序错误
        </CardTitle>
        <CardDescription>很抱歉，应用程序遇到了意外问题</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-foreground mb-2">错误信息</h3>
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded">{error.message}</p>
          </div>

          {process.env.NODE_ENV === 'development' && error.stack && (
            <div>
              <h3 className="font-medium text-foreground mb-2">技术详情</h3>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">查看错误堆栈</summary>
                <pre className="mt-2 p-3 bg-muted rounded text-muted-foreground overflow-auto max-h-40">
                  {error.stack}
                </pre>
              </details>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex gap-3">
        <Button onClick={resetError} className="flex-1">
          重新尝试
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()} className="flex-1">
          刷新页面
        </Button>
      </CardFooter>
    </Card>
  </div>
)

// 用于包装特定组件的高阶组件
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorFallback?: React.ComponentType<{ error: Error; resetError: () => void }>,
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={errorFallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}
