"""Generalise the project module and use it for the patents page."""
import io
import re

p = "admin/admin.js"
s = io.open(p, encoding="utf-8").read()
lines = s.split("\n")

# ── keep viewProducts (it sits inside the range we are about to replace) ──
start_i = next(i for i, l in enumerate(lines) if l.startswith("/* ── the project module"))
prod_i = next(i for i, l in enumerate(lines) if l.startswith("function viewProducts(root)"))
proj_i = next(i for i, l in enumerate(lines) if l.startswith("function viewProjects(root)"))
textarea_i = next(i for i, l in enumerate(lines) if l.startswith("function textareaLines("))
view_products_src = "\n".join(lines[prod_i:proj_i]).rstrip()

GENERIC = r'''/* ── collection module: a repository + the slice the site shows ──────────
   One implementation drives 项目页 and 专利页: sidebar, search, pagination, multi-select
   delete with confirmation, a detail editor and a picker that adds from the repository. */

const COLLECTION_PER = 12

const COLLECTIONS = {
  projects: {
    key: 'projects',
    page: '项目页',
    noun: '项目卡片',
    nounShort: '项目',
    repo: { label: '项目仓库', hint: '所有做过的项目卡片' },
    shown: { label: '展示项目', hint: '前台读取并展示的项目' },
    search: '按名称搜索…',
    titleField: 'name',
    subtitleField: 'line',
    subtitleLabel: '说明',
    addPlaceholder: '例如 Lights',
    fields: [
      { name: 'name', label: '名称', type: 'text' },
      { name: 'line', label: '说明', type: 'textarea', rows: 3 },
      { name: 'image', label: '图片', type: 'image', profile: 'project' },
      { name: 'alt', label: '图片描述 alt', type: 'text' },
    ],
    orderNote: '这里是前台「项目」牌堆读取的卡片，顺序即展示顺序',
  },
  patents: {
    key: 'patents',
    page: '专利页',
    noun: '专利图片',
    nounShort: '专利',
    repo: { label: '专利仓库', hint: '所有上传过的专利图片' },
    shown: { label: '展示专利', hint: '前台专利墙读取的图片' },
    search: '按名称或编号搜索…',
    titleField: 'title',
    subtitleField: 'meta',
    subtitleLabel: '编号/年份',
    addPlaceholder: '例如 Chandelier',
    fields: [
      { name: 'title', label: '名称', type: 'text' },
      { name: 'meta', label: '编号/年份', type: 'text' },
      { name: 'image', label: '图片', type: 'image', profile: 'patent' },
      { name: 'alt', label: '图片描述 alt', type: 'text' },
    ],
    orderNote: '这里是前台专利墙读取的图片，顺序决定它在四列中的位置',
  },
}

function collectionState(key) {
  state.mod = state.mod || {}
  state.mod[key] = state.mod[key] || {
    mode: 'repo', q: '', page: 1, shownPage: 1,
    selecting: false, sel: new Set(),
    selectingShown: false, shownSel: new Set(),
  }
  return state.mod[key]
}

function collectionModule(root, cfg) {
  const st = collectionState(cfg.key)
  const apiBase = '/admin/' + cfg.key

  const body = el('div', { class: 'module-body' })
  const nav = el('aside', { class: 'module-nav' })
  const tab = (mode, label, hint) => el('button', {
    class: 'module-tab' + (st.mode === mode ? ' on' : ''),
    type: 'button',
    onclick: () => {
      if (st.mode === mode) return
      st.mode = mode
      st.selecting = false; st.sel.clear()
      st.selectingShown = false; st.shownSel.clear()
      render()
    },
  }, el('strong', {}, label), el('span', {}, hint))
  nav.append(tab('repo', cfg.repo.label, cfg.repo.hint), tab('shown', cfg.shown.label, cfg.shown.hint))

  root.append(el('section', { class: 'card' }, el('div', { class: 'module' }, nav, body)))

  paint()

  async function page(pageNo, extra) {
    const qs = new URLSearchParams({ page: String(pageNo), per: String(extra && extra.per ? extra.per : COLLECTION_PER) })
    if (extra && extra.display) qs.set('display', extra.display)
    const q = (extra && extra.q != null ? extra.q : (extra && extra.ignoreSearch ? '' : st.q)).trim()
    if (q) qs.set('q', q)
    return api(apiBase + '?' + qs.toString())
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
    const data = await page(st.page)
    st.page = data.page
    body.innerHTML = ''

    const search = el('input', {
      type: 'search', class: 'search', placeholder: cfg.search, value: st.q,
      oninput: (e) => { st.q = e.target.value; st.page = 1; debounce(paint) },
    })
    const batchBtn = el('button', {
      class: 'btn danger', type: 'button',
      onclick: () => { st.selecting = !st.selecting; st.sel.clear(); paint() },
    }, st.selecting ? '退出多选' : '批量删除')
    const addBtn = el('button', { class: 'btn ok', type: 'button', onclick: () => newRow(paint) }, '+ 新增' + cfg.nounShort)

    body.append(el('div', { class: 'toolbar' }, search, el('span', { class: 'toolbar-spacer' }), batchBtn, addBtn))
    body.append(el('div', { class: 'meta-line' },
      '共 ' + data.all + ' 个' + cfg.noun + '，其中 ' + data.shown + ' 个在展示中 · 第 ' + data.page + '/' + data.pages + ' 页'))

    if (!data.items.length) {
      body.append(el('p', { class: 'hint' }, st.q ? '没有匹配「' + st.q + '」的内容。' : '仓库还是空的，点右上角「+ 新增' + cfg.nounShort + '」。'))
    } else {
      const grid = el('div', { class: 'pcard-grid' })
      data.items.forEach((row) => {
        grid.append(collectionCard(cfg, row, {
          selected: st.sel.has(row.id),
          selecting: st.selecting,
          onClick: () => {
            if (st.selecting) {
              st.sel.has(row.id) ? st.sel.delete(row.id) : st.sel.add(row.id)
              paint()
            } else editRow(row, paint)
          },
        }))
      })
      body.append(grid)
    }

    body.append(pager(data, (n) => { st.page = n; paint() }))

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
  }

  /* ── displayed pane ───────────────────────────────────────────────── */
  async function paintShown() {
    const data = await page(st.shownPage, { display: '1' })
    st.shownPage = data.page
    body.innerHTML = ''

    const addBtn = el('button', { class: 'btn ok', type: 'button', onclick: () => pickRows(paint) }, '+ 添加' + cfg.nounShort)
    const batchBtn = el('button', {
      class: 'btn danger', type: 'button',
      onclick: () => { st.selectingShown = !st.selectingShown; st.shownSel.clear(); paint() },
    }, st.selectingShown ? '退出多选' : '批量删除')

    body.append(el('div', { class: 'toolbar' },
      el('span', { class: 'toolbar-note' }, cfg.orderNote),
      el('span', { class: 'toolbar-spacer' }), batchBtn, addBtn))
    body.append(el('div', { class: 'meta-line' }, '展示中 ' + data.total + ' 个 · 第 ' + data.page + '/' + data.pages + ' 页'))

    if (!data.items.length) {
      body.append(el('p', { class: 'hint' }, '还没有展示内容。点「+ 添加' + cfg.nounShort + '」从仓库里挑选。'))
    } else {
      const grid = el('div', { class: 'pcard-grid' })
      data.items.forEach((row, i) => {
        grid.append(collectionCard(cfg, row, {
          selected: st.shownSel.has(row.id),
          selecting: st.selectingShown,
          order: (data.page - 1) * COLLECTION_PER + i + 1,
          onMove: st.selectingShown ? null : (dir) => moveRow(row, dir, paint),
          onClick: () => {
            if (st.selectingShown) {
              st.shownSel.has(row.id) ? st.shownSel.delete(row.id) : st.shownSel.add(row.id)
              paint()
            } else editRow(row, paint)
          },
        }))
      })
      body.append(grid)
    }

    body.append(pager(data, (n) => { st.shownPage = n; paint() }))

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
  }

  /* ── row editors ──────────────────────────────────────────────────── */
  function rowFields(row, editable) {
    const box = el('div', {})
    cfg.fields.forEach((f) => {
      if (f.type === 'image') {
        box.append(imageField(f.label, row[f.name], (v) => { row[f.name] = v }, 'image', f.profile || 'image'))
      } else if (f.type === 'textarea') {
        const area = el('textarea', { rows: f.rows || 3 })
        area.value = row[f.name] || ''
        area.addEventListener('input', () => { row[f.name] = area.value })
        const lab = el('label', { class: 'field' })
        lab.append(el('span', { class: 'field-label' }, f.label), area)
        box.append(lab)
      } else {
        const input = el('input', { type: 'text' })
        input.value = row[f.name] || ''
        input.addEventListener('input', () => { row[f.name] = input.value })
        const lab = el('label', { class: 'field' })
        lab.append(el('span', { class: 'field-label' }, f.label), input)
        box.append(lab)
      }
    })
    return box
  }

  function newRow(after) {
    const draft = {}
    cfg.fields.forEach((f) => { draft[f.name] = '' })
    draft.displayed = false
    const media = cfg.fields.find((f) => f.type === 'image')
    const rest = cfg.fields.filter((f) => f.type !== 'image')
    const fieldsBox = rowFields(draft, true)
    const bodyEl = el('div', { class: 'modal-grid' })
    const imageCol = el('div', {})
    const imgField = imageField(media ? media.label : '图片', draft[media ? media.name : 'image'],
      (v) => { draft[media ? media.name : 'image'] = v }, 'image', (media && media.profile) || 'image')
    imageCol.append(imgField)
    /* remove the duplicated image field from the stacked column */
    const imageName = media ? media.name : 'image'
    const stacked = el('div', {})
    ;[].forEach.call(fieldsBox.children, (child) => {
      if (child.className === 'field' && (child.textContent || '').indexOf(cfg.fields.find((f) => f.type === 'image').label) === 0) return
      if (child.querySelector && child.querySelector('.image-field')) return
      stacked.append(child)
    })
    bodyEl.append(imageCol, stacked)

    openModal({
      title: '新增' + cfg.noun,
      wide: true,
      body: bodyEl,
      actions: [
        { label: '取消', cls: 'ghost', onClick: ({ close }) => close() },
        {
          label: '新增', cls: 'ok',
          onClick: async ({ close }) => {
            try {
              await api(apiBase, { method: 'POST', body: { ...draft, displayed: false } })
              close(); toast('已新增到' + cfg.repo.label); after()
            } catch (e) { toast(e.message, true) }
          },
        },
      ],
    })
  }

  function editRow(row, after) {
    const draft = { ...row }
    const media = cfg.fields.find((f) => f.type === 'image')
    const rest = cfg.fields.filter((f) => f.type !== 'image')
    const draftForFields = { ...draft }
    const left = el('div', {})
    const imgName = media ? media.name : 'image'
    left.append(imageField((media && media.label) || '图片', draft[imgName], (v) => { draft[imgName] = v }, 'image', (media && media.profile) || 'image'))
    const right = el('div', {})
    rest.forEach((f) => {
      const input = el(f.type === 'textarea' ? 'textarea' : 'input', f.type === 'textarea' ? { rows: f.rows || 3 } : { type: 'text' })
      input.value = draft[f.name] || ''
      input.addEventListener('input', () => { draft[f.name] = input.value })
      const lab = el('label', { class: 'field' })
      lab.append(el('span', { class: 'field-label' }, f.label), input)
      right.append(lab)
    })
    const shown = el('input', { type: 'checkbox', checked: draft.displayed !== false })
    const check = el('label', { class: 'check-row' })
    check.append(shown, el('span', {}, '在展示区中显示（前台可见）'))
    right.append(check)

    const grid = el('div', { class: 'modal-grid' })
    grid.append(left, right)

    openModal({
      title: cfg.noun,
      wide: true,
      body: grid,
      actions: [
        { label: '取消', cls: 'ghost', onClick: ({ close }) => close() },
        {
          label: '保存', cls: 'primary',
          onClick: async ({ close }) => {
            try {
              const payload = {}
              cfg.fields.forEach((f) => { payload[f.name] = draft[f.name] })
              payload.displayed = shown.checked
              await api(apiBase + '/' + row.id, { method: 'PUT', body: payload })
              close(); toast('已保存'); after()
            } catch (e) { toast(e.message, true) }
          },
        },
      ],
    })
  }

  /* ── pick from the repository ─────────────────────────────────────── */
  async function pickRows(after) {
    const sel = new Set()
    let q = ''
    let pageNo = 1
    const listBox = el('div', { class: 'pick-list' })
    const search = el('input', { type: 'search', class: 'search', placeholder: '搜索仓库…' })
    const info = el('div', { class: 'meta-line' })
    openModal({
      title: '从' + cfg.repo.label + '添加',
      wide: true,
      body: el('div', {}, search, info, listBox),
      actions: [
        { label: '取消', cls: 'ghost', onClick: ({ close }) => close() },
        {
          label: '添加所选', cls: 'ok',
          onClick: async ({ close }) => {
            if (!sel.size) return toast('先选择内容', true)
            await api(apiBase + '/batch', { method: 'POST', body: { action: 'show', ids: Array.from(sel) } })
            close(); toast('已添加 ' + sel.size + ' 个到展示区'); after()
          },
        },
      ],
    })

    const load = async () => {
      const qs = new URLSearchParams({ display: '0', page: String(pageNo), per: '10' })
      if (q) qs.set('q', q)
      const data = await api(apiBase + '?' + qs.toString())
      pageNo = data.page
      listBox.innerHTML = ''
      info.textContent = '仓库中未展示的内容：' + data.total + ' 个 · 第 ' + data.page + '/' + data.pages + ' 页'
      if (!data.items.length) {
        listBox.append(el('p', { class: 'hint' }, q ? '没有匹配的内容。' : '仓库里的内容都已经在展示中了。'))
      }
      data.items.forEach((row) => {
        const input = el('input', { type: 'checkbox' })
        const item = el('label', { class: 'pick-row' + (sel.has(row.id) ? ' on' : '') })
        input.addEventListener('change', (e) => {
          e.target.checked ? sel.add(row.id) : sel.delete(row.id)
          item.classList.toggle('on', e.target.checked)
        })
        item.append(input,
          el('img', { src: previewSrc(row[cfg.fields.find((f) => f.type === 'image').name]), alt: '' }),
          el('span', { class: 'pick-name' }, row[cfg.titleField] || '（未命名）'),
          el('span', { class: 'pick-line' }, (row[cfg.subtitleField] || '').slice(0, 60)))
        listBox.append(item)
      })
      listBox.append(pager(data, (n) => { pageNo = n; load() }))
    }
    search.addEventListener('input', () => { q = search.value; pageNo = 1; debounce(load) })
    load()
  }

  async function moveRow(row, dir, after) {
    const all = await page(1, { display: '1', per: 500 })
    const ids = all.items.map((x) => x.id)
    const at = ids.indexOf(row.id)
    const to = at + dir
    if (at < 0 || to < 0 || to >= ids.length) return
    ;[ids[at], ids[to]] = [ids[to], ids[at]]
    await api(apiBase + '/display-order', { method: 'PUT', body: { ids } })
    after()
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
  card.innerHTML =
    (opts.selecting ? '<span class="pcard-check">' + (opts.selected ? '✓' : '') + '</span>' : '') +
    (opts.order ? '<span class="pcard-order">#' + opts.order + '</span>' : '') +
    '<div class="pcard-media"><img src="' + esc(previewSrc(row[imgName])) + '" alt="" loading="lazy"></div>' +
    '<div class="pcard-body"><strong>' + esc(row[cfg.titleField] || '（未命名）') + '</strong>' +
    '<span>' + esc((row[cfg.subtitleField] || '').slice(0, 80)) + '</span></div>' +
    '<div class="pcard-foot">' +
    (row.displayed !== false ? '<span class="tag ok">展示中</span>' : '<span class="tag">仓库</span>') +
    (opts.onMove ? '<span class="pcard-move">' +
      '<button class="chip" type="button" data-dir="-1" aria-label="上移">↑</button>' +
      '<button class="chip" type="button" data-dir="1" aria-label="下移">↓</button></span>' : '') +
    '</div>'
  if (opts.onMove) {
    ;[].forEach.call(card.querySelectorAll('.pcard-move .chip'), (b) => {
      b.addEventListener('click', (e) => { e.stopPropagation(); opts.onMove(Number(b.dataset.dir)) })
    })
  }
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

'''

new_lines = lines[:start_i]
head = "\n".join(new_lines)

# keep the tail from textareaLines onward, but drop the old viewPatents block
tail = "\n".join(lines[textarea_i:])
old_patents = re.compile(r"function viewPatents\(root\) \{.*?\n\}\n", re.S)
tail = old_patents.sub("", tail, count=1)

s = head + GENERIC + view_products_src + "\n\n" + tail
io.open(p, "w", encoding="utf-8").write(s)
print("collection module generalised; viewPatents now uses it")
