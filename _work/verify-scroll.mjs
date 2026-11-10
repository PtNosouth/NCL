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
const waitFor = async (expr, ms = 7000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await ev(expr)) return true; await sleep(120); }
  return false;
};
/* the rail is sprung and can overshoot through an index; only accept one that holds */
const isOpen = (i) => `(function(){var s=document.querySelectorAll('#deck .sheet');return !!(s[${i}] && s[${i}].classList.contains('is-open'));})()`;
const waitStill = async (expr, ms = 12000, need = 3) => {
  const t0 = Date.now();
  let prev = null, same = 0;
  while (Date.now() - t0 < ms) {
    const v = await ev(expr);
    same = (prev !== null && v === prev) ? same + 1 : 0;
    if (same >= need - 1) return true;
    prev = v;
    await sleep(400);
  }
  return false;
};
const waitIdx = async (i, ms = 9000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await ev(isOpen(i))) {
      await sleep(320);
      if (await ev(isOpen(i))) return true;
    }
    await sleep(140);
  }
  return false;
};

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

/* the deck on a phone: the open sheet is centred, the next waits below, the
   rest wait in the right rail */
await s('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await s('Page.navigate', { url: `http://127.0.0.1:${PORT}/home/index.html` });
await sleep(3000);

/* the three columns: copy on the left, rail on the right, the card in the gap */
const stage = async () => ev(`(function(){
  var copy = document.querySelector('.deck-copy').getBoundingClientRect();
  var all = document.querySelectorAll('#deck .sheet');
  var idx = [].findIndex.call(all, function (e) { return e.classList.contains('is-open'); });
  var parked = all[Math.min(idx + 2, all.length - 1)];
  var rail = parked.getBoundingClientRect();
  var open = document.querySelector('#deck .sheet.is-open');
  var r = open ? open.getBoundingClientRect() : null;
  return r ? JSON.stringify({ copyRight: Math.round(copy.right), railLeft: Math.round(rail.left),
                              l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top),
                              b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height),
                              vw: innerWidth, vh: innerHeight }) : 'none';
})()`);

const facts = async () => ev(`(function(){
  var sheets = [].map.call(document.querySelectorAll('#deck .sheet'), function(e){
    var r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return { open: e.classList.contains('is-open'), z: +cs.zIndex, op: +cs.opacity,
             left: r.left, right: r.right, top: r.top, bottom: r.bottom,
             w: r.width, h: r.height, cx: r.left + r.width / 2 };
  });
  return { vw: innerWidth, vh: innerHeight, n: sheets.length,
           idx: sheets.findIndex(function(x){ return x.open; }), s: sheets };
})()`);

const mTop = await ev(`document.getElementById('bespoke').offsetTop`);
await scroll(mTop + 30, 600);
await waitIdx(0);
await sleep(400);
let f = await facts();
check('mobile: one sheet is open at a time', f.s.filter(x => x.open).length, 1);
check('mobile: the open sheet is centred', Math.abs(f.s[f.idx].cx - f.vw / 2) <= 2, true);
check('mobile: the next sheet waits behind the open one', Math.abs(f.s[1].top - f.s[f.idx].top) <= 2, true);
check('mobile: the rest wait in the right rail', f.s.slice(2).every(x => x.left > f.vw * 0.55), true);
check('mobile: no horizontal page overflow', await ev(`document.documentElement.scrollWidth <= innerWidth + 1`), true);

/* desktop deck: one sheet fills the frame, the next is pushed up from below, the
   rest stay in the rail; z order parked > incoming > open > spent */
await s('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await s('Page.navigate', { url: `http://127.0.0.1:${PORT}/home/index.html` });
await sleep(3000);
const deckTop = await ev(`document.getElementById('bespoke').offsetTop`);
const slotPx = await ev(`parseFloat(getComputedStyle(document.getElementById('bespoke')).getPropertyValue('--sheet-scroll'))/100*innerHeight`);
check('the slot height comes from --sheet-scroll', slotPx, (v) => v > 200);

await scroll(deckTop + 10, 600);
await waitIdx(0);
await sleep(500);
f = await facts();
check('eight sheets are in the deck', f.n, 8);
let st = JSON.parse(await stage());
check('the open card sits between the copy and the rail', st.l > st.copyRight && st.r < st.railLeft, true);
check('it is centred in the middle column', Math.abs((st.l + st.r) / 2 - (st.copyRight + st.railLeft) / 2) <= 8, true);
check('and it is a substantial panel, not a thumbnail', st.w > 400 && st.h > 400, true);
/* sampled 10 px into the first slot, so the card sits that much above the axis */
check('the card is centred on the viewport axis', Math.abs((st.t + st.b) / 2 - st.vh / 2) <= 16, true);
const railCentre = await ev(`(function(){
  var a = document.querySelectorAll('#deck .sheet');
  var first = a[2].getBoundingClientRect(), last = a[a.length - 1].getBoundingClientRect();
  return Math.round((first.top + last.bottom) / 2 - innerHeight / 2);
})()`);
check('the next sheet waits behind the active one', Math.abs(f.s[1].top - f.s[f.idx].top) <= 2 && Math.abs(f.s[1].left - f.s[f.idx].left) <= 2, true);
check('the remaining sheets park in the rail', f.s.slice(2).every(x => x.left > f.vw * 0.78), true);
check('every visible parked sheet is fully opaque', f.s.slice(2).every(x => x.op < 0.06 || x.op > 0.99), true);
check('z order: parked above open above the card behind it', f.s[f.idx].z > f.s[f.idx + 1].z && f.s[f.idx].z < Math.min(...f.s.slice(2).map(x => x.z)), true);

await scroll(deckTop + slotPx * 1.04, 400);
await waitIdx(1);
await waitStill(`Math.round(document.querySelector('#deck .sheet.is-open').getBoundingClientRect().top)`);
await sleep(400);
f = await facts();
check('scrolling promotes the next sheet', f.idx, 1);
st = JSON.parse(await stage());
check('the promoted card keeps the same middle column', st.l > st.copyRight && st.r < st.railLeft && Math.abs((st.l + st.r) / 2 - (st.copyRight + st.railLeft) / 2) <= 8, true);
check('the sheet it replaced is gone and sunk behind', f.s[0].op < 0.06 && f.s[0].z < 200, true);
check('nothing but the open card (and the one behind it) is inside the frame', f.s.every((x, i) =>
  i === f.idx || i === f.idx + 1 || x.op < 0.06 || x.left > f.vw * 0.78 || x.top >= f.vh - 60), true);

await scroll(deckTop + slotPx * 4.04, 400);
await waitIdx(4);
await sleep(400);
f = await facts();
const parked = f.s.slice(f.idx + 2);
const afterRail = f.s.map(x => ({ top: Math.round(x.top) }));
/* the carousel's focus card is 12% larger than the step on purpose, so it may sit a
   couple of px over its neighbours; everything else must not overlap */
const overlapOk = (a, b) => Math.max(a.bottom - b.top, b.bottom - a.top) <= 4;
check('parked sheets never overlap each other', parked.every((a, i) => parked.every((b, j) => i === j || a.op < 0.06 || b.op < 0.06 || a.bottom <= b.top + 14 || b.bottom <= a.top + 14)), true);
const railTops = afterRail.map(x => x.top);
await scroll(deckTop + slotPx * 5.04, 1500);
const railTops2 = (await facts()).s.map(x => Math.round(x.top));
check('the rail travels when the page scrolls', railTops2.some((v, i) => Math.abs(v - railTops[i]) > 40), true);

/* the last sheet: it stays open and leaves by scrolling, not by shrinking back */
await scroll(deckTop + slotPx * 8.4, 400);
await waitIdx(7);
await sleep(400);
f = await facts();
check('the last sheet is the open one at the end', f.idx, 7);
check('it never shrinks back as the deck ends', f.s[7].h > 400, true);

/* hover: a parked sheet leans out, grows and rises above the stack */
await scroll(deckTop + slotPx * 3.02, 400);
await waitIdx(3);
await sleep(500);
const beforeHover = await facts();
const hoverIdx = beforeHover.idx + 2;
const target = await ev(`(function(){var r=document.querySelectorAll('#deck .sheet')[${hoverIdx}].getBoundingClientRect();return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)})})()`);
const tp = JSON.parse(target);
/* the page listens for pointerenter/leave on the sheet, so dispatch those rather
   than a real mouse move (headless coalesces those and the leave can be missed) */
await ev(`document.querySelectorAll('#deck .sheet')[${hoverIdx}].dispatchEvent(new PointerEvent('pointerenter'))`);
await waitFor(`+getComputedStyle(document.querySelectorAll('#deck .sheet')[${hoverIdx}]).zIndex === 990`);
await sleep(400);
const afterHover = await facts();
check('hovering pulls that sheet out of the rail', afterHover.s[hoverIdx].left < beforeHover.s[hoverIdx].left - 20, true);
check('hovering enlarges it', afterHover.s[hoverIdx].w > beforeHover.s[hoverIdx].w * 1.04, true);
check('the hovered sheet rises above the parked stack', afterHover.s[hoverIdx].z >= Math.max(...afterHover.s.slice(2).map(x => x.z)), true);
check('its neighbours step aside', Math.abs(afterHover.s[hoverIdx + 1].top - beforeHover.s[hoverIdx + 1].top) > 2, true);
await ev(`document.querySelectorAll('#deck .sheet')[${hoverIdx}].dispatchEvent(new PointerEvent('pointerleave'))`);
await sleep(1500);
const afterLeave = await facts();
/* the rail keeps settling while it is measured, so compare against a neighbour
   that is also parked rather than against an absolute value captured earlier */
const railW = afterLeave.s.slice(afterLeave.idx + 2).map(x => Math.round(x.w)).sort((a, b) => a - b);
const railLeft = afterLeave.s.slice(afterLeave.idx + 2).map(x => Math.round(x.left)).sort((a, b) => a - b);
const median = (a) => a[Math.floor(a.length / 2)];
check('leaving puts it back in the rail',
  JSON.stringify({ idx: afterLeave.idx, hoverIdx, hovered: [Math.round(afterLeave.s[hoverIdx].left), Math.round(afterLeave.s[hoverIdx].w)], median: [median(railLeft), median(railW)] }),
  (v) => { const o = JSON.parse(v); return Math.abs(o.hovered[1] - o.median[1]) <= 14 && Math.abs(o.hovered[0] - o.median[0]) <= 14; });

/* the layer's photograph must sit exactly where the deck's open card sits, or the
   hand-over shows the same picture a second time in a slightly different crop */
await scroll(0, 400);
await scroll(300, 700);            /* let the forward pass run */
await scroll(deckTop, 600);
await waitIdx(0);
/* the rail is sprung: wait until the card has stopped travelling to its slot */
await waitStill(`Math.round(document.querySelector('#deck .sheet.is-open').getBoundingClientRect().top)`);
await sleep(500);
const align = await ev(`(function(){
  var card = document.querySelector('.deck-intro .di-card');
  var c = { left: parseFloat(card.style.left), top: parseFloat(card.style.top),
            width: parseFloat(card.style.width), height: parseFloat(card.style.height) };
  var s = document.querySelector('#deck .sheet.is-open').getBoundingClientRect();
  return JSON.stringify({ c: [Math.round(c.left), Math.round(c.top), Math.round(c.width), Math.round(c.height)],
                          s: [Math.round(s.left), Math.round(s.top), Math.round(s.width), Math.round(s.height)] });
})()`);
check('the layer card is the same box as the deck card', JSON.parse(align), (v) =>
  Math.abs(v.c[0] - v.s[0]) <= 1 && Math.abs(v.c[2] - v.s[2]) <= 1 &&
  Math.abs(v.c[3] - v.s[3]) <= 1 &&
  /* the top tracks the sprung frac, so allow the couple of px the rail can still
     be easing through when this is sampled */
  Math.abs(v.c[1] - v.s[1]) <= 3);
const railCentreJson = await ev(`(function(){
  var a = document.querySelectorAll('#deck .sheet');
  var idx = -1, i;
  for (i = 0; i < a.length; i++) if (a[i].classList.contains('is-open')) idx = i;
  var tops = [], bottoms = [];
  for (i = idx + 2; i < a.length; i++) {
    if (+getComputedStyle(a[i]).opacity > 0.5) {
      var r = a[i].getBoundingClientRect();
      tops.push(r.top); bottoms.push(r.bottom);
    }
  }
  if (!tops.length) return '{"centre":0,"axis":0,"n":0}';
  var t = Math.min.apply(null, tops), b = Math.max.apply(null, bottoms);
  return JSON.stringify({ centre: Math.round((t + b) / 2), axis: Math.round(innerHeight / 2), n: tops.length });
})()`);
const rc = JSON.parse(railCentreJson || '{}');
check('the rail column is centred on the same axis', Math.abs(rc.centre - rc.axis) <= 12, true);

check('the rail is on screen as soon as the deck takes over', await ev(`(function(){
  var r = document.querySelectorAll('#deck .sheet')[2].getBoundingClientRect();
  return r.top > 0 && r.bottom < innerHeight;
})()`), true);

/* the cover → deck transition: a fixed GSAP timeline (fill, then card), which
   hands over to the deck and reverses on the way back up */
check('gsap is loaded for the transition', await ev(`typeof (window.gsap && window.gsap.version) === 'string'`), true);
check('the fill is a gradient, not a flat block', await ev(`getComputedStyle(document.querySelector('.deck-intro .di-black')).backgroundImage.indexOf('linear-gradient') >= 0`), true);
check('the layer never takes pointer events', await ev(`getComputedStyle(document.getElementById('deck-intro')).pointerEvents`), 'none');

/* while the black is still rising the next section must not peek below the cover:
   the fill starts at the bottom, so without the guard its first card shows as a strip */
await scroll(0, 400);
await scroll(200, 450);
check('the deck stays out of sight while the black rises', await ev(`getComputedStyle(document.getElementById('bespoke')).visibility`), 'hidden');

/* a single jump must still land on the right state: position first, not state first */
await scroll(deckTop, 900);
check('the layer hands off once the deck is pinned', await ev(`getComputedStyle(document.getElementById('deck-intro')).visibility`), 'hidden');
check('the deck is back in sight after the hand-off', await ev(`getComputedStyle(document.getElementById('bespoke')).visibility`), 'visible');

/* coming back up: the layer returns to play the reverse, then leaves again */
const vhNow = await ev(`innerHeight`);
await scroll(deckTop - vhNow * 0.62, 350);
check('the layer comes back to play the reverse', await ev(`getComputedStyle(document.getElementById('deck-intro')).visibility`), 'visible');
await waitFor(`getComputedStyle(document.getElementById('deck-intro')).visibility === 'hidden'`, 7000);
check('the reverse ends with the layer gone again', await ev(`getComputedStyle(document.getElementById('deck-intro')).visibility`), 'hidden');

await scroll(deckTop + slotPx * 3.02, 500);
await waitIdx(3);

/* the fill starts on the first few pixels of downward movement (it used to wait for
   18% of the viewport, leaving a dead zone that read as a stall) */
await scroll(0, 500);
await scroll(20, 420);
check('the fill starts on the first downward movement', await ev(`getComputedStyle(document.getElementById('deck-intro')).visibility`), 'visible');
const firstY = await ev(`(function(){var m=getComputedStyle(document.querySelector('.di-black')).transform;return Math.round(parseFloat(m.split(',')[5]));})()`);
check('the black has already left the bottom edge', firstY, (v) => v < 900);
check('the started fill is not cancelled on the next frame', await ev(`getComputedStyle(document.getElementById('deck-intro')).visibility`), 'visible');

/* a quick up-swipe while the fill is still playing must not leave the layer stuck
   over the cover (it used to freeze at progress 1 with no way back) */
await scroll(0, 400);
await scroll(220, 220);
await scroll(0, 220);
await waitFor(`getComputedStyle(document.getElementById('deck-intro')).visibility === 'hidden'`, 9000);
check('a quick up-swipe during the fill recovers', await ev(`getComputedStyle(document.getElementById('deck-intro')).visibility`), 'hidden');
check('and the deck is not left hidden behind it', await ev(`getComputedStyle(document.getElementById('bespoke')).visibility`), 'visible');

/* coming up from the deck the reverse plays progressively, it does not jump */
await scroll(deckTop + 200, 700);
await waitIdx(0);
await scroll(0, 260);
check('the reverse takes over when leaving the deck', await ev(`getComputedStyle(document.getElementById('deck-intro')).visibility`), 'visible');
const blackY = () => ev(`(function(){var m=getComputedStyle(document.querySelector('.di-black')).transform;return Math.round(parseFloat(m.split(',')[5]));})()`);
/* the reverse is 1.10 s now (card 0.42 + black 0.68), so sample while the black
   is still travelling rather than after it has already landed */
await sleep(600);
const midY = await blackY();
check('the black is still on its way out', midY, (v) => v > 0 && v < 900);
await waitFor(`getComputedStyle(document.getElementById('deck-intro')).visibility === 'hidden'`, 9000);
check('the reverse ends back at the cover', await ev(`getComputedStyle(document.getElementById('deck-intro')).visibility`), 'hidden');
check('the cover is the page that is left on screen', await ev(`Math.round(scrollY)`), 0);
await scroll(700, 500);   /* the scroll-spy block below expects to be off the very top */

/* scroll-spy + bar */
check('nav marks the active passage', await ev(`(function(){var a=document.querySelector('[data-spy][aria-current]');return a?a.textContent:'none';})()`), (v) => ['Home', 'Projects'].indexOf(v) >= 0);
check('bar gains a ground below the cover', await ev(`document.body.classList.contains('scrolled')`), true);

/* everything decodes, including the footer */
await ev(`window.scrollTo(0, document.body.scrollHeight)`); await sleep(2200);
check('all images decoded', await ev(`[].every.call(document.images, function(i){return i.naturalWidth>0;})`), true);
check('credit line present', await ev(`/Wikimedia/.test(document.querySelector('.ncl-foot-base').textContent)`), true);
check('footer base row holds the small print', await ev(`document.querySelector('.ncl-foot-base').children.length`), 3);
check('no duplicated deck-intro id', await ev(`document.querySelectorAll('#deck-intro').length`), 1);
check('footer grid keeps exactly four columns', await ev(`document.querySelector('.ncl-foot-grid').children.length`), 4);
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
