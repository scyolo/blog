import { WriterError } from "./document";
import type { Publication } from "./github";

export const DRAFTS_KEY = "scyolo:writer:drafts:v2";
const LEGACY_KEY = "scyolo:writer:draft:v1";
const dataKeys = [
  "slug",
  "title",
  "description",
  "pubDatetime",
  "modDatetime",
  "draft",
  "category",
  "tags",
  "cover",
  "author",
  "demo",
];
export interface WriterDraft {
  id: string;
  data: Record<string, unknown>;
  body: string;
  updatedAt: string;
  remote?: { path: string; sha: string; published: boolean };
  publication?: Publication;
}

export function newDraft(
  data: Record<string, unknown> = {},
  body = ""
): WriterDraft {
  for (const key of Object.keys(data))
    if (!dataKeys.includes(key))
      throw new WriterError(`文章信息包含不支持的字段：${key}。`);
  return {
    id: crypto.randomUUID(),
    data: {
      title: "",
      slug: "",
      description: "",
      pubDatetime: new Date().toISOString(),
      category: "knowledge",
      tags: [],
      draft: true,
      author: "scyolo",
      demo: false,
      ...data,
    },
    body,
    updatedAt: new Date().toISOString(),
  };
}

/** Persist document fields only. Authentication state is deliberately not an input. */
function documentOnly(draft: WriterDraft): WriterDraft {
  const data = Object.fromEntries(
    dataKeys.filter(key => key in draft.data).map(key => [key, draft.data[key]])
  );
  const remote =
    draft.remote &&
    typeof draft.remote.path === "string" &&
    typeof draft.remote.sha === "string" &&
    /^[a-f0-9]{40}$/.test(draft.remote.sha)
      ? draft.remote
      : undefined;
  const publication =
    draft.publication &&
    typeof draft.publication.revision === "string" &&
    /^[a-f0-9]{40}$/.test(draft.publication.revision) &&
    typeof draft.publication.slug === "string" &&
    /^[a-z][a-z0-9-]*$/.test(draft.publication.slug)
      ? draft.publication
      : undefined;
  return {
    id: draft.id,
    data,
    body: draft.body,
    updatedAt: draft.updatedAt,
    ...(remote
      ? {
          remote: {
            path: remote.path,
            sha: remote.sha,
            published: remote.published,
          },
        }
      : {}),
    ...(publication
      ? {
          publication: {
            revision: publication.revision,
            path: publication.path,
            sha: publication.sha,
            slug: publication.slug,
            draft: publication.draft,
            future: publication.future,
            changed: publication.changed,
          },
        }
      : {}),
  };
}

export class DraftLibrary {
  items: WriterDraft[] = [];
  activeId = "";
  warning = "";
  #storage?: Pick<Storage, "getItem" | "setItem">;

  constructor(storage?: Pick<Storage, "getItem" | "setItem">) {
    this.#storage = storage;
    try {
      const saved = JSON.parse(storage?.getItem(DRAFTS_KEY) ?? "null");
      if (saved?.version === 2 && Array.isArray(saved.items)) {
        this.items = saved.items
          .filter(
            (item: WriterDraft) =>
              item &&
              typeof item.id === "string" &&
              typeof item.body === "string" &&
              item.data &&
              typeof item.data === "object" &&
              !Array.isArray(item.data)
          )
          .map(documentOnly);
        this.activeId = saved.activeId;
      } else {
        const legacy = JSON.parse(storage?.getItem(LEGACY_KEY) ?? "null");
        if (legacy && typeof legacy.content === "string") {
          const draft = newDraft({}, legacy.content);
          for (const key of ["title", "slug", "description", "category"])
            if (typeof legacy[key] === "string") draft.data[key] = legacy[key];
          if (typeof legacy.pubDatetime === "string")
            draft.data.pubDatetime = `${legacy.pubDatetime.slice(0, 10)}T09:00:00+08:00`;
          if (typeof legacy.tags === "string")
            draft.data.tags = legacy.tags
              .split(/[,，]/)
              .map((tag: string) => tag.trim())
              .filter(Boolean);
          this.items = [draft];
          this.warning = "已恢复上一版写作台的草稿。";
        }
      }
    } catch {
      this.warning = "无法读取本机草稿，请保留现有备份；新内容可通过导出保存。";
    }
    if (!this.items.length) this.items.push(newDraft());
    if (!this.items.some(item => item.id === this.activeId))
      this.activeId = this.items[0].id;
  }

  get active(): WriterDraft {
    return this.items.find(item => item.id === this.activeId)!;
  }

  add(draft: WriterDraft) {
    if (this.items.length >= 20)
      throw new WriterError(
        "本机已保存 20 份草稿，请先导出并删除不再需要的草稿。"
      );
    this.items.push(draft);
    this.activeId = draft.id;
  }

  removeActive() {
    this.items = this.items.filter(item => item.id !== this.activeId);
    if (!this.items.length) this.items.push(newDraft());
    this.activeId = this.items[0].id;
  }

  save() {
    try {
      if (!this.#storage) throw new Error("Storage unavailable");
      this.#storage.setItem(
        DRAFTS_KEY,
        JSON.stringify({
          version: 2,
          activeId: this.activeId,
          items: this.items.map(documentOnly),
        })
      );
    } catch {
      throw new WriterError(
        "本机存储不可用或已满，请立即导出 Markdown 保存当前内容。",
        "storage"
      );
    }
  }
}
