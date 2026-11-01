import { describe, expect, it } from "vitest";
import { GitHubWriter } from "../src/writer/github";
import {
  writerRepository,
  writerBranch,
  writerWorkflow,
} from "../src/writer/config";
import { githubFixture, sampleArticle } from "./helpers/writer-github";

async function setup() {
  const fixture = githubFixture();
  const client = new GitHubWriter({
    repository: writerRepository,
    branch: writerBranch,
    workflow: writerWorkflow,
    request: fixture.request,
  });
  await client.connect("github_pat_test_only");
  return { ...fixture, client };
}
const newArticle = () => ({
  data: {
    ...sampleArticle.data,
    slug: "new-post",
    title: "从浏览器发布的新文章",
    demo: false,
  },
  body: "## 正文\n\n中文内容与 **Markdown**。\n",
});

describe("GitHub 仓库发布", () => {
  it("读取作者文章并保留源文件名、SHA、封面和元数据", async () => {
    const { client, state } = await setup();
    const [post] = await client.list();
    expect(post.path).toBe("src/content/posts/original-name.md");
    expect(post.data).toEqual(sampleArticle.data);
    await client.list();
    expect(
      state.calls.filter(call => call.path.includes("/git/blobs/"))
    ).toHaveLength(1);
    client.disconnect();
    expect(client.connected).toBe(false);
    await expect(client.list()).rejects.toMatchObject({ code: "auth" });
  });
  it("在同一次 Git 提交中保存 UTF-8 正文，只推进指定分支且从不强推", async () => {
    const { client, state } = await setup();
    const result = await client.save(newArticle());
    expect(result).toMatchObject({
      path: "src/content/posts/new-post.md",
      slug: "new-post",
      draft: false,
      changed: true,
    });
    expect(state.blobs.get(result.sha)).toContain("中文内容");
    const writes = state.calls.filter(call => call.method !== "GET");
    expect(writes.map(call => call.method)).toEqual([
      "POST",
      "POST",
      "POST",
      "PATCH",
    ]);
    expect(writes[3]).toMatchObject({
      path: "/repos/scyolo/blog/git/refs/heads/codex/github-pages",
      body: { sha: result.revision, force: false },
    });
    expect(writes[2].body?.parents).toEqual(["1".padStart(40, "0")]);
    expect(
      state.entries.some(
        entry => entry.path === "src/content/posts/original-name.md"
      )
    ).toBe(true);
  });
  it("编辑保留原文件路径及可选元数据，无改动时不产生提交", async () => {
    const { client, state } = await setup();
    const [post] = await client.list();
    expect((await client.save(post, post)).changed).toBe(false);
    expect(state.calls.filter(call => call.method !== "GET")).toEqual([]);
    const result = await client.save({ ...post, body: "修改后的正文" }, post);
    expect(result.path).toBe(post.path);
    expect(state.blobs.get(result.sha)).toContain(
      "cover: ../../assets/images/quiet-page.svg"
    );
    expect(state.blobs.get(result.sha)).toContain("demo: true");
  });
  it("重复 slug 和目标文件名冲突都在写入前失败", async () => {
    const { client, state } = await setup();
    for (const slug of ["existing-post", "original-name"])
      await expect(
        client.save({ ...newArticle(), data: { ...newArticle().data, slug } })
      ).rejects.toMatchObject({ code: "conflict" });
    expect(state.calls.filter(call => call.method !== "GET")).toEqual([]);
  });
  it("过期 SHA、已删除文件和更改永久链接不会覆盖文章", async () => {
    const { client, state } = await setup();
    const [post] = await client.list();
    await expect(
      client.save(post, { path: post.path, sha: "0".repeat(40) })
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      client.save(post, { path: "src/content/posts/deleted.md", sha: post.sha })
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      client.save({ ...post, data: { ...post.data, slug: "changed" } }, post)
    ).rejects.toMatchObject({ code: "conflict" });
    expect(state.calls.filter(call => call.method !== "GET")).toEqual([]);
  });
  it("校验结束后另一提交抢先到达，也不会覆盖整个分支", async () => {
    const { client, state } = await setup();
    const oldRevision = state.revision;
    state.race = true;
    await expect(client.save(newArticle())).rejects.toMatchObject({
      code: "conflict",
    });
    expect(state.revision).toBe(oldRevision);
    expect(state.entries).toHaveLength(2);
    expect(state.calls.at(-1)?.body?.force).toBe(false);
  });
  it.each([
    "<script>alert(1)</script>",
    "[危险链接](javascript:alert)",
    "![远程图片](https://untrusted.invalid/a.png)",
    "![[../../outside.png]]",
    "![缺失素材](../../assets/images/missing.png)",
    "[[unpublished-post]]",
  ])("拒绝不安全或无法构建的正文: %s", async body => {
    const { client, state } = await setup();
    await expect(client.save({ ...newArticle(), body })).rejects.toThrow();
    expect(state.calls.filter(call => call.method !== "GET")).toEqual([]);
  });
  it("合法双链和本地嵌入可以提交，草稿状态与未来时间保持准确", async () => {
    const { client, state } = await setup();
    const result = await client.save({
      data: {
        ...newArticle().data,
        draft: true,
        pubDatetime: "2099-01-01T00:00:00Z",
      },
      body: "[[existing-post|上一篇]]\n\n![[../../assets/images/quiet-page.svg|本地图片]]",
    });
    expect(result).toMatchObject({ draft: true, future: true });
    expect(state.blobs.get(result.sha)).toContain("draft: true");
  });
  it("仓库目录截断或符号链接文章时停止写入", async () => {
    const { client, state } = await setup();
    state.truncated = true;
    await expect(client.save(newArticle())).rejects.toMatchObject({
      code: "limit",
    });
    state.truncated = false;
    state.entries[0].mode = "120000";
    await expect(client.list()).rejects.toThrow(/符号链接/);
  });
  it("超大文件不会被下载", async () => {
    const { client, state } = await setup();
    state.entries[0].size = 300_000;
    await expect(client.list()).rejects.toMatchObject({ code: "limit" });
    expect(state.calls.some(call => call.path.includes("/git/blobs/"))).toBe(
      false
    );
  });
});

describe("访问授权和部署状态", () => {
  it("只允许仓库所有者连接；失败后清除会话", async () => {
    const fixture = githubFixture();
    const client = new GitHubWriter({
      repository: "scyolo/blog",
      branch: "codex/github-pages",
      workflow: "github-pages.yml",
      request: fixture.request,
    });
    fixture.state.owner = "someone-else";
    await expect(client.connect("github_pat_test")).rejects.toMatchObject({
      code: "owner",
    });
    expect(client.connected).toBe(false);
    fixture.state.owner = "scyolo";
    fixture.state.push = false;
    await expect(client.connect("github_pat_test")).rejects.toMatchObject({
      code: "permission",
    });
    expect(client.connected).toBe(false);
  });
  it.each([
    [401, "auth"],
    [403, "permission"],
    [404, "missing"],
    [429, "rate-limit"],
    [500, "remote"],
  ])("HTTP %s 提供安全的错误状态 %s", async (status, code) => {
    const { client, state } = await setup();
    state.failNext = { status: Number(status) };
    await expect(client.list()).rejects.toMatchObject({ code });
    if (status === 401) expect(client.connected).toBe(false);
  });
  it("网络异常不包含令牌或远端错误正文", async () => {
    const client = new GitHubWriter({
      repository: "scyolo/blog",
      branch: "branch",
      workflow: "github-pages.yml",
      request: async () => {
        throw new Error("secret-canary");
      },
    });
    try {
      await client.connect("secret-canary");
    } catch (error) {
      expect(String(error)).not.toContain("secret-canary");
    }
    expect(client.connected).toBe(false);
  });
  it.each(["queued", "building", "failed", "skipped", "deployed"] as const)(
    "区分真实部署状态 %s",
    async run => {
      const { client, state } = await setup();
      state.run = run;
      const result = await client.deployment(state.revision);
      expect(result.state).toBe(run);
      if (result.url)
        expect(result.url).toBe(
          "https://github.com/scyolo/blog/actions/runs/1234"
        );
    }
  );
  it("拒绝不合法的配置与提交标识", async () => {
    expect(
      () =>
        new GitHubWriter({
          repository: "../../other",
          branch: "main",
          workflow: "ci.yml",
        })
    ).toThrow();
    expect(
      () =>
        new GitHubWriter({
          repository: "scyolo/blog",
          branch: "../main",
          workflow: "ci.yml",
        })
    ).toThrow();
    const { client } = await setup();
    await expect(client.deployment("invalid")).rejects.toThrow();
  });
});
