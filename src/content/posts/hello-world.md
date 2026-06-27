---
title: "Hello, World — Welcome to Crepusopia"
description: "第一篇博客文章，记录搭建这个博客的初衷与想法。"
published: 2026-06-20
updated: 2026-06-25
tags: [blog, astro, intro]
category: 随想
pinned: true
draft: false
author: "Merrick Jun Ouyang"
image: "/logo.svg"
---

## 为什么写博客

在 2026 年的今天，互联网上的内容比以往任何时候都要丰富，但真正属于自己的空间却越来越少。社交媒体、短视频、即时通讯——信息流从我们身边呼啸而过，却没有留下什么。

写博客是一种对抗。对抗碎片化，对抗速朽，对抗"看过就忘"。

## 技术选型

这个博客基于 **Astro** 构建，使用了以下技术栈：

- **Astro 5** — 静态站点生成器，极致性能
- **Tailwind CSS v4** — 原子化 CSS，灵活高效
- **STIX + Snell 字体** — 精致的排版体验
- **oklch 色彩空间** — 流畅的亮暗模式切换

### 代码示例

```typescript
// 一个简单的 TypeScript 示例
interface Post {
  title: string;
  published: Date;
  tags: string[];
}

const posts: Post[] = await getCollection("posts");
const sortedPosts = posts.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
```

## 接下来

这个博客会记录我在技术、工程和创作上的思考。内容可能涵盖：

1. 前端开发与工程化实践
2. 工具链与效率方法论
3. 读书笔记与生活随想

> "Writing is thinking. To write well is to think clearly. That's why it's so hard."
> — David McCullough

期待在这里与你相遇。
