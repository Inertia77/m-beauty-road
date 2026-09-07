# M 的美女之路

一个为 GitHub Pages 设计的零构建静态 PWA。现在包含两个并列模块：

- **美女之路**：记录 M 的造型、照片、时间、地点与来源。
- **一起走过**：记录两个人一起旅行、约会、散步和出去玩的地方、感觉、停靠点与照片。

线上地址：`https://inertia77.github.io/m-beauty-road/`

## 信息架构

前端仍然只使用 HTML + CSS + JavaScript + JSON，不引入 React / Vue / Next 或后端。

- `data/photos.json`：美女之路数据。
- `data/journeys.json`：一起走过数据。
- `data/photos.schema.json` / `data/journeys.schema.json`：数据契约。
- `assets/app.js`：数据加载、两个模块渲染、lightbox 与 PWA 基础行为。
- `assets/interactions.js`：移动端与可访问性交互增强。
- `assets/app.css`：基础组件与布局。
- `assets/lux.css`：品牌视觉层。
- `assets/interactions.css`：移动端、触控、dialog 与交互反馈。

`一起走过` 的一条 journey 可以代表一天出游，也可以代表一段多日旅行。长旅行使用 `stops` 保存多个停靠点，不需要把每个地方拆成互不相关的记录。

## 旅程数据原则

旅程支持：

- `startAt` / `endAt`：出行时间；不知道就保持 `null`，不要编造。
- `location`：主要地点；经纬度 optional。
- `stops`：一次旅程的多个停靠点。
- `feelings`：例如「很幸福」「很舒服」「很难忘」。
- `feeling`：一段自然语言的“这次的感觉”。
- `favoriteMoment`：最记得的瞬间。
- `photos`：和美女之路保持一致的 thumb / full 媒体对象，并允许单张照片自己的 `capturedAt`。

当前 `journeys.json` 故意保持为空，框架不会为了展示效果虚构真实旅行记录。

## PWA 图标

图标母版保存在 `assets/icon-source.svg`。正式资源包括：

- `assets/icon-192.png`
- `assets/icon-512.png`
- `assets/apple-touch-icon-180.png`
- `assets/maskable-icon-512.png`

修改母版或 `scripts/generate_icons.py` 后，`.github/workflows/icons.yml` 会重新生成 PNG 变体。不要再提交 `.b64` 图标或媒体 staging 文件。

## 后续照片工作方式

目标工作流是：

Chat 中上传照片 → 读取真实 EXIF（有则使用，没有则保持未知）→ 判断属于美女记录还是共同旅程 → 生成 thumb/full → 更新对应 JSON → validate → 提交 → Pages 更新。

**媒体最终放在哪里暂未锁死。** 前端数据层只依赖 `src` / `thumb` URL，因此以后即使从 GitHub 仓库迁移到更合适的对象存储，也不需要推翻页面结构。

## 发布检查

`Validate archive` 会检查：

- 美女与旅程 JSON 的基础数据约束和本地媒体引用。
- 前端关键 DOM、manifest、PWA 图标尺寸和 Service Worker 核心缓存引用。
- JavaScript 语法。
- 仓库中不应再出现 `.b64` staging 资源。

只有这些检查通过后，当前版本才视为可发布状态。

## PWA 缓存

HTML / CSS / JS / JSON 使用 network-first，在线时优先拿最新版；图片使用 stale-while-revalidate，先显示已有缓存，同时后台更新。Service Worker cache 使用有意义的版本字符串并在 activate 时清理旧的本项目 cache。

## 隐私提醒

仓库与 GitHub Pages 当前是 **Public**。

`noindex` 不是访问控制。不要提交私密聊天、住址、电话、邮箱、身份证件、未打码账号或其他不应公开的信息。来源截图尤其需要先检查敏感信息。
