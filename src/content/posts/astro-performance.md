---
title: "Astro 静态博客的极致性能优化"
description: "从 Lighthouse 评分到实际加载体验，分享 Astro 博客的性能优化实践。Zero JS by default 不是口号。"
published: 2026-06-15
updated: 2026-06-20
tags: [astro, performance, lighthouse, optimization]
category: 工程实践
pinned: true
draft: false
author: "Merrick Jun Ouyang"
image: "/logo.svg"
---

## 起点：Astro 的默认性能

Astro 的核心理念是 **Zero JavaScript by default**。与 Next.js、Nuxt 等框架不同，Astro 在构建时默认将所有组件渲染为静态 HTML，只在需要交互的地方注入 JS。

这意味着一个 Astro 博客的基线性能已经相当优秀。

## 关键优化点

### 1. 字体加载

字体是最常见的性能瓶颈。使用 `unicode-range` 分段和 `font-display: swap`：

```css
@font-face {
  font-family: "STIX";
  src: url("/fonts/STIX-VF.woff2") format("woff2-variations");
  font-display: swap;
  unicode-range: U+0000-00FF;
}
```

### 2. 图片优化

- 使用 AVIF/WebP 格式
- 利用 Astro 的 `<Image />` 组件自动生成 srcset
- 实现 LQIP (Low Quality Image Placeholders)

### 3. 预加载与预连接

```html
<link rel="preload" href="/fonts/STIX-VF.woff2" as="font" crossorigin />
<link rel="dns-prefetch" href="https://fonts.googleapis.com" />
```

### 4. View Transitions

Astro 的 View Transitions API 让页面导航感觉像 SPA：

```astro
<ClientRouter fallback="none" />
```

## Lighthouse 得分参考

| 指标           | 得分   |
| -------------- | ------ |
| Performance    | 99-100 |
| Accessibility  | 100    |
| Best Practices | 100    |
| SEO            | 100    |

## 小结

Astro 让博客达到 100 分 Lighthouse 不再困难。关键是持续关注字体、图片和第三方脚本。
