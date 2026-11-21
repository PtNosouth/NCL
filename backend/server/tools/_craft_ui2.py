"""Rebuild viewCraft again, this time with flat statements instead of deep nesting."""
import io

p = "admin/admin.js"
s = io.open(p, encoding="utf-8").read()

start = s.index("function secHead(num, title, hint) {")
end = s.index("/* lines of")

NEW = '''function secHead(num, title, hint) {
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

'''

s = s[:start] + NEW + s[end:]
io.open(p, "w", encoding="utf-8").write(s)
print("viewCraft rebuilt (flat)")
