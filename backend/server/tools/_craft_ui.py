"""Rebuild the craft editor with clearly separated sections."""
import io

p = "admin/admin.js"
s = io.open(p, encoding="utf-8").read()

start = s.index("function viewCraft(root) {")
end = s.index("/* lines of")

NEW = '''function secHead(num, title, hint) {
  return el('div', { class: 'sec-head' },
    el('span', { class: 'sec-num' }, num),
    el('h3', {}, title),
    hint ? el('p', {}, hint) : null)
}

/* the craft section editor: one card per concern, numbered, so the parts of the page
   never blur into one long form */
function viewCraft(root) {
  const c = state.data.craft
  if (!c) {
    root.append(el('section', { class: 'card' }, el('h2', {}, '工艺段'), el('p', { class: 'hint' }, '这条内容还没有数据，先保存一次会建立默认结构。')))
    return
  }
  const draft = JSON.parse(JSON.stringify(c))
  draft.eyebrow = draft.eyebrow || {}
  draft.plates = draft.plates || []
  draft.close = draft.close || { cta: {} }
  const close = draft.close
  close.cta = close.cta || {}

  /* ── 01 · 段落标题 ─────────────────────────────────────────────────── */
  const secIntro = el('section', { class: 'card sec' },
    secHead('01', '段落标题', '前台这段文字的眉标与大标题'),
    el('div', { class: 'grid2' },
      field('眉标左（The hand）', draft.eyebrow.lead, (v) => { draft.eyebrow.lead = v }),
      field('眉标右（Cut · strung · lit）', draft.eyebrow.items, (v) => { draft.eyebrow.items = v })),
    textareaLines('大标题（每行一段，前台按行断开）', draft.title, (v) => { draft.title = v }))

  /* ── 02 · 图文块 ───────────────────────────────────────────────────── */
  const platesBox = el('div', { class: 'plate-list' })
  const paintPlates = () => {
    platesBox.innerHTML = ''
    draft.plates.forEach((pl, i) => {
      const card = el('div', { class: 'plate-card' },
        el('div', { class: 'plate-card-head' },
          el('span', { class: 'plate-num' }, '图 ' + (i + 1)),
          el('span', { class: 'plate-label' }, pl.label || '（未填小标签）'),
          el('span', { class: 'plate-layout' }, pl.layout === 'media-right' ? '文在左 · 图在右' : '图在左 · 文在右'),
          el('div', { class: 'plate-tools' },
            el('button', { class: 'btn ghost small', type: 'button', title: '上移', onclick: () => { if (i > 0) { [draft.plates[i - 1], draft.plates[i]] = [draft.plates[i], draft.plates[i - 1]]; paintPlates() } } }, '↑'),
            el('button', { class: 'btn ghost small', type: 'button', title: '下移', onclick: () => { if (i < draft.plates.length - 1) { [draft.plates[i + 1], draft.plates[i]] = [draft.plates[i], draft.plates[i + 1]]; paintPlates() } } }, '↓'),
            el('button', { class: 'btn ghost small danger', type: 'button', onclick: () => { draft.plates.splice(i, 1); paintPlates() } }, '删除'))),
        el('div', { class: 'modal-grid' },
          el('div', {}, imageField('图片', pl.image, (v) => { pl.image = v }, 'image', 'craft')),
          el('div', {},
            el('label', { class: 'field' }, el('span', { class: 'field-label' }, '版式'),
              el('select', { onchange: (e) => { pl.layout = e.target.value } },
                el('option', { value: 'media-left', selected: pl.layout === 'media-left' }, '图在左 / 文在右'),
                el('option', { value: 'media-right', selected: pl.layout === 'media-right' }, '文在左 / 图在右'))),
            field('小标签（Cut / Strung / Lit）', pl.label, (v) => { pl.label = v }),
            textareaLines('标题（每行一段）', pl.title, (v) => { pl.title = v }),
            field('正文', pl.body, (v) => { pl.body = v }, { multiline: true }),
            el('div', { class: 'grid2' },
              field('视差强度 0–0.5', String(pl.parallax || 0.16), (v) => { pl.parallax = Number(v) || 0 }),
              field('图片描述 alt', pl.alt, (v) => { pl.alt = v }))))))
      platesBox.append(card)
    })
    platesBox.append(el('div', { class: 'plate-add' },
      el('button', {
        class: 'btn ghost', type: 'button',
        onclick: () => {
          if (draft.plates.length >= 4) return toast('最多 4 块图文', true)
          draft.plates.push({ id: '', layout: draft.plates.length % 2 ? 'media-right' : 'media-left', label: '', title: [], body: '', image: '', alt: '', parallax: 0.16 })
          paintPlates()
        },
      }, '+ 增加一块图文'),
      el('span', {}, '建议 2–3 块：第一块图左、第二块图右，读完自然落到收尾块')))
  }
  paintPlates()

  const secPlates = el('section', { class: 'card sec' },
    secHead('02', '图文块', '与前一块交替排布：图 / 文 / 图 / 文'),
    platesBox)

  /* ── 03 · 收尾块 ───────────────────────────────────────────────────── */
  const secClose = el('section', { class: 'card sec sec-last' },
    secHead('03', '收尾块', '一张大图 + Lit 标题 + 咨询按钮，是这段的落点'),
    el('div', { class: 'plate-card close-card' },
      el('div', { class: 'plate-card-head' },
        el('span', { class: 'plate-num' }, '收尾'),
        el('span', { class: 'plate-label' }, close.label || '（未填小标签）'),
        el('span', { class: 'plate-layout' }, '通栏大图 + 文案')),
      el('div', { class: 'modal-grid' },
        el('div', {}, imageField('收尾大图', close.image, (v) => { close.image = v }, 'image', 'craft')),
        el('div', {},
          field('小标签（Lit）', close.label, (v) => { close.label = v }),
          textareaLines('标题（每行一段）', close.title, (v) => { close.title = v }),
          field('正文', close.body, (v) => { close.body = v }, { multiline: true }),
          el('div', { class: 'grid2' },
            field('视差强度', String(close.parallax || 0.1), (v) => { close.parallax = Number(v) || 0 }),
            field('图片描述 alt', close.alt, (v) => { close.alt = v })),
          el('div', { class: 'grid2' },
            field('按钮文字', close.cta.label, (v) => { close.cta.label = v }),
            field('按钮链接', close.cta.href, (v) => { close.cta.href = v }))))))

  /* ── save bar ──────────────────────────────────────────────────────── */
  const saveBar = el('div', { class: 'save-bar' },
    el('span', { class: 'save-hint' }, '三个部分一起保存'),
    el('button', {
      class: 'btn primary', type: 'button',
      onclick: (e) => busyClick(e.currentTarget, '保存中…', async () => {
        try { state.data.craft = await api('/admin/craft', { method: 'PUT', body: draft }); toast('工艺段已保存') }
        catch (err) { toast(err.message, true) }
      }),
    }, '保存工艺段'))

  root.append(secIntro, secPlates, secClose, saveBar)
}

'''

s = s[:start] + NEW + s[end:]
io.open(p, "w", encoding="utf-8").write(s)
print("viewCraft rebuilt")

# ── styles for the sections ──────────────────────────────────────────────
p = "admin/admin.css"
s = io.open(p, encoding="utf-8").read()
if ".sec-head" not in s:
    s += """
/* ── sectioned editors (craft) ─────────────────────────────────────────── */
.card.sec { display: grid; gap: 16px; padding: 20px 22px 22px }
.sec-head {
  display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap;
  padding-bottom: 12px; border-bottom: 1px solid var(--line);
}
.sec-num {
  font-family: var(--mono); font-size: 10px; letter-spacing: .2em; color: var(--brass);
  border: 1px solid rgba(199, 163, 102, .4); border-radius: 6px; padding: 3px 7px;
}
.sec-head h3 { margin: 0; font-family: var(--serif); font-weight: 400; font-size: 21px }
.sec-head p { margin: 0; color: var(--ink-3); font-size: 12px; flex: 1 1 100% }

.plate-list { display: grid; gap: 14px }
.plate-card {
  display: grid; gap: 14px; padding: 14px 16px;
  border: 1px solid rgba(199, 163, 102, .2); border-left: 3px solid rgba(199, 163, 102, .5);
  border-radius: 12px; background: #0d0b0a;
}
.plate-card-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap }
.plate-num {
  font-family: var(--mono); font-size: 10px; letter-spacing: .16em; color: var(--brass);
}
.plate-label { font-size: 13px; color: var(--ink); font-weight: 500 }
.plate-layout { font-size: 11px; color: var(--ink-3) }
.plate-tools { margin-left: auto; display: flex; gap: 6px }
.plate-card .field { margin-bottom: 10px }
.plate-add { display: flex; align-items: center; gap: 12px; flex-wrap: wrap }
.plate-add span { font-size: 11.5px; color: var(--ink-3) }
.sec-last .plate-card { border-left-color: rgba(143, 191, 143, .55); border-color: rgba(143, 191, 143, .22) }
.sec-last .plate-num { color: #a9d3a9; border-color: rgba(143, 191, 143, .4) }
.sec-last .sec-num { color: #a9d3a9; border-color: rgba(143, 191, 143, .4) }

.save-bar {
  position: sticky; bottom: 0; z-index: 5;
  display: flex; align-items: center; justify-content: flex-end; gap: 14px;
  padding: 14px 0 15px; background: linear-gradient(to top, var(--paper) 62%, rgba(10, 9, 8, 0));
}
.save-hint { color: var(--ink-3); font-size: 11.5px }
"""
io.open(p, "w", encoding="utf-8").write(s)
print("section styles")
