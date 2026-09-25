// 动效系统：IntersectionObserver 一次性揭示 + 轻量 rAF 视差
// 只动 transform / opacity / clip-path；prefers-reduced-motion 下全部降级。

export const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ---------- 滚动揭示：进入视口后加 .in（一次性） ----------
let io = null

function getIO() {
  if (io) return io
  if (typeof IntersectionObserver === 'undefined') return null
  io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in')
          io.unobserve(entry.target)
        }
      })
    },
    { rootMargin: '0px 0px -7% 0px', threshold: 0 }
  )
  return io
}

export function observeIn(el) {
  if (!el) return
  if (reducedMotion) {
    el.classList.add('in')
    return
  }
  const observer = getIO()
  if (observer) observer.observe(el)
  else el.classList.add('in')
}

export function unobserveIn(el) {
  if (!el) return
  const observer = getIO()
  if (observer) observer.unobserve(el)
}

// ---------- 视差：单 rAF 循环，只更新视口内的元素 ----------
const pxEls = new Set()
let ticking = false
let rafId = 0

function updateParallax() {
  ticking = false
  const vh = window.innerHeight
  pxEls.forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.bottom < -80 || r.top > vh + 80) return
    const range = parseFloat(el.dataset.parallax || '24') || 24
    const prog = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2)
    const y = Math.max(-range, Math.min(range, prog * range))
    el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`
  })
}

function requestParallax() {
  if (!ticking) {
    ticking = true
    rafId = requestAnimationFrame(updateParallax)
  }
}

export function addParallax(el) {
  if (!el || reducedMotion) return
  pxEls.add(el)
  requestParallax()
  if (pxEls.size === 1) {
    window.addEventListener('scroll', requestParallax, { passive: true })
    window.addEventListener('resize', requestParallax)
  }
}

export function removeParallax(el) {
  if (!el) return
  pxEls.delete(el)
  if (pxEls.size === 0) {
    window.removeEventListener('scroll', requestParallax)
    window.removeEventListener('resize', requestParallax)
    cancelAnimationFrame(rafId)
  }
}
