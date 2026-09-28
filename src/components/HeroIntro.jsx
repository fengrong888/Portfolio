import { useEffect, useRef } from 'react'
import { useWorks } from '../lib/edits'

// 开屏首页动画：黑底 + 右侧 Portfolio 大字；鼠标移动时随机作品封面
// 从鼠标中心最小放大浮现、旋转跟随鼠标轨迹、停留后缩小消失；
// 点击任意处进入作品瀑布流。
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
    // 预加载全部封面到浏览器缓存，移动时直接复用已解码图片（更丝滑）
    covers.forEach((src) => {
      const im = new Image()
      im.src = src
    })

    const rand = (min, max) => min + Math.random() * (max - min)
    const active = []
    let lastMove = 0
    // 上一张生成时的鼠标位置（用于防止同一点重复生成堆积）
    let lastSpawnX = null
    let lastSpawnY = null
    // 记录上一次鼠标位置，用于计算移动轨迹方向 → 图片旋转跟随
    let lastX = null
    let lastY = null

    function spawn(x, y) {
      const el = document.createElement('div')
      el.className = 'hero-intro__fx'
      const size = 180
      // 固定步长：距上一张生成点 >= 64px 才生成 → 图片间距一致
      if (lastSpawnX !== null) {
        const dist = Math.hypot(x - lastSpawnX, y - lastSpawnY)
        if (dist < 64) return
      }
      lastSpawnX = x
      lastSpawnY = y
      const offX = 0
      const offY = 0
      // 旋转跟随鼠标移动轨迹：轨迹方向角映射为图片旋转角度（幅度减小）
      let rot = 0
      if (lastX !== null && lastY !== null) {
        const dx = x - lastX
        const dy = y - lastY
        const dist = Math.hypot(dx, dy)
        if (dist > 4) {
          const dirDeg = (Math.atan2(dy, dx) * 180) / Math.PI
          rot = dirDeg * 0.1 + rand(-1, 1)
        } else {
          rot = rand(-1.5, 1.5)
        }
      } else {
        rot = rand(-1.5, 1.5)
      }
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
      // 入场：从鼠标中心由小到大缩放出现（强制 reflow 确保过渡从初始态开始）
      void el.offsetWidth
      el.style.transition = 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease-out'
      el.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(1)`
      el.style.opacity = '1'
      // 离场：由大到小缩放消失
      setTimeout(() => {
        if (item.done) return
        el.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease-in'
        el.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(0.04)`
        el.style.opacity = '0'
        setTimeout(() => {
          el.remove()
          const i = active.indexOf(item)
          if (i !== -1) active.splice(i, 1)
        }, 480)
      }, 600)
    }

    const onMove = (e) => {
      const now = performance.now()
      if (now - lastMove < 30) return
      lastMove = now
      spawn(e.clientX, e.clientY)
      lastX = e.clientX
      lastY = e.clientY
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
      setTimeout(onDone, 1000)
    }
    stage.addEventListener('click', close)
    return () => stage.removeEventListener('click', close)
  }, [onDone])

  return (
    <div className="hero-intro" ref={stageRef} aria-hidden="false">
      <div className="hero-intro__title">
        <span>Portfolio</span>
      </div>
    </div>
  )
}
