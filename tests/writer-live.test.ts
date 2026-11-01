import { expect, it } from "vitest";
import { livePublication } from "../src/writer/live";
import type { Publication } from "../src/writer/github";
const publication: Publication = {
  revision: "a".repeat(40),
  sha: "b".repeat(40),
  path: "src/content/posts/a.md",
  slug: "a",
  draft: false,
  future: false,
  changed: true,
};
it("确认相同线上版本和文章 HTTP 200 后才宣布已上线，且不发送凭据", async () => {
  const calls: string[] = [];
  const request: typeof fetch = async (url, options) => {
    calls.push(String(url));
    expect(options?.credentials).toBe("omit");
    expect(options?.headers).toBeUndefined();
    return new Response(
      calls.length === 1
        ? JSON.stringify({ revision: publication.revision })
        : "article",
      { status: 200 }
    );
  };
  expect(
    await livePublication(
      publication,
      "https://scyolo.github.io/blog/",
      request
    )
  ).toBe("published");
  expect(calls[1]).toContain("/blog/posts/a/");
});
it.each([false, true])("线上仍是旧版本时保持等待（draft=%s）", async draft => {
  expect(
    await livePublication(
      { ...publication, draft },
      "https://scyolo.github.io/blog/",
      async () => new Response(JSON.stringify({ revision: "old" }))
    )
  ).toBe("waiting");
});
it("部署记录成功但文章仍 404 时不会宣布上线", async () => {
  const request: typeof fetch = async url =>
    new Response(
      String(url).includes("build-info")
        ? JSON.stringify({ revision: publication.revision })
        : "",
      { status: String(url).includes("build-info") ? 200 : 404 }
    );
  expect(
    await livePublication(
      publication,
      "https://scyolo.github.io/blog/",
      request
    )
  ).toBe("waiting");
  expect(
    await livePublication(
      { ...publication, draft: true },
      "https://scyolo.github.io/blog/",
      request
    )
  ).toBe("draft");
});
