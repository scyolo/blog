import { afterEach, expect, it, vi } from "vitest";
import { getAssetPath } from "../src/utils/withBase";

afterEach(() => vi.unstubAllEnvs());

it.each(["/", "/blog/", "/notes/blog/"])(
  "页面和资源使用配置的基础路径 %s",
  base => {
    vi.stubEnv("BASE_URL", base);
    expect(getAssetPath("/")).toBe(base);
    expect(getAssetPath("")).toBe(base);
    expect(getAssetPath("/posts/a/")).toBe(base + "posts/a/");
    expect(getAssetPath("favicon.svg")).toBe(base + "favicon.svg");
    expect(getAssetPath("/rss.xml")).toBe(base + "rss.xml");
    expect(getAssetPath("/search/?q=hello#results")).toBe(
      base + "search/?q=hello#results"
    );
  }
);

it.each([
  "https://github.com/scyolo",
  "//example.com/path",
  "mailto:hello@example.com",
  "#section",
  "?q=hello",
])("不改写外链或页面内引用 %s", href => {
  vi.stubEnv("BASE_URL", "/blog/");
  expect(getAssetPath(href)).toBe(href);
});

it("基础路径无末尾斜杠时也只添加一次分隔符", () => {
  vi.stubEnv("BASE_URL", "/blog");
  expect(getAssetPath("/posts/a/")).toBe("/blog/posts/a/");
});
