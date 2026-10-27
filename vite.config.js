import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' —— 构建产物用相对路径，dist 拷贝到任意目录/静态服务均可直接打开
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // 降级构建目标：兼容微信内置浏览器 / 旧版安卓 WebView / 旧 Safari，
    // 避免现代语法（可选链等）在旧内核上直接解析失败导致整页黑屏
    target: 'es2018',
  },
  server: {
    port: 5173,
    open: false,
  },
})
