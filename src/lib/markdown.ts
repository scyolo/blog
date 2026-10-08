import { relative } from "node:path";
import { validateMarkdownResources } from "./content-files";
import { escapeHtml } from "./serialization";
import { withBasePath } from "./site-url";
type AstNode = {
  type: string;
  value?: string;
  url?: string;
  lang?: string | null;
  children?: AstNode[];
};
export function remarkBlog({ base = "/" }: { base?: string } = {}) {
  return async (tree: AstNode, file: { path?: string; value: unknown }) => {
    const source = file.path
      ? relative(process.cwd(), file.path)
      : "src/content/posts/untitled.md";
    await validateMarkdownResources(String(file.value), source);
    const transform = (parent: AstNode) => {
      if (!parent.children) return;
      parent.children = parent.children.map(node => {
        if (
          ["link", "definition"].includes(node.type) &&
          node.url?.startsWith("/")
        ) {
          node.url = withBasePath(node.url, base);
        }
        if (node.type === "code" && node.lang === "mermaid") {
          return {
            type: "html",
            value:
              '<figure class="diagram" data-mermaid><div class="diagram-output" data-mermaid-output role="region" tabindex="0" aria-label="图表，可横向滚动"></div><p class="diagram-status" data-mermaid-status role="status" data-pagefind-ignore>图表将在接近阅读位置时加载。</p><details data-pagefind-ignore><summary>查看图表源码</summary><pre data-mermaid-source><code>' +
              escapeHtml(node.value ?? "") +
              "</code></pre></details><noscript>启用 JavaScript 可查看图表，也可以直接阅读上方源码。</noscript></figure>",
          };
        }
        transform(node);
        return node;
      });
    };
    transform(tree);
  };
}
