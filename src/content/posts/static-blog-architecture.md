---
slug: static-blog-architecture
title: 一个轻量博客，从 Markdown 到网页
description: 用一张分组架构图，梳理内容、构建与发布之间的关系。
pubDatetime: '2026-09-28T14:00:00+08:00'
draft: false
category: knowledge
tags: [Astro, 架构设计]
cover: ../../assets/images/blueprint.svg
demo: true
---

> **示例文章**：用于解释本站的目标架构，图中的部署流程不代表当前环境已经配置完成。

## 内容是系统的中心

文章保存在普通 Markdown 文件中。文件可以移动，标题可以修改，但显式的永久标识应该保持不变。

## 把职责分开

```mermaid
flowchart TB
  accTitle: 静态博客的分层架构
  subgraph Author[写作侧]
    A[Markdown 与本地图片]
  end
  subgraph Build[构建侧]
    B[字段与资源校验] --> C[Astro 页面]
    C --> D[Pagefind 索引]
    D --> E[构建产物测试]
  end
  subgraph Reader[阅读侧]
    F[静态托管] --> G[浏览器 / RSS]
  end
  A --> B
  E --> F
```

## 同一份产物，完成验证与发布

如果测试与发布各自构建一次，就可能得到不同的结果。更可靠的方式是验收即将发布的那份静态产物，不在发布前重新生成。

## 保持轻量

首版不引入数据库、账号或评论系统。把时间留给内容、阅读与必要的验证。
