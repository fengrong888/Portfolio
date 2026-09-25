# Portfolio · 平面设计作品集网站

暗色系高级克制风格的设计师作品集网站（React + Vite），打开即展示瀑布流作品。

## 本地运行

```bash
npm install
npm run dev      # 开发预览
npm run build    # 构建到 dist/
```

## 作品内容在哪里改

- 作品数据：`src/data/works.js` —— 每个作品包含封面 `img`、详情图 `shots`、标题、简介、悬停色 `hover`
- 作品图片：放到 `public/works/` 目录，文件名与 `works.js` 中引用一致
- 关于我：`src/components/About.jsx` + `public/portrait.jpg`、`public/brand-wall.png`
- 联系页：`src/components/Contact.jsx`
- 页脚：`src/components/Footer.jsx`

## 在线编辑模式

网站内置编辑模式：按 `Shift + E` 进入，直接点击文字即可修改（保存在浏览器本地）；再次按 `Shift + E` 退出。

## 部署（GitHub Pages · 分支部署）

构建产物在 `docs/` 目录，已随仓库提交；Pages 从 `main` 分支的 `/docs` 目录发布。

更新网站的步骤：
1. `npm run build`（重新构建到 dist/）
2. 把 dist 内容同步到 `docs/` 目录
3. 提交并推送到 main，Pages 自动更新

访问地址：`https://fengrong888.github.io/Portfolio/`
