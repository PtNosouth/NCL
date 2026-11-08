// Check the page when opened directly as a file (no local server).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DBG = 9226;
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${path.join(ROOT, '_work', 'chrome-profile')}`,
  '--hide-scrollbars', '--disable-gpu', '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--mute-audio',
  '--allow-file-access-from-files', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });

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
await s('Page.navigate', { url: 'file:///F:/Workarea/NCL/home/index.html' });
await new Promise((r) => setTimeout(r, 5000));
const ev = async (e) => (await s('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.value;
const out = {
  fonts: await ev(`JSON.stringify({serif:document.fonts.check('16px "Instrument Serif"'), sora:document.fonts.check('300 16px Sora'), mono:document.fonts.check('16px "Plex Mono"'), status:document.fonts.status})`),
  video: await ev(`JSON.stringify({rs:document.getElementById('film-video').readyState, paused:document.getElementById('film-video').paused, err:document.getElementById('film-video').error && document.getElementById('film-video').error.code, src:document.getElementById('film-video').currentSrc.split('/').pop()})`),
  mask: await ev(`getComputedStyle(document.querySelector('.mark')).maskImage || getComputedStyle(document.querySelector('.mark')).webkitMaskImage`),
  revealed: await ev(`document.body.className`),
};
const shot = await s('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('review/home/file-protocol.png', Buffer.from(shot.data, 'base64'));
console.log(JSON.stringify(out, null, 2));
ws.close(); chrome.kill();
process.exit(0);
