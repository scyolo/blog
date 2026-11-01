import { expect, it } from "vitest";
import { renderPreview } from "../src/writer/preview";
import { inspectMarkdown, imageRepositoryPath } from "../src/writer/markdown";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import config from "../astro.config";

it("引用式图片也安全解析，站内链接只添加一次部署前缀", async () => {
  const html = await renderPreview(
    "![本地][image]\n\n[文章][post] [已有前缀](/blog/about/) [根路径](/tags/)\n\n[image]: ../../assets/images/quiet-page.svg\n[post]: /posts/existing-post/",
    {
      base: "/blog/",
      assets: { "src/assets/images/quiet-page.svg": "/blog/_astro/image.svg" },
      path: "src/content/posts/a.md",
    }
  );
  expect(html).toContain('src="/blog/_astro/image.svg"');
  expect(html).toContain('href="/blog/posts/existing-post/"');
  expect(html).toContain('href="/blog/about/"');
  expect(html).toContain('href="/blog/tags/"');
  const absent = await renderPreview(
    "![](../../assets/missing.png)\n\n[根路径](/tags/)",
    { assets: {} }
  );
  expect(absent).not.toContain("<img");
  expect(absent).toContain('href="/tags/"');
});

it("真实 Markdown 预览支持表格、任务列表、Callout、公式和高亮", async () => {
  const html = await renderPreview(
    "# 标题\n\n| 列 | 值 |\n|---|---|\n| 内容 | 1 |\n\n- [x] 完成\n\n> [!NOTE] 提示\n> 正文\n\n$E=mc^2$ 与 ==重点=="
  );
  for (const part of [
    "<table>",
    'type="checkbox"',
    "callout",
    'class="katex"',
    "<mark>重点</mark>",
  ])
    expect(html).toContain(part);
});
it("双链保留 Pages 子路径，代码中的 Markdown 和双链保持原文", async () => {
  const html = await renderPreview(
    "[[existing-post|上一篇]]\n\n`[[code-link]] ==literal==`\n\n```text\n[[literal-post]]\n```",
    { base: "/blog/" }
  );
  expect(html).toContain('href="/blog/posts/existing-post/"');
  expect(html).not.toContain("/blog/blog/");
  expect(html).toContain("[[code-link]] ==literal==");
  expect(html).toContain("[[literal-post]]");
});
it("预览阻止 HTML、脚本协议和远程图片，不破坏普通转义文本", async () => {
  const html = await renderPreview(
    '<img src=x onerror="alert(1)">\n\n<script>alert(1)</script>\n\n[坏链接](javascript:alert)\n\n![远程](https://untrusted.invalid/image.png)\n\n`<script>`'
  );
  expect(html).not.toMatch(/<script|<img|onerror=|href="javascript:/);
  expect(html).not.toContain('src="https://');
  expect(html).toMatch(/(?:&lt;|&#x3C;)script/);
});
it("只加载已知公开素材；未知 Obsidian 双链保留文字", async () => {
  const html = await renderPreview(
    "![[../../assets/images/quiet-page.svg|本地]]\n\n[[尚未映射的标题]]",
    { assets: { "src/assets/images/quiet-page.svg": "/blog/_astro/image.svg" } }
  );
  expect(html).toContain('src="/blog/_astro/image.svg"');
  expect(html).toContain("[[尚未映射的标题]]");
  expect(
    imageRepositoryPath(
      "../../assets/images/quiet-page.svg",
      "src/content/posts/a.md"
    )
  ).toBe("src/assets/images/quiet-page.svg");
  expect(() =>
    imageRepositoryPath("../../../secret.svg", "src/content/posts/a.md")
  ).toThrow();
});
it("发布检查识别引用式图片和链接，代码中的 HTML 不会被误拒绝", () => {
  const result = inspectMarkdown(
    "![图片][image]\n\n[文章][post]\n\n[image]: ../../assets/images/quiet-page.svg\n[post]: /posts/existing-post/\n\n```html\n<script></script>\n```"
  );
  expect(result.images).toContain("../../assets/images/quiet-page.svg");
  expect(result.links).toContain("/posts/existing-post/");
  expect(() =>
    inspectMarkdown("[x](https://user:password@example.com/)")
  ).toThrow();
});
it("Obsidian 语法在真正的文章构建中生效，嵌入也遵守素材边界", async () => {
  const options = (
    config.markdown!.processor as {
      options: NonNullable<Parameters<typeof createMarkdownProcessor>[0]>;
    }
  ).options;
  const renderer = await createMarkdownProcessor({
    ...options,
    syntaxHighlight: false,
  });
  const fileURL = new URL(
    "../src/content/posts/technical-writing.md",
    import.meta.url
  );
  const result = await renderer.render(
    "==高亮==\n\n[[leave-some-space|文章]]\n\n> [!NOTE] 说明\n> 内容",
    { fileURL }
  );
  expect(result.code).toContain("<mark>高亮</mark>");
  expect(result.code).toContain("posts/leave-some-space/");
  expect(result.code).toContain("callout");
  await expect(
    renderer.render("![[../../../secret.svg]]", { fileURL })
  ).rejects.toThrow(/图片|资源/);
});
