import { useEffect, useRef, useState } from 'react'
import { useEdit, useEditing, applyEdit } from '../lib/edits'

/* 整块可编辑文本块
   - 浏览模式：按行渲染段落（首行为姓名行，加粗）
   - 编辑模式（后台 Shift+E）：整个区域变成一个多行文本框，整段自由输入，
     每行一段；失焦自动保存，Esc 前可随时改
   值以单字段存储（行间用 \n 分隔），不再需要逐段单独点改 */
export default function EditableBlock({ k, fallback }) {
  const value = useEdit(k, fallback)
  const editing = useEditing()
  const [draft, setDraft] = useState(value)
  const taRef = useRef(null)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [editing, value])

  useEffect(() => {
    const el = taRef.current
    if (editing && el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [editing, draft])

  if (!editing) {
    const lines = String(value)
      .split('\n')
      .map((l) => l.replace(/\r/g, '').trim())
      .filter(Boolean)
    return (
      <div className="bio-block">
        {lines.map((line, i) => (
          <p key={i} className={i === 0 ? 'bio-block__first' : 'bio-block__line'}>
            {line}
          </p>
        ))}
      </div>
    )
  }

  return (
    <textarea
      ref={taRef}
      className="bio-block__input"
      value={draft}
      spellCheck={false}
      onChange={(e) => {
        setDraft(e.target.value)
        const el = e.target
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
      }}
      onBlur={() => {
        const t = draft.replace(/\r/g, '').trim()
        if (t && t !== value) applyEdit(k, t)
      }}
      placeholder="每行一段，自由编辑"
    />
  )
}
