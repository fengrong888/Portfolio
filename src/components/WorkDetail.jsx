import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useWorks } from '../lib/edits'
import { observeIn, unobserveIn } from '../lib/motion'
import Editable from './Editable'

// 作品详情：整屏铺满的图片画廊，向下滚动浏览。
// 每张图以自下而上的揭幕入场。支持 Esc 返回、←/→ 切换。
function DetailFigure({ src, alt }) {
  const ref = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = ref.current
    observeIn(el)
    return () => unobserveIn(el)
  }, [])

  return (
    <figure ref={ref} className="detail__figure">
      {failed ? (
        <div className="detail__img-fallback">图片加载失败，请稍后刷新重试</div>
      ) : (
        <img
          className="detail__img"
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
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
