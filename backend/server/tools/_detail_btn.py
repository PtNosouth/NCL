"""Stackable modals + a detail button on every row of the delete dialogs."""
import io

p = "admin/admin.js"
s = io.open(p, encoding="utf-8").read()

# ── 1. the modal kit becomes a stack, so a detail card can open on top ──
start = s.index("let openOverlay = null")
end = s.index("/* ── collection module")
NEW_KIT = r'''/* modals stack: opening a card from inside a card must not close the one underneath */
const overlayStack = []

function openModal(opts) {
  const overlay = el('div', { class: 'modal-overlay' })
  const box = el('div', { class: 'modal' + (opts.wide ? ' wide' : '') })
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

'''
s = s[:start] + NEW_KIT + s[end:]
io.open(p, "w", encoding="utf-8").write(s)
print("modal stack")

# ── 2. delete dialog rows: real divs + a detail button ──────────────────
old = """      data.items.forEach((row) => {
        const cb = el('input', { type: 'checkbox', checked: sel.has(row.id) })
        const item = el('label', { class: 'pick-del-row' + (sel.has(row.id) ? ' on' : '') })
        cb.addEventListener('change', () => {
          if (cb.checked) sel.add(row.id)
          else sel.delete(row.id)
          item.classList.toggle('on', cb.checked)
          refresh()
        })
        item.append(cb,
          el('img', { src: previewSrc(row[imgName]), alt: '', loading: 'lazy' }),
          el('span', { class: 'pd-name' }, row[cfg.titleField] || '（未命名）'),
          el('span', { class: 'pd-sub' }, row[cfg.subtitleField] || ''),
          row.displayed !== false ? el('span', { class: 'tag ok' }, '展示中') : el('span', { class: 'tag' }, '仓库'))
        rows.append(item)
      })"""
new = """      data.items.forEach((row) => {
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
      })"""
assert old in s
s = s.replace(old, new, 1)
io.open(p, "w", encoding="utf-8").write(s)
print("detail button per row")

# ── 3. styles ───────────────────────────────────────────────────────────
p = "admin/admin.css"
s = io.open(p, encoding="utf-8").read()
if ".pd-detail" not in s:
    s += """
/* ── the detail button inside the delete dialogs ───────────────────────── */
.pick-del-row { grid-template-columns: 20px 46px minmax(0, 1fr) minmax(0, 1fr) auto; }
.pd-actions { display: flex; align-items: center; gap: 8px; justify-content: flex-end }
.pd-detail {
  padding: 4px 9px; border-radius: 7px; border: 1px solid var(--line);
  background: #12100e; color: var(--ink-2); font: inherit; font-size: 11.5px; cursor: pointer;
  transition: color .18s, border-color .18s;
}
.pd-detail:hover { color: var(--brass); border-color: rgba(199, 163, 102, .5) }
"""
io.open(p, "w", encoding="utf-8").write(s)
print("styles")
