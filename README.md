# Fuwari

一个基于 Astro 构建的现代化个人博客主题，专注于技术分享与实践。

## ✨ 特性

- 🚀 基于 Astro 5.7.9+ 构建，性能卓越
- 📱 完全响应式设计，支持移动端
- 🌙 支持深色/浅色主题切换
- 📝 支持 Markdown 和 MDX 格式
- 🔍 内置搜索功能
- 📊 文章阅读时间统计
- 🏷️ 标签和分类系统
- 📈 SEO 优化
- 🎨 可自定义配置
- 💬 评论系统支持
- 📡 RSS 订阅支持
- **🔄 Notion 同步集成** - 从 Notion 一键同步文章到博客（新增）
- **🖼️ 智能图片管理** - 自动下载并按文章分类存储图片（新增）
- **🔗 友链管理系统** - 支持用户提交友链申请，管理员在 Notion 审核（新增）

## 🛠️ 技术栈

- **框架**: Astro
- **样式**: Tailwind CSS + Stylus
- **交互**: Svelte
- **构建工具**: Vite
- **包管理**: pnpm
- **代码规范**: Biome
- **内容同步**: Notion API + notion-to-md（新增）

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 构建生产版本

```bash
pnpm build
```

### 预览构建结果

```bash
pnpm preview
```

## 📝 使用指南

### 创建新文章

#### 方法一：使用 Notion 同步（推荐）

1. **配置 Notion 集成**

   复制 `.env.local.example` 为 `.env.local`：
   ```bash
   cp .env.local.example .env.local
   ```

   编辑 `.env.local`，填入你的 Notion 配置：
   ```env
   NOTION_TOKEN=your_notion_integration_token
   NOTION_DATABASE_ID=your_database_id
   NOTION_FRIEND_LINK_DATABASE_ID=your_friend_link_database_id  # 可选，用于友链管理
   ```

   详细配置步骤请参考 `scripts/README-NOTION-SYNC.md`

2. **在 Notion 中写作**

   在你的 Notion 数据库中创建文章，设置状态为 "Published"

3. **同步到博客**

   ```bash
   # 强制覆盖所有文章（默认）
   pnpm sync-notion

   # 仅添加新文章，不覆盖已存在的
   pnpm sync-notion:new
   ```

   脚本会自动：
   - 📥 从 Notion 获取已发布文章
   - 📝 转换为 Markdown 格式
   - 🖼️ 下载所有图片到本地（按文章分类存储）
   - 🔄 替换图片链接为本地相对路径
   - 💾 保存到 `src/content/posts/` 目录

#### 方法二：使用脚本创建

使用内置脚本快速创建新文章：

```bash
pnpm new-post helloword
```

### 图片管理

**自动图片目录结构**（Notion 同步）：
```
src/content/assets/images/
├── article-slug-1/
│   ├── cover.png         # 封面图
│   ├── image-1.png       # 文章图片 1
│   ├── image-2.jpg       # 文章图片 2
│   └── ...
├── article-slug-2/
│   └── ...
```

**手动管理图片**：
- 放在 `src/content/assets/images/` 目录
- 在文章中使用相对路径：`![alt](../assets/images/your-image.jpg)`

### 清理未使用的图片

清理 `src/content/assets` 目录下未被引用的图片文件：

```bash
pnpm clean
```

### 友链管理

#### 用户提交友链

访问 `/friends` 页面，点击"点击这里提交"按钮，填写友链信息提交申请。申请会自动保存到 Notion 数据库，状态为"待审核"。

#### 管理员审核友链

1. 在 Notion 友链数据库中查看申请
2. 审核通过后将状态改为"已通过"
3. 执行同步命令将已通过的友链同步到博客：
   ```bash
   pnpm sync-friends
   ```

#### 自动同步

配置 `NOTION_FRIEND_LINK_DATABASE_ID` 后，GitHub Actions 会自动同步友链（需在仓库 Secrets 中配置）。

### 配置博客

编辑 `src/config.ts` 文件来自定义博客配置：

```typescript
export const siteConfig: SiteConfig = {
  title: "Fuwari",
  subtitle: "技术分享与实践",
  lang: "zh_CN",
  themeColor: {
    hue: 250,
    fixed: false,
  },
  banner: {
    enable: false,
    src: "assets/images/demo-banner.png",
    position: "center",
  },
  favicon: [
    {
      src: "/favicon/icon.png",
    }
  ]
}
```

### 文章格式

文章使用 Markdown 格式，支持 frontmatter：

```markdown
---
title: 文章标题
published: 2024-01-01
description: 文章描述
image: ./cover.jpg
tags: [标签1, 标签2]
category: 分类
draft: false
---

# 文章内容

这里是文章正文...
```

## 📁 项目结构

```
├── public/                 # 静态资源
├── src/
│   ├── components/         # 组件
│   ├── content/           # 内容
│   │   ├── posts/         # 博客文章（Markdown）
│   │   ├── spec/          # 特殊页面（如关于页面）
│   │   └── assets/        # 资源文件
│   │       └── images/    # 图片（按文章分类存储）
│   ├── layouts/           # 布局
│   ├── pages/             # 页面
│   ├── styles/            # 样式
│   ├── plugins/           # 自定义插件（Markdown 处理）
│   └── config.ts          # 配置文件
├── scripts/               # 脚本工具
│   ├── new-post.js        # 创建新文章
│   ├── clean-unused-images.js  # 清理未使用图片
│   ├── sync-from-notion.js     # Notion 文章同步（新增）
│   ├── sync-friends-from-notion.js  # Notion 友链同步（新增）
│   └── README-NOTION-SYNC.md   # Notion 同步文档（新增）
├── .env.local.example     # 环境变量示例（新增）
└── package.json
```

## 🎨 自定义

### 主题颜色

在 `src/config.ts` 中修改 `themeColor` 配置：

```typescript
themeColor: {
  hue: 250,        // 主色调 (0-360)
  fixed: false,    // 是否固定颜色
}
```

### 样式定制

- 全局样式：`src/styles/main.css`
- Markdown 样式：`src/styles/markdown.css`
- 变量定义：`src/styles/variables.styl`

## 📦 部署

### 构建流程

```bash
# 构建（自动同步 Notion 并构建）
pnpm build

# 仅构建（不同步）
astro build
```

**注意**：`pnpm build` 会自动执行 `pnpm sync-notion` 同步最新文章，然后构建。

### 推荐工作流

#### 日常写作流程
1. 在 Notion 中写作并发布文章
2. 本地预览：`pnpm dev`（可选）
3. 构建部署：`pnpm build`
4. 部署到托管平台（Vercel、Netlify 等）

#### CI/CD 自动化部署

在 GitHub Actions 中添加 Notion 同步：

```yaml
name: Deploy Blog

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 */6 * * *'  # 每 6 小时自动同步一次

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Sync from Notion
        env:
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
          NOTION_DATABASE_ID: ${{ secrets.NOTION_DATABASE_ID }}
          NOTION_FRIEND_LINK_DATABASE_ID: ${{ secrets.NOTION_FRIEND_LINK_DATABASE_ID }}
        run: pnpm sync-notion && pnpm sync-friends

      - name: Build
        run: pnpm build

      - name: Deploy
        # 部署到你的托管平台
```

构建后的静态文件位于 `dist/` 目录，可部署到任何静态托管平台。

**Vercel 部署提示**：
- 在 Vercel 项目设置中添加环境变量：
  - `NOTION_TOKEN`
  - `NOTION_DATABASE_ID`
  - `NOTION_FRIEND_LINK_DATABASE_ID`（可选，用于友链管理）
- 配置 `output: "static"` + `adapter: vercel()` 支持 Serverless API（友链提交功能）

## 🆕 新增功能

### Notion 集成（v0.0.1+）

本项目新增了完整的 Notion 集成功能，让你可以在 Notion 中写作，一键同步到博客。

**核心特性**：
- ✅ 从 Notion 数据库自动获取已发布文章
- ✅ 将 Notion 页面转换为 Markdown 格式
- ✅ 自动下载文章中的所有图片到本地
- ✅ 智能图片管理：按文章 slug 分类存储
- ✅ 自动替换图片链接为本地相对路径
- ✅ 支持封面图、标签、分类等元数据
- ✅ 两种同步模式：强制覆盖 / 仅新增

**使用场景**：
- 📱 移动端写作：使用 Notion 移动 App 随时随地写作
- 🤝 团队协作：多人共享 Notion 数据库协作写作
- 🔄 内容管理：统一在 Notion 管理所有内容
- 🚀 快速发布：写完即发，无需手动处理格式和图片

**详细文档**：
- 配置指南：[scripts/README-NOTION-SYNC.md](scripts/README-NOTION-SYNC.md)
- 环境变量模板：[.env.local.example](.env.local.example)

### 智能图片管理

图片会按文章自动分类存储，避免混乱：

```
src/content/assets/images/
├── my-first-post/
│   ├── cover.png
│   ├── image-1.jpg
│   └── image-2.png
├── another-article/
│   └── image-1.jpg
└── ...
```

**优势**：
- 📂 清晰的目录结构，易于管理
- 🔍 快速定位文章相关图片
- 🗑️ 删除文章时可一并删除图片文件夹
- 🚫 避免图片命名冲突

### 友链管理系统

基于 Notion 的友链管理系统，用户可在线提交友链申请，管理员在 Notion 审核。

**功能特性**：
- ✅ 用户在前端页面提交友链申请（Toast 通知）
- ✅ 申请自动保存到 Notion 数据库，状态为"待审核"
- ✅ 管理员在 Notion 中审核，修改状态为"已通过"或"已拒绝"
- ✅ 执行 `pnpm sync-friends` 同步已通过的友链到博客
- ✅ 支持 GitHub Actions 自动同步

**Notion 数据库字段**：
- 网站名称（Title）
- 网站地址（URL）
- 网站描述（Text）
- 头像URL（URL）
- 状态（Select：待审核/已通过/已拒绝）
- 提交时间（Date）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[MIT License](LICENSE)

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者们！尤其感谢[上游仓库](https://github.com/saicaca/fuwari)