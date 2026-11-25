---
title: "Markdown 排版与代码块示例"
description: "展示列表、表格、行内代码和达到折叠阈值的长代码块。"
published: 2026-10-15
category: "工具"
tags: ["markdown","代码","写作"]
pinned: false
draft: false
---

## 常用排版

正文支持**粗体**、*斜体*、~~删除线~~以及`inline code`。

- 一项普通记录
- 包含子项的记录
  - 一个子项
  - 另一个子项

1. 先写初稿。
2. 检查链接。
3. 生成正式构建。

## 长代码块

下面的代码超过 14 行，用于验证原有代码栏的展开、收起和复制按钮。复制内容不应包含按钮文字。

```typescript
interface Article {
  title: string;
  published: Date;
  draft: boolean;
}

function publishedArticles(articles: Article[]) {
  return articles
    .filter(article => !article.draft)
    .toSorted((a, b) =>
      b.published.getTime() - a.published.getTime()
    );
}

const articles: Article[] = [];
const published = publishedArticles(articles);
console.log(published.length);
```

## 表格

| 字段 | 含义 |
| --- | --- |
| title | 标题 |
| published | 发布日期 |
| draft | 是否草稿 |

## 任务列表

- [x] 检查目录
- [x] 检查代码复制
- [ ] 用真实内容替换示例
