# Cloudflare 受控发布

> 本文保留原 `main` 的 Cloudflare 部署说明。当前 `codex/github-pages` 分支使用独立的 [GitHub Pages 工作流](GITHUB-PAGES.md)，不执行本文的 `pnpm deploy`。

## 状态与前置条件

部署与工程检查是两个不同状态。没有凭据时 CI 可以完成工程验证，但部署 job 会跳过，并在运行摘要明确写出 **NOT configured**。这不等于已有正式网站。

本次恢复时（2026-10-08）仓库仍为 private，Secrets/Variables 均为空，Wrangler 也未登录。不要在聊天、源码或文章里粘贴 Token；也不要使用临时公共预览账户冒充正式部署。

## 一次性配置

1. 在自己的 Cloudflare 账户创建 **Pages Direct Upload** 项目，生产分支设为 `main`。不要连接第二条 Git 自动构建。已有 Git 集成项目不能被本项目部署脚本默默当作 Direct Upload 项目使用。
2. 使用项目实际分配的 HTTPS `*.pages.dev` 地址，不需要购买域名。若使用自有域名，先完成该项目的域名绑定。
3. 创建仅限该账户、具有 Pages 编辑权限的 API Token；不要使用全局 API Key。
4. 在 GitHub 仓库 Settings → Secrets and variables → Actions 配置：

| 类型     | 名称                      | 内容                                                       |
| -------- | ------------------------- | ---------------------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`    | 指定账户的最小 Pages Token                                 |
| Secret   | `CLOUDFLARE_ACCOUNT_ID`   | 对应账户的 ID                                              |
| Variable | `CLOUDFLARE_PROJECT_NAME` | Direct Upload 项目的名称                                   |
| Variable | `SITE_URL`                | 实际公开 HTTPS 根地址，如 `https://your-project.pages.dev` |

`SITE_URL` 不允许子路径、查询、片段或凭据。部署拒绝 localhost、测试占位地址及不属于该 Cloudflare 项目的域名。

5. 从 main 推送正常变更，或在 Actions 中手动运行 **Verify and deploy**，保持 `failure_drill=false`。
6. 等待 verify 和 deploy 均通过，并打开运行摘要中的正式站点。检查首页、文章、搜索、RSS、图表和不存在地址的 404。

## 流水线和不可绕过的检查

```text
冻结锁文件安装
→ 格式 / lint / 内容 / 单元覆盖率 / 安全审计
→ 独立样文环境真实构建、浏览器和生命周期测试
→ 最终 dist 清洁构建一次
→ 全量产物校验与 SHA-256 封存
→ 针对这份 dist 的浏览器与性能检查
→ SHA-256 再校验
→ 上传该份产物与清单
→ 部署 job 下载同一次运行的产物
→ 核对提交、站点、文件摘要和 Direct Upload 项目
→ 查询 main 最新提交
→ 串行 Wrangler 上传
→ 线上版本、首页、RSS、搜索资源与 404 冒烟
```

- 工作流默认仅 `contents: read`，所有外部 Actions 固定为完整提交 SHA。
- PR 无 Cloudflare Secrets、无部署、无公开云预览。
- 过时的 verify 可以取消；生产 deploy 使用固定共享并发组且不取消在途发布。
- 排队的旧提交在上传前检查 main。不是最新提交则明确跳过，不能覆盖已发布的新版本。
- 部署阶段没有第二次 `pnpm build`。文件缺失、增加或修改会触发 manifest 检查失败。
- `build-info.json` 只含构建时间、提交和站点地址，不含密钥。上线后用于核对实际版本。
- 仓库 Variables 缺失时不尝试发布；Variables 配齐但 Secrets 错误时部署失败，不能作为成功处理。

## 验证失败确实阻止发布

在 Actions 手动运行工作流，将 `failure_drill` 设为 true。该运行会故意触发断言失败，应看到 verify 失败、deploy skipped、没有新生产版本。随后以 false 重跑正常验收。不要通过 `continue-on-error` 或移除门禁来“修复”这个预期失败。

线上账户配置缺失时，只能验证工作流的依赖阻断和本地部署编排测试；不能声称已经观察到 Cloudflare 的生产版本保持不变。

## 常见故障

| 现象                                            | 处理                                                      |
| ----------------------------------------------- | --------------------------------------------------------- |
| canonical/RSS 出现 localhost 或 example.invalid | 设置真实 SITE_URL 后重新构建，不修改已封存产物            |
| `缺少部署配置`                                  | 在仓库正确类型的 Secret/Variable 中补齐字段               |
| 项目不是 Direct Upload / 分支错误               | 使用正确账户的 Direct Upload 项目，生产分支 main          |
| manifest 不匹配                                 | 查清谁修改了 dist，重新执行完整验证，禁止手工修改清单放行 |
| stale-main                                      | 正常防护，等待最新 main 运行，不重发旧包                  |
| Wrangler 权限错误                               | 检查账户、Token 范围及到期状态，不扩大为全局 API Key      |
| 线上版本暂未一致                                | 流程会有限重试；持续失败按故障处理，不凭上传日志认定上线  |

## 免费额度与维护

使用 Linux/Chromium 日常验证；工具链变化补做 Windows 验证。失败诊断及发布产物最多保留七天，不把它们当作长期备份。Actions 额度与账户其他项目共享，请在账户 Billing 中检查免费额度、可用的费用提醒和超额限制；本项目不会自动开通付费计划。

官方依据：Cloudflare 的 “Use Direct Upload with continuous integration” 和 Pages limits；GitHub Actions 的 concurrency 与 workflow artifacts 文档。固定工具和 Actions 版本及其更新记录见锁文件与工作流。
