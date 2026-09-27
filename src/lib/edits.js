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
let rev = 0
const listeners = new Set()

export const getEdits = () => edits
export const isEditing = () => editing

export function bumpRev() {
  rev += 1
}
export function useEditsRev() {
  return useSyncExternalStore(subscribeEdits, () => rev)
}
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
  queueSync()
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
  let order = null
  try {
    order = JSON.parse(edits['work-order'] || 'null')
  } catch {
    order = null
  }
  const sorted = [...ids]
  if (Array.isArray(order) && order.length) {
    sorted.sort((a, b) => {
      const ia = order.indexOf(a)
      const ib = order.indexOf(b)
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    })
  } else {
    sorted.sort((a, b) => a - b)
  }
  return sorted
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

// 作品排序：拖拽调整后写入 work-order（JSON 数组），部署时按此固化
export function setWorkOrder(ids) {
  applyEdit('work-order', JSON.stringify(ids))
}
export const getWorkOrder = () => {
  try {
    const v = JSON.parse(edits['work-order'] || 'null')
    return Array.isArray(v) ? v : null
  } catch {
    return null
  }
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
const ADMIN_PASSWORD = '120589'
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
  queueSync()
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
  // 云端同步：dataURL 上传为仓库路径后全端可见（失败时保持本地，下次再试）
  if (token) {
    syncImageToCloud(key, value)
      .then((next) => {
        if (next !== value) {
          invalidateWorks()
          listeners.forEach((l) => l())
        }
        queueSync(200)
      })
      .catch(() => {
        /* 单次失败保留本地 */
      })
  }
}

export const getStoredImage = (key) => imageStore[key] ?? null

// 详情图列表管理：基于当前生效 shots 删除/插入单张（含基础图混合）
export async function deleteShot(id, currentShots, index) {
  const next = currentShots.filter((_, i) => i !== index)
  await putImage(`work-${id}-shots`, JSON.stringify(next))
}
export async function insertShot(id, currentShots, index, dataUrl) {
  const next = [...currentShots.slice(0, index), dataUrl, ...currentShots.slice(index)]
  await putImage(`work-${id}-shots`, JSON.stringify(next))
}

export async function removeImage(key) {
  try {
    const db = await openImgDB()
    await new Promise((res, rej) => {
      const tx = db.transaction('imgs', 'readwrite')
      tx.objectStore('imgs').delete(key)
      tx.oncomplete = res
      tx.onerror = () => rej(tx.error)
    })
  } catch {
    /* ignore */
  }
  const removed = imageStore[key]
  delete imageStore[key]
  invalidateWorks()
  listeners.forEach((l) => l())
  removeCloudLinked(key, removed).then(() => {
    if (token) queueSync(200)
  })
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

// ============================================================
// 云端同步层（GitHub 仓库数据文件直写）：管理后台修改自动同步到所有设备
// 数据文件：docs/data/portfolio-data.json（公开可读）；图片：docs/data/imgs/
// 写入令牌只存在用户浏览器 localStorage，网站代码不含令牌（访客只读，无法写入）
// ============================================================
const CLOUD_REPO = 'fengrong888/Portfolio'
const CLOUD_FILE = 'docs/data/portfolio-data.json'
const CLOUD_IMGS_DIR = 'docs/data/imgs/'
const TOKEN_KEY = 'pf-github-token'

let token = ''
try {
  token = localStorage.getItem(TOKEN_KEY) || ''
} catch {
  token = ''
}
let cloudEdits = {}
let cloudImages = {}
let cloudLoaded = false
let syncing = false
let syncError = ''
let lastSyncAt = 0
let syncTimer = 0
const cloudListeners = new Set()

export const getCloudToken = () => token
export function setCloudToken(t) {
  token = (t || '').trim()
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
  notifyCloud()
}
export function subscribeCloud(fn) {
  cloudListeners.add(fn)
  return () => cloudListeners.delete(fn)
}
let cloudStatusCache = null
export function getCloudStatus() {
  const s = {
    configured: !!token,
    syncing,
    error: syncError,
    lastSync: lastSyncAt,
    loaded: cloudLoaded,
    cloudEditCount: Object.keys(cloudEdits).length,
  }
  // 快照必须保持引用稳定（useSyncExternalStore 依赖 Object.is），否则触发无限渲染
  if (!cloudStatusCache || JSON.stringify(s) !== JSON.stringify(cloudStatusCache)) {
    cloudStatusCache = s
  }
  return cloudStatusCache
}
export function useCloudStatus() {
  return useSyncExternalStore(subscribeCloud, getCloudStatus)
}
function notifyCloud() {
  cloudListeners.forEach((l) => l())
}

function cloudURL(path) {
  return `https://api.github.com/repos/${CLOUD_REPO}/contents/${path}`
}
async function ghFetch(path, init) {
  const res = await fetch(cloudURL(path), {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  })
  return res
}

// 读取云端数据文件（站内公开 fetch，无需令牌）：与本地编辑合并后生效
export async function loadCloud() {
  try {
    const res = await fetch('./data/portfolio-data.json', { cache: 'no-store' })
    if (!res.ok) throw new Error(`cloud file ${res.status}`)
    const data = await res.json()
    cloudEdits = data.edits && typeof data.edits === 'object' ? data.edits : {}
    cloudImages = data.images && typeof data.images === 'object' ? data.images : {}
    cloudLoaded = true
    mergeAndNotify()
  } catch {
    cloudLoaded = false
    // 云端不可达时仍以本地为准（离线兜底）
  }
  notifyCloud()
}

// 合并规则：本地 edits 覆盖云端 edits（本地含最新未同步操作）
function mergeAndNotify() {
  edits = { ...cloudEdits, ...localEditsRaw() }
  invalidateWorks()
  listeners.forEach((l) => l())
}
function localEditsRaw() {
  let local = {}
  try {
    local = JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    local = {}
  }
  return local
}
function persistLocal(v) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

// 触发云端同步（防抖）：文本、排序、删除、图片变化后自动调用
function queueSync(delay = 600) {
  if (!token) return
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncNow()
  }, delay)
}

// 把当前生效数据写入云端 JSON（合并本地 + 既有云端）
export async function syncNow() {
  if (!token) return { ok: false, error: 'no-token' }
  if (syncing) return { ok: false, error: 'busy' }
  syncing = true
  syncError = ''
  notifyCloud()
  try {
    const merged = { ...cloudEdits, ...localEditsRaw() }
    // 云端图片路径映射（不含本地未同步的 dataURL）
    const imgs = { ...cloudImages }
    await ghPutJson(merged, imgs)
    cloudEdits = merged
    cloudImages = imgs
    lastSyncAt = Date.now()
    notifyCloud()
    return { ok: true }
  } catch (e) {
    syncError = e?.message || '同步失败'
    notifyCloud()
    return { ok: false, error: syncError }
  } finally {
    syncing = false
    notifyCloud()
  }
}

// PUT 云端 JSON（带 sha 乐观锁；409 冲突时重拉最新合并后重试一次）
async function ghPutJson(merged, imgs, retried = false) {
  const body = JSON.stringify({ version: 1, edits: merged, images: imgs })
  const b64 = btoa(unescape(encodeURIComponent(body)))
  let sha = null
  try {
    const cur = await ghFetch(CLOUD_FILE)
    if (cur.ok) {
      const j = await cur.json()
      sha = j.sha
      // 以云端最新为基底，重新叠加本地，避免覆盖他人/其他设备刚同步的修改
      const latest = JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g, '')))))
      if (latest && latest.edits) {
        merged = { ...latest.edits, ...localEditsRaw() }
        imgs = { ...(latest.images || {}), ...imgs }
      }
    }
  } catch {
    /* 首次推送文件可能不存在 */
  }
  const res = await ghFetch(CLOUD_FILE, {
    method: 'PUT',
    body: JSON.stringify({
      message: `sync portfolio data ${new Date().toISOString().slice(0, 16)}`,
      content: b64,
      ...(sha ? { sha } : {}),
    }),
  })
  if (res.status === 409 && !retried) {
    return ghPutJson(merged, imgs, true)
  }
  if (!res.ok) {
    throw new Error(`PUT ${res.status} ${(await res.text()).slice(0, 120)}`)
  }
  return res
}

// 上传单张图片到云端 imgs/ 目录，返回相对路径
async function ghPutImage(dataUrl, name) {
  const m = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!m) throw new Error('bad dataURL')
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
  const path = `${CLOUD_IMGS_DIR}${name}.${ext}`
  const res = await ghFetch(path, {
    method: 'PUT',
    body: JSON.stringify({
      message: `upload img ${name}`,
      content: m[2],
    }),
  })
  if (!res.ok) throw new Error(`IMG PUT ${res.status}`)
  return `./${path}`
}
// 删除云端图片文件
async function ghDeleteImage(relPath) {
  const path = relPath.replace(/^\.\//, '')
  if (!path.startsWith(CLOUD_IMGS_DIR)) return
  const cur = await ghFetch(path)
  if (!cur.ok) return
  const j = await cur.json()
  const res = await ghFetch(path, {
    method: 'DELETE',
    body: JSON.stringify({ message: `remove img ${path}`, sha: j.sha }),
  })
  if (!res.ok) throw new Error(`IMG DEL ${res.status}`)
}

// 图片上传后的云端同步：dataURL -> 上传 -> 就地替换为路径
async function syncImageToCloud(key, value) {
  if (!token) return value
  if (typeof value === 'string' && value.startsWith('data:image/')) {
    const name = `${key}-${Date.now().toString(36)}`
    const p = await ghPutImage(value, name)
    // 记录映射并推送 JSON（映射更新后随下次 syncNow 一并写入）
    cloudImages[key] = p
    imageStore[key] = p // 本机立即以云端路径显示
    try {
      const db = await openImgDB()
      await new Promise((res, rej) => {
        const tx = db.transaction('imgs', 'readwrite')
        tx.objectStore('imgs').put(p, key)
        tx.oncomplete = res
        tx.onerror = () => rej(tx.error)
      })
    } catch {
      /* ignore */
    }
    return p
  }
  if (typeof value === 'string') {
    try {
      const arr = JSON.parse(value)
      if (Array.isArray(arr)) {
        const out = []
        for (let i = 0; i < arr.length; i++) {
          const it = arr[i]
          if (typeof it === 'string' && it.startsWith('data:image/')) {
            const name = `${key}-${i}-${Date.now().toString(36)}`
            const p = await ghPutImage(it, name)
            out.push(p)
          } else out.push(it)
        }
        const next = JSON.stringify(out)
        cloudImages[key] = out
        imageStore[key] = next
        try {
          const db = await openImgDB()
          await new Promise((res, rej) => {
            const tx = db.transaction('imgs', 'readwrite')
            tx.objectStore('imgs').put(next, key)
            tx.oncomplete = res
            tx.onerror = () => rej(tx.error)
          })
        } catch {
          /* ignore */
        }
        return next
      }
    } catch {
      /* ignore */
    }
  }
  return value
}

// 迁移：把本机 IndexedDB 里的历史图片全部推送到云端（一次操作后全端可见）
export async function migrateCloudImages(onProgress) {
  if (!token) return { ok: false, error: 'no-token' }
  const keys = Object.keys(imageStore).filter((k) => {
    const v = imageStore[k]
    return typeof v === 'string' && v.startsWith('data:image/')
  })
  // shots 数组里也可能有 dataURL
  const shotKeys = Object.keys(imageStore).filter((k) => {
    const v = imageStore[k]
    if (typeof v !== 'string' || v.startsWith('data:image/')) return false
    try {
      const arr = JSON.parse(v)
      return Array.isArray(arr) && arr.some((x) => typeof x === 'string' && x.startsWith('data:image/'))
    } catch {
      return false
    }
  })
  const total = keys.length + shotKeys.length
  if (total === 0) return { ok: true, migrated: 0 }
  let done = 0
  for (const k of keys) {
    try {
      const p = await syncImageToCloud(k, imageStore[k])
      done += 1
      onProgress?.(done, total)
    } catch {
      /* 单张失败继续其余 */
    }
  }
  for (const k of shotKeys) {
    try {
      const next = await syncImageToCloud(k, imageStore[k])
      done += 1
      onProgress?.(done, total)
    } catch {
      /* ignore */
    }
  }
  queueSync(200)
  return { ok: true, migrated: done }
}

// 图片删除的云端联动：若该项已是云端路径，删除文件并更新映射
async function removeCloudLinked(key, value) {
  if (!token) return
  if (typeof value === 'string' && value.startsWith('./')) {
    try {
      await ghDeleteImage(value)
    } catch {
      /* ignore */
    }
    delete cloudImages[key]
  }
  if (typeof value === 'string') {
    try {
      const arr = JSON.parse(value)
      if (Array.isArray(arr)) {
        const paths = arr.filter((x) => typeof x === 'string' && x.startsWith('./'))
        for (const p of paths) {
          try {
            await ghDeleteImage(p)
          } catch {
            /* ignore */
          }
        }
        delete cloudImages[key]
      }
    } catch {
      /* ignore */
    }
  }
}
