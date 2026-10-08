import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getCollection: vi.fn() }));
vi.mock("astro:content", () => mocks);
import { GET } from "../src/pages/rss.xml";
beforeEach(() => {
  vi.stubEnv("DEV", false);
  mocks.getCollection.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
it("RSS 保留最初发布时间和摘要，编辑旧文不会冒充重新发布", async () => {
  mocks.getCollection.mockResolvedValue([
    {
      id: "stable-note",
      filePath: "src/content/posts/moved/file.md",
      data: {
        title: "旧文",
        description: "摘要而非私有正文",
        draft: false,
        pubDatetime: new Date("2020-01-01T00:00:00.123Z"),
        modDatetime: new Date("2022-01-01T00:00:00Z"),
      },
    },
    {
      id: "private-note",
      data: {
        title: "不应输出",
        description: "私密摘要",
        draft: true,
        pubDatetime: new Date("2020-01-01T00:00:00Z"),
      },
    },
  ]);
  const response = await GET();
  const xml = await response.text();
  expect(xml).toContain("Wed, 01 Jan 2020 00:00:00 GMT");
  expect(xml).not.toContain("Sat, 01 Jan 2022");
  expect(xml).toContain("/posts/stable-note/");
  expect(xml).toContain("摘要而非私有正文");
  expect(xml).not.toContain("private-note");
});
