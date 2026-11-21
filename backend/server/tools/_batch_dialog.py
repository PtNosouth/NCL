"""Checkboxes get a style; batch delete becomes a selection dialog on every collection."""
import io

p = "admin/admin.css"
s = io.open(p, encoding="utf-8").read()
if 'input[type="checkbox"]' not in s:
    s += """
/* ── checkboxes: a styled box, never the browser default ───────────────── */
input[type="checkbox"] {
  -webkit-appearance: none;
  appearance: none;
  flex: 0 0 auto;
  width: 17px; height: 17px; border-radius: 5px;
  border: 1px solid rgba(239, 232, 219, .38);
  background: #0d0b0a;
  cursor: pointer;
  position: relative;
  margin: 0;
  transition: border-color .15s, background .15s;
}
input[type="checkbox"]:hover { border-color: rgba(199, 163, 102, .7) }
input[type="checkbox"]:checked {
  border-color: var(--brass);
  background: var(--brass);
}
input[type="checkbox"]:checked::after {
  content: '';
  position: absolute; left: 5px; top: 1px;
  width: 4px; height: 9px;
  border: solid #12100e; border-width: 0 2px 2px 0;
  transform: rotate(42deg);
}
input[type="checkbox"]:focus-visible { outline: 1px solid var(--brass); outline-offset: 2px }

/* rows inside the delete dialog of the collection module */
.pick-del-row {
  display: grid; grid-template-columns: 20px 46px minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 10px; align-items: center;
  padding: 7px 10px; border: 1px solid var(--line); border-radius: 9px; background: #0d0b0a;
  cursor: pointer; font-size: 12.5px;
}
.pick-del-row.on { border-color: var(--brass); background: rgba(199, 163, 102, .08) }
.pick-del-row img { width: 46px; height: 58px; object-fit: cover; border-radius: 6px; display: block }
.pick-del-row .pd-name { color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.pick-del-row .pd-sub { color: var(--ink-3); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
"""
io.open(p, "w", encoding="utf-8").write(s)
print("checkbox + row styles")

p = "admin/admin.js"
s = io.open(p, encoding="utf-8").read()

# ── repo pane: batch button opens the dialog, no inline selection ───────
old = """    const batchBtn = el('button', {
      class: 'btn danger', type: 'button',
      onclick: () => { st.selecting = !st.selecting; st.sel.clear(); paint() },
    }, st.selecting ? '退出多选' : '批量删除')
    const addBtn = el('button', { class: 'btn ok', type: 'button', onclick: () => newRow(paint) }, '+ 新增' + cfg.nounShort)"""
new = """    const batchBtn = el('button', {
      class: 'btn danger', type: 'button',
      onclick: () => deleteDialog('repo', paint),
    }, '删除' + cfg.nounShort)
    const addBtn = el('button', { class: 'btn ok', type: 'button', onclick: () => newRow(paint) }, '+ 新增' + cfg.nounShort)"""
assert old in s
s = s.replace(old, new, 1)

old = """      data.items.forEach((row) => {
        grid.append(collectionCard(cfg, row, {
          groups,
          selected: st.sel.has(row.id),
          selecting: st.selecting,
          onClick: () => {
            if (st.selecting) {
              st.sel.has(row.id) ? st.sel.delete(row.id) : st.sel.add(row.id)
              paint()
            } else editRow(row, paint)
          },
        }))
      })"""
new = """      data.items.forEach((row) => {
        grid.append(collectionCard(cfg, row, {
          groups,
          onClick: () => editRow(row, paint),
        }))
      })"""
assert old in s
s = s.replace(old, new, 1)

old = """    body.append(pager(data, (n) => { st.page = n; paint() }))

    if (st.selecting) {
      body.append(el('div', { class: 'floating-actions' },
        el('span', {}, '已选 ' + st.sel.size + ' 个'),
        el('button', { class: 'btn ghost', type: 'button', onclick: () => { st.selecting = false; st.sel.clear(); paint() } }, '取消'),
        el('button', {
          class: 'btn danger', type: 'button', disabled: st.sel.size === 0,
          onclick: async () => {
            const ids = Array.from(st.sel)
            const ok = await confirmDialog({
              title: '删除' + cfg.noun,
              text: '将从仓库永久删除 ' + ids.length + ' 个' + cfg.noun + '，其中在展示中的会同时从前台消失。此操作不可撤销。',
              confirmLabel: '确认删除',
              danger: true,
            })
            if (!ok) return
            await api(apiBase + '/batch', { method: 'POST', body: { action: 'delete', ids } })
            toast('已删除 ' + ids.length + ' 个')
            st.selecting = false; st.sel.clear(); st.page = 1
            paint()
          },
        }, '删除选中（' + st.sel.size + '）')))
    }
  }"""
new = """    body.append(pager(data, (n) => { st.page = n; paint() }))
  }"""
assert old in s
s = s.replace(old, new, 1)

# ── shown pane: same treatment ──────────────────────────────────────────
old = """    const batchBtn = el('button', {
      class: 'btn danger', type: 'button',
      onclick: () => { st.selectingShown = !st.selectingShown; st.shownSel.clear(); paint() },
    }, st.selectingShown ? '退出多选' : '批量删除')"""
new = """    const batchBtn = el('button', {
      class: 'btn danger', type: 'button',
      onclick: () => deleteDialog('shown', paint),
    }, '移除' + cfg.nounShort)"""
assert old in s
s = s.replace(old, new, 1)

old = """        grid.append(collectionCard(cfg, row, {
          groups,
          selected: st.shownSel.has(row.id),
          selecting: st.selectingShown,
          order: (data.page - 1) * COLLECTION_PER + i + 1,
          onMove: st.selectingShown ? null : (dir) => moveRow(row, dir, paint, group),
          onClick: () => {
            if (st.selectingShown) {
              st.shownSel.has(row.id) ? st.shownSel.delete(row.id) : st.shownSel.add(row.id)
              paint()
            } else editRow(row, paint)
          },
        }))"""
new = """        grid.append(collectionCard(cfg, row, {
          groups,
          order: (data.page - 1) * COLLECTION_PER + i + 1,
          onMove: (dir) => moveRow(row, dir, paint, group),
          onClick: () => editRow(row, paint),
        }))"""
assert old in s
s = s.replace(old, new, 1)

old = """    content.append(pager(data, (n) => { st.shownPage = n; paint() }))
    body.append(main)

    if (st.selectingShown) {
      body.append(el('div', { class: 'floating-actions' },
        el('span', {}, '已选 ' + st.shownSel.size + ' 个'),
        el('button', { class: 'btn ghost', type: 'button', onclick: () => { st.selectingShown = false; st.shownSel.clear(); paint() } }, '取消'),
        el('button', {
          class: 'btn danger', type: 'button', disabled: st.shownSel.size === 0,
          onclick: async () => {
            const ids = Array.from(st.shownSel)
            const ok = await confirmDialog({
              title: '从展示中移除',
              text: '将把 ' + ids.length + ' 个' + cfg.noun + '从展示区移除（内容仍保留在仓库里，可以再次添加）。',
              confirmLabel: '确认移除',
              danger: true,
            })
            if (!ok) return
            await api(apiBase + '/batch', { method: 'POST', body: { action: 'hide', ids } })
            toast('已移除 ' + ids.length + ' 个')
            st.selectingShown = false; st.shownSel.clear(); st.shownPage = 1
            paint()
          },
        }, '移除选中（' + st.shownSel.size + '）')))
    }
  }"""
new = """    content.append(pager(data, (n) => { st.shownPage = n; paint() }))
    body.append(main)
  }"""
assert old in s
s = s.replace(old, new, 1)

# ── the dialog itself ───────────────────────────────────────────────────
anchor = """  function rowForm(draft, opts) {"""
dialog = '''  /* batch delete / un-display: pick rows in a dialog, then confirm once more */
  async function deleteDialog(mode, after) {
    const removeFromShow = mode === 'shown'
    const sel = new Set()
    let q = ''
    let pageNo = 1
    const imgName = cfg.fields.find((f) => f.type === 'image').name

    const listBox = el('div', { class: 'pick-list' })
    const search = el('input', { type: 'search', class: 'search', placeholder: cfg.search })
    const info = el('div', { class: 'meta-line' })

    const refresh = () => {
      info.textContent = '共 ' + sel.total + ' 个可选 · 已选 ' + sel.size + ' 个'
      const footerBtn = document.querySelectorAll('.modal-foot .btn')[1]
      if (footerBtn) {
        footerBtn.textContent = sel.size ? (removeFromShow ? '移除选中（' : '删除选中（') + sel.size + '）' : (removeFromShow ? '移除选中' : '删除选中')
        footerBtn.disabled = sel.size === 0
      }
    }

    openModal({
      title: removeFromShow ? '从展示中移除' : '删除' + cfg.noun,
      wide: true,
      body: el('div', {},
        el('p', { class: 'hint' }, removeFromShow
          ? '勾选要从展示区移除的' + cfg.noun + '；内容仍保留在仓库里，可以再次添加。'
          : '勾选要从仓库永久删除的' + cfg.noun + '；在展示中的会同时从前台消失，此操作不可撤销。'),
        search, listBox, info),
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

    const load = async () => {
      const qs = new URLSearchParams({ page: String(pageNo), per: '10' })
      if (removeFromShow) qs.set('display', '1')
      if (q) qs.set('q', q)
      const data = await api(apiBase + '?' + qs.toString())
      pageNo = data.page
      sel.total = data.total
      listBox.innerHTML = ''
      refresh()
      if (!data.items.length) {
        listBox.append(el('p', { class: 'hint' }, q ? '没有匹配的内容。' : '这里还没有内容。'))
      }
      const rows = el('div', { class: 'pick-list' })
      listBox.append(rows)
      data.items.forEach((row) => {
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
      })
      listBox.append(pager(data, (n) => { pageNo = n; load() }))
    }
    search.addEventListener('input', () => { q = search.value; pageNo = 1; debounce(load) })
    load()
  }

''' + anchor
assert anchor in s
s = s.replace(anchor, dialog, 1)
io.open(p, "w", encoding="utf-8").write(s)
print("collection batch delete -> dialog")
