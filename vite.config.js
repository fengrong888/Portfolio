import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' —— 构建产物用相对路径，dist 拷贝到任意目录/静态服务均可直接打开
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    open: false,
  },
})
