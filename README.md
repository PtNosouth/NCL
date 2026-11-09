# 工作约定

**当前所有改动只在静态页（`home/`）进行。** React 版（`react/`）暂停维护，保持原样留档；两边动效暂不同步。

# NCL 新构思 — 首页（封面 + 定制/工艺续接）

一个不依赖构建的静态页：`index.html` + `style.css` + `main.js`，字体与影片自带。直接双击 `index.html` 可看；`start.cmd` 起本地服务（端口 5174）更稳妥。

## 品牌标识（v4）

导航用的是 `logo/ncl-v4-*` 系列里的 **v4 横向锁定版**：从 `ncl-v4-horizontal-dark.svg` 里取出 NCL 字标组成（象牙白字 + 黄铜下划线），去掉它原来自带的深绿底板后内联进两个页面。

- 字标高度 `clamp(21px,1.9vw,27px)`，随导航栏一起缩放
- 后面接中文名 `新构思`（≤620px 隐藏）
- `Guangdong · Worldwide` 移到字标右侧，用一条发丝线与品牌区分开；原来它在导航最右侧

## 页脚（三栏）

`footer.css` 里一个组件，两个页面共用（封面底色 `#000`，产品页跟 Umber 的 `--foot-bg`）。

| 栏 | 内容 |
|---|---|
| 品牌 | `NCL 新构思`（衬线）+ Our story / Made to order / Projects / The collection |
| Factory address | Guangdong, China · Workshop visits by appointment · Mon–Fri 09:00–18:00 CST |
| Connect with us | Instagram / Pinterest / Email 三个圆形描边图标 |


底部一行小字：版权、图片来源、Top ↑。

链接是衬线体 + 1px 发丝下划线（参考图的做法），悬停时下划线转黄铜、文字发光；图标悬停轻微上浮并染铜。

**待补**：工厂街道地址（现在只有 Guangdong, China）、真实社交账号（现在指向 instagram.com / pinterest.com 首页）。

## 页面结构

```
01  封面      200svh     产品影片 · Light, kept in gold. · Follow the light down
              其中前 100svh 是"上升跑道"：封面被钉住，下一屏从底部盖上来
02  定制      300vh 滚动   一段来源说明（这些是已落地的项目）+ 一行随照片切换的读数
                          + 一条八张图的横带（没有标题、没有序号）
03  工艺      约 200vh     A chandelier is a thousand decisions made by hand.
                          Cut / Strung / Lit 三段，晶体微距交替排布
    页脚                   署名 + 回到封面
```

### 01 封面（原有）

- 影片自动循环、无进度条、无播放暂停键，画质保留（1920×1080 / crf 18）。
- 开场"合焦"演出：模糊+暗场 → 对焦清晰 → 灯光晕开（约 3.9s）。
- 标题 `g` 的下伸部不再被遮罩切掉；微光用分层阴影实现。
- 导航悬浮字亮起（无下划线）；`Enquire` 为唯一按钮。

### 02 定制（右侧索引条）

- **扉页到这一屏**：封面 `position: sticky` 钉住，`.bespoke` 用 `margin-top:-100svh` 从下方盖上来；覆盖过程中（p 0→1）封面 `blur(0→10px)`、压暗 42%、轻微后退 `scale(1→1.04)`。纸面本身没有背景色，顶端用 104px 的黑色渐变从全透明过渡，所以没有硬边。盖满后模糊归零。
- **来源说明**：`Commissions` + “Every room here is a commission we built, delivered and hung…”（无序号、无中文）。
- **顶部留白带**：这一屏的图片区整体从 `--band`（13vh，84–150px）之下开始，纸面羽化边里永远没有任何卡片——不是靠淡入或遮罩，而是靠布局留白。
- **右侧索引条**：八张 4:5 卡片在右边排成一列——**互不重叠**（卡高 = 列距 − 14px 间隙）、圆角、轻投影；滚动时整条 rail 跟着平移，当前那张从自己的槽位被抽到大屏，抽走后那格留空。
- **入场停留**：每张卡在开始收回前先停留一段滚动——第一张停 45%（约 0.45 个格子），其余停 20%，所以刚进入这一屏时不会一滚就换片；进入中的下一张层级随开合递增，能稳稳盖住仍在停留的那张。
- **读数跟随画面**：Lights / Drop / Finish / Scale 的切换以"当前占据画面最多的那张"为准，而不是按滚动位置四舍五入，换字与换图同步。
- **最后一张不回收**：滚过最后一格后它不会缩回列表，而是保持铺开、跟着页面一起滚走。
- **卡片上下缘阴影渐变**：展示中的那张，底部 30% 有一层向上淡出的暗部（`rgba(3,3,2,.88)` → 透明），顶部 26% 有一层向下淡出的暗部（`.86` → 透明）；照片是从页面里"浮"出来、"沉"进去，而不是被两条硬边切断。停靠的小图不带这两层。
- **超出即裁切、不隐藏**：卡片不会被突然设成透明；超出显示范围的由容器 `overflow:hidden` 裁掉，所以一张卡被裁到一半时仍然是"一半"而不是整个消失。
- **层级**：展示中的那张 `z-index:900` 在最上；其余按到中心的距离每档降 22。
- **悬停**：指针放到停靠卡上，它从槽位探出 34%、放大 4%，上下邻卡各让开 7px（小于 14px 间隙，不会重叠），移开回位。缓动由 rAF 驱动，与滚动共用同一条 transform 写入路径。
- **读数**：随当前卡切换的 Lights / Drop / Finish / Scale 与一句解释。

### 03 工艺（新）

- 晶体特写（Wikimedia Commons，CC0 / 公有领域）与自家产品影片抽帧交替：Cut（切面）→ Strung（穿挂）→ Lit（点亮）。
- 竖向视差：图片在框内以 0.16 的速率相对滚动漂移。
- 收尾一张自家产品**真的亮着灯**的帧 + 询价 CTA——论证与画面一致。

## 交互与无障碍

- 所有滚动效果只写 `transform` / `opacity`，`requestAnimationFrame` 合并；`prefers-reduced-motion` 下视差、暗幕、标题位移全部关闭，仍可完整阅读。
- 导航固定顶部：离开封面后带渐变底；向下阅读时收起、向上滚动或回到顶部时回来，因此任何标题都不会被压在导航下面。`aria-current` 随所处段落更新。
- 键盘可依次聚焦品牌字标、导航、CTA；`mailto:` 询价入口在 `:focus-visible` 下有金色描边。
- 影片提供 `aria-label`；装饰层 `aria-hidden`。
- 下滑提示只留 CTA 一句话（"Follow the light down"），另加的 Scroll 提示层已删除——页面下半部露出的下一屏本身就是提示。

## 素材与授权

| 素材 | 来源 | 授权 |
|---|---|---|
| `media/ncl-70086-1080.mp4` / `-720.mp4` / poster | 自有产品影片 | 自有 |
| `media/rooms/room-01..04.webp` | 用户提供（`assets/新建文件夹/`），仅裁切与转码 | 自有 |
| `media/crystal/pendants.webp`、`strung.webp` | Wikimedia Commons「Crystal chandelier, Münchner Residenz」局部裁切，作者 Wilfredor | CC0 |
| `media/crystal/lit.webp`、`macro.webp` | 自有产品影片抽帧 | 自有 |

页脚已署名。原始下载件保留在 `work/crystal/`。

## 验证

两套 headless Chrome（CDP）断言，共 **76 项，全过**：

- `_work/verify.mjs`（45 项）：标题/字标/影片/开场/无进度条无暂停键/悬停字亮/CTA 目标/移动端不溢出等原封面约束，加上新增的页脚、胶片带、眉标、图源校验。
- `_work/verify-scroll.mjs`（37 项）：封面被钉住（用影片仍在铺满视口判定）、覆盖过程中模糊与压暗真实增长、纸面上边缘持续上移、盖满后模糊归零、胶片带位移确实变化、**两端吸附时当前卡精确居中（桌面与移动端）**、读数随滚动切换且只有一张卡激活、**胶片带在任何滚动位置都不压到文案**、晶体视差、段落高亮、图片全部解码、移动端无横向溢出、减少动效下动画归零。

截图：`review/final/`（桌面 10 张滚动状态 + 移动端 3 张）。

## 独立评审（截图评审，无源码）

第二轮由独立评审给出（它读到的是我修之前那批帧，重复的 Scroll 提示与手机端断行已在评审时被我自己修掉）。据此又改了一轮：

| 评审指出 | 处理 |
|---|---|
| 封面视口里出现了下一屏的 "02 BESPOKE"，访客看到的第一个编号是 2 | 给 `.bespoke` 加 `padding-top: var(--handoff)`，把这一段交界留成纯黑，编号只在滚动后出现 |
| 卡片缩放导致四张说明文字落在三条基线上 | `transform-origin: 50% 100%` + 固定行高，全部对齐 |
| 卡片按缩放后的宽度算居中，位置偏 | 改用 `offsetLeft + offsetWidth` 计算，两端吸附精确居中（已加断言） |
| 手机端文案与胶片带之间 139px 空洞 | 移动端 pin 改为 `auto auto + space-between` |
| 未激活说明文字 ~30% 不可读 | 卡片透明度 .45→.55，说明文字 .45→.6 |
| "03 — Lit" 与 "01 — CUT / 02 — STRUNG" 大小写不一致 | 统一 `03 — LIT` |
| 三个工艺标题句末标点不一致 | 统一为不带句号（都是词组，不是完整句） |
| "MADE TO YOUR ROOM" 英语不地道 | 改 `MADE FOR YOUR ROOM` |
| "Yours starts with the plan…" 指代不清 | 改为 "Your room starts the same way: …" |
| 08 那张珠帘看起来像另一家的灯具 | 重新裁切到只剩珠串材质，并做了与 07 同一套暖调分级 |

评审另外两条**没有按建议改**，理由需要你来定：一是它建议删掉 08 与 CC0 署名（说借来的灯具撑不起手工主张），但你要的是"用网上搜的水晶图"来讲手工，我保留了图并在页脚署名；二是它要求四张图只差一个变量，这需要你重新渲染。

## 已知边界

- **图片与实际项目的对应关系需要你确认**：现在这八张里，四张来自 `assets/新建文件夹/`、四张来自 `assets/output/product_shots/`，都是渲染图。页面上写的是"已交付并安装的项目"，如果其中有未落地的方案稿，建议换成实拍，否则客户索要 reference 时会站不住。
- 四张房间图是四个不同房间、三种灯具，所以没有写成同一房间的四次对照。
- 四张图都是亮铬/白水晶，没有黄铜、古铜版本，`Finish` 维度目前只有文字。
- 没有车间里"手"的照片：工艺术语停在画面能证明的动作（切割、穿挂、点亮），没有出现无凭据的"工台"措辞。
- 询价是 `mailto:studio@ncl.example` 占位，上线前需换成真实地址或表单页。
- 尚未做：语言切换、项目/产品列表页、OG 分享图。

## 测试用 Chrome 的清理规则

验证脚本会启动 headless Chrome（`--remote-debugging-port=…`，`--user-data-dir=_work/chrome-profile`）。
**绝对不能**用 `Get-Process chrome | Stop-Process -Force` 清理——那会连正在使用的浏览器一起关掉。

正确做法：

```powershell
node work/kill-headless.mjs --dry   # 先看会关掉哪些
node work/kill-headless.mjs         # 只关带 remote-debugging-port 或 _work/chrome-profile 的进程树
```

实测：机器上 26 个用户 Chrome 进程 + 我们 1 个 headless（含 12 个子进程），清理后 38 → 26，用户的进程一个没动。
