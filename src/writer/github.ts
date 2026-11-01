import {
  parseMarkdownFile,
  serializeArticle,
  validateArticle,
  WriterError,
  MAX_DOCUMENT_BYTES,
  type Article,
} from "./document.ts";
import { imageRepositoryPath, inspectMarkdown } from "./markdown.ts";

type Requester = typeof fetch;
interface TreeEntry {
  path: string;
  sha: string;
  mode: string;
  type: string;
  size?: number;
}
interface GitTree {
  sha: string;
  tree: TreeEntry[];
  truncated?: boolean;
}
export interface RepositoryArticle extends Article {
  path: string;
  sha: string;
}
export interface Publication {
  revision: string;
  path: string;
  sha: string;
  slug: string;
  draft: boolean;
  future: boolean;
  changed: boolean;
}

/** The access token exists only in this instance, never in storage, URLs or error text. */
export class GitHubWriter {
  #token = "";
  #cache = new Map<string, Article>();
  #request: Requester;
  repository: string;
  branch: string;
  workflow: string;

  constructor(options: {
    repository: string;
    branch: string;
    workflow: string;
    request?: Requester;
  }) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(options.repository))
      throw new Error("Invalid repository");
    if (!/^[\w./-]+$/.test(options.branch) || options.branch.includes(".."))
      throw new Error("Invalid branch");
    this.repository = options.repository;
    this.branch = options.branch;
    this.workflow = options.workflow;
    this.#request = options.request ?? globalThis.fetch.bind(globalThis);
  }

  get connected() {
    return Boolean(this.#token);
  }

  disconnect() {
    this.#token = "";
    this.#cache.clear();
  }

  async #api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    if (!this.#token) throw new WriterError("请先连接 GitHub。", "auth");
    let response: Response;
    try {
      response = await this.#request(`https://api.github.com${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.#token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
        redirect: "error",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
    } catch {
      throw new WriterError(
        "无法连接 GitHub，请检查网络后重试；当前草稿仍然保留。",
        "network"
      );
    }
    if (!response.ok) {
      if (response.status === 401) {
        this.disconnect();
        throw new WriterError("GitHub 授权已失效，请重新连接。", "auth");
      }
      if (
        response.status === 429 ||
        response.headers.get("x-ratelimit-remaining") === "0"
      )
        throw new WriterError(
          "GitHub 请求次数已达上限，请稍后重试。",
          "rate-limit"
        );
      if (response.status === 403)
        throw new WriterError(
          "授权不足：请仅为这个仓库开放 Contents 读写和 Actions 只读权限。",
          "permission"
        );
      if (response.status === 409 || response.status === 422)
        throw new WriterError(
          "仓库已发生变化，本次内容没有覆盖远端版本。请重新载入并合并修改。",
          "conflict"
        );
      if (response.status === 404)
        throw new WriterError(
          "找不到目标仓库、分支或文件，请检查授权范围。",
          "missing"
        );
      throw new WriterError(
        `GitHub 暂时无法完成请求（${response.status}），请稍后重试。`,
        "remote"
      );
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new WriterError(
        "GitHub 返回了无法识别的响应，请稍后重试。",
        "remote"
      );
    }
  }

  async connect(token: string) {
    this.disconnect();
    this.#token = token.trim();
    try {
      const user = await this.#api<{ login: string }>("/user");
      if (
        user.login.toLowerCase() !== this.repository.split("/")[0].toLowerCase()
      )
        throw new WriterError("请使用博客所有者的 GitHub 账户连接。", "owner");
      const repo = await this.#api<{
        private: boolean;
        permissions?: { push?: boolean };
      }>(`/repos/${this.repository}`);
      if (!repo.permissions?.push)
        throw new WriterError("当前账户没有该仓库的写入权限。", "permission");
      return { login: user.login, private: repo.private };
    } catch (error) {
      this.disconnect();
      throw error;
    }
  }

  async #snapshot() {
    const prefix = `/repos/${this.repository}`;
    const ref = await this.#api<{ object: { sha: string } }>(
      `${prefix}/git/ref/heads/${this.branch}`
    );
    const commit = await this.#api<{ tree: { sha: string } }>(
      `${prefix}/git/commits/${ref.object.sha}`
    );
    const tree = await this.#api<GitTree>(
      `${prefix}/git/trees/${commit.tree.sha}?recursive=1`
    );
    if (tree.truncated)
      throw new WriterError(
        "仓库文件列表不完整，已停止写入以避免遗漏冲突。",
        "limit"
      );
    return { revision: ref.object.sha, tree };
  }

  async #article(entry: TreeEntry): Promise<RepositoryArticle> {
    if (entry.type !== "blob" || !["100644", "100755"].includes(entry.mode))
      throw new WriterError("文章不能是符号链接或特殊文件。");
    if ((entry.size ?? 0) > MAX_DOCUMENT_BYTES)
      throw new WriterError(
        `${entry.path} 超过写作台的 240 KB 限制。`,
        "limit"
      );
    let article = this.#cache.get(entry.sha);
    if (!article) {
      const blob = await this.#api<{ content: string; encoding: string }>(
        `/repos/${this.repository}/git/blobs/${entry.sha}`
      );
      if (blob.encoding !== "base64")
        throw new WriterError("文章编码不受支持。");
      let source: string;
      try {
        const bytes = Uint8Array.from(
          atob(blob.content.replace(/\s/g, "")),
          character => character.charCodeAt(0)
        );
        source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw new WriterError("文章不是有效的 UTF-8 Markdown 文件。");
      }
      const parsed = parseMarkdownFile(source);
      article = validateArticle(parsed.data, parsed.body);
      this.#cache.set(entry.sha, article);
    }
    return {
      ...article,
      data: { ...article.data, tags: [...article.data.tags] },
      path: entry.path,
      sha: entry.sha,
    };
  }

  async #articles(tree: GitTree) {
    const entries = tree.tree.filter(
      entry =>
        entry.path.startsWith("src/content/posts/") &&
        entry.path.endsWith(".md")
    );
    const result: RepositoryArticle[] = [];
    for (let index = 0; index < entries.length; index += 6)
      result.push(
        ...(await Promise.all(
          entries.slice(index, index + 6).map(entry => this.#article(entry))
        ))
      );
    return result.sort((a, b) =>
      b.data.pubDatetime.localeCompare(a.data.pubDatetime)
    );
  }

  async list(): Promise<RepositoryArticle[]> {
    const snapshot = await this.#snapshot();
    return this.#articles(snapshot.tree);
  }

  async save(
    input: Article,
    previous?: { path: string; sha: string }
  ): Promise<Publication> {
    const article = validateArticle(input.data, input.body);
    const snapshot = await this.#snapshot();
    const articles = await this.#articles(snapshot.tree);
    const current = previous
      ? articles.find(item => item.path === previous.path)
      : undefined;
    if (previous && (!current || current.sha !== previous.sha))
      throw new WriterError(
        "这篇文章已在其他位置更新，请重新载入后合并；当前草稿会保留。",
        "conflict"
      );
    if (current && current.data.slug !== article.data.slug)
      throw new WriterError(
        "已有文章的永久链接不能直接更改；请创建新文章。",
        "conflict"
      );
    const path = current?.path ?? `src/content/posts/${article.data.slug}.md`;
    if (
      articles.some(
        item =>
          item.path !== current?.path &&
          (item.data.slug === article.data.slug || item.path === path)
      )
    )
      throw new WriterError(
        "该文章路径已经存在，请载入原文章进行编辑，或使用新的路径。",
        "conflict"
      );

    const inspected = inspectMarkdown(article.body);
    const imageRefs = [
      ...inspected.images,
      ...(article.data.cover ? [article.data.cover] : []),
    ];
    for (const image of imageRefs) {
      const imagePath = imageRepositoryPath(image, path);
      if (
        !snapshot.tree.tree.some(
          entry =>
            entry.path === imagePath &&
            entry.type === "blob" &&
            ["100644", "100755"].includes(entry.mode)
        )
      )
        throw new WriterError(
          `找不到图片 ${image}，请先将素材放入仓库的 src/assets 目录。`
        );
    }
    for (const href of inspected.links) {
      const linked = /^\/posts\/([a-z][a-z0-9-]*)\/?(?:#.*)?$/.exec(href);
      if (
        linked &&
        linked[1] !== article.data.slug &&
        !articles.some(
          item =>
            item.data.slug === linked[1] &&
            !item.data.draft &&
            Date.parse(item.data.pubDatetime) <= Date.now()
        )
      )
        throw new WriterError(
          `链接目标 ${linked[1]} 尚未发布，请先发布目标文章。`
        );
    }
    const content = serializeArticle(article);
    const unchanged = current && serializeArticle(current) === content;
    const publication = {
      path,
      slug: article.data.slug,
      draft: article.data.draft,
      future: Date.parse(article.data.pubDatetime) > Date.now(),
    };
    if (unchanged)
      return {
        ...publication,
        revision: snapshot.revision,
        sha: current.sha,
        changed: false,
      };

    const prefix = `/repos/${this.repository}`;
    // Tree creation returns top-level entries only. Create the blob first so its
    // SHA is known before the commit becomes visible on the branch.
    const blob = await this.#api<{ sha: string }>(
      `${prefix}/git/blobs`,
      "POST",
      {
        content,
        encoding: "utf-8",
      }
    );
    const tree = await this.#api<GitTree>(`${prefix}/git/trees`, "POST", {
      base_tree: snapshot.tree.sha,
      tree: [{ path, mode: "100644", type: "blob", sha: blob.sha }],
    });
    const commit = await this.#api<{ sha: string }>(
      `${prefix}/git/commits`,
      "POST",
      {
        message: `content: ${article.data.draft ? "save draft" : "publish"} ${article.data.slug}`,
        tree: tree.sha,
        parents: [snapshot.revision],
      }
    );
    // A non-fast-forward update fails if ANY commit arrived since the snapshot.
    // Never force-push or silently retry an update from a stale editor.
    await this.#api(`${prefix}/git/refs/heads/${this.branch}`, "PATCH", {
      sha: commit.sha,
      force: false,
    });
    const sha = blob.sha;
    this.#cache.set(sha, article);
    return { ...publication, revision: commit.sha, sha, changed: true };
  }

  async deployment(revision: string): Promise<{
    state: "queued" | "building" | "failed" | "skipped" | "deployed";
    url?: string;
  }> {
    if (!/^[a-f0-9]{40}$/.test(revision))
      throw new WriterError("无效的提交版本。");
    const prefix = `/repos/${this.repository}/actions`;
    const runs = await this.#api<{
      workflow_runs: {
        id: number;
        status: string;
        conclusion: string | null;
        html_url: string;
      }[];
    }>(
      `${prefix}/workflows/${this.workflow}/runs?head_sha=${revision}&per_page=5`
    );
    const run = runs.workflow_runs[0];
    if (!run) return { state: "queued" };
    const url = `https://github.com/${this.repository}/actions/runs/${run.id}`;
    if (run.status !== "completed") return { state: "building", url };
    if (run.conclusion !== "success") return { state: "failed", url };
    const jobs = await this.#api<{
      jobs: { name: string; conclusion: string | null }[];
    }>(`${prefix}/runs/${run.id}/jobs?per_page=100`);
    const deploy = jobs.jobs.find(job => job.name === "deploy");
    return {
      state: deploy?.conclusion === "success" ? "deployed" : "skipped",
      url,
    };
  }
}
