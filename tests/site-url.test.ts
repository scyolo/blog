import { expect, it } from "vitest";
import { normalizeSiteUrl } from "../src/lib/site-url";
it("本地默认值和公开站点地址被规范化", () => {
  expect(normalizeSiteUrl()).toBe("http://localhost:4321/");
  expect(normalizeSiteUrl("https://blog.pages.dev", true)).toBe(
    "https://blog.pages.dev/"
  );
});
it.each([
  "not-url",
  "ftp://example.com",
  "https://user:pass@example.com",
  "https://example.com/blog//nested/",
  "https://example.com/?a=1",
  "https://example.com/#top",
])("拒绝不受支持的站点配置 %s", value =>
  expect(() => normalizeSiteUrl(value)).toThrow(/SITE_URL/)
);
it.each([
  "http://blog.pages.dev",
  "https://localhost",
  "https://127.0.0.1",
  "https://example.invalid",
  "https://10.0.0.1",
  "https://192.168.0.1",
  "https://[::1]",
])("生产不接受本地、明文或占位地址 %s", value =>
  expect(() => normalizeSiteUrl(value, true)).toThrow(/生产/)
);

it("GitHub Pages 项目地址保留子路径并规范化末尾斜杠", () => {
  expect(normalizeSiteUrl("https://scyolo.github.io/blog", true)).toBe(
    "https://scyolo.github.io/blog/"
  );
  expect(normalizeSiteUrl("https://scyolo.github.io/blog/", true)).toBe(
    "https://scyolo.github.io/blog/"
  );
});
