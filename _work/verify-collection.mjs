// Functional checks for the collection page: left rail, one family at a time,
// the detail card, real wheel scrolling, the page curtain, mobile and reduced motion.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 5185;
const DBG = 9233;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4' };

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  const stat = fs.statSync(file);
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': stat.size });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${path.join(ROOT, '_work', 'chrome-profile')}`,
  '--hide-scrollbars', '--disable-gpu', '--no-first-run', '--mute-audio', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
async function waitJson(url) {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(url); if (r.ok) return r.json(); } catch {} await new Promise((r) => setTimeout(r, 250)); }
  throw new Error('cdp down');
}
const ver = await waitJson(`http://127.0.0.1:${DBG}/json/version`);
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errors.push((d.exception && d.exception.description) || d.text || 'exception');
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params, sessionId })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const s = (m, p = {}) => send(m, p, sessionId);
await s('Page.enable'); await s('Runtime.enable');
const ev = async (expr) => {
  const r = await s('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text));
  return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, got, want) => results.push({ name, got, want: typeof want === 'function' ? 'fn' : want, pass: typeof want === 'function' ? want(got) : got === want });
const load = async (w = 1440, h = 900, mobile = false) => {
  await s('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  await s('Page.navigate', { url: `http://127.0.0.1:${PORT}/home/collection.html` });
  await sleep(2600);
};
const scroll = async (y, wait = 800) => { await ev(`window.scrollTo(0,${y})`); await sleep(wait); };

await load();
check('no console errors', errors.length, 0);
check('title', await ev(`document.title`), (v) => /Collection/i.test(v));
check('nav is Home / Products / Achievements / Projects', await ev(`[].map.call(document.querySelectorAll('.nav-links a'), function(a){return a.textContent.trim();}).join(' · ')`), 'Home · Products · Achievements · Projects');
check('nav marks this page', await ev(`document.querySelector('.nav-links a[aria-current]').textContent.trim()`), 'Products');
check('hero is the first section', await ev(`document.querySelector('main > section').className`), 'col-hero');

/* the rail sits on the left, not on top */
const railBox = await ev(`JSON.stringify(document.querySelector('.col-rail').getBoundingClientRect())`);
const r = JSON.parse(railBox);
check('family rail is on the left', r.x < 320 && r.width < 320, true);
check('rail has five families', await ev(`document.querySelectorAll('.col-rail-links a').length`), 5);
check('rail counts add up', await ev(`[].reduce.call(document.querySelectorAll('.col-rail-links a i'), function(n,e){return n+parseInt(e.textContent,10);}, 0)`), 118);

/* one family at a time */
check('only one family is on screen', await ev(`[].filter.call(document.querySelectorAll('.col-family'), function(f){return !f.hidden;}).length`), 1);
check('the first family is the one showing', await ev(`document.querySelector('.col-family:not([hidden])').dataset.family`), 'big');
await ev(`document.querySelector('.col-rail-links a[data-family="wall"]').click()`);
await sleep(900);
check('clicking the rail switches family', await ev(`document.querySelector('.col-family:not([hidden])').dataset.family`), 'wall');
check('the rail marks the active family', await ev(`document.querySelector('.col-rail-links a.is-on').dataset.family`), 'wall');
check('the hash follows', await ev(`location.hash`), '#wall');
check('the rail note changes with the family', await ev(`document.getElementById('col-rail-note').textContent.trim()`), (v) => v.length > 10 && /mirror line/.test(v));

/* the detail card */
await scroll(await ev(`document.querySelector('.col-body').offsetTop - 20`), 1200);
check('plates are buttons', await ev(`document.querySelector('.plate').tagName`), 'BUTTON');
check('detail starts closed', await ev(`document.getElementById('detail').hidden`), true);
await ev(`document.querySelectorAll('.col-family:not([hidden]) .plate')[1].click()`);
await sleep(500);
check('clicking a plate opens the card', await ev(`document.getElementById('detail').hidden`), false);
check('the card carries the model', await ev(`document.getElementById('detail-model').textContent.trim()`), (v) => v.length > 2);
check('the card carries the family', await ev(`document.getElementById('detail-family').textContent.trim()`), 'Wall lights');
check('the card shows the photograph', await ev(`document.getElementById('detail-img').src`), (v) => /media\/catalogue\/wall\//.test(v));
check('the enquiry link names the piece', await ev(`document.getElementById('detail-cta').getAttribute('href')`), (v) => /^mailto:/.test(v) && /Enquiry/.test(decodeURIComponent(v)));
check('the page is locked while the card is open', await ev(`document.body.style.overflow`), 'hidden');
await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);
await sleep(400);
check('escape closes the card', await ev(`document.getElementById('detail').hidden`), true);
check('scrolling is released again', await ev(`document.body.style.overflow`), '');

/* the bug that started this: a real wheel must scroll */
await ev(`window.scrollTo(0,0)`);
await sleep(400);
for (let i = 0; i < 3; i++) {
  await s('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 600, deltaX: 0, deltaY: 500, pointerType: 'mouse' });
  await sleep(300);
}
check('the wheel scrolls the page', await ev(`window.scrollY`), (v) => v > 500);

/* every plate decoded */
const pageH = await ev(`document.body.scrollHeight`);
for (let y = 0; y < pageH; y += 700) { await ev(`window.scrollTo(0,${y})`); await sleep(140); }
await sleep(2200);
await ev(`window.scrollTo(0,0)`);
await sleep(400);
/* only the family on screen is rendered, so only its photographs should have loaded */
check('every visible plate decoded', await ev(`[].filter.call(document.images, function(i){
  var fam = i.closest('.col-family');
  if (!i.getAttribute('src')) return false;                 // the detail card's slot, empty until used
  return (!fam || !fam.hidden) && i.naturalWidth === 0;
}).length`), 0);
check('hidden families stay unloaded', await ev(`[].some.call(document.images, function(i){
  var fam = i.closest('.col-family'); return fam && fam.hidden && i.naturalWidth === 0;
})`), true);
await ev(`document.querySelector('.col-rail-links a[data-family="land"]').click()`);
await sleep(1600);
check('switching family loads its photographs', await ev(`[].filter.call(document.querySelectorAll('.col-family:not([hidden]) img'), function(i){return i.naturalWidth === 0;}).length`), 0);

/* the page curtain */
check('the curtain exists', await ev(`!!document.getElementById('page-veil')`), true);
await ev(`document.querySelector('.nav-links a[href="index.html"]').click()`);
await sleep(240);
check('the curtain rises before leaving', await ev(`document.getElementById('page-veil').classList.contains('is-leaving')`), true);
await sleep(1400);
check('and the cover arrives', await ev(`location.pathname`), '/home/index.html');
check('arriving plays the curtain out', await ev(`document.getElementById('page-veil').className`), (v) => /is-arriving/.test(v) || v === 'page-veil');

/* mobile */
await load(390, 844, true);
check('mobile: no horizontal overflow', await ev(`document.documentElement.scrollWidth <= innerWidth + 1`), true);
check('mobile: rail is a row, not a column', await ev(`(function(){var l=document.querySelector('.col-rail-links');return getComputedStyle(l).display === 'flex';})()`), true);
check('mobile: two plates per row', await ev(`(function(){var a=document.querySelectorAll('.col-family:not([hidden]) .plate');return Math.abs(a[0].getBoundingClientRect().top - a[1].getBoundingClientRect().top) < 2;})()`), true);

/* reduced motion */
await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await load(1440, 900, false);
check('reduced motion: plates are simply visible', await ev(`[].every.call(document.querySelectorAll('.col-family:not([hidden]) .plate'), function(p){return getComputedStyle(p).opacity === '1';})`), true);
check('reduced motion: the curtain is not used', await ev(`getComputedStyle(document.getElementById('page-veil')).display`), 'none');

const fail = results.filter((r) => !r.pass);
console.log(JSON.stringify({ total: results.length, failed: fail.length, errors, fail }, null, 2));
ws.close(); chrome.kill(); server.close();
process.exit(fail.length ? 1 : 0);
