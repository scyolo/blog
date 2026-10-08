/** Normalize an origin or a project-site URL, retaining its deployment subpath. */
export function normalizeSiteUrl(
  value = "http://localhost:4321",
  production = false
): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("SITE_URL 必须是有效的完整网址");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname.includes("//") ||
    url.search ||
    url.hash
  )
    throw new Error(
      "SITE_URL 必须是无用户名、查询、片段或重复斜杠的 HTTP(S) 站点地址"
    );
  if (
    production &&
    (url.protocol !== "https:" ||
      /^(localhost|127\.|0\.|10\.|192\.168\.|\[::1\])|\.(invalid|test|local|example)$/.test(
        url.hostname
      ))
  )
    throw new Error(
      "生产 SITE_URL 必须是实际的公开 HTTPS 地址，不能使用本地或占位地址"
    );
  url.pathname = url.pathname.replace(/\/?$/, "/");
  return url.href;
}

/** Prefix a site-relative route; external links and in-page references stay intact. */
export function withBasePath(path: string, base = "/"): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#|\?)/i.test(path)) return path;
  const prefix = base.replace(/^\/+|\/+$/g, "");
  return (prefix ? "/" + prefix : "") + "/" + path.replace(/^\/+/, "");
}
