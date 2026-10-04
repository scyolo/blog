import { beforeAll, expect, it } from "vitest";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import config from "../astro.config";
let renderer: Awaited<ReturnType<typeof createMarkdownProcessor>>;
beforeAll(async () => {
  const options = (
    config.markdown!.processor as {
      options: NonNullable<Parameters<typeof createMarkdownProcessor>[0]>;
    }
  ).options;
  renderer = await createMarkdownProcessor({
    ...options,
    syntaxHighlight: false,
  });
});
const render = (body: string) =>
  renderer.render(body, {
    fileURL: new URL(
      "../src/content/posts/technical-writing.md",
      import.meta.url
    ),
  });
const fence = String.fromCharCode(96).repeat(3);
it("在构建期渲染行内和独立公式", async () => {
  const html = (await render("行内 $E=mc^2$\n\n$$\n\\sum_{i=1}^{n} x_i\n$$"))
    .code;
  expect(html).toContain('class="katex"');
  expect(html).toContain("katex-display");
});
it("Mermaid 输出延迟渲染结构和源码入口", async () => {
  const html = (
    await render(
      [fence + "mermaid", "flowchart LR", "A[写作] --> B[阅读]", fence].join(
        "\n"
      )
    )
  ).code;
  expect(html).toContain("data-mermaid");
  expect(html).toContain("写作");
  expect(html).toContain("查看图表源码");
});
it("图表源码中的 HTML 不会成为可执行标签", async () => {
  const html = (
    await render(
      [
        fence + "mermaid",
        "flowchart LR",
        'A["</pre><script>alert(1)</script>"]',
        fence,
      ].join("\n")
    )
  ).code;
  expect(html).not.toContain("<script>");
  expect(html).toMatch(/(?:&lt;|&#x3[cC];|&#60;)script/);
});
it("每次渲染都拒绝原始 HTML 和远程图片", async () => {
  await expect(render("<script>alert(1)</script>")).rejects.toThrow(/HTML/);
  await expect(render("![图](https://example.com/remote.png)")).rejects.toThrow(
    /图片|本地/
  );
});
