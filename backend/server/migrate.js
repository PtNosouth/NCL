/* Add craft + footer to an existing content.json without touching anything else.
   Safe to run twice: it only fills in what is missing, and backs up first. */
const fs = require('node:fs')

const CONTENT = process.env.CONTENT || '/var/www/ncl-data/content.json'
const SEED = process.env.SEED || '/opt/ncl-api/seed.json'

const content = JSON.parse(fs.readFileSync(CONTENT, 'utf8'))
const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'))

let added = 0
for (const key of ['craft', 'footer', 'cover', 'projects', 'groups', 'products', 'patents']) {
  if (seed[key] == null) continue
  if (content[key] == null) { content[key] = seed[key]; added++ }
}

if (added) {
  fs.copyFileSync(CONTENT, CONTENT + '.bak-' + Date.now())
  fs.writeFileSync(CONTENT, JSON.stringify(content, null, 2))
}
console.log(JSON.stringify({
  added,
  has: {
    cover: !!content.cover, craft: !!content.craft, footer: !!content.footer,
    projects: (content.projects || []).length, groups: (content.groups || []).length,
    products: (content.products || []).length, patents: (content.patents || []).length,
  },
}))
