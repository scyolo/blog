# 执行计划：个人博客 V2.0

目标：按聊天中确认的 V2.0 完成博客、逐阶段校验与冗余审查，推送 https://github.com/scyolo/blog.git；不得用缩小范围冒充完成。

## 阶段与状态
1. 工程基线、远程历史、依赖与关键组合验证 — in_progress（Windows 基础链已通过；中文/图表组合与 Linux/部署仍待验证）
2. 内容模型、永久链接、发布与附件边界 — in_progress（辅助逻辑已 TDD 验证；schema/loader/产物检查未实现）
3. 首页、列表、项目、关于、中文视觉系统 — pending
4. 技术文章：代码、公式、图表、图片、移动阅读 — pending
5. 搜索、分类、标签、归档、RSS、SEO — pending
6. CI 单一受控发布、产物检查与端到端测试 — pending
7. 无障碍、性能、跨环境、冗余和错误审查 — pending
8. 文档、备份恢复验证、GitHub 推送与部署交付 — pending

## 不可省略的约束
- 目标仓库默认分支 main，保留原始提交 88bf4a5；不强推。
- 已获用户授权：公开网站不要求公开源码，因此仓库改为私有。
- 核心栈 AstroPaper / Astro / TypeScript / Tailwind；公式 KaTeX，图表 Mermaid，搜索 Pagefind。
- 显式 draft、稳定 slug、带时区日期；生产不输出草稿或未来文章。
- 公共资源均视为可公开；不把敏感材料带入工程。
- Actions 检查同一构建产物后上传 Cloudflare；无第二条自动生产构建。
- 不虚构个人经历或作品；样文清晰标注，工程验收与真实内容上线分离。
- 不提交凭据、依赖或构建产物。没有部署凭据时如实记录，继续完成可独立验证部分。

## 完成证据
每阶段记录命令、结果、缺陷修复及审查结论；功能/安全检查不能用空测试或缩小覆盖范围代替。最终逐条审计全部需求，再决定是否完成。

## 当前恢复入口
- 完整逐项验收在 docs/ACCEPTANCE.md。
- 本地命令先把 .cache/toolchain/node_modules/node/bin 放 PATH 首位，Node 22.23.3；pnpm 自动使用 10.34.6。
- 优先修正测试覆盖率归集（vi.resetModules），统一安全测试到 Vitest，再实现严格 frontmatter + 唯一 slug loader 与真实产物检查。
- 测试通过不等于整个博客完成；当前页面仍有上游示例，不能当最终网站发布。
