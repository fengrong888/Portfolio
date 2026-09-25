import { useRef } from 'react'
import { useEdit, useEditing, applyEdit } from '../lib/edits'

// 可在线编辑的文字：编辑模式下点击即可原地修改。
// Enter 提交（多行模式按回车换行、点击别处提交），Esc 取消。
// 若点击序列中外层 <a> 抢走焦点且文本未变，自动恢复编辑态。
// 默认直接渲染文本；传 children 时可自定义渲染（如标签芯片）。
export default function Editable({
  k,
  fallback,
  as: Tag = 'span',
  multiline = false,
  className,
  children
}) {
  const value = useEdit(k, fallback)
  const editing = useEditing()
  const ref = useRef(null)

  function makeEditable(el, clientX, clientY) {
    el.contentEditable = 'true'
    el.focus()
    const sel = window.getSelection()
    sel.removeAllRanges()
    // 光标定位到鼠标点击处的字符间，便于直接修改单个字符；
    // 点击点不在文本上时退回全选（整段替换）。
    if (clientX != null && typeof document.caretRangeFromPoint === 'function') {
      const range = document.caretRangeFromPoint(clientX, clientY)
      if (range && el.contains(range.startContainer)) {
        sel.addRange(range)
        return
      }
    }
    const range = document.createRange()
    range.selectNodeContents(el)
    sel.addRange(range)
  }

  function enter(el, clientX, clientY) {
    makeEditable(el, clientX, clientY)
    let cancelled = false
    let didType = false
    const onKey = (ev) => {
      if (ev.key === 'Enter' && ev.key !== 'Escape') didType = true
      if (ev.key === 'Escape') {
        ev.preventDefault()
        cancelled = true
        el.textContent = value
        el.blur()
      }
      if (!multiline && ev.key === 'Enter') {
        ev.preventDefault()
        el.blur()
      }
    }
    // 粘贴统一以纯文本插入：富文本粘贴不再带出样式标记，任何来源都能干净粘贴
    const onPaste = (ev) => {
      ev.preventDefault()
      const text = ev.clipboardData.getData('text/plain')
      if (text) {
        didType = true
        document.execCommand('insertText', false, text)
      }
    }
    const finish = () => {
      el.removeEventListener('blur', finish)
      el.removeEventListener('keydown', onKey)
      el.removeEventListener('paste', onPaste)
      const text = el.textContent.trim()
      const anchor = el.closest('a')
      const stolen = !didType && !cancelled && text === value && !!anchor && anchor.contains(document.activeElement)
      if (stolen) {
        // 点击序列中外层 <a> 抢焦点：恢复编辑态
        makeEditable(el)
        el.addEventListener('blur', finish)
        el.addEventListener('keydown', onKey)
        el.addEventListener('paste', onPaste)
        return
      }
      el.contentEditable = 'false'
      if (!cancelled && text !== value) applyEdit(k, text)
    }
    el.addEventListener('blur', finish)
    el.addEventListener('keydown', onKey)
    el.addEventListener('paste', onPaste)
  }

  function beginEdit(e) {
    if (!editing) return
    e.preventDefault()
    e.stopPropagation()
    enter(ref.current, e.clientX, e.clientY)
  }

  return (
    <Tag ref={ref} data-edit="1" className={className} onPointerDown={beginEdit}>
      {children ?? value}
    </Tag>
  )
}
