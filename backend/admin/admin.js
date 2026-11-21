/* NCL content admin — no build step, no framework: it talks to the same-origin API and
   re-renders one view at a time. */

'use strict'

const state = {
  data: null,
  view: 'cover',
  dirty: false,
  drag: null,
}

const $ = (sel, root = document) => root.querySelector(sel)
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k === 'class') node.className = v
    else if (k === 'html') node.innerHTML = v
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v)
    else node.setAttribute(k, v)
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue
    node.append(c.nodeType ? c : document.createTextNode(String(c)))
  }
  return node
}

function toast(message, isError) {
  const t = $('#toast')
  t.textContent = message
  t.classList.toggle('error', !!isError)
  t.hidden = false
  clearTimeout(t._timer)
  t._timer = setTimeout(() => { t.hidden = true }, 3200)
}

async function api(path, options = {}) {
  const opts = { headers: {}, credentials: 'same-origin', ...options }
  if (opts.body && typeof opts.body !== 'string' && !(opts.body instanceof Blob)) {
    opts.body = JSON.stringify(opts.body)
    opts.headers['Content-Type'] = 'application/json'
  }
  if (opts.method && opts.method !== 'GET') opts.headers['X-NCL-Admin'] = '1'
  const res = await fetch('/api' + path, opts)
  const data = await res.json().catch(() => ({}))
  /* a 401 from the login form is "wrong password", not "your session expired" */
  if (res.status === 401 && path !== '/auth/login') { showLogin(); throw new Error('未登录') }
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data
}

/* ── auth ─────────────────────────────────────────────────────────────── */
function showLogin(note) {
  $('#app').hidden = true
  $('#login').hidden = false
  $('#login-email').focus()
  const hint = document.getElementById('login-note')
  if (hint) {
    hint.textContent = note || ''
    hint.hidden = !note
  }
  const status = $('#login-status')
  if (status) {
    status.classList.remove('bad')
    status.textContent = '自检中…'
    fetch('/api/site', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => {
        status.textContent = '接口 ' + r.status + ' · ' + (r.ok ? '正常，可以登录' : '异常')
        status.classList.toggle('bad', !r.ok)
      })
      .catch(() => {
        status.textContent = '接口不通：检查网络、代理或广告拦截插件'
        status.classList.add('bad')
      })
  }
}

function showApp(email) {
  $('#login').hidden = true
  $('#app').hidden = false
  $('#who-email').textContent = email
  window.scrollTo(0, 0)
  loadContent()
}

$('#pw-eye').addEventListener('click', () => {
  const input = $('#login-password')
  const show = input.type === 'password'
  input.type = show ? 'text' : 'password'
  $('#pw-eye').textContent = show ? '隐藏' : '显示'
})

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = $('#login-email').value.trim()
  /* a pasted password often carries a trailing space or newline: that is never part of it */
  const password = $('#login-password').value.trim()
  const err = $('#login-error')
  const btn = $('#login-btn')
  err.textContent = ''
  if (!email || !password) {
    err.textContent = '邮箱和密码都要填。'
    return
  }
  btn.disabled = true
  btn.textContent = '登录中…'
  try {
    await api('/auth/login', { method: 'POST', body: { email, password } })
    $('#login-password').value = ''
    err.textContent = ''
    /* open the app right here: no reload, so this works even if the browser refuses to
       keep the session cookie (a later reload re-opens it through /api/auth/me) */
    showApp(email)
    return
  } catch (err2) {
    const message = err2 && err2.message ? err2.message : String(err2)
    err.textContent = /wrong email/i.test(message) ? '邮箱或密码不正确。'
      : /too many/i.test(message) ? '尝试次数过多，请 10 分钟后再试。'
      : /Failed to fetch|NetworkError|load failed/i.test(message) ? '连不上服务器，检查网络后重试。'
      : '登录失败：' + message
  } finally {
    btn.disabled = false
    btn.textContent = '进入'
  }
})

/* ── the account menu (top right): change password, sign out ───────────── */
function setAccountMenu(open) {
  const menu = document.getElementById('account-menu')
  const toggle = document.getElementById('account-toggle')
  if (!menu || !toggle) return
  menu.hidden = !open
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
}

function accountMenuOpen() {
  const menu = document.getElementById('account-menu')
  return !!(menu && !menu.hidden)
}

document.addEventListener('click', (e) => {
  if (!accountMenuOpen()) return
  if (e.target.closest('#account')) return
  setAccountMenu(false)
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && accountMenuOpen()) setAccountMenu(false)
})

async function signOut() {
  setAccountMenu(false)
  await api('/auth/logout', { method: 'POST' }).catch(() => {})
  showLogin()
}

function openPasswordDialog() {
  setAccountMenu(false)
  const current = el('input', { type: 'password', placeholder: '当前密码' })
  const next = el('input', { type: 'password', placeholder: '新密码（至少 8 位）' })
  const again = el('input', { type: 'password', placeholder: '确认新密码' })
  const note = el('p', { class: 'form-note', role: 'status' })
  const say = (text, bad) => {
    note.textContent = text
    note.classList.toggle('bad', !!bad)
    note.classList.toggle('good', !bad && !!text)
  }
  const field = (label, control) => {
    const lab = el('label', { class: 'field' })
    lab.append(el('span', { class: 'field-label' }, label), control)
    return lab
  }
  const bodyEl = el('div', {},
    el('p', { class: 'hint' }, '登录邮箱：' + ($('#who-email').textContent || '')),
    field('当前密码', current),
    el('div', { class: 'grid2' }, field('新密码', next), field('确认新密码', again)),
    note)

  openModal({
    title: '修改密码',
    body: bodyEl,
    actions: [
      { label: '取消', cls: 'ghost', onClick: ({ close }) => close() },
      {
        label: '修改密码',
        cls: 'primary',
        onClick: async ({ close }) => {
          const a = current.value.trim()
          const b = next.value.trim()
          const c = again.value.trim()
          if (!a || !b) return say('当前密码和新密码都要填。', true)
          if (b.length < 8) return say('新密码至少 8 位。', true)
          if (b !== c) return say('两次输入的新密码不一致。', true)
          if (b === a) return say('新密码不能和当前密码相同。', true)
          try {
            await api('/admin/password', { method: 'POST', body: { current: a, next: b } })
            say('密码已修改，请用新密码重新登录。')
            close()
            toast('密码已修改')
            await api('/auth/logout', { method: 'POST' }).catch(() => {})
            showLogin('密码已修改，请用新密码登录。')
          } catch (err) {
            const message = (err && err.message) || ''
            say(/wrong password/i.test(message) ? '当前密码不正确。'
              : /at least 8/i.test(message) ? '新密码至少 8 位。'
              : /Failed to fetch|NetworkError|load failed/i.test(message) ? '连不上服务器，检查网络后重试。'
              : '修改失败：' + message, true)
          }
        },
      },
    ],
  })
  current.focus()
}

$('#account-toggle').addEventListener('click', () => setAccountMenu(!accountMenuOpen()))
$('#menu-password').addEventListener('click', openPasswordDialog)
$('#menu-logout').addEventListener('click', signOut)

/* ── content ──────────────────────────────────────────────────────────── */
async function loadContent() {
  try {
    state.data = await api('/admin/content')
    render()
  } catch (err) { toast(err.message, true) }
}

async function save() {
  try {
    await fetch('/api/admin/content', { method: 'GET' }) // touch, keeps the session alive
    toast('已保存')
    state.dirty = false
  } catch { /* ignore */ }
}

async function putCover(patch) {
  state.data.cover = await api('/admin/cover', { method: 'PUT', body: patch })
  toast('扉页已保存')
}

async function upsert(kind, item) {
  const list = state.data[kind]
  const at = list.findIndex((x) => x.id === item.id)
  if (at < 0) list.push(await api('/admin/' + kind, { method: 'POST', body: item }))
  else list[at] = await api('/admin/' + kind + '/' + item.id, { method: 'PUT', body: item })
}

async function removeItem(kind, id) {
  if (!confirm('删除这条内容？')) return
  await api('/admin/' + kind + '/' + id, { method: 'DELETE' })
  state.data[kind] = state.data[kind].filter((x) => x.id !== id)
  if (kind === 'groups') state.data.products = []
  await loadContent()
}

async function reorder(kind, ids) {
  await api('/admin/order', { method: 'PUT', body: { kind, ids } })
  await loadContent()
}


/* One save in flight at a time: the button greys out and says what it is doing, and a
   second click while the request is open is ignored (a slow link made double saves easy,
   which is how duplicate PUTs happened). */
async function busyClick(btn, pending, run) {
  if (!btn || btn.dataset.busy === '1' || btn.disabled) return
  btn.dataset.busy = '1'
  const label = btn.textContent
  btn.disabled = true
  btn.classList.add('is-busy')
  btn.textContent = pending || '保存中…'
  try {
    await run()
  } finally {
    btn.dataset.busy = ''
    btn.disabled = false
    btn.classList.remove('is-busy')
    btn.textContent = label
  }
}

/* ── uploads ──────────────────────────────────────────────────────────── */
/* Images are cropped/resized/encoded in the browser before they go up: the site serves
   them at 900–1400 px wide, so uploading a 4000 px camera file would only waste the
   visitor's bandwidth. WebP at q≈0.85 looks identical at these sizes. */
const PROFILES = {
  product: { aspect: 4 / 5, width: 1000, quality: 0.82 },
  project: { aspect: 4 / 5, width: 1400, quality: 0.85 },
  craft: { width: 1400, quality: 0.85 },
  patent: { width: 1400, quality: 0.85 },
  poster: { width: 1920, quality: 0.85 },
  image: { width: 1600, quality: 0.85 },
}

async function prepareImage(file, profile) {
  const spec = PROFILES[profile] || PROFILES.image
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file
  let bitmap
  try { bitmap = await createImageBitmap(file) } catch { return file }
  let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height
  if (spec.aspect) {
    const want = spec.aspect
    if (sw / sh > want) { const w = sh * want; sx = (sw - w) / 2; sw = w }
    else { const h = sw / want; sy = (sh - h) / 2; sh = h }
  }
  const scale = Math.min(1, spec.width / sw)
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', spec.quality))
  if (!blob) return file
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' })
}

async function uploadFile(file, kind, profile) {
  const prepared = kind === 'video' ? file : await prepareImage(file, profile || 'image')
  const res = await fetch('/api/admin/upload?name=' + encodeURIComponent(prepared.name) + '&kind=' + kind, {
    method: 'PUT',
    headers: { 'Content-Type': prepared.type || 'application/octet-stream', 'X-NCL-Admin': '1' },
    body: prepared,
    credentials: 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || '上传失败')
  return data.url
}

function uploader(kind, onDone, profile) {
  const input = el('input', { type: 'file', accept: kind === 'video' ? 'video/*' : 'image/*', class: 'hidden-file' })
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0]
    if (!file) return
    toast('处理并上传中… ' + file.name)
    try {
      const url = await uploadFile(file, kind, profile)
      toast('已上传')
      onDone(url)
    } catch (err) { toast(err.message, true) }
    input.value = ''
  })
  return input
}

/* filename → model / spec, for the batch uploader:
   "001-70100-12-12L埃及φ1080H1160.webp" → 70100-12-12L  ·  ∅1080 · H1160 */


/* ── small building blocks ────────────────────────────────────────────── */
function field(label, value, onInput, opts = {}) {
  const input = el(opts.multiline ? 'textarea' : 'input', {
    type: opts.type || 'text',
    rows: opts.multiline ? (opts.rows || 3) : null,
    placeholder: opts.placeholder || '',
    oninput: (e) => onInput(e.target.value),
  })
  /* a textarea ignores a `value` attribute: assign the property or the field looks empty
     (and a save would then wipe the stored text) */
  input.value = value == null ? '' : String(value)
  return el('label', { class: 'field' }, el('span', { class: 'field-label' }, label), input)
}

/* stored paths are site-relative ("media/…"); inside /admin they must be absolute */
function previewSrc(url) {
  if (!url) return ''
  if (/^(https?:)?\/\//.test(url) || url.startsWith('/')) return url
  return '/' + url
}

function imageField(label, value, onChange, kind = 'image', profile = 'image') {
  const preview = el('div', { class: 'thumb' })
  const paint = () => {
    preview.innerHTML = ''
    if (!value) { preview.append(el('span', { class: 'mono dim' }, '无图')); return }
    preview.append(kind === 'video'
      ? el('video', { src: previewSrc(value), muted: '', playsinline: '', preload: 'metadata', controls: '' })
      : el('img', { src: previewSrc(value), alt: '' }))
  }
  paint()
  const path = el('input', { type: 'text', class: 'path', value: value || '', placeholder: '/uploads/… 或 media/…',
    oninput: (e) => { value = e.target.value; onChange(value); paint() } })
  const pick = el('button', { class: 'btn ghost small', type: 'button', onclick: () => file.click() }, '上传…')
  const file = uploader(kind, (url) => { value = url; path.value = url; onChange(url); paint(); toast('已选择新文件') }, profile)
  return el('div', { class: 'image-field' },
    el('span', { class: 'field-label' }, label),
    preview, path, pick, file)
}

function rowActions(list, index, item, kind) {
  const move = async (delta) => {
    const ids = list.map((x) => x.id)
    const to = index + delta
    if (to < 0 || to >= ids.length) return
    ;[ids[index], ids[to]] = [ids[to], ids[index]]
    await reorder(kind, ids)
  }
  return el('div', { class: 'row-actions' },
    el('button', { class: 'btn ghost small', type: 'button', onclick: () => move(-1) }, '↑'),
    el('button', { class: 'btn ghost small', type: 'button', onclick: () => move(1) }, '↓'),
    el('button', { class: 'btn ghost small danger', type: 'button', onclick: () => removeItem(kind, item.id) }, '删除'))
}

/* ── views ────────────────────────────────────────────────────────────── */
function render() {
  const view = $('#view')
  view.innerHTML = ''
  const views = {
    cover: viewCover,
    projects: viewProjects,
    craft: viewCraft,
    products: viewProducts,
    patents: viewPatents,
    footer: viewFooter,
  }
  ;(views[state.view] || viewCover)(view)
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.view === state.view)
}

function viewCover(root) {
  const c = state.data.cover
  const draft = {
    titleLines: c.titleLines.slice(),
    sub: c.sub,
    cta: c.cta,
    eyebrow: c.eyebrow || '',
    video: { ...c.video },
  }

  const lines = el('div', { class: 'lines' })
  const paintLines = () => {
    lines.innerHTML = ''
    draft.titleLines.forEach((text, i) => {
      lines.append(el('div', { class: 'line-row' },
        el('span', { class: 'mono dim' }, '第 ' + (i + 1) + ' 行'),
        field('', text, (v) => { draft.titleLines[i] = v }, { multiline: false }),
        el('button', {
          class: 'btn ghost small', type: 'button',
          onclick: () => { if (draft.titleLines.length > 1) { draft.titleLines.splice(i, 1); paintLines() } },
        }, '删除')))
    })
    lines.append(el('button', {
      class: 'btn ghost small', type: 'button',
      onclick: () => { if (draft.titleLines.length < 4) { draft.titleLines.push(''); paintLines() } },
    }, '+ 增加一行'))
  }
  paintLines()

  root.append(el('section', { class: 'card' },
    el('h2', {}, '扉页'),
    el('p', { class: 'hint' }, '标题支持 <em>…</em> 表示铜色斜体（和现在 “gold” 一样）。'),
    el('div', { class: 'grid2' },
      el('div', {}, el('span', { class: 'field-label' }, '大标题（逐行）'), lines),
      el('div', {},
        field('眉标（可选，左上小字）', draft.eyebrow, (v) => { draft.eyebrow = v }),
        field('副标题', draft.sub, (v) => { draft.sub = v }, { multiline: true }),
        field('按钮文字', draft.cta, (v) => { draft.cta = v }))),
    el('div', { class: 'grid3' },
      imageField('影片 1080p（视频，可留空用 720p）', draft.video['1080'], (v) => { draft.video['1080'] = v }, 'video'),
      imageField('影片 720p', draft.video['720'], (v) => { draft.video['720'] = v }, 'video'),
      imageField('封面海报图', draft.video.poster, (v) => { draft.video.poster = v }, 'image', 'poster')),
    el('div', { class: 'actions' },
      el('button', {
        class: 'btn ghost', type: 'button',
        onclick: () => previewCover(draft),
      }, '预览'),
      el('button', {
        class: 'btn primary', type: 'button',
        onclick: (e) => busyClick(e.currentTarget, '保存中…', () => putCover(draft).catch((e) => toast(e.message, true))),
      }, '保存扉页'))))
}


/* show the cover as it would look, with the values that are still unsaved */
function previewCover(draft) {
  try {
    sessionStorage.setItem('ncl-cover-draft', JSON.stringify(draft))
  } catch (e) {
    return toast('浏览器不允许读取本地存储，无法预览', true)
  }
  const frame = el('iframe', {
    class: 'preview-frame', src: '/?preview=1&plain=1&t=' + Date.now(),
    title: '扉页预览', loading: 'eager',
  })
  const note = el('p', { class: 'preview-note' })
  note.append('这是 ')
  const em = el('b', {}, '未保存')
  note.append(em, ' 的预览：用的是当前表单里的文字、影片与海报（英文原文，不做翻译）。想上线就点「保存扉页」。')
  openModal({
    title: '扉页预览',
    className: 'preview-modal',
    wide: true,
    body: el('div', {}, note, frame, el('p', { class: 'preview-note' }, '影片会自动播放；如果刚换了视频，加载可能要几秒。')),
    actions: [
      { label: '关闭', cls: 'ghost', onClick: ({ close }) => close() },
      {
        label: '保存并关闭', cls: 'primary',
        onClick: async ({ close }) => {
          try {
            await api('/admin/cover', { method: 'PUT', body: draft })
            toast('扉页已保存')
            close()
            loadContent()
          } catch (err) { toast(err.message, true) }
        },
      },
    ],
  })
}

/* ── tiny UI kit: escape, modal, confirm ──────────────────────────────── */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  })
}

/* modals stack: opening a card from inside a card must not close the one underneath */
const overlayStack = []

function openModal(opts) {
  const overlay = el('div', { class: 'modal-overlay' })
  const box = el('div', { class: 'modal' + (opts.wide ? ' wide' : '') + (opts.className ? ' ' + opts.className : '') })
  const head = el('div', { class: 'modal-head' },
    el('h3', {}, opts.title || ''),
    el('button', { class: 'modal-x', type: 'button', 'aria-label': '关闭', onclick: () => closeOverlay(overlay) }, '×'))
  const bodyEl = el('div', { class: 'modal-body' })
  if (typeof opts.body === 'string') bodyEl.innerHTML = opts.body
  else if (opts.body) bodyEl.append(opts.body)
  const foot = el('div', { class: 'modal-foot' })
  ;(opts.actions || []).forEach((a) => {
    foot.append(el('button', {
      class: 'btn ' + (a.cls || 'ghost'), type: 'button',
      onclick: () => { a.onClick ? a.onClick({ close: () => closeOverlay(overlay) }) : closeOverlay(overlay) },
    }, a.label))
  })
  box.append(head, bodyEl, foot)
  overlay.append(box)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(overlay) })
  document.body.append(overlay)
  overlayStack.push(overlay)
  return { close: () => closeOverlay(overlay), body: bodyEl, overlay }
}

function closeOverlay(overlay) {
  if (!overlay) return
  const at = overlayStack.indexOf(overlay)
  if (at >= 0) overlayStack.splice(at, 1)
  overlay.remove()
}

function closeModal() {
  closeOverlay(overlayStack[overlayStack.length - 1])
}

function topOverlay() {
  return overlayStack[overlayStack.length - 1] || null
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && overlayStack.length) closeModal()
})

function confirmDialog(opts) {
  return new Promise((resolve) => {
    let answered = false
    const settle = (value) => { if (answered) return; answered = true; resolve(value) }
    const modal = openModal({
      title: opts.title || '确认',
      body: '<p class="modal-text">' + esc(opts.text || '') + '</p>',
      actions: [
        { label: '取消', cls: 'ghost', onClick: ({ close }) => { settle(false); close() } },
        { label: opts.confirmLabel || '确认', cls: opts.danger ? 'danger' : 'primary', onClick: ({ close }) => { settle(true); close() } },
      ],
    })
    /* closing the confirm by X / backdrop / Esc counts as cancel */
    const obs = new MutationObserver(() => {
      if (!modal.overlay.isConnected && !answered) { answered = true; resolve(false); obs.disconnect() }
    })
    obs.observe(document.body, { childList: true })
  })
}

/* ── collection module: a repository + the slice the site shows ──────────
   One implementation drives 项目页 and 专利页: sidebar, search, pagination, multi-select
   delete with confirmation, a detail editor and a picker that adds from the repository. */

const COLLECTION_PER = 12

const COLLECTIONS = {
  projects: {
    key: 'projects',
    noun: '项目卡片',
    nounShort: '项目',
    repo: { label: '项目仓库', hint: '所有做过的项目卡片' },
    shown: { label: '展示项目', hint: '前台读取并展示的项目' },
    search: '按名称搜索…',
    titleField: 'name',
    subtitleField: 'line',
    fields: [
      { name: 'name', label: '名称', type: 'text', placeholder: '例如 Lights' },
      { name: 'line', label: '说明', type: 'textarea', rows: 3 },
      { name: 'image', label: '图片', type: 'image', profile: 'project' },
      { name: 'alt', label: '图片描述 alt', type: 'text' },
    ],
    orderNote: '这里是前台「项目」牌堆读取的卡片，顺序即展示顺序',
  },
  patents: {
    key: 'patents',
    noun: '专利图片',
    nounShort: '专利',
    repo: { label: '专利仓库', hint: '所有上传过的专利图片' },
    shown: { label: '展示专利', hint: '前台专利墙读取的图片' },
    search: '按名称或编号搜索…',
    titleField: 'title',
    subtitleField: 'meta',
    fields: [
      { name: 'title', label: '名称', type: 'text', placeholder: '例如 Chandelier' },
      { name: 'meta', label: '编号/年份', type: 'text' },
      { name: 'image', label: '图片', type: 'image', profile: 'patent' },
      { name: 'alt', label: '图片描述 alt', type: 'text' },
    ],
    orderNote: '这里是前台专利墙读取的图片，顺序决定它在四列中的位置',
    imgFit: 'contain',
  },
  products: {
    key: 'products',
    noun: '商品',
    nounShort: '商品',
    repo: { label: '产品仓库', hint: '所有上传过的商品' },
    shown: { label: '展示商品', hint: '前台产品页读取的商品' },
    search: '按型号或尺寸搜索…',
    titleField: 'model',
    subtitleField: 'spec',
    fields: [
      { name: 'model', label: '型号', type: 'text', placeholder: '例如 70100-12+12L' },
      { name: 'spec', label: '尺寸', type: 'text', placeholder: '例如 ∅1080 · H1160' },
      { name: 'image', label: '图片', type: 'image', profile: 'product' },
      { name: 'alt', label: '图片描述 alt', type: 'text' },
    ],
    orderNote: '这里是前台产品页读取的商品；左侧分组用来筛选',
    groupTags: true,
  },
}

function collectionState(key) {
  state.mod = state.mod || {}
  state.mod[key] = state.mod[key] || {
    mode: 'repo', q: '', page: 1, shownPage: 1, group: '',
  }
  return state.mod[key]
}

function collectionModule(root, cfg) {
  const st = collectionState(cfg.key)
  const apiBase = '/admin/' + cfg.key
  /* the group list (products only): start from the content we already have */
  let groups = (state.data && Array.isArray(state.data.groups)) ? state.data.groups : []

  const body = el('div', { class: 'module-body' })

  const go = (mode) => {
    if (st.mode === mode) return
    st.mode = mode
    render()
  }
  const seg = el('div', { class: 'seg', role: 'tablist' })
  seg.append(
    el('button', {
      class: 'seg-btn' + (st.mode === 'repo' ? ' on' : ''), type: 'button', role: 'tab',
      onclick: () => go('repo'),
    }, cfg.repo.label),
    el('button', {
      class: 'seg-btn' + (st.mode === 'shown' ? ' on' : ''), type: 'button', role: 'tab',
      onclick: () => go('shown'),
    }, cfg.shown.label))

  const bar = el('div', { class: 'module-bar' },
    seg,
    el('span', { class: 'bar-hint' }, st.mode === 'repo' ? cfg.repo.hint : cfg.shown.hint))

  root.append(el('section', { class: 'card' }, bar, body))

  paint()

  async function fetchPage(pageNo, extra) {
    const qs = new URLSearchParams({ page: String(pageNo), per: String((extra && extra.per) || COLLECTION_PER) })
    if (extra && extra.display) qs.set('display', extra.display)
    if (extra && extra.group) qs.set('group', extra.group)
    const q = (extra && extra.q != null ? extra.q : st.q).trim()
    if (q) qs.set('q', q)
    const data = await api(apiBase + '?' + qs.toString())
    if (Array.isArray(data.groups)) groups = data.groups
    return data
  }

  async function paint() {
    body.innerHTML = ''
    body.append(el('p', { class: 'hint' }, '载入中…'))
    try {
      if (st.mode === 'repo') await paintRepo()
      else await paintShown()
    } catch (e) {
      body.innerHTML = ''
      body.append(el('p', { class: 'hint bad' }, '载入失败：' + e.message))
    }
  }

  /* ── repository pane ──────────────────────────────────────────────── */
  async function paintRepo() {
    const data = await fetchPage(st.page)
    st.page = data.page
    body.innerHTML = ''

    const search = el('input', {
      type: 'search', class: 'search', placeholder: cfg.search, value: st.q,
      oninput: (e) => { st.q = e.target.value; st.page = 1; debounce(paint) },
    })
    const batchBtn = el('button', {
      class: 'btn danger', type: 'button',
      onclick: () => deleteDialog('repo', paint),
    }, '删除' + cfg.nounShort)
    const addBtn = el('button', { class: 'btn ok', type: 'button', onclick: () => newRow(paint) }, '+ 新增' + cfg.nounShort)

    const toolbar = el('div', { class: 'toolbar' }, search, el('span', { class: 'toolbar-spacer' }), batchBtn, addBtn)
    body.append(toolbar)
    body.append(el('div', { class: 'meta-line' },
      '共 ' + data.all + ' 个' + cfg.noun + '，其中 ' + data.shown + ' 个在展示中 · 第 ' + data.page + '/' + data.pages + ' 页'))

    if (!data.items.length) {
      body.append(el('p', { class: 'hint' }, st.q ? '没有匹配「' + st.q + '」的内容。' : '仓库还是空的，点右上角「+ 新增' + cfg.nounShort + '」。'))
    } else {
      const grid = el('div', { class: 'pcard-grid' })
      data.items.forEach((row) => {
        grid.append(collectionCard(cfg, row, {
          groups,
          onClick: () => editRow(row, paint),
        }))
      })
      body.append(grid)
    }

    body.append(pager(data, (n) => { st.page = n; paint() }))
  }

  /* ── displayed pane (products: with the group sidebar) ─────────────── */
  async function paintShown() {
    /* there is no "all products" view: the pane always shows one group */
    if (cfg.groupTags && !st.group) {
      const first = groups[0]
      st.group = first ? first.id : ''
    }
    const group = cfg.groupTags ? st.group : ''
    const data = await fetchPage(st.shownPage, { display: '1', group })
    st.shownPage = data.page
    body.innerHTML = ''

    const addBtn = el('button', { class: 'btn ok', type: 'button', onclick: () => pickRows(paint) }, '+ 添加' + cfg.nounShort)
    const batchBtn = el('button', {
      class: 'btn danger', type: 'button',
      onclick: () => deleteDialog('shown', paint),
    }, '移除' + cfg.nounShort)

    /* the two column split is only for the products pane; the others use the full width */
    const main = el('div', { class: 'pane' + (cfg.groupTags ? ' with-side' : '') })
    const content = el('div', { class: 'pane-main' })
    if (cfg.groupTags) main.append(groupSidebar(data), content)
    else main.append(content)

    const groupTitle = (groups.find((g) => g.id === group) || {}).title || ''
    content.append(el('div', { class: 'toolbar' },
      el('span', { class: 'toolbar-note' }, (group
        ? '分组「' + groupTitle + '」 · ' + data.total + ' 个'
        : cfg.orderNote) + ' · 拖动卡片可调整顺序'),
      el('span', { class: 'toolbar-spacer' }), batchBtn, addBtn))
    content.append(el('div', { class: 'meta-line' },
      '展示中 ' + data.total + ' 个 · 第 ' + data.page + '/' + data.pages + ' 页'))

    if (!data.items.length) {
      content.append(el('p', { class: 'hint' }, '这里还没有内容。点「+ 添加' + cfg.nounShort + '」从仓库里挑选。'))
    } else {
      const grid = el('div', { class: 'pcard-grid sortable' })
      const pageIds = data.items.map((x) => x.id)
      data.items.forEach((row, i) => {
        const card = collectionCard(cfg, row, {
          groups,
          order: (data.page - 1) * COLLECTION_PER + i + 1,
          onClick: () => editRow(row, paint),
        })
        card.setAttribute('draggable', 'true')
        card.classList.add('draggable')
        card.dataset.id = row.id

        card.addEventListener('dragstart', (e) => {
          st.dragId = row.id
          try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', row.id) } catch (err) {}
          card.classList.add('dragging')
        })
        card.addEventListener('dragend', () => {
          st.dragId = null
          card.classList.remove('dragging')
          ;[].forEach.call(grid.querySelectorAll('.drop-target'), (n) => n.classList.remove('drop-target'))
        })
        card.addEventListener('dragover', (e) => {
          if (!st.dragId || st.dragId === row.id) return
          e.preventDefault()
          try { e.dataTransfer.dropEffect = 'move' } catch (err) {}
          card.classList.add('drop-target')
        })
        card.addEventListener('dragleave', () => card.classList.remove('drop-target'))
        card.addEventListener('drop', (e) => {
          e.preventDefault()
          card.classList.remove('drop-target')
          const from = st.dragId
          st.dragId = null
          if (from && from !== row.id) reorderTo(from, row.id, pageIds, group)
        })
        grid.append(card)
      })
      content.append(grid)
    }

    content.append(pager(data, (n) => { st.shownPage = n; paint() }))
    body.append(main)
  }

  function groupSidebar(data) {
    const side = el('aside', { class: 'pane-side' })
    const edit = el('button', {
      class: 'btn ghost small', type: 'button', title: '编辑分组',
      onclick: () => groupEditor(() => paint()),
    }, '编辑分组')
    const head = el('div', { class: 'pane-side-head' })
    head.append(el('span', {}, '产品分组'), edit)
    side.append(head)

    if (!groups.length) {
      side.append(el('p', { class: 'hint' }, '还没有分组，点上方「编辑分组」新建。'))
    }

    groups.forEach((g) => {
      const row = el('button', {
        class: 'group-row' + (st.group === g.id ? ' on' : ''), type: 'button',
        onclick: () => { st.group = g.id; st.shownPage = 1; paint() },
      })
      row.append(el('span', {}, g.title || '（未命名）'), el('i', {}, String(g.shown || 0)))
      side.append(row)
    })
    return side
  }

  /* ── the group editor (products) ──────────────────────────────────── */
  function groupEditor(after) {
    const listBox = el('div', { class: 'group-edit-list' })
    const modal = openModal({
      title: '产品分组',
      wide: true,
      body: el('div', {}, el('p', { class: 'hint' }, '分组只在前台产品页当分类用；删除分组时，商品不会删除，只会去掉这个分组标签。'), listBox),
      actions: [
        { label: '关闭', cls: 'ghost', onClick: ({ close }) => close() },
      ],
    })

    const load = async () => {
      const data = await fetchPage(1, { per: 1 })
      listBox.innerHTML = ''
      if (!groups.length) listBox.append(el('p', { class: 'hint' }, '还没有分组。'))
      groups.forEach((g) => {
        const input = el('input', { type: 'text', value: g.title || '' })
        const row = el('div', { class: 'group-edit-row' })
        const count = el('span', { class: 'group-count' }, (g.count || 0) + ' 件')
        const save = el('button', { class: 'btn ghost small', type: 'button' }, '保存')
        save.addEventListener('click', () => busyClick(save, '保存中…', async () => {
          await api('/admin/groups/' + g.id, { method: 'PUT', body: { title: input.value.trim(), note: g.note || '' } })
          toast('分组已重命名')
          g.title = input.value.trim()
          after()
        }))
        const del = el('button', { class: 'btn ghost small danger', type: 'button' }, '删除')
        del.addEventListener('click', async () => {
          const ok = await confirmDialog({
            title: '删除分组',
            text: (g.count || 0) > 0
              ? '「' + (g.title || '未命名') + '」下有 ' + g.count + ' 件商品。删除分组后，这些商品会从该分组中移除（商品本身保留在仓库和展示里）。'
              : '删除分组「' + (g.title || '未命名') + '」？',
            confirmLabel: '删除分组',
            danger: true,
          })
          if (!ok) return
          await api('/admin/groups/' + g.id, { method: 'DELETE' })
          toast('分组已删除')
          await load()
          after()
        })
        row.append(input, count, save, del)
        listBox.append(row)
      })

      const addRow = el('div', { class: 'group-edit-add' })
      const newName = el('input', { type: 'text', placeholder: '新分组名称' })
      const addBtn = el('button', { class: 'btn ok', type: 'button' }, '+ 新增分组')
      addBtn.addEventListener('click', async () => {
        const title = newName.value.trim()
        if (!title) return toast('先填分组名称', true)
        await api('/admin/groups', { method: 'POST', body: { title } })
        newName.value = ''
        toast('已新增分组')
        await load()
        after()
      })
      addRow.append(newName, addBtn)
      listBox.append(addRow)
    }
    load()
  }

  /* ── row editors ──────────────────────────────────────────────────── */
  function textField(f, value, onChange) {
    const input = el('input', { type: 'text', placeholder: f.placeholder || '' })
    input.value = value || ''
    input.addEventListener('input', () => onChange(input.value))
    const lab = el('label', { class: 'field' })
    lab.append(el('span', { class: 'field-label' }, f.label), input)
    return lab
  }

  function textareaField(f, value, onChange) {
    const area = el('textarea', { rows: f.rows || 3 })
    area.value = value || ''
    area.addEventListener('input', () => onChange(area.value))
    const lab = el('label', { class: 'field' })
    lab.append(el('span', { class: 'field-label' }, f.label), area)
    return lab
  }

  function groupTagPicker(selected) {
    const box = el('div', { class: 'group-tags' })
    if (!groups.length) {
      box.append(el('span', { class: 'hint' }, '还没有分组，先到顶栏「编辑分组」里新建。'))
      return box
    }
    groups.forEach((g) => {
      const on = selected.has(g.id)
      const chip = el('button', {
        class: 'group-chip' + (on ? ' on' : ''), type: 'button',
        onclick: () => {
          if (selected.has(g.id)) selected.delete(g.id)
          else selected.add(g.id)
          chip.classList.toggle('on', selected.has(g.id))
        },
      }, g.title || '（未命名）')
      box.append(chip)
    })
    return box
  }

  /* batch delete / un-display: pick rows in a dialog, then confirm once more.
     Products also get the group list on the left, to filter what is on screen. */
  async function deleteDialog(mode, after) {
    const removeFromShow = mode === 'shown'
    const sel = new Set()
    let q = ''
    let pageNo = 1
    let group = cfg.groupTags ? (st.group || (groups[0] && groups[0].id) || '') : ''
    let groupsData = []
    const imgName = cfg.fields.find((f) => f.type === 'image').name

    const listBox = el('div', { class: 'pick-list' })
    const search = el('input', { type: 'search', class: 'search', placeholder: cfg.search })
    const info = el('div', { class: 'meta-line' })
    const sideBox = el('aside', { class: 'del-side' })

    const refresh = () => {
      info.textContent = '共 ' + sel.total + ' 个可选 · 已选 ' + sel.size + ' 个'
      const footerBtn = document.querySelectorAll('.modal-foot .btn')[1]
      if (footerBtn) {
        footerBtn.textContent = sel.size ? (removeFromShow ? '移除选中（' : '删除选中（') + sel.size + '）' : (removeFromShow ? '移除选中' : '删除选中')
        footerBtn.disabled = sel.size === 0
      }
    }

    const mainCol = el('div', { class: 'del-main' }, search, listBox, info)
    const bodyEl = el('div', {},
      el('p', { class: 'hint' }, removeFromShow
        ? '勾选要从展示区移除的' + cfg.noun + '；内容仍保留在仓库里，可以再次添加。'
        : '勾选要从仓库永久删除的' + cfg.noun + '；在展示中的会同时从前台消失，此操作不可撤销。'))
    if (cfg.groupTags) {
      const layout = el('div', { class: 'del-dialog with-side' })
      layout.append(sideBox, mainCol)
      bodyEl.append(layout)
    } else {
      bodyEl.append(mainCol)
    }

    openModal({
      title: removeFromShow ? '从展示中移除' : '删除' + cfg.noun,
      wide: true,
      body: bodyEl,
      actions: [
        { label: '取消', cls: 'ghost', onClick: ({ close }) => close() },
        {
          label: '删除选中', cls: 'danger', disabled: true,
          onClick: async ({ close }) => {
            if (!sel.size) return toast('先勾选要处理的' + cfg.nounShort, true)
            const ids = Array.from(sel)
            const ok = await confirmDialog({
              title: removeFromShow ? '确认移除' : '确认删除',
              text: removeFromShow
                ? '将把 ' + ids.length + ' 个' + cfg.noun + '从展示区移除（内容仍保留在仓库里）。'
                : '将从仓库永久删除 ' + ids.length + ' 个' + cfg.noun + '，其中在展示中的会同时从前台消失。此操作不可撤销。',
              confirmLabel: removeFromShow ? '移除' : '删除',
              danger: true,
            })
            if (!ok) return
            await api(apiBase + '/batch', { method: 'POST', body: { action: removeFromShow ? 'hide' : 'delete', ids } })
            toast(removeFromShow ? '已移除 ' + ids.length + ' 个' : '已删除 ' + ids.length + ' 个')
            close()
            after()
          },
        },
      ],
    })

    const paintSide = () => {
      if (!cfg.groupTags) return
      sideBox.innerHTML = ''
      const head = el('div', { class: 'pane-side-head' }, el('span', {}, removeFromShow ? '展示分组' : '产品分组'))
      sideBox.append(head)

      if (!groupsData.length) {
        sideBox.append(el('p', { class: 'hint' }, '还没有分组'))
      }

      groupsData.forEach((g) => {
        const row = el('button', {
          class: 'group-row' + (group === g.id ? ' on' : ''), type: 'button',
          onclick: () => { group = g.id; pageNo = 1; load() },
        })
        row.append(el('span', {}, g.title || '（未命名）'), el('i', {}, String(removeFromShow ? (g.shown || 0) : (g.count || 0))))
        sideBox.append(row)
      })
    }

    const load = async () => {
      const qs = new URLSearchParams({ page: String(pageNo), per: '10' })
      if (removeFromShow) qs.set('display', '1')
      if (group) qs.set('group', group)
      if (q) qs.set('q', q)
      const data = await api(apiBase + '?' + qs.toString())
      pageNo = data.page
      sel.total = data.total
      if (Array.isArray(data.groups)) groupsData = data.groups
      paintSide()
      listBox.innerHTML = ''
      refresh()
      if (!data.items.length) {
        listBox.append(el('p', { class: 'hint' }, q ? '没有匹配的内容。' : '这里还没有内容。'))
      }
      const rows = el('div', { class: 'pick-list' })
      listBox.append(rows)
      data.items.forEach((row) => {
        const cb = el('input', { type: 'checkbox', checked: sel.has(row.id) })
        const item = el('div', { class: 'pick-del-row' + (sel.has(row.id) ? ' on' : '') })
        const toggle = () => {
          cb.checked = !cb.checked
          if (cb.checked) sel.add(row.id)
          else sel.delete(row.id)
          item.classList.toggle('on', cb.checked)
          refresh()
        }
        cb.addEventListener('change', () => {
          if (cb.checked) sel.add(row.id)
          else sel.delete(row.id)
          item.classList.toggle('on', cb.checked)
          refresh()
        })
        item.addEventListener('click', (e) => {
          if (e.target.closest('.pd-actions')) return
          toggle()
        })

        /* look at it without leaving the dialog */
        const detail = el('button', {
          class: 'pd-detail', type: 'button', title: '打开详情',
          onclick: (e) => {
            e.stopPropagation()
            editRow(row, () => { load(); after() })
          },
        }, '详情')

        const actions = el('div', { class: 'pd-actions' },
          row.displayed !== false ? el('span', { class: 'tag ok' }, '展示中') : el('span', { class: 'tag' }, '仓库'),
          detail)

        item.append(cb,
          el('img', { src: previewSrc(row[imgName]), alt: '', loading: 'lazy' }),
          el('span', { class: 'pd-name' }, row[cfg.titleField] || '（未命名）'),
          el('span', { class: 'pd-sub' }, row[cfg.subtitleField] || ''),
          actions)
        rows.append(item)
      })
      listBox.append(pager(data, (n) => { pageNo = n; load() }))
    }
    search.addEventListener('input', () => { q = search.value; pageNo = 1; debounce(load) })
    load()
  }

  function rowForm(draft, opts) {
    const imgField = cfg.fields.find((f) => f.type === 'image')
    const left = el('div', {})
    left.append(imageField(imgField.label, draft[imgField.name], (v) => { draft[imgField.name] = v }, 'image', imgField.profile || 'image'))

    const right = el('div', {})
    cfg.fields.filter((f) => f.type !== 'image').forEach((f) => {
      right.append(f.type === 'textarea'
        ? textareaField(f, draft[f.name], (v) => { draft[f.name] = v })
        : textField(f, draft[f.name], (v) => { draft[f.name] = v }))
    })

    let tagsBox = null
    const tags = new Set(draft.groupIds || [])
    if (cfg.groupTags) {
      const wrap = el('div', { class: 'field' })
      wrap.append(el('span', { class: 'field-label' }, '所属分组（可多选）'))
      tagsBox = groupTagPicker(tags)
      wrap.append(tagsBox)
      right.append(wrap)
    }

    const shown = el('input', { type: 'checkbox', checked: draft.displayed !== false })
    const check = el('label', { class: 'check-row' })
    check.append(shown, el('span', {}, '在展示区中显示（前台可见）'))
    right.append(check)

    const grid = el('div', { class: 'modal-grid' })
    grid.append(left, right)
    return { grid, tags, shown }
  }

  function newRow(after) {
    const draft = { displayed: false, groupIds: st.group ? [st.group] : [] }
    cfg.fields.forEach((f) => { draft[f.name] = '' })
    const parts = rowForm(draft)
    openModal({
      title: '新增' + cfg.noun,
      wide: true,
      body: parts.grid,
      actions: [
        { label: '取消', cls: 'ghost', onClick: ({ close }) => close() },
        {
          label: '新增', cls: 'ok',
          onClick: async ({ close }) => {
            try {
              const payload = {}
              cfg.fields.forEach((f) => { payload[f.name] = draft[f.name] })
              payload.groupIds = Array.from(parts.tags)
              payload.displayed = false
              await api(apiBase, { method: 'POST', body: payload })
              close(); toast('已新增到' + cfg.repo.label); after()
            } catch (e) { toast(e.message, true) }
          },
        },
      ],
    })
  }

  function editRow(row, after) {
    const draft = { ...row }
    const parts = rowForm(draft, { editing: true })
    openModal({
      title: cfg.noun,
      wide: true,
      body: parts.grid,
      actions: [
        { label: '取消', cls: 'ghost', onClick: ({ close }) => close() },
        {
          label: '保存', cls: 'primary',
          onClick: async ({ close }) => {
            try {
              const payload = {}
              cfg.fields.forEach((f) => { payload[f.name] = draft[f.name] })
              if (cfg.groupTags) payload.groupIds = Array.from(parts.tags)
              payload.displayed = parts.shown.checked
              await api(apiBase + '/' + row.id, { method: 'PUT', body: payload })
              close(); toast('已保存'); after()
            } catch (e) { toast(e.message, true) }
          },
        },
      ],
    })
  }

  /* ── pick from the repository (same card on every page) ───────────── */
  async function pickRows(after) {
    const sel = new Set()
    let q = ''
    let pageNo = 1
    const listBox = el('div', { class: 'pick-grid' })
    const search = el('input', { type: 'search', class: 'search', placeholder: '搜索仓库里的' + cfg.nounShort + '…' })
    const info = el('div', { class: 'meta-line' })
    openModal({
      title: '从' + cfg.repo.label + '添加',
      wide: true,
      body: el('div', {}, search, info, listBox),
      actions: [
        { label: '取消', cls: 'ghost', onClick: ({ close }) => close() },
        {
          label: '添加', cls: 'ok',
          onClick: async ({ close }) => {
            if (!sel.size) return toast('先选择内容', true)
            await api(apiBase + '/batch', { method: 'POST', body: { action: 'show', ids: Array.from(sel) } })
            close(); toast('已添加 ' + sel.size + ' 个到展示区'); after()
          },
        },
      ],
    })

    const imgName = cfg.fields.find((f) => f.type === 'image').name
    const countLine = (data) => '仓库中共 ' + data.total + ' 个 · 第 ' + data.page + '/' + data.pages + ' 页 · 已选 ' + sel.size

    const load = async () => {
      /* the whole repository, not just what is hidden */
      const qs = new URLSearchParams({ page: String(pageNo), per: '12' })
      if (q) qs.set('q', q)
      const data = await api(apiBase + '?' + qs.toString())
      pageNo = data.page
      listBox.innerHTML = ''
      info.textContent = countLine(data)
      if (!data.items.length) listBox.append(el('p', { class: 'hint' }, q ? '没有匹配的内容。' : '仓库还是空的。'))

      const grid = el('div', { class: 'pick-cards' })
      data.items.forEach((row) => {
        const card = el('div', {
          class: 'pick-card' + (sel.has(row.id) ? ' on' : ''), role: 'button', tabindex: '0',
          'aria-pressed': sel.has(row.id) ? 'true' : 'false',
        })
        const toggle = () => {
          if (sel.has(row.id)) sel.delete(row.id)
          else sel.add(row.id)
          const on = sel.has(row.id)
          card.classList.toggle('on', on)
          card.setAttribute('aria-pressed', on ? 'true' : 'false')
          const mark = card.querySelector('.pick-check')
          if (mark) mark.textContent = on ? '✓' : ''
          info.textContent = countLine(data)
        }
        card.addEventListener('click', toggle)
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() }
        })
        card.innerHTML =
          '<span class="pick-check">' + (sel.has(row.id) ? '✓' : '') + '</span>' +
          (row.displayed !== false ? '<span class="pick-flag">已展示</span>' : '') +
          '<div class="pick-media' + (cfg.imgFit === 'contain' ? ' contain' : '') + '">' +
          '<img src="' + esc(previewSrc(row[imgName])) + '" alt="" loading="lazy"></div>' +
          '<div class="pick-body"><strong>' + esc(row[cfg.titleField] || '（未命名）') + '</strong>' +
          '<span>' + esc((row[cfg.subtitleField] || '').slice(0, 40)) + '</span></div>'
        grid.append(card)
      })
      listBox.append(grid)
      listBox.append(pager(data, (n) => { pageNo = n; load() }))
    }
    search.addEventListener('input', () => { q = search.value; pageNo = 1; debounce(load) })
    load()
  }

  /* drop row `fromId` where `toId` sits, keeping every other card where it was.
     The ids on this page are re-slotted, so this also works when a group filter is on. */
  async function reorderTo(fromId, toId, pageIds, group) {
    const order = pageIds.slice()
    const from = order.indexOf(fromId)
    const to = order.indexOf(toId)
    if (from < 0 || to < 0 || from === to) return

    /* move the nodes first, so nothing has to be repainted (a repaint is what made the
       grid flash); the numbers are rewritten in place */
    const grid = document.querySelector('#view .pcard-grid.sortable')
    const nodes = grid ? [].slice.call(grid.children) : []
    if (grid && nodes.length) {
      const base = Number((nodes[0].querySelector('.pcard-order') || { textContent: '#1' }).textContent.replace('#', '')) - 1 || 0
      const fromNode = nodes.find((n) => n.dataset.id === fromId)
      const toNode = nodes.find((n) => n.dataset.id === toId)
      if (fromNode && toNode) {
        const arr = nodes.slice()
        arr.splice(arr.indexOf(fromNode), 1)
        arr.splice(arr.indexOf(toNode), 0, fromNode)
        arr.forEach((n) => grid.appendChild(n))
        arr.forEach((n, i) => {
          const badge = n.querySelector('.pcard-order')
          if (badge) badge.textContent = '#' + (base + i + 1)
        })
      }
    }

    const all = await fetchPage(1, { display: '1', per: 500, group: group || '' })
    const allIds = all.items.map((x) => x.id)
    const slots = order.map((id) => allIds.indexOf(id)).filter((i) => i >= 0).sort((a, b) => a - b)
    if (!slots.length) return

    order.splice(to, 0, order.splice(from, 1)[0])
    slots.forEach((slot, i) => { allIds[slot] = order[i] })

    try {
      await api(apiBase + '/display-order', { method: 'PUT', body: { ids: allIds } })
      toast('顺序已更新')
    } catch (err) {
      toast(err.message, true)
      paint() /* only a failed write needs a full resync */
    }
  }
}

function collectionCard(cfg, row, opts) {
  const card = el('div', {
    class: 'pcard' + (opts.selected ? ' sel' : '') + (opts.selecting ? ' is-selectable' : ''),
    role: 'button', tabindex: '0',
    onclick: opts.onClick,
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onClick() } },
  })
  const imgName = cfg.fields.filter((f) => f.type === 'image').map((f) => f.name)[0]

  let tagsHtml = ''
  if (cfg.groupTags) {
    const names = (row.groupIds || []).map((id) => ((opts.groups || []).find((g) => g.id === id) || {}).title).filter(Boolean)
    if (names.length) {
      tagsHtml = '<div class="pcard-tags">' + names.slice(0, 3).map((n) => '<span class="tag">' + esc(n) + '</span>').join('') +
        (names.length > 3 ? '<span class="tag">+' + (names.length - 3) + '</span>' : '') + '</div>'
    }
  }

  card.innerHTML =
    (opts.selecting ? '<span class="pcard-check">' + (opts.selected ? '✓' : '') + '</span>' : '') +
    (opts.order ? '<span class="pcard-order">#' + opts.order + '</span>' : '') +
    '<div class="pcard-media' + (cfg.imgFit === 'contain' ? ' contain' : '') + '"><img src="' +
      esc(previewSrc(row[imgName])) + '" alt="" loading="lazy"></div>' +
    '<div class="pcard-body"><strong>' + esc(row[cfg.titleField] || '（未命名）') + '</strong>' +
    '<span>' + esc((row[cfg.subtitleField] || '').slice(0, 80)) + '</span></div>' +
    tagsHtml +
    '<div class="pcard-foot">' +
    (row.displayed !== false ? '<span class="tag ok">展示中</span>' : '<span class="tag">仓库</span>') +
    '</div>'
  return card
}

function debounce(fn) {
  clearTimeout(debounce._t)
  debounce._t = setTimeout(fn, 280)
}

function pager(data, go) {
  const bar = el('div', { class: 'pager' })
  const prev = el('button', { class: 'btn ghost small', type: 'button', disabled: data.page <= 1, onclick: () => go(data.page - 1) }, '上一页')
  const next = el('button', { class: 'btn ghost small', type: 'button', disabled: data.page >= data.pages, onclick: () => go(data.page + 1) }, '下一页')
  bar.append(prev, el('span', { class: 'pager-count' }, '第 ' + data.page + ' / ' + data.pages + ' 页 · 共 ' + data.total + ' 个'), next)
  return bar
}

function viewProjects(root) {
  collectionModule(root, COLLECTIONS.projects)
}

function viewPatents(root) {
  collectionModule(root, COLLECTIONS.patents)
}

function viewProducts(root) {
  collectionModule(root, COLLECTIONS.products)
}

function textareaLines(label, values, onInput, hint) {
  const area = el('textarea', {
    rows: Math.max(2, (values || []).length + 1),
    oninput: (e) => onInput(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean)),
  })
  area.value = (values || []).join('\n')
  return el('label', { class: 'field' },
    el('span', { class: 'field-label' }, label),
    hint ? el('span', { class: 'hint small' }, hint) : null,
    area)
}

function secHead(num, title, hint) {
  const head = el('div', { class: 'sec-head' })
  head.append(el('span', { class: 'sec-num' }, num), el('h3', {}, title))
  if (hint) head.append(el('p', {}, hint))
  return head
}

function plateHead(label, note, tools) {
  const head = el('div', { class: 'plate-card-head' })
  head.append(el('span', { class: 'plate-num' }, label), el('span', { class: 'plate-label' }, note))
  if (tools) {
    const box = el('div', { class: 'plate-tools' })
    tools.forEach((t) => box.append(t))
    head.append(box)
  }
  return head
}

function mediaColumn(imgField) {
  const col = el('div', {})
  col.append(imgField)
  return col
}

function fieldColumn(children) {
  const col = el('div', {})
  children.filter(Boolean).forEach((c) => col.append(c))
  return col
}

function twoCol(media, fields) {
  const grid = el('div', { class: 'modal-grid' })
  grid.append(mediaColumn(media), fieldColumn(fields))
  return grid
}

/* the craft section editor: one card per concern, numbered, so the parts of the page
   never blur into one long form */
function viewCraft(root) {
  const c = state.data.craft
  if (!c) {
    const empty = el('section', { class: 'card' })
    empty.append(el('h2', {}, '工艺段'), el('p', { class: 'hint' }, '这条内容还没有数据，先保存一次会建立默认结构。'))
    root.append(empty)
    return
  }

  const draft = JSON.parse(JSON.stringify(c))
  draft.eyebrow = draft.eyebrow || {}
  draft.plates = draft.plates || []
  draft.close = draft.close || {}
  const close = draft.close
  close.cta = close.cta || {}

  /* ── 01 · 段落标题 ─────────────────────────────────────────────────── */
  const introFields = el('div', { class: 'grid2' })
  introFields.append(
    field('眉标左（The hand）', draft.eyebrow.lead, (v) => { draft.eyebrow.lead = v }),
    field('眉标右（Cut · strung · lit）', draft.eyebrow.items, (v) => { draft.eyebrow.items = v }))

  const secIntro = el('section', { class: 'card sec' })
  secIntro.append(
    secHead('01', '段落标题', '前台这段文字的眉标与大标题'),
    introFields,
    textareaLines('大标题（每行一段，前台按行断开）', draft.title, (v) => { draft.title = v }))

  /* ── 02 · 图文块 ───────────────────────────────────────────────────── */
  const platesBox = el('div', { class: 'plate-list' })

  const buildPlate = (pl, i) => {
    const card = el('div', { class: 'plate-card' })

    const up = el('button', {
      class: 'btn ghost small', type: 'button', title: '上移',
      onclick: () => {
        if (i === 0) return
        const swap = draft.plates[i - 1]
        draft.plates[i - 1] = draft.plates[i]
        draft.plates[i] = swap
        paintPlates()
      },
    }, '↑')
    const down = el('button', {
      class: 'btn ghost small', type: 'button', title: '下移',
      onclick: () => {
        if (i >= draft.plates.length - 1) return
        const swap = draft.plates[i + 1]
        draft.plates[i + 1] = draft.plates[i]
        draft.plates[i] = swap
        paintPlates()
      },
    }, '↓')
    const del = el('button', {
      class: 'btn ghost small danger', type: 'button',
      onclick: () => { draft.plates.splice(i, 1); paintPlates() },
    }, '删除')

    const layout = el('select', { onchange: (e) => { pl.layout = e.target.value } })
    layout.append(
      el('option', { value: 'media-left', selected: pl.layout !== 'media-right' }, '图在左 / 文在右'),
      el('option', { value: 'media-right', selected: pl.layout === 'media-right' }, '文在左 / 图在右'))
    const layoutField = el('label', { class: 'field' })
    layoutField.append(el('span', { class: 'field-label' }, '版式'), layout)

    const thumb = imageField('图片', pl.image, (v) => { pl.image = v }, 'image', 'craft')
    const parallaxRow = el('div', { class: 'grid2' })
    parallaxRow.append(
      field('视差强度 0–0.5', String(pl.parallax || 0.16), (v) => { pl.parallax = Number(v) || 0 }),
      field('图片描述 alt', pl.alt, (v) => { pl.alt = v }))

    card.append(
      plateHead('图 ' + (i + 1), pl.label || '（未填小标签）',
        [el('span', { class: 'plate-layout' }, pl.layout === 'media-right' ? '文在左 · 图在右' : '图在左 · 文在右'), up, down, del]),
      twoCol(thumb, [
        layoutField,
        field('小标签（Cut / Strung / Lit）', pl.label, (v) => { pl.label = v }),
        textareaLines('标题（每行一段）', pl.title, (v) => { pl.title = v }),
        field('正文', pl.body, (v) => { pl.body = v }, { multiline: true }),
        parallaxRow,
      ]))
    return card
  }

  const paintPlates = () => {
    platesBox.innerHTML = ''
    draft.plates.forEach((pl, i) => platesBox.append(buildPlate(pl, i)))

    const addBtn = el('button', {
      class: 'btn ghost', type: 'button',
      onclick: () => {
        if (draft.plates.length >= 4) return toast('最多 4 块图文', true)
        draft.plates.push({
          id: '', layout: draft.plates.length % 2 ? 'media-right' : 'media-left',
          label: '', title: [], body: '', image: '', alt: '', parallax: 0.16,
        })
        paintPlates()
      },
    }, '+ 增加一块图文')
    const addRow = el('div', { class: 'plate-add' })
    addRow.append(addBtn, el('span', {}, '建议 2–3 块：图左、图右交替，读完自然落到收尾块'))
    platesBox.append(addRow)
  }
  paintPlates()

  const secPlates = el('section', { class: 'card sec' })
  secPlates.append(
    secHead('02', '图文块', '按顺序排布，前台逐块交替出现'),
    platesBox)

  /* ── 03 · 收尾块 ───────────────────────────────────────────────────── */
  const closeCard = el('div', { class: 'plate-card close-card' })

  const closeParallax = el('div', { class: 'grid2' })
  closeParallax.append(
    field('视差强度', String(close.parallax || 0.1), (v) => { close.parallax = Number(v) || 0 }),
    field('图片描述 alt', close.alt, (v) => { close.alt = v }))

  const closeCta = el('div', { class: 'grid2' })
  closeCta.append(
    field('按钮文字', close.cta.label, (v) => { close.cta.label = v }),
    field('按钮链接', close.cta.href, (v) => { close.cta.href = v }))

  closeCard.append(
    plateHead('收尾', close.label || '（未填小标签）', [el('span', { class: 'plate-layout' }, '通栏大图 + 文案 + 按钮')]),
    twoCol(
      imageField('收尾大图', close.image, (v) => { close.image = v }, 'image', 'craft'),
      [
        field('小标签（Lit）', close.label, (v) => { close.label = v }),
        textareaLines('标题（每行一段）', close.title, (v) => { close.title = v }),
        field('正文', close.body, (v) => { close.body = v }, { multiline: true }),
        closeParallax,
        closeCta,
      ]))

  const secClose = el('section', { class: 'card sec sec-last' })
  secClose.append(
    secHead('03', '收尾块', '一张大图 + Lit 标题 + 咨询按钮，是这段的落点'),
    closeCard)

  /* ── save bar ──────────────────────────────────────────────────────── */
  const saveBtn = el('button', {
    class: 'btn primary', type: 'button',
    onclick: (e) => busyClick(e.currentTarget, '保存中…', async () => {
      try {
        state.data.craft = await api('/admin/craft', { method: 'PUT', body: draft })
        toast('工艺段已保存')
      } catch (err) { toast(err.message, true) }
    }),
  }, '保存工艺段')
  const saveBar = el('div', { class: 'save-bar' })
  saveBar.append(el('span', { class: 'save-hint' }, '三个部分一起保存'), saveBtn)

  root.append(secIntro, secPlates, secClose, saveBar)
}

/* lines of "a | b" → [{a,b}] and back */
function pairText(rows, keys) {
  return (rows || []).map((r) => keys.map((k) => r[k] || '').join(' | ')).join('\n')
}
function readPairs(text, keys) {
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split('|').map((x) => x.trim())
    const out = {}
    keys.forEach((k, i) => { out[k] = parts[i] || '' })
    return out
  })
}

/* The footer editor is deliberately narrow: the only part that changes day to day is the
   "Connect with us" list. It is a table, like the other collections: a header row, one row
   per link, a detail card to edit, and add / batch-delete in the top bar. Everything else
   in the footer is left untouched. */
const SOCIAL_KINDS = [
  { id: 'facebook', label: 'Facebook', badge: 'FB' },
  { id: 'whatsapp', label: 'WhatsApp', badge: 'WA' },
  { id: 'instagram', label: 'Instagram', badge: 'IG' },
  { id: 'douyin', label: '抖音 / TikTok', badge: 'DY' },
  { id: 'wechat', label: '微信', badge: 'WX' },
  { id: 'link', label: '其他链接', badge: '↗' },
]

function socialKind(kind) {
  return SOCIAL_KINDS.find((k) => k.id === kind) || SOCIAL_KINDS[SOCIAL_KINDS.length - 1]
}

function socialBadge(kind) {
  const meta = socialKind(kind)
  const el = document.createElement('span')
  el.className = 'social-badge'
  el.textContent = meta.badge
  el.title = meta.label
  return el
}

function viewFooter(root) {
  const f = state.data.footer
  if (!f) {
    root.append(el('section', { class: 'card' }, el('h2', {}, '页脚'), el('p', { class: 'hint' }, '还没有页脚数据。')))
    return
  }

  const draft = JSON.parse(JSON.stringify(f))
  if (!Array.isArray(draft.columns)) draft.columns = []
  let colIndex = draft.columns.findIndex((c) => Array.isArray(c.socials))
  if (colIndex < 0) {
    draft.columns.push({ title: 'Connect with us', socials: [] })
    colIndex = draft.columns.length - 1
  }
  const col = draft.columns[colIndex]
  if (!Array.isArray(col.socials)) col.socials = []

  const listBox = el('div', { class: 'link-table' })
  const meta = el('div', { class: 'meta-line' })
  const status = el('span', { class: 'save-hint' }, '')

  /* every change is written straight away: there is no save button */
  const persist = async (label) => {
    try {
      state.data.footer = await api('/admin/footer', { method: 'PUT', body: draft })
      status.textContent = '已保存 · ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      toast(label || '已保存')
    } catch (err) {
      status.textContent = '保存失败：' + err.message
      toast(err.message, true)
    }
  }

  const nameOf = (soc) => soc.name || socialKind(soc.kind).label

  function paint() {
    listBox.innerHTML = ''
    meta.textContent = '共 ' + col.socials.length + ' 个链接'

    const head = el('div', { class: 'link-row link-head' })
    head.append(el('span', {}, '#'), el('span', {}, '名称'), el('span', {}, '平台'), el('span', {}, '链接'))
    listBox.append(head)

    if (!col.socials.length) {
      listBox.append(el('p', { class: 'hint' }, '还没有链接。点右上角「+ 增加链接」。'))
    }

    col.socials.forEach((soc, i) => {
      const row = el('div', { class: 'link-row', role: 'button', tabindex: '0' })
      const open = () => editSocial(soc, i)
      row.addEventListener('click', open)
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } })

      const plat = el('span', { class: 'link-plat' })
      plat.append(socialBadge(soc.kind), el('span', {}, socialKind(soc.kind).label))
      const url = el('span', { class: 'link-url' }, soc.href || '（未填）')
      url.title = soc.href || ''
      row.append(
        el('span', { class: 'link-idx' }, String(i + 1)),
        el('span', { class: 'link-name' }, nameOf(soc)),
        plat,
        url)
      listBox.append(row)
    })
  }

  function editSocial(soc, index) {
    const isNew = typeof index !== 'number'
    const draftRow = isNew
      ? { kind: 'facebook', name: 'Facebook', href: '', note: '' }
      : { ...soc }

    const name = el('input', { type: 'text', placeholder: '例如 官方 Facebook' })
    name.value = draftRow.name || ''
    const kind = el('select', {})
    SOCIAL_KINDS.forEach((k) => kind.append(el('option', { value: k.id, selected: k.id === draftRow.kind }, k.label)))
    kind.value = draftRow.kind || 'link'
    const url = el('input', { type: 'url', class: 'text-input', placeholder: 'https://…', spellcheck: 'false' })
    url.value = draftRow.href || ''
    const note = el('textarea', { rows: 3, placeholder: '备注：这个链接用来做什么，例如 私信咨询 / 项目合作' })
    note.value = draftRow.note || ''

    const label = (text, control) => {
      const lab = el('label', { class: 'field' })
      lab.append(el('span', { class: 'field-label' }, text), control)
      return lab
    }
    const bodyEl = el('div', {},
      el('div', { class: 'grid2' }, label('名称', name), label('平台', kind)),
      label('链接', url),
      label('备注', note))

    openModal({
      title: isNew ? '增加链接' : '链接详情',
      body: bodyEl,
      actions: [
        { label: '取消', cls: 'ghost', onClick: ({ close }) => close() },
        {
          label: isNew ? '增加' : '保存', cls: isNew ? 'ok' : 'primary',
          onClick: async ({ close }) => {
            const href = url.value.trim()
            if (!href) return toast('先填链接地址', true)
            if (!/^(https?:\/\/|mailto:|tel:)/i.test(href)) return toast('链接要以 http(s):// 开头', true)
            const picked = SOCIAL_KINDS.find((k) => k.id === kind.value) || SOCIAL_KINDS[SOCIAL_KINDS.length - 1]
            const rowData = {
              kind: kind.value,
              name: name.value.trim() || picked.label,
              href,
              note: note.value.trim(),
              aria: 'NCL on ' + picked.label,
            }
            if (isNew) col.socials.push(rowData)
            else col.socials[index] = rowData
            close()
            paint()
            await persist(isNew ? '已增加链接' : '已保存')
          },
        },
      ],
    })
  }

  /* delete: a dialog to pick which links, then a second confirmation */
  function openDelete() {
    if (!col.socials.length) return toast('还没有链接可删除', true)
    const sel = new Set()

    const rowsBox = el('div', { class: 'del-list' })
    const info = el('div', { class: 'meta-line' })

    const refresh = () => {
      info.textContent = '共 ' + col.socials.length + ' 个链接 · 已选 ' + sel.size + ' 个'
      rowsBox.querySelectorAll('.del-row').forEach((row, i) => row.classList.toggle('on', sel.has(i)))
      const footerBtn = document.querySelectorAll('.modal-foot .btn')[1]
      if (footerBtn) {
        footerBtn.textContent = sel.size ? '删除选中（' + sel.size + '）' : '删除选中'
        footerBtn.disabled = sel.size === 0
      }
    }

    col.socials.forEach((soc, i) => {
      const row = el('label', { class: 'del-row' })
      const cb = el('input', { type: 'checkbox' })
      cb.addEventListener('change', () => {
        if (cb.checked) sel.add(i)
        else sel.delete(i)
        refresh()
      })
      const plat = el('span', { class: 'link-plat' })
      plat.append(socialBadge(soc.kind), el('span', {}, socialKind(soc.kind).label))
      const url = el('span', { class: 'del-url' }, soc.href || '')
      url.title = soc.href || ''
      row.append(cb, el('span', { class: 'del-name' }, nameOf(soc)), plat, url)
      rowsBox.append(row)
    })

    openModal({
      title: '删除链接',
      wide: true,
      body: el('div', {}, el('p', { class: 'hint' }, '勾选要从前台页脚移除的链接，删除后不可撤销。'), rowsBox, info),
      actions: [
        { label: '取消', cls: 'ghost', onClick: ({ close }) => close() },
        {
          label: '删除选中', cls: 'danger',
          onClick: async ({ close }) => {
            if (!sel.size) return toast('先勾选要删除的链接', true)
            const idx = Array.from(sel).sort((a, b) => b - a)
            const ok = await confirmDialog({
              title: '确认删除',
              text: '将从前台页脚移除 ' + idx.length + ' 个链接：' +
                idx.map((i) => '「' + nameOf(col.socials[i]) + '」').join('、') + '。此操作不可撤销。',
              confirmLabel: '删除',
              danger: true,
            })
            if (!ok) return
            idx.forEach((i) => col.socials.splice(i, 1))
            close()
            paint()
            await persist('已删除 ' + idx.length + ' 个链接')
          },
        },
      ],
    })
    refresh()
  }

  const addBtn = el('button', { class: 'btn ok', type: 'button', onclick: () => editSocial(null, undefined) }, '+ 增加链接')
  const delBtn = el('button', { class: 'btn danger', type: 'button', onclick: openDelete }, '删除链接')

  const sec = el('section', { class: 'card sec' })
  sec.append(
    secHead('页脚', 'Connect with us', '点一行打开详情卡片，可改名称、平台、链接与备注；改动即时保存'),
    el('div', { class: 'toolbar' },
      el('span', { class: 'toolbar-note' }, '这里是前台页脚「Connect with us」的图标链接'),
      el('span', { class: 'toolbar-spacer' }),
      delBtn, addBtn),
    meta,
    listBox,
    el('div', { class: 'footer-status' }, status))

  paint()
  root.append(sec)
}

/* ── boot ─────────────────────────────────────────────────────────────── */
document.addEventListener('click', (e) => {
  const tab = e.target.closest('#tabs button')
  if (!tab) return
  state.view = tab.dataset.view
  render()
})

;(async function boot() {
  try {
    const me = await api('/auth/me')
    showApp(me.email)
  } catch {
    /* a slow /me can resolve after someone already signed in: never hide the app then */
    if ($('#app').hidden) showLogin()
  }
})()
