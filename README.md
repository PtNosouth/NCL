# NCL 新构思 · 品牌站 + 内容后台

灯具品牌 **NCL 新构思**（广东 · 全球）的官网，以及一套自己维护内容的后台。
前台是静态页面，文字/图片/影片由后台写入的内容接口驱动；后端是**零依赖的 Node 进程**，数据存在一个 JSON 文件里。

| | 地址 |
|---|---|
| 前台 | https://nclzs.com/ · `/collection.html`（产品）· `/achievements.html`（专利） |
| 后台 | https://nclzs.com/admin/ |
| 接口 | https://nclzs.com/api/… |
| 服务器 | 120.24.169.250（阿里云轻量应用服务器，Alibaba Cloud Linux 4） |

---

## 1. 技术选型

| 层 | 实现 | 规模 |
|---|---|---|
| 前台 | 纯 HTML + CSS + 原生 JS，**无构建、无框架**；GSAP 3.13 本地内置 | `site.js` 344 行 / `main.js` 713 行 / `i18n.js` 325 行 |
| 后台 | 纯 HTML + 原生 JS，**无构建、无框架** | `admin.js` 1666 行 / `admin.css` 574 行 |
| 后端 | **Node.js 22，零 npm 依赖**（`node:http` / `fs` / `crypto`） | `app.js` 852 行，22 个接口 |
| 存储 | `content.json`（64KB）+ `users.json` + `uploads/`，无数据库 | 8 项目 / 40 专利 / 118 商品 / 5 分组 |
| 运行 | systemd `ncl-api` → `127.0.0.1:8787`；nginx 1.30.4 反向代理 | HTTP/2 + TLS 1.2/1.3（Let's Encrypt） |

为什么不用数据库：写入是一天几十次、单管理员、单进程，整份 64KB 文档原子替换完全够用。量化依据与升级路径见 [第 8 节](#8-已知限制与后续方向)。

---

## 2. 目录结构

```
NCL/
├── home/                 前台静态站点（部署到 /var/www/ncl/current）
│   ├── index.html        扉页 + 项目牌堆 + 工艺段 + 页脚
│   ├── collection.html   产品页（分组 + 图版 + 详情卡）
│   ├── achievements.html 专利墙（四列）
│   ├── site.js           把 /api/site.js 的内容渲染进页面（含 ?preview=1 预览）
│   ├── main.js           牌堆旋转、滚轮门控、菜单、影片、入场
│   ├── i18n.js           中 / 英 / 阿 切换（按英文原文做字典）
│   ├── media/            图片与影片（不进 git）
│   └── README.md         前端的动效与交互设计说明（很详细，改视觉前先读）
├── backend/              后端 = 接口 + 后台界面 + 部署脚本（一个文件夹）
│   ├── server/
│   │   ├── app.js        全部后端逻辑（API + 静态 + 上传）
│   │   ├── seed.json     全新安装的初始内容
│   │   ├── dev.ps1       本地起站点 + 后台
│   │   ├── migrate.js    给旧内容补新字段（可重复执行）
│   │   ├── fix-project-order.js  按原始顺序恢复牌堆
│   │   ├── tools/        一次性内容生成脚本存档
│   │   └── README.md     接口表、存储结构、备份恢复
│   ├── admin/            后台界面（部署到 /opt/ncl-api/admin）
│   ├── deploy/
│   │   ├── pack.py       给页面资源打 ?v=<stamp> 并打包 zip
│   │   ├── deploy.ps1    上传并切换 releases/current
│   │   ├── nginx-ncl.conf 站点 server 块（HTTP→HTTPS）
│   │   ├── ncl-static.conf 静态资源 / 缓存 / API 反代
│   │   ├── ncl-sec.conf  安全响应头
│   │   ├── ncl-api.service systemd 单元
│   │   └── certbot-renew.* 证书续期
│   ├── data/content.snapshot.json   线上内容快照（本地开发用）
│   └── README.md         后端总览
├── react/                React 19 等价移植，**未部署**，仅留档
└── backup/               历史回滚点
```

---

## 3. 架构

```
浏览器
 ├── /、/collection.html、/achievements.html ──► nginx ──► /var/www/ncl/current（静态文件）
 │      └── 加载 /api/site.js（内容打包成脚本）──► nginx ──► node:8787
 ├── /admin/ ────────────────────────────────► nginx ──► /opt/ncl-api/admin（静态）
 │      └── /api/auth/*、/api/admin/* ────────► nginx ──► node:8787
 └── /uploads/* ──────────────────────────────► nginx ──► /var/www/ncl-data/uploads
```

- **同源**：接口和页面同域，所以没有 CORS，登录 Cookie 用 `HttpOnly + SameSite=Strict + Secure`
- **内容以脚本形式下发**：`/api/site.js` 把内容写成 `window.NCL_SITE_DATA`，页面解析前就能拿到，不需要"先 fetch 再渲染"的空窗期
- **有兜底**：接口挂了，页面显示 HTML 里原有的静态内容，不会白屏
- **代码与内容分离**：代码在 `releases/<时间戳>`，内容在 `/var/www/ncl-data` —— 换版本不动内容，改内容不用重新部署

---

## 4. 后台能做什么

六个页签 + 右上角账号菜单：

| 页签 | 能力 |
|---|---|
| **扉页** | 大标题（逐行，支持 `<em>` 做铜色斜体）、副标题、按钮文字、眉标；1080p / 720p 影片与海报；**预览**（未保存内容直接看真实效果） |
| **项目页** | 「项目仓库 / 展示项目」两栏；搜索、分页、新增、批量删除（弹卡选择 + 二次确认）、点卡片改详情、展示区**拖拽排序** |
| **工艺段** | 三个分区：段落标题 / 图文块（可增删排序、左右版式、视差）/ 收尾块（大图 + CTA） |
| **产品页** | 同上两栏 + 左侧**分组侧栏**（可编辑分组：增删改名，删分组只摘标签不删商品）；一个商品可属于**多个分组**；展示区按分组筛选 + 拖拽排序 |
| **专利页** | 同项目页（证书图按原比例完整显示） |
| **页脚** | 只维护「Connect with us」：表格式列表（名称 / 平台 / 链接），点行开详情改备注，批量删除弹卡选择，改动即时保存 |
| **账号菜单** | 修改密码（当前 + 新密码 + 确认）、退出登录 |

通用交互：所有图片上传都在浏览器端**裁成 4:5、缩到 1000~1920px、转 WebP** 后再传；保存按钮有「保存中…」禁用态；弹窗支持嵌套（在删除卡里打开详情，关闭后回到原卡片）。

---

## 5. 数据结构（`content.json`）

```jsonc
{
  "cover":    { "titleLines": [], "sub": "", "cta": "", "video": { "1080": "", "720": "", "poster": "" } },
  "projects": [{ "id", "name", "line", "image", "alt", "displayed", "displayOrder", "createdAt" }],
  "groups":   [{ "id", "title", "note" }],
  "products": [{ "id", "model", "spec", "image", "alt", "groupIds": [], "displayed", "displayOrder" }],
  "patents":  [{ "id", "title", "meta", "image", "alt", "displayed", "displayOrder" }],
  "craft":    { "eyebrow", "title": [], "plates": [], "close": {} },
  "footer":   { "brand", "columns": [], "base": [] }
}
```

- 前台只收到 `displayed !== false` 的行，并按 `displayOrder` 排序（`/api/site` 与 `/api/site.js` 都是）
- 图片路径写成站点相对路径（`media/...`），上传的写 `/uploads/...`
- 旧数据缺字段时，进程启动会自动补齐（见日志 `migrated … rows`）

---

## 6. 本地开发

```powershell
.\backend\server\dev.ps1            # http://127.0.0.1:8788（站点 + 后台）
```

- 使用 `.devdata/`（首次从 `data/content.snapshot.json` 复制），**不碰线上**
- 首次启动会在控制台打印随机管理员密码；之后在后台右上角「修改密码」
- 想重置本地数据：删掉 `.devdata/` 再启动
- 前台预览模式：`http://127.0.0.1:8788/?preview=1&plain=1`（后台「预览」按钮就是用它）

更新内容快照（把线上内容拉到本地）：

```powershell
scp -i <key> root@120.24.169.250:/var/www/ncl-data/content.json backend\data\content.snapshot.json
```

---

## 7. 部署与运维

```powershell
# 1) 打包：给 css/js/html 的资源引用打版本号，生成 zip
python backend\deploy\pack.py 20261122a

# 2) 上传并切换
.\backend\deploy\deploy.ps1 -User root -HostName 120.24.169.250 -IdentityFile <key>
```

- 发布目录 `/var/www/ncl/releases/<时间戳>`，`current` 是指向它的软链；回滚就是改软链
- 只改单个文件时可以直接 `scp` 到当前 release（**必须同步改 `?v=` 版本号**，否则浏览器用旧缓存）
- 后端改动：`scp backend\server\app.js` → `node --check` → `systemctl restart ncl-api`
- 证书：Let's Encrypt（`nclzs.com` + `www`），`/etc/cron.d/certbot-renew` 每天两次调 `/usr/local/sbin/ncl-certbot-renew.sh`；`certbot renew --dry-run` 已验证
- 备份：`/var/www/ncl-data/backups/` 保留最近 20 份；整目录备份 `tar -czf ncl-data-$(date +%F).tgz -C /var/www ncl-data`
- 统计：`journalctl -u ncl-api`（启动/改密日志）、`/var/log/nginx/access.log`

细节见 [`backend/deploy/README.md`](backend/deploy/README.md) 与 [`backend/server/README.md`](backend/server/README.md)。

---

## 8. 已知限制与后续方向

| 限制 | 现状 | 打算 |
|---|---|---|
| 单管理员 | `users.json` 支持多用户，但没有管理界面 | 需要多人时再加 |
| 无并发保护 | 两个标签页同时保存是后写覆盖先写 | 加 `revision` + `If-Match`（推荐先做） |
| 全文覆盖写 | 每次改动重写整份 64KB 文档 | 到 MB 级再考虑 SQLite |
| 无 fsync | 原子替换但没有强制落盘，极端断电可能丢最后一次写 | 加一次 fsync |
| 备份同盘 | `backups/` 与数据在同一块盘 | 加每日异地 `tar` |
| 拖拽排序 | HTML5 DnD，触摸屏不触发 | 需要的话加 Pointer Events 兜底 |
| React 版 | `react/` 是等价移植，未部署、未跟进最新改动 | 只作留档 |

数据库判据：出现**多人同时编辑**、记录到万级、需要复杂查询/订单类事务、或多机部署时，再升级。最平滑的一步是 Node 自带的 `node:sqlite`（已在本机验证可用，零依赖、单文件、有事务），数据模型几乎不用改。

---

## 9. 约定

- 后端**不加 npm 依赖**；前端**不加构建步骤**（这样部署就是拷文件，出问题也能直接看源码）
- 任何改动的资源都要替换 `?v=<stamp>`，否则用户拿不到新版
- 视觉/动效改动先读 [`home/README.md`](home/README.md)，那里记录了每个动效的数值与取舍
- 内容改动走后台，不要直接改 `content.json`（会绕过备份与校验）
