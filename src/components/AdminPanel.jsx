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
  exportAllData,
} from '../lib/edits'

// 作品管理面板（Shift+E + 密码验证后打开）：
// 编辑标题/类别/英文、上传封面与详情图（本地预览）、新增/删除作品（带确认）、
// 导出完整数据（含图片）下载文件发回，即可固化部署给所有访客。
function WorkRow({ work }) {
  const id = work.id
  const [open, setOpen] = useState(false)
  const [upCover, setUpCover] = useState(false)
  const [upShots, setUpShots] = useState(false)
  const coverRef = useRef(null)
  const shotsRef = useRef(null)
  useEditsRev()
  const hasCover = !!getStoredImage(`work-${id}-img`)
  const hasShots = !!getStoredImage(`work-${id}-shots`)
  const title = useEdit(`work-${id}-title`, work.title)
  const cat = useEdit(`work-${id}-cat`, work.cat)
  const en = useEdit(`work-${id}-en`, work.en)

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

  const onDelete = () => {
    const msg = work._new
      ? `确定删除「${title}」？该新增作品将被移除。`
      : `确定删除「${title}」？删除后本机预览立即生效；导出数据发回部署后，该作品将从网站永久移除（可通过重新提供恢复）。`
    if (window.confirm(msg)) deleteWork(id)
  }

  return (
    <div className={`ap-row${open ? ' ap-row--open' : ''}${work._new ? ' ap-row--new' : ''}`}>
      <button className="ap-row__head" onClick={() => setOpen((o) => !o)}>
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
            <span className="ap-row__imgs-label">图片（本机预览，导出后发回部署）：</span>
            <label className="ap-up">
              <input ref={coverRef} type="file" accept="image/*" onChange={onCover} hidden />
              {upCover ? '✓ 封面已上传' : '上传封面'}
            </label>
            <label className="ap-up">
              <input ref={shotsRef} type="file" accept="image/*" multiple onChange={onShots} hidden />
              {upShots ? '✓ 详情图已上传' : '上传详情图（可多选）'}
            </label>
            {hasCover && (
              <button className="ap-rm" onClick={() => removeImage(`work-${id}-img`)}>
                移除已上传封面
              </button>
            )}
            {hasShots && (
              <button className="ap-rm" onClick={() => removeImage(`work-${id}-shots`)}>
                移除已上传详情图
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
  const works = useWorks()

  if (!editing) return null

  const handleAdd = () => {
    if (!window.confirm('确定添加一个新作品？添加后可展开填写标题/类别/英文并上传图片。')) return
    const id = nextWorkId()
    applyEdit(`work-${id}-title`, `新作品 ${id}`)
    applyEdit(`work-${id}-cat`, '设计项目')
    applyEdit(`work-${id}-en`, 'New Project')
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
          编辑标题/类别/英文、上传图片（本机即时预览）、新增/删除作品。
          完成后点「导出数据」下载文件发回，即可永久部署给所有访客。
        </p>
      </div>

      <div className="adminpanel__list">
        {works.map((w) => (
          <WorkRow key={w.id} work={w} />
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
            if (window.confirm('确定恢复全部默认（含新增作品与删除标记）？')) clearEdits()
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
