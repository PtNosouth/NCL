"""Rewrite the collection module: groups sidebar, multi-group products, unified picker."""
import io

p = "admin/admin.js"
s = io.open(p, encoding="utf-8").read()
lines = s.split("\n")

start = next(i for i, l in enumerate(lines) if l.startswith("const COLLECTION_PER"))
end = next(i for i, l in enumerate(lines) if l.startswith("function textareaLines"))

NEW = r'''const COLLECTION_PER = 12

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
    batchUpload: true,
  },
}

function collectionState(key) {
  state.mod = state.mod || {}
  state.mod[key] = state.mod[key] || {
    mode: 'repo', q: '', page: 1, shownPage: 1, group: '',
    selecting: false, sel: new Set(),
    selectingShown: false, shownSel: new Set(),
  }
  return state.mod[key]
}

function collectionModule(root, cfg) {
  const st = collectionState(cfg.key)
  const apiBase = '/admin/' + cfg.key
  let groups = []            /* the group list (products only) */

  const body = el('div', { class: 'module-body' })

  const go = (mode) => {
    if (st.mode === mode) return
    st.mode = mode
    st.selecting = false; st.sel.clear()
    st.selectingShown = false; st.shownSel.clear()
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
      onclick: () => { st.selecting = !st.selecting; st.sel.clear(); paint() },
    }, st.selecting ? '退出多选' : '批量删除')
    const addBtn = el('button', { class: 'btn ok', type: 'button', onclick: () => newRow(paint) }, '+ 新增' + cfg.nounShort)

    const toolbar = el('div', { class: 'toolbar' }, search, el('span', { class: 'toolbar-spacer' }), batchBtn, addBtn)
    if (cfg.batchUpload) {
      const groupId = st.group || (groups[0] && groups[0].id) || ''
      const groupTitle = (groups.find((g) => g.id === groupId) || {}).title || ''
      const batch = batchUploader(() => ({ id: groupId, title: groupTitle }), () => paint())
      toolbar.append(batch.button, batch.input, batch.log)
    }
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

  /* ── displayed pane (products: with the group sidebar) ─────────────── */
  async function paintShown() {
    const group = cfg.groupTags ? st.group : ''
    const data = await fetchPage(st.shownPage, { display: '1', group })
    st.shownPage = data.page
    body.innerHTML = ''

    const addBtn = el('button', { class: 'btn ok', type: 'button', onclick: () => pickRows(paint) }, '+ 添加' + cfg.nounShort)
    const batchBtn = el('button', {
      class: 'btn danger', type: 'button',
      onclick: () => { st.selectingShown = !st.selectingShown; st.shownSel.clear(); paint() },
    }, st.selectingShown ? '退出多选' : '批量删除')

    const main = el('div', { class: 'pane' })
    const content = el('div', { class: 'pane-main' })
    if (cfg.groupTags) main.append(groupSidebar(data), content)
    else main.append(content)

    content.append(el('div', { class: 'toolbar' },
      el('span', { class: 'toolbar-note' }, group
        ? '正在查看分组「' + ((groups.find((g) => g.id === group) || {}).title || '') + '」 · ' + data.total + ' 个'
        : cfg.orderNote),
      el('span', { class: 'toolbar-spacer' }), batchBtn, addBtn))
    content.append(el('div', { class: 'meta-line' },
      '展示中 ' + data.total + ' 个 · 第 ' + data.page + '/' + data.pages + ' 页'))

    if (!data.items.length) {
      content.append(el('p', { class: 'hint' }, '这里还没有内容。点「+ 添加' + cfg.nounShort + '」从仓库里挑选。'))
    } else {
      const grid = el('div', { class: 'pcard-grid' })
      data.items.forEach((row, i) => {
        grid.append(collectionCard(cfg, row, {
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
        }))
      })
      content.append(grid)
    }

    content.append(pager(data, (n) => { st.shownPage = n; paint() }))
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

    const total = (data && data.shown) || 0
    const allRow = el('button', {
      class: 'group-row' + (st.group ? '' : ' on'), type: 'button',
      onclick: () => { st.group = ''; st.shownPage = 1; paint() },
    })
    allRow.append(el('span', {}, '全部商品'), el('i', {}, String(total)))
    side.append(allRow)

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
    const listBox = el('div', { class: 'pick-list' })
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

    const load = async () => {
      /* the whole repository, not just what is hidden */
      const qs = new URLSearchParams({ page: String(pageNo), per: '8' })
      if (q) qs.set('q', q)
      const data = await api(apiBase + '?' + qs.toString())
      pageNo = data.page
      listBox.innerHTML = ''
      info.textContent = '仓库中共 ' + data.total + ' 个 · 第 ' + data.page + '/' + data.pages + ' 页 · 已选 ' + sel.size
      if (!data.items.length) listBox.append(el('p', { class: 'hint' }, q ? '没有匹配的内容。' : '仓库还是空的。'))
      data.items.forEach((row) => {
        const input = el('input', { type: 'checkbox' })
        const item = el('label', { class: 'pick-row' + (sel.has(row.id) ? ' on' : '') })
        input.addEventListener('change', (e) => {
          e.target.checked ? sel.add(row.id) : sel.delete(row.id)
          item.classList.toggle('on', e.target.checked)
          info.textContent = '仓库中共 ' + data.total + ' 个 · 第 ' + data.page + '/' + data.pages + ' 页 · 已选 ' + sel.size
        })
        item.append(input,
          el('img', { src: previewSrc(row[cfg.fields.find((f) => f.type === 'image').name]), alt: '' }),
          el('span', { class: 'pick-name' }, row[cfg.titleField] || '（未命名）'),
          el('span', { class: 'pick-line' }, (row[cfg.subtitleField] || '').slice(0, 60)),
          row.displayed !== false ? el('span', { class: 'tag ok' }, '已展示') : el('span', { class: 'tag' }, '仓库'))
        listBox.append(item)
      })
      listBox.append(pager(data, (n) => { pageNo = n; load() }))
    }
    search.addEventListener('input', () => { q = search.value; pageNo = 1; debounce(load) })
    load()
  }

  async function moveRow(row, dir, after, group) {
    const all = await fetchPage(1, { display: '1', per: 500, group: group || '' })
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

function viewProducts(root) {
  collectionModule(root, COLLECTIONS.products)
}

'''

s = "\n".join(lines[:start]) + "\n" + NEW + "\n".join(lines[end:])
io.open(p, "w", encoding="utf-8").write(s)
print("module rewritten: groups sidebar, multi-group, unified picker")
