"""Rewrite the admin's project page as a two-pane module (repository / displayed)."""
import io

p = "admin/admin.js"
s = io.open(p, encoding="utf-8").read()

# ── helpers: escape, modal, confirm ──────────────────────────────────────
helpers = r'''
/* ── tiny UI kit: escape, modal, confirm ──────────────────────────────── */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  })
}

let openOverlay = null
function openModal(opts) {
  closeModal()
  const overlay = el('div', { class: 'modal-overlay' })
  const box = el('div', { class: 'modal' + (opts.wide ? ' wide' : '') })
  const head = el('div', { class: 'modal-head' },
    el('h3', {}, opts.title || ''),
    el('button', { class: 'modal-x', type: 'button', 'aria-label': '关闭', onclick: closeModal }, '×'))
  const bodyEl = el('div', { class: 'modal-body' })
  if (typeof opts.body === 'string') bodyEl.innerHTML = opts.body
  else if (opts.body) bodyEl.append(opts.body)
  const foot = el('div', { class: 'modal-foot' })
  ;(opts.actions || []).forEach((a) => {
    foot.append(el('button', {
      class: 'btn ' + (a.cls || 'ghost'), type: 'button',
      onclick: () => { a.onClick ? a.onClick({ close: closeModal }) : closeModal() },
    }, a.label))
  })
  box.append(head, bodyEl, foot)
  overlay.append(box)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal() })
  document.body.append(overlay)
  openOverlay = overlay
  const onKey = (e) => { if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', onKey) } }
  document.addEventListener('keydown', onKey)
  return { close: closeModal, body: bodyEl }
}

function closeModal() {
  if (openOverlay) openOverlay.remove()
  openOverlay = null
}

function confirmDialog(opts) {
  return new Promise((resolve) => {
    let answered = false
    const settle = (value) => { if (answered) return; answered = true; resolve(value) }
    openModal({
      title: opts.title || '确认',
      body: '<p class="modal-text">' + esc(opts.text || '') + '</p>',
      actions: [
        { label: '取消', cls: 'ghost', onClick: ({ close }) => { settle(false); close() } },
        { label: opts.confirmLabel || '确认', cls: opts.danger ? 'danger' : 'primary', onClick: ({ close }) => { settle(true); close() } },
      ],
    })
    /* closing by X / backdrop / Esc counts as cancel */
    const obs = new MutationObserver(() => {
      if (!openOverlay && !answered) { answered = true; resolve(false); obs.disconnect() }
    })
    obs.observe(document.body, { childList: true })
  })
}

/* ── the project module: repository + what the site shows ─────────────── */
const PROJ_PER = 12
state.proj = null

function viewProjects(root) {
  const st = (state.proj = state.proj || {
    mode: 'repo', q: '', page: 1, selecting: false, sel: new Set(), shownPage: 1, shownSel: new Set(), selectingShown: false,
  })
  if (st.sel.size && !st.selecting) st.sel.clear()

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
  nav.append(tab('repo', '项目仓库', '所有做过的项目卡片'), tab('shown', '展示项目', '前台读取并展示的项目'))

  root.append(el('section', { class: 'card' },
    el('div', { class: 'module' }, nav, body)))

  paint()

  async function fetchPage(page, extra) {
    const qs = new URLSearchParams({ page: String(page), per: String(PROJ_PER) })
    if (extra && extra.display) qs.set('display', extra.display)
    if (extra && extra.per) qs.set('per', String(extra.per))
    const q = (extra && extra.q != null ? extra.q : st.q).trim()
    if (q) qs.set('q', q)
    return api('/admin/projects?' + qs.toString())
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

  function toolbar(children) {
    return el('div', { class: 'toolbar' }, children)
  }

  async function paintRepo() {
    const data = await fetchPage(st.page)
    st.page = data.page
    body.innerHTML = ''

    const search = el('input', {
      type: 'search', class: 'search', placeholder: '按名称搜索…', value: st.q,
      oninput: (e) => { st.q = e.target.value; st.page = 1; debounce(paint) },
    })
    const batchBtn = el('button', {
      class: 'btn danger', type: 'button',
      onclick: () => {
        st.selecting = !st.selecting
        st.sel.clear()
        paint()
      },
    }, st.selecting ? '退出多选' : '批量删除')
    const addBtn = el('button', {
      class: 'btn ok', type: 'button',
      onclick: () => newProject(paint),
    }, '+ 新增项目')

    body.append(toolbar([search, el('span', { class: 'toolbar-spacer' }), batchBtn, addBtn]))
    body.append(el('div', { class: 'meta-line' },
      '共 ' + data.all + ' 个项目卡片，其中 ' + data.shown + ' 个在展示中 · 第 ' + data.page + '/' + data.pages + ' 页'))

    if (!data.items.length) {
      body.append(el('p', { class: 'hint' }, st.q ? '没有匹配「' + st.q + '」的项目。' : '仓库还是空的，点右上角「+ 新增项目」。'))
    } else {
      const grid = el('div', { class: 'pcard-grid' })
      data.items.forEach((p) => {
        grid.append(projectCard(p, {
          selected: st.sel.has(p.id),
          selecting: st.selecting,
          onClick: () => {
            if (st.selecting) {
              st.sel.has(p.id) ? st.sel.delete(p.id) : st.sel.add(p.id)
              paint()
            } else editProject(p, paint)
          },
        }))
      })
      body.append(grid)
    }

    body.append(pager(data, (page) => { st.page = page; paint() }))

    if (st.selecting) {
      body.append(el('div', { class: 'floating-actions' },
        el('span', {}, '已选 ' + st.sel.size + ' 个'),
        el('button', {
          class: 'btn ghost', type: 'button',
          onclick: () => { st.selecting = false; st.sel.clear(); paint() },
        }, '取消'),
        el('button', {
          class: 'btn danger', type: 'button', disabled: st.sel.size === 0,
          onclick: async () => {
            const ids = Array.from(st.sel)
            const ok = await confirmDialog({
              title: '删除项目卡片',
              text: '将从仓库永久删除 ' + ids.length + ' 个项目卡片，其中在展示中的会同时从前台消失。此操作不可撤销。',
              confirmLabel: '确认删除',
              danger: true,
            })
            if (!ok) return
            await api('/admin/projects/batch', { method: 'POST', body: { action: 'delete', ids } })
            toast('已删除 ' + ids.length + ' 个')
            st.selecting = false; st.sel.clear(); st.page = 1
            paint()
          },
        }, '删除选中（' + st.sel.size + '）')))
    }
  }

  async function paintShown() {
    const data = await fetchPage(st.shownPage, { display: '1' })
    st.shownPage = data.page
    body.innerHTML = ''

    const addBtn = el('button', { class: 'btn ok', type: 'button', onclick: () => pickProjects(paint) }, '+ 添加项目')
    const batchBtn = el('button', {
      class: 'btn danger', type: 'button',
      onclick: () => { st.selectingShown = !st.selectingShown; st.shownSel.clear(); paint() },
    }, st.selectingShown ? '退出多选' : '批量删除')

    body.append(toolbar([el('span', { class: 'toolbar-note' }, '这里是前台「项目」牌堆读取的卡片，顺序即展示顺序'), el('span', { class: 'toolbar-spacer' }), batchBtn, addBtn]))
    body.append(el('div', { class: 'meta-line' }, '展示中 ' + data.total + ' 个 · 第 ' + data.page + '/' + data.pages + ' 页'))

    if (!data.items.length) {
      body.append(el('p', { class: 'hint' }, '还没有展示项目。点「+ 添加项目」从仓库里挑选。'))
    } else {
      const grid = el('div', { class: 'pcard-grid' })
      data.items.forEach((p, i) => {
        grid.append(projectCard(p, {
          selected: st.shownSel.has(p.id),
          selecting: st.selectingShown,
          order: (data.page - 1) * PROJ_PER + i + 1,
          onMove: st.selectingShown ? null : (dir) => moveShown(p, dir, paint),
          onClick: () => {
            if (st.selectingShown) {
              st.shownSel.has(p.id) ? st.shownSel.delete(p.id) : st.shownSel.add(p.id)
              paint()
            } else editProject(p, paint)
          },
        }))
      })
      body.append(grid)
    }

    body.append(pager(data, (page) => { st.shownPage = page; paint() }))

    if (st.selectingShown) {
      body.append(el('div', { class: 'floating-actions' },
        el('span', {}, '已选 ' + st.shownSel.size + ' 个'),
        el('button', {
          class: 'btn ghost', type: 'button',
          onclick: () => { st.selectingShown = false; st.shownSel.clear(); paint() },
        }, '取消'),
        el('button', {
          class: 'btn danger', type: 'button', disabled: st.shownSel.size === 0,
          onclick: async () => {
            const ids = Array.from(st.shownSel)
            const ok = await confirmDialog({
              title: '从展示中移除',
              text: '将把 ' + ids.length + ' 个项目从展示区移除（卡片仍保留在项目仓库里，可以再次添加）。',
              confirmLabel: '确认移除',
              danger: true,
            })
            if (!ok) return
            await api('/admin/projects/batch', { method: 'POST', body: { action: 'hide', ids } })
            toast('已移除 ' + ids.length + ' 个')
            st.selectingShown = false; st.shownSel.clear(); st.shownPage = 1
            paint()
          },
        }, '移除选中（' + st.shownSel.size + '）')))
    }
  }
}

function debounce(fn) {
  clearTimeout(debounce._t)
  debounce._t = setTimeout(fn, 280)
}

function projectCard(p, opts) {
  const card = el('div', {
    class: 'pcard' + (opts.selected ? ' sel' : '') + (opts.selecting ? ' is-selectable' : ''),
    role: 'button', tabindex: '0',
    onclick: opts.onClick,
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onClick() } },
  })
  card.innerHTML =
    (opts.selecting ? '<span class="pcard-check">' + (opts.selected ? '✓' : '') + '</span>' : '') +
    (opts.order ? '<span class="pcard-order">#' + opts.order + '</span>' : '') +
    '<div class="pcard-media"><img src="' + esc(previewSrc(p.image)) + '" alt="" loading="lazy"></div>' +
    '<div class="pcard-body"><strong>' + esc(p.name || '（未命名）') + '</strong>' +
    '<span>' + esc((p.line || '').slice(0, 80)) + '</span></div>' +
    '<div class="pcard-foot">' +
    (p.displayed !== false ? '<span class="tag ok">展示中</span>' : '<span class="tag">仓库</span>') +
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

function pager(data, go) {
  const bar = el('div', { class: 'pager' },
    el('button', { class: 'btn ghost small', type: 'button', disabled: data.page <= 1, onclick: () => go(data.page - 1) }, '上一页'),
    el('span', { class: 'pager-count' }, '第 ' + data.page + ' / ' + data.pages + ' 页 · 共 ' + data.total + ' 个'),
    el('button', { class: 'btn ghost small', type: 'button', disabled: data.page >= data.pages, onclick: () => go(data.page + 1) }, '下一页'))
  return bar
}

function newProject(after) {
  const draft = { name: '', line: '', image: '', alt: '' }
  const name = el('input', { type: 'text', placeholder: '例如 Lights' })
  const line = el('textarea', { rows: 3, placeholder: '一句话说明这张卡片的意图' })
  const alt = el('input', { type: 'text', placeholder: '图片描述（无障碍/SEO）' })
  const media = imageField('图片', draft.image, (v) => { draft.image = v }, 'image', 'project')
  const body = el('div', {},
    el('label', { class: 'field' }, el('span', { class: 'field-label' }, '名称'), name),
    el('label', { class: 'field' }, el('span', { class: 'field-label' }, '说明'), line),
    media,
    el('label', { class: 'field' }, el('span', { class: 'field-label' }, '图片描述 alt'), alt))
  openModal({
    title: '新增项目卡片',
    body,
    actions: [
      { label: '取消', cls: 'ghost', onClick: ({ close }) => close() },
      {
        label: '新增', cls: 'ok',
        onClick: async ({ close }) => {
          try {
            await api('/admin/projects', {
              method: 'POST',
              body: { name: name.value.trim(), line: line.value.trim(), image: draft.image, alt: alt.value.trim(), displayed: false },
            })
            close(); toast('已新增到项目仓库'); after()
          } catch (e) { toast(e.message, true) }
        },
      },
    ],
  })
}

function editProject(p, after) {
  const draft = { ...p }
  const name = el('input', { type: 'text', value: draft.name || '' })
  const line = el('textarea', { rows: 3 }); line.value = draft.line || ''
  const alt = el('input', { type: 'text', value: draft.alt || '' })
  const media = imageField('图片', draft.image, (v) => { draft.image = v }, 'image', 'project')
  const shown = el('input', { type: 'checkbox', checked: draft.displayed !== false })
  const body = el('div', {},
    el('label', { class: 'field' }, el('span', { class: 'field-label' }, '名称'), name),
    el('label', { class: 'field' }, el('span', { class: 'field-label' }, '说明'), line),
    media,
    el('label', { class: 'field' }, el('span', { class: 'field-label' }, '图片描述 alt'), alt),
    el('label', { class: 'check-row' }, shown, el('span', {}, '在展示项目中显示（前台可见）')))
  openModal({
    title: '项目卡片',
    body,
    actions: [
      { label: '取消', cls: 'ghost', onClick: ({ close }) => close() },
      {
        label: '保存', cls: 'primary',
        onClick: async ({ close }) => {
          try {
            await api('/admin/projects/' + p.id, {
              method: 'PUT',
              body: {
                name: name.value.trim(), line: line.value.trim(), alt: alt.value.trim(),
                image: draft.image, displayed: shown.checked,
              },
            })
            close(); toast('已保存'); after()
          } catch (e) { toast(e.message, true) }
        },
      },
    ],
  })
}

async function pickProjects(after) {
  const sel = new Set()
  let q = ''
  let page = 1
  const listBox = el('div', { class: 'pick-list' })
  const search = el('input', { type: 'search', class: 'search', placeholder: '搜索仓库里的项目…' })
  const info = el('div', { class: 'meta-line' })
  const modal = openModal({
    title: '从项目仓库添加',
    wide: true,
    body: el('div', {}, search, info, listBox),
    actions: [
      { label: '取消', cls: 'ghost', onClick: ({ close }) => close() },
      {
        label: '添加所选',
        cls: 'ok',
        onClick: async ({ close }) => {
          if (!sel.size) return toast('先选择项目', true)
          await api('/admin/projects/batch', { method: 'POST', body: { action: 'show', ids: Array.from(sel) } })
          close(); toast('已添加 ' + sel.size + ' 个到展示项目'); after()
        },
      },
    ],
  })

  const load = async () => {
    const qs = new URLSearchParams({ display: '0', page: String(page), per: '10' })
    if (q) qs.set('q', q)
    const data = await api('/admin/projects?' + qs.toString())
    page = data.page
    listBox.innerHTML = ''
    info.textContent = '仓库中未展示的卡片：' + data.total + ' 个 · 第 ' + data.page + '/' + data.pages + ' 页'
    if (!data.items.length) {
      listBox.append(el('p', { class: 'hint' }, q ? '没有匹配的项目。' : '仓库里的卡片都已经在展示中了。'))
    }
    data.items.forEach((p) => {
      const row = el('label', { class: 'pick-row' + (sel.has(p.id) ? ' on' : '') },
        el('input', {
          type: 'checkbox',
          onchange: (e) => {
            e.target.checked ? sel.add(p.id) : sel.delete(p.id)
            row.classList.toggle('on', e.target.checked)
          },
        }),
        el('img', { src: previewSrc(p.image), alt: '' }),
        el('span', { class: 'pick-name' }, p.name || '（未命名）'),
        el('span', { class: 'pick-line' }, (p.line || '').slice(0, 60)))
      listBox.append(row)
    })
    listBox.append(pager(data, (n) => { page = n; load() }))
  }
  search.addEventListener('input', () => { q = search.value; page = 1; debounce(load) })
  load()
}

async function moveShown(p, dir, after) {
  const all = await api('/admin/projects?display=1&per=500&page=1')
  const ids = all.items.map((x) => x.id)
  const at = ids.indexOf(p.id)
  const to = at + dir
  if (at < 0 || to < 0 || to >= ids.length) return
  ;[ids[at], ids[to]] = [ids[to], ids[at]]
  await api('/admin/projects/display-order', { method: 'PUT', body: { ids } })
  after()
}
'''

start = s.index("function viewProjects(root) {")
end = s.index("function viewTextareaLines" if "function textareaLines" not in s else "function textareaLines")
s = s[:start] + helpers + "\n" + s[end:]
io.open(p, "w", encoding="utf-8").write(s)
print("viewProjects replaced")
