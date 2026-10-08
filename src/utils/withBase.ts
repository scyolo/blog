import { withBasePath } from "../lib/site-url";

/** Prefix a site-relative page or asset with Astro's configured deployment base. */
export function getAssetPath(path: string): string {
  return withBasePath(path, import.meta.env.BASE_URL);
}
