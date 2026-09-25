import { useEffect, useState } from 'react'
import { setEditing, clearEdits, exportEdits, useEditing } from '../lib/edits'

// 右下角悬浮编辑工具栏（默认隐藏，按 Shift+E 呼出「编辑文字」入口）。
// 发布给访客看时页面干净无按钮；编辑完成后入口一并隐藏。
export default function EditBar() {
  const editing = useEditing()
  const [showToggle, setShowToggle] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if (e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault()
        setEditing(false)
        setShowToggle((s) => !s)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (editing) {
    return (
      <div className="editbar">
        <button
          className="editbar__done"
          onClick={() => {
            setEditing(false)
            setShowToggle(false)
          }}
        >
          完成
        </button>
        <button
          onClick={() => {
            const blob = new Blob([exportEdits()], { type: 'application/json' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = 'portfolio-text.json'
            a.click()
            URL.revokeObjectURL(a.href)
          }}
        >
          导出文本
        </button>
        <button
          onClick={() => {
            if (window.confirm('确定恢复全部默认文字？')) clearEdits()
          }}
        >
          恢复默认
        </button>
      </div>
    )
  }

  if (!showToggle) return null

  return (
    <button
      className="editbar editbar--toggle"
      onClick={() => setEditing(true)}
      aria-label="开启文字编辑"
    >
      编辑文字
    </button>
  )
}
