# NCL content API + admin

Node 22, **no dependencies**. Two files and a systemd unit; state is one JSON document
plus an uploads folder.

```
/opt/ncl-api/
├── app.js          the whole server (API + admin static + uploads)
├── seed.json       what a fresh install starts with (exported from the old static site)
└── admin/          index.html · admin.js · admin.css
/var/www/ncl-data/
├── content.json    cover · projects · groups · products · patents
├── users.json      admin accounts (scrypt hashes)
├── uploads/        uploaded images and films (served as /uploads/…)
├── backups/        a copy of content.json on every write, last 20 kept
└── secret.key      HMAC key for the session cookie
```

## API

| method | path | notes |
| --- | --- | --- |
| GET | `/api/site` | public bundle, ETag + `no-cache` (304 on repeat) |
| POST | `/api/auth/login` | `{email,password}` → HttpOnly `SameSite=Strict` cookie, 12 h |
| POST | `/api/auth/logout` | clears the cookie |
| GET | `/api/auth/me` | who is signed in |
| GET | `/api/admin/content` | same shape as `/api/site` |
| PUT | `/api/admin/cover` | `{titleLines[],sub,cta,eyebrow,video{1080,720,poster}}` |
| PUT | `/api/admin/craft` | the atelier section: eyebrow, title lines, media plates, closing plate + CTA |
| PUT | `/api/admin/footer` | brand, footer columns (`links` / `lines` / `socials`), base line |
| POST/PUT/DELETE | `/api/admin/{projects,groups,products,patents}[/:id]` | collection CRUD |
| GET | `/api/admin/{projects,patents}?page=&per=&q=&display=0\|1` | paginated repository (search, shown/hidden filter) |
| POST | `/api/admin/{projects,patents}/batch` | `{action:'delete'\|'show'\|'hide', ids:[…]}` |
| PUT | `/api/admin/{projects,patents}/display-order` | `{ids:[…]}` display order |
| PUT | `/api/admin/order` | `{kind, ids:[…]}` reorder |
| PUT | `/api/admin/upload?name=&kind=image\|video` | **raw body** upload → `{url}` |
| DELETE | `/api/admin/file?url=/uploads/…` | remove an uploaded file |
| POST | `/api/admin/password` | `{current,next}` |

Every mutation needs the `X-NCL-Admin: 1` header (a CSRF speed bump on top of
`SameSite=Strict`), and every write is atomic (tmp + rename) with a backup.

Sessions are **stateless**: the cookie is `{email, expiry}` signed with a key derived from
the server secret *and the user's password hash*, so a restart does not sign anyone out
and a password change invalidates older cookies.

## Run

```bash
node --check app.js
systemctl status ncl-api        # systemd unit in deploy/ncl-api.service
journalctl -u ncl-api -f        # first start prints the generated admin password
```

Uploads: images ≤ 25 MB, video ≤ 400 MB (`image/*`, `video/*` only), sent as a raw body
(`PUT` with the file as the body) so a 400 MB film streams instead of being buffered.

The admin processes images **in the browser** before upload (`prepareImage` in `admin.js`):
products/projects are centre-cropped to 4:5, patents/craft to 1400 px wide, the cover
poster to 1920 px, and everything is re-encoded as WebP at q≈0.85. Batch upload on the
products page does that for a whole selection, takes the model from the filename
(`001-70100-12-12L埃及φ1080H1160.webp` → `70100-12-12L`) and derives the size
(`φ1080H1160` → `∅1080 · H1160`), then files each one into the group on screen. nginx allows the body
through (`client_max_body_size 400m`, `proxy_request_buffering off`).

## Backup / restore

```bash
tar -czf ncl-data-$(date +%F).tgz -C /var/www ncl-data
# restore
systemctl stop ncl-api && tar -xzf ncl-data-YYYY-MM-DD.tgz -C /var/www && systemctl start ncl-api
```

`content.json` keeps its own rolling backups in `backups/`.

## 项目 / 专利：仓库 + 展示

Both collections carry `displayed` (on the site) and `displayOrder` (its position there).
The public bundle only ever contains the displayed rows, in order. Old rows without the
field are migrated to `displayed: true` on load, keeping their original order.
