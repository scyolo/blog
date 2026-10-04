import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("首页具有中文定位、图文卡片和明确的示例标识", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "把学到的，写下来"
  );
  await expect(page.locator(".post-card")).toHaveCount(3);
  await expect(page.locator(".post-card img")).toHaveCount(3);
  await expect(page.locator(".post-card").first()).toContainText("示例");
  await page.screenshot({
    path: "output/playwright/home-desktop.png",
    fullPage: true,
  });
});

test("公式可读，图表按需渲染并响应暗色主题", async ({ page }) => {
  await page.goto("/posts/technical-writing/");
  await expect(page.locator(".katex").first()).toBeVisible();
  const diagram = page.locator("figure[data-mermaid]").first();
  await diagram.scrollIntoViewIfNeeded();
  await expect(diagram.locator("svg")).toBeVisible();
  await expect(diagram).toHaveAttribute("data-rendered-theme", "light");
  await page.getByRole("button", { name: "切换亮暗主题" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(diagram).toHaveAttribute("data-rendered-theme", "dark");
  await expect(diagram.locator("svg")).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("代码复制和目录导航可以实际使用", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/posts/technical-writing/");
  const copy = page.getByRole("button", { name: "复制代码" }).first();
  await copy.click();
  await expect(copy).toContainText("已复制");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "isPublished"
  );
  await page
    .getByRole("navigation", { name: "文章目录" })
    .getByRole("link", { name: "用表格总结选择" })
    .click();
  await expect(page).toHaveURL(/#/);
  await expect(
    page.getByRole("heading", { name: "用表格总结选择" })
  ).toBeInViewport();
});

test("中文搜索、英文关键词及空结果", async ({ page }) => {
  await page.goto("/search/");
  const input = page.getByRole("textbox");
  await input.fill("想法");
  await expect(page.locator(".pagefind-ui__result")).not.toHaveCount(0);
  await expect(page.locator(".pagefind-ui__results")).toContainText(
    "把想法写清楚"
  );
  await input.fill("Markdown");
  await expect(page.locator(".pagefind-ui__result")).not.toHaveCount(0);
  await expect(page.locator(".pagefind-ui__results")).toContainText(
    "一个轻量博客"
  );
  await input.fill("zzqv987654321nomatchingtoken");
  await expect(page.locator(".pagefind-ui__message")).toContainText(
    /没有|未找到|0/
  );
});

test("栏目、项目、归档和关于可访问", async ({ page }) => {
  for (const [path, title] of [
    ["/categories/knowledge/", "知识笔记"],
    ["/categories/essay/", "随笔"],
    ["/projects/", "项目"],
    ["/archives/", "归档"],
    ["/about/", "关于"],
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
  }
});

for (const width of [360, 768, 1440]) {
  test("宽度 " + width + " 的页面与长文不会整页横向溢出", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/posts/technical-writing/",
      "/posts/static-blog-architecture/",
      "/search/",
    ]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);
    }
    if (width === 360) {
      await page.goto("/");
      await page.screenshot({
        path: "output/playwright/home-mobile.png",
        fullPage: true,
      });
    }
  });
}

test("移动导航和 404 恢复入口可操作", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByLabel("展开导航").click();
  await page
    .getByRole("navigation", { name: "移动导航" })
    .getByRole("link", { name: "项目", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp("/projects/$"));
  const response = await page.goto("/does-not-exist/");
  expect(response?.status()).toBe(404);
  await page.getByRole("link", { name: "回到首页", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "把学到的"
  );
});

test("代表性页面没有严重或致命无障碍问题", async ({ page }) => {
  for (const path of [
    "/",
    "/posts/technical-writing/",
    "/projects/",
    "/search/",
  ]) {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations.filter(
        v => v.impact === "serious" || v.impact === "critical"
      )
    ).toEqual([]);
  }
});

test("普通页面不会加载 Mermaid 大型运行时", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", r => requests.push(r.url()));
  await page.goto("/");
  await page.waitForTimeout(250);
  expect(
    requests.some(url => /mermaid|flowDiagram|sequenceDiagram/.test(url))
  ).toBe(false);
});
