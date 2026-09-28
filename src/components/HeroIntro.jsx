import { useEffect, useRef } from 'react'
import { useWorks } from '../lib/edits'

// 开屏首页动画：黑底 + 右侧 Portfolio 大字；鼠标移动时随机作品封面
// 从鼠标中心最小放大浮现、停留后淡出上移；点击任意处进入作品瀑布流。
export default function HeroIntro({ onDone }) {
  const stageRef = useRef(null)
  const works = useWorks()

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    // 随机作品封面（尽量不连续重复）
    const covers = works.map((w) => w.img).filter(Boolean)
    if (!covers.length) return
    let lastIdx = -1
    const pick = () => {
      let idx = Math.floor(Math.random() * covers.length)
      if (covers.length > 1 && idx === lastIdx) idx = (idx + 1) % covers.length
      lastIdx = idx
      return covers[idx]
    }

    const rand = (min, max) => min + Math.random() * (max - min)
    const active = []
    let seq = 0
    let lastMove = 0

    function spawn(x, y) {
      if (active.length >= 4) {
        const old = active.shift()
        old.el.style.transition = 'opacity 0.4s ease-in'
        old.el.style.opacity = '0'
        setTimeout(() => old.el.remove(), 400)
        old.done = true
      }
      const el = document.createElement('div')
      el.className = 'hero-intro__fx'
      const size = Math.round(rand(110, 200))
      const offX = rand(-180, 180)
      const offY = rand(-130, 130)
      const rot = rand(-4.5, 4.5)
      el.style.width = size + 'px'
      el.style.height = Math.round((size * 4) / 3) + 'px'
      el.style.left = x + offX + 'px'
      el.style.top = y + offY + 'px'
      el.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(0.04)`
      el.style.opacity = '0'
      const img = document.createElement('img')
      img.src = pick()
      img.alt = ''
      img.draggable = false
      el.appendChild(img)
      stage.appendChild(el)
      const item = { el, done: false }
      active.push(item)
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.9s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease-out'
        el.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(1)`
        el.style.opacity = '1'
      })
      setTimeout(() => {
        if (item.done) return
        el.style.transition = 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s ease-in'
        el.style.transform = `translate(-50%, -58%) rotate(${rot}deg) scale(1.06)`
        el.style.opacity = '0'
        setTimeout(() => {
          el.remove()
          const i = active.indexOf(item)
          if (i !== -1) active.splice(i, 1)
        }, 700)
      }, 820)
      seq++
    }

    const onMove = (e) => {
      const now = performance.now()
      if (now - lastMove < 210) return
      lastMove = now
      spawn(e.clientX, e.clientY)
    }
    const onTouch = (e) => {
      const t = e.touches[0]
      spawn(t.clientX, t.clientY)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onTouch)
      active.forEach((a) => a.el.remove())
    }
  }, [works])

  // 点击开屏（含导航栏区域）→ 淡出后进入作品瀑布流
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const close = () => {
      stage.classList.add('hero-intro--out')
      setTimeout(onDone, 650)
    }
    stage.addEventListener('click', close)
    return () => stage.removeEventListener('click', close)
  }, [onDone])

  return (
    <div className="hero-intro" ref={stageRef} aria-hidden="false">
      <div className="hero-intro__title">
        <span>Portfolio</span>
      </div>
      <div className="hero-intro__hint">点击进入作品集</div>
    </div>
  )
}
