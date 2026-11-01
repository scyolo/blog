import { serializeArticle, type Article } from "../../src/writer/document";

export const sampleArticle: Article = {
  data: {
    slug: "existing-post",
    title: "已有文章",
    description: "完整的文章信息",
    pubDatetime: "2020-01-02T03:04:05.000Z",
    modDatetime: "2021-02-03T04:05:06.000Z",
    draft: false,
    category: "knowledge",
    tags: ["中文", "Markdown"],
    author: "scyolo",
    demo: true,
    cover: "../../assets/images/quiet-page.svg",
  },
  body: "## 已有文章\n\n需要保留的正文。\n",
};
const hex = (number: number) => number.toString(16).padStart(40, "0");
type Entry = {
  path: string;
  sha: string;
  mode: string;
  type: string;
  size?: number;
};
export function githubFixture() {
  const state = {
    owner: "scyolo",
    push: true,
    private: false,
    revision: hex(1),
    tree: hex(2),
    entries: [
      {
        path: "src/content/posts/original-name.md",
        sha: hex(3),
        mode: "100644",
        type: "blob",
      },
      {
        path: "src/assets/images/quiet-page.svg",
        sha: hex(4),
        mode: "100644",
        type: "blob",
      },
    ] as Entry[],
    blobs: new Map([[hex(3), serializeArticle(sampleArticle)]]),
    calls: [] as {
      path: string;
      method: string;
      body?: Record<string, unknown>;
      authorization: string | null;
    }[],
    failNext: undefined as
      { status: number; headers?: Record<string, string> } | undefined,
    race: false,
    truncated: false,
    run: "building" as
      "queued" | "building" | "failed" | "skipped" | "deployed",
    next: 10,
    pendingTree: undefined as { sha: string; tree: Entry[] } | undefined,
    pendingCommit: undefined as { sha: string; parent: string } | undefined,
  };
  const json = (
    value: unknown,
    status = 200,
    headers: Record<string, string> = {}
  ) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    });
  const request: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url
    );
    if (url.origin !== "https://api.github.com")
      throw new Error("Credentials must never reach another origin");
    const method = init?.method ?? "GET";
    const path = url.pathname;
    const body =
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    state.calls.push({
      path,
      method,
      body,
      authorization: new Headers(init?.headers).get("Authorization"),
    });
    if (state.failNext) {
      const error = state.failNext;
      state.failNext = undefined;
      return json(
        { message: "Do not expose upstream details" },
        error.status,
        error.headers
      );
    }
    if (path === "/user") return json({ login: state.owner });
    if (path === "/repos/scyolo/blog")
      return json({
        private: state.private,
        permissions: { push: state.push },
      });
    if (path.includes("/git/ref/heads/"))
      return json({ object: { sha: state.revision } });
    if (path.includes("/git/commits/") && method === "GET")
      return json({ tree: { sha: state.tree } });
    if (path.includes("/git/trees/") && method === "GET")
      return json({
        sha: state.tree,
        tree: state.entries,
        truncated: state.truncated,
      });
    if (path.includes("/git/blobs/"))
      return json({
        encoding: "base64",
        content: Buffer.from(
          state.blobs.get(path.split("/").at(-1)!) ?? ""
        ).toString("base64"),
      });
    if (path.endsWith("/git/blobs") && method === "POST") {
      const sha = hex(state.next++);
      state.blobs.set(sha, body.content);
      return json({ sha }, 201);
    }
    if (path.endsWith("/git/trees") && method === "POST") {
      const entry = body.tree[0];
      const sha = entry.sha;
      state.pendingTree = {
        sha: hex(state.next++),
        tree: [
          ...state.entries.filter(item => item.path !== entry.path),
          { path: entry.path, sha, mode: entry.mode, type: entry.type },
        ],
      };
      return json(
        {
          sha: state.pendingTree.sha,
          tree: [{ path: "src", mode: "040000", type: "tree", sha: hex(99) }],
        },
        201
      );
    }
    if (path.endsWith("/git/commits") && method === "POST") {
      state.pendingCommit = { sha: hex(state.next++), parent: body.parents[0] };
      return json({ sha: state.pendingCommit.sha }, 201);
    }
    if (path.includes("/git/refs/heads/") && method === "PATCH") {
      if (
        state.race ||
        body.force !== false ||
        state.pendingCommit?.parent !== state.revision
      )
        return json({}, 422);
      state.revision = state.pendingCommit!.sha;
      state.tree = state.pendingTree!.sha;
      state.entries = state.pendingTree!.tree;
      return json({ object: { sha: state.revision } });
    }
    if (path.endsWith("/runs"))
      return json({
        workflow_runs:
          state.run === "queued"
            ? []
            : [
                {
                  id: 1234,
                  status:
                    state.run === "building" ? "in_progress" : "completed",
                  conclusion: state.run === "failed" ? "failure" : "success",
                  html_url: "https://untrusted.invalid/do-not-use",
                },
              ],
      });
    if (path.endsWith("/jobs"))
      return json({
        jobs: [
          { name: "verify", conclusion: "success" },
          {
            name: "deploy",
            conclusion: state.run === "skipped" ? "skipped" : "success",
          },
        ],
      });
    return json({ message: "unhandled mock route" }, 404);
  };
  return { state, request };
}
