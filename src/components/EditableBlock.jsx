import { useEffect, useRef } from 'react'
import { useEdit, useEditing, applyEdit } from '../lib/edits'

/* 数字串（含日期、年份区间）单独包一层放大，补偿西文数字在中文字号下视觉偏小 */
const NUM_SRC = '[0-9][0-9.\\-–—:%,/]*'

/* 方圆体子集只含 ASCII，缺 en dash / em dash，显示时归一成半角连字符，避免该字符回退成别的字体 */
const normalizeNum = (t) => t.replace(/[–—]/g, '-')

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* 一行文本 → 带数字 span 的 HTML（编辑态用） */
function lineToHtml(line) {
  const re = new RegExp(NUM_SRC, 'g')
  let out = ''
  let last = 0
  let m
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out += escapeHtml(line.slice(last, m.index))
    out += `<span class="bio-num">${escapeHtml(normalizeNum(m[0]))}</span>`
    last = m.index + m[0].length
  }
  if (last < line.length) out += escapeHtml(line.slice(last))
  return out
}

/* 一行文本 → React 节点（浏览态用） */
function lineToNodes(line, key) {
  const re = new RegExp(NUM_SRC, 'g')
  const out = []
  let last = 0
  let m
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push(line.slice(last, m.index))
    out.push(
      <span className="bio-num" key={`n${key}-${m.index}`}>
        {normalizeNum(m[0])}
      </span>
    )
    last = m.index + m[0].length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

const splitLines = (v) =>
  String(v)
    .split('\n')
    .map((l) => l.replace(/\r/g, ''))
    .filter((l) => l.trim() !== '')

/* 整块可编辑文本块
   - 浏览模式：按行渲染段落（数字部分单独放大）
   - 编辑模式（后台 Shift+E）：整块变成可编辑区域，内部仍是同样的段落、同一套 CSS，
     行距 / 段距 / 字号 / 字重与浏览状态完全一致，只是外面多一圈虚线提示；
     每行一段，失焦自动保存 */
export default function EditableBlock({ k, fallback }) {
  const value = useEdit(k, fallback)
  const editing = useEditing()
  const elRef = useRef(null)

  useEffect(() => {
    const el = elRef.current
    if (!editing || !el || el.dataset.filled === '1') return
    el.innerHTML = ''
    splitLines(value).forEach((line) => {
      const p = document.createElement('p')
      p.className = 'bio-block__line'
      p.innerHTML = lineToHtml(line)
      el.appendChild(p)
    })
    el.dataset.filled = '1'
  }, [editing, value])

  if (!editing) {
    return (
      <div className="bio-block">
        {splitLines(value).map((line, i) => (
          <p className="bio-block__line" key={i}>
            {lineToNodes(line, i)}
          </p>
        ))}
      </div>
    )
  }

  const commit = () => {
    const el = elRef.current
    if (!el) return
    const t = el.innerText
      .replace(/\r/g, '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n')
    if (t && t !== value) applyEdit(k, t)
  }

  return (
    <div
      ref={elRef}
      className="bio-block bio-block--edit"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={commit}
    />
  )
}
