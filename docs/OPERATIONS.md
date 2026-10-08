# 下架、撤回、备份与恢复

## 普通下架

1. 将目标文章的 `draft` 改回 true，不改 slug。
2. 运行内容检查、构建、产物验证和浏览器检查；提交并推送 main。
3. 等待受控部署成功，检查文章地址 404，搜索、RSS、标签、归档和 sitemap 不再列出它。
4. 如果有公开附件不应继续保留，同时删除公开目录中的对应文件及所有有效引用。

正常下架不保证历史部署、RSS 阅读器或读者副本被删除。图片与 public 文件不是由 draft 控制的保密存储。

## 敏感撤回

先停止继续传播，再处理可控制的副本：

- 下架当前内容并重新部署；若是凭据，立即在服务端撤销/轮换，删文件本身不够。
- 检查并移除相关公开附件、历史 Pages 部署和预览别名、可控缓存及 GitHub Actions 构建/诊断产物。
- 确认历史部署独立 URL 不再可访问；在 Cloudflare 中逐项处理，不只检查主页。
- 如需清理 Git 历史，单独评估和授权；正常运维不强推、不自动重写仓库历史。
- 搜索引擎、订阅阅读器及第三方保存副本可能继续存在，不能承诺完全收回。

## 安全回滚

先选择一个确认不含已撤回内容的安全版本，不要机械选择“上一个版本”。

- 已配置正式站点时，可在 Cloudflare 中选择已验证的安全生产部署回滚，并核对实际站点内容和版本。
- 源码随后通过正常的新提交修复或 `git revert <bad-commit>`，再走完整 CI。不要强推或让旧提交绕过 main 最新检查。
- 历史产物最多保留七天，过期后应从已知安全源码重建并重新验收，而不是使用未知来源的 dist。

未配置 Cloudflare 时无法完成真实云端回滚演练；本地恢复和模拟部署编排不能冒充该项验收。

## 每月离线备份

先确认内容、配置、资源与锁文件均已提交。下列命令在项目根目录运行，PowerShell 与常见 Unix shell 均可用；备份路径应位于独立介质，示例文件名按实际日期修改。

```sh
git status --short
git bundle create blog-2026-10-08.bundle --all
git bundle verify blog-2026-10-08.bundle
```

不要把 bundle 再提交进仓库。将其复制到独立硬盘或受控备份位置，并记录 SHA-256。bundle 含已提交源码、文章、资源、锁文件和历史，不含未提交工作、node_modules、dist、被忽略的附件或密钥。

密钥在密码管理器或服务账户中单独管理，绝不打包进 Git bundle。保密材料本来就不应该进入博客工程。

## 从备份恢复到空目录

```sh
git clone blog-2026-10-08.bundle recovered-blog
cd recovered-blog
git status --short
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm verify:artifact
pnpm exec playwright install chromium
pnpm test:e2e
```

- Node/pnpm 版本以 `.node-version` 和 `package.json` 为准；没有包缓存的新机器正常联网安装，不能假定 `--offline` 总可用。
- 测试时不需要 Cloudflare Token。发布前重新在自己的账户配置所需凭据。
- 从 bundle 克隆后 origin 指向 bundle 文件；确认历史和身份后，才将 origin 改为正确的私有 GitHub 仓库。不要直接覆盖远程历史。
- 首次恢复先检查敏感撤回名单，不要把一个功能正常但包含已撤回内容的版本重新公开。

## 恢复验收记录

记录备份 SHA-256、源提交、恢复位置、Node/pnpm、安装/测试/构建/产物检查结果。当前实际完成的演练见 VERIFICATION.md；“写了命令”不等于“已运行恢复演练”。
