/* One-off: decode HTML entities that the seed inherited from the static markup
   (e.g. "Care &amp; finishes"). Text in content.json is plain text, not markup. */
const fs = require('node:fs')

const FILE = process.env.CONTENT || '/var/www/ncl-data/content.json'
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'))

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }
function decode(s) {
  return typeof s === 'string' ? s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] || m) : s
}
function walk(node) {
  if (Array.isArray(node)) return node.map(walk)
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) node[k] = walk(node[k])
    return node
  }
  return decode(node)
}

/* the cover title intentionally carries <em> markup, so keep it out of the sweep */
const title = data.cover && data.cover.titleLines
const fixed = walk(data)
if (title) fixed.cover.titleLines = title

fs.copyFileSync(FILE, FILE + '.bak-entities-' + Date.now())
fs.writeFileSync(FILE, JSON.stringify(fixed, null, 2))
const sample = fixed.footer.columns.flatMap((c) => (c.links || []).map((l) => l.label)).filter((l) => /&/.test(l))
console.log(JSON.stringify({ labelsStillEncoded: sample, careLabel: fixed.footer.columns.flatMap((c) => c.links || []).map((l) => l.label).find((l) => l.indexOf('Care') >= 0) }))
