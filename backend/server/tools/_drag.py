"""Drag-and-drop reordering in the displayed panes (replaces the arrow buttons)."""
import io

p = "admin/admin.js"
s = io.open(p, encoding="utf-8").read()

# ── 1. cards in the shown pane become draggable ────────────────────────
old = """      const grid = el('div', { class: 'pcard-grid' })
      data.items.forEach((row, i) => {
        grid.append(collectionCard(cfg, row, {
          groups,
          order: (data.page - 1) * COLLECTION_PER + i + 1,
          onMove: (dir) => moveRow(row, dir, paint, group),
          onClick: () => editRow(row, paint),
        }))
      })
      content.append(grid)"""
new = """      const grid = el('div', { class: 'pcard-grid sortable' })
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
      content.append(grid)"""
assert old in s
s = s.replace(old, new, 1)

# a hint in the toolbar tells people they can drag
old = """    const groupTitle = (groups.find((g) => g.id === group) || {}).title || ''
    content.append(el('div', { class: 'toolbar' },
      el('span', { class: 'toolbar-note' }, group
        ? '分组「' + groupTitle + '」 · ' + data.total + ' 个'
        : cfg.orderNote),"""
new = """    const groupTitle = (groups.find((g) => g.id === group) || {}).title || ''
    content.append(el('div', { class: 'toolbar' },
      el('span', { class: 'toolbar-note' }, (group
        ? '分组「' + groupTitle + '」 · ' + data.total + ' 个'
        : cfg.orderNote) + ' · 拖动卡片可调整顺序'),"""
assert old in s
s = s.replace(old, new, 1)

# ── 2. the reorder itself: permute the moved ids inside their own slots ──
old = """  async function moveRow(row, dir, after, group) {
    const all = await fetchPage(1, { display: '1', per: 500, group: group || '' })
    const ids = all.items.map((x) => x.id)
    const at = ids.indexOf(row.id)
    const to = at + dir
    if (at < 0 || to < 0 || to >= ids.length) return
    ;[ids[at], ids[to]] = [ids[to], ids[at]]
    await api(apiBase + '/display-order', { method: 'PUT', body: { ids } })
    after()
  }"""
new = """  /* drop row `fromId` where `toId` sits, keeping every other card where it was.
     The ids on this page are re-slotted, so this also works when a group filter is on. */
  async function reorderTo(fromId, toId, pageIds, group) {
    const order = pageIds.slice()
    const from = order.indexOf(fromId)
    const to = order.indexOf(toId)
    if (from < 0 || to < 0 || from === to) return

    const all = await fetchPage(1, { display: '1', per: 500, group: group || '' })
    const allIds = all.items.map((x) => x.id)
    const slots = order.map((id) => allIds.indexOf(id)).filter((i) => i >= 0).sort((a, b) => a - b)
    if (!slots.length) return

    order.splice(to, 0, order.splice(from, 1)[0])
    slots.forEach((slot, i) => { allIds[slot] = order[i] })

    try {
      await api(apiBase + '/display-order', { method: 'PUT', body: { ids: allIds } })
      toast('顺序已更新')
      paint()
    } catch (err) { toast(err.message, true) }
  }"""
assert old in s
s = s.replace(old, new, 1)

# ── 3. collectionCard: no more arrow chips ─────────────────────────────
old = """    (opts.onMove ? '<span class="pcard-move">' +
      '<button class="chip" type="button" data-dir="-1" aria-label="上移">↑</button>' +
      '<button class="chip" type="button" data-dir="1" aria-label="下移">↓</button></span>' : '') +
    '</div>'
  if (opts.onMove) {
    ;[].forEach.call(card.querySelectorAll('.pcard-move .chip'), (b) => {
      b.addEventListener('click', (e) => { e.stopPropagation(); opts.onMove(Number(b.dataset.dir)) })
    })
  }
  return card"""
new = """    '</div>'
  return card"""
assert old in s
s = s.replace(old, new, 1)
io.open(p, "w", encoding="utf-8").write(s)
print("drag reorder wired")

# ── 4. styles ───────────────────────────────────────────────────────────
p = "admin/admin.css"
s = io.open(p, encoding="utf-8").read()
if ".pcard.dragging" not in s:
    s += """
/* ── drag to reorder the displayed cards ───────────────────────────────── */
.pcard.draggable { cursor: grab }
.pcard.draggable:active { cursor: grabbing }
.pcard.dragging { opacity: .45; transform: scale(.98) }
.pcard.drop-target {
  border-color: var(--brass);
  box-shadow: 0 0 0 2px rgba(199, 163, 102, .55) inset;
  transform: translateY(-2px);
}
.pcard-grid.sortable .pcard { transition: border-color .15s, transform .15s, box-shadow .15s }
"""
io.open(p, "w", encoding="utf-8").write(s)
print("drag styles")
