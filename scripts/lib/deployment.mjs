import { normalizeSiteUrl } from "../../src/lib/site-url.ts";

export function deploymentConfig(env) {
  for (const key of [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_PROJECT_NAME",
    "SITE_URL",
    "GITHUB_SHA",
    "GITHUB_REPOSITORY",
    "GH_TOKEN",
  ])
    if (!env[key])
      throw new Error(
        "缺少部署配置: " + key + "；请在 GitHub 设置，不要将密钥写入源码或聊天"
      );
  if (
    env.GITHUB_ACTIONS !== "true" ||
    env.GITHUB_REF !== "refs/heads/main" ||
    !["push", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME)
  )
    throw new Error("只允许 main 的受控 Actions 发布，PR 或本地调用不能部署");
  if (!/^[a-f\d]{40}$/.test(env.GITHUB_SHA)) throw new Error("无效 GITHUB_SHA");
  if (!/^[a-f\d]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID))
    throw new Error("无效 CLOUDFLARE_ACCOUNT_ID");
  if (
    !/^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$/.test(env.CLOUDFLARE_PROJECT_NAME)
  )
    throw new Error("无效 CLOUDFLARE_PROJECT_NAME");
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY))
    throw new Error("无效 GITHUB_REPOSITORY");
  const siteUrl = normalizeSiteUrl(env.SITE_URL, true);
  if (new URL(siteUrl).pathname !== "/")
    throw new Error("Cloudflare Direct Upload 的 SITE_URL 必须是站点根地址");
  return {
    account: env.CLOUDFLARE_ACCOUNT_ID,
    project: env.CLOUDFLARE_PROJECT_NAME,
    repository: env.GITHUB_REPOSITORY,
    revision: env.GITHUB_SHA,
    siteUrl,
  };
}

export function assertDirectUploadProject(project, config) {
  if (
    project.name !== config.project ||
    project.source ||
    project.production_branch !== "main"
  )
    throw new Error(
      "Cloudflare 项目必须是无 Git 自动构建的 Direct Upload 项目，生产分支为 main"
    );
  const host = new URL(config.siteUrl).hostname;
  if (![project.subdomain, ...(project.domains ?? [])].includes(host))
    throw new Error(
      "SITE_URL 不属于该 Cloudflare 项目的 pages.dev 或已绑定域名"
    );
}

/** Injected effects make ordering/failure tests prove no upload can bypass a gate. */
export async function releaseArtifact(config, effects) {
  const info = await effects.verify();
  if (
    info.revision !== config.revision ||
    new URL(info.siteUrl).href !== config.siteUrl
  )
    throw new Error("构建产物不是本次提交/站点，禁止发布");
  assertDirectUploadProject(await effects.project(), config);
  if ((await effects.mainRevision()) !== config.revision)
    return { deployed: false, reason: "stale-main", revision: config.revision };
  await effects.upload();
  await effects.smoke();
  return { deployed: true, revision: config.revision, siteUrl: config.siteUrl };
}

export async function fetchJson(url, options = {}, request = fetch) {
  const response = await request(url, {
    ...options,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(
      "远程检查失败 (HTTP " + response.status + "): " + new URL(url).origin
    );
  const value = await response.json();
  if (value.success === false)
    throw new Error(
      "Cloudflare API 拒绝该请求；检查 Token 的账户范围及 Pages 权限"
    );
  return value;
}

export async function smokeDeployment(siteUrl, revision, request = fetch) {
  const info = await fetchJson(
    new URL("build-info.json?revision=" + revision, siteUrl),
    { cache: "no-store" },
    request
  );
  if (info.revision !== revision) throw new Error("线上版本尚未与本次产物一致");
  for (const path of [
    "",
    "rss.xml",
    "search/",
    "pagefind/pagefind-entry.json",
  ]) {
    const response = await request(new URL(path, siteUrl), {
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    if (response.status !== 200)
      throw new Error("线上冒烟失败: " + path + " HTTP " + response.status);
    await response.arrayBuffer();
  }
  const notFound = await request(
    new URL("__deployment_404_probe__/", siteUrl),
    { signal: AbortSignal.timeout(20000) }
  );
  if (notFound.status !== 404) throw new Error("线上不存在的地址没有返回 404");
}
