import type { Publication } from "./github";

/** Reads the public deployment with no credentials and checks the actual article route. */
export async function livePublication(
  publication: Publication,
  siteUrl: string,
  request: typeof fetch = fetch
): Promise<"waiting" | "published" | "draft"> {
  const site = new URL(siteUrl);
  const infoUrl = new URL("build-info.json", site);
  infoUrl.searchParams.set("writerRevision", publication.revision);
  infoUrl.searchParams.set("t", String(Date.now()));
  const options: RequestInit = {
    cache: "no-store",
    credentials: "omit",
    signal: AbortSignal.timeout(15_000),
  };
  const response = await request(infoUrl, options);
  if (!response.ok) return "waiting";
  const info = await response.json();
  if (info.revision !== publication.revision) return "waiting";
  const article = await request(
    new URL(`posts/${publication.slug}/?v=${publication.revision}`, site),
    options
  );
  if (publication.draft) return article.status === 404 ? "draft" : "waiting";
  return article.status === 200 ? "published" : "waiting";
}
