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
  // 开屏动画：首次访问进入首屏；刷新 / 从历史返回时保留当前页面状态
  const [intro, setIntro] = useState(() => {
    try {
      if (sessionStorage.getItem('portfolio-intro-active') === '1') return true
      if (sessionStorage.getItem('portfolio-seen') === '1') return false
    } catch {
      // 存储不可用时回退到首屏
    }
    return true
  })
  useEffect(() => {
    try {
      if (intro) {
        sessionStorage.setItem('portfolio-intro-active', '1')
        sessionStorage.removeItem('portfolio-seen')
      } else {
        sessionStorage.removeItem('portfolio-intro-active')
        sessionStorage.setItem('portfolio-seen', '1')
      }
    } catch {
      // sessionStorage 可能被浏览器隐私设置禁用，不影响网站主体功能
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
    if (!intro) return undefined
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
    // 加载后台上传的作品图片（IndexedDB 本地存储）和云端同步数据
    loadStoredImages()
    loadCloud()
  }, [])

  useEffect(() => {
    // 阻止图片被拖拽；右键限制仅作为轻量交互，不应影响页面其他元素
    const onContext = (e) => {
      if (e.target instanceof Element && e.target.closest('img')) e.preventDefault()
    }
    const onDrag = (e) => {
      if (e.target instanceof Element && e.target.closest('img')) e.preventDefault()
    }
    document.addEventListener('contextmenu', onContext)
    document.addEventListener('dragstart', onDrag)
    return () => {
      document.removeEventListener('contextmenu', onContext)
      document.removeEventListener('dragstart', onDrag)
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
