---
title: "Tailwind CSS v4 迁移指南：从 v3 到 v4 的变化"
description: "Tailwind CSS v4 带来了全新的 CSS-first 配置方式，本文详细介绍从 v3 迁移的关键步骤和注意事项。"
published: 2026-06-18
updated: 2026-06-22
tags: [css, tailwind, frontend, tutorial]
category: 前端
pinned: false
draft: false
author: "Merrick Jun Ouyang"
image: "/logo.svg"
---

## 最大的变化：CSS-first 配置

Tailwind CSS v4 最根本的变化是**不再需要 `tailwind.config.js`**。所有配置直接写在 CSS 文件中。

### v3 写法 (旧)

```javascript
// tailwind.config.js
export default {
  content: ["./src/**/*.{astro,html,js}"],
  theme: {
    extend: {
      colors: {
        primary: "#3b82f6",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
```

### v4 写法 (新)

```css
/* app.css */
@import "tailwindcss";

@theme {
  --color-primary: #3b82f6;
}
```

## 使用 Vite 插件

在 Astro 项目中，v4 通过 Vite 插件集成：

```javascript
// astro.config.mjs
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
});
```

## 暗色模式

v4 的暗色模式更加直观：

```css
:root {
  --color-bg: oklch(0.985 0.002 106.43);
  --color-text: oklch(0.25 0.01 106.43);
}

.dark {
  --color-bg: oklch(0.18 0.008 260);
  --color-text: oklch(0.9 0.008 260);
}
```

## 总结

v4 的迁移总体上比想象中顺利。关键点：

1. 移除 `tailwind.config.js`，改用 CSS `@theme`
2. 使用 `@tailwindcss/vite` 代替 PostCSS 插件
3. CSS 变量天然支持亮暗模式
4. 构建速度明显提升（得益于 Oxide 引擎）
