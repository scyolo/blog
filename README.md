# 行间 · scyolo

一个中文、静态、内容优先的个人博客。以 AstroPaper 为起点，使用 Astro、TypeScript 和 Tailwind；支持 Markdown、KaTeX、按需 Mermaid、中文 Pagefind、RSS 和暗色模式。

> 工程实现与正式上线分开验收。当前公开样文均标记为示例，不代表作者经历；真实内容可全部替换或删除。部署状态与已验证范围以 [验收报告](docs/VERIFICATION.md) 为准，不能仅凭 README 或绿色单元测试认定已经上线。

## 本地开始

按 `.node-version` 安装 **Node 22.23.3**，使用 `package.json` 指定的 **pnpm 10.34.6**。不要关闭 TLS 校验或使用未固定的依赖安装方式。

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev
```

开发服务器用于写作，可预览草稿和未来文章。中文搜索只使用生产索引：

```sh
pnpm build
pnpm verify:artifact
pnpm preview
```

本次 Windows 工作区已有隔离工具链。仅在该目录可用下面的 PowerShell 命令选择它，不修改系统 Node；新机器仍应按版本文件安装：

```powershell
$env:Path="$PWD\.cache\toolchain\node_modules\node\bin;$env:Path"
node --version
pnpm --version
```

## 日常操作

- [写作、图片、公式、图表、新建项目与下架](docs/WRITING.md)
- [Cloudflare 配置与受控发布](docs/DEPLOYMENT.md)
- [离线备份、恢复、普通下架与敏感撤回](docs/OPERATIONS.md)
- [完整需求基线](docs/PROJECT-PLAN.md) / [逐项验收](docs/ACCEPTANCE.md)
- [安全告警与精确例外](docs/SECURITY.md) / [上游来源与修改](docs/UPSTREAM.md)

编辑 `astro-paper.config.ts` 配置站名、简介、作者、公开联系链接和分页数量。关于页在 `src/content/pages/about.md`。邮箱没有预填假地址；需要时将真实邮箱作为 `mailto:` 链接加入 socials。

文章位于 `src/content/posts/`，项目位于 `src/content/projects/`。从 `templates/` 复制模板，必须填写唯一 slug、带时区日期和显式 draft。文章永久链接只取决于 slug，不取决于文件名或标题。

## 校验命令

| 命令                                         | 实际检查内容                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm format:check` / `pnpm lint`            | 格式与代码规范，包含新脚本、测试、工作流和文档                                  |
| `pnpm validate:content`                      | 元数据、唯一 slug、资源边界、禁止原始 HTML/MDX                                  |
| `pnpm test`                                  | 基础约束与单元回归                                                              |
| `pnpm test:coverage`                         | 内容、发布、清理、产物和部署业务模块逐文件 >=80%                                |
| `pnpm test:build-contract`                   | 隔离环境的真实构建、完整样文浏览器测试、发布/预览/下架/空内容/分页              |
| `pnpm build`                                 | 清理固定产物和内容缓存、类型检查、静态构建、中文搜索索引                        |
| `pnpm verify:artifact`                       | 全量 HTML 链接/锚点/资源/元信息、RSS、sitemap、解压后的 Pagefind 与发布集合一致 |
| `pnpm artifact:seal` / `pnpm artifact:check` | 对最终产物逐文件 SHA-256 封存、验证无篡改                                       |
| `pnpm test:e2e`                              | 对当前 dist 的真实内容与空状态做浏览器验收，不要求保留示例文章                  |
| `pnpm test:performance`                      | 固定移动端条件、每页三次 Lighthouse，报告中位数而非挑选最好一次                 |
| `pnpm audit:security`                        | 未知告警、过期例外、已有补丁及异常报告均失败                                    |

Windows/Linux 使用同一锁文件。CI 执行完整检查，最终 dist 只构建一次，完成产物与浏览器验收后上传。Cloudflare 密钥仅提供给部署步骤，PR 不部署、不生成公开云预览。

## 内容与安全边界

- `public/` 和 `src/assets/` 一律视为可公开，私有仓库和 draft 不是附件访问控制。
- 不接收不可信投稿，不支持 MDX 或原始 HTML；图片必须是本地、可信、可公开素材。
- 草稿和未来文章不会进入生产页面、RSS、标签、归档、站点地图及搜索；未来时间到达后仍需重新构建。
- 删掉全部样文不会破坏发布检查：固定技术样文保存在 `tests/fixtures/`，仅用于隔离测试，正式产物按真实内容验收。
- 没有数据库、账号、评论、统计或业务 API；不默认购买域名或开通付费功能。

## 来源与许可

原仓库的 `LICENSE` 和历史保留。AstroPaper v6.1.0 的 MIT 文本单独保存在 `LICENSES/AstroPaper-MIT.txt`。文章、照片及项目素材的授权应由作者分别标注，不能把主题的软件许可当作第三方素材的授权。
