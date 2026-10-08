const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
const baseRoot = base === "" ? "/" : `${base}/`;

/**
 * Prefix an asset/file path with the configured Astro `base`.
 * Does not force a trailing slash for empty paths.
 */
export function getAssetPath(path: string): string {
  // Strip leading slash to avoid double-slash when concatenating with baseRoot
  const normalizedPath = path.replace(/^\/+/, "");

  if (!normalizedPath) {
    return base === "" ? "/" : base;
  }
  return baseRoot + normalizedPath;
}
