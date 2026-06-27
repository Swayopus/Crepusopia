---
title: "Obsidian Callout 全功能展示"
description: "测试 remark-obsidian-callout 插件的所有类型：基础、自定义标题、空标题、折叠、嵌套。"
published: 2026-06-25
tags: [test, callout, markdown]
category: 工具
pinned: false
draft: false
author: "Merrick Jun Ouyang"
image: "/logo.svg"
---

## 基础类型

> [!note] Note
> 这是一个 note callout，蓝色竖线。

> [!tip] Tip
> 这是一个 tip callout，绿色竖线。

> [!info] Info
> Info 和 note 共用蓝色系。

> [!warning] Warning
> 这是一个 warning callout，橙色竖线。

> [!danger] Danger
> 这是一个 danger callout，红色竖线。

> [!success] Success
> 这是一个 success callout，绿色竖线。

> [!question] Question
> 这是一个 question callout，橙色竖线。

> [!example] Example
> 这是一个 example callout，紫色竖线。

> [!quote] Quote
> 这是一个 quote callout，灰色竖线。

> [!bug] Bug
> 这是一个 bug callout，红色竖线。

> [!todo] Todo
> 这是一个 todo callout，蓝色竖线。

> [!abstract] Abstract
> 这是一个 abstract callout，青色竖线。

> [!failure] Failure
> 这是一个 failure callout，红色竖线。

## 自定义标题

> [!note] 这是我自定义的笔记标题
> 蓝色竖线，标题文字可以随便写。

> [!tip] 小技巧：使用 Ctrl+K 打开搜索
> 绿色竖线，自定义标题用来描述具体用途。

> [!warning] 注意：此操作不可逆
> 橙色竖线，自定义标题让 warning 更有指向性。

## 空标题（只有图标，没有文字）

> [!note]
> 没有标题，只有图标和内容。

> [!tip]
> 这也是空标题，图标 + 内容。

> [!warning]
> 空标题的 warning。

## 可折叠 Callout

> [!faq]- 点击展开查看答案
> 这是默认收起的 FAQ。`-` 表示默认收起。

> [!example]+ 默认展开的示例
> 这是默认展开的 example。`+` 表示默认展开。点击标题可以收起。

> [!note]- 折叠的笔记
> 这个笔记默认是折叠的。
> 可以包含多行内容。
> 点击标题展开查看。

> [!info]+ 展开的 Info
> 这个 info 默认展开，点击标题可以折叠。

## 嵌套 Callout

> [!question] 第一层：Question
> 外层是一个 question callout。
>
> > [!todo] 第二层：Todo
> > 这是嵌套在 question 里面的 todo callout。
> >
> > > [!example] 第三层：Example
> > > 这是第三层嵌套，example callout。

> [!note] 外层 Note
> 外层 note callout。
>
> > [!tip] 内层 Tip
> > 嵌套的 tip，绿色竖线在蓝色竖线里面。
> > 两个 callout 的竖线颜色各自独立。
> >
> > > [!warning] 最内层 Warning
> > > 三层嵌套，蓝绿橙竖线都有。

## 混合：折叠 + 嵌套

> [!question]- 折叠的问题（点击展开）
> 这个 callout 既是折叠的，又包含嵌套内容。
>
> > [!note] 嵌套的笔记
> > 折叠的外层 + 嵌套的内层。
> > 展开外层的 question 之后可以看到嵌套的 note。

## 普通引用对比

下面是一条普通 Markdown 引用（`>` 语法），用于和 callout 对比竖线宽度：

> 这是普通引用。左侧蓝色竖线，斜体，有淡灰背景。
> 和 callout 的区别：callout 有图标 + 标题，引用没有。

## 复杂折叠测试

### 外层可折叠 + 内层可折叠

> [!question]- 外层折叠（点击展开）
> 外层是折叠的 question。
>
> > [!faq]- 内层也折叠（点击展开）
> > 内层是折叠的 FAQ，在外层里面。
> > 两个都要能独立折叠/展开。
> >
> > > [!example] 最内层不可折叠
> > > 这是一个普通 example，不可以折叠。

### 外层不可折叠 + 内层可折叠

> [!note] 外层不可折叠
> 外层是普通的 note，不可以折叠。
>
> > [!warning]- 内层可折叠（点击展开）
> > 内层是折叠的 warning，在外层里面。
> > 点击内层标题可以展开。
> > 外层的图标不应该受内层折叠影响。

### 三层嵌套 + 各层独立折叠

> [!question]- 第一层（折叠）
> 第一层是折叠的 question。
>
> > [!note] 第二层（不折叠）
> > 第二层是普通的 note。
> >
> > > [!tip]- 第三层（折叠）
> > > 第三层是折叠的 tip。
> > > 各层图标应该独立旋转，互不影响。
