"""Footer links: auto-save, styled url input, delete via a selection dialog."""
import io

p = "admin/admin.js"
s = io.open(p, encoding="utf-8").read()
start = s.index("function viewFooter(root) {")
end = s.index("function viewAccount(root) {")

NEW = r'''function viewFooter(root) {
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

'''

s = s[:start] + NEW + s[end:]
io.open(p, "w", encoding="utf-8").write(s)
print("footer: auto-save, delete dialog")

# ── styles: url/search inputs + the delete rows ─────────────────────────
p = "admin/admin.css"
s = io.open(p, encoding="utf-8").read()
s = s.replace(
"input[type=\"text\"], input[type=\"password\"], input[type=\"email\"], textarea, select {",
"input[type=\"text\"], input[type=\"password\"], input[type=\"email\"], input[type=\"url\"],\ninput[type=\"search\"], input[type=\"tel\"], input[type=\"number\"], textarea, select {", 1)
if ".del-row" not in s:
    s += """
/* ── footer: delete dialog rows + auto-save status ─────────────────────── */
.del-list { display: grid; gap: 6px; margin: 10px 0 6px }
.del-row {
  display: grid; grid-template-columns: 20px 120px minmax(0, 150px) minmax(0, 1fr);
  gap: 10px; align-items: center;
  padding: 8px 10px; border: 1px solid var(--line); border-radius: 9px;
  background: #0d0b0a; cursor: pointer; font-size: 12.5px;
}
.del-row.on { border-color: var(--brass); background: rgba(199, 163, 102, .08) }
.del-name { color: var(--ink) }
.del-url { font-family: var(--mono); font-size: 11px; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.footer-status { padding: 10px 0 2px; font-size: 11.5px; color: var(--ink-3) }
"""
io.open(p, "w", encoding="utf-8").write(s)
print("styles")
