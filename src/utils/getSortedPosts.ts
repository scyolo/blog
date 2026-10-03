import type { CollectionEntry } from "astro:content";
import { postFilter } from "./postFilter";

/** A new list in publication order. Editing an old post does not republish it. */
export function getSortedPosts(posts: CollectionEntry<"posts">[]) {
  return posts
    .filter(postFilter)
    .sort(
      (a, b) =>
        b.data.pubDatetime.getTime() - a.data.pubDatetime.getTime() ||
        a.id.localeCompare(b.id)
    );
}
