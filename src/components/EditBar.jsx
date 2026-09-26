import { useEffect } from 'react'
import { setEditing, useEditing } from '../lib/edits'

// 快捷键入口：Shift+E 直接打开 / 关闭「作品管理面板」。
// 面板内可编辑作品标题/类别/英文、新增作品、导出数据发回固化部署。
export default function EditBar() {
  const editing = useEditing()

  useEffect(() => {
    const onKey = (e) => {
      if (e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault()
        setEditing(!editing)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  if (editing) {
    return (
      <div className="editbar">
        <span className="editbar__hint">Shift+E 已开启 · 右侧为作品管理面板（Shift+E 关闭）</span>
      </div>
    )
  }

  return null
}
