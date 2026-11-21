/* NCL content API + admin.
 *
 * Zero dependencies on purpose: Node 22 gives everything needed (http, fs, crypto,
 * streams), so a deploy is "copy two files and start a systemd unit" -- no npm install
 * on the server, nothing to re-audit on update.
 *
 *   GET  /api/site                     public content bundle (ETag, short cache)
 *   POST /api/auth/login               { email, password } -> session cookie
 *   POST /api/auth/logout
 *   GET  /api/auth/me
 *   GET  /api/admin/content            same shape as /api/site, from the writable store
 *   PUT  /api/admin/cover
 *   POST /api/admin/projects | PUT /api/admin/projects/:id | DELETE ...
 *   POST /api/admin/groups   | ...    same for groups / products / patents
 *   PUT  /api/admin/order              { kind, ids: [...] }
 *   PUT  /api/admin/upload?name=...    raw body upload (image/*, video/*)
 *   DELETE /api/admin/file?url=...     remove an uploaded file
 *   POST /api/admin/password           { current, next }
 *
 * Storage is one JSON document plus an uploads folder, both under NCL_DATA. Every write
 * is atomic (tmp + rename) and keeps a timestamped backup.
 */
'use strict'

const http = require('node:http')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const PORT = Number(process.env.NCL_PORT || 8787)
const HOST = process.env.NCL_HOST || '127.0.0.1'
const DATA = process.env.NCL_DATA || '/var/www/ncl-data'
const ADMIN_DIR = process.env.NCL_ADMIN || path.join(__dirname, 'admin')
const SITE_DIR = process.env.NCL_SITE || '/var/www/ncl/current'

const CONTENT = path.join(DATA, 'content.json')
const USERS = path.join(DATA, 'users.json')
const UPLOADS = path.join(DATA, 'uploads')
const BACKUPS = path.join(DATA, 'backups')
const SECRET = path.join(DATA, 'secret.key')
const SEED = path.join(__dirname, 'seed.json')

const SESSION_TTL = 12 * 60 * 60 * 1000
const LIMITS = { image: 25 * 1024 * 1024, video: 400 * 1024 * 1024 }
const TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
}

/* ── tiny helpers ─────────────────────────────────────────────────────── */
const now = () => new Date().toISOString()
const randomId = (p) => p + crypto.randomBytes(5).toString('hex')

function ensureDirs() {
  for (const d of [DATA, UPLOADS, BACKUPS]) fs.mkdirSync(d, { recursive: true })
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}

async function writeJSON(file, value) {
  const tmp = file + '.' + process.pid + '.tmp'
  await fsp.writeFile(tmp, JSON.stringify(value, null, 2))
  await fsp.rename(tmp, file)
}

/* ── store ────────────────────────────────────────────────────────────── */
function loadContent() {
  let data = readJSON(CONTENT, null)
  const migrated = data && Array.isArray(data.projects) && data.projects.some((p) => p.displayed === undefined)
  if (!data) {
    data = readJSON(SEED, { version: 1, projects: [], groups: [], products: [], patents: [], craft: null, footer: null })
    data.updatedAt = now()
    fs.writeFileSync(CONTENT, JSON.stringify(data, null, 2))
  }
  if (Array.isArray(data.projects)) {
    data.projects = data.projects.map((p, i) => cleanProject({
      ...p,
      displayed: p.displayed === undefined ? true : p.displayed,
      displayOrder: p.displayOrder === undefined ? i : p.displayOrder,
    }, p))
    if (migrated) {
      fs.writeFileSync(CONTENT, JSON.stringify(data, null, 2))
      console.log(`migrated ${data.projects.length} project rows to repository/display`)
    }
  }
  if (Array.isArray(data.products)) {
    const prodMigrated = data.products.some((p) => p.displayed === undefined || !Array.isArray(p.groupIds))
    data.products = data.products.map((p, i) => cleanProduct({
      ...p,
      displayed: p.displayed === undefined ? true : p.displayed,
      displayOrder: p.displayOrder === undefined ? i : p.displayOrder,
    }, p))
    if (prodMigrated) {
      fs.writeFileSync(CONTENT, JSON.stringify(data, null, 2))
      console.log(`migrated ${data.products.length} product rows to multi-group/repository`)
    }
  }
  if (Array.isArray(data.patents)) {
    const patentMigrated = data.patents.some((p) => p.displayed === undefined)
    data.patents = data.patents.map((p, i) => cleanPatent({
      ...p,
      displayed: p.displayed === undefined ? true : p.displayed,
      displayOrder: p.displayOrder === undefined ? i : p.displayOrder,
    }, p))
    if (patentMigrated) {
      fs.writeFileSync(CONTENT, JSON.stringify(data, null, 2))
      console.log(`migrated ${data.patents.length} patent rows to repository/display`)
    }
  }
  return data
}

let content = null
let etag = ''

/* everything the public pages read in one object; the admin keeps reading `content` */
function publicBundle() {
  return {
    ...content,
    projects: displayed(content.projects),
    patents: displayed(content.patents),
    products: displayed(content.products),
  }
}
let saving = Promise.resolve()

function stampContent() {
  content.updatedAt = now()
  etag = 'W/"' + crypto.createHash('sha1').update(JSON.stringify(content)).digest('hex').slice(0, 16) + '"'
}

async function saveContent() {
  stampContent()
  // serialise writes so two quick admin saves cannot interleave
  saving = saving.then(async () => {
    const backup = path.join(BACKUPS, 'content-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json')
    try { await fsp.copyFile(CONTENT, backup) } catch {}
    await writeJSON(CONTENT, content)
    // keep the last 20 backups
    const list = (await fsp.readdir(BACKUPS)).filter((f) => f.startsWith('content-')).sort()
    for (const old of list.slice(0, Math.max(0, list.length - 20))) {
      await fsp.unlink(path.join(BACKUPS, old)).catch(() => {})
    }
  })
  return saving
}

/* ── auth ─────────────────────────────────────────────────────────────── */
/* Sessions are stateless: the cookie is {email, exp} signed with a key derived from the
   server secret *and the user's current password hash*. Restarting the service does not
   sign anyone out, and changing the password invalidates every older cookie. */

const loginThrottle = new Map() // ip -> { n, t }

function secret() {
  try { fs.readFileSync(SECRET); return fs.readFileSync(SECRET) }
  catch {
    const key = crypto.randomBytes(32)
    fs.writeFileSync(SECRET, key, { mode: 0o600 })
    return key
  }
}
const KEY = (() => { ensureDirs(); return secret() })()

function signingKey(email) {
  const user = users().find((u) => u.email.toLowerCase() === String(email).toLowerCase())
  if (!user) return null
  // the sha of the stored hash: stable, and different after a password change
  const tag = crypto.createHash('sha256').update(String(user.password)).digest('hex').slice(0, 16)
  return crypto.createHmac('sha256', KEY).update(tag).digest()
}

function makeToken(email) {
  const payload = Buffer.from(JSON.stringify({ e: email, x: Date.now() + SESSION_TTL })).toString('base64url')
  const mac = crypto.createHmac('sha256', signingKey(email)).update(payload).digest('base64url')
  return payload + '.' + mac
}

function readSession(req) {
  const raw = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith('ncl_sid='))
  if (!raw) return null
  let value
  try { value = decodeURIComponent(raw.slice('ncl_sid='.length)) } catch { return null }
  const [payload, mac] = value.split('.')
  if (!payload || !mac) return null
  let data
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) } catch { return null }
  if (!data || !data.e || !data.x || data.x < Date.now()) return null
  const key = signingKey(data.e)
  if (!key) return null
  const want = crypto.createHmac('sha256', key).update(payload).digest('base64url')
  const a = Buffer.from(mac), b = Buffer.from(want)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  return { token: value, email: data.e, exp: data.x }
}

function setCookie(res, token, maxAge) {
  const secure = process.env.NCL_INSECURE ? '' : '; Secure'
  res.setHeader('Set-Cookie',
    `ncl_sid=${encodeURIComponent(token || '')}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${maxAge}`)
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':')
  if (!salt || !hash) return false
  const test = crypto.scryptSync(password, salt, 64)
  const want = Buffer.from(hash, 'hex')
  return want.length === test.length && crypto.timingSafeEqual(want, test)
}

function users() { return readJSON(USERS, []) }

/* behind nginx every socket says 127.0.0.1: throttle on the forwarded client instead */
function clientIp(req) {
  const forwarded = String(req.headers['x-real-ip'] || '').trim()
  return forwarded || (req.socket.remoteAddress || '?')
}

async function bootstrapUser() {
  const list = users()
  if (list.length) return null
  const email = process.env.NCL_ADMIN_EMAIL || 'admin@nclzs.com'
  const password = process.env.NCL_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url')
  list.push({ email, password: hashPassword(password), addedAt: now() })
  await writeJSON(USERS, list)
  return { email, password }
}

/* ── http plumbing ────────────────────────────────────────────────────── */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf',
}

function sendJSON(res, code, value, extra = {}) {
  const body = JSON.stringify(value)
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extra,
  })
  res.end(body)
}

function fail(res, code, message) { sendJSON(res, code, { error: message }) }

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) { reject(new Error('too large')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => {
      if (!chunks.length) return resolve({})
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { reject(new Error('bad json')) }
    })
    req.on('error', reject)
  })
}

function requireAuth(req, res) {
  const s = readSession(req)
  if (!s) { fail(res, 401, 'not signed in'); return null }
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-ncl-admin'] !== '1') {
    fail(res, 403, 'missing admin header'); return null
  }
  return s
}

async function serveFile(res, file, { cache = 'public, max-age=300' } = {}) {
  try {
    const st = await fsp.stat(file)
    if (!st.isFile()) throw new Error('not a file')
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': cache,
      'Last-Modified': st.mtime.toUTCString(),
    })
    fs.createReadStream(file).pipe(res)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found')
  }
}

/* ── validation ───────────────────────────────────────────────────────── */
const str = (v, max = 400) => String(v == null ? '' : v).slice(0, max).trim()

function cleanProject(p, prev) {
  const base = prev || {}
  const raw = p || {}
  return {
    id: str(raw.id, 40) || str(base.id, 40) || randomId('p'),
    name: str(raw.name == null ? base.name : raw.name, 80),
    line: str(raw.line == null ? base.line : raw.line, 400),
    image: str(raw.image == null ? base.image : raw.image, 300),
    alt: str(raw.alt == null ? base.alt : raw.alt, 200),
    /* false means "in the repository, not on the site" */
    displayed: raw.displayed == null ? base.displayed !== false : !!raw.displayed,
    displayOrder: Number(raw.displayOrder == null ? (base.displayOrder || 0) : raw.displayOrder) || 0,
    createdAt: str(base.createdAt, 40) || now(),
  }
}

/* what the public pages get: the displayed rows, in display order */
function displayed(list) {
  return list
    .filter((p) => p.displayed !== false)
    .slice()
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || String(a.createdAt).localeCompare(String(b.createdAt)))
}
function cleanGroup(g) {
  return {
    id: str(g.id, 40) || randomId('g'),
    anchor: str(g.anchor, 40) || str(g.id, 40) || randomId('g'),
    title: str(g.title, 80),
    note: str(g.note, 300),
  }
}
function cleanProduct(p, prev) {
  const base = prev || {}
  const raw = p || {}
  let ids = raw.groupIds
  if (!Array.isArray(ids)) {
    if (typeof raw.groupId === 'string') ids = [raw.groupId]
    else if (Array.isArray(base.groupIds)) ids = base.groupIds
    else ids = base.groupId ? [base.groupId] : []
  }
  ids = ids.map((x) => str(x, 40)).filter(Boolean).slice(0, 8)
  return {
    id: str(raw.id, 40) || str(base.id, 40) || randomId('pr'),
    /* a product can sit in several groups; groupId is kept as the first one for older code */
    groupIds: ids,
    groupId: ids[0] || '',
    model: str(raw.model == null ? base.model : raw.model, 80),
    spec: str(raw.spec == null ? base.spec : raw.spec, 120),
    image: str(raw.image == null ? base.image : raw.image, 300),
    alt: str(raw.alt == null ? base.alt : raw.alt, 200),
    displayed: raw.displayed == null ? base.displayed !== false : !!raw.displayed,
    displayOrder: Number(raw.displayOrder == null ? (base.displayOrder || 0) : raw.displayOrder) || 0,
    createdAt: str(base.createdAt, 40) || now(),
  }
}
function cleanPatent(p, prev) {
  const base = prev || {}
  const raw = p || {}
  return {
    id: str(raw.id, 40) || str(base.id, 40) || randomId('d'),
    image: str(raw.image == null ? base.image : raw.image, 300),
    title: str(raw.title == null ? base.title : raw.title, 100),
    meta: str(raw.meta == null ? base.meta : raw.meta, 160),
    alt: str(raw.alt == null ? base.alt : raw.alt, 200),
    displayed: raw.displayed == null ? base.displayed !== false : !!raw.displayed,
    displayOrder: Number(raw.displayOrder == null ? (base.displayOrder || 0) : raw.displayOrder) || 0,
    createdAt: str(base.createdAt, 40) || now(),
  }
}

const KINDS = {
  projects: { key: 'projects', clean: cleanProject },
  groups: { key: 'groups', clean: cleanGroup },
  products: { key: 'products', clean: cleanProduct },
  patents: { key: 'patents', clean: cleanPatent },
}

const LINES = (v, n = 4) => (Array.isArray(v) ? v : []).map((l) => str(l, 200)).filter(Boolean).slice(0, n)

function cleanCraft(c, prev) {
  const src = c && typeof c === 'object' ? c : {}
  const media = (m, fallback) => ({
    label: str(m.label == null ? fallback.label : m.label, 40),
    title: LINES(m.title == null ? fallback.title : m.title),
    body: str(m.body == null ? fallback.body : m.body, 600),
    image: str(m.image == null ? fallback.image : m.image, 300),
    alt: str(m.alt == null ? fallback.alt : m.alt, 200),
    parallax: Math.max(0, Math.min(0.5, Number(m.parallax == null ? fallback.parallax : m.parallax) || 0)),
  })
  const base = prev || { close: {}, plates: [] }
  const plates = (Array.isArray(src.plates) ? src.plates : (base.plates || [])).slice(0, 4).map((p, i) => {
    const m = media(p || {}, (base.plates && base.plates[i]) || {})
    return {
      id: str(p && p.id, 40) || randomId('c'),
      layout: (p && p.layout) === 'media-right' ? 'media-right' : 'media-left',
      ...m,
    }
  })
  const closeIn = src.close || {}
  const closeBase = base.close || {}
  const close = media(closeIn, closeBase)
  close.cta = {
    label: str((closeIn.cta || {}).label == null ? (closeBase.cta || {}).label : closeIn.cta.label, 80),
    href: str((closeIn.cta || {}).href == null ? (closeBase.cta || {}).href : closeIn.cta.href, 200),
  }
  return {
    eyebrow: {
      lead: str((src.eyebrow || {}).lead == null ? 'The hand' : src.eyebrow.lead, 60),
      items: str((src.eyebrow || {}).items == null ? '' : src.eyebrow.items, 80),
    },
    title: LINES(src.title == null ? (prev || {}).title : src.title),
    plates,
    close,
  }
}

function cleanFooter(f, prev) {
  const src = f && typeof f === 'object' ? f : {}
  const columns = (Array.isArray(src.columns) ? src.columns : (prev || {}).columns || []).slice(0, 6).map((c) => {
    const col = { title: str(c.title, 60) }
    if (Array.isArray(c.socials)) {
      col.socials = c.socials.slice(0, 12).map((s) => ({
        kind: str(s.kind, 20) || 'link',
        name: str(s.name, 60),
        href: str(s.href, 300),
        note: str(s.note, 200),
        aria: str(s.aria, 120),
      }))
    } else if (Array.isArray(c.lines)) {
      col.lines = c.lines.map((l) => str(l, 160)).filter(Boolean).slice(0, 8)
    } else {
      col.links = (Array.isArray(c.links) ? c.links : []).slice(0, 12).map((l) => ({
        label: str(l.label, 80),
        href: str(l.href, 300) || '#',
      }))
    }
    return col
  })
  return {
    brand: str(src.brand == null ? (prev || {}).brand : src.brand, 80),
    columns,
    base: (Array.isArray(src.base) ? src.base : (prev || {}).base || []).slice(0, 5).map((b) => ({
      text: str(b.text, 200),
      href: b.href ? str(b.href, 300) : '',
    })),
  }
}

/* ── routes ───────────────────────────────────────────────────────────── */
async function api(req, res, url) {
  const { pathname, searchParams } = url

  if (pathname === '/api/site' && (req.method === 'GET' || req.method === 'HEAD')) {
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); res.end(); return }
    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(JSON.stringify(content)),
        ETag: etag,
        'Cache-Control': 'no-cache',
      })
      return res.end()
    }
    return sendJSON(res, 200, publicBundle(), { ETag: etag, 'Cache-Control': 'no-cache' })
  }

  /* the public pages load this as a plain <script>, so the content is there before the
     page scripts run: no fetch to await, no window where controls are unbound */
  if (pathname === '/api/site.js' && (req.method === 'GET' || req.method === 'HEAD')) {
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); res.end(); return }
    const body = 'window.NCL_SITE_DATA=' + JSON.stringify(publicBundle()) + ';'
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      ETag: etag,
      'Cache-Control': 'no-cache',
    })
    res.end(req.method === 'HEAD' ? undefined : body)
    return
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const ip = clientIp(req)
    const hit = loginThrottle.get(ip) || { n: 0, t: 0 }
    if (Date.now() - hit.t < 10 * 60 * 1000 && hit.n >= 8) return fail(res, 429, 'too many attempts, try later')
    const body = await readBody(req, 4096).catch(() => ({}))
    const email = str(body.email, 120).toLowerCase()
    const password = String(body.password || '')
    const user = users().find((u) => u.email.toLowerCase() === email)
    if (!user || !verifyPassword(password, user.password)) {
      loginThrottle.set(ip, { n: hit.n + 1, t: hit.n ? hit.t : Date.now() })
      return fail(res, 401, 'wrong email or password')
    }
    loginThrottle.delete(ip)
    setCookie(res, makeToken(user.email), SESSION_TTL / 1000)
    return sendJSON(res, 200, { email: user.email })
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    setCookie(res, '', 0)
    return sendJSON(res, 200, { ok: true })
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const s = readSession(req)
    if (!s) return fail(res, 401, 'not signed in')
    return sendJSON(res, 200, { email: s.email })
  }

  if (pathname === '/api/admin/content' && req.method === 'GET') {
    if (!requireAuth(req, res)) return
    return sendJSON(res, 200, content)
  }

  if (pathname === '/api/admin/password' && req.method === 'POST') {
    const s = requireAuth(req, res); if (!s) return
    const body = await readBody(req, 4096).catch(() => ({}))
    const list = users()
    const user = list.find((u) => u.email === s.email)
    if (!user || !verifyPassword(String(body.current || ''), user.password)) return fail(res, 403, 'wrong password')
    if (String(body.next || '').length < 8) return fail(res, 400, 'new password must be at least 8 characters')
    user.password = hashPassword(String(body.next))
    user.passwordChangedAt = now()
    await writeJSON(USERS, list)
    /* an audit line: this is the one endpoint that can lock the owner out */
    console.log(`password changed for ${user.email} from ${clientIp(req)}`)
    return sendJSON(res, 200, { ok: true })
  }

  if (pathname === '/api/admin/cover' && req.method === 'PUT') {
    if (!requireAuth(req, res)) return
    const body = await readBody(req).catch(() => null)
    if (!body) return fail(res, 400, 'bad body')
    content.cover = {
      titleLines: (Array.isArray(body.titleLines) ? body.titleLines : content.cover.titleLines)
        .map((l) => str(l, 200)).filter(Boolean).slice(0, 4),
      sub: str(body.sub == null ? content.cover.sub : body.sub, 600),
      cta: str(body.cta == null ? content.cover.cta : body.cta, 80),
      eyebrow: str(body.eyebrow == null ? content.cover.eyebrow : body.eyebrow, 80),
      video: {
        1080: str(body.video && body.video['1080'] != null ? body.video['1080'] : content.cover.video['1080'], 300),
        720: str(body.video && body.video['720'] != null ? body.video['720'] : content.cover.video['720'], 300),
        poster: str(body.video && body.video.poster != null ? body.video.poster : content.cover.video.poster, 300),
      },
    }
    await saveContent()
    return sendJSON(res, 200, content.cover)
  }

  if (pathname === '/api/admin/craft' && req.method === 'PUT') {
    if (!requireAuth(req, res)) return
    const body = await readBody(req, 256 * 1024).catch(() => null)
    if (!body) return fail(res, 400, 'bad body')
    content.craft = cleanCraft(body, content.craft)
    await saveContent()
    return sendJSON(res, 200, content.craft)
  }

  if (pathname === '/api/admin/footer' && req.method === 'PUT') {
    if (!requireAuth(req, res)) return
    const body = await readBody(req, 256 * 1024).catch(() => null)
    if (!body) return fail(res, 400, 'bad body')
    content.footer = cleanFooter(body, content.footer)
    await saveContent()
    return sendJSON(res, 200, content.footer)
  }

  /* ── the project repository ──────────────────────────────────────────
     One list holds every project card. `displayed` marks the ones the site
     shows, and the admin has two panes over it: 项目仓库 (all) and 展示项目
     (displayed only, in displayOrder). */
  if (pathname === '/api/admin/projects' && req.method === 'GET') {
    if (!requireAuth(req, res)) return
    const q = str(searchParams.get('q'), 80).toLowerCase()
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const per = Math.min(500, Math.max(1, Number(searchParams.get('per')) || 12))
    const display = searchParams.get('display')
    let list = content.projects.slice()
    if (display === '1') list = list.filter((p) => p.displayed !== false)
    if (display === '0') list = list.filter((p) => p.displayed === false)
    if (q) {
      list = list.filter((p) => (p.name + ' ' + p.line + ' ' + p.alt).toLowerCase().includes(q))
    }
    list.sort((a, b) => display === '1'
      ? (a.displayOrder || 0) - (b.displayOrder || 0)
      : String(a.name).localeCompare(String(b.name), 'zh'))
    const total = list.length
    const pages = Math.max(1, Math.ceil(total / per))
    return sendJSON(res, 200, {
      items: list.slice((page - 1) * per, page * per),
      total, page: Math.min(page, pages), per, pages,
      shown: content.projects.filter((p) => p.displayed !== false).length,
      all: content.projects.length,
    })
  }

  if (pathname === '/api/admin/products' && req.method === 'GET') {
    if (!requireAuth(req, res)) return
    const q = str(searchParams.get('q'), 80).toLowerCase()
    const group = str(searchParams.get('group'), 40)
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const per = Math.min(500, Math.max(1, Number(searchParams.get('per')) || 12))
    const display = searchParams.get('display')
    let list = content.products.slice()
    if (display === '1') list = list.filter((p) => p.displayed !== false)
    if (display === '0') list = list.filter((p) => p.displayed === false)
    if (group) list = list.filter((p) => (p.groupIds || []).includes(group))
    if (q) list = list.filter((p) => (p.model + ' ' + p.spec + ' ' + p.alt).toLowerCase().includes(q))
    list.sort((a, b) => display === '1'
      ? (a.displayOrder || 0) - (b.displayOrder || 0)
      : String(a.model).localeCompare(String(b.model), 'zh'))
    const total = list.length
    const pages = Math.max(1, Math.ceil(total / per))
    return sendJSON(res, 200, {
      items: list.slice((page - 1) * per, page * per),
      total, page: Math.min(page, pages), per, pages,
      shown: content.products.filter((p) => p.displayed !== false).length,
      all: content.products.length,
      groups: content.groups.map((g) => ({
        ...g,
        count: content.products.filter((p) => (p.groupIds || []).includes(g.id)).length,
        shown: content.products.filter((p) => p.displayed !== false && (p.groupIds || []).includes(g.id)).length,
      })),
    })
  }

  if (pathname === '/api/admin/products/batch' && req.method === 'POST') {
    if (!requireAuth(req, res)) return
    const body = await readBody(req, 64 * 1024).catch(() => null)
    if (!body || !Array.isArray(body.ids)) return fail(res, 400, 'bad batch payload')
    const ids = new Set(body.ids.map((x) => str(x, 40)))
    const action = str(body.action, 20)
    if (action === 'delete') {
      const before = content.products.length
      content.products = content.products.filter((p) => !ids.has(p.id))
      await saveContent()
      return sendJSON(res, 200, { ok: true, removed: before - content.products.length })
    }
    if (action === 'show' || action === 'hide') {
      const want = action === 'show'
      let nextOrder = content.products.reduce((m, p) => Math.max(m, p.displayOrder || 0), -1) + 1
      let touched = 0
      for (const p of content.products) {
        if (!ids.has(p.id)) continue
        if (want && p.displayed === false) p.displayOrder = nextOrder++
        p.displayed = want
        touched++
      }
      await saveContent()
      return sendJSON(res, 200, { ok: true, touched })
    }
    return fail(res, 400, 'unknown action')
  }

  if (pathname === '/api/admin/products/display-order' && req.method === 'PUT') {
    if (!requireAuth(req, res)) return
    const body = await readBody(req, 64 * 1024).catch(() => null)
    if (!body || !Array.isArray(body.ids)) return fail(res, 400, 'bad order payload')
    const byId = new Map(content.products.map((p) => [p.id, p]))
    body.ids.forEach((id, i) => { const p = byId.get(str(id, 40)); if (p) p.displayOrder = i })
    await saveContent()
    return sendJSON(res, 200, { ok: true })
  }

  if (pathname === '/api/admin/patents' && req.method === 'GET') {
    if (!requireAuth(req, res)) return
    const q = str(searchParams.get('q'), 80).toLowerCase()
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const per = Math.min(500, Math.max(1, Number(searchParams.get('per')) || 12))
    const display = searchParams.get('display')
    let list = content.patents.slice()
    if (display === '1') list = list.filter((p) => p.displayed !== false)
    if (display === '0') list = list.filter((p) => p.displayed === false)
    if (q) list = list.filter((p) => (p.title + ' ' + p.meta + ' ' + p.alt).toLowerCase().includes(q))
    list.sort((a, b) => display === '1'
      ? (a.displayOrder || 0) - (b.displayOrder || 0)
      : String(a.title).localeCompare(String(b.title), 'zh'))
    const total = list.length
    const pages = Math.max(1, Math.ceil(total / per))
    return sendJSON(res, 200, {
      items: list.slice((page - 1) * per, page * per),
      total, page: Math.min(page, pages), per, pages,
      shown: content.patents.filter((p) => p.displayed !== false).length,
      all: content.patents.length,
    })
  }

  if (pathname === '/api/admin/patents/batch' && req.method === 'POST') {
    if (!requireAuth(req, res)) return
    const body = await readBody(req, 64 * 1024).catch(() => null)
    if (!body || !Array.isArray(body.ids)) return fail(res, 400, 'bad batch payload')
    const ids = new Set(body.ids.map((x) => str(x, 40)))
    const action = str(body.action, 20)
    if (action === 'delete') {
      const before = content.patents.length
      content.patents = content.patents.filter((p) => !ids.has(p.id))
      await saveContent()
      return sendJSON(res, 200, { ok: true, removed: before - content.patents.length })
    }
    if (action === 'show' || action === 'hide') {
      const want = action === 'show'
      let nextOrder = content.patents.reduce((m, p) => Math.max(m, p.displayOrder || 0), -1) + 1
      let touched = 0
      for (const p of content.patents) {
        if (!ids.has(p.id)) continue
        if (want && p.displayed === false) p.displayOrder = nextOrder++
        p.displayed = want
        touched++
      }
      await saveContent()
      return sendJSON(res, 200, { ok: true, touched })
    }
    return fail(res, 400, 'unknown action')
  }

  if (pathname === '/api/admin/patents/display-order' && req.method === 'PUT') {
    if (!requireAuth(req, res)) return
    const body = await readBody(req, 64 * 1024).catch(() => null)
    if (!body || !Array.isArray(body.ids)) return fail(res, 400, 'bad order payload')
    const byId = new Map(content.patents.map((p) => [p.id, p]))
    body.ids.forEach((id, i) => { const p = byId.get(str(id, 40)); if (p) p.displayOrder = i })
    await saveContent()
    return sendJSON(res, 200, { ok: true })
  }

  if (pathname === '/api/admin/projects/batch' && req.method === 'POST') {
    if (!requireAuth(req, res)) return
    const body = await readBody(req, 64 * 1024).catch(() => null)
    if (!body || !Array.isArray(body.ids)) return fail(res, 400, 'bad batch payload')
    const ids = new Set(body.ids.map((x) => str(x, 40)))
    const action = str(body.action, 20)
    if (action === 'delete') {
      const before = content.projects.length
      content.projects = content.projects.filter((p) => !ids.has(p.id))
      await saveContent()
      return sendJSON(res, 200, { ok: true, removed: before - content.projects.length })
    }
    if (action === 'show' || action === 'hide') {
      const want = action === 'show'
      let nextOrder = content.projects.reduce((m, p) => Math.max(m, p.displayOrder || 0), -1) + 1
      let touched = 0
      for (const p of content.projects) {
        if (!ids.has(p.id)) continue
        if (want && p.displayed === false) p.displayOrder = nextOrder++
        p.displayed = want
        touched++
      }
      await saveContent()
      return sendJSON(res, 200, { ok: true, touched })
    }
    return fail(res, 400, 'unknown action')
  }

  if (pathname === '/api/admin/projects/display-order' && req.method === 'PUT') {
    if (!requireAuth(req, res)) return
    const body = await readBody(req, 64 * 1024).catch(() => null)
    if (!body || !Array.isArray(body.ids)) return fail(res, 400, 'bad order payload')
    const byId = new Map(content.projects.map((p) => [p.id, p]))
    body.ids.forEach((id, i) => { const p = byId.get(str(id, 40)); if (p) p.displayOrder = i })
    await saveContent()
    return sendJSON(res, 200, { ok: true })
  }

  // generic collections: projects | groups | products | patents
  const m = pathname.match(/^\/api\/admin\/(projects|groups|products|patents)(?:\/([\w-]+))?$/)
  if (m) {
    const kind = KINDS[m[1]]
    if (!kind) return fail(res, 404, 'unknown collection')
    const id = m[2]

    if (req.method === 'GET' && !id) {
      if (!requireAuth(req, res)) return
      return sendJSON(res, 200, content[kind.key])
    }
    if (req.method === 'POST' && !id) {
      if (!requireAuth(req, res)) return
      const body = await readBody(req).catch(() => null)
      if (!body) return fail(res, 400, 'bad body')
      const item = kind.clean(body)
      content[kind.key].push(item)
      await saveContent()
      return sendJSON(res, 201, item)
    }
    if (id && req.method === 'PUT') {
      if (!requireAuth(req, res)) return
      const body = await readBody(req).catch(() => null)
      if (!body) return fail(res, 400, 'bad body')
      const list = content[kind.key]
      const at = list.findIndex((x) => x.id === id)
      if (at < 0) return fail(res, 404, 'not found')
      list[at] = kind.clean({ ...list[at], ...body, id })
      await saveContent()
      return sendJSON(res, 200, list[at])
    }
    if (id && req.method === 'DELETE') {
      if (!requireAuth(req, res)) return
      const list = content[kind.key]
      const at = list.findIndex((x) => x.id === id)
      if (at < 0) return fail(res, 404, 'not found')
      const [gone] = list.splice(at, 1)
      if (kind.key === 'groups') {
        /* the group tag is removed from every product, the products stay in the repository */
        for (const p of content.products) {
          const ids = Array.isArray(p.groupIds) ? p.groupIds.filter((g) => g !== gone.id) : []
          p.groupIds = ids
          p.groupId = ids[0] || ''
        }
      }
      await saveContent()
      return sendJSON(res, 200, { ok: true, id })
    }
  }

  if (pathname === '/api/admin/order' && req.method === 'PUT') {
    if (!requireAuth(req, res)) return
    const body = await readBody(req, 64 * 1024).catch(() => null)
    if (!body || !Array.isArray(body.ids) || !KINDS[body.kind]) return fail(res, 400, 'bad order payload')
    const list = content[KINDS[body.kind].key]
    const byId = new Map(list.map((x) => [x.id, x]))
    const next = body.ids.map((id) => byId.get(id)).filter(Boolean)
    for (const x of list) if (!body.ids.includes(x.id)) next.push(x)
    content[KINDS[body.kind].key] = next
    await saveContent()
    return sendJSON(res, 200, next.map((x) => x.id))
  }

  // raw-body upload: PUT /api/admin/upload?name=file.webp&kind=image
  if (pathname === '/api/admin/upload' && req.method === 'PUT') {
    if (!requireAuth(req, res)) return
    const kind = searchParams.get('kind') === 'video' ? 'video' : 'image'
    const type = String(req.headers['content-type'] || '').split(';')[0]
    if (!TYPES[kind].includes(type)) return fail(res, 415, 'unsupported type: ' + type)
    const original = path.basename(searchParams.get('name') || 'file')
    const safe = original.replace(/[^\w.\-]+/g, '-').slice(-60) || 'file'
    const rel = 'uploads/' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex') + '-' + safe
    const target = path.join(DATA, rel)
    const limit = LIMITS[kind]
    let size = 0
    const out = fs.createWriteStream(target)
    try {
      await new Promise((resolve, reject) => {
        req.on('data', (c) => {
          size += c.length
          if (size > limit) { reject(new Error('too large')); req.destroy(); return }
        })
        req.pipe(out)
        out.on('finish', resolve)
        out.on('error', reject)
        req.on('error', reject)
      })
    } catch (e) {
      out.destroy(); await fsp.unlink(target).catch(() => {})
      return fail(res, e.message === 'too large' ? 413 : 400, e.message)
    }
    return sendJSON(res, 200, { url: '/uploads/' + path.basename(rel), bytes: size })
  }

  if (pathname === '/api/admin/file' && req.method === 'DELETE') {
    if (!requireAuth(req, res)) return
    const url = str(searchParams.get('url'), 300)
    if (!url.startsWith('/uploads/')) return fail(res, 400, 'only uploaded files can be removed')
    await fsp.unlink(path.join(DATA, url.replace('/uploads/', 'uploads/'))).catch(() => {})
    return sendJSON(res, 200, { ok: true })
  }

  return fail(res, 404, 'no such endpoint')
}

/* ── server ───────────────────────────────────────────────────────────── */
ensureDirs()
content = loadContent()
stampContent()

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'))
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url)

    // uploads are served from the data dir, everything else from the admin UI folder
    if (url.pathname.startsWith('/uploads/')) {
      return serveFile(res, path.join(DATA, decodeURIComponent(url.pathname.slice(1))), { cache: 'public, max-age=31536000, immutable' })
    }

    let rel = decodeURIComponent(url.pathname)

    if (rel === '/admin') return res.writeHead(302, { Location: '/admin/' }).end()
    if (rel === '/') rel = '/index.html'

    if (rel.startsWith('/admin/')) {
      let a = rel.slice('/admin'.length)
      if (a === '/' || a === '') a = '/index.html'
      const file = path.normalize(path.join(ADMIN_DIR, a))
      if (!file.startsWith(path.normalize(ADMIN_DIR))) return fail(res, 403, 'forbidden')
      return serveFile(res, file, { cache: 'no-cache' })
    }

    // the public site, when this process is used as the app server (local dev / preview).
    // In production nginx serves it straight from disk and only proxies /api + /uploads.
    const siteFile = path.normalize(path.join(SITE_DIR, rel))
    if (!siteFile.startsWith(path.normalize(SITE_DIR))) return fail(res, 403, 'forbidden')
    if (fs.existsSync(siteFile) && fs.statSync(siteFile).isFile()) {
      return serveFile(res, siteFile, {
        cache: /\.(html?|js|css)$/.test(siteFile) ? 'no-cache' : 'public, max-age=300',
      })
    }
    const asHtml = siteFile + '.html'
    if (fs.existsSync(asHtml)) return serveFile(res, asHtml, { cache: 'no-cache' })
    return serveFile(res, path.join(SITE_DIR, 'index.html'), { cache: 'no-cache' })
  } catch (e) {
    console.error(e)
    if (!res.headersSent) fail(res, 500, 'server error')
    else res.end()
  }
})

bootstrapUser().then((created) => {
  server.listen(PORT, HOST, () => {
    console.log(`NCL API on http://${HOST}:${PORT}  data=${DATA}`)
    if (created) console.log(`created admin user: ${created.email} / ${created.password}`)
  })
})
