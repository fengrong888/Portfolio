import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' —— 构建产物用相对路径，dist 拷贝到任意目录/静态服务均可直接打开
export default defineConfig({
  plugins: [
    react(),
    {
      // 主资源 CDN 化：JS/CSS 走 jsDelivr 国内节点（国内首次加载提速），
      // 加载失败自动回退 GitHub Pages 原站（onerror 双保险），
      // 构建 hash 每次变化 → 新 CDN URL → 无缓存陈旧问题。
      name: 'cdn-assets',
      transformIndexHtml(html) {
        return html
          .replace(
            /(<script[^>]*src=")\.\/(assets\/[^"]+\.js)(")/g,
            `$1https://cdn.jsdelivr.net/gh/fengrong888/Portfolio@main/docs/$2" onerror="this.onerror=null;var s=document.createElement('script');s.type='module';s.src='./$2';document.head.appendChild(s)$3`
          )
          .replace(
            /(<link[^>]*href=")\.\/(assets\/[^"]+\.css)(")/g,
            `$1https://cdn.jsdelivr.net/gh/fengrong888/Portfolio@main/docs/$2" onerror="this.onerror=null;var l=document.createElement('link');l.rel='stylesheet';l.href='./$2';document.head.appendChild(l)$3`
          )
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
