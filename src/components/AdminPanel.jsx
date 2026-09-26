import { useRef, useState } from 'react'
import {
  useEditing,
  useEdit,
  applyEdit,
  useWorks,
  nextWorkId,
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
  insertShot,
  exportAllData,
} from '../lib/edits'

// 作品管理面板（Shift+E + 密码验证后打开）：
// 编辑标题/类别/英文、上传封面与详情图、逐张管理详情图（删除/前后插入）、
// 拖拽调整作品顺序、新增/删除作品（带确认）、导出完整数据发回固化部署。
function WorkRow({ work, draggable, onDragStart, onDragOver, onDrop, dragState }) {
  const id = work.id
  const [open, setOpen] = useState(false)
  const [upCover, setUpCover] = useState(false)
  const [upShots, setUpShots] = useState(false)
  const coverRef = useRef(null)
  const shotsRef = useRef(null)
  const insertRef = useRef(null) // 记录待插入位置：{ index }
  useEditsRev()
  const hasCover = !!getStoredImage(`work-${id}-img`)
  const hasShots = !!getStoredImage(`work-${id}-shots`)
  const title = useEdit(`work-${id}-title`, work.title)
  const cat = useEdit(`work-${id}-cat`, work.cat)
  const en = useEdit(`work-${id}-en`, work.en)
  const shots = work.shots || []

  const onCover = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await compressImage(file, 700, 0.85)
    await putImage(`work-${id}-img`, dataUrl)
    setUpCover(true)
    setTimeout(() => setUpCover(false), 1500)
    if (coverRef.current) coverRef.current.value = ''
  }

  const onShots = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const urls = await Promise.all(files.map((f) => compressImage(f, 1400, 0.82)))
    await putImage(`work-${id}-shots`, JSON.stringify(urls))
    setUpShots(true)
    setTimeout(() => setUpShots(false), 1500)
    if (shotsRef.current) shotsRef.current.value = ''
  }

  // 单张插入：index 之前（index 为 shots.length 时表示末尾追加）
  const onInsert = async (e, index) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await compressImage(file, 1400, 0.82)
    await insertShot(id, shots, index, dataUrl)
    if (insertRef.current) insertRef.current.value = ''
  }

  const onDeleteShot = (index) => {
    if (window.confirm(`确定删除详情图第 ${index + 1} 张？`)) deleteShot(id, shots, index)
  }

  const onDelete = () => {
    const msg = work._new
      ? `确定删除「${title}」？该新增作品将被移除。`
      : `确定删除「${title}」？删除后本机预览立即生效；导出数据发回部署后，该作品将从网站永久移除（可通过重新提供恢复）。`
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
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(id)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver(id)
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop(id)
      }}
      onDragEnd={() => onDragOver(null)}
    >
      <button className="ap-row__head" onClick={() => setOpen((o) => !o)}>
        <span className="ap-row__grip" aria-hidden="true">⋮⋮</span>
        <span className="ap-row__id">{id}</span>
        <span className="ap-row__t">{title || '（未命名）'}</span>
        {work._new && <em className="ap-row__tag">新</em>}
      </button>
      {open && (
        <div className="ap-row__form">
          <label>
            标题
            <input value={title} onChange={(e) => applyEdit(`work-${id}-title`, e.target.value)} />
          </label>
          <label>
            类别
            <input value={cat} onChange={(e) => applyEdit(`work-${id}-cat`, e.target.value)} />
          </label>
          <label>
            英文
            <input value={en} onChange={(e) => applyEdit(`work-${id}-en`, e.target.value)} />
          </label>

          <div className="ap-row__imgs">
            <span className="ap-row__imgs-label">封面：</span>
            <label className="ap-up">
              <input ref={coverRef} type="file" accept="image/*" onChange={onCover} hidden />
              {upCover ? '✓ 封面已上传' : '上传封面'}
            </label>
            {hasCover && (
              <button className="ap-rm" onClick={() => removeImage(`work-${id}-img`)}>
                移除已上传封面
              </button>
            )}
          </div>

          <div className="ap-shots">
            <span className="ap-row__imgs-label">
              详情图（{shots.length} 张）：每张可删除，或在任意一张前 / 后插入新图
            </span>
            {shots.length === 0 && <p className="ap-row__note">暂无详情图——可在下方批量上传，或插入单张。</p>}
            <div className="ap-shots__list">
              {shots.map((s, i) => (
                <div className="ap-shot" key={`${s.slice(0, 24)}-${i}`}>
                  <label className="ap-shot__add ap-shot__add--before" title="在此图前插入">
                    <input
                      ref={insertRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => onInsert(e, i)}
                    />
                    ＋
                  </label>
                  <img src={s} alt={`详情图 ${i + 1}`} />
                  <button className="ap-shot__del" title="删除此图" onClick={() => onDeleteShot(i)}>
                    ×
                  </button>
                  <label className="ap-shot__add ap-shot__add--after" title="在此图后插入">
                    <input
                      ref={insertRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => onInsert(e, i + 1)}
                    />
                    ＋
                  </label>
                </div>
              ))}
              <label className="ap-up ap-up--tail" title="末尾追加">
                <input ref={shotsRef} type="file" accept="image/*" multiple onChange={onShots} hidden />
                {upShots ? '✓ 已上传' : '＋ 批量上传详情图'}
              </label>
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
  const works = useWorks()

  if (!editing) return null

  const handleAdd = () => {
    if (!window.confirm('确定添加一个新作品？添加后可展开填写标题/类别/英文并上传图片。')) return
    const id = nextWorkId()
    applyEdit(`work-${id}-title`, `新作品 ${id}`)
    applyEdit(`work-${id}-cat`, '设计项目')
    applyEdit(`work-${id}-en`, 'New Project')
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
      <div className="adminpanel__head">
        <h2>作品管理</h2>
        <p>
          拖动行可调整作品顺序；展开作品可编辑文字、管理封面与详情图（删除/前后插入/批量上传）、
          新增或删除作品。完成后点「导出数据」下载文件发回，即可永久部署给所有访客。
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
          />
        ))}
      </div>

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
        <button
          className="ap-btn ap-btn--done"
          onClick={() => {
            setEditing(false)
          }}
        >
          完成
        </button>
      </div>
    </aside>
  )
}
