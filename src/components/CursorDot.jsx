import { useEffect, useRef } from 'react'

// JS 自绘光标：白色圆点跟随鼠标（纯 CSS 圆形，浏览器原生抗锯齿，
// 彩色背景上也不会有系统光标位图那种黑色杂边）。
// 悬停可编辑文字/输入框时隐藏圆点，交由系统的 text 光标接管。
export default function CursorDot() {
  const ref = useRef(null)

  useEffect(() => {
    const dot = ref.current
    if (!dot) return
    let raf = null

    const onMove = (e) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = null
        dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`
      })
    }
    const onOver = (e) => {
      const t = e.target
      const editable =
        t &&
        t.closest &&
        t.closest('[contenteditable="true"], input, textarea')
      dot.classList.toggle('is-text', !!editable)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mouseover', onOver, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseover', onOver)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return <div ref={ref} className="cursor-dot" aria-hidden="true" />
}
