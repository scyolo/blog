# 实施与验证日志

## 2026-10-03

- 完成本地与远程现状检查；未发现本地 AGENTS.md。
- 保留远程历史克隆仓库，确认原 MIT 许可。
- 按用户条件授权将仓库改为私有，API 回读验证成功。
- 创建执行计划、事实记录与日志；下一步获取并验证主题基线。

### 基线检查（RED）

- pnpm install --frozen-lockfile：通过，存在原生构建脚本配置兼容提示。
- pnpm build：类型检查通过，远程字体下载失败；尚未到达 Windows cp 步骤。
- pnpm audit：存在未处置安全告警，基线不得发布。

- RED 测试 5/5 均按预期失败，检查点 a15d104（继承 88bf4a5）。
- 提交身份仅在本仓库配置，使用已认证 GitHub 账号的 noreply 邮箱；没有改全局 Git 配置。
- 开始基础修复：取消远程字体、MDX 与动态 OG，使用跨平台 Node 构建器，清理路径经过边界和符号链接检查。

- 本地隔离工具链安装 Node 22.23.3 于 .cache/toolchain（不修改系统 Node），项目固定 pnpm 10.34.6。后续命令需将 .cache/toolchain/node_modules/node/bin 放到当前进程 PATH 最前。
- 缓存、上游镜像和测试产物从格式、类型和 lint 扫描中排除，避免重复检查非项目代码；不排除实际源码。

### 基础修复（GREEN，非最终交付）

- 首次安装更新因 npm TLS 连接重置失败；同一官方 registry 降低并发到 4、有限重试后完成。未关闭证书验证或更换不可信源。
- node --test tests/foundation.node.mjs：原 5 个失败用例全部通过。
- pnpm build：54 文件类型检查零错误/警告/提示，静态构建与 Pagefind Extended 索引成功；当前仍为主题示例数据，不是最终网站。
- pnpm lint：通过。
- pnpm audit：critical 从 1 降为 0，仍有 high=23/moderate=8/low=2，下一步处理残留锁文件、lint 编译链和无上游补丁的告警，不能宣称安全验收完成。

- 下一阶段发布策略与永久链接回归用例已写入 tests/publication.test.ts；尚未执行，不能算 RED 或通过。需安装测试依赖后先确认针对上游行为的实际失败，再修改生产逻辑。

### 发布策略与审计门禁（RED）

- 审计门禁 6 个用例已执行，均因预期的新实现模块尚不存在而失败；不是缺少 npm 依赖。
- Vitest 已真实运行上游发布/路由函数：7 个用例中 5 失败、2 通过，复现漏填 draft 会发布、提前公开、开发不可预览草稿、路径绑定目录、旧文修改导致排序上浮。
- 进一步收紧用例：直接比较移动前后 URL，零提前窗口下测试时间边界；下次运行记录更新结果。

### 发布辅助逻辑与审计门禁（GREEN）

- 加强后发布回归：7 例中 6 RED / 1 PASS；检查点 34077fd。
- 修复后 pnpm test：Node 11/11、Vitest 7/7，共 18 个测试通过。
- pnpm test:coverage：当前报告仅列发布过滤与排序，语句 92.3%、分支 80%、函数/行 100%；永久链接文件未列出，需检查 vi.resetModules 对覆盖率归集的影响，不能作为全工程覆盖率。
- pnpm build：62 文件类型检查零错误/警告/提示，静态与 Pagefind 构建成功。pnpm lint 与 pnpm format:check 通过。
- pnpm audit:security：0 未审查，1 已限定审查但未修复；公告、路径、版本和到期条件详见 docs/SECURITY.md，原始 pnpm audit 并非零告警。
- 尚未实施严格 frontmatter 校验/显式 slug 加载器、中文样文、项目集合、最终界面或云端发布；不要因 helper 通过就宣布完整内容安全已完成。

### 验证工具自检与加固

- RED 检查点 21d286c：格式范围回归 1 失败；审计边界 4 失败，真实命中漏检查和不完整报告问题。
- 修复 .prettierignore 的根目录全忽略白名单，改为仅排除依赖/产物/许可证；新增脚本、测试、配置与文档现在实际参与检查。
- 安全测试统一到 Vitest；审计计数与明细必须一致，公告出现补丁/严重级别变化不再沿用例外，到期时间显式 +08:00。
- pnpm test：基础 6/6 + 业务 19/19，共 25 个用例通过。
- pnpm test:coverage：原始 JSON 已确认包含 security-audit/getPostPaths/getSortedPosts/postFilter 四个实现模块；语句 97.72%、分支 96.49%、函数/行 100%，每文件阈值 >=80%。这不是整个尚未实现网站的覆盖率。
- pnpm check：62 文件零错误/警告/提示。pnpm lint 与真正覆盖新文件的 pnpm format:check 通过。
- pnpm audit:security：仍为 0 未审查、1 已审查但未修复。
- pnpm install --frozen-lockfile --offline 已通过；最终再构建结果见 .cache/verified-build.log（需回读确认完成）。

- 最终构建回读确认：21:19 静态构建成功，28 个主题样文页面、Pagefind Extended 索引 7 篇英文样文；只是工程验证，不是最终内容。

## 继续实施：内容与技术写作
- 复核工作区 b17c841，上一轮为实际进展，未重复基础排错。
- 安装 YAML/KaTeX/Mermaid 等已核实版本。新增内容模型用例产生预期编译期 RED：所需新模块尚不存在；不将其称作运行期断言失败。

- 文件级校验：28 个内容模型/文件测试通过，67 文件类型检查零错误。
- 完整构建测试采用独立冻结锁文件离线安装后，控制组和移动文件正例通过；缺失 draft 与完全相同内容的重复 slug 仍让旧构建成功，两个负例真实 RED（不是超时）。接下来将校验接入 Astro 生命周期。
