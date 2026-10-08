import { afterEach, beforeEach, expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  symlink,
  unlink,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { stringify } from "yaml";
import { readSiteContent } from "../src/lib/content-files";
let dir: string;
const data = {
  slug: "a-post",
  title: "示例",
  description: "测试说明",
  pubDatetime: "2026-10-01T10:00:00+08:00",
  draft: false,
  category: "knowledge",
};
const put = async (name: string, text: string) => {
  await mkdir(join(dir, name, ".."), { recursive: true });
  await writeFile(join(dir, name), text);
};
const post = (change = {}, body = "正文") =>
  "---\n" + stringify({ ...data, ...change }) + "---\n" + body;
beforeEach(async () => {
  dir = await mkdtemp(resolve(".cache/content-test-"));
});
afterEach(async () => {
  if (!resolve(dir).startsWith(resolve(".cache/content-test-")))
    throw new Error("unsafe cleanup");
  await rm(dir, { recursive: true, force: true });
});
it("读取真实 Markdown，空目录可用", async () => {
  expect((await readSiteContent(dir)).posts).toEqual([]);
  await put("src/content/posts/nested/a.md", post());
  const result = await readSiteContent(dir);
  expect(result.posts[0].data.slug).toBe("a-post");
  expect(result.posts[0].source).toContain("nested/a.md");
});
it("真实文件中的重复 slug 和重复 YAML 键都会报错", async () => {
  await put("src/content/posts/a.md", post());
  await put("src/content/posts/b.md", post());
  await expect(readSiteContent(dir)).rejects.toThrow(/重复 slug/);
  await put("src/content/posts/b.md", "---\nslug: a\nslug: b\n---\n正文");
  await expect(readSiteContent(dir)).rejects.toThrow(/b.md/);
});
it("缺少 frontmatter 和不支持的 MDX 不会被静默跳过", async () => {
  await put("src/content/posts/a.md", "# 没有元数据");
  await expect(readSiteContent(dir)).rejects.toThrow(/frontmatter/);
  await rm(join(dir, "src/content/posts/a.md"));
  await put("src/content/posts/a.mdx", post());
  await expect(readSiteContent(dir)).rejects.toThrow(/MDX/);
});
it("接受经过检查的本地封面及 Markdown 引用图片", async () => {
  await put(
    "src/assets/images/a.svg",
    '<svg xmlns="http://www.w3.org/2000/svg"/>'
  );
  const ref = "../../assets/images/a.svg";
  await put(
    "src/content/posts/a.md",
    post({ cover: ref }, "![" + "示意图" + "][figure]\n\n[figure]: " + ref)
  );
  expect((await readSiteContent(dir)).assets).toEqual([
    "src/assets/images/a.svg",
  ]);
});
it("阻止远程图像、越界资源、丢失资源和原始 HTML", async () => {
  for (const body of [
    "![图](https://example.com/a.png)",
    "![图](../../../secret.png)",
    "![图](../../assets/images/missing.png)",
    "<script>alert(1)</script>",
  ]) {
    await put("src/content/posts/a.md", post({}, body));
    await expect(readSiteContent(dir)).rejects.toThrow(/a.md/);
  }
});
it("public 目录不能混入源文件或密钥文件", async () => {
  await put("public/.env", "TEST_NOT_A_REAL_SECRET=sentinel");
  await expect(readSiteContent(dir)).rejects.toThrow(/public/);
  await rm(join(dir, "public/.env"));
  await put("public/note.md", "不应该作为附件发布的源文件");
  await expect(readSiteContent(dir)).rejects.toThrow(/public/);
});
it("页面和项目也使用真实文件校验", async () => {
  await put("src/content/pages/about.md", "---\ntitle: 关于\n---\n介绍");
  await put(
    "src/content/projects/blog.md",
    "---\nslug: blog\ntitle: 博客\ndescription: 项目说明\ndraft: true\ntechStack: [Astro]\n---\n正文"
  );
  const result = await readSiteContent(dir);
  expect(result.pages).toHaveLength(1);
  expect(result.projects).toHaveLength(1);
});

it("拒绝无效页面元数据", async () => {
  await put("src/content/pages/about.md", '---\ntitle: ""\n---\n正文');
  await expect(readSiteContent(dir)).rejects.toThrow(/about.md/);
});
it("拒绝内容目录链接，避免扫描意外位置", async () => {
  const target = join(dir, "elsewhere");
  await mkdir(target);
  await mkdir(join(dir, "src/content"), { recursive: true });
  const link = join(dir, "src/content/posts");
  await symlink(target, link, "junction");
  try {
    await expect(readSiteContent(dir)).rejects.toThrow(/符号链接/);
  } finally {
    await unlink(link);
  }
});
it("拒绝通过资源目录链接逃出本项目", async () => {
  const external = await mkdtemp(resolve(".cache/outside-"));
  try {
    await writeFile(join(external, "x.svg"), "<svg/>");
    await mkdir(join(dir, "src/assets"), { recursive: true });
    const link = join(dir, "src/assets/linked");
    await symlink(external, link, "junction");
    try {
      await put(
        "src/content/posts/a.md",
        post({}, "![图](../../assets/linked/x.svg)")
      );
      await expect(readSiteContent(dir)).rejects.toThrow(/超出/);
    } finally {
      await unlink(link);
    }
  } finally {
    if (!resolve(external).startsWith(resolve(".cache/outside-")))
      throw Error("Unsafe fixture");
    await rm(external, { recursive: true, force: true });
  }
});
