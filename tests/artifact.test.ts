import { afterEach, beforeEach, expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
  unlink,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import {
  createManifest,
  assertManifest,
  verifyArtifact,
} from "../scripts/lib/artifact.mjs";
let dir: string;
const site = "https://blog.example/";
const data = {
  slug: "a",
  title: "文章标题",
  description: "文章摘要",
  draft: false,
  pubDatetime: new Date("2020-01-01T00:00:00Z"),
};
const posts = [
  { data },
  { data: { ...data, slug: "private", draft: true } },
  {
    data: {
      ...data,
      slug: "future",
      pubDatetime: new Date("2099-01-01T00:00:00Z"),
    },
  },
];
const put = async (name: string, value: string | Uint8Array) => {
  await mkdir(join(dir, name, ".."), { recursive: true });
  await writeFile(join(dir, name), value);
};
const html = (route: string, extra = "", noindex = false) =>
  `<!doctype html><html lang="zh-CN"><head><title>测试</title><meta name="description" content="摘要"><link rel="canonical" href="${site.slice(0, -1)}${route}"><meta property="og:image" content="${site}default-og.png">${noindex ? '<meta name="robots" content="noindex,follow">' : ""}</head><body><main id="main-content"><h1>文章标题</h1><a href="/posts/a/#part">正文</a><section id="part">内容</section>${extra}</main></body></html>`;
const fragment = (url = "/posts/a/") =>
  gzipSync(
    "pagefind_dcd" +
      JSON.stringify({
        url,
        content: "文章标题 文章正文",
        meta: { title: "文章标题" },
      })
  );
const verify = () => verifyArtifact({ directory: dir, posts, siteUrl: site });
beforeEach(async () => {
  await mkdir(resolve(".cache"), { recursive: true });
  dir = await mkdtemp(resolve(".cache/artifact-test-"));
  await put("index.html", html("/"));
  await put("posts/a/index.html", html("/posts/a/"));
  await put("search/index.html", html("/search/", "", true));
  await put("404.html", html("/404.html", "", true));
  await put("default-og.png", "test-image");
  await put(
    "build-info.json",
    JSON.stringify({
      version: 1,
      revision: "local",
      builtAt: "2026-10-08T00:00:00Z",
      siteUrl: site,
    })
  );
  await put(
    "rss.xml",
    `<rss><channel><item><title>文章标题</title><description>文章摘要</description><link>${site}posts/a/</link><pubDate>Wed, 01 Jan 2020 00:00:00 GMT</pubDate></item></channel></rss>`
  );
  await put(
    "sitemap-index.xml",
    `<sitemapindex><sitemap><loc>${site}sitemap-0.xml</loc></sitemap></sitemapindex>`
  );
  await put(
    "sitemap-0.xml",
    `<urlset><url><loc>${site}</loc></url><url><loc>${site}posts/a/</loc></url></urlset>`
  );
  await put(
    "pagefind/pagefind-entry.json",
    JSON.stringify({
      version: "1.5.2",
      languages: { "zh-cn": { page_count: 1 } },
    })
  );
  await put("pagefind/fragment/a.pf_fragment", fragment());
});
afterEach(async () => {
  if (!resolve(dir).startsWith(resolve(".cache/artifact-test-")))
    throw Error("Unsafe fixture cleanup");
  await rm(dir, { recursive: true, force: true });
});
it("逐字节封存产物并拒绝添加、篡改和缺失文件", async () => {
  const manifest = await createManifest(dir);
  await expect(assertManifest(dir, manifest)).resolves.toBeUndefined();
  await put("extra.txt", "changed");
  await expect(assertManifest(dir, manifest)).rejects.toThrow(/manifest|产物/);
  await rm(join(dir, "extra.txt"));
  await put("index.html", "tampered");
  await expect(assertManifest(dir, manifest)).rejects.toThrow(/manifest|产物/);
  await rm(join(dir, "index.html"));
  await expect(assertManifest(dir, manifest)).rejects.toThrow(/manifest|产物/);
  await expect(assertManifest(dir, {})).rejects.toThrow(/manifest|清单/);
});
it("验证正常站点、RSS、站点地图与解压后的中文搜索片段", async () => {
  const result = await verify();
  expect(result).toMatchObject({ pages: 4, posts: 1, indexed: 1 });
});
it.each(["private", "future"])("拒绝意外产出的 %s 文章", async slug => {
  await put(`posts/${slug}/index.html`, html(`/posts/${slug}/`));
  await expect(verify()).rejects.toThrow(/文章|published/);
});
it.each([
  ["<a href='https://user:password@example.com/'>私有链接</a>", /用户名|密码/],
  ["<a href='/missing/'>断链</a>", /断链/],
  ["<a href='/posts/a/#missing'>坏锚点</a>", /锚点/],
  ["<img src='/missing.png' width='20' height='20' alt='图'>", /断链/],
  ["<img src='/default-og.png' width='20' height='20'>", /alt/],
  ["<img src='/default-og.png' alt='图'>", /尺寸/],
  ["<script src='https://third-party.example/a.js'></script>", /第三方/],
  ["<a href='javascript:alert(1)'>危险</a>", /协议/],
  ["<script type='application/ld+json'>{broken}</script>", /JSON/],
])("拒绝不可交付的 HTML: %s", async (markup, error) => {
  await put("index.html", html("/", markup));
  await expect(verify()).rejects.toThrow(error);
});
it("允许外链、邮件及有效 JSON-LD，不要求外站可用", async () => {
  await put(
    "index.html",
    html(
      "/",
      `<a href='https://example.com'>外链</a><a href='mailto:a@example.com'>邮件</a><script type='application/ld+json'>{"@type":"WebSite"}</script><img src='/default-og.png' width='40' height='20' alt='图'>`
    )
  );
  await expect(verify()).resolves.toBeDefined();
});
it("元信息、语言和主标题不能遗漏", async () => {
  for (const remove of [
    /<title>.*?<\/title>/,
    /<meta name="description"[^>]*>/,
    /<link rel="canonical"[^>]*>/,
    / lang="zh-CN"/,
    /<h1>.*?<\/h1>/,
    /<meta property="og:image"[^>]*>/,
  ]) {
    await put("index.html", html("/").replace(remove, ""));
    await expect(verify()).rejects.toThrow(/元信息|标题|语言|canonical|分享图/);
  }
});
it("RSS 不可包含草稿、错误日期或错误摘要", async () => {
  const original = await readFile(join(dir, "rss.xml"), "utf8");
  for (const xml of [
    original.replace("posts/a/", "posts/private/"),
    original.replace("2020", "2022"),
    original.replace("文章摘要", "错误摘要"),
    "<rss>",
  ]) {
    await put("rss.xml", xml);
    await expect(verify()).rejects.toThrow(/RSS|XML/);
  }
});
it("站点地图不能包含隐藏/不存在的页面或丢失正文", async () => {
  for (const xml of [
    `<urlset><url><loc>${site}posts/private/</loc></url></urlset>`,
    `<urlset/>`,
  ]) {
    await put("sitemap-0.xml", xml);
    await expect(verify()).rejects.toThrow(/sitemap|站点地图/);
  }
});
it("真正解压 Pagefind，拒绝索引内混入未发布内容", async () => {
  await put("pagefind/fragment/a.pf_fragment", fragment("/posts/private/"));
  await expect(verify()).rejects.toThrow(/Pagefind/);
  await put("pagefind/fragment/a.pf_fragment", "corrupted");
  await expect(verify()).rejects.toThrow(/Pagefind/);
});
it.each([".env", "leaked.md", "client.js.map", "secret.key"])(
  "不允许公开产物包含 %s",
  async name => {
    await put(name, "not-secret");
    await expect(verify()).rejects.toThrow(/源文件|私有/);
  }
);
it("正文泄漏哨兵也不能藏在脚本或压缩片段中", async () => {
  await put("leak.js", 'const text="UNPUBLISHED_CANARY_DRAFT";');
  await expect(verify()).rejects.toThrow(/未发布内容/);
});
it("构建元数据和产物中的站点地址必须匹配", async () => {
  await put(
    "build-info.json",
    JSON.stringify({
      version: 1,
      revision: "local",
      builtAt: "invalid",
      siteUrl: site,
    })
  );
  await expect(verify()).rejects.toThrow(/构建/);
});
it("文件系统链接不能混入发布产物", async () => {
  const target = join(dir, "external");
  await mkdir(target);
  const link = join(dir, "linked");
  await symlink(target, link, "junction");
  try {
    await expect(createManifest(dir)).rejects.toThrow(/链接/);
  } finally {
    await unlink(link);
  }
});
