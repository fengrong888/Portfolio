import { useSyncExternalStore } from 'react'

// 在线文字编辑：修改存入 localStorage（当前浏览器内刷新保留），
// 点「导出文本」下载 JSON，发回后可将内容固化进源码、永久发布给所有人。
const KEY = 'portfolio-text-edits'

let edits = {}
try {
  const raw = localStorage.getItem(KEY)
  edits = raw ? JSON.parse(raw) : {}
} catch {
  edits = {}
}

let editing = false
const listeners = new Set()

export const getEdits = () => edits
export const isEditing = () => editing

export function setEditing(v) {
  editing = v
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('edit-mode', v)
  }
  listeners.forEach((l) => l())
}

export function applyEdit(k, v) {
  edits = { ...edits, [k]: v }
  try {
    localStorage.setItem(KEY, JSON.stringify(edits))
  } catch {
    /* 存储不可用时仅本次会话生效 */
  }
  listeners.forEach((l) => l())
}

export function clearEdits() {
  edits = {}
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export const exportEdits = () => JSON.stringify(edits, null, 2)

export function subscribeEdits(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useEdit(k, fallback) {
  return useSyncExternalStore(subscribeEdits, () => {
    const v = edits[k]
    // 规则：允许删减与修改单个字符；显式保存过（含空串）就以保存值为准，
    // 未编辑过才回退默认文案。误删可在编辑模式下重新点入修改。
    return v !== undefined ? v : fallback
  })
}

export function useEditing() {
  return useSyncExternalStore(subscribeEdits, isEditing)
}
