# 内容与依赖安全记录

## 2026-11-01 写作台复核

- 本轮锁文件的 `pnpm audit:security` 返回 **0 未审查、0 已审查且仍未修复**；下面的 2026-10-03 / 2026-10-08 告警描述为历史记录。
- `http-cache-semantics` 已解析至 4.3.0，旧的 4.2.0 例外已删除，`security-exceptions.json` 当前为空。
- Pages 仍是静态托管。作者的细粒度 GitHub 令牌只在当前标签页内存中使用，只发送至 GitHub API；不保存到 localStorage、sessionStorage、导出文件或仓库。浏览器刷新或断开连接清除当前授权。
- Markdown 预览使用语法树解析与 HTML 清理；KaTeX `trust:false`，Mermaid `securityLevel:strict`，远程图片不加载。文章构建继续拒绝原始 HTML 与越界资源。预览和正式文章共用双链、高亮、任务列表无障碍处理。
- 每次写入重新读取分支与文章版本，检查 slug、正文、元数据、图片、文件 SHA 和目标目录；用 GitHub 的非强制分支更新防止并发覆盖。这里的浏览器检查改善反馈，GitHub 自身的仓库权限才是写入授权边界。
- 公开仓库中的草稿原文不受 `draft` 保护。仓库草稿和下架操作有独立确认，默认自动保存仍只在本机。
- GitHub Pages 不执行 Cloudflare `_headers`。本轮不声称获得 Cloudflare 响应头或完整严格 CSP 的保护。

## 尚未修复但已限定评估范围的上游告警

- 公告：https://github.com/advisories/GHSA-ch52-4w7c-c8xp
- 依赖：Astro → http-cache-semantics 4.2.0，审查日 2026-10-03，复核期限 2026-11-02。
- npm audit 当前仍报告该 high 告警；不能称为零漏洞。公告当前没有已修复版本。
- 触发场景：认证共享 HTTP 缓存接受攻击者 max-stale 请求，从跨用户缓存中取得会话信息。
- 已检查真实代码 node_modules/astro/dist/assets/build/remote.js：构建远程图片时自行创建 Request，计算 storable/timeToLive，不转发访客 Cookie 或 max-stale，也未调用受影响的共享缓存复用路径。
- 本项目 output=static，无服务器端认证缓存，不部署 Node SSR，远程图片 domains/remotePatterns 为空，资源由本地文件提供。

精确例外写在 security-exceptions.json，按公告、模块、版本、依赖路径和期限匹配。新增或变更路径、版本、到期后均不能继续借此放行；不得用忽略全部 high 的配置替代逐项评估。新增 SSR、远程图片或认证代理前必须撤销该例外并重新审查。

## 执行方式

- pnpm audit：原始上游报告，当前可能因上述未修复告警返回非零。
- pnpm audit:security：显示原始剩余问题的限定评估结果，未知告警和报告获取失败均阻止通过。
- 草稿、附件、历史部署撤回的产品边界见项目计划；内容保护实现与验收尚在进行中，不将仓库私有当作网站访问控制。

审计门禁另外核对：汇总计数与明细非空状态一致；例外只适用于仍无补丁、严重级别未变化的问题。到期时间显式使用北京时间 ISO 时间戳，不能依赖 CI 主机时区。格式与审计测试均纳入正常检查范围。

## 2026-10-08 安全复核

- 原对话结束后出现的 KaTeX 公告 GHSA-238p-pmpm-9mq7：将直接及 Mermaid/remark/rehype 路径统一到已修复的 0.18.2，保留 trust:false。
- 删除未使用的旧 Typography/slugify/dayjs/remark 插件与组件链，移除其旧 postcss-selector-parser 路径，不扩大例外。
- fast-xml-parser 固定为 5.11.2，并使用独立 SyntaxValidator 做严格 XML 检查；sharp 所有路径统一到 0.35.5，修复 Wrangler/miniflare 的旧传递版本。
- 当前 audit:security 曾验证为 0 未审查、1 已限定且仍未修复；最终报告以最终锁文件再审计为准，绝不称零漏洞。
- 部署前检查完整文件摘要、提交/站点身份、Cloudflare 项目类型和最新 main；注入的失败回归证明失败时不调用上传函数。云端实测状态另列，不用 mock 冒充实际部署。
- public/_headers 提供基础内容类型/来源/嵌入策略和 build-info 不缓存；这里只是基础策略，不声称实现了完整严格脚本 CSP。规则效果需正式 Cloudflare 站点验证。
