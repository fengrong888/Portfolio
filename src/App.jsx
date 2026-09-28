import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import Nav from './components/Nav'
import Home from './components/Home'
import WorkDetail from './components/WorkDetail'
import About from './components/About'
import Contact from './components/Contact'
import Footer from './components/Footer'
import ClickSpark from './components/ClickSpark'
import EditBar from './components/EditBar'
import AdminPanel from './components/AdminPanel'
import HeroIntro from './components/HeroIntro'
import { loadStoredImages, loadCloud } from './lib/edits'
import CursorDot from './components/CursorDot'

function Shell() {
  const location = useLocation()
  const isDetail = location.pathname.startsWith('/work')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <>
      {!isDetail && <Nav />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/work/:id" element={<WorkDetail />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<Home />} />
      </Routes>
      {!isDetail && <Footer />}
      <EditBar />
      <AdminPanel />
      <CursorDot />
    </>
  )
}

export default function App() {
  // 开屏动画：每次打开网站（加载）先显示，点击任意处进入作品瀑布流
  const [intro, setIntro] = useState(true)
  // 重播开屏时递增 key，强制重新挂载组件（重置鼠标动效）
  const [introKey, setIntroKey] = useState(0)

  const openIntro = () => {
    setIntro(true)
    setIntroKey((k) => k + 1)
  }

  useEffect(() => {
    // 左上角 logo 点击 → 重播开屏首页动画（Nav 内派发 open-intro 事件）
    window.addEventListener('open-intro', openIntro)
    return () => window.removeEventListener('open-intro', openIntro)
  }, [])

  useEffect(() => {
    if (!intro) return
    const close = (e) => {
      // 点击左上角 logo（重播开屏）不关闭开屏
      if (e.target instanceof Element && e.target.closest('.nav__logo')) return
      // 点击开屏自身 → 由 HeroIntro 播放向上滑动退出后回调 onDone，这里不干预
      if (e.target instanceof Element && e.target.closest('.hero-intro')) return
      setIntro(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [intro])

  useEffect(() => {
    // 开屏期间：锁定页面滚动 + 导航栏背景纯透明
    if (intro) {
      document.body.classList.add('intro-mode')
      document.body.style.overflow = 'hidden'
    } else {
      document.body.classList.remove('intro-mode')
      document.body.style.overflow = ''
    }
    return () => {
      document.body.classList.remove('intro-mode')
      document.body.style.overflow = ''
    }
  }, [intro])

  useEffect(() => {
    // 加载后台上传的作品图片（IndexedDB 本地存储）
    loadStoredImages()
    // 加载云端同步数据（GitHub 仓库数据文件），与本地编辑合并后生效
    loadCloud()
  }, [])

  useEffect(() => {
    // 禁止网站内所有图片被鼠标右键下载 / 拖拽保存
    const onContext = (e) => {
      if (e.target instanceof Element && e.target.closest('img')) e.preventDefault()
    }
    const onDrag = (e) => {
      if (e.target instanceof Element && e.target.closest('img')) e.preventDefault()
    }
    document.addEventListener('contextmenu', onContext)
    document.addEventListener('dragstart', onDrag)
  }, [])

  useEffect(() => {
    // 移除托管平台注入的右下角「豆包工作生成」水印容器（Shadow DOM 徽标）。
    // 持续监视：无论宿主在哪个时机注入/重新注入都立即清除。
    const clean = () => {
      const root = document.getElementById('root')
      const body = document.body
      if (!root || !body) return
      Array.from(body.children).forEach((el) => {
        if (el !== root && el.shadowRoot) el.remove()
      })
    }
    clean()
    const mo = new MutationObserver(clean)
    mo.observe(document.body, { childList: true })
    const timer = window.setInterval(clean, 2000)
    window.setTimeout(() => window.clearInterval(timer), 60000)
    return () => {
      mo.disconnect()
      window.clearInterval(timer)
    }
  }, [])

  return (
    <HashRouter>
      <ClickSpark sparkColor="#fff" sparkSize={10} sparkRadius={15} sparkCount={8} duration={420}>
        <Shell />
        {intro && <HeroIntro key={introKey} onDone={() => setIntro(false)} />}
      </ClickSpark>
    </HashRouter>
  )
}
