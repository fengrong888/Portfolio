import { useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { works } from '../data/works'
import { observeIn, unobserveIn } from '../lib/motion'

// 逐字上浮转金：把文字拆成单字，悬浮时依次弹跳并转金色
function LetterUp({ text }) {
  const chars = Array.from(text)
  return (
    <span className="lu" aria-label={text}>
      {chars.map((ch, i) => (
        <span className="lu__c" key={i} style={{ '--i': i }}>{ch}</span>
      ))}
    </span>
  )
}

// 作品详情：整屏铺满的图片画廊，向下滚动浏览。
// 每张图以自下而上的揭幕入场。支持 Esc 返回、←/→ 切换。
function DetailFigure({ src, alt }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    observeIn(el)
    return () => unobserveIn(el)
  }, [])

  return (
    <figure ref={ref} className="detail__figure">
      <img className="detail__img" src={src} alt={alt} />
    </figure>
  )
}

export default function WorkDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const idx = works.findIndex((w) => String(w.id) === String(id))
  const work = idx >= 0 ? works[idx] : null
  const prev = works[(idx - 1 + works.length) % works.length]
  const next = works[(idx + 1) % works.length]

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [idx])

  useEffect(() => {
    if (!work) return
    const onKey = (e) => {
      if (e.key === 'Escape') navigate('/')
      if (e.key === 'ArrowLeft') navigate(`/work/${prev.id}`)
      if (e.key === 'ArrowRight') navigate(`/work/${next.id}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [work, idx, navigate, prev.id, next.id])

  if (!work) {
    return (
      <main className="detail">
        <header className="detail__bar">
          <Link to="/" className="detail__back mono"><LetterUp text="返回作品" /></Link>
        </header>
      </main>
    )
  }

  const shots = work.shots || []

  return (
    <main className="detail">
      <header className="detail__bar">
        <Link to="/" className="detail__back mono"><LetterUp text="返回作品" /></Link>
        <div className="detail__nav">
          <Link to={`/work/${prev.id}`} className="detail__arrow mono" aria-label="上一个作品"><LetterUp text="上一个" /></Link>
          <Link to={`/work/${next.id}`} className="detail__arrow mono" aria-label="下一个作品"><LetterUp text="下一个" /></Link>
        </div>
      </header>

      <div className="detail__gallery">
        {shots.map((s) => (
          <DetailFigure key={s} src={s} alt={work.title} />
        ))}
      </div>
    </main>
  )
}
