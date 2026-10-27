import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useWorks, jsdelivrUrl } from '../lib/edits'
import { observeIn, unobserveIn } from '../lib/motion'
import Editable from './Editable'

// 作品详情：整屏铺满的图片画廊，向下滚动浏览。
// 每张图以自下而上的揭幕入场。支持 Esc 返回、←/→ 切换。
// 图片加载链路：jsDelivr 国内 CDN 优先 → 失败自动回退 GitHub Pages 原站 → 仍失败显示提示框
function DetailFigure({ src, alt }) {
  const ref = useRef(null)
  const [stage, setStage] = useState(0) // 0=CDN, 1=原站回退, 2=加载失败

  useEffect(() => {
    const el = ref.current
    observeIn(el)
    // 揭幕动画兜底：无论观察器是否触发（旧设备/图片未加载完成等场景），
    // 1.2s 后强制揭开，绝不出现图片被 clip-path 永久裁剪的黑屏
    const timer = setTimeout(() => el.classList.add('in'), 1200)
    return () => {
      unobserveIn(el)
      clearTimeout(timer)
    }
  }, [])

  const cdnSrc = stage === 0 ? jsdelivrUrl(src) : src

  return (
    <figure ref={ref} className="detail__figure">
      {stage >= 2 ? (
        <div className="detail__img-fallback">图片加载失败，请稍后刷新重试</div>
      ) : (
        <img
          className="detail__img"
          src={cdnSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setStage((s) => Math.min(s + 1, 2))}
        />
      )}
    </figure>
  )
}

export default function WorkDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const works = useWorks()
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
        <div className="detail__empty" style={{ paddingTop: 'var(--nav-h)' }}>
          正在加载作品详情…
        </div>
      </main>
    )
  }

  const shots = work.shots || []

  return (
    <main className="detail">
      {work._new && shots.length === 0 && (
        <div className="detail__empty" style={{ paddingTop: 'var(--nav-h)' }}>
          该作品详情图片尚未提供，可在管理面板上传后点「完成（自动同步）」发布。
        </div>
      )}

      <div className="detail__lede">
        <div className="detail__lede-row" style={{ '--i': 0 }}>
          <Editable k={`work-${work.id}-dcat`} fallback={work.dcat ?? work.cat} multiline />
        </div>
        <div className="detail__lede-row" style={{ '--i': 1 }}>
          <Editable k={`work-${work.id}-dtitle`} fallback={work.dtitle ?? work.title} multiline />
        </div>
        {work.year && (
          <div className="detail__lede-row detail__lede-en" style={{ '--i': 2 }}>
            <Editable
              k={`work-${work.id}-year`}
              fallback={work.year}
              format={(v) => `${String(v).replace(/年$/, '')}年`}
            />
          </div>
        )}
      </div>

      <div className="detail__gallery">
        {shots.map((s) => (
          <DetailFigure key={s} src={s} alt={work.title} />
        ))}
      </div>
    </main>
  )
}
