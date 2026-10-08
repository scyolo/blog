# 执行计划：个人博客 V2.0

## 目标与恢复依据

完整目标见 `docs/PROJECT-PLAN.md`，逐项验收见 `docs/ACCEPTANCE.md`。
接续原聊天 `01a10002-a2f2-7e73-a097-3f789df7cea4`，不缩小 V2.0 范围、不覆盖未提交工作。
保留远程原始提交 `88bf4a5`，验证通过后向私有仓库 scyolo/blog 的 main 正常推送；不强推、不提交凭据或生成产物。

## 阶段与状态（2026-10-08 恢复）

1. 恢复完整需求、核对工作区/远程及未提交改动 — complete。
2. 修复并验证内容/构建缓存/覆盖率断点 — complete。
3. 页面/技术阅读/搜索/无障碍/性能 — complete（Windows 真实验证，正式网络实测另列）。
4. 产物门禁和受控发布链 — complete（实现/本地编排；外部部署验收见第 7 阶段）。
5. 文档、作者工作流与 bundle 恢复 — complete（恢复后真实安装/测试/构建/产物与浏览器通过）。
6. 全量检查、冗余审查、提交/推送、Linux CI 与逐项审计 — in_progress。
7. 正式站点、线上冒烟与网络/回滚验收 — pending（外部依赖：Cloudflare 配置）。

## 不可省略的约束

- AstroPaper / Astro / TypeScript / Tailwind；KaTeX、按需 Mermaid、Pagefind 中文搜索。
- 显式 draft、稳定唯一 slug、带时区日期、单一构建时间；生产不输出草稿/未来内容。
- 公共资源均视为可公开，不把保密材料放入工程；不虚构人物经历、文章或项目。
- Actions 验证并部署同一份 dist；PR 不部署；main 最新提交检查和生产串行发布。
- 缺 Cloudflare 凭据不阻止独立工程工作，但不能据此宣称已上线或整个目标完成。
- 未实际跑过的测试、性能指标、跨环境及云端操作一律不标记通过。

## 当前事实与下一步

- 本地 main 在 `4e23904`，原对话尚有构建缓存/测试/样式等未提交修改。
- 2026-10-08 GitHub API：仓库 private、main 仍在 `88bf4a5`、当前有 ADMIN 权限；Secrets/Variables/Actions runs 均为空。
- 本地命令将 `.cache/toolchain/node_modules/node/bin` 放 PATH 首位，Node 22.23.3、pnpm 10.34.6。
- 先回读 `.cache/resume-coverage.log` 并补齐真实回归，不降低 >=80% 的逐文件门槛。

## 验证与错误记录

每阶段将命令、实际结果、缺陷和限制写入 `progress.md` / `docs/VERIFICATION.md`。最终按完整验收矩阵审计，不能用绿色的窄测试冒充整个博客完成。
