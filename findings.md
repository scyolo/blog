# 事实与决策记录

## 2026-10-03：执行启动
- 本地目录初始为空；目标仓库原有 README.md 和 MIT LICENSE。
- 已克隆并保留原始提交 88bf4a5，许可证作者为 JulSovew。
- Git OpenSSL 连接曾失败；单次使用 Schannel + HTTP/1.1 克隆成功，未关闭证书校验。
- GitHub API 已确认仓库改为 private，默认 main，当前凭据具备 push 权限。
- 本机 Node 22.18.0、pnpm 10.6.2、Git 2.53.0；依赖与主题版本以实际获取结果为准，不盲信前轮信息。
- 尚未验证 Cloudflare 凭据与生产站点，不把 GitHub 权限当作部署权限。

- 实际已获取 AstroPaper v6.1.0，提交 4c33a60529f9c443145a89fe526ff231c009272d；引擎要求 Node >=22.12.0，依赖 Astro ^6.4.2。
- 已仅导入必要工程文件；未复制上游 GitHub 工作流、Docker、编辑器配置或历史宣传文件，保留独立许可证。
- GitHub 仓库当前没有配置 Actions secrets，环境未发现 Cloudflare 凭据；生产部署尚待验证。

## 基线实际验证
- 原始 pnpm install --frozen-lockfile 成功；pnpm 10.6.2 不识别新版 allowBuilds 配置，提示 esbuild/sharp 构建脚本被忽略。
- 原始 pnpm build：55 文件类型检查零错误，随后因远程 Google 字体下载失败终止。此为真实构建失败，不是推测。
- 原始 pnpm audit 报告 critical=1/high=35/moderate=18/low=4（审计计数，非实际受攻击证明）；Astro 安全公告要求至少 7.2.8，不能按旧 6.x 锁文件直接交付。
- 将保留 AstroPaper 来源与组件基础，升级到已核实的 Astro 7.3.5，移除首版不用的 MDX/动态 OG/远程字体链；升级后重新构建与审计，不盲信升级结果。
- 实际永久链接工具依赖 filePath，发布过滤允许提前 15 分钟且不提供草稿本地预览，需要回归测试保护后修改。

- 上游 getPostPaths 仍从 filePath 推导前缀：后续必须用测试保证移动 Markdown 文件不改变 URL。
- RSS 上游用修改时间代替发布时间，后续应分离发布时间与更新显示，避免修改旧文导致订阅重排。
- 基础静态构建已成功，但尚未完成中文与图表组合、发布状态模型、UI 和云端部署验收。

## 二次安全复核
- 更新到 lint 插件 3.2.1 并在原 semver 范围内刷新传递依赖后，剩余仅一个 high：GHSA-ch52-4w7c-c8xp，http-cache-semantics <=4.2.0，目前公告未提供修复版本。其跨用户缓存攻击要求共享认证缓存和可控 max-stale 请求。
- 实际依赖位置：Astro dist/assets/build/remote.js，仅远程图片构建缓存；此模块构造自己的 Request，使用 storable/timeToLive，无转发访客会话或 max-stale，静态产物不运行 Node/认证代理。本项目还禁止远程图片优化源。
- 不伪造 npm audit 零漏洞。将加入精确公告+版本+路径+期限的审查例外，报告必须保留该未修复告警；新增告警、到期或路径变更阻止通过。
