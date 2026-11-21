/* put the project deck back in its authored order (p1 … p8) */
const fs = require('node:fs')

const file = process.env.CONTENT || '/var/www/ncl-data/content.json'
const data = JSON.parse(fs.readFileSync(file, 'utf8'))
fs.copyFileSync(file, file + '.bak-order-' + Date.now())

for (const p of data.projects) {
  const m = /^p(\d+)$/.exec(p.id || '')
  if (m) p.displayOrder = Number(m[1]) - 1
}

fs.writeFileSync(file, JSON.stringify(data, null, 2))
console.log(data.projects
  .slice()
  .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
  .map((p) => p.displayOrder + ':' + p.id + ':' + p.name)
  .join(' '))
