# 执行计划：个人博客 V2.0

## 完整目标

目标保持 `docs/PROJECT-PLAN.md` 的全部范围，逐项状态见 `docs/ACCEPTANCE.md`。从原聊天 `01a10002-a2f2-7e73-a097-3f789df7cea4` 恢复，不缩小范围，不用工程验证代替正式上线。

## 阶段状态（2026-10-08）

1. 恢复需求、核对工作区/远程/未提交改动 — complete。
2. 内容模型、固定 URL、发布边界、缓存与覆盖率 — complete。
3. 页面、中文/技术阅读、检索、无障碍及性能 — complete（Windows/Linux 实测，公网另列）。
4. 产物校验、SHA-256 与单一受控发布链 — complete（实现与门禁验证；实际上传另列）。
5. 写作/发布/下架/备份文档和模板工作流、真实恢复 — complete。
6. 冗余审查、源码推送、Linux CI、失败演练及逐项审计 — complete。
7. Cloudflare 正式项目配置、上传、线上/网络/回滚验收 — pending，外部账户配置缺失。

## 已验证的状态

- 功能实现提交 `bfdd776ae415a148b9f9ae3502229856fc43bcf3` 已正常推送私有仓库 scyolo/blog 的 main，保留原始提交 88bf4a5，无强推。
- Linux CI `37729671010` 成功；失败演练 `37728723347` 在指定断言处预期失败并跳过部署。
- 基础 6 + 单元 119、构建契约 9、独立样文浏览器 20、正式产物浏览器 6 全部通过；空站、草稿/未来文章、下架与分页实际验证。
- 逐文件覆盖率 >=80%，Windows/Linux 三页 Lighthouse 100/99/100，a11y/SEO 100，CLS 0。
- 19 HTML、3 发布示例文章、3 搜索文档、213 文件经产物门禁及前后 SHA-256 校验。
- 最新功能版本的完整 bundle 已从空目录恢复、离线安装并重新测试/构建/验收。
- 仍有 1 项精确限定但未修复的 high 上游告警，到期 2026-11-02，详情见 SECURITY.md。

## 下一步必须由账户配置解锁

在 GitHub Actions 中设置 Secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`，Variables `CLOUDFLARE_PROJECT_NAME` / `SITE_URL`。使用作者实际的 Direct Upload 项目和公开 HTTPS 地址，不在聊天中传 Token，不创建临时账户替代正式站点。

配置后重跑完整发布链，验证实际上传、正式版本、404/RSS/搜索/图表、Cloudflare 规则、真实宽带/移动访问以及安全回滚。账户费用提醒和历史部署撤回也需实测/确认。

## 不可省略的边界

- 私有仓库、draft 均不是附件访问控制，保密资料不进工程。
- 不虚构个人文章/项目；技术样文与作者真实内容的验收已分离。
- PR 不部署，不读取 Cloudflare Secrets；已测试产物不二次构建；生产串行且拒绝过时 main。
- 未取得 Cloudflare 配置时，目标保持未完成；不得用“源码已推送”改写为“网站已上线”。
