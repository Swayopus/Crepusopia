---
title: "提示块示例：类型、折叠与嵌套"
description: "覆盖全部常用 Obsidian Callout 类型，验证原有点击标题折叠逻辑。"
published: 2026-10-17
category: "工具"
tags: ["markdown","callout","示例"]
pinned: false
draft: false
---

## 基础类型

> [!note] note
> 这是 note 类型的提示块，用于检查图标、边框和文字颜色。

> [!abstract] abstract
> 这是 abstract 类型的提示块，用于检查图标、边框和文字颜色。

> [!info] info
> 这是 info 类型的提示块，用于检查图标、边框和文字颜色。

> [!todo] todo
> 这是 todo 类型的提示块，用于检查图标、边框和文字颜色。

> [!tip] tip
> 这是 tip 类型的提示块，用于检查图标、边框和文字颜色。

> [!success] success
> 这是 success 类型的提示块，用于检查图标、边框和文字颜色。

> [!question] question
> 这是 question 类型的提示块，用于检查图标、边框和文字颜色。

> [!warning] warning
> 这是 warning 类型的提示块，用于检查图标、边框和文字颜色。

> [!failure] failure
> 这是 failure 类型的提示块，用于检查图标、边框和文字颜色。

> [!danger] danger
> 这是 danger 类型的提示块，用于检查图标、边框和文字颜色。

> [!bug] bug
> 这是 bug 类型的提示块，用于检查图标、边框和文字颜色。

> [!example] example
> 这是 example 类型的提示块，用于检查图标、边框和文字颜色。

> [!quote] quote
> 这是 quote 类型的提示块，用于检查图标、边框和文字颜色。

## 可折叠提示块

> [!faq]- 点击展开查看答案
> 这段内容默认收起。鼠标点击或键盘操作标题后展开。

> [!example]+ 默认展开的示例
> 这段内容默认展开，再次点击标题可收起。

## 嵌套与独立状态

> [!question]- 外层问题
> 外层收起时，下面整个提示块都应隐藏。
>
> > [!tip]- 内层提示
> > 内层可以独立展开，不能触发外层的折叠。
> >
> > > [!note] 最内层笔记
> > > 三层嵌套应保持完整结构。

## 空标题

> [!note]
> 保留旧版只有图标的空标题表现。

## 普通引用

> 普通引用保持原有排版，不会变成可折叠提示块。
