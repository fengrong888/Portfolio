import { useEffect, useState, Component } from 'react'
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

// 全局错误边界：任何页面组件异常时不至于整页黑屏，给出可读提示
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch() {
    /* 记录到控制台即可 */
  }
  render() {
    if (this.state.hasError) {
      return (
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#101010',
            color: '#e9e2d8',
            fontFamily: 'serif',
            fontSize: 18,
            letterSpacing: '0.08em',
          }}
        >
          页面加载遇到一点问题，请刷新重试
        </main>
      )
    }
    return this.props.children
  }
}

function Shell() {
  const location = useLocation()
  const isDetail = location.pathname.startsWith('/work')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <>
      <Nav />
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
  // 开屏动画：
  // - 首次打开网址（新标签页首次访问）→ 先进首屏，点击后进入 hash 指向的页面
  // - 刷新 / 从历史返回 / 再次加载 → 停留在当前页（如 #/work/3、#/about），不再回首屏
  const [intro, setIntro] = useState(() => {
    try {
      // 打开网站默认进入首屏（点击后进入作品页）
      // 刷新时保持原页面：刷新前在首屏 → 回首屏；在作品页/详情页刷新 → 停在原页
      if (sessionStorage.getItem('portfolio-intro-active') === '1') return true
      if (sessionStorage.getItem('portfolio-seen') === '1') return false
    } catch { /* 存储不可用时回退到首屏 */ }
    return true
  })
  useEffect(() => {
    if (intro) {
      try {
        // 记录「当前正停留在首屏」：刷新时保留，点击进入后清除
        sessionStorage.setItem('portfolio-intro-active', '1')
        sessionStorage.removeItem('portfolio-seen')
      } catch { /* ignore */ }
    } else {
      try {
        sessionStorage.removeItem('portfolio-intro-active')
        // 记录「已进入过网站正文」：非首屏刷新时停留在原页面
        sessionStorage.setItem('portfolio-seen', '1')
      } catch { /* ignore */ }
    }
  }, [intro])
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
    <ErrorBoundary>
      <HashRouter>
        <ClickSpark sparkColor="#fff" sparkSize={10} sparkRadius={15} sparkCount={8} duration={420}>
          <Shell />
          {intro && <HeroIntro key={introKey} onDone={() => setIntro(false)} />}
        </ClickSpark>
      </HashRouter>
    </ErrorBoundary>
  )
}
