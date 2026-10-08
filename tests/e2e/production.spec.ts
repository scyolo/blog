import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readdirSync, readFileSync } from "node:fs";
const info = JSON.parse(readFileSync("dist/build-info.json", "utf8"));
const slugs = readdirSync("dist/posts", { withFileTypes: true })
  .filter(entry => entry.isDirectory() && /^[a-z][a-z0-9-]*$/.test(entry.name))
  .map(entry => entry.name);
const routes = [
  "/",
  "/posts/",
  "/categories/knowledge/",
  "/categories/essay/",
  "/projects/",
  "/about/",
  "/tags/",
  "/archives/",
  "/search/",
];

test("正式产物的全部主要页面和真正的 404 可用", async ({ page }) => {
  for (const path of routes) {
    expect((await page.goto(path))?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new URL(path, info.siteUrl).href
    );
  }
  expect((await page.goto("/__not_a_real_post__/"))?.status()).toBe(404);
  await page.getByRole("link", { name: "回到首页", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("真实内容可搜索，无文章时呈现空状态而不是索引导航", async ({ page }) => {
  if (!slugs.length) {
    await page.goto("/search/");
    await expect(
      page.getByRole("heading", { name: "还没有已发布文章。" })
    ).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    return;
  }
  await page.goto("/posts/" + slugs[0] + "/");
  const title = await page.getByRole("heading", { level: 1 }).innerText();
  await page.goto("/search/");
  await page.getByRole("textbox", { name: "搜索关键词" }).fill(title);
  await expect(page.locator(".pagefind-ui__results")).toContainText(title);
  await page.getByRole("textbox").fill("zzqv987654321nomatchingtoken");
  await expect(page.locator(".pagefind-ui__message")).toContainText(
    /未找到|没有|0/
  );
});

for (const width of [360, 768, 1440])
  test(`正式内容在 ${width}px 下可阅读并保留键盘焦点`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/projects/",
      ...slugs.slice(0, 2).map(slug => "/posts/" + slug + "/"),
    ]) {
      expect((await page.goto(path))?.status()).toBe(200);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth
        ),
        path
      ).toBeLessThanOrEqual(1);
    }
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "跳转到正文" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    await page.getByRole("button", { name: "切换亮暗主题" }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    if (width === 360) {
      await page.getByLabel("展开导航").click();
      await expect(
        page.getByRole("navigation", { name: "移动导航" })
      ).toBeVisible();
    }
    if (width === 1440)
      await page.screenshot({
        path: "output/playwright/production-home-dark.png",
        fullPage: true,
      });
  });

test("正式产物没有严重无障碍问题、第三方资源或未捕获异常", async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (
      !request
        .url()
        .startsWith(
          "http://127.0.0.1:" + (process.env.E2E_PORT ?? 4322) + "/"
        ) &&
      !request.url().startsWith("data:")
    )
      external.push(request.url());
  });
  for (const path of [
    "/",
    "/projects/",
    "/search/",
    ...slugs.slice(0, 2).map(slug => "/posts/" + slug + "/"),
  ]) {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations.filter(
        item => item.impact === "serious" || item.impact === "critical"
      ),
      path
    ).toEqual([]);
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
