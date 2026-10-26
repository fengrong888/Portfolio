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
  useEditsRev,
  setWorkOrder,
  deleteShot,
  moveShot,
  extractDominantColor,
  exportAllData,
  getCloudToken,
  setCloudToken,
  syncNow,
  migrateCloudImages,
  useCloudStatus,
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
  const [shotDrag, setShotDrag] = useState(null) // 详情图拖拽：起始 index
  const [shotOver, setShotOver] = useState(null) // 详情图拖拽：悬停目标 index
  const coverRef = useRef(null)
  const shotsRef = useRef(null)
  const insertRef = useRef(null) // 记录待插入位置：{ index }
  const shotsListRef = useRef(null) // 详情图横排列表（左右按钮滚动）
  // 悬停纯色：从作品封面/详情图自动提取主色（缓存，每行只提取一次）
  const [tint, setTint] = useState(null)
  const onCoverHover = () => {
    if (tint) return
    const src = hasCover ? getStoredImage(`work-${id}-img`) : shots[0] || work.img
    extractDominantColor(src).then((c) => c && setTint(c))
  }
  useEditsRev()
  const hasCover = !!getStoredImage(`work-${id}-img`)
  const hasShots = !!getStoredImage(`work-${id}-shots`)
  // 文字草稿：后台输入先改草稿，点「完成」才提交到网站
  const [d, setD] = useState(() => ({
    title: work.title,
    cat: work.cat,
    year: work.year ?? '',
    dtitle: work.dtitle ?? work.title,
    dcat: work.dcat ?? work.cat,
  }))
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
  const setDk = (k) => (e) => setD((p) => ({ ...p, [k]: e.target.value }))
  const [saved, setSaved] = useState(false)
  // 提交该作品行的文字草稿（保存作品 / 点完成时都会调用）
  const commitRow = () => {
    if (d.title !== work.title) applyEdit(`work-${id}-title`, d.title)
    if (d.cat !== work.cat) applyEdit(`work-${id}-cat`, d.cat)
    if (d.year !== (work.year ?? '')) applyEdit(`work-${id}-year`, d.year)
    if (d.dtitle !== (work.dtitle ?? work.title)) applyEdit(`work-${id}-dtitle`, d.dtitle)
    if (d.dcat !== (work.dcat ?? work.cat)) applyEdit(`work-${id}-dcat`, d.dcat)
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

  const onCover = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy('cover')
    try {
      const dataUrl = await compressImage(file, 700, 0.85)
      await putImage(`work-${id}-img`, dataUrl)
      setUpCover(true)
      setTimeout(() => setUpCover(false), 1600)
    } finally {
      setBusy(null)
    }
    if (coverRef.current) coverRef.current.value = ''
  }

  const onShots = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setBusy('shots')
    try {
      const urls = await Promise.all(files.map((f) => compressImage(f, 3000, 1.0)))
      // 新增追加：保留已有详情图，新图排在末尾
      await putImage(`work-${id}-shots`, JSON.stringify([...shots, ...urls]))
      setUpShots(true)
      setTimeout(() => setUpShots(false), 1600)
    } finally {
      setBusy(null)
    }
    if (shotsRef.current) shotsRef.current.value = ''
  }

  // 多张插入：index 位置一次插入多张（index 为 shots.length 时表示末尾追加）
  const onInsert = async (e, index) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setBusy('insert')
    try {
      const urls = await Promise.all(files.map((f) => compressImage(f, 3000, 1.0)))
      const next = [...shots.slice(0, index), ...urls, ...shots.slice(index)]
      await putImage(`work-${id}-shots`, JSON.stringify(next))
    } finally {
      setBusy(null)
    }
    if (insertRef.current) insertRef.current.value = ''
  }

  // 详情图列表左右移动
  const scrollShots = (dir) => {
    const el = shotsListRef.current
    if (!el) return
    const step = Math.max(el.clientWidth * 0.75, 160)
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  const onDeleteShot = (index) => {
    if (window.confirm(`确定删除详情图第 ${index + 1} 张？`)) deleteShot(id, shots, index)
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
                src={hasCover ? getStoredImage(`work-${id}-img`) : work.img}
                alt="封面预览"
                draggable={false}
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

          <div className="ap-shots">
            <span className="ap-row__imgs-label">
              详情图（{shots.length} 张）：拖动缩略图可调换顺序；每张可删除，或在任意一张前 / 后插入新图
            </span>
            {shots.length === 0 && <p className="ap-row__note">暂无详情图——可在下方批量上传，或插入单张。</p>}
            <div className="ap-shots__wrap">
              <button
                className="ap-shots__nav ap-shots__nav--prev"
                title="向左移动"
                onClick={() => scrollShots(-1)}
              >
                ‹
              </button>
              <div className="ap-shots__list" ref={shotsListRef}>
                {shots.map((s, i) => (
                  <div
                    className={`ap-shot${shotOver === i ? ' ap-shot--over' : ''}${
                      shotDrag === i ? ' ap-shot--drag' : ''
                    }`}
                    key={`${s.slice(0, 24)}-${i}`}
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation()
                      e.dataTransfer.effectAllowed = 'move'
                      setShotDrag(i)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShotOver(i)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (shotDrag !== null && shotDrag !== i) moveShot(id, shots, shotDrag, i)
                      setShotDrag(null)
                      setShotOver(null)
                    }}
                    onDragEnd={() => {
                      setShotDrag(null)
                      setShotOver(null)
                    }}
                  >
                    <img src={s} alt={`详情图 ${i + 1}`} draggable={false} />
                    <button className="ap-shot__del" title="删除此图" onClick={() => onDeleteShot(i)}>
                      ×
                    </button>
                    <label className="ap-shot__ins ap-shot__ins--before" title="在此图前插入多张">
                      <input
                        ref={insertRef}
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
                        ref={insertRef}
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
  // 各作品行是否有未提交的文字修改（关闭时提醒保存）
  const [dirtySet, setDirtySet] = useState({})
  const anyDirty = Object.values(dirtySet).some(Boolean)
  const onDirtyChange = (id, dirty) =>
    setDirtySet((prev) => (prev[id] === dirty ? prev : { ...prev, [id]: dirty }))
  // 「完成」同步中的转圈动效 + 同步完成的成功动效
  const [syncing, setSyncing] = useState(false)
  const [doneMsg, setDoneMsg] = useState(false)

  const handleSaveToken = async () => {
    setCloudToken(tok)
    if (tok.trim()) {
      setMigMsg('正在连接云端…')
      await syncNow()
      // 首次连接后自动把本机已上传的图片静默推送到云端
      try {
        const r = await migrateCloudImages()
        setMigMsg(r.ok && r.migrated ? `✓ 已连接并同步 ${r.migrated} 张图片` : '✓ 已连接云端')
      } catch {
        setMigMsg('✓ 已连接云端')
      }
      setTimeout(() => setMigMsg(''), 3000)
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
        await migrateCloudImages()
        await syncNow()
      } catch {
        /* 同步失败不阻断退出后台 */
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
        <p>
          拖动行可调整作品顺序；展开作品可编辑文字、管理封面与详情图（删除/前后插入/批量上传）、
          新增或删除作品。图片上传、排序、删除会自动保存并同步云端；文字修改需点「保存作品」或
          底部「完成（自动同步）」才会保存并同步到全网。
        </p>
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

      {!cloud.configured && (
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
