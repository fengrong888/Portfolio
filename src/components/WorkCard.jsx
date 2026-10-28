import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useMotionValue, useSpring } from 'motion/react'
import gsap from 'gsap'
import { useEditing, extractDominantColor, jsdelivrUrl, markCdnHang, isCdnBad } from '../lib/edits'
import Editable from './Editable'

// 悬停动效（GSAP）：纯色层淡入淡出；简介三行依次上移淡入；另叠加 3D 倾斜
const springValues = { damping: 30, stiffness: 100, mass: 2 }
const ROTATE_AMPLITUDE = 9
const SCALE_ON_HOVER = 1.05
// 全站默认强制动效：悬停动画始终走过渡

export default function WorkCard({ work, index }) {
  const ref = useRef(null)
  const imgRef = useRef(null)
  const fillRef = useRef(null)
  const introRef = useRef(null)
  const [inView, setInView] = useState(false)
  const editing = useEditing()
  // 后台上传过封面的作品（云端路径或本机未同步的 dataURL）：悬停纯色自动提取封面主色（替代预置 hover 色）
  const isUploadedCover =
    typeof work.img === 'string' &&
    (work.img.indexOf('./data/imgs/') === 0 || work.img.indexOf('data:image/') === 0)
  const [tint, setTint] = useState(null)
  // 封面图 CDN 加载失败时回退 GitHub Pages 原站
  const [cdnFail, setCdnFail] = useState(false)
  const [retry, setRetry] = useState(0) // 原站也失败后的整链路重试次数
  // CDN 请求「挂起不返回」时自动回退原站。
  // 用 IntersectionObserver + 单次超时替代每张卡片永久轮询，减少常驻定时器。
  // 只在图片进入视口附近后启动检测，避免误伤视口外的懒加载图片。
  useEffect(() => {
    if (cdnFail) return
    const el = imgRef.current
    if (!el) return

    let timeoutId = null
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        // 图片可能在 observer 回调前就已加载完成。
        if (el.complete || el.naturalWidth) return

        timeoutId = window.setTimeout(() => {
          const rect = el.getBoundingClientRect()
          const inView = rect.top < window.innerHeight && rect.bottom > 0
          if (inView && !el.complete && !el.naturalWidth) {
            markCdnHang()
            setCdnFail(true)
          }
        }, 3200)
      },
      { rootMargin: '100px' }
    )
    observer.observe(el)

    return () => {
      observer.disconnect()
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [cdnFail, work.img])
  // 原站也加载失败：不显示失败，按指数退避（2s→4s→8s→封顶16s）自动重试；
  // CDN 未熔断时回到 CDN 重新加载，已熔断则留在原站带时间戳重试——
  // 避免「CDN 挂起→回原站→再回 CDN」死循环（浏览器加载圈一直转的根因）
  useEffect(() => {
    if (!cdnFail) return
    const t = setTimeout(() => {
      if (isCdnBad()) {
        const el = imgRef.current
        if (el && work.img) {
          const sep = work.img.includes('?') ? '&' : '?'
          el.src = `${work.img}${sep}r=${retry + 1}`
        }
      } else {
        setCdnFail(false)
      }
      setRetry((r) => r + 1)
    }, Math.min(2000 * Math.pow(2, Math.min(retry, 3)), 16000))
    return () => clearTimeout(t)
  }, [cdnFail, retry, work.img])
  useEffect(() => {
    if (!isUploadedCover) return
    // 依赖 work.img：云端数据异步加载完成后，work.img 从占位图变成真实上传封面，
    // 依赖变化会重新提取主色，确保任何设备/任何加载时机都能匹配出作品色彩。
    // 提取优先走 jsDelivr CDN（国内快、带 CORS），失败再回退 GitHub 原站相对路径；
    // CDN 熔断期内直接走原站（避免再发起挂起的 CDN 请求拖住加载圈）
    let cancel = false
    extractDominantColor(isCdnBad() ? work.img : jsdelivrUrl(work.img), work.id).then((c) => {
      if (cancel) return
      if (c) setTint(c)
      else extractDominantColor(work.img, work.id).then((c2) => c2 && !cancel && setTint(c2))
    })
    return () => {
      cancel = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work.img])

  const rotateX = useSpring(useMotionValue(0), springValues)
  const rotateY = useSpring(useMotionValue(0), springValues)
  const scale = useSpring(1, springValues)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -6% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // 悬停前预设初始状态：透明度由 GSAP 统一管理
  useEffect(() => {
    if (imgRef.current) gsap.set(imgRef.current, { autoAlpha: 1, scale: 1 })
    if (fillRef.current) gsap.set(fillRef.current, { autoAlpha: 0 })
    if (introRef.current) {
      gsap.set(introRef.current.children, { autoAlpha: 0, y: 30 })
    }
  }, [])

  function playEnter() {
    gsap.killTweensOf([imgRef.current, fillRef.current, introRef.current?.children])
    // 封面图片淡出（微放）融成纯色，纯色同步淡入
    gsap
      .timeline()
      .fromTo(
        imgRef.current,
        { autoAlpha: 1, scale: 1 },
        { autoAlpha: 0, scale: 1.06, duration: 0.8, ease: 'power2.inOut' },
        0
      )
      .fromTo(
        fillRef.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.65, ease: 'power2.out' },
        0.05
      )
      .fromTo(
        introRef.current.children,
        { autoAlpha: 0, y: 30 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.7,
          ease: 'power3.out',
          stagger: 0.09
        },
        0.18
      )
  }

  function playLeave() {
    gsap.killTweensOf([imgRef.current, fillRef.current, introRef.current?.children])
    // 纯色淡出，封面图片淡回
    gsap.to(imgRef.current, { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'power2.out' })
    gsap.to(fillRef.current, { autoAlpha: 0, duration: 0.5, ease: 'power2.inOut' })
    gsap.to(introRef.current.children, { autoAlpha: 0, y: 30, duration: 0.3, ease: 'power2.in' })
  }

  function handleMouseMove(e) {
    // 编辑模式下卡片保持静止，保证文字点击命中稳定
    if (editing) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const offsetX = e.clientX - rect.left - rect.width / 2
    const offsetY = e.clientY - rect.top - rect.height / 2
    rotateX.set((offsetY / (rect.height / 2)) * -ROTATE_AMPLITUDE)
    rotateY.set((offsetX / (rect.width / 2)) * ROTATE_AMPLITUDE)
  }
  function handleMouseEnter() {
    if (!editing) scale.set(SCALE_ON_HOVER)
    playEnter()
  }
  function handleMouseLeave() {
    scale.set(1)
    rotateX.set(0)
    rotateY.set(0)
    playLeave()
  }

  const delay = `${(index % 4) * 95}ms`

  return (
    <Link
      ref={ref}
      to={`/work/${work.id}`}
      className={`card${inView ? ' in' : ''}`}
      style={{ '--d': delay, '--card-hover': work.hover }}
      aria-label={`${work.title} — ${work.cat}`}
      onClick={(e) => {
        if (editing) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={!editing ? playEnter : undefined}
      onBlur={!editing ? playLeave : undefined}
    >
      <motion.div
        className="card__media"
        style={{ aspectRatio: work.ratio, rotateX, rotateY, scale }}
      >
        <div className="card__img-p">
          <img
            className="card__img"
            ref={imgRef}
            src={cdnFail || isCdnBad() ? work.img : jsdelivrUrl(work.img)}
            alt={work.title}
            loading="lazy"
            decoding="async"
            fetchPriority={index < 4 ? 'high' : 'auto'}
            onError={() => setCdnFail(true)}
          />
        </div>
        <div
          className="card__fill"
          aria-hidden="true"
          ref={fillRef}
          style={tint ? { background: tint } : undefined}
        />
        <div className="card__intro" ref={introRef}>
          <div className="card__intro-cat">
            <Editable k={`work-${work.id}-cat`} fallback={work.cat} />
          </div>
          <h3 className="card__intro-title">
            <Editable k={`work-${work.id}-title`} fallback={work.title} />
          </h3>
        </div>
      </motion.div>
    </Link>
  )
}
