"""Footer: social links as a table with a header, rows open a detail card."""
import io

# ── 1. server: keep name/note on each social ────────────────────────────
p = "server/app.js"
s = io.open(p, encoding="utf-8").read()
old = """      col.socials = c.socials.slice(0, 8).map((s) => ({
        kind: str(s.kind, 20) || 'link',
        href: str(s.href, 300),
        aria: str(s.aria, 120),
      }))"""
new = """      col.socials = c.socials.slice(0, 12).map((s) => ({
        kind: str(s.kind, 20) || 'link',
        name: str(s.name, 60),
        href: str(s.href, 300),
        note: str(s.note, 200),
        aria: str(s.aria, 120),
      }))"""
assert old in s
s = s.replace(old, new, 1)
io.open(p, "w", encoding="utf-8").write(s)
print("server: social name/note")

# ── 2. admin: table view ────────────────────────────────────────────────
p = "admin/admin.js"
s = io.open(p, encoding="utf-8").read()
start = s.index("/* The footer editor is deliberately narrow")
end = s.index("function viewAccount(root) {")

NEW = r'''/* The footer editor is deliberately narrow: the only part that changes day to day is the
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

  const st = (state.socials = state.socials || { selecting: false, sel: new Set() })
  const listBox = el('div', { class: 'link-table' })
  const saveBtn = el('button', { class: 'btn primary', type: 'button' }, '保存链接')

  const persist = async (label) => {
    await busyClick(saveBtn, '保存中…', async () => {
      try {
        state.data.footer = await api('/admin/footer', { method: 'PUT', body: draft })
        toast(label || '页脚链接已保存')
      } catch (err) { toast(err.message, true) }
    })
  }

  const nameOf = (soc) => soc.name || socialKind(soc.kind).label

  function paint() {
    listBox.innerHTML = ''

    const head = el('div', { class: 'link-row link-head' })
    head.append(
      el('span', { class: 'link-idx' }, st.selecting ? '' : '#'),
      el('span', {}, '名称'),
      el('span', {}, '平台'),
      el('span', {}, '链接'))
    listBox.append(head)

    if (!col.socials.length) {
      listBox.append(el('p', { class: 'hint' }, '还没有链接。点右上角「+ 增加链接」。'))
    }

    col.socials.forEach((soc, i) => {
      const row = el('div', {
        class: 'link-row' + (st.sel.has(i) ? ' sel' : '') + (st.selecting ? ' is-selectable' : ''),
        role: 'button', tabindex: '0',
      })
      const toggle = () => {
        if (!st.selecting) return editSocial(soc, i)
        if (st.sel.has(i)) st.sel.delete(i)
        else st.sel.add(i)
        paint()
      }
      row.addEventListener('click', toggle)
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() }
      })

      if (st.selecting) {
        row.append(el('span', { class: 'link-idx' }, st.sel.has(i) ? '✓' : ''))
      } else {
        row.append(el('span', { class: 'link-idx' }, String(i + 1)))
      }
      const nameCell = el('span', { class: 'link-name' }, nameOf(soc))
      const platCell = el('span', { class: 'link-plat' })
      platCell.append(socialBadge(soc.kind), el('span', {}, socialKind(soc.kind).label))
      const urlCell = el('span', { class: 'link-url' }, soc.href || '（未填）')
      urlCell.title = soc.href || ''
      row.append(nameCell, platCell, urlCell)
      listBox.append(row)
    })
  }

  function editSocial(soc, index) {
    const isNew = typeof index !== 'number'
    const draftRow = isNew
      ? { kind: 'facebook', name: 'Facebook', href: '', note: '', aria: 'NCL on Facebook' }
      : { ...soc }

    const name = el('input', { type: 'text', placeholder: '例如 官方 Facebook' })
    name.value = draftRow.name || ''
    const kind = el('select', {})
    SOCIAL_KINDS.forEach((k) => kind.append(el('option', { value: k.id, selected: k.id === draftRow.kind }, k.label)))
    kind.value = draftRow.kind || 'link'
    const url = el('input', { type: 'url', placeholder: 'https://…', spellcheck: 'false' })
    url.value = draftRow.href || ''
    const note = el('textarea', { rows: 3, placeholder: '备注：这个链接用来做什么，例如 私信咨询 / 项目合作' })
    note.value = draftRow.note || ''

    const label = (text, control) => {
      const lab = el('label', { class: 'field' })
      lab.append(el('span', { class: 'field-label' }, text), control)
      return lab
    }
    const bodyEl = el('div', {},
      el('div', { class: 'grid2' },
        label('名称', name),
        label('平台', kind)),
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
              /* the aria label the front end needs is generated here */
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

  const addBtn = el('button', { class: 'btn ok', type: 'button', onclick: () => editSocial(null, undefined) }, '+ 增加链接')
  const batchBtn = el('button', {
    class: 'btn danger', type: 'button',
    onclick: () => { st.selecting = !st.selecting; st.sel.clear(); paint() },
  }, st.selecting ? '退出多选' : '删除链接')

  const toolbar = el('div', { class: 'toolbar' },
    el('span', { class: 'toolbar-note' }, '这里是前台页脚「Connect with us」的图标链接'),
    el('span', { class: 'toolbar-spacer' }),
    batchBtn, addBtn)

  const meta = el('div', { class: 'meta-line' }, '共 ' + col.socials.length + ' 个链接')

  const sec = el('section', { class: 'card sec' })
  sec.append(
    secHead('页脚', 'Connect with us', '点一行打开详情卡片，可改名称、平台、链接与备注'),
    toolbar,
    meta,
    listBox,
    el('div', { class: 'save-bar' }, el('span', { class: 'save-hint' }, '名称与平台会影响前台图标的读屏文本'), saveBtn))

  const floatBox = el('div', { class: 'floating-actions' })
  function paintFloat() {
    floatBox.innerHTML = ''
    if (!st.selecting) { floatBox.remove(); return }
    floatBox.append(
      el('span', {}, '已选 ' + st.sel.size + ' 个'),
      el('button', {
        class: 'btn ghost', type: 'button',
        onclick: () => { st.selecting = false; st.sel.clear(); paint(); paintFloat() },
      }, '取消'),
      el('button', {
        class: 'btn danger', type: 'button', disabled: st.sel.size === 0,
        onclick: async () => {
          const idx = Array.from(st.sel).sort((a, b) => b - a)
          const ok = await confirmDialog({
            title: '删除链接',
            text: '将从前台页脚移除 ' + idx.length + ' 个链接，此操作不可撤销。',
            confirmLabel: '确认删除',
            danger: true,
          })
          if (!ok) return
          idx.forEach((i) => col.socials.splice(i, 1))
          st.selecting = false; st.sel.clear()
          paint(); paintFloat()
          await persist('已删除 ' + idx.length + ' 个链接')
        },
      }, '删除选中（' + st.sel.size + '）'))
    root.append(floatBox)
  }

  const origPaint = paint
  const paintWithFloat = () => {
    origPaint()
    meta.textContent = '共 ' + col.socials.length + ' 个链接'
    paintFloat()
  }
  /* every repaint refreshes the count and the selection bar */
  paint = paintWithFloat
  paint()

  root.append(sec)
}

'''

s = s[:start] + NEW + s[end:]
io.open(p, "w", encoding="utf-8").write(s)
print("footer table editor")

# ── 3. CSS ──────────────────────────────────────────────────────────────
p = "admin/admin.css"
s = io.open(p, encoding="utf-8").read()
i = s.find("/* ── footer: social links as inline rows")
if i >= 0:
    s = s[:i]
s += """/* ── footer links: a table with a header ────────────────────────────────── */
.link-table { display: grid; gap: 6px }
.link-row {
  display: grid; grid-template-columns: 30px minmax(0, 1.1fr) minmax(0, 0.8fr) minmax(0, 1.8fr);
  gap: 12px; align-items: center;
  padding: 9px 12px; border: 1px solid var(--line); border-radius: 9px; background: #0d0b0a;
  color: var(--ink-2); font-size: 13px;
}
.link-row:not(.link-head) { cursor: pointer; transition: border-color .18s, background .18s }
.link-row:not(.link-head):hover { border-color: rgba(239, 232, 219, .3) }
.link-row.sel { border-color: var(--brass); background: rgba(199, 163, 102, .08) }
.link-head {
  background: none; border: 0; border-bottom: 1px solid var(--line); border-radius: 0;
  padding: 0 12px 8px; cursor: default;
  font-family: var(--mono); font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase; color: var(--ink-3);
}
.link-idx { font-family: var(--mono); font-size: 10px; color: var(--ink-3); text-align: center }
.link-row.sel .link-idx { color: var(--brass) }
.link-name { color: var(--ink); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.link-plat { display: flex; align-items: center; gap: 8px; overflow: hidden }
.link-plat span:last-child { font-size: 12px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.link-url {
  font-family: var(--mono); font-size: 11.5px; color: var(--ink-3);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.social-badge {
  flex: 0 0 26px; width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center;
  border: 1px solid rgba(199, 163, 102, .45); background: rgba(199, 163, 102, .1);
  color: var(--brass); font-family: var(--mono); font-size: 9.5px; letter-spacing: .04em;
}
@media (max-width: 820px) {
  .link-row { grid-template-columns: 26px minmax(0, 1fr); }
  .link-row .link-plat, .link-row .link-url { grid-column: 1 / -1 }
}
"""
io.open(p, "w", encoding="utf-8").write(s)
print("table css")
