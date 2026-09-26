import { useState } from 'react'
import {
  useEditing,
  useEdit,
  applyEdit,
  useWorks,
  nextWorkId,
  exportWorks,
  clearEdits,
  setEditing,
} from '../lib/edits'

// 作品管理面板：Shift+E 呼出编辑模式后，右侧抽屉式后台。
// 支持：编辑每个作品的标题/类别/英文；一键新增作品；导出数据（复制 JSON 发回即可固化部署）。
function WorkRow({ work }) {
  const id = work.id
  const [open, setOpen] = useState(false)
  const title = useEdit(`work-${id}-title`, work.title)
  const cat = useEdit(`work-${id}-cat`, work.cat)
  const en = useEdit(`work-${id}-en`, work.en)

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
          {work._new && (
            <p className="ap-row__note">
              新增作品封面与详情图片待提供：请把图片压缩包发给我，或先导出数据后把图片一并提供。
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminPanel() {
  const editing = useEditing()
  const [copied, setCopied] = useState(false)
  const works = useWorks()

  if (!editing) return null

  const handleAdd = () => {
    const id = nextWorkId()
    applyEdit(`work-${id}-title`, `新作品 ${id}`)
    applyEdit(`work-${id}-cat`, '设计项目')
    applyEdit(`work-${id}-en`, 'New Project')
  }

  const handleExport = async () => {
    try {
      await navigator.clipboard.writeText(exportWorks())
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // 剪贴板不可用时退回下载
      const blob = new Blob([exportWorks()], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'portfolio-data.json'
      a.click()
      URL.revokeObjectURL(a.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <aside className="adminpanel">
      <div className="adminpanel__head">
        <h2>作品管理</h2>
        <p>编辑标题 / 类别 / 英文，新增作品；修改后点「导出数据」并粘贴发回，即可永久部署给所有人。</p>
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
          {copied ? '✓ 已复制，粘贴发回即可' : '导出数据'}
        </button>
        <button
          className="ap-btn ap-btn--reset"
          onClick={() => {
            if (window.confirm('确定恢复全部默认文字（含新增作品）？')) clearEdits()
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
