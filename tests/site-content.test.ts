import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getCollection: vi.fn() }));
vi.mock("astro:content", () => mocks);
import { getPosts, getProjects, categories } from "../src/lib/site-content";
beforeEach(() => {
  vi.stubEnv("DEV", false);
  mocks.getCollection.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
it("文章集合统一过滤草稿和未来文章并按发布时间排序", async () => {
  const entry = (id: string, draft: boolean, date: string) => ({
    id,
    data: { draft, pubDatetime: new Date(date) },
  });
  mocks.getCollection.mockResolvedValue([
    entry("old", false, "2020-01-01"),
    entry("draft", true, "2021-01-01"),
    entry("future", false, "2099-01-01"),
    entry("new", false, "2022-01-01"),
  ]);
  expect((await getPosts()).map(p => p.id)).toEqual(["new", "old"]);
  expect(mocks.getCollection).toHaveBeenCalledWith("posts");
  expect(categories).toEqual({ knowledge: "知识笔记", essay: "随笔" });
});
it("项目发布状态在生产与本地预览中的行为一致", async () => {
  mocks.getCollection.mockResolvedValue([
    { id: "public", data: { draft: false } },
    { id: "draft", data: { draft: true } },
  ]);
  expect((await getProjects()).map(p => p.id)).toEqual(["public"]);
  vi.stubEnv("DEV", true);
  expect((await getProjects()).map(p => p.id)).toEqual(["public", "draft"]);
  expect(mocks.getCollection).toHaveBeenCalledWith("projects");
});
