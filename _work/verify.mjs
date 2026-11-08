// Functional checks against the running page (like shot.mjs, but assertions only).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 5179;
const DBG = 9225;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  const stat = fs.statSync(file);
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m[1] ? parseInt(m[1]) : 0, end = m[2] ? parseInt(m[2]) : stat.size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file, { start, end }).pipe(res); return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${path.join(ROOT, '_work', 'chrome-profile')}`,
  '--hide-scrollbars', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });

async function waitJson(url) {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(url); if (r.ok) return r.json(); } catch {} await new Promise((r) => setTimeout(r, 250)); }
  throw new Error('cdp down');
}
const ver = await waitJson(`http://127.0.0.1:${DBG}/json/version`);
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params, sessionId })); });

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const s = (m, p = {}) => send(m, p, sessionId);
await s('Page.enable'); await s('Runtime.enable');
await s('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await s('Page.navigate', { url: `http://127.0.0.1:${PORT}/home/index.html` });
await new Promise((r) => setTimeout(r, 4500));

const ev = async (expr) => (await s('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, got, want) => results.push({ name, got, want: typeof want === 'function' ? 'fn' : want, pass: typeof want === 'function' ? want(got) : got === want });

/* reveal + film */
check('body auto-revealed', await ev(`document.body.className.includes('is-lit')`), true);
check('reveal landed (no blur left)', await ev(`getComputedStyle(document.querySelector('.film-media video')).filter`), 'none');
check('no hard aperture', await ev(`getComputedStyle(document.querySelector('.film-media')).clipPath`), 'none');
check('video playing', await ev(`!document.getElementById('film-video').paused`), true);
check('video loops', await ev(`document.getElementById('film-video').loop`), true);
check('video src is 1080 on desktop', await ev(`document.getElementById('film-video').currentSrc.split('/').pop()`), 'ncl-70086-1080.mp4');
check('duration read', await ev(`+document.getElementById('film-video').duration.toFixed(1)`), (v) => Math.abs(v - 50.6) < 1.2);
check('no timecode', await ev(`document.querySelectorAll('#tc-now, #tc-total, .tc').length`), 0);
check('no footer plinth', await ev(`document.querySelectorAll('footer, .plate').length`), 0);
check('no play control', await ev(`document.querySelectorAll('#play, .play, [aria-label*="Play" i], [aria-label*="Pause" i]').length`), 0);
check('only the menu button remains', await ev(`document.querySelectorAll('button').length`), 1);
check('film really runs on its own', await ev(`document.getElementById('film-video').currentTime > 0.4`), true);
check('film wraps at the end', await ev(`(()=>{const v=document.getElementById('film-video');return v.loop && v.currentTime < v.duration})()`), true);

/* removals requested this round */
check('no chapter ruler', await ev(`document.querySelectorAll('#chapters, .chapters, .rail').length`), 0);
check('no progress tracker', await ev(`(()=>{const p=document.querySelector('.plate');const pseudo=p?getComputedStyle(p,'::before').content:'none';return document.querySelectorAll('[role="progressbar"], .rail-bar, progress, input[type=range]').length + (pseudo!=='none'?1:0)})()`), 0);
check('no eyebrow field', await ev(`document.querySelectorAll('.eyebrow').length`), 0);
check('no fixture number in DOM', await ev(`/70086|Eight lights/i.test(document.body.innerText)`), false);
check('no raster logo', await ev(`document.querySelectorAll('img, .mark').length`), 0);
/* the "g" descender bug: nothing may clip the headline */
check('headline does not clip', await ev(`(()=>{const l=document.querySelector('.hero-title .line');const h=document.querySelector('.hero-title');return getComputedStyle(l).overflow+'+'+getComputedStyle(h).overflow})()`), 'visible+visible');
check('headline is not height-constrained', await ev(`(()=>{const h=document.querySelector('.hero-title');const last=h.querySelectorAll('.line > span')[1];const r1=h.getBoundingClientRect(),r2=last.getBoundingClientRect();return r2.bottom-r1.bottom})()`), (v) => v >= -1);
check('descender space exists', await ev(`(()=>{const l=document.querySelectorAll('.hero-title .line > span')[1];return l.getBoundingClientRect().height>0})()`), true);
/* dimensional treatment */
check('headline carries layered shadow', await ev(`(()=>{const t=getComputedStyle(document.querySelectorAll('.hero-title .line > span')[1]).textShadow;return t==='none'?0:(t.match(/rgb/g)||[]).length})()`), (v) => v >= 3);
check('gold word carries its own shadow', await ev(`(()=>{const t=getComputedStyle(document.querySelector('.hero-title em')).textShadow;return t==='none'?0:(t.match(/rgb/g)||[]).length})()`), (v) => v >= 3);
check('wordmark is inline svg NCL', await ev(`(()=>{const s=document.querySelector('svg.wordmark');return s? s.getAttribute('aria-label')+'|'+s.querySelectorAll('rect,path,polygon').length : 'none'})()`), (v) => v.startsWith('NCL|') && +v.split('|')[1] >= 10);
check('wordmark painted', await ev(`getComputedStyle(document.querySelector('.wordmark')).color`), 'rgb(230, 202, 148)');

/* hover = the type lights up, not a rule */
const box = await ev(`(()=>{const r=document.querySelectorAll('.nav-links a')[1].getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`);
const { x, y } = JSON.parse(box);
await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
await sleep(700);
check('nav hover glows the type', await ev(`(()=>{const a=document.querySelectorAll('.nav-links a')[1];const cs=getComputedStyle(a);return cs.textShadow!=='none'&&cs.color==='rgb(255, 255, 255)'})()`), true);
check('nav link has no underline pseudo', await ev(`getComputedStyle(document.querySelectorAll('.nav-links a')[0], '::after').content`), 'none');
check('cta has no bottom rule', await ev(`getComputedStyle(document.querySelector('.cta')).borderBottomWidth`), '0px');

/* it must keep playing without any control */
await new Promise((r) => setTimeout(r, 1500));
check('still playing after a while', await ev(`!document.getElementById('film-video').paused`), true);
check('no control was needed', await ev(`document.querySelectorAll('button').length`), 1);

/* a11y basics */
check('video muted', await ev(`document.getElementById('film-video').muted`), true);
check('wordmark labelled', await ev(`document.querySelector('.brand').getAttribute('aria-label')`), (v) => /NCL/.test(v));
check('cta target', await ev(`document.querySelector('.cta').getAttribute('href')`), '#collections');
check('no media error', await ev(`document.documentElement.classList.contains('film-failed')`), false);
check('brand focusable', await ev(`(()=>{const b=document.querySelector('.brand');b.focus();return document.activeElement===b})()`), true);

/* mobile */
await s('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await s('Page.navigate', { url: `http://127.0.0.1:${PORT}/home/index.html` });
await sleep(4200);
check('mobile src is 720', await ev(`document.getElementById('film-video').currentSrc.split('/').pop()`), 'ncl-70086-720.mp4');
check('mobile no h-scroll', await ev(`document.documentElement.scrollWidth <= innerWidth + 1`), true);
check('mobile no v-scroll', await ev(`document.documentElement.scrollHeight <= innerHeight + 1`), true);
check('mobile wordmark visible', await ev(`document.querySelector('.wordmark').getBoundingClientRect().height`), (v) => v >= 18);
await ev(`document.getElementById('menu-btn').click()`);
await sleep(500);
check('menu opens', await ev(`!document.getElementById('menu').hidden && document.getElementById('menu').classList.contains('is-open')`), true);
check('menu button reachable above overlay', await ev(`(()=>{const r=document.getElementById('menu-btn').getBoundingClientRect();const el=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!(el&&el.closest('#menu-btn'))})()`), true);
await ev(`document.getElementById('menu-btn').click()`);
await sleep(400);
check('menu closes', await ev(`document.getElementById('menu').hidden`), true);

const fail = results.filter((r) => !r.pass);
console.log(JSON.stringify({ total: results.length, failed: fail.length, fail }, null, 2));
ws.close(); chrome.kill(); server.close();
process.exit(fail.length ? 1 : 0);
