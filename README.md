# M 的美女之路

一个为 GitHub Pages 设计的零构建 PWA：响应式照片时间轴、可安装到手机桌面、离线缓存、照片来源与时间字段分离。

线上地址：`https://inertia77.github.io/m-beauty-road/`

## 本地预览

```bash
python -m http.server 8080
```

打开 `http://localhost:8080`。

新增或修改数据后，先运行：

```bash
python scripts/validate.py
```

## GitHub Pages

仓库 Settings → Pages → Build and deployment → Source 选择 **Deploy from a branch**，Branch 选择 `main` + `/(root)`。

## 后续照片的数据约定

每次新增记录时，在 `data/photos.json` 追加一个 entry，并把图片放入 `assets/photos/`。数据契约见 `data/photos.schema.json`。

- `capturedAt`: 原图 EXIF 拍摄时间；没有就保持 `null`
- `sourceTime`: 社交帖、聊天或人工提供的可追溯时间
- `importedAt`: 导入这个项目的时间
- `thumb`: 时间轴用的小图，建议约 360–480 px 宽
- `src`: 点开大图用的较高质量 WebP；如果暂时没有单独大图，可以与 `thumb` 相同
- `tags`, `location`, `note`: 可选整理信息
- `source`: 时间或文字信息的来源截图/资料

时间轴优先使用 `capturedAt`，缺失时再使用 `sourceTime`，最后才使用 `importedAt`。这样不会把发帖时间或上传时间误当成拍摄时间。

图片文件名按记录与序号保持不可变；如果真的替换图片，建议使用新文件名，避免旧设备的图片缓存命中旧内容。

## PWA 缓存策略

页面、JSON、CSS 与 JavaScript 使用 network-first：在线时优先拿最新版，离线时回退缓存。照片使用 cache-first，因为照片路径按档案记录稳定，能减少重复流量并提高手机端浏览速度。

## 隐私提醒

这个仓库和 GitHub Pages 当前都是 **Public**。请不要把身份证件、住址、私密聊天截图、未打码账号信息或其他不希望公开的照片提交到这里。站点带有 `noindex` 和 `robots.txt` 来降低被搜索引擎收录的概率，但这不是访问控制，也不能把 Public 内容变成私密内容。
