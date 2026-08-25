# M 的美女之路

一个为 GitHub Pages 设计的零构建 PWA：响应式照片时间轴、可安装到手机桌面、离线缓存、照片来源与时间字段分离。

## 本地预览

```bash
python -m http.server 8080
```

打开 `http://localhost:8080`。

## GitHub Pages

仓库 Settings → Pages → Build and deployment → Source 选择 **Deploy from a branch**，Branch 选择 `main` + `/(root)`。

## 后续照片的数据约定

每次新增记录时，在 `data/photos.json` 追加一个 entry，并把图片放入 `assets/photos/`。

- `capturedAt`: 原图 EXIF 拍摄时间；没有就保持 `null`
- `sourceTime`: 社交帖/聊天/人工提供的可追溯时间
- `importedAt`: 导入这个项目的时间
- `tags`, `location`, `note`: 可选整理信息
- `source`: 时间或文字信息的来源截图/资料

这样不会把“发帖时间”“上传时间”误当成拍摄时间。
