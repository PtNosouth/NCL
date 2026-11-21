# Backend — content API, admin UI, deploy scripts

这一层只做三件事：**管理内容**（接口 + 后台界面）、**存内容**（一个 JSON 文档）、**发布**（打包 + nginx + systemd）。

```
backend/
├── server/   Node 22，零 npm 依赖的单文件服务（app.js），外加本地开发脚本与数据修复脚本
├── admin/    后台界面：index.html + admin.js + admin.css（原生 JS，无构建）
├── deploy/   nginx、systemd、证书续期、打包与上传脚本
├── data/     线上内容快照（content.snapshot.json），只给本地开发用
└── .devdata/ 本地运行时的数据目录（自动生成，已在 .gitignore）
```

## 本地起服务

```powershell
.\backend\server\dev.ps1        # http://127.0.0.1:8788（站点 + 后台）
```

- 站点取自 `..\home`，后台取自 `admin`，数据写在 `backend\.devdata\`
- 首次启动会打印随机管理员密码
- 想重置：删掉 `backend\.devdata\` 再启动

## 发布

```powershell
python backend\deploy\pack.py <stamp>     # 打 ?v=<stamp> 并生成 deploy\ncl-site.zip
.\backend\deploy\deploy.ps1 -User root -HostName 120.24.169.250 -IdentityFile <key>
```

后端自身更新不需要打包，直接覆盖文件后重启：

```powershell
scp backend\server\app.js root@120.24.169.250:/opt/ncl-api/app.js
ssh root@120.24.169.250 "node --check /opt/ncl-api/app.js && systemctl restart ncl-api"
```

## 生产路径

| 本地 | 服务器 |
|---|---|
| `backend/server/app.js` | `/opt/ncl-api/app.js` |
| `backend/admin/*` | `/opt/ncl-api/admin/*` |
| `backend/data/`（只读快照） | `/var/www/ncl-data/`（真实数据 + `uploads/` + `backups/`） |
| `backend/deploy/*.conf` | `/etc/nginx/snippets/` 与 `/etc/nginx/conf.d/` |

接口表、存储结构、备份恢复见 [`server/README.md`](server/README.md)；部署步骤与性能策略见 [`deploy/README.md`](deploy/README.md)。
