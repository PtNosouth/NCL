# NCL — deploy

Two things now live on 120.24.169.250 / nclzs.com:

| piece | where | what |
| --- | --- | --- |
| public site | `/var/www/ncl/current` (nginx, static) | the three pages; dynamic parts hydrate from the API |
| content API + admin | `/opt/ncl-api` (node, systemd `ncl-api`) | `/api/…` and `/admin/` |
| data | `/var/www/ncl-data` | `content.json`, `users.json`, `uploads/`, `backups/` |

## URL scheme (one domain)

| url | what | why this shape |
| --- | --- | --- |
| `https://nclzs.com/` | public site | |
| `https://nclzs.com/collection.html` | products | |
| `https://nclzs.com/achievements.html` | patents | |
| `https://nclzs.com/api/…` | content API | same origin ⇒ no CORS, cookie is `SameSite=Strict` + `HttpOnly` |
| `https://nclzs.com/admin/` | admin UI | one certificate, one server block; `noindex` + `X-Robots-Tag` |

A separate `admin.nclzs.com` would only add a DNS record and a certificate — worth doing
if you later want the admin unreachable from the public host (or put `allow <your-ip>; deny
all;` on `location ^~ /admin/`). Nothing else changes.


## 1. What is in this folder

| file | use |
| --- | --- |
| `ncl-site.zip` | the whole site (92 MB — 76 MB of that is the cover film) |
| `nginx-ncl.conf` | server block: gzip, long cache for media/fonts, no-cache for HTML |
| `deploy.ps1` | uploads the zip over scp, unpacks it on the server, reloads nginx |
| `pack.py` | stamps the asset URLs and builds the zip |
| `rollback.sh` | re-points the `current` symlink at the previous release |

Upload layout on the server (keeps releases separate so a bad deploy is one symlink away):

```
/var/www/ncl/
├── releases/
│   ├── 2024-01-01T1200/   <- one folder per deploy (the zip content)
│   └── ...
└── current -> releases/<newest>
```

## 2. Server preparation (once, over SSH)

```bash
sudo mkdir -p /var/www/ncl/releases
sudo chown -R "$USER":www-data /var/www/ncl
sudo chmod 775 /var/www/ncl/releases
```

Copy `nginx-ncl.conf` to `/etc/nginx/sites-available/ncl` (or `conf.d/ncl.conf`), then:

```bash
sudo ln -sf /etc/nginx/sites-available/ncl /etc/nginx/sites-enabled/ncl
sudo rm -f /etc/nginx/sites-enabled/default     # only if the stock page should go away
sudo nginx -t && sudo systemctl reload nginx
```

## 2b. Packaging (every deploy)

```bash
python backend\deploy\pack.py          # stamps ?v=<time> on every css/js, then builds the zip
```

The stamp is what makes a CSS/JS change visible immediately: nginx serves those files with
`no-cache, must-revalidate`, and the new query string bypasses whatever a browser had.
Media, fonts and `/vendor/` stay `immutable` for a year.

## 3. Deploy

From Windows, in this folder:

```powershell
.\deploy.ps1 -User root -Host 120.24.169.250
```

It does, in order:

1. `scp ncl-site.zip` to `/tmp/`
2. creates `/var/www/ncl/releases/<timestamp>/`, unzips into it
3. `chown` + `chmod` the files
4. switches `/var/www/ncl/current` to the new release
5. `nginx -t && systemctl reload nginx`
6. `curl -I http://127.0.0.1/` on the server and prints the status

Password auth is fine — `scp`/`ssh` will prompt. For key auth, pass
`-IdentityFile C:\Users\you\.ssh\id_ed25519`.

## 3b. HTTPS (done for nclzs.com)

- The **轻量应用服务器** firewall (实例 → 防火墙) has to allow `TCP:443`. That is separate from
  nginx and from any OS firewall: with the rule missing the connection is refused before
  nginx is ever reached.
- Certificate: Let's Encrypt, `nclzs.com` + `www.nclzs.com`, webroot
  (`--webroot -w /var/www/ncl/current`), stored in `/etc/letsencrypt/live/nclzs.com/`.
  Certbot is installed with pip (`dnf` has no certbot on Alibaba Cloud Linux 4).
- Config: `conf.d/ncl.conf` has two server blocks that both include
  `snippets/ncl-static.conf`; HTTP 301-redirects the domain to HTTPS but keeps
  `/.well-known/acme-challenge/` on plain HTTP for renewals. TLS is 1.2/1.3 + HTTP/2, with
  HSTS (no preload) driven by the `$hsts_header` map so it is only sent over https.
- Security headers must be re-included **inside every location that sets `add_header`**
  (`snippets/ncl-sec.conf`): nginx drops inherited headers instead of merging them, which is
  how they used to disappear on the HTML pages.
- Renewal: `/etc/cron.d/certbot-renew` → `/usr/local/sbin/ncl-certbot-renew.sh`
  (`certbot renew --quiet --deploy-hook "systemctl reload nginx"`), twice a day.

## 4. Check it

```powershell
curl -I https://nclzs.com/                     # 200 over HTTP/2, HSTS + nosniff
curl -I https://nclzs.com/collection.html      # 200
curl -I https://nclzs.com/achievements.html    # 200
curl -I https://nclzs.com/media/rooms/room-01.webp   # 200, Cache-Control: immutable
curl -I http://nclzs.com/                      # 301 → https://nclzs.com/
curl -I http://120.24.169.250/                 # still 200 over plain http (IP has no cert)
```

Open the site and walk the three pages: cover → scroll into the commissions deck → the
deck carousel → the craft section; the language switch; collection → open a plate; the
achievements wall.

## 5. Rollback

```bash
ssh <user>@120.24.169.250
ls -1t /var/www/ncl/releases | head -3
ln -sfn /var/www/ncl/releases/<previous> /var/www/ncl/current
sudo systemctl reload nginx
```

## 6. Notes

- **The film is 76 MB.** `main.js` picks `media/ncl-70086-720.mp4` (14.6 MB) on small
  screens and `-1080.mp4` (62 MB) otherwise, both `preload="auto"`. nginx sends it with
  range support and an immutable cache header, so it is a one-time cost per visitor — but
  if bandwidth matters, drop the 1080 file and keep the 720 one only (the page still
  works: the loader falls back to the 720 source).
- **HTTPS is not configured yet** (443 is closed). Once a domain points here,
  `sudo certbot --nginx -d your.domain` adds the certificate and the HTTP→HTTPS redirect.
- The site is served from `/var/www/ncl/current`; nothing else on the server is touched.
- `home/.git` (100 MB) and `home/_work` are deliberately **not** in the zip.


## Admin

```bash
journalctl -u ncl-api -n 30 | grep 'admin user'   # first start prints the password once
```

Sign in at `/admin/`, then change the password under 账号. Content edits are live after
“保存” (the public pages fetch `/api/site` on load, `no-cache` + ETag).

## Upgrading an existing install

New documents (craft, footer, …) are added to `content.json` by
`node /opt/ncl-api/migrate.js` — it only fills in what is missing and copies
`content.json.bak-<timestamp>` first. Then `systemctl restart ncl-api`.

## Content pipeline

`content.json` is seeded from `server/seed.json` (exported from the old static pages).
The public pages still ship their static markup: if `/api/site` fails, the site keeps
showing the content it was built with instead of going blank.


## 性能（2026-11 调整）

| 项 | 做法 | 效果 |
| --- | --- | --- |
| JS 压缩 | `gzip_types` 必须含 `text/javascript`（站点给 .js 发的就是这个类型，写成 `application/javascript` 时脚本一个字节都没压） | 页面 JS 约 152KB → 40KB |
| 静态缓存 | 所有 css/js 都带 `?v=<stamp>`，因此 `Cache-Control: public, max-age=31536000, immutable`；HTML 仍 `no-cache`。**改文件必须换 stamp**（`pack.py <stamp>`） | 回访请求数≈0 |
| 内容接口 | `location = /api/site` 单独 5 秒微缓存（`proxy_cache` + 忽略上游 `no-store`），页面里 `<link rel=preload as=fetch>` 提前发起 | 突发访问命中 HIT，编辑 5 秒内生效 |
| 影片 | 1080p 62MB → 9.9MB、720p 15MB → 4.0MB（H.264 CRF31/33，无音轨，faststart），新文件名 `-v2` 以绕开旧缓存；`preload="metadata"`，`load` 后再延迟 600ms 挂载，`saveData` 时不加载 | 首屏不再抢带宽 |
| 海报 | 1920px 303KB → 1600px 167KB | |
| 牌堆图片 | 只有第一张 `loading=eager`，其余 lazy | |
| 原片归档 | 老影片移到 `/var/www/ncl-src/`（不在 docroot，不可公开访问） | |

重编码命令（本地 ffmpeg）：

```bash
ffmpeg -i ncl-70086-1080.mp4 -vf scale=1920:-2 -c:v libx264 -preset slow -crf 31 \
       -maxrate 1800k -bufsize 3600k -pix_fmt yuv420p -movflags +faststart -an out-1080.mp4
ffmpeg -i ncl-70086-720.mp4  -vf scale=1280:-2 -c:v libx264 -preset slow -crf 33 \
       -maxrate 700k -bufsize 1400k -pix_fmt yuv420p -movflags +faststart -an out-720.mp4
```
