// Screenshot harness: serves the workspace over HTTP and drives headless Chrome via CDP.
// usage: node _work/shot.mjs <plan.json>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 5178;
const DBG = 9223;

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mp4': 'video/mp4', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };

const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outDir = path.resolve(plan.outDir || 'review');
fs.mkdirSync(outDir, { recursive: true });

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, u.replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nope'); return;
  }
  const stat = fs.statSync(file);
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m[1] ? parseInt(m[1]) : 0;
    const end = m[2] ? parseInt(m[2]) : stat.size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(file).pipe(res);
});

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const profile = path.join(ROOT, '_work', 'chrome-profile');
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', '--mute-audio',
  '--force-device-scale-factor=1', '--window-size=1440,900', 'about:blank'
], { stdio: 'ignore', detached: false });

async function waitJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('cdp not up: ' + url);
}

const ver = await waitJson(`http://127.0.0.1:${DBG}/json/version`);
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
function send(method, params = {}, sessionId) {
  const mid = ++id;
  return new Promise((resolve, reject) => {
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
  });
}

const log = [];
for (const shot of plan.shots) {
  const { name, width = 1440, height = 900, path: urlPath = '/home/index.html', wait = 3200, setup = '', evalScript = '' } = shot;
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p = {}) => send(m, p, sessionId);
  await s('Page.enable');
  await s('Runtime.enable');
  await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: /mobile/.test(name) });
  if (shot.reducedMotion) {
    await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  }
  await s('Page.navigate', { url: `${process.env.BASE || `http://127.0.0.1:${PORT}`}${urlPath}` });
  await new Promise((r) => setTimeout(r, wait));
  if (setup) {
    await s('Runtime.evaluate', { expression: setup, awaitPromise: true });
    await new Promise((r) => setTimeout(r, shot.afterSetup || 600));
  }
  if (shot.hover) {
    const r = await s('Runtime.evaluate', {
      expression: `(()=>{const e=document.querySelector(${JSON.stringify(shot.hover)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
      returnByValue: true
    });
    if (r.result.value) {
      await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.result.value.x, y: r.result.value.y, button: 'none' });
      await new Promise((res) => setTimeout(res, shot.hoverWait || 900));
    }
  }
  if (evalScript) {
    const out = await s('Runtime.evaluate', { expression: evalScript, awaitPromise: true, returnByValue: true });
    log.push({ name, eval: out.result && out.result.value });
  }
  const { data } = await s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = path.join(outDir, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  const state = await s('Runtime.evaluate', {
    expression: `JSON.stringify({
      t: document.getElementById('film-video') ? +document.getElementById('film-video').currentTime.toFixed(2) : null,
      paused: document.getElementById('film-video') ? document.getElementById('film-video').paused : null,
      rs: document.getElementById('film-video') ? document.getElementById('film-video').readyState : null,
      w: innerWidth, h: innerHeight,
      clipped: document.querySelector('.film-media') ? getComputedStyle(document.querySelector('.film-media')).clipPath : null,
      bodyClasses: document.body.className
    })`,
    returnByValue: true
  });
  log.push({ name, file, state: JSON.parse(state.result.value) });
  await send('Target.closeTarget', { targetId });
}

console.log(JSON.stringify(log, null, 2));
ws.close();
chrome.kill();
server.close();
process.exit(0);
