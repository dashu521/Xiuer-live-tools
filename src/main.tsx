import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { ElectronErrorBoundary } from './components/common/ElectronErrorBoundary'
import { initializeTheme } from './hooks/useTheme'
import { router } from './router'
import './index.css'

async function bootstrap() {
  if (import.meta.env.DEV) {
    await import('./lib/wdyr')
  }

  // 启动诊断：若 Console 有 [UI] 日志说明页面已加载到我们的应用
  console.log('[UI] main.tsx 执行中')

  // 应用持久化主题，避免首屏闪烁
  initializeTheme()

  const rootEl = document.getElementById('root')
  if (!rootEl) {
    console.error('[UI] 未找到 #root，页面结构异常')
    document.body.innerHTML =
      '<div style="padding:20px;font-family:system-ui;">[UI] 未找到 #root</div>'
  } else {
    try {
      // 移除 HTML 里的"加载中…"占位，由 React 接管
      const loading = document.getElementById('app-loading')
      if (loading) loading.remove()
      ReactDOM.createRoot(rootEl).render(
        <React.StrictMode>
          <ElectronErrorBoundary>
            <RouterProvider router={router} />
          </ElectronErrorBoundary>
        </React.StrictMode>,
      )
      console.log('[UI] React 已挂载')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[UI] 渲染失败', err)
      rootEl.innerHTML =
        '<div style="padding:20px;font-family:system-ui;white-space:pre;">[UI] 渲染失败: ' +
        msg +
        '</div>'
    }
  }

  postMessage({ payload: 'removeLoading' }, '*')
}

void bootstrap()
