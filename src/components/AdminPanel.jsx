import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  useEditing,
  applyEdit,
  subscribeEdits,
  computeLiveWorks,
  nextWorkId,
  buildWorks,
  getWorkOrder,
  deleteWork,
  clearEdits,
  setEditing,
  compressImage,
  putImage,
  removeImage,
  getStoredImage,
  jsdelivrUrl,
  useEditsRev,
  setWorkOrder,
  deleteShot,
  moveShot,
  extractDominantColor,
  exportAllData,
  getCloudToken,
  setCloudToken,
  isAdminWorkerConfigured,
  checkTokenValidity,
  syncNow,
  migrateCloudImages,
  useCloudStatus,
  isCdnBad,
} from '../lib/edits'

// 作品管理面板（Shift+E + 密码验证后打开）：
// 编辑标题/类别/英文、上传封面与详情图、逐张管理详情图（删除/前后插入）、
// 拖拽调整作品顺序、新增/删除作品（带确认）、导出完整数据发回固化部署。
function WorkRow({ work, draggable, onDragStart, onDragOver, onDrop, dragState, onDirtyChange }) {
  const id = work.id
  const [open, setOpen] = useState(false)
  const [upCover, setUpCover] = useState(false)
  const [upShots, setUpShots] = useState(false)
  // 上传中：'cover' | 'shots' | 'insert' | null
  const [busy, setBusy] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [shotDrag, setShotDrag] = useState(null) // 详情图拖拽：起始 index（视觉反馈）
  const [shotOver, setShotOver] = useState(null) // 详情图拖拽：目标插入位
  const [liveShots, setLiveShots] = useState(null) // 拖拽中的实时顺序（松手后统一保存）
  const shotFromRef = useRef(null) // 拖拽起始 index（事件层）
  const coverRef = useRef(null)
  const shotsRef = useRef(null)
  const shotsListRef = useRef(null) // 详情图横排列表（左右按钮滚动）
  // 悬停纯色：从作品封面/详情图自动提取主色（缓存，每行只提取一次）
  const [tint, setTint] = useState(null)
  // 封面预览 CDN 加载失败时回退 GitHub Pages 原站
  const [coverCdnFail, setCoverCdnFail] = useState(false)
  const hasCover = !!getStoredImage(`work-${id}-img`)
  const coverSrc = hasCover ? getStoredImage(`work-${id}-img`) : work.img
  const onCoverHover = () => {
    if (tint) return
    const src = hasCover ? getStoredImage(`work-${id}-img`) : shots[0] || work.img
    // 优先 CDN（国内快）提取，失败回退原站路径；按作品 id 差异化配色
    extractDominantColor(jsdelivrUrl(src), id).then((c) => {
      if (c) setTint(c)
      else extractDominantColor(src, id).then((c2) => c2 && setTint(c2))
    })
  }
  useEditsRev()
  const hasShots = !!getStoredImage(`work-${id}-shots`)
  // 文字草稿：后台输入先改草稿，点「完成」才提交到网站。
  // 草稿持久化到 localStorage（pf-draft-<id>）：误刷新/误关后台不丢失，重新打开自动恢复
  const [d, setD] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`pf-draft-${id}`) || 'null')
      if (saved && typeof saved === 'object') return saved
    } catch { /* ignore */ }
    return {
      title: work.title,
      cat: work.cat,
      year: work.year ?? '',
      dtitle: work.dtitle ?? work.title,
      dcat: work.dcat ?? work.cat,
    }
  })
  // 是否有未提交的文字修改（用于关闭时提醒保存）
  const dirty = !!(
    d.title !== work.title ||
    d.cat !== work.cat ||
    d.year !== (work.year ?? '') ||
    d.dtitle !== (work.dtitle ?? work.title) ||
    d.dcat !== (work.dcat ?? work.cat)
  )
  useEffect(() => {
    onDirtyChange?.(id, dirty)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, work, id])
  const setDk = (k) => (e) =>
    setD((p) => {
      const next = { ...p, [k]: e.target.value }
      try {
        localStorage.setItem(`pf-draft-${id}`, JSON.stringify(next))
      } catch { /* ignore */ }
      return next
    })
  const [saved, setSaved] = useState(false)
  // 提交该作品行的文字草稿（保存作品 / 点完成时都会调用）
  const commitRow = () => {
    if (d.title !== work.title) applyEdit(`work-${id}-title`, d.title)
    if (d.cat !== work.cat) applyEdit(`work-${id}-cat`, d.cat)
    if (d.year !== (work.year ?? '')) applyEdit(`work-${id}-year`, d.year)
    if (d.dtitle !== (work.dtitle ?? work.title)) applyEdit(`work-${id}-dtitle`, d.dtitle)
    if (d.dcat !== (work.dcat ?? work.cat)) applyEdit(`work-${id}-dcat`, d.dcat)
    // 已提交 → 清除持久化草稿
    try {
      localStorage.removeItem(`pf-draft-${id}`)
    } catch { /* ignore */ }
  }
  // 监听「完成」事件统一提交草稿
  useEffect(() => {
    const commit = () => commitRow()
    window.addEventListener('admin-commit', commit)
    return () => window.removeEventListener('admin-commit', commit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, work, id])
  // 单独保存当前作品：立即提交草稿并推送云端（无需等「完成」）
  const onSave = () => {
    commitRow()
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    syncNow().catch(() => {})
  }
  const shots = work.shots || []
  const shownShots = liveShots || shots

  // 详情图拖拽（Pointer 事件：鼠标/触屏通用）——拖拽期间只改内存实时跟手，松手一次性保存
  const onShotPointerDown = (e, i) => {
    // 缩略图上的删除按钮、插图按钮和文件选择器应保留原生点击行为，不参与拖拽排序
    if (e.target instanceof Element && e.target.closest('button, label, input')) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    shotFromRef.current = i
    setShotDrag(i)
  }
  const onShotPointerMove = (e, i) => {
    const from = shotFromRef.current
    if (from === null || from === undefined) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const after = e.clientX >= rect.left + rect.width / 2
    const to = after ? i + 1 : i // 插到目标图前（to=i）或后（to=i+1）
    const cur = from < to ? to - 1 : to // 移除 from 后的实际插入位
    if (cur === from) return
    const next = [...shownShots]
    const [m] = next.splice(from, 1)
    next.splice(cur, 0, m)
    setLiveShots(next)
    shotFromRef.current = cur
    setShotDrag(cur)
    setShotOver(to)
  }
  const endShotDrag = () => {
    const from = shotFromRef.current
    shotFromRef.current = null
    setShotDrag(null)
    setShotOver(null)
    if (from === null || from === undefined) return
    const next = liveShots
    if (!next) return
    // 松手统一保存（写本地存储，点「完成」时随云端同步）
    putImage(`work-${id}-shots`, JSON.stringify(next))
    setLiveShots(null)
  }

  const onCover = async (e) => {
    const input = e.target
    const file = input.files?.[0]
    if (!file) return
    setBusy('cover')
    setUploadError('')
    try {
      const dataUrl = await compressImage(file, 700, 0.85)
      await putImage(`work-${id}-img`, dataUrl)
      setUpCover(true)
      setTimeout(() => setUpCover(false), 1600)
    } catch (error) {
      setUploadError(`封面上传失败：${error?.message || '图片处理或存储失败，请换一张图片重试'}`)
    } finally {
      setBusy(null)
      // 成功或失败都重置 input，允许再次选择同一个文件
      input.value = ''
    }
  }

  const onShots = async (e) => {
    const input = e.target
    const files = Array.from(input.files || [])
    if (!files.length) return
    setBusy('shots')
    setUploadError('')
    try {
      const urls = await Promise.all(files.map((f) => compressImage(f, 1800, 0.8)))
      // 新增追加：保留已有详情图，新图排在末尾
      await putImage(`work-${id}-shots`, JSON.stringify([...shownShots, ...urls]))
      setUpShots(true)
      setTimeout(() => setUpShots(false), 1600)
    } catch (error) {
      setUploadError(`详情图上传失败：${error?.message || '图片处理或存储失败，请减少图片数量或换图重试'}`)
    } finally {
      setBusy(null)
      input.value = ''
    }
  }

  // 多张插入：index 位置一次插入多张（index 为 shots.length 时表示末尾追加）
  const onInsert = async (e, index) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setBusy('insert')
    setUploadError('')
    try {
      const urls = await Promise.all(files.map((f) => compressImage(f, 1800, 0.8)))
      const next = [...shownShots.slice(0, index), ...urls, ...shownShots.slice(index)]
      await putImage(`work-${id}-shots`, JSON.stringify(next))
    } catch (error) {
      setUploadError(`插入详情图失败：${error?.message || '图片处理或存储失败，请重试'}`)
    } finally {
      setBusy(null)
      // 清空本次触发的 input，成功或失败后均可重复选择同一文件
      e.target.value = ''
    }
  }

  // 详情图列表左右移动
  const scrollShots = (dir) => {
    const el = shotsListRef.current
    if (!el) return
    const step = Math.max(el.clientWidth * 0.75, 160)
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  const onDeleteShot = (index) => {
    if (window.confirm(`确定删除详情图第 ${index + 1} 张？`)) deleteShot(id, shownShots, index)
  }

  const onDelete = () => {
    const msg = work._new
      ? `确定删除「${d.title}」？该新增作品将被移除。`
      : `确定删除「${d.title}」？删除后本机预览立即生效；导出数据发回部署后，该作品将从网站永久移除（可通过重新提供恢复）。`
    if (window.confirm(msg)) deleteWork(id)
  }

  const cls = `ap-row${open ? ' ap-row--open' : ''}${work._new ? ' ap-row--new' : ''}${
    dragState === id ? ' ap-row--drag' : ''
  }`

  return (
    <div
      className={cls}
      draggable={draggable}
      onDragStart={(e) => {
        if (e.target.closest('.ap-shot')) return // 详情图拖拽不触发作品行排序
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(id)
      }}
      onDragOver={(e) => {
        if (e.target.closest('.ap-shot')) return
        e.preventDefault()
        onDragOver(id)
      }}
      onDrop={(e) => {
        if (e.target.closest('.ap-shot')) return
        e.preventDefault()
        onDrop(id)
      }}
      onDragEnd={() => {
        onDragOver(null)
        setShotDrag(null)
        setShotOver(null)
      }}
    >
      <button className="ap-row__head" onClick={() => setOpen((o) => !o)}>
        <span className="ap-row__grip" aria-hidden="true">⋮⋮</span>
        <span className="ap-row__t">{d.title || '（未命名）'}</span>
        {work._new && <em className="ap-row__tag">新</em>}
      </button>
      {open && (
        <div className="ap-row__form">
          <p className="ap-row__group">封面文字</p>
          <label>
            标题
            <input value={d.title} onChange={setDk('title')} />
          </label>
          <label>
            类别
            <input value={d.cat} onChange={setDk('cat')} />
          </label>

          <p className="ap-row__group">详情页文字</p>
          <label>
            标题
            <textarea rows="3" value={d.dtitle} onChange={setDk('dtitle')} />
          </label>
          <label>
            类别
            <textarea rows="3" value={d.dcat} onChange={setDk('dcat')} />
          </label>
          <label>
            年份
            <input value={d.year} onChange={setDk('year')} />
          </label>

          <div className="ap-row__imgs">
            <span className="ap-row__imgs-label">封面：</span>
            <div
              className="ap-cover-box"
              onMouseEnter={onCoverHover}
            >
              <img
                className="ap-cover-prev"
                src={coverCdnFail || isCdnBad() ? coverSrc : jsdelivrUrl(coverSrc)}
                alt="封面预览"
                draggable={false}
                loading="lazy"
                onError={() => setCoverCdnFail(true)}
              />
              <div className="ap-cover-tint" style={{ background: tint || 'rgba(0,0,0,0)' }} />
              {busy === 'cover' && (
                <div className="ap-cover-mask">
                  <span className="ap-spinner" />
                  <span>正在上传…</span>
                </div>
              )}
              {upCover && busy !== 'cover' && (
                <div className="ap-cover-done">✓ 上传成功</div>
              )}
              <label className="ap-cover-up" title="上传图片">
                <input ref={coverRef} type="file" accept="image/*" onChange={onCover} hidden />
                {upCover ? '✓ 已上传' : '上传图片'}
              </label>
              <button
                className="ap-cover-rm"
                title="移除封面"
                onClick={() => removeImage(`work-${id}-img`)}
              >
                ×
              </button>
            </div>
          </div>

          {uploadError && <p className="ap-row__note" role="alert">{uploadError}</p>}
          <div className="ap-shots">
            <span className="ap-row__imgs-label">
              详情图（{shownShots.length} 张）：直接拖动缩略图即可调整顺序；每张可删除，或在任意一张前 / 后插入新图
            </span>
            {shownShots.length === 0 && <p className="ap-row__note">暂无详情图——可在下方批量上传，或插入单张。</p>}
            <div className="ap-shots__wrap">
              <button
                className="ap-shots__nav ap-shots__nav--prev"
                title="向左移动"
                onClick={() => scrollShots(-1)}
              >
                ‹
              </button>
              <div
                className="ap-shots__list"
                ref={shotsListRef}
                onPointerUp={endShotDrag}
                onPointerCancel={endShotDrag}
              >
                {shownShots.map((s, i) => (
                  <div
                    className={`ap-shot${shotOver === i ? ' ap-shot--over' : ''}${
                      shotDrag === i ? ' ap-shot--drag' : ''
                    }`}
                    key={s.slice(0, 24)}
                    onPointerDown={(e) => onShotPointerDown(e, i)}
                    onPointerMove={(e) => onShotPointerMove(e, i)}
                  >
                    <img src={s} alt={`详情图 ${i + 1}`} draggable={false} />
                    <button className="ap-shot__del" title="删除此图" onClick={() => onDeleteShot(i)}>
                      ×
                    </button>
                    <label className="ap-shot__ins ap-shot__ins--before" title="在此图前插入多张">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={(e) => onInsert(e, i)}
                      />
                      ＋
                    </label>
                    <label className="ap-shot__ins ap-shot__ins--after" title="在此图后插入多张">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={(e) => onInsert(e, i + 1)}
                      />
                      ＋
                    </label>
                  </div>
                ))}
                <label className="ap-up ap-up--tail" title="末尾追加（新增，不覆盖已有）">
                  <input ref={shotsRef} type="file" accept="image/*" multiple onChange={onShots} hidden />
                  {busy === 'shots' ? (
                    <>
                      <span className="ap-up-spin" />
                      <span>上传中…</span>
                    </>
                  ) : upShots ? (
                    '✓ 已上传'
                  ) : (
                    '＋ 批量上传详情图'
                  )}
                </label>
              </div>
              <button
                className="ap-shots__nav ap-shots__nav--next"
                title="向右移动"
                onClick={() => scrollShots(1)}
              >
                ›
              </button>
            </div>
            {hasShots && (
              <button className="ap-rm" onClick={() => removeImage(`work-${id}-shots`)}>
                移除全部自定义详情图（恢复默认）
              </button>
            )}
          </div>

          {work._new && (
            <p className="ap-row__note">
              新增作品请上传封面与详情图（本机即时预览）；导出数据发回部署后对所有人可见。
            </p>
          )}
          <button className="ap-btn ap-btn--save" onClick={onSave}>
            {saved ? '✓ 已保存' : '保存作品'}
          </button>
          <button className="ap-row__del" onClick={onDelete}>
            删除作品
          </button>
        </div>
      )}
    </div>
  )
}

export default function AdminPanel() {
  const editing = useEditing()
  const [exported, setExported] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const works = useSyncExternalStore(subscribeEdits, computeLiveWorks)
  const cloud = useCloudStatus()
  const [tok, setTok] = useState(getCloudToken())
  const [migMsg, setMigMsg] = useState('')

  // 打开后台即校验令牌有效性：过期时显示重新输入窗口
  useEffect(() => {
    checkTokenValidity()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // 各作品行是否有未提交的文字修改（关闭时提醒保存）
  const [dirtySet, setDirtySet] = useState({})
  const anyDirty = Object.values(dirtySet).some(Boolean)
  const onDirtyChange = (id, dirty) =>
    setDirtySet((prev) => (prev[id] === dirty ? prev : { ...prev, [id]: dirty }))
  // 「完成」同步中的转圈动效 + 同步完成的成功动效
  const [syncing, setSyncing] = useState(false)
  const [doneMsg, setDoneMsg] = useState(false)

  const handleSaveToken = async () => {
    const token = tok.trim()
    if (!token) {
      setMigMsg('请先输入 GitHub 访问令牌')
      return
    }
    setCloudToken(token)
    setMigMsg('正在连接云端…')
    try {
      const r = await syncNow()
      if (!r.ok) {
        setMigMsg(cloud.expired ? '⚠ 令牌已失效，请重新输入有效令牌' : `连接失败：${r.error || '网络问题'}`)
        return
      }
      // 首次连接后迁移本机图片；迁移失败时明确提示，避免误报连接完成
      const m = await migrateCloudImages()
      if (!m.ok) {
        setMigMsg(`⚠ 云端已连接，但图片同步失败：${m.error || '请重试'}`)
        return
      }
      setMigMsg(m.migrated ? `✓ 已连接并同步 ${m.migrated} 张图片` : '✓ 已连接云端')
      setTimeout(() => setMigMsg(''), 4000)
    } catch (error) {
      setMigMsg(`连接失败：${error?.message || '网络异常，请检查连接后重试'}`)
    }
  }
  const handleDone = async () => {
    if (syncing || doneMsg) return
    // 1) 先统一提交所有行的文字草稿（点「完成」才让修改在网站生效）
    window.dispatchEvent(new CustomEvent('admin-commit'))
    await new Promise((r) => setTimeout(r, 50))
    // 2) 提交完成后同步云端：先上传本地图片（生成云端路径），再写数据文件，确保图片映射一并入库
    if (cloud.configured) {
      setSyncing(true)
      try {
        const migration = await migrateCloudImages()
        if (!migration.ok) throw new Error(migration.error || '图片同步失败')
        const sync = await syncNow()
        if (!sync.ok) throw new Error(sync.error || '数据同步失败')
      } catch (e) {
        setSyncing(false)
        // 同步失败：明确提示，不静默关闭，方便定位问题
        window.alert(
          '⚠ 同步失败：' +
            (e && e.message ? e.message : '网络或令牌问题') +
            '\n\n修改仍保留在当前浏览器，请检查令牌权限和网络后重试。\n然后重新点「完成（自动同步）」'
        )
        return
      }
      setSyncing(false)
      // 同步完成动效：短暂显示「✓ 已同步」后再关闭
      setDoneMsg(true)
      await new Promise((r) => setTimeout(r, 900))
      setDoneMsg(false)
    }
    setEditing(false)
  }
  // 右上角 ×：若有未保存的文字修改先提醒；确认保存则提交草稿并关闭（云端同步后台继续），放弃则直接关闭
  const handleClose = () => {
    if (anyDirty) {
      const saveFirst = window.confirm(
        '有修改尚未保存，是否保存并关闭？\n\n点「确定」= 保存并关闭\n点「取消」= 继续编辑'
      )
      if (saveFirst) {
        window.dispatchEvent(new CustomEvent('admin-commit'))
        if (cloud.configured) {
          ;(async () => {
            try {
              await migrateCloudImages()
              await syncNow()
            } catch { /* 后台同步失败不影响关闭 */ }
          })()
        }
        setEditing(false)
        return
      }
      // 未选择保存：再确认是否放弃修改直接关闭
      const discard = window.confirm(
        '放弃未保存的修改并直接关闭？\n\n点「确定」= 不保存，直接关闭\n点「取消」= 返回后台继续编辑'
      )
      if (!discard) return
      setEditing(false)
      return
    }
    window.dispatchEvent(new CustomEvent('admin-commit'))
    if (cloud.configured) {
      ;(async () => {
        try {
          await migrateCloudImages()
          await syncNow()
        } catch { /* 后台同步失败不影响关闭 */ }
      })()
    }
    setEditing(false)
  }

  if (!editing) return null

  const handleAdd = () => {
    if (!window.confirm('确定添加一个新作品？添加后可展开填写标题/类别/英文并上传图片。')) return
    const id = nextWorkId()
    applyEdit(`work-${id}-title`, `新作品 ${id}`)
    applyEdit(`work-${id}-cat`, '设计项目')
    applyEdit(`work-${id}-en`, 'New Project')
    // 新增作品默认排在最前面（第一个）
    const curOrder = getWorkOrder() || buildWorks().map((w) => w.id)
    setWorkOrder([id, ...curOrder.filter((x) => x !== id)])
  }

  const handleDrop = (targetId) => {
    if (dragId && targetId && dragId !== targetId) {
      const ids = works.map((w) => w.id)
      const from = ids.indexOf(dragId)
      const to = ids.indexOf(targetId)
      if (from !== -1 && to !== -1) {
        ids.splice(to, 0, ids.splice(from, 1)[0])
        setWorkOrder(ids)
      }
    }
    setDragId(null)
    setOverId(null)
  }

  const handleExport = async () => {
    const json = await exportAllData()
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'portfolio-data.json'
    a.click()
    URL.revokeObjectURL(a.href)
    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }

  return (
    <aside className="adminpanel">
      <button
        className="ap-close"
        onClick={handleClose}
        title="关闭后台（等同完成）"
        aria-label="关闭后台"
      >
        ×
      </button>
      <div className="adminpanel__head">
        <h2>作品管理</h2>
      </div>

      <div className="adminpanel__list">
        {works.map((w) => (
          <WorkRow
            key={w.id}
            work={w}
            draggable
            onDragStart={setDragId}
            onDragOver={setOverId}
            onDrop={handleDrop}
            dragState={overId}
            onDirtyChange={onDirtyChange}
          />
        ))}
      </div>

      {cloud.expired && (
        <div className="adminpanel__cloud adminpanel__cloud--expired">
          <h3>⚠ 令牌已失效，请重新输入</h3>
          <p>
            当前保存的云端令牌已过期或权限不足，导致作品无法同步到全网。
            请重新粘贴有效的 GitHub 令牌（需勾选 Contents Read and write 权限）：
          </p>
          <input
            className="ap-input"
            type="password"
            placeholder="GitHub 访问令牌 (PAT)"
            value={tok}
            onChange={(e) => setTok(e.target.value)}
            autoComplete="off"
          />
          <div className="adminpanel__cloud-row">
            <button className="ap-btn ap-btn--cloud" onClick={handleSaveToken}>
              保存并重新连接
            </button>
          </div>
          <p className="adminpanel__cloud-status">
            {cloud.syncing ? '正在连接…' : migMsg || '令牌已失效，修改暂未同步'}
          </p>
        </div>
      )}
      {!cloud.expired && cloud.configured && (
        <div className="adminpanel__cloud adminpanel__cloud--ok">
          <h3>{isAdminWorkerConfigured() ? '安全云端同步（Cloudflare Access）' : '云端同步（全设备）'}</h3>
          <p className="adminpanel__cloud-status">
            {cloud.syncing
              ? '正在连接…'
              : cloud.error
                ? `连接异常：${cloud.error}`
                : isAdminWorkerConfigured()
                  ? '✓ 安全接口已配置 · GitHub 令牌由服务端保管'
                  : '✓ 已连接云端 · 所有修改将自动同步到全网'}
          </p>
        </div>
      )}
      {!cloud.expired && !cloud.configured && (
        <div className="adminpanel__cloud">
          <h3>云端同步（全设备）· 首次连接</h3>
          <p>
            填入 GitHub 访问令牌，后台的任何修改（文字/排序/删除/上传图片）将自动同步到云端，
            所有设备打开网站都会看到最新内容。令牌只保存在当前浏览器，不会出现在网站代码里。
          </p>
          <input
            className="ap-input"
            type="password"
            placeholder="GitHub 访问令牌 (PAT)"
            value={tok}
            onChange={(e) => setTok(e.target.value)}
            autoComplete="off"
          />
          <div className="adminpanel__cloud-row">
            <button className="ap-btn ap-btn--cloud" onClick={handleSaveToken}>
              保存并连接
            </button>
          </div>
          <p className="adminpanel__cloud-status">
            {cloud.syncing ? '正在连接…' : cloud.error ? `连接失败：${cloud.error}` : '未配置：修改仅当前浏览器可见'}
            {migMsg ? `　${migMsg}` : ''}
          </p>
        </div>
      )}

      <div className="adminpanel__foot">
        <button className="ap-btn ap-btn--add" onClick={handleAdd}>
          ＋ 添加作品
        </button>
        <button className="ap-btn ap-btn--export" onClick={handleExport}>
          {exported ? '✓ 已导出，文件发回即可部署' : '导出数据'}
        </button>
        <button
          className="ap-btn ap-btn--reset"
          onClick={() => {
            if (window.confirm('确定恢复全部默认（含新增作品、删除标记与排序）？')) clearEdits()
          }}
        >
          恢复默认
        </button>
        <button className="ap-btn ap-btn--done" onClick={handleDone} disabled={syncing || doneMsg}>
          {syncing ? (
            <>
              <span className="ap-up-spin" />
              同步中…
            </>
          ) : doneMsg ? (
            <>
              <span className="ap-done-check">✓</span>
              已同步
            </>
          ) : (
            '完成（自动同步）'
          )}
        </button>
      </div>
    </aside>
  )
}
