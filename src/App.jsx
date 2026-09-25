import { useEffect } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import Nav from './components/Nav'
import Home from './components/Home'
import WorkDetail from './components/WorkDetail'
import About from './components/About'
import Contact from './components/Contact'
import Footer from './components/Footer'
import ClickSpark from './components/ClickSpark'
import EditBar from './components/EditBar'
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
      <CursorDot />
    </>
  )
}

export default function App() {
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
      </ClickSpark>
    </HashRouter>
  )
}
