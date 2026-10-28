import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' —— 构建产物用相对路径，dist 拷贝到任意目录/静态服务均可直接打开
export default defineConfig({
  plugins: [
    react(),
    {
      // 字体域镜像：构建产物里的 Google Fonts 链接 → miaoda.feishu.cn 镜像
      // （国内可达）。在源码层完成，GitHub Actions / Cloudflare / 本地任意构建者
      // 产出的 index.html 都自带正确字体域，无需部署后再人工替换。
      name: 'font-mirror',
      transformIndexHtml(html) {
        return html
          .replace('https://fonts.googleapis.com/css2', 'https://miaoda.feishu.cn/fonts/css2')
          .replace(/https:\/\/fonts\.googleapis\.com/g, 'https://miaoda.feishu.cn')
          .replace(/https:\/\/fonts\.gstatic\.com/g, 'https://miaoda.feishu.cn')
      },
    },
  ],
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
