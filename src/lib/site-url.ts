/** This first version is deployed at an origin root, never under a path prefix. */
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
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "SITE_URL 必须是无用户名、路径、查询或片段的 HTTP(S) 站点根地址"
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
  return url.href;
}
