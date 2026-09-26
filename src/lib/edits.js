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
  invalidateWorks()
  try {
    localStorage.setItem(KEY, JSON.stringify(edits))
  } catch {
    /* 存储不可用时仅本次会话生效 */
  }
  listeners.forEach((l) => l())
}

export function clearEdits() {
  edits = {}
  invalidateWorks()
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

// ---------- 作品管理：编辑与新增作品（同 localStorage 存储） ----------
import { works as baseWorks } from '../data/works'

// 新增作品占位封面：深色底 + NEW 字样（部署时由真实图片替换）
export const NEW_WORK_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="#1b1916"/><text x="450" y="580" font-family="sans-serif" font-size="72" letter-spacing="8" fill="#dcc394" text-anchor="middle">NEW</text><text x="450" y="660" font-family="sans-serif" font-size="30" letter-spacing="4" fill="#8a8378" text-anchor="middle">WORK</text></svg>`
  )

// 构建「基础作品 + 本地新增作品」的完整列表（编辑覆盖 title/cat/en）
// 结果缓存：仅当编辑数据变化时重建，保证 useSyncExternalStore 快照引用稳定
let worksCache = null
function computeWorks() {
  const ids = new Set(baseWorks.map((w) => w.id))
  Object.keys(edits).forEach((k) => {
    const m = k.match(/^work-(\d+)-(title|cat|en)$/)
    if (m && edits[`work-${m[1]}-deleted`] !== '1') ids.add(Number(m[1]))
  })
  return [...ids]
    .sort((a, b) => a - b)
    .map((id) => {
      if (edits[`work-${id}-deleted`] === '1') return null
      const base = baseWorks.find((w) => w.id === id)
      if (base) {
        const upShots = imageStore[`work-${id}-shots`]
        return {
          ...base,
          title: edits[`work-${id}-title`] ?? base.title,
          cat: edits[`work-${id}-cat`] ?? base.cat,
          en: edits[`work-${id}-en`] ?? base.en,
          img: imageStore[`work-${id}-img`] || base.img,
          shots: upShots ? JSON.parse(upShots) : base.shots,
        }
      }
      // 新增作品（尚未提供图片，使用占位封面）
      const nShots = imageStore[`work-${id}-shots`]
      return {
        id,
        title: edits[`work-${id}-title`] || `新作品 ${id}`,
        cat: edits[`work-${id}-cat`] || '设计项目',
        en: edits[`work-${id}-en`] || 'New Project',
        ratio: '3 / 4',
        img: imageStore[`work-${id}-img`] || NEW_WORK_PLACEHOLDER,
        hover: '#C6CE3B',
        shots: nShots ? JSON.parse(nShots) : [],
        tags: [],
        desc: '',
        _new: true,
      }
    })
    .filter(Boolean)
}
export function buildWorks() {
  if (!worksCache) worksCache = computeWorks()
  return worksCache
}
function invalidateWorks() {
  worksCache = null
}

// 下一个可用作品 id（基础最大 id + 本地新增中最大 id 之后）
export function nextWorkId() {
  let max = 0
  baseWorks.forEach((w) => (max = Math.max(max, w.id)))
  Object.keys(edits).forEach((k) => {
    const m = k.match(/^work-(\d+)-/)
    if (m) max = Math.max(max, Number(m[1]))
  })
  return max + 1
}

// 导出作品数据（含全部编辑与新增），供发回固化部署
export function exportWorks() {
  const list = buildWorks().map((w) => ({
    id: w.id,
    title: w.title,
    cat: w.cat,
    en: w.en,
    new: !!w._new,
    imgNeeded: !!w._new,
    ...(w._new ? {} : { img: w.img, ratio: w.ratio, hover: w.hover, shots: w.shots.length, tags: w.tags }),
  }))
  return JSON.stringify({ works: list, textEdits: edits }, null, 2)
}

// 订阅作品列表变化（编辑/新增后实时刷新页面）
export function useWorks() {
  return useSyncExternalStore(subscribeEdits, buildWorks)
}

// ---------- 权限：后台入口密码（轻量防误入，非强安全） ----------
// 如需修改密码，把下方字符串发给我即可更新并部署。
const ADMIN_PASSWORD = 'frong2026'
let authorized = false
try {
  authorized = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('portfolio-admin-ok') === '1'
} catch {
  authorized = false
}
export const isAuthorized = () => authorized
export function checkPassword(pw) {
  if (pw === ADMIN_PASSWORD) {
    authorized = true
    try {
      sessionStorage.setItem('portfolio-admin-ok', '1')
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l())
    return true
  }
  return false
}
export function useAuthorized() {
  return useSyncExternalStore(subscribeEdits, isAuthorized)
}

// ---------- 删除作品（标记 deleted，导出后部署时从作品列表移除） ----------
export function deleteWork(id) {
  const next = { ...edits }
  Object.keys(next).forEach((k) => {
    if (k.startsWith(`work-${id}-`)) delete next[k]
  })
  next[`work-${id}-deleted`] = '1'
  edits = next
  try {
    localStorage.setItem(KEY, JSON.stringify(edits))
  } catch {
    /* ignore */
  }
  invalidateWorks()
  listeners.forEach((l) => l())
}
export const getDeletedIds = () =>
  Object.keys(edits)
    .filter((k) => /^work-\d+-deleted$/.test(k) && edits[k] === '1')
    .map((k) => Number(k.match(/^work-(\d+)-/)[1]))

// ---------- 作品图片上传：IndexedDB 持久化（浏览器内预览），导出时打包 ----------
const IMG_DB = 'portfolio-images'
let imageStore = {}

function openImgDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'))
    const req = indexedDB.open(IMG_DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('imgs')) req.result.createObjectStore('imgs')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putImage(key, value) {
  try {
    const db = await openImgDB()
    await new Promise((res, rej) => {
      const tx = db.transaction('imgs', 'readwrite')
      tx.objectStore('imgs').put(value, key)
      tx.oncomplete = res
      tx.onerror = () => rej(tx.error)
    })
  } catch {
    /* IndexedDB 不可用则仅本次会话生效 */
  }
  imageStore[key] = value
  invalidateWorks()
  listeners.forEach((l) => l())
}

export async function loadStoredImages() {
  try {
    const db = await openImgDB()
    const out = await new Promise((res, rej) => {
      const tx = db.transaction('imgs', 'readonly')
      const cur = tx.objectStore('imgs').openCursor()
      const acc = {}
      cur.onsuccess = () => {
        const c = cur.result
        if (c) {
          acc[c.key] = c.value
          c.continue()
        } else res(acc)
      }
      cur.onerror = () => rej(cur.error)
    })
    imageStore = out
  } catch {
    imageStore = {}
  }
  invalidateWorks()
  listeners.forEach((l) => l())
}

export function compressImage(file, maxSide = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        c.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(c.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 导出完整后台数据（文字 + 删除标记 + 上传图片），下载文件后发回部署
export async function exportAllData() {
  const deleted = getDeletedIds()
  const works = buildWorks()
    .filter((w) => !deleted.includes(w.id))
    .map((w) => ({
      id: w.id,
      title: w.title,
      cat: w.cat,
      en: w.en,
      new: !!w._new,
      img: w.img,
      shots: w.shots,
      hover: w.hover,
    }))
  return JSON.stringify(
    {
      version: 1,
      works,
      deleted,
      textEdits: edits,
      images: imageStore,
    },
    null,
    2
  )
}
