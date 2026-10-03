import type { CollectionEntry } from "astro:content";

// The build runner sets one timestamp shared by every render and content outlet.
const buildTime = new Date(process.env.BUILD_TIMESTAMP ?? Date.now()).getTime();
if (!Number.isFinite(buildTime)) throw new Error("Invalid BUILD_TIMESTAMP");

export function postFilter({ data }: CollectionEntry<"posts">): boolean {
  const publishedAt = new Date(data.pubDatetime).getTime();
  if (typeof data.draft !== "boolean" || !Number.isFinite(publishedAt))
    return false;
  if (import.meta.env.DEV) return true;
  return data.draft === false && publishedAt <= buildTime;
}
