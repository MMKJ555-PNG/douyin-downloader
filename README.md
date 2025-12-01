# 极乐去水印工具

纯前端视频去水印工具，支持抖音、TikTok、快手等平台。

## 🚀 快速开始

1. 直接双击打开 `index.html` 文件
2. 或者使用任何 HTTP 服务器运行

## 💡 使用方法

1. **复制视频链接**
   - 打开抖音/TikTok APP
   - 选择要下载的视频
   - 点击分享按钮，复制链接

2. **粘贴链接**
   - 在工具中粘贴视频链接
   - 选择对应的平台（抖音/TikTok/快手）

3. **解析下载**
   - 点击"解析视频"按钮
   - 在页面内或新窗口中完成下载

## 🎯 技术方案

### 方案1：iframe嵌入（当前实现）
- 在页面内直接嵌入 DataTool.vip
- 优点：用户体验流畅
- 缺点：可能遇到跨域限制

### 方案2：新窗口打开
- 自动打开新窗口并复制链接到剪贴板
- 优点：绕过跨域限制
- 缺点：需要用户手动粘贴链接

### 方案3：API调用（可升级）
如果需要更好的集成，可以：
1. 使用公开的去水印API
2. 自建后端代理服务
3. 逆向工程（需谨慎）

## 📦 无需安装

这是一个纯前端项目，无需任何依赖：
- ✅ 不需要 Node.js
- ✅ 不需要 npm install
- ✅ 不需要后端服务器
- ✅ 直接打开 HTML 即可使用

## 🌟 功能特性

- 🎨 现代化UI设计
- 📱 响应式布局，支持移动端
- 🚀 纯前端实现，无需后端
- 🔄 支持多个视频平台
- 💾 自动复制链接到剪贴板
- 🎯 智能URL验证

## 🛠️ 本地运行（可选）

如果想要通过 HTTP 服务器运行：

### 使用 Python:
```bash
# Python 3
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```

### 使用 Node.js:
```bash
npx serve
```

### 使用 PHP:
```bash
php -S localhost:8080
```

然后访问: `http://localhost:8080`

## 📝 支持的平台

- ✅ 抖音 (Douyin)
- ✅ TikTok
- ✅ 快手 (Kuaishou)
- ✅ 更多平台（通过 DataTool.vip）

## ⚠️ 免责声明

本工具仅供学习交流使用，请勿用于商业用途。下载的视频内容版权归原作者所有。

## 🔗 相关链接

- DataTool.vip: https://www.datatool.vip/zh
- 抖音下载器: https://www.datatool.vip/downloader/free-douyin-video-downloader/zh
- TikTok下载器: https://www.datatool.vip/downloader/free-tiktok-video-downloader/zh

## 📄 许可证

MIT License
