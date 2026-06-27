---
title: "oklch 色彩空间：现代 CSS 的配色新范式"
description: "对比 RGB、HSL 和 oklch，理解为什么 oklch 是设计系统和主题切换的最佳选择。"
published: 2026-06-10
updated: 2026-06-18
tags: [css, design, colors, oklch]
category: 设计
pinned: false
draft: false
author: "Merrick Jun Ouyang"
image: "/logo.svg"
---

## 为什么不用 HSL？

HSL 有一个众所周知的问题：**相同 Lightness 值的不同色相，人眼感知亮度完全不同**。

例如，`hsl(240, 100%, 50%)`（蓝色）和 `hsl(60, 100%, 50%)`（黄色）的 L 都是 50%，但黄色明显比蓝色亮得多。

## oklch 的改进

oklch 使用**感知均匀**的亮度通道：

```css
:root {
  /* 这两个颜色的感知亮度是一致的 */
  --blue: oklch(0.6 0.2 265);
  --yellow: oklch(0.6 0.2 95);
}
```

## 亮暗模式的优雅切换

```css
:root {
  --bg: oklch(0.98 0.002 106); /* 亮色背景 */
  --text: oklch(0.25 0.01 106); /* 亮色文字 */
}

.dark {
  --bg: oklch(0.18 0.008 260); /* 暗色背景 */
  --text: oklch(0.9 0.008 260); /* 暗色文字 */
}
```

## 浏览器支持

oklch 已在所有现代浏览器中得到支持（Chrome 111+, Safari 15.4+, Firefox 113+）。

## 小结

从 HSL 迁移到 oklch 是值得的——更准确的亮度控制、更简洁的实现方式、更好的可访问性。
