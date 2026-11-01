import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import rehypeCallouts from "rehype-callouts";
import rehypeStringify from "rehype-stringify";
import {
  imageRepositoryPath,
  remarkObsidian,
  type MarkdownNode,
} from "./markdown";
import { withBasePath } from "../lib/site-url";
import { rehypeTaskLabels } from "./accessibility";

export async function renderPreview(
  source: string,
  options: {
    base?: string;
    assets?: Record<string, string>;
    path?: string;
  } = {}
): Promise<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkObsidian)
    .use(() => (tree: MarkdownNode) => {
      const definitions = new Map<string, string>();
      const collect = (node: MarkdownNode) => {
        if (node.type === "definition" && node.identifier && node.url)
          definitions.set(node.identifier, node.url);
        node.children?.forEach(collect);
      };
      collect(tree);
      const visit = (node: MarkdownNode) => {
        if (node.type === "imageReference" || node.type === "linkReference") {
          node.url = definitions.get(node.identifier ?? "") ?? "";
          node.type = node.type === "imageReference" ? "image" : "link";
        }
        if (node.type === "image") {
          let url: string | undefined;
          try {
            url =
              options.assets?.[
                imageRepositoryPath(
                  node.url ?? "",
                  options.path ?? "src/content/posts/untitled.md"
                )
              ];
          } catch {
            /* Untrusted images are never fetched. */
          }
          if (url) node.url = url;
          else {
            node.type = "text";
            node.value = `[图片未加载：${node.alt || "请引用已上传的素材"}]`;
            delete node.url;
          }
        }
        if (
          node.type === "link" &&
          node.url?.startsWith("/") &&
          !node.url.startsWith("//")
        ) {
          const base = options.base ?? "/";
          if (base === "/" || !node.url.startsWith(base))
            node.url = withBasePath(node.url, base);
        }
        node.children?.forEach(visit);
      };
      visit(tree);
    })
    .use(remarkRehype)
    // Sanitize untrusted HTML before the trusted math/callout renderers run.
    .use(rehypeSanitize, {
      ...defaultSchema,
      tagNames: [...(defaultSchema.tagNames ?? []), "mark"],
      attributes: {
        ...defaultSchema.attributes,
        code: [["className", /^language-./, "math-inline", "math-display"]],
      },
    })
    .use(rehypeKatex, { trust: false, strict: "ignore" })
    .use(rehypeCallouts)
    .use(rehypeTaskLabels)
    .use(rehypeStringify);
  return String(await processor.process(source));
}
