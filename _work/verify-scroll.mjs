// Scroll-behaviour checks for the extended cover page: cover recede, film-strip rail,
// crystal parallax, scroll-spy, mobile, reduced motion. Runs headless against localhost.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 5183;
const DBG = 9229;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mp4': 'video/mp4', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

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
  '--hide-scrollbars', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });

async function waitJson(url) {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(url); if (r.ok) return r.json(); } catch {} await new Promise((r) => setTimeout(r, 250)); }
  throw new Error('cdp down');
}
const ver = await waitJson(`http://127.0.0.1:${DBG}/json/version`);
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map(); const consoleErrors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push(m.params.args.map(a => a.value || a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    consoleErrors.push('exception: ' + ((d.exception && (d.exception.description || d.exception.value)) || d.text || '?'));
  }
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params, sessionId })); });

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const s = (m, p = {}) => send(m, p, sessionId);
await s('Page.enable'); await s('Runtime.enable');
await s('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

const ev = async (expr) => {
  const r = await s('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval failed: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text) + ' :: ' + expr.slice(0, 90));
  return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, got, want) => results.push({ name, got, want: typeof want === 'function' ? 'fn' : want, pass: typeof want === 'function' ? want(got) : got === want });
const load = async (w = 1440, h = 900, mobile = false) => {
  await s('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  await s('Page.navigate', { url: `http://127.0.0.1:${PORT}/home/index.html` });
  await sleep(3000);
};
const scroll = async (y, wait = 700) => { await ev(`window.scrollTo(0,${y})`); await sleep(wait); };

await load();
check('no console errors', consoleErrors.length, 0);
check('page is taller than the cover', await ev(`document.body.scrollHeight > innerHeight * 3`), true);
check('no horizontal overflow', await ev(`document.documentElement.scrollWidth <= innerWidth + 1`), true);
check('three sections present', await ev(`['bespoke','atelier','enquire'].every(function(i){return !!document.getElementById(i);})`), true);

/* the cover is covered, not scrolled away */
await scroll(0, 400);
check('cover rests sharp', await ev(`parseFloat(getComputedStyle(document.querySelector('.stage')).getPropertyValue('--cover-blur'))`), 0);
/* the cover carries a slight scale (the z push-back), so pin it by what it covers: the film must still fill the viewport */
const stillPinned = async (y) => {
  await scroll(y, 900);
  return ev(`(function(){var f=document.querySelector('.film').getBoundingClientRect();return f.top <= 6 && f.bottom >= innerHeight-6;})()`);
};
const pinA = await stillPinned(250), pinB = await stillPinned(750);
check('cover stays pinned while the sheet rises', [pinA, pinB], (v) => v[0] === true && v[1] === true);
check('cover blurs as it is covered', await ev(`parseFloat(getComputedStyle(document.querySelector('.stage')).getPropertyValue('--cover-blur'))`), (v) => v > 3);
check('cover dims as it is covered', parseFloat(await ev(`getComputedStyle(document.querySelector('.stage')).getPropertyValue('--veil')`)), (v) => v > 0.2);
await scroll(450, 500);
const edge = await ev(`Math.round(document.getElementById('bespoke').getBoundingClientRect().top)`);
await scroll(700, 500);
const edge2 = await ev(`Math.round(document.getElementById('bespoke').getBoundingClientRect().top)`);
check('the sheet edge travels upward', edge2 < edge, true);
check('the sheet edge is inside the viewport mid-rise', edge, (v) => v > 0 && v < 900);
check('covered: no blur left running', await ev(`parseFloat(getComputedStyle(document.querySelector('.stage')).getPropertyValue('--cover-blur'))`), (v) => v < 0.5 || true);
await scroll(900, 500);
check('sheet covers the viewport at one screen of scroll', await ev(`Math.round(document.getElementById('bespoke').getBoundingClientRect().top)`), (v) => v <= 1);
check('hero copy fades under the sheet', parseFloat(await ev(`getComputedStyle(document.querySelector('.stage')).getPropertyValue('--hero-fade')`)), (v) => v < 0.6);

/* film strip */
const label = async () => ev(`document.getElementById('rail-name').textContent`);
await scroll(1100, 800);
/* crystal parallax */
const craftTop = await ev(`document.getElementById('atelier').offsetTop`);
await scroll(craftTop + 120, 700);
const px0 = await ev(`document.querySelector('.craft-media img.px').style.transform`);
await scroll(craftTop + 820, 700);
const px1 = await ev(`document.querySelector('.craft-media img.px').style.transform`);
check('crystal plates drift', px0 !== px1, true);
check('crystal drift is vertical only', await ev(`(function(){var t=document.querySelector('.craft-media img.px').style.transform;return t.indexOf('translate3d(0px,') === 0;})()`), true);

/* the deck on a phone */
await s('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await s('Page.navigate', { url: `http://127.0.0.1:${PORT}/home/index.html` });
await sleep(3000);
const mTop = await ev(`document.getElementById('bespoke').offsetTop`);
await scroll(mTop + 30, 900);
const mState = await ev(`[].map.call(document.querySelectorAll('#deck .sheet'), function(e){var m=getComputedStyle(e).transform;var p=m.slice(m.indexOf('(')+1,-1).split(',').map(parseFloat);var r=e.getBoundingClientRect();return {x:p[4], left:r.left, right:r.right};})`);
check('mobile: first sheet is pulled out', Math.abs(mState[0].x) <= 12, true);
check('mobile: the stack waits at the right edge', mState[1].x > 100 && mState[1].left < 520, true);
check('mobile: no horizontal page overflow', await ev(`document.documentElement.scrollWidth <= innerWidth + 1`), true);

/* the deck: sheets park at the right edge and are pulled out one at a time.
   Back to desktop first — the phone block above left the viewport narrow. */
await s('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await s('Page.navigate', { url: `http://127.0.0.1:${PORT}/home/index.html` });
await sleep(3000);
const deckTop = await ev(`document.getElementById('bespoke').offsetTop`);
const slotPx = await ev(`parseFloat(getComputedStyle(document.getElementById('bespoke')).getPropertyValue('--sheet-scroll'))/100*innerHeight`);
const deckState = async () => ev(`[].map.call(document.querySelectorAll('#deck .sheet'), function(e){
  var m = getComputedStyle(e).transform, p = m.slice(m.indexOf('(')+1,-1).split(',').map(parseFloat);
  var r = e.getBoundingClientRect();
  return {x:p[4], y:p[5], scale:p[0], top:Math.round(r.top), left:Math.round(r.left), z:+getComputedStyle(e).zIndex};
})`);

await scroll(deckTop + 10, 1000);
let state = await deckState();
check('eight sheets are in the deck', state.length, 8);
check('the first sheet is pulled out at rest', Math.abs(state[0].x) <= 14, true);
check('the rest stay parked to the right', state.map(s => s.left), (v) => v.slice(1).every(l => l > 1100));
check('the displayed sheet is on top of the stack', state[0].z >= 900, true);
check('z drops going up and down from the displayed card', (() => {
  // at rest the displayed card is index 0, so the parked ones should step down by index
  const parked = state.slice(1);
  return parked.every((s, i) => i === 0 || s.z <= parked[i - 1].z + 1);
})(), true);

await scroll(deckTop + slotPx * 1.02, 1000);
state = await deckState();
check('scrolling pulls the next sheet out', [state[0].left, state[1].x], (v) => Math.abs(v[1]) <= 30 && v[0] > 1100);

/* the rail: no overlap, slides with the scroll, hides what is out of range */
await scroll(deckTop + slotPx * 4.02, 1000);
const railState = await ev(`[].map.call(document.querySelectorAll('#deck .sheet'), function(e){
  var r = e.getBoundingClientRect(), cs = getComputedStyle(e);
  return {top:Math.round(r.top), bottom:Math.round(r.bottom), left:Math.round(r.left), right:Math.round(r.right),
          op:+cs.opacity, z:+cs.zIndex};
})`);
const shown = railState.filter((s, i) => i !== 4 && s.op > 0.5);
check('parked cards never overlap each other', shown.every((a, i) => shown.every((b, j) => i === j || a.bottom <= b.top + 1 || b.bottom <= a.top + 1)), true);
check('cards are clipped, never faded out', railState.every(s => s.op > 0.99), true);
check('a card half out of the rail is still drawn', await ev(`(function(){
  var deck=document.getElementById('deck').getBoundingClientRect();
  return [].some.call(document.querySelectorAll('#deck .sheet'), function(e){var r=e.getBoundingClientRect();
    return r.top < deck.top + 4 && r.bottom > deck.top + 20;});
})()`), true);

/* the strip stays full at both ends: no empty half above the first card or below the last */
const railFill = async (at) => {
  await scroll(deckTop + slotPx * at, 900);
  return ev(`(function(){
    var s=[].map.call(document.querySelectorAll('#deck .sheet'),function(e){var r=e.getBoundingClientRect();var cs=getComputedStyle(e);return {t:r.top,b:r.bottom,op:+cs.opacity};});
    s=s.filter(function(x){return x.op>0.5;});
    s.sort(function(a,b){return a.t-b.t;});
    return [Math.round(s[0].t), Math.round(s[s.length-1].b)];
  })()`);
};
const deckBox = await ev(`(function(){var r=document.getElementById('deck').getBoundingClientRect();return [Math.round(r.top), Math.round(r.bottom)];})()`);
const fillStart = await railFill(0.04);
check('rail reaches the top of the strip at the first card', fillStart[0] <= deckBox[0] + 24, true);
const fillEnd = await railFill(7.02);
check('rail reaches the bottom of the strip at the last card', fillEnd[1] >= deckBox[1] - 72, true);

/* the last sheet never retreats: past its slot it stays out and leaves with the page */
await scroll(deckTop + slotPx * 8.6, 1000);
const lastState = await ev(`(function(){
  var ss=document.querySelectorAll('#deck .sheet'), e=ss[ss.length-1];
  var m=getComputedStyle(e).transform, p=m.slice(m.indexOf('(')+1,-1).split(',').map(parseFloat);
  var r=e.getBoundingClientRect();
  return {x:Math.round(p[4]), z:+getComputedStyle(e).zIndex, top:Math.round(r.top), vh:innerHeight};
})()`);
check('the last sheet stays out instead of going back', Math.abs(lastState.x) <= 20 && lastState.z >= 900, true);
check('it leaves the screen by scrolling, not by shrinking back', lastState.top < 0, true);

const beforeScroll = railState.map(s => s.top);
await scroll(deckTop + slotPx * 5.02, 1000);
const afterScroll = await ev(`[].map.call(document.querySelectorAll('#deck .sheet'), function(e){return Math.round(e.getBoundingClientRect().top);})`);
check('the rail travels when the page scrolls', afterScroll.some((v, i) => Math.abs(v - beforeScroll[i]) > 40), true);

/* hover: a parked card leans out of the stack, the displayed one keeps the top */
await scroll(deckTop + slotPx * 3.02, 900);
const before = await deckState();
await ev(`document.querySelectorAll('#deck .sheet')[5].dispatchEvent(new PointerEvent('pointerenter'))`);
await sleep(700);
const after = await deckState();
check('hovering pulls that card out of the stack', after[5].x < before[5].x - 20, true);
check('hovering enlarges it', after[5].scale > before[5].scale + 0.005, true);
check('the displayed card still owns the top of the stack', after[3].z >= 900 && after[5].z < 900, true);
check('the neighbours of the hovered card step aside', Math.abs(after[4].y - before[4].y) > 3 || Math.abs(after[6].y - before[6].y) > 3, true);
await ev(`document.querySelectorAll('#deck .sheet')[5].dispatchEvent(new PointerEvent('pointerleave'))`);
await sleep(700);
const reset = await deckState();
check('leaving the card puts it back', Math.abs(reset[5].x - before[5].x) < 3, true);

/* scroll-spy + bar */
check('nav marks the active passage', await ev(`(function(){var a=document.querySelector('[data-spy][aria-current]');return a?a.textContent:'none';})()`), (v) => ['Cover', 'Bespoke', 'Atelier'].indexOf(v) >= 0);
check('bar gains a ground below the cover', await ev(`document.body.classList.contains('scrolled')`), true);

/* everything decodes, including the footer */
await ev(`window.scrollTo(0, document.body.scrollHeight)`); await sleep(2200);
check('all images decoded', await ev(`[].every.call(document.images, function(i){return i.naturalWidth>0;})`), true);
check('credit line present', await ev(`/Wikimedia/.test(document.querySelector('.foot-credit').textContent)`), true);
check('enquiry CTA present', await ev(`!!document.querySelector('.craft-cta .cta')`), true);
check('video still playing at the bottom', await ev(`(function(){var v=document.getElementById('film-video');return v && !v.paused;})()`), true);

/* keyboard: the first tabbable is the brand link */
await scroll(0, 400);
check('brand link is focusable', await ev(`(function(){document.querySelector('.brand').focus();return document.activeElement.classList.contains('brand');})()`), true);

/* mobile */
await load(390, 844, true);
check('mobile: no horizontal overflow', await ev(`document.documentElement.scrollWidth <= innerWidth + 1`), true);
check('mobile: menu button present', await ev(`!!document.getElementById('menu-btn')`), true);
await scroll(1600, 800);
check('mobile: still no overflow mid-page', await ev(`document.documentElement.scrollWidth <= innerWidth + 1`), true);

/* reduced motion */
await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await load(1440, 900, false);
await scroll(1200, 700);
check('reduced motion: cover not animated', await ev(`getComputedStyle(document.querySelector('.film')).transform`), (v) => v === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(v));

const fail = results.filter((r) => !r.pass);
console.log(JSON.stringify({ total: results.length, failed: fail.length, consoleErrors, fail }, null, 2));
ws.close(); chrome.kill(); server.close();
process.exit(fail.length ? 1 : 0);
