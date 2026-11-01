import { describe, expect, it } from "vitest";
import {
  parseMarkdownFile,
  serializeArticle,
  validateArticle,
  toEditorTime,
  fromEditorTime,
} from "../src/writer/document";
import { DraftLibrary, DRAFTS_KEY, newDraft } from "../src/writer/drafts";
import { sampleArticle } from "./helpers/writer-github";

describe("Markdown 导入与导出", () => {
  it("保留 YAML 多行摘要、标签数组、时间精度及所有可选字段", () => {
    const source =
      "\uFEFF---\r\nslug: yaml-post\r\ntitle: '包含: 冒号和引号'\r\ndescription: |\r\n  第一行\r\n  第二行\r\ncategory: essay\r\npubDatetime: 2020-01-01T08:00:00.123+08:00\r\nmodDatetime: 2021-01-01T08:00:00+08:00\r\ndraft: true\r\ndemo: true\r\nauthor: another-author\r\ncover: ../../assets/images/quiet-page.svg\r\ntags:\r\n  - 中文标签\r\n  - '逗号, 标签'\r\n---\r\n\r\n正文\r\n";
    const parsed = parseMarkdownFile(source);
    const article = validateArticle(parsed.data, parsed.body);
    const restored = parseMarkdownFile(serializeArticle(article));
    expect(restored.data).toMatchObject({
      title: "包含: 冒号和引号",
      tags: ["中文标签", "逗号, 标签"],
      pubDatetime: "2020-01-01T00:00:00.123Z",
      author: "another-author",
      demo: true,
      cover: "../../assets/images/quiet-page.svg",
      modDatetime: "2021-01-01T00:00:00.000Z",
    });
    expect(restored.data.description).toBe("第一行\n第二行");
    expect(restored.body.trim()).toBe("正文");
  });
  it("普通 Markdown 正文不会继承上一份文章的元数据", () =>
    expect(parseMarkdownFile("# 笔记\n\n内容")).toEqual({
      data: {},
      body: "# 笔记\n\n内容",
    }));
  it.each([
    "---\ntitle: A\n",
    "---\ntitle: A\ntitle: B\n---\n正文",
    "---\n- one\n- two\n---\n正文",
  ])("拒绝损坏或歧义 frontmatter: %s", source =>
    expect(() => parseMarkdownFile(source)).toThrow()
  );
  it("发布时拒绝非法路径、无时区日期、未知字段和空正文", () => {
    for (const data of [
      { slug: "../other" },
      { pubDatetime: "2026-11-01" },
      { token: "must-not-persist" },
    ])
      expect(() =>
        validateArticle({ ...sampleArticle.data, ...data }, "正文")
      ).toThrow();
    expect(() => validateArticle(sampleArticle.data, " ")).toThrow();
    expect(() => parseMarkdownFile("中".repeat(90_000))).toThrow(/240/);
    expect(() =>
      validateArticle({ ...sampleArticle.data, title: "A".repeat(181) }, "正文")
    ).toThrow();
  });
  it("北京时间换算不取决于浏览器或 CI 的本地时区", () => {
    expect(toEditorTime("2026-11-01T00:15:00Z")).toBe("2026-11-01T08:15");
    expect(new Date(fromEditorTime("2026-11-01T08:15")).toISOString()).toBe(
      "2026-11-01T00:15:00.000Z"
    );
    expect(toEditorTime("invalid")).toBe("");
  });
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
describe("本机草稿", () => {
  it("恢复已连接文章的版本和待部署记录，不恢复混入的会话字段", () => {
    const storage = memoryStorage();
    const library = new DraftLibrary(storage);
    library.active.remote = {
      path: "src/content/posts/a.md",
      sha: "a".repeat(40),
      published: true,
    };
    library.active.publication = {
      path: "src/content/posts/a.md",
      sha: "a".repeat(40),
      revision: "b".repeat(40),
      slug: "a",
      draft: false,
      future: false,
      changed: true,
    };
    library.save();
    const restored = new DraftLibrary(storage);
    expect(restored.active.remote).toEqual(library.active.remote);
    expect(restored.active.publication).toEqual(library.active.publication);
    storage.setItem(
      DRAFTS_KEY,
      JSON.stringify({
        version: 2,
        activeId: "missing",
        items: [
          {
            id: "broken",
            data: {},
            body: "正文",
            remote: { path: "a", sha: "bad" },
            publication: { revision: "bad", slug: "../invalid" },
          },
        ],
      })
    );
    const corrupt = new DraftLibrary(storage);
    expect(corrupt.active.body).toBe("正文");
    expect(corrupt.active.remote).toBeUndefined();
    expect(corrupt.active.publication).toBeUndefined();
  });
  it("迁移旧版本的正文、标签和日期，并保留多份草稿", () => {
    const storage = memoryStorage();
    storage.setItem(
      "scyolo:writer:draft:v1",
      JSON.stringify({
        title: "旧草稿",
        slug: "old",
        content: "不能丢失的正文",
        tags: "中文, Markdown",
        pubDatetime: "2026-10-31",
      })
    );
    const library = new DraftLibrary(storage);
    expect(library.active.body).toBe("不能丢失的正文");
    expect(library.active.data.tags).toEqual(["中文", "Markdown"]);
    library.add(newDraft({}, "第二份草稿"));
    library.save();
    const restored = new DraftLibrary(storage);
    expect(restored.items).toHaveLength(2);
    expect(restored.active.body).toBe("第二份草稿");
    restored.removeActive();
    expect(restored.active.data.title).toBe("旧草稿");
  });
  it("持久化只接收文章字段，认证信息不会混入存储", () => {
    const storage = memoryStorage();
    const library = new DraftLibrary(storage);
    library.active.data.accessToken = "credential-canary";
    Object.assign(library.active, { token: "credential-canary" });
    library.save();
    expect(storage.getItem(DRAFTS_KEY)).not.toContain("credential-canary");
  });
  it("损坏的存储与禁用的 localStorage 不阻止获取当前正文", () => {
    const storage = memoryStorage();
    storage.setItem(DRAFTS_KEY, "{invalid");
    expect(new DraftLibrary(storage).warning).toBeTruthy();
    const library = new DraftLibrary();
    library.active.body = "尚未保存的正文";
    expect(() => library.save()).toThrow(/导出/);
    expect(library.active.body).toBe("尚未保存的正文");
  });
  it("限制草稿数量时不删除既有内容，清空最后一份后仍可写作", () => {
    const library = new DraftLibrary();
    for (let index = 0; index < 19; index++) library.add(newDraft());
    expect(() => library.add(newDraft())).toThrow(/20/);
    for (let index = 0; index < 20; index++) library.removeActive();
    expect(library.items).toHaveLength(1);
    expect(() => newDraft({ unsupported: "value" })).toThrow(/不支持/);
  });
});
