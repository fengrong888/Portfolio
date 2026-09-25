import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useMotionValue, useSpring } from 'motion/react'
import gsap from 'gsap'
import { useEditing } from '../lib/edits'
import Editable from './Editable'

// 悬停动效（GSAP）：纯色层淡入淡出；简介三行依次上移淡入；另叠加 3D 倾斜
const springValues = { damping: 30, stiffness: 100, mass: 2 }
const ROTATE_AMPLITUDE = 9
const SCALE_ON_HOVER = 1.05
const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function WorkCard({ work, index }) {
  const ref = useRef(null)
  const imgRef = useRef(null)
  const fillRef = useRef(null)
  const introRef = useRef(null)
  const [inView, setInView] = useState(false)
  const editing = useEditing()

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
    if (reduceMotion) {
      gsap.set(imgRef.current, { autoAlpha: 0, scale: 1 })
      gsap.set(fillRef.current, { autoAlpha: 1 })
      gsap.set(introRef.current.children, { autoAlpha: 1, y: 0 })
      return
    }
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
    if (reduceMotion) {
      gsap.set(imgRef.current, { autoAlpha: 1, scale: 1 })
      gsap.set(fillRef.current, { autoAlpha: 0 })
      gsap.set(introRef.current.children, { autoAlpha: 0, y: 30 })
      return
    }
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
          <img className="card__img" ref={imgRef} src={work.img} alt={work.title} loading="lazy" />
        </div>
        <div className="card__fill" aria-hidden="true" ref={fillRef} />
        <div className="card__intro" ref={introRef}>
          <div className="card__intro-cat">
            <Editable k={`work-${work.id}-cat`} fallback={work.cat} />
          </div>
          <h3 className="card__intro-title">
            <Editable k={`work-${work.id}-title`} fallback={work.title} />
          </h3>
          <div className="card__intro-en">
            <Editable k={`work-${work.id}-en`} fallback={work.en} />
          </div>
        </div>
      </motion.div>
    </Link>
  )
}
