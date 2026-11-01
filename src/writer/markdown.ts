import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { localImageSchema } from "../lib/content-schema.ts";
import { withBasePath } from "../lib/site-url.ts";
import { WriterError } from "./document.ts";

export interface MarkdownNode {
  type: string;
  value?: string;
  url?: string;
  identifier?: string;
  alt?: string | null;
  data?: { hName?: string };
  children?: MarkdownNode[];
}

/** Transform text nodes only, so fenced code, inline code and existing links stay literal. */
export function remarkObsidian(options: { base?: string } = {}) {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if (
        !node.children ||
        ["link", "image", "code", "inlineCode", "html"].includes(node.type)
      )
        return;
      node.children = node.children.flatMap(child => {
        if (child.type !== "text") {
          visit(child);
          return [child];
        }
        const value = child.value ?? "";
        const output: MarkdownNode[] = [];
        let last = 0;
        for (const match of value.matchAll(
          /(!?\[\[([^\]\n]+)\]\]|==([^=\n]+)==)/g
        )) {
          const index = match.index!;
          output.push({ type: "text", value: value.slice(last, index) });
          const [target, label] = (match[2] ?? "").split("|");
          if (match[3]) {
            output.push({
              type: "emphasis",
              data: { hName: "mark" },
              children: [{ type: "text", value: match[3] }],
            });
          } else if (
            match[0].startsWith("!") &&
            localImageSchema.safeParse(target).success
          ) {
            output.push({
              type: "image",
              url: target,
              alt: label || target.split("/").at(-1),
            });
          } else if (
            !match[0].startsWith("!") &&
            /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(target)
          ) {
            output.push({
              type: "link",
              url: withBasePath(`/posts/${target}/`, options.base ?? "/"),
              children: [{ type: "text", value: label || target }],
            });
          } else output.push({ type: "text", value: match[0] });
          last = index + match[0].length;
        }
        output.push({ type: "text", value: value.slice(last) });
        return output;
      });
    };
    visit(tree);
  };
}

export function imageRepositoryPath(reference: string, source: string): string {
  if (!localImageSchema.safeParse(reference).success)
    throw new WriterError("图片必须使用仓库内的相对路径，不能加载远程图片。");
  const path = new URL(
    reference,
    `https://repository.invalid/${source}`
  ).pathname.slice(1);
  if (!path.startsWith("src/assets/"))
    throw new WriterError("图片只能引用 src/assets 目录中的公开素材。");
  return path;
}

export function inspectMarkdown(body: string): {
  images: string[];
  links: string[];
} {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(body) as MarkdownNode;
  remarkObsidian()(tree);
  const nodes: MarkdownNode[] = [];
  const visit = (node: MarkdownNode) => {
    nodes.push(node);
    node.children?.forEach(visit);
  };
  visit(tree);
  const definitions = new Map(
    nodes
      .filter(node => node.type === "definition")
      .map(node => [node.identifier, node.url])
  );
  const images: string[] = [];
  const links: string[] = [];
  for (const node of nodes) {
    if (node.type === "html")
      throw new WriterError(
        "正文不支持原始 HTML，请使用 Markdown 或放入代码块。"
      );
    if (node.type === "image") images.push(node.url ?? "");
    if (node.type === "imageReference")
      images.push(definitions.get(node.identifier) ?? "");
    if (["link", "linkReference", "definition"].includes(node.type)) {
      const value = node.url ?? definitions.get(node.identifier) ?? "";
      const url = new URL(value, "https://repository.invalid/");
      if (
        !["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new WriterError("链接只允许网页、邮件、电话或站内路径。");
      links.push(value);
    }
  }
  return { images, links };
}
