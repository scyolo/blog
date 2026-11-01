# 写作台能力契约

## CAPABILITY

作者在博客内撰写 Markdown、即时预览、恢复本机草稿、导入导出文件，并通过自己的 GitHub 授权直接发布文章。站点继续使用 Astro 静态构建与 GitHub Pages，不需要数据库或认证中转服务器。

## IMPLEMENTATION CONTRACT

- 页面：`/blog/write/`；本地根地址开发时是 `/write/`。
- 正式来源：`scyolo/blog` 的 `codex/github-pages` 分支，`src/content/posts/*.md`，也可编辑已有子目录中的文章。
- 元数据：沿用 `postSchema`，保留 slug、标题、摘要、发布时间、修改时间、draft、分类、标签、封面、作者和 demo。单篇文件最多 240 KB。
- 写作：双栏 / 写作 / 预览三种模式，手机可切换；标准 Markdown、表格、任务列表、Callout、KaTeX、Mermaid、`==高亮==` 和按 slug 的 `[[双链|名称]]`。本地素材嵌入仍受 `src/assets` 边界限制。
- 草稿：最多 20 份，localStorage `scyolo:writer:drafts:v2`，迁移旧 `scyolo:writer:draft:v1`；新建和导入保留先前草稿。存储失败有明确提示和导出备份。
- 授权：作者自行创建仅覆盖目标仓库、Contents 读写和 Actions 只读的细粒度访问令牌。令牌只在页面内存中使用，断开或刷新后清除；只发送到 GitHub API，不经过其他服务器。
- 发布：创建文章 blob 和目录树、以刚读取的分支提交为父提交创建新提交，再以 `force:false` 推进分支。已有文章要求 SHA 相符且 slug 不变；并发提交不被覆盖。
- 状态：本机已保存 → 等待确认 → 已提交 → 构建 / 部署中 → 线上版本和文章地址均核实后已上线。任何错误不会把「已提交」改写为「已上线」。
- 下架：显式确认后提交 `draft:true`，部署完成后从网站隐藏；不删除 Git 历史。公开仓库中的草稿源文仍是公开的。
- 日期：编辑器使用 Asia/Shanghai，导出为带时区 ISO 日期；原时间不改动时保留完整精度。未来文章需要到期后重新构建，当前不提供自动定时任务。

## SECURITY AND FAILURE STATES

预览在可信公式和 Callout 渲染之前清理不可信 HTML，禁止脚本执行与远程图片。正式构建独立校验正文、资源、重复 slug 和元数据，GitHub 独立校验令牌的仓库权限。

授权无效、仓库权限不足、网络中断、限流、冲突、构建失败、跳过部署和存储失败都有单独反馈。导出包含草稿正文和文章信息，不包含访问令牌。没有绑定 SHA 的导入文件不能自动覆盖同名远端文章，必须先从仓库载入。

## NON-GOALS

- 不实现自建账号、服务器端登录会话、多人协作或自动云端草稿同步。
- 不支持完整 Obsidian Vault、任意标题自动映射、插件、Dataview、块引用图谱、MDX 或原始 HTML。
- 图片需要先放入仓库的 `src/assets`；本轮没有浏览器图片上传功能。
- 不承诺提交后立即上线，不绕过 Pages 工作流，不自动定时发布。
- 不把浏览器存储或公开 Git 草稿当作保密备份。

## VERIFICATION

测试必须覆盖 YAML 往返、时间精度、旧草稿迁移、无存储备份、XSS / 图片边界、过期 SHA、竞争提交、正确 GitHub 分支、授权不落盘、真实 Markdown 渲染、移动端预览和发布失败状态。还需通过原有内容生命周期、产物、浏览器和部署门禁。

最终记录见 [WRITER-VERIFICATION.md](WRITER-VERIFICATION.md)。
