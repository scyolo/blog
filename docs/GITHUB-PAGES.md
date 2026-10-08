# GitHub Pages 专用部署分支

## 分支与内容

- 分支：`codex/github-pages`。
- 起点：`main` 的 `e681f0bc521f40b9e99764a60a7ea2eb9ebcef34`。
- 直接从该提交建立分支，保留完整文件和提交历史；不是空白分支，也不需要再复制一套目录。
- 原有文章、项目、关于页、图片和模板保持不变。只在新分支增加部署流程及子路径兼容修改。
- `main` 的提交及其 Cloudflare 工作流不变。不要为了部署 Pages 把本分支合并回 `main`。

预期地址为 **https://scyolo.github.io/blog/**；这是部署目标，不代表已上线。

## 当前账户限制

2026-10-08，通过已登录的仓库管理员账户实际调用 Pages 创建接口，GitHub 返回 HTTP 422：

> Your current plan does not support GitHub Pages for this repository.

当时账户为 Free，仓库 `scyolo/blog` 为 private。分支代码和部署配置可以保留在私有仓库中，但当前组合无法正式启用 GitHub Pages。此任务没有修改仓库可见性、开通付费计划或改动默认分支。

继续上线前，由仓库所有者决定：把仓库改为公开，或使用支持私有仓库 Pages 的计划。**公开前应检查整个 Git 历史，而不只是当前文件，避免暴露历史密钥、草稿和私密材料。** 不要把私有源码仓库等同于私有网站；普通 Pages 站点是公开可访问的。

## 一次性设置

满足上述账户条件后：

1. 打开仓库 **Settings → Pages**，把 **Build and deployment → Source** 设置为 **GitHub Actions**，不是从分支直接发布源码。
2. 在 **Settings → Environments → github-pages** 检查发布分支限制。若有限制，只允许 `codex/github-pages`；不要保留只允许 `main` 的规则。
3. 默认项目地址不需要设置 Secret，也不需要 Cloudflare 配置。工作流自行使用 `GITHUB_TOKEN`，仅部署 job 获得 `pages: write` 和 `id-token: write`。
4. 如已在 Pages 设置中绑定自定义域名，在 **Settings → Secrets and variables → Actions → Variables** 设置 `GITHUB_PAGES_SITE_URL` 为实际完整 HTTPS 地址，例如 `https://notes.example.com/`。不要复用原 Cloudflare 的 `SITE_URL` 仓库变量。
5. 推送这个专用分支。首次推送命令：

   ```sh
   git switch codex/github-pages
   git push -u origin codex/github-pages
   ```

6. 查看 Actions 中的 **Verify and deploy GitHub Pages**。需要 **verify**、**deploy** 以及线上冒烟检查都成功，才能认定上线。

工作流仅由推送到本分支或针对本分支的 PR 触发；PR 只验证、不发布。由于本分支不是默认分支，不依赖默认分支上的手动运行入口。启用 Pages 后，可重跑本分支最新提交对应的 Actions；若该运行已过期，则推送一个新提交触发完整构建。

## 流水线

```text
专用分支 push
→ 冻结锁文件安装
→ 格式 / lint / 内容检查 / 基础测试 / 覆盖率 / 安全审计
→ 隔离的根路径内容生命周期和样文浏览器测试
→ 使用 Pages 完整网址构建最终 dist 一次
→ 页面、链接、锚点、资源、RSS、sitemap 和 Pagefind 产物校验
→ SHA-256 封存
→ /blog/ 真实浏览器测试与移动端性能检查
→ SHA-256 复验并上传 dist
→ 串行部署 job 检查专用分支最新提交
→ 读取 Pages 配置并核对实际站点网址
→ 发布同一次运行上传的产物，不重新构建
→ 线上提交号、首页、RSS、搜索资源和 HTTP 404 冒烟
```

所有外部 Actions 固定为完整提交 SHA。旧提交不会覆盖最新分支的部署；在途部署不会被新工作流取消。部署前若 Pages 未启用、网址与构建不一致或上游检查失败，发布不能通过。失败诊断和 Pages 产物保留七天。

## 本地复现项目子路径

先按 `.node-version` 和 `package.json` 选择 Node 22.23.3、pnpm 10.34.6。PowerShell：

```powershell
$env:SITE_URL = "https://scyolo.github.io/blog/"
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm verify:artifact
pnpm artifact:seal
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:performance
pnpm artifact:check
pnpm preview
```

预览路径为 `/blog/`，不是站点根目录。不要在构建后手工改 `dist` 中的链接；必须重新构建，以保证页面、RSS、sitemap、搜索及封存结果一致。浏览器和性能测试会读取 `dist/build-info.json`，用与该产物一致的基础路径启动预览。

完整内容生命周期测试使用隔离的根地址，在单独终端运行：

```powershell
$env:SITE_URL = "https://example.invalid/"
pnpm test:build-contract
```

返回无子路径的本地开发模式时，先清除该环境变量，然后重新构建：

```powershell
Remove-Item Env:SITE_URL -ErrorAction SilentlyContinue
pnpm dev
```

## 路径与平台差异

- `SITE_URL` 支持完整项目地址；Astro 的 `base` 由该网址的路径推导，根路径部署仍受支持。
- 导航、分页、文章链接、Markdown 站内链接、图标、分享图、RSS 和站点地图必须保留项目路径。
- Pagefind 索引中的文章路径相对于 `dist`；浏览器通过 `baseUrl` 和 `bundlePath` 添加部署前缀，避免搜索结果和索引请求落到错误的站点根目录。
- `public/_headers` 是保留的 Cloudflare 配置，GitHub Pages 不应用该文件中的自定义响应头。不要把 Cloudflare 的头部策略当作 Pages 已验证的行为。
- 普通静态 404 由生成的 `404.html` 提供；不做 SPA 全部回退到首页。
- `pnpm deploy` 仍是原 Cloudflare 专用命令，且只允许 `main` 的根域名发布；**GitHub Pages 通过专用 Actions 发布，不运行此命令**。

## 后续更新和回滚

直接在 `codex/github-pages` 修改内容并推送，或者在此分支有选择地合并 `main` 的内容更新。发生冲突时保留 Pages 工作流和子路径适配，不把修改反向合并到 `main`。

回滚使用 `git revert` 产生新的专用分支提交，再推送触发完整验证。不要强推旧提交或只重跑已不是分支头的旧产物；工作流会拒绝过时版本。

## 本次本地验证（2026-10-08）

部署代码验证基于 `4d687ced04036a0d966a934b3b2f89862c23f57e`，后续仅补充本文等部署说明；没有修改已封存产物来凑验收结果。

| 检查                 | 结果                                                                               |
| -------------------- | ---------------------------------------------------------------------------------- |
| 冻结锁文件安装       | 使用指定 Node / pnpm，离线安装通过；锁文件未改                                     |
| 格式、lint、内容校验 | 全部通过；原有 3 篇文章、1 个项目保留                                              |
| 基础测试             | 6 项通过                                                                           |
| 单元与覆盖率         | 134 项通过；总行覆盖率 96.54%，逐文件门槛通过                                      |
| 隔离内容生命周期     | 9 项通过，含 20 项技术阅读浏览器测试                                               |
| Pages 路径生产构建   | 通过；19 个 HTML 页面、3 篇发布文章、3 篇搜索索引                                  |
| Pages 路径真实浏览器 | 6 项通过，含搜索结果实际跳转和 360 / 768 / 1440px 检查                             |
| 产物封存与复验       | SHA-256 复验通过，浏览器和性能检查未改动产物                                       |
| 移动端 Lighthouse    | 首页和两篇文章各测 3 次；性能、无障碍、SEO 中位数均为 100，CLS 为 0                |
| 安全审计             | 无未复核告警；保留原有 1 项未修补的受控例外，详见 `docs/SECURITY.md`，不等于零告警 |
| 现有内容与主分支     | `src/content`、`src/assets`、`public`、`templates` 与原 `main` 完全相同            |
| GitHub Pages 上线    | **未通过账户前置条件**；创建接口返回 422，不能声称已部署或已完成线上验收           |

以上成绩来自本地环境，不冒充 GitHub 托管运行器或线上站点结果。账户条件满足后仍须查看实际 Actions 执行结果及线上冒烟。

## 官方参考

- [Astro：Deploy to GitHub Pages](https://docs.astro.build/en/guides/deploy/github/)
- [GitHub：Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub：What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Pagefind：Configuring search in the browser](https://pagefind.app/docs/search-config/)
