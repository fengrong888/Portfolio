import { useSyncExternalStore } from 'react'
import { ADMIN_API_URL } from './adminConfig'

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

// 「完成才生效」冻结机制：进入后台时冻结前台读取的数据快照，
// 后台所有操作（文字/图片/排序/增删）先落在实时存储里，前台组件仍读冻结快照；
// 点「完成」释放冻结，前台一次性刷新为最新内容。
let frozenEdits = null
let frozenImages = null

export const getEdits = () => edits
export const isEditing = () => editing
const activeEdits = () => (editing && frozenEdits ? frozenEdits : edits)
const activeImages = () => (editing && frozenImages ? frozenImages : imageStore)

export function bumpRev() {
  rev += 1
}
export function useEditsRev() {
  return useSyncExternalStore(subscribeEdits, () => rev)
}
export function setEditing(v) {
  editing = v
  if (v) {
    frozenEdits = edits
    frozenImages = { ...imageStore }
  } else {
    frozenEdits = null
    frozenImages = null
    // 退出编辑：失效作品缓存，前台立即按实时数据重建（点「完成」后新增/改动即刻生效）
    invalidateWorks()
  }
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
  if (!editing) queueSync() // 后台编辑中不推送云端，点「完成」时统一同步
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
    const v = activeEdits()[k]
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

// 新增作品占位封面：纯深色底，无文字（避免加载过程闪现 NEW 字样，部署时由真实图片替换）
export const NEW_WORK_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="#1b1916"/></svg>`
  )

// 构建「基础作品 + 本地新增作品」的完整列表（编辑覆盖 title/cat/en）
// 结果缓存：仅当编辑数据变化时重建，保证 useSyncExternalStore 快照引用稳定
let worksCache = null
// 按年份排序的固定顺序（最新在上、最老在下）：2026→2025→2024→2023→2022→2021→2020
// v3：加入新作品 23（2021），修正手机端首次访问顺序
const FIXED_ORDER = [23, 9, 17, 1, 15, 19, 2, 3, 6, 13, 16, 18, 4, 5, 7, 8, 10, 14, 20, 12, 11]
const ORDER_VERSION = 3
// 图片路径规整：
// - 历史错误路径带 docs/ 前缀（线上 404）→ 转为部署根相对路径
// - 内置作品图 ./works/ 已由 JPG 批量转为 WebP，历史引用仍指向 .jpg → 统一转 .webp
// - ./data/imgs/ 下的用户上传图保留原格式
export function normalizeImgPath(v) {
  if (typeof v !== 'string') return v
  let s = v.replace(/^\.\/docs\/data\/imgs\//, './data/imgs/')
  s = s.replace(/^\.\/works\/(.+?)\.jpg$/, './works/$1.webp')
  return s
}
function normalizeImgList(arr) {
  if (!Array.isArray(arr)) return arr
  return arr.map(normalizeImgPath)
}
// 详情图数据防御性解析：兼容 JSON 数组字符串 / 真正的数组 / 单张路径字符串
// （历史数据或异常上传可能把单张路径直接存进 shots 键，JSON.parse 会崩 → 整页黑屏）
function parseShots(v) {
  if (Array.isArray(v)) return normalizeImgList(v)
  if (typeof v === 'string') {
    const t = v.trim()
    if (t.startsWith('[')) {
      try {
        const arr = JSON.parse(t)
        return Array.isArray(arr) ? normalizeImgList(arr) : normalizeImgList([v])
      } catch {
        /* 不是合法 JSON，按单张路径处理 */
      }
    }
    if (t) return normalizeImgList([t])
  }
  return []
}
function resolveOrder(S) {
  try {
    let v = 0
    try {
      v = Number(localStorage.getItem('portfolio-order-version') || 0)
    } catch { /* ignore */ }
    if (v < ORDER_VERSION) {
      // 新版本首次生效：优先采用云端已同步的排序（含最新上传作品），
      // 云端无排序时用按年份的固定顺序兜底；同时写入版本标记避免反复重算
      let order = null
      try {
        order = JSON.parse(S['work-order'] || 'null')
      } catch { /* ignore */ }
      const use = Array.isArray(order) && order.length ? order : FIXED_ORDER
      try {
        localStorage.setItem('portfolio-order-version', String(ORDER_VERSION))
        const raw = localStorage.getItem(KEY) || '{}'
        const cur = JSON.parse(raw)
        cur['work-order'] = JSON.stringify(use)
        localStorage.setItem(KEY, JSON.stringify(cur))
        edits = { ...edits, 'work-order': JSON.stringify(use) }
      } catch { /* ignore */ }
      return use
    }
    return JSON.parse(S['work-order'] || 'null')
  } catch {
    return null
  }
}
function computeWorks(live = false) {
  const S = live ? edits : activeEdits()
  const IMG = live ? imageStore : activeImages()
  // 云端图片映射也作为封面/详情图的兜底来源：
  // 非上传设备本机 imageStore 为空，但云端已同步的封面/详情图仍应正常显示
  const imgFor = (k) => (live ? imageStore[k] || cloudImages[k] : activeImages()[k] || cloudImages[k])
  const ids = new Set(baseWorks.map((w) => w.id))
  Object.keys(S).forEach((k) => {
    const m = k.match(/^work-(\d+)-(title|cat|en)$/)
    if (m && S[`work-${m[1]}-deleted`] !== '1') ids.add(Number(m[1]))
  })
  let order = resolveOrder(S)
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
      if (S[`work-${id}-deleted`] === '1') return null
      const base = baseWorks.find((w) => w.id === id)
      if (base) {
        const upShots = imgFor(`work-${id}-shots`)
        return {
          ...base,
          title: S[`work-${id}-title`] ?? base.title,
          cat: S[`work-${id}-cat`] ?? base.cat,
          en: S[`work-${id}-en`] ?? base.en,
          year: S[`work-${id}-year`] ?? base.year,
          dcat: S[`work-${id}-dcat`] ?? S[`work-${id}-cat`] ?? base.cat,
          dtitle: S[`work-${id}-dtitle`] ?? S[`work-${id}-title`] ?? base.title,
          img: normalizeImgPath(imgFor(`work-${id}-img`) || base.img),
          shots: upShots ? parseShots(upShots) : normalizeImgList(base.shots),
        }
      }
      // 新增作品（尚未提供图片，使用占位封面）
      const nShots = imgFor(`work-${id}-shots`)
      return {
        id,
        title: S[`work-${id}-title`] || `新作品 ${id}`,
        cat: S[`work-${id}-cat`] || '设计项目',
        en: S[`work-${id}-en`] || 'New Project',
        year: S[`work-${id}-year`] || '2025',
        dcat: S[`work-${id}-dcat`] ?? S[`work-${id}-cat`] ?? '设计项目',
        dtitle: S[`work-${id}-dtitle`] ?? S[`work-${id}-title`] ?? `新作品 ${id}`,
        ratio: '3 / 4',
        img: normalizeImgPath(imgFor(`work-${id}-img`) || NEW_WORK_PLACEHOLDER),
        hover: '#C6CE3B',
        shots: nShots ? parseShots(nShots) : [],
        tags: [],
        desc: '',
        _new: true,
      }
    })
    .filter(Boolean)
}
export function buildWorks() {
  if (!worksCache) worksCache = computeWorks(false)
  return worksCache
}
// 后台面板实时列表（读取实时存储，不受「完成才生效」冻结影响）
// 快照必须引用稳定：带缓存，配合 invalidateWorks 在编辑数据变化时失效
let liveCache = null
export function computeLiveWorks() {
  if (!liveCache) liveCache = computeWorks(true)
  return liveCache
}
function invalidateWorks() {
  worksCache = null
  liveCache = null
}

// 作品排序：拖拽调整后写入 work-order（JSON 数组），部署时按此固化
export function setWorkOrder(ids) {
  applyEdit('work-order', JSON.stringify(ids))
  // 排序（拖拽/新增作品排前）属于明确操作，自动同步云端，无需手动导出
  queueSync(500)
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
    year: w.year ?? '',
    dcat: w.dcat ?? '',
    dtitle: w.dtitle ?? '',
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

// ---------- 权限：后台入口（workerMode=服务端密码校验；未配置时仅防误入） ----------
// 密码只存在于 Cloudflare Worker Secret（ADMIN_PASSWORD），前端源码不再保存任何明文密码。
let authorized = false
try {
  authorized = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('portfolio-admin-ok') === '1'
} catch {
  authorized = false
}
export const isAuthorized = () => authorized
const SESSION_KEY = 'pf-admin-session'
export const getAdminSession = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY) || ''
  } catch {
    return ''
  }
}
function setAdminSession(s) {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, s)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}
// 会话失效/登出：清除本地授权与会话（下次 Shift+E 需重新输密码）
export function clearAdminAuth() {
  authorized = false
  setAdminSession('')
  try {
    sessionStorage.removeItem('portfolio-admin-ok')
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}
// 打开后台的验证：workerMode 下把密码发给 Worker /api/auth 由服务端比对；
// 未配置 Worker（旧 PAT 过渡期）不校验密码，仅由 EditBar 的确认框防误入。
// 返回：true=通过；'not-enabled'=服务端未启用密码登录；false=密码错误/网络失败。
export async function checkPassword(pw) {
  if (isAdminWorkerConfigured()) {
    try {
      const r = await fetch(`${ADMIN_API_URL.replace(/\/+$/, '')}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      if (r.ok) {
        const j = await r.json().catch(() => ({}))
        if (j && typeof j.session === 'string' && j.session) setAdminSession(j.session)
        authorized = true
        try {
          sessionStorage.setItem('portfolio-admin-ok', '1')
        } catch {
          /* ignore */
        }
        listeners.forEach((l) => l())
        return true
      }
      if (r.status === 503) return 'not-enabled'
      return false
    } catch {
      return false
    }
  }
  // 未配置 Worker：直接授权（前端无明文密码可验，安全边界由云端 API 承担）
  authorized = true
  try {
    sessionStorage.setItem('portfolio-admin-ok', '1')
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
  return true
}
export function useAuthorized() {
  return useSyncExternalStore(subscribeEdits, isAuthorized)
}

// ---------- 删除作品（标记 deleted，云端同步后全设备永久移除） ----------
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
  // 云端同步：dataURL 上传为仓库路径后全端可见（失败时保持本地，下次再试）；
  // 后台编辑中不推云端，点「完成」时由 migrateCloudImages 统一推送
  if ((token || ADMIN_API_URL) && !editing) {
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
// 详情图拖拽调换顺序：把 from 处的图移动到 to 处
export async function moveShot(id, currentShots, from, to) {
  if (from === to || from < 0 || to < 0 || from >= currentShots.length || to >= currentShots.length) return
  const next = [...currentShots]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  await putImage(`work-${id}-shots`, JSON.stringify(next))
}

export async function removeImage(key) {
  // 先取出旧值再删除（历史 bug：先 delete 再取值会拿到 undefined，云端镜像永远删不掉）
  const removed = imageStore[key]
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
  delete imageStore[key]
  // 同步删除云端镜像键：避免 computeWorks 从 cloudImages 兜底导致界面不刷新。
  // 兼容三种存储格式：单路径字符串 / JSON 字符串数组 / 原生数组。
  const rmCloud = () => {
    delete cloudImages[key]
  }
  if (typeof removed === 'string' && removed.startsWith('./')) {
    rmCloud()
    if (token || ADMIN_API_URL) ghDeleteImage(removed).catch(() => {})
  } else if (typeof removed === 'string') {
    try {
      const arr = JSON.parse(removed)
      if (Array.isArray(arr)) {
        rmCloud()
        if (token || ADMIN_API_URL) {
          arr
            .filter((x) => typeof x === 'string' && x.startsWith('./'))
            .forEach((p) => ghDeleteImage(p).catch(() => {}))
        }
      }
    } catch {
      /* ignore */
    }
  } else if (Array.isArray(removed)) {
    rmCloud()
    if (token || ADMIN_API_URL) {
      removed
        .filter((x) => typeof x === 'string' && x.startsWith('./'))
        .forEach((p) => ghDeleteImage(p).catch(() => {}))
    }
  }
  invalidateWorks()
  listeners.forEach((l) => l())
  if ((token || ADMIN_API_URL) && !editing) queueSync(200)
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
        // 输出 WebP（体积约为 JPEG 的 1/3，全端支持），失败时回退 JPEG
        try {
          let out = c.toDataURL('image/webp', quality)
          // 压缩后仍过大（极端复杂原图）：逐级降质量，保证单图 ≤ 1.5MB
          if (out.length > 1572864) out = c.toDataURL('image/webp', Math.max(0.45, quality - 0.2))
          if (out.length > 1572864) out = c.toDataURL('image/webp', 0.45)
          if (out.startsWith('data:image/webp')) return resolve(out)
        } catch { /* fallthrough */ }
        let jout = c.toDataURL('image/jpeg', quality)
        if (jout.length > 1572864) jout = c.toDataURL('image/jpeg', Math.max(0.5, quality - 0.25))
        resolve(jout)
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
  // Once the protected Worker is configured, remove the old browser-held PAT from this device.
  if (ADMIN_API_URL) {
    token = ''
    localStorage.removeItem(TOKEN_KEY)
  }
} catch {
  token = ''
}
let cloudEdits = {}
let cloudImages = {}
let cloudLoaded = false
let tokenExpired = false
let syncing = false
let syncError = ''
let lastSyncAt = 0
let syncTimer = 0
const cloudListeners = new Set()

export const getCloudToken = () => (ADMIN_API_URL ? '' : token)
export function isAdminWorkerConfigured() {
  return !!ADMIN_API_URL
}
export function setCloudToken(t) {
  if (ADMIN_API_URL) {
    token = ''
    try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
    tokenExpired = false
    notifyCloud()
    return
  }
  token = (t || '').trim()
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
  tokenExpired = false
  notifyCloud()
}

// 令牌失效自动检测：GitHub 接口返回 401/403 即标记过期（写入、读取任何环节都会触发）
function markTokenExpired() {
  if (!tokenExpired) {
    tokenExpired = true
    notifyCloud()
  }
}

// 主动校验令牌有效性（后台打开时调用）：GET /user，401/403 = 过期
export async function checkTokenValidity() {
  if (ADMIN_API_URL) {
    try {
      const session = getAdminSession()
      const res = await fetchTimeout(
        adminApiURL(CLOUD_FILE),
        {
          credentials: 'include',
          headers: { Accept: 'application/vnd.github+json', ...(session ? { 'X-Admin-Session': session } : {}) },
        },
        8000
      )
      if (res.ok) {
        syncError = ''
        tokenExpired = false
        notifyCloud()
        return { ok: true, expired: false }
      }
      if (res.status === 401 || res.status === 403) {
        syncError = '后台登录已过期，请重新登录（Shift+E 输入后台密码）'
        tokenExpired = false
        notifyCloud()
        window.dispatchEvent(new CustomEvent('admin-auth-expired'))
        return { ok: false, expired: false }
      }
      syncError = `云端连接失败：HTTP ${res.status}`
      tokenExpired = false
      notifyCloud()
      return { ok: false, expired: false }
    } catch {
      syncError = '无法连接安全后台接口，请检查网络'
      tokenExpired = false
      notifyCloud()
      return { ok: false, expired: false }
    }
  }
  if (!token) {
    tokenExpired = false
    notifyCloud()
    return { ok: false, expired: false }
  }
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    })
    const expired = res.status === 401 || res.status === 403
    if (tokenExpired !== expired) {
      tokenExpired = expired
      notifyCloud()
    }
    return { ok: res.ok, expired }
  } catch {
    /* 网络异常不算过期，保持原状态 */
    return { ok: false, expired: tokenExpired }
  }
}
export function subscribeCloud(fn) {
  cloudListeners.add(fn)
  return () => cloudListeners.delete(fn)
}
let cloudStatusCache = null
export function getCloudStatus() {
  const s = {
    configured: !!token || !!ADMIN_API_URL,
    syncing,
    error: syncError,
    lastSync: lastSyncAt,
    loaded: cloudLoaded,
    expired: tokenExpired,
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
function adminApiURL(path) {
  const url = new URL(`${ADMIN_API_URL.replace(/\/+$/, '')}/api/contents`)
  url.searchParams.set('path', path)
  return url.toString()
}
async function ghFetch(path, init) {
  const workerMode = !!ADMIN_API_URL
  const session = workerMode ? getAdminSession() : ''
  const res = await fetchTimeout(workerMode ? adminApiURL(path) : cloudURL(path), {
    ...init,
    ...(workerMode ? { credentials: 'include' } : {}),
    headers: {
      Accept: 'application/vnd.github+json',
      ...(!workerMode && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(workerMode && session ? { 'X-Admin-Session': session } : {}),
      ...(init?.headers || {}),
    },
  }, 8000)
  // Legacy mode checks PAT validity; Worker mode reports Access/session errors without prompting for a browser PAT.
  if (res.status === 401 || res.status === 403) {
    if (workerMode) {
      syncError = '后台身份验证失败，请重新登录（Cloudflare Access 或后台密码）'
      notifyCloud()
      window.dispatchEvent(new CustomEvent('admin-auth-expired'))
    } else markTokenExpired()
  }
  return res
}

// 带超时的 fetch：GitHub 接口在国内网络经常长时间挂起，必须快速失败落到兜底数据
async function fetchTimeout(url, options = {}, ms = 7000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

// jsDelivr 国内 CDN 加速：把站内相对图片路径转为 CDN URL（GitHub Pages 原站作为自动回退）
export function jsdelivrUrl(rel) {
  if (typeof rel !== 'string' || !rel) return rel
  if (rel.startsWith('data:') || rel.startsWith('http')) return rel
  let p = rel.replace(/^\.\//, '')
  if (p.startsWith('data/imgs/') || p.startsWith('works/')) p = 'docs/' + p
  return `https://cdn.jsdelivr.net/gh/${CLOUD_REPO}@main/${p}`
}

// ---- CDN 智能熔断 ----
// 部分网络（如某些国内运营商）下 jsDelivr 请求会「挂起不返回」：不报错也不出图，
// 浏览器加载圈会一直转，图片长时间不显示。旧逻辑「CDN 挂起→回原站→失败→再回 CDN」
// 可能形成循环。这里做熔断：连续 2 次观察到挂起即判定本网络 CDN 不可用，
// 之后（30 分钟窗口内）所有图片与数据直连 GitHub 原站，不再发起 CDN 请求。
let cdnHangs = 0
const CDN_BAD_KEY = 'pf-cdn-bad'
const CDN_BAD_WINDOW = 30 * 60 * 1000 // 30 分钟
export function markCdnHang() {
  cdnHangs += 1
  if (cdnHangs >= 2) {
    try {
      localStorage.setItem(CDN_BAD_KEY, String(Date.now()))
    } catch { /* ignore */ }
  }
}
export function isCdnBad() {
  try {
    const t = Number(localStorage.getItem(CDN_BAD_KEY) || 0)
    return t > 0 && Date.now() - t < CDN_BAD_WINDOW
  } catch {
    return false
  }
}

// 竞速取第一个成功的结果（兼容 es2018，不使用 Promise.any）
function firstOk(ps) {
  return new Promise((resolve, reject) => {
    let pending = ps.length
    let done = false
    ps.forEach((p) =>
      p.then(
        (v) => {
          if (!done) {
            done = true
            resolve(v)
          }
        },
        () => {
          if (--pending === 0 && !done) {
            done = true
            reject(new Error('all sources failed'))
          }
        }
      )
    )
  })
}

// 读取云端数据：多个数据源「并行竞速」，谁先成功用谁（不再串行干等超时）：
// 1) jsDelivr 国内 CDN —— 国内最快，优先命中
// 2) 站内数据文件（GitHub Pages）—— 仓库内最新，天然兜底
// 3) raw.githubusercontent.com —— 最后一层兜底
// 全部失败时回到本地缓存继续显示。带令牌的 GitHub API 仅用于后台同步（syncNow），
// 读取环节不依赖它——避免国内网络不可达时白白等待 7~13 秒。
export async function loadCloud() {
  let data = null
  const ts = Date.now()
  const mk = (url, ms) =>
    fetchTimeout(url, { cache: 'no-store' }, ms).then(async (r) => {
      if (!r.ok) throw new Error(`source ${r.status}`)
      return r.json()
    })
  const sources = []
  // jsDelivr CDN（国内节点，带时间戳防缓存；CLOUD_FILE 已含 docs/ 前缀，不可重复拼 docs/）
  // 熔断期内跳过 CDN，避免每次刷新都白等一个挂起请求
  if (!isCdnBad()) sources.push(mk(`https://cdn.jsdelivr.net/gh/${CLOUD_REPO}@main/${CLOUD_FILE}?t=${ts}`, 3500))
  // 站内数据文件（部署根相对路径）
  sources.push(mk(`./data/portfolio-data.json?t=${ts}`, 5000))
  // raw 源兜底
  sources.push(mk(`https://raw.githubusercontent.com/${CLOUD_REPO}/main/${CLOUD_FILE}?t=${ts}`, 5000))
  try {
    data = await firstOk(sources)
  } catch {
    cloudLoaded = false
    notifyCloud()
    return
  }
  cloudEdits = data.edits && typeof data.edits === 'object' ? data.edits : {}
  cloudImages = data.images && typeof data.images === 'object' ? data.images : {}
  // 兼容历史数据：旧上传路径带 docs/ 前缀，线上访问 404，统一规整为部署根相对路径
  const norm = (v) => {
    if (typeof v === 'string') return v.replace(/^\.\/docs\/data\/imgs\//, './data/imgs/')
    if (Array.isArray(v)) return v.map(norm)
    return v
  }
  for (const k of Object.keys(cloudImages)) cloudImages[k] = norm(cloudImages[k])
  cloudLoaded = true
  mergeAndNotify()
  notifyCloud()
}

// 合并规则：非编辑状态下「云端 = 全设备权威」——所有设备看到的内容与云端完全一致。
// 本地历史残留（旧文字/旧排序）一律以云端为准，避免旧设备本地数据覆盖其他设备刚同步的最新内容。
// 仅后台编辑中（editing=true）叠加本机草稿用于继续编辑；点「完成」后统一同步回云端。
// 排序（work-order）无论何时都以云端为准（云端=最近一次同步的权威顺序）。
function mergeAndNotify() {
  edits = { ...cloudEdits }
  if (editing) {
    edits = { ...edits, ...localEditsRaw() }
  }
  if (cloudEdits && typeof cloudEdits['work-order'] === 'string') {
    edits['work-order'] = cloudEdits['work-order']
  }
  if (!editing) persistLocal(edits)
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
  if (!token && !ADMIN_API_URL) return
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncNow()
  }, delay)
}

// 把当前生效数据写入云端 JSON（合并本地 + 既有云端）
export async function syncNow() {
  const first = await doSyncNow()
  // 网络瞬断/限流/冲突等偶发失败：短暂等待后自动重试一次，降低丢数据风险
  if (!first.ok && first.error && first.error !== 'no-token' && first.error !== 'busy') {
    await new Promise((r) => setTimeout(r, 800))
    return doSyncNow()
  }
  return first
}

async function doSyncNow() {
  if (!token && !ADMIN_API_URL) return { ok: false, error: 'no-token' }
  if (syncing) return { ok: false, error: 'busy' }
  syncing = true
  syncError = ''
  notifyCloud()
  try {
    const merged = { ...cloudEdits, ...localEditsRaw() }
    // 云端图片路径映射（不含本地未同步的 dataURL）
    const imgs = { ...cloudImages }
    // 补回本机已上传为云端路径的图片：刷新后内存 cloudImages 可能丢失映射，
    // 但 imageStore 里仍存着 ./data/imgs/ 云端路径，从这里取回一并写入，避免图片引用断链
    for (const [k, v] of Object.entries(imageStore)) {
      if (typeof v === 'string' && v.startsWith('./data/imgs/')) {
        imgs[k] = v
      } else if (typeof v === 'string' && v.startsWith('[')) {
        try {
          const arr = JSON.parse(v)
          if (Array.isArray(arr) && arr.some((x) => typeof x === 'string' && x.startsWith('./data/imgs/'))) {
            imgs[k] = arr
          }
        } catch { /* ignore */ }
      }
    }
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
  // GitHub Pages 部署根为 docs/，线上访问需去掉 docs/ 前缀
  return `./data/imgs/${name}.${ext}`
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
  if (!token && !ADMIN_API_URL) return value
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
  if (!token && !ADMIN_API_URL) return { ok: false, error: 'no-token' }
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
  // 小并发池并行上传，避免大量图片串行导致「完成/关闭」卡顿
  const runPool = async (arr, worker) => {
    let i = 0
    const next = async () => {
      while (i < arr.length) {
        const k = arr[i++]
        try {
          await worker(k)
          done += 1
          onProgress?.(done, total)
        } catch { /* 单张失败继续其余 */ }
      }
    }
    await Promise.all([next(), next(), next()])
  }
  await runPool(keys, async (k) => {
    await syncImageToCloud(k, imageStore[k])
  })
  await runPool(shotKeys, async (k) => {
    await syncImageToCloud(k, imageStore[k])
  })
  queueSync(200)
  return { ok: true, migrated: done }
}

// 图片删除的云端联动：若该项已是云端路径，删除文件并更新映射
async function removeCloudLinked(key, value) {
  if (!token && !ADMIN_API_URL) return
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

// 确定性色相微调表：按作品编号取档，让相邻作品的悬停纯色色相拉开（尽量不重复）。
// 16 档、相邻档色相差 ≥28°（±60° 内）：暖色系作品也能分散到红/橙/黄/玫红等不同区间，
// 避免一排卡片悬停时全是相近的米黄/粉棕。
const HUE_BANDS = [
  0, 28, -32, 44, -16, 36, -44, 20, -24, 48, -8, 32, -48, 16, -36, 40
]
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (mx + mn) / 2
  if (mx !== mn) {
    const d = mx - mn
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
    switch (mx) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h *= 60
  }
  return [h, s, l]
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ]
}
// 把提取出的主色加工成「鲜艳、可读、有区分度」的悬停纯色：
// 1) 饱和度下限提到 0.66（解决之前发白发灰、饱和度低的问题）
// 2) 亮度收敛到 0.70~0.76（保证白字可读，又不过度发白）
// 3) 按作品编号做色相微调，相邻作品尽量不同色
function vibrantFromRGB(r, g, b, id) {
  const [h0, s0, l0] = rgbToHsl(r, g, b)
  const band = HUE_BANDS[Math.abs(Number(id) || 0) % HUE_BANDS.length]
  const h = (h0 + band + 360) % 360
  const s = Math.max(s0, 0.66)
  const l = Math.min(Math.max(l0, 0.7), 0.76)
  const [rr, gg, bb] = hslToRgb(h, s, l)
  return `rgb(${rr},${gg},${bb})`
}

// 从图片提取主色调（过滤近黑/近白/透明，取平均色后加工成鲜艳可读的悬停纯色）
export function extractDominantColor(src, id) {
  return new Promise((resolve) => {
    if (!src || typeof src !== 'string') { resolve(null); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = c.height = 24
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, 24, 24)
        const { data } = ctx.getImageData(0, 0, 24, 24)
        let r = 0, g = 0, b = 0, n = 0
        for (let i = 0; i < data.length; i += 4) {
          const R = data[i], G = data[i + 1], B = data[i + 2], A = data[i + 3]
          if (A < 128) continue
          const mx = Math.max(R, G, B), mn = Math.min(R, G, B)
          if (mx < 40) continue
          if (mn > 215) continue
          r += R; g += G; b += B; n++
        }
        if (!n) { resolve(null); return }
        resolve(vibrantFromRGB(Math.round(r / n), Math.round(g / n), Math.round(b / n), id))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}
