import { expect, it, vi } from "vitest";
import {
  deploymentConfig,
  assertDirectUploadProject,
  releaseArtifact,
  fetchJson,
  smokeDeployment,
} from "../scripts/lib/deployment.mjs";
const env = {
  CLOUDFLARE_API_TOKEN: "dummy-not-a-secret",
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
  CLOUDFLARE_PROJECT_NAME: "blog",
  SITE_URL: "https://blog.pages.dev",
  GITHUB_SHA: "b".repeat(40),
  GITHUB_REPOSITORY: "scyolo/blog",
  GH_TOKEN: "dummy",
  GITHUB_ACTIONS: "true",
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "push",
};
const config = deploymentConfig(env);
const project = {
  name: "blog",
  subdomain: "blog.pages.dev",
  production_branch: "main",
};
const info = { revision: config.revision, siteUrl: config.siteUrl };
const effects = () => ({
  verify: vi.fn().mockResolvedValue(info),
  project: vi.fn().mockResolvedValue(project),
  mainRevision: vi.fn().mockResolvedValue(config.revision),
  upload: vi.fn().mockResolvedValue(undefined),
  smoke: vi.fn().mockResolvedValue(undefined),
});
it("配置只允许 main 的受控发布，且不接受空值或无效标识", () => {
  expect(config.siteUrl).toBe("https://blog.pages.dev/");
  for (const change of [
    { CLOUDFLARE_API_TOKEN: "" },
    { GITHUB_ACTIONS: "false" },
    { GITHUB_REF: "refs/pull/1/merge" },
    { GITHUB_EVENT_NAME: "pull_request" },
    { GITHUB_SHA: "bad" },
    { CLOUDFLARE_ACCOUNT_ID: "bad" },
    { CLOUDFLARE_PROJECT_NAME: "bad project" },
    { GITHUB_REPOSITORY: "invalid" },
    { SITE_URL: "https://blog.pages.dev/blog/" },
  ])
    expect(() => deploymentConfig({ ...env, ...change })).toThrow();
});
it("拒绝 Git 自动构建/错误分支/错误域名，接受已绑定自有域名", () => {
  for (const change of [
    { name: "other" },
    { source: { type: "github" } },
    { production_branch: "dev" },
    { subdomain: "other.pages.dev" },
  ])
    expect(() =>
      assertDirectUploadProject({ ...project, ...change }, config)
    ).toThrow();
  expect(() =>
    assertDirectUploadProject(
      { ...project, domains: ["notes.example.com"] },
      { ...config, siteUrl: "https://notes.example.com/" }
    )
  ).not.toThrow();
});
it("验证失败时绝不检查账户或上传", async () => {
  const io = effects();
  io.verify.mockRejectedValue(new Error("test gate failed"));
  await expect(releaseArtifact(config, io)).rejects.toThrow(/test gate/);
  expect(io.upload).not.toHaveBeenCalled();
  expect(io.project).not.toHaveBeenCalled();
});
it("旧提交以及不属于本次提交的产物均不可上传", async () => {
  const io = effects();
  io.mainRevision.mockResolvedValue("c".repeat(40));
  expect(await releaseArtifact(config, io)).toMatchObject({
    deployed: false,
    reason: "stale-main",
  });
  expect(io.upload).not.toHaveBeenCalled();
  io.verify.mockResolvedValue({ ...info, revision: "wrong" });
  await expect(releaseArtifact(config, io)).rejects.toThrow(/本次提交/);
  io.verify.mockResolvedValue({ ...info, siteUrl: "https://other.pages.dev/" });
  await expect(releaseArtifact(config, io)).rejects.toThrow(/本次提交/);
});
it("仅在所有门禁成功后上传一次，成功结果还必须通过线上冒烟", async () => {
  const io = effects();
  expect(await releaseArtifact(config, io)).toMatchObject({ deployed: true });
  expect(io.upload).toHaveBeenCalledTimes(1);
  expect(io.verify.mock.invocationCallOrder[0]).toBeLessThan(
    io.upload.mock.invocationCallOrder[0]
  );
  expect(io.mainRevision.mock.invocationCallOrder[0]).toBeLessThan(
    io.upload.mock.invocationCallOrder[0]
  );
  expect(io.upload.mock.invocationCallOrder[0]).toBeLessThan(
    io.smoke.mock.invocationCallOrder[0]
  );
  const failing = effects();
  failing.smoke.mockRejectedValue(new Error("smoke failed"));
  await expect(releaseArtifact(config, failing)).rejects.toThrow(/smoke/);
});
it("远程状态检查必须拒绝 HTTP/API 错误", async () => {
  await expect(
    fetchJson(
      "https://api.example.com",
      {},
      vi.fn().mockResolvedValue(new Response("bad", { status: 403 }))
    )
  ).rejects.toThrow(/403/);
  await expect(
    fetchJson(
      "https://api.example.com",
      {},
      vi.fn().mockResolvedValue(Response.json({ success: false }))
    )
  ).rejects.toThrow(/API/);
  await expect(
    fetchJson(
      "https://api.example.com",
      {},
      vi.fn().mockResolvedValue(Response.json({ ok: true }))
    )
  ).resolves.toEqual({ ok: true });
});
it("线上冒烟核实版本、正文/RSS/搜索及真正的 404", async () => {
  const request = vi.fn<typeof fetch>(async input => {
    const path = new URL(
      typeof input === "string"
        ? input
        : "url" in input
          ? input.url
          : input.href
    ).pathname;
    return path === "/build-info.json"
      ? Response.json(info)
      : new Response("ok", { status: path.includes("404_probe") ? 404 : 200 });
  });
  await expect(
    smokeDeployment(config.siteUrl, config.revision, request)
  ).resolves.toBeUndefined();
  expect(request).toHaveBeenCalledTimes(6);
  await expect(
    smokeDeployment(config.siteUrl, "wrong", request)
  ).rejects.toThrow(/线上版本/);
  await expect(
    smokeDeployment(
      config.siteUrl,
      config.revision,
      vi.fn(async url =>
        new URL(url).pathname === "/build-info.json"
          ? Response.json(info)
          : new Response("bad", { status: 500 })
      )
    )
  ).rejects.toThrow(/冒烟/);
  await expect(
    smokeDeployment(
      config.siteUrl,
      config.revision,
      vi.fn(async url =>
        new URL(url).pathname === "/build-info.json"
          ? Response.json(info)
          : new Response("ok")
      )
    )
  ).rejects.toThrow(/404/);
});
