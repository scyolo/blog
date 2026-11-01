import { parseDocument, stringify } from "yaml";
import { postSchema } from "../lib/content-schema.ts";

export const MAX_DOCUMENT_BYTES = 240_000;
export const encoder = new TextEncoder();

export class WriterError extends Error {
  code: string;
  constructor(message: string, code = "validation") {
    super(message);
    this.name = "WriterError";
    this.code = code;
  }
}

export interface ArticleData {
  slug: string;
  title: string;
  description: string;
  pubDatetime: string;
  modDatetime?: string;
  draft: boolean;
  category: "knowledge" | "essay";
  tags: string[];
  cover?: string;
  author: string;
  demo: boolean;
}
export interface Article {
  data: ArticleData;
  body: string;
}

export function parseMarkdownFile(source: string): {
  data: Record<string, unknown>;
  body: string;
} {
  if (encoder.encode(source).length > MAX_DOCUMENT_BYTES)
    throw new WriterError("文章不能超过 240 KB，请拆分为多篇文章。");
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) return { data: {}, body: normalized };
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);
  if (!match) throw new WriterError("文章信息缺少结束的 --- 分隔线。");
  try {
    const document = parseDocument(match[1], { uniqueKeys: true });
    if (document.errors.length) throw new Error("Invalid YAML");
    const data = document.toJS({ maxAliasCount: 30 });
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("Expected an object");
    return { data, body: normalized.slice(match[0].length) };
  } catch {
    throw new WriterError(
      "文章信息不是有效的 YAML，请检查缩进、引号和重复字段。"
    );
  }
}

export function validateArticle(data: unknown, body: string): Article {
  const result = postSchema.safeParse(data);
  if (!result.success)
    throw new WriterError(
      result.error.issues
        .map(issue => `${issue.path.join(".")}: ${issue.message}`)
        .join("；")
    );
  const parsed = result.data;
  const { pubDatetime, modDatetime, ...rest } = parsed;
  if (!body.trim()) throw new WriterError("请先写下文章正文。");
  if (
    parsed.title.length > 180 ||
    parsed.description.length > 500 ||
    parsed.slug.length > 100 ||
    parsed.tags.length > 24 ||
    parsed.tags.some(tag => tag.length > 40)
  )
    throw new WriterError(
      "标题最多 180 字，摘要 500 字，路径 100 字；标签最多 24 个，每个 40 字。"
    );
  if (encoder.encode(body).length > MAX_DOCUMENT_BYTES)
    throw new WriterError("文章不能超过 240 KB，请拆分为多篇文章。");
  return {
    data: {
      ...rest,
      pubDatetime: pubDatetime.toISOString(),
      ...(modDatetime ? { modDatetime: modDatetime.toISOString() } : {}),
    },
    body: body.replace(/\r\n?/g, "\n").trim() + "\n",
  };
}

export function serializeArticle(article: Article): string {
  const valid = validateArticle(article.data, article.body);
  const source = `---\n${stringify(valid.data, { lineWidth: 0 })}---\n\n${valid.body}`;
  if (encoder.encode(source).length > MAX_DOCUMENT_BYTES)
    throw new WriterError("正文与文章信息合计不能超过 240 KB。");
  return source;
}

/** The editor explicitly uses Asia/Shanghai; the machine timezone is irrelevant. */
export function toEditorTime(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 16);
}

export function fromEditorTime(value: string): string {
  return `${value}:00+08:00`;
}
