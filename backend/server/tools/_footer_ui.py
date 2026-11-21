"""Footer editor: only the Connect with us links, edited as inline rows."""
import io

p = "admin/admin.js"
s = io.open(p, encoding="utf-8").read()

start = s.index("function viewFooter(root) {")
end = s.index("function viewAccount(root) {")

NEW = r'''/* The footer editor is deliberately narrow: the only part that changes day to day is the
   "Connect with us" list. Every other footer string is left untouched — a save rewrites
   that one column and nothing else. */
const SOCIAL_KINDS = [
  { id: 'facebook', label: 'Facebook', badge: 'FB' },
  { id: 'whatsapp', label: 'WhatsApp', badge: 'WA' },
  { id: 'instagram', label: 'Instagram', badge: 'IG' },
  { id: 'douyin', label: '抖音 / TikTok', badge: 'DY' },
  { id: 'link', label: '其他链接', badge: '↗' },
]

function socialBadge(kind) {
  const meta = SOCIAL_KINDS.find((k) => k.id === kind) || SOCIAL_KINDS[SOCIAL_KINDS.length - 1]
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

  const columnIndex = Math.max(0, (f.columns || []).findIndex((c) => Array.isArray(c.socials)))
  const hasSocials = columnIndex >= 0 && Array.isArray((f.columns[columnIndex] || {}).socials)

  /* work on a copy; a save writes the whole footer back */
  const draft = JSON.parse(JSON.stringify(f))
  if (!Array.isArray(draft.columns)) draft.columns = []
  let col = draft.columns[columnIndex]
  if (!col || !Array.isArray(col.socials)) {
    if (!col) {
      col = { title: 'Connect with us', socials: [] }
      draft.columns.push(col)
    } else {
      col.socials = []
    }
  }

  const list = el('div', { class: 'social-list' })
  const saveBtn = el('button', { class: 'btn primary', type: 'button' }, '保存链接')

  const push = async (label) => {
    await busyClick(saveBtn, '保存中…', async () => {
      try {
        state.data.footer = await api('/admin/footer', { method: 'PUT', body: draft })
        toast(label || '页脚链接已保存')
      } catch (err) { toast(err.message, true) }
    })
  }

  const paintRows = () => {
    list.innerHTML = ''
    if (!col.socials.length) {
      list.append(el('p', { class: 'hint' }, '还没有链接。用下面一行添加第一个。'))
    }
    col.socials.forEach((soc, i) => {
      const row = el('div', { class: 'social-row' })

      const badge = el('div', { class: 'social-badge-wrap' })
      badge.append(socialBadge(soc.kind))

      const kind = el('select', { onchange: (e) => { soc.kind = e.target.value; badge.innerHTML = ''; badge.append(socialBadge(soc.kind)) } })
      SOCIAL_KINDS.forEach((k) => kind.append(el('option', { value: k.id, selected: k.id === (soc.kind || 'link') }, k.label)))

      const url = el('input', { type: 'url', placeholder: 'https://…', spellcheck: 'false' })
      url.value = soc.href || ''
      url.addEventListener('input', () => { soc.href = url.value.trim() })

      const aria = el('input', { type: 'text', placeholder: '无障碍描述，例如 NCL on Instagram' })
      aria.value = soc.aria || ''
      aria.addEventListener('input', () => { soc.aria = aria.value })

      const del = el('button', {
        class: 'btn ghost small danger', type: 'button',
        onclick: async () => {
          const ok = await confirmDialog({
            title: '移除链接',
            text: '从前台页脚移除「' + (soc.aria || soc.href || '这个链接') + '」？',
            confirmLabel: '移除',
            danger: true,
          })
          if (!ok) return
          col.socials.splice(i, 1)
          paintRows()
          await push('已移除')
        },
      }, '移除')

      row.append(badge, kind, url, aria, del)
      list.append(row)
    })
  }
  paintRows()

  /* the add row */
  const newKind = el('select', {})
  SOCIAL_KINDS.forEach((k) => newKind.append(el('option', { value: k.id }, k.label)))
  const newUrl = el('input', { type: 'url', placeholder: 'https://…', spellcheck: 'false' })
  const newAria = el('input', { type: 'text', placeholder: '无障碍描述（可选）' })
  const addBtn = el('button', {
    class: 'btn ok', type: 'button',
    onclick: async () => {
      const href = newUrl.value.trim()
      if (!href) return toast('先填链接地址', true)
      if (!/^https?:\/\//i.test(href) && !/^(mailto:|tel:)/i.test(href)) return toast('链接要以 http(s):// 开头', true)
      const meta = SOCIAL_KINDS.find((k) => k.id === newKind.value)
      col.socials.push({ kind: newKind.value, href, aria: newAria.value.trim() || ('NCL on ' + meta.label) })
      newUrl.value = ''
      newAria.value = ''
      paintRows()
      await push('已添加链接')
    },
  }, '+ 添加链接')

  const sec = el('section', { class: 'card sec' })
  sec.append(
    secHead('页脚', 'Connect with us', '只维护页脚里这组社交链接，其他文案保持不变'),
    list,
    el('div', { class: 'social-add' }, newKind, newUrl, newAria, addBtn),
    el('div', { class: 'save-bar' },
      el('span', { class: 'save-hint' }, hasSocials ? '当前 ' + col.socials.length + ' 个链接' : '还没有这一列，保存后会新建'),
      saveBtn))

  root.append(sec)
}

'''

s = s[:start] + NEW + s[end:]
io.open(p, "w", encoding="utf-8").write(s)
print("footer editor rebuilt")

p = "admin/admin.css"
s = io.open(p, encoding="utf-8").read()
if ".social-row" not in s:
    s += """
/* ── footer: social links as inline rows ───────────────────────────────── */
.social-list { display: grid; gap: 8px }
.social-row {
  display: grid; grid-template-columns: 34px 128px minmax(0, 1.5fr) minmax(0, 1fr) auto;
  gap: 8px; align-items: center;
  padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; background: #0d0b0a;
}
.social-row select, .social-row input { width: 100%; padding: 8px 10px; font-size: 12.5px }
.social-badge-wrap { display: flex; align-items: center; justify-content: center }
.social-badge {
  width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center;
  border: 1px solid rgba(199, 163, 102, .45); background: rgba(199, 163, 102, .1);
  color: var(--brass); font-family: var(--mono); font-size: 10px; letter-spacing: .04em;
}
.social-add {
  display: grid; grid-template-columns: 128px minmax(0, 1.5fr) minmax(0, 1fr) auto;
  gap: 8px; align-items: center; margin-top: 4px;
  padding-top: 14px; border-top: 1px dashed var(--line);
}
.social-add input, .social-add select { width: 100% }
@media (max-width: 900px) {
  .social-row { grid-template-columns: 34px minmax(0, 1fr) auto }
  .social-row select { grid-column: 2 / -1 }
  .social-row input { grid-column: 1 / -1 }
  .social-add { grid-template-columns: 1fr }
}
"""
io.open(p, "w", encoding="utf-8").write(s)
print("footer styles")
