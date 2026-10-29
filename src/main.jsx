import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// 标记应用已启动：CDN 挂起保护脚本检测到后停止"回退原站"倒计时
window.__PF_BOOT__ = true
// 防双执行：CDN 与回退 bundle 若都加载成功，只允许第一个 createRoot（避免 React 冲突崩溃）
if (!window.__PF_APP_STARTED__) {
  window.__PF_APP_STARTED__ = true
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
