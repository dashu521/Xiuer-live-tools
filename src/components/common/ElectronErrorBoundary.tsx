import React, { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ElectronErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ElectronErrorBoundary caught an error:', error, errorInfo)

    // Check if the error is related to missing ipcRenderer
    if (
      error.message?.includes('ipcRenderer') ||
      error.message?.includes('Cannot read properties of undefined')
    ) {
      console.error(
        'Electron API is not available. Make sure you are running the app in Electron, not in a browser.',
      )
    }
  }

  render() {
    if (this.state.hasError) {
      const isIpcError =
        this.state.error?.message?.includes('ipcRenderer') ||
        this.state.error?.message?.includes('Cannot read properties of undefined')

      if (isIpcError) {
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100vh',
              padding: '2rem',
              textAlign: 'center',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#ef4444' }}>
              Electron API 不可用
            </h1>
            <p style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#6b7280' }}>
              此应用需要在 Electron 环境中运行，不能在普通浏览器中运行。
            </p>
            <div
              style={{
                background: '#f3f4f6',
                padding: '1.5rem',
                borderRadius: '8px',
                maxWidth: '600px',
                marginTop: '1rem',
              }}
            >
              <p style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>解决方法：</p>
              <ol style={{ textAlign: 'left', paddingLeft: '1.5rem' }}>
                <li>
                  确保已运行{' '}
                  <code
                    style={{ background: '#e5e7eb', padding: '0.2rem 0.4rem', borderRadius: '4px' }}
                  >
                    npm run dev
                  </code>
                </li>
                <li>等待 Electron 窗口自动打开</li>
                <li>如果 Electron 窗口没有打开，请检查终端输出是否有错误</li>
              </ol>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: '2rem',
                padding: '0.75rem 1.5rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              重新加载
            </button>
          </div>
        )
      }

      // Other errors
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            padding: '2rem',
          }}
        >
          <h1>应用错误</h1>
          <p>{this.state.error?.message}</p>
          <button type="button" onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
