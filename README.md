# Crepusopia

**Crepusopia** = Crepusculum（拉丁语"黄昏"）+ Utopia（乌托邦），寓意暮光之中的理想国，在日夜交替之际记录思考与创作。

基于 **Astro 5** + **Tailwind CSS v4** 的个人静态博客，从零构建。参考了 [Fuwari](https://github.com/saicaca/fuwari)、[Firefly](https://github.com/CuteLeaf/Firefly)、[Neomelt Blog](https://github.com/Neomelt/Neomelt_blog)、[Retypeset](https://github.com/radishzzz/astro-theme-retypeset)、[AstroPaper](https://github.com/satnaing/astro-paper) 等项目的设计与实现。

## 环境要求

- **Node.js** ≥ 22
- **pnpm** ≥ 9

## 快速开始

```bash
git clone https://github.com/Swayopus/Crepusopia.git
cd Crepusopia
pnpm install
pnpm dev          # http://localhost:4321
```

## 常用命令

| 命令 | 用途 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 生产构建 + Pagefind 搜索索引 |
| `pnpm preview` | 本地预览构建产物 |
| `pnpm check` | TypeScript + Astro 类型检查 |
| `pnpm new-post <filename>` | 脚手架新文章 |

## 项目结构

```
src/
├── components/
│   ├── Breadcrumb.astro     # 面包屑导航
│   ├── CategoryBar.astro    # 分类筛选栏
│   ├── CodeCopyButton.astro # 代码块增强（语言标签 / 折叠 / 复制）
│   ├── Footer.astro         # 页脚（社交图标 / 搜索 / 主题）
│   ├── Head.astro           # HTML <head>（SEO / OG / FOUC 防护）
│   ├── Header.astro         # 头部（头像 / 标题 / 打字机）
│   ├── Hitokoto.astro       # 一言（hitokoto.cn API）
│   ├── Icon.astro           # 统一 SVG 图标库（18 个图标）
│   ├── Navbar.astro         # 侧边栏导航
│   ├── PostCard.astro       # 文章卡片入口（分发 List / Grid）
│   ├── PostCardList.astro   # 列表布局文章卡片
│   ├── PostCardGrid.astro   # 网格布局文章卡片
│   ├── SearchModal.astro    # Pagefind 全文搜索模态框
│   ├── TOC.astro            # 文章目录（桌面侧栏 + 移动端 FAB）
│   ├── ThemeButton.astro    # 亮色 / 暗色切换
│   └── TypewriterText.astro # 打字机动画
├── layouts/
│   └── Layout.astro         # 页面根 HTML 骨架（桌面 3 列 Grid）
├── pages/                   # 路由页面（Astro 文件路由）
├── utils/                   # 工具函数
│   ├── content.ts           # 文章查询、排序、分类 / 标签提取
│   ├── date.ts              # 日期格式化
│   ├── headings.ts          # 标题提取与 slug 生成
│   ├── reading-time.ts      # 阅读时间估算（混合 CJK / 拉丁）
│   ├── slug.ts              # URL slug 提取
│   └── index.ts             # barrel export
├── styles/
│   ├── font.css             # 字体声明
│   └── global.css           # 全局样式 + 设计令牌
├── content/
│   ├── posts/               # 博客文章（Markdown / MDX）
│   └── status/              # 随记（微博客）
├── config.ts                # 站点全局配置
└── content.config.ts        # 内容集合 Zod schema
```

## 配置

编辑 `src/config.ts` 即可自定义：

- **站点元数据** — 标题、描述、作者、URL
- **语言与地区** — `lang`、`timezone`
- **主题** — 默认色彩模式、字体风格
- **社交链接** — GitHub、Bilibili、X、Telegram
- **导航栏** — 链接与顺序
- **功能开关** — 搜索、RSS、KaTeX、评论、sitemap
- **文章列表** — 布局、每页数量

所有 `@custom` 标记的字段可自由修改。

## 功能

- 亮色 / 暗色主题切换，跟随系统偏好
- Pagefind 全文搜索（`Ctrl+K` 或侧栏按钮）
- 文章目录（桌面侧栏跟随 + 移动端 FAB 抽屉）
- 代码块增强（语言标签、长代码折叠、一键复制）
- Obsidian 风格 Callout（`> [!note]` 等 13 种类型）
- LaTeX 数学公式（KaTeX，仅在 `features.katex` 开启时加载）
- RSS 订阅源 + sitemap
- 友链页面（一键复制本站信息）
- Tag 标签筛选 + 分类筛选
- 打字机动画横幅
- 每日一言（hitokoto.cn API，按天 localStorage 缓存）
- View Transitions 页面过渡动画
- SEO（OpenGraph + Twitter Cards + JSON-LD + Canonical）
- 响应式（桌面 3 列 Grid ↔ 移动端抽屉侧栏）

## 部署

构建产物输出至 `dist/`：

```bash
pnpm build
# 部署 dist/ 目录至 Vercel / Cloudflare Pages / Netlify
```

## Bug 修复记录

见 [BUGFIX.md](BUGFIX.md)。