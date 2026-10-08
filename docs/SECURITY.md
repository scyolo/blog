# 内容与依赖安全记录

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
