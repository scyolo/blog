import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { githubFixture } from "../helpers/writer-github";

const info = JSON.parse(readFileSync("dist/build-info.json", "utf8"));
const base = new URL(info.siteUrl).pathname;
const writerPath = base + "write/";
const testToken = "github_pat_BROWSER_TEST_ONLY_NOT_A_CREDENTIAL";

async function openWriter(page: Page) {
  await page.goto(writerPath);
  await expect(page.locator("[data-writer]")).toHaveAttribute(
    "data-ready",
    "true"
  );
}
async function fillArticle(page: Page) {
  await page.locator('[data-field="title"]').fill("在网站里完成写作");
  await page.locator('[data-field="slug"]').fill("browser-publication");
  await page
    .locator('[data-field="description"]')
    .fill("一次完整的写作与发布流程。");
  await page.locator('[data-field="pubDatetime"]').fill("2020-01-02T12:00");
  await page.locator('[data-field="tags"]').fill("写作, Markdown");
  await page
    .getByRole("textbox", { name: "Markdown 正文" })
    .fill(
      "## 从一个小问题开始\n\n正文支持 **加粗** 和 ==高亮==。\n\n> [!NOTE] 留下思考\n> 清晰比复杂更重要。\n\n$E=mc^2$\n\n- [x] 保存草稿\n- [ ] 发布文章"
    );
}
async function fakeGitHub(page: Page) {
  const fixture = githubFixture();
  await page.route("https://api.github.com/**", async route => {
    const request = route.request();
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, X-GitHub-Api-Version, Cache-Control, Pragma",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    const response = await fixture.request(request.url(), {
      method: request.method(),
      headers: request.headers(),
      ...(request.postData() ? { body: request.postData()! } : {}),
    });
    await route.fulfill({
      status: response.status,
      headers: { ...cors, "Content-Type": "application/json" },
      body: await response.text(),
    });
  });
  return fixture;
}
async function connect(page: Page) {
  await page.locator("[data-connect]").click();
  await page.getByLabel("访问令牌", { exact: true }).fill(testToken);
  await page.locator("[data-connect-submit]").click();
  await expect(page.locator("[data-connection-status]")).toHaveText(
    "GitHub 已连接"
  );
  await expect(page.locator("[data-remote-post]")).toContainText("已有文章");
}

test("自动保存、恢复和导出；新建文章保留原草稿", async ({ page }) => {
  await openWriter(page);
  await fillArticle(page);
  await expect(page.locator("[data-feedback-text]")).toHaveText(
    "草稿已保存到本机"
  );
  await page.reload();
  await expect(page.locator("[data-writer]")).toHaveAttribute(
    "data-ready",
    "true"
  );
  await expect(page.locator('[data-field="title"]')).toHaveValue(
    "在网站里完成写作"
  );
  await expect(page.locator("[data-preview] .katex")).toBeVisible();
  await expect(page.locator("[data-preview] .katex-mathml")).toHaveCSS(
    "position",
    "absolute"
  );
  await expect(page.locator("[data-preview] .callout-title")).toHaveCSS(
    "display",
    "flex"
  );
  await expect(page.locator("[data-preview] mark")).toHaveText("高亮");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "导出 Markdown", exact: true })
    .click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("browser-publication.md");
  const path = await download.path();
  const source = readFileSync(path!, "utf8");
  expect(source).toContain("draft: true");
  expect(source).toContain("2020-01-02T04:00:00.000Z");
  await page.locator("[data-new]").click();
  await expect(page.locator('[data-field="title"]')).toHaveValue("");
  await page.locator(".writer-drafts summary").click();
  await page
    .locator("[data-local-draft]")
    .selectOption({ label: "在网站里完成写作" });
  await expect(page.locator("[data-editor]")).toHaveValue(/从一个小问题开始/);
});

test("导入正确识别 YAML 数组与多行摘要；存储禁用时仍能导出", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "setItem", {
      value: () => {
        throw new DOMException("Unavailable", "QuotaExceededError");
      },
    });
  });
  await openWriter(page);
  const source =
    "---\ntitle: 导入的文章\nslug: imported-post\ndescription: |\n  第一行摘要\n  第二行摘要\ncategory: essay\npubDatetime: 2020-01-02T12:00:00+08:00\ndraft: true\ntags:\n  - YAML\n  - 中文\nauthor: original-author\n---\n\n导入后仍在这里。";
  await page.locator("[data-import]").setInputFiles({
    name: "imported.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(source),
  });
  await expect(page.locator('[data-field="title"]')).toHaveValue("导入的文章");
  await expect(page.locator('[data-field="tags"]')).toHaveValue("YAML, 中文");
  await expect(page.locator("[data-feedback-text]")).toContainText("导出");
  const downloading = page.waitForEvent("download");
  await page.locator("[data-export]").click();
  expect(readFileSync((await (await downloading).path())!, "utf8")).toContain(
    "author: original-author"
  );
});

test("站内发布提交指定分支，授权不落盘，确认线上版本后才显示已上线", async ({
  page,
}) => {
  const fixture = await fakeGitHub(page);
  let isLive = false;
  await page.route("**/build-info.json?writerRevision=*", route =>
    route.fulfill({
      json: { revision: isLive ? fixture.state.revision : "old-revision" },
    })
  );
  await page.route("**/posts/browser-publication/?v=*", route =>
    route.fulfill({
      status: isLive ? 200 : 404,
      body: isLive ? "published" : "missing",
    })
  );
  await openWriter(page);
  await fillArticle(page);
  await connect(page);
  await page.locator("[data-publish]").click();
  await expect(page.getByRole("dialog", { name: "准备发布" })).toBeVisible();
  expect(fixture.state.calls.filter(call => call.method !== "GET")).toEqual([]);
  await page.locator("[data-confirm-publish]").click();
  await expect(page.locator("[data-publication-text]")).toContainText("已提交");
  await expect(page.locator("[data-article-link]")).toBeHidden();
  expect(fixture.state.calls.find(call => call.method === "PATCH")?.path).toBe(
    "/repos/scyolo/blog/git/refs/heads/codex/github-pages"
  );
  expect(
    fixture.state.blobs.get(
      fixture.state.entries.find(entry =>
        entry.path.endsWith("browser-publication.md")
      )!.sha
    )
  ).toContain("draft: false");
  const stored = await page.evaluate(() => ({
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
    tokenField: (document.querySelector("[data-token]") as HTMLInputElement)
      .value,
  }));
  expect(JSON.stringify(stored)).not.toContain(testToken);
  expect(stored.tokenField).toBe("");
  isLive = true;
  fixture.state.run = "deployed";
  await expect(page.locator("[data-publication-text]")).toHaveText(
    "文章已上线。",
    { timeout: 20_000 }
  );
  await expect(page.locator("[data-article-link]")).toHaveAttribute(
    "href",
    new RegExp(`${base}posts/browser-publication/$`)
  );
  await page.reload();
  await expect(page.locator("[data-connection-status]")).toHaveText(
    "本地写作模式"
  );
  await expect(page.locator('[data-field="title"]')).toHaveValue(
    "在网站里完成写作"
  );
});

test("远端竞争写入保留草稿并提示冲突，不宣称发布成功", async ({ page }) => {
  const fixture = await fakeGitHub(page);
  fixture.state.race = true;
  await openWriter(page);
  await fillArticle(page);
  await connect(page);
  await page.locator("[data-publish]").click();
  await page.locator("[data-confirm-publish]").click();
  await expect(page.locator("[data-publish-error]")).toContainText("没有覆盖");
  await page.getByRole("button", { name: "继续编辑", exact: true }).click();
  await expect(page.locator('[data-field="title"]')).toHaveValue(
    "在网站里完成写作"
  );
  await expect(page.locator("[data-publication]")).toBeHidden();
});

test("GitHub 构建失败时保留准确状态，已有文章载入后锁定永久路径", async ({
  page,
}) => {
  const fixture = await fakeGitHub(page);
  fixture.state.run = "failed";
  await page.route("**/build-info.json?writerRevision=*", route =>
    route.fulfill({ json: { revision: "old" } })
  );
  await openWriter(page);
  await connect(page);
  await page
    .locator("[data-remote-post]")
    .selectOption("src/content/posts/original-name.md");
  await page.locator("[data-load-post]").click();
  await expect(page.locator('[data-field="slug"]')).toHaveValue(
    "existing-post"
  );
  await expect(page.locator('[data-field="slug"]')).toHaveAttribute(
    "readonly",
    ""
  );
  await page
    .getByRole("textbox", { name: "Markdown 正文" })
    .fill("修改后的正文");
  await page.locator("[data-publish]").click();
  await page.locator("[data-confirm-publish]").click();
  await expect(page.locator("[data-publication-text]")).toContainText(
    "构建或部署失败"
  );
  await expect(page.locator("[data-article-link]")).toBeHidden();
});

for (const width of [375, 768, 1440])
  test(`${width}px 的写作与预览可切换，键盘和无障碍检查通过`, async ({
    page,
  }) => {
    const errors: string[] = [];
    const remote: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {
      if (
        request.url().startsWith("http") &&
        !request.url().includes("127.0.0.1")
      )
        remote.push(request.url());
    });
    await page.setViewportSize({ width, height: 1000 });
    await openWriter(page);
    await fillArticle(page);
    await page.getByRole("tab", { name: "预览", exact: true }).click();
    await expect(page.locator("[data-preview]")).toBeVisible();
    await expect(page.locator("[data-editor]")).toBeHidden();
    await expect(page.locator("[data-preview] .katex")).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      )
    ).toBeLessThanOrEqual(1);
    await page
      .getByRole("tab", { name: "预览", exact: true })
      .press("ArrowLeft");
    await expect(
      page.getByRole("tab", { name: "写作", exact: true })
    ).toBeFocused();
    await expect(page.locator("[data-editor]")).toBeVisible();
    if (width === 1440)
      await page.getByRole("tab", { name: "双栏", exact: true }).click();
    const audit = await new AxeBuilder({ page }).analyze();
    expect(
      audit.violations.filter(
        item => item.impact === "serious" || item.impact === "critical"
      )
    ).toEqual([]);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: `output/playwright/writer-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "切换亮暗主题" }).click();
    const darkAudit = await new AxeBuilder({ page }).analyze();
    expect(
      darkAudit.violations.filter(
        item => item.impact === "serious" || item.impact === "critical"
      )
    ).toEqual([]);
    await page.screenshot({
      path: `output/playwright/writer-${width}-dark.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
    expect(remote).toEqual([]);
  });

test("原始 HTML 和外部图片不会执行或发出请求，Mermaid 在预览中实际渲染", async ({
  page,
}) => {
  await openWriter(page);
  const remote: string[] = [];
  page.on("request", request => {
    if (request.url().includes("untrusted.invalid")) remote.push(request.url());
  });
  await page
    .locator("[data-editor]")
    .fill(
      "<script>window.writerXss = true</script>\n\n![image](https://untrusted.invalid/pixel.png)\n\n```mermaid\nflowchart LR\nA[写作] --> B[发布]\n```"
    );
  await page.getByRole("tab", { name: "预览", exact: true }).click();
  await expect(
    page.locator("[data-preview] .writer-diagram svg")
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as Record<string, unknown>).writerXss
    )
  ).toBeUndefined();
  expect(remote).toEqual([]);
});
