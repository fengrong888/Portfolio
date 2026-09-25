import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import Editable from './Editable'
import { useEdit, useEditing } from '../lib/edits'

// 打开网站时的导航进场动效：只播一次（路由切换不重播，刷新重播）
let didIntro = false

// 逐字渲染：正常浏览时逐字上浮转金；编辑模式下自动切回可编辑整词
function NavLetters({ text }) {
  return (
    <span className="nav__letters" aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <span className="nav__l" key={i} style={{ '--i': i }}>{ch}</span>
      ))}
    </span>
  )
}

function NavItem({ l, i }) {
  const label = useEdit(l.k, l.fallback)
  const editing = useEditing()
  return (
    <NavLink
      to={l.to}
      end={l.end}
      className={({ isActive }) => `nav__link${isActive ? ' active' : ''}`}
    >
      <span className="nav__link-mask">
        <span className="nav__link-mask-in" style={{ '--i': i }}>
          {editing ? <Editable k={l.k} fallback={l.fallback} /> : <NavLetters text={label} />}
        </span>
      </span>
    </NavLink>
  )
}

// 固定半透明悬浮导航：左侧矢量 logo 图标，右侧 作品 / 关于我 / 联系
const NAV_LOGO_SVG = `<svg viewBox="0 0 1161.72 563.68" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">
 <path stroke="#FEFEFE" stroke-width="141.32" stroke-miterlimit="22.9256" fill="none" d="M492.3 370.4l-60.94 60.94c-82.23,82.23 -216.79,82.23 -299.02,0 -82.23,-82.23 -82.23,-216.79 0,-299.02 82.23,-82.23 216.79,-82.23 299.02,0l149.51 149.51 149.51 149.51c82.23,82.23 216.79,82.23 299.02,0 82.23,-82.23 82.23,-216.79 0,-299.02 -82.23,-82.23 -216.79,-82.23 -299.02,0"/>
</svg>`

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [intro, setIntro] = useState(false)
  const location = useLocation()

  useEffect(() => {
    if (!didIntro) {
      didIntro = true
      setIntro(true)
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [location.pathname])

  const links = [
    { to: '/', end: true, k: 'nav-work', fallback: '作品' },
    { to: '/about', end: false, k: 'nav-about', fallback: '关于我' },
    { to: '/contact', end: false, k: 'nav-contact', fallback: '联系' },
  ]

  return (
    <header className={`nav${scrolled ? ' scrolled' : ''}${intro ? ' intro' : ''}`}>
      <Link to="/" className="nav__logo" aria-label="返回作品首页">
        <span
          className="nav__logo-svg"
          dangerouslySetInnerHTML={{ __html: NAV_LOGO_SVG }}
        />
      </Link>

      <nav className="nav__links" aria-label="主导航">
        {links.map((l, i) => (
          <NavItem key={l.k} l={l} i={i} />
        ))}
      </nav>
    </header>
  )
}
