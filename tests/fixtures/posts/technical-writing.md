---
slug: technical-writing
title: 把想法写清楚：代码、公式与图解
description: 一篇技术排版示例，验证代码、表格、数学公式与流程图能否共同服务于阅读。
pubDatetime: "2026-10-01T09:00:00+08:00"
draft: false
category: knowledge
tags: [Markdown, 技术写作]
cover: ../../assets/images/blueprint.svg
demo: true
---

> **示例文章**：本文用于演示与验证排版，不代表作者的研究成果或个人经历。

## 先写清楚问题

好的技术记录不仅保存答案，也留下思路。我们希望读者能够看懂输入、处理过程，以及结果如何被验证。

## 用一小段代码说明规则

```typescript
type Post = { draft: boolean; publishedAt: Date };

function isPublished(post: Post, now: Date): boolean {
  return post.draft === false && post.publishedAt <= now;
}
```

代码的关键不是长度，而是边界是否明确：草稿不会因为漏填状态而意外公开。

## 让公式成为解释的一部分

行内公式如 $E = mc^2$ 不应该打断阅读。需要展开时，可以使用独立公式：

$$
\mathcal{L}(\theta) = \frac{1}{n} \sum_{i=1}^{n} (y_i - f_\theta(x_i))^2
$$

公式采用 KaTeX 支持的语法，而不是完整的 LaTeX 工程。

## 通过图解连接步骤

```mermaid
flowchart LR
  accTitle: 从 Markdown 到网页
  accDescr: 写作经过校验、构建和发布，成为读者可以访问的页面。
  A[Markdown 写作] --> B[内容校验]
  B --> C[静态构建]
  C --> D[发布页面]
```

## 用表格总结选择

| 内容 | 处理方式 | 读者得到什么   |
| ---- | -------- | -------------- |
| 文章 | Markdown | 清楚的层级     |
| 公式 | KaTeX    | 稳定的数学排版 |
| 图表 | Mermaid  | 可维护的说明图 |

## 留下可复现的结论

发布之前，应当检查普通屏幕、窄屏和暗色模式。真正重要的不是功能列表有多长，而是每一种表达能否被舒适地阅读。

## 本地图像格式验收

以下小图只验证文件格式、尺寸和延迟加载行为。

![PNG 格式测试图](../../assets/images/format-sample.png)

![WebP 格式测试图](../../assets/images/format-sample.webp)
