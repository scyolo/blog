import { getRelativeLocaleUrl } from "astro:i18n";
import config from "@/config";

/** The loader's explicit content ID is the permanent slug, never its file path. */
export function getPostSlug(id: string, _filePath?: string): string {
  return id;
}

/** filePath is retained temporarily for compatibility with upstream components. */
export function getPostUrl(
  id: string,
  _filePath?: string,
  locale = config.site.lang
): string {
  return getRelativeLocaleUrl(locale, "posts/" + id + "/");
}
