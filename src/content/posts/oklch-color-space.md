---
title: "颜色示例：保留主题变量"
description: "说明原有 oklch 主题变量，作为颜色与代码高亮测试文本。"
published: 2026-10-14
category: "设计"
tags: ["css","oklch","主题"]
pinned: false
draft: false
---

## 这是一份说明示例

站点继续使用原来的暖色背景、文字颜色和主色变量。此文章用于演示 CSS 代码块，不表示本次重新设计了主题。

## 变量引用

```css
.example {
  color: var(--color-text);
  background: var(--color-bg);
  border-color: var(--color-border);
}
```

## 检查主题切换

点击原来的主题按钮，观察侧栏、正文、代码块与图标是否同步变化。通过文章链接切页后，主题选择应保留。

## 系统偏好

没有手动选择主题时，站点应继续跟随系统偏好；自动检测结果不应被误存为手动选择。
