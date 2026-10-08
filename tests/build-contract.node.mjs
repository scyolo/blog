import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import {
  cp,
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  rename,
  lstat,
  realpath,
} from "node:fs/promises";
import { resolve, join, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
const root = fileURLToPath(new URL("../", import.meta.url));
let sandbox;
let controlPassed = false;
const base =
  "slug: contract-public\ntitle: 公开契约样文\ndescription: 实际构建验收\npubDatetime: 2020-10-01T10:00:00+08:00\ncategory: knowledge\n";
const writePost = async (name, metadata, body = "BUILD_CONTRACT_PUBLIC") => {
  const file = join(sandbox, "src/content/posts", name);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, "---\n" + metadata + "---\n" + body);
};
const build = () =>
  spawnSync(process.execPath, [join(sandbox, "scripts/build.mjs")], {
    cwd: sandbox,
    env: {
      ...process.env,
      BUILD_TIMESTAMP: "2026-10-03T04:00:00Z",
      ASTRO_TELEMETRY_DISABLED: "1",
    },
    encoding: "utf8",
    maxBuffer: 5e6,
    timeout: 180000,
  });
before(async () => {
  await mkdir(resolve(root, ".cache"), { recursive: true });
  sandbox = await mkdtemp(resolve(root, ".cache/build-contract-"));
  for (const name of [
    "src",
    "templates",
    "tests/e2e",
    "playwright.config.ts",
    "public",
    "scripts",
    "package.json",
    "astro.config.ts",
    "astro-paper.config.ts",
    "tsconfig.json",
    "pnpm-workspace.yaml",
    ".gitignore",
    "pnpm-lock.yaml",
    ".npmrc",
  ])
    await cp(join(root, name), join(sandbox, name), { recursive: true });
  if (!process.env.npm_execpath)
    throw new Error("Run with pnpm test:build-contract");
  const installed = spawnSync(
    process.execPath,
    [process.env.npm_execpath, "install", "--frozen-lockfile", "--offline"],
    {
      cwd: sandbox,
      env: process.env,
      encoding: "utf8",
      maxBuffer: 5e6,
      timeout: 180000,
    }
  );
  assert.equal(installed.status, 0, installed.stdout + installed.stderr);
  await removeContentFolder("posts");
  await removeContentFolder("projects");
  await cp(
    join(root, "tests/fixtures/posts"),
    join(sandbox, "src/content/posts"),
    { recursive: true }
  );
  await cp(
    join(root, "tests/fixtures/images"),
    join(sandbox, "src/assets/images"),
    { recursive: true }
  );
  await cp(
    join(root, "tests/fixtures/projects"),
    join(sandbox, "src/content/projects"),
    { recursive: true }
  );
  await writePost("contract-public.md", base + "draft: false\n");
  await writePost(
    "contract-draft.md",
    base.replace("contract-public", "contract-draft") + "draft: true\n",
    "UNPUBLISHED_CANARY_DRAFT"
  );
  await writePost(
    "contract-future.md",
    base
      .replace("contract-public", "contract-future")
      .replace("2020-10-01", "2099-10-01") + "draft: false\n",
    "UNPUBLISHED_CANARY_FUTURE"
  );
  process.stdout.write("SNAPSHOT_READY\n");
});
after(async () => {
  if (
    !sandbox ||
    !resolve(sandbox).startsWith(resolve(root, ".cache/build-contract-"))
  )
    throw new Error("Unsafe fixture cleanup");
  if ((await lstat(sandbox)).isSymbolicLink())
    throw new Error("Unsafe fixture root");
  await rm(sandbox, { force: true, recursive: true });
});
async function texts(dir) {
  let output = "";
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) output += await texts(path);
    else if (/\.(html|js|json|xml|txt)$/.test(entry.name))
      output += await readFile(path, "utf8");
  }
  return output;
}
test("真实构建公开有效文章，但不会输出草稿或未来文章", async () => {
  const result = build();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(
    await readFile(
      join(sandbox, "dist/posts/contract-public/index.html"),
      "utf8"
    ),
    /BUILD_CONTRACT_PUBLIC/
  );
  await verifyBuiltArtifact();
  controlPassed = true;
  const output = await texts(join(sandbox, "dist"));
  assert.doesNotMatch(output, /UNPUBLISHED_CANARY_(DRAFT|FUTURE)/);
  for (const slug of ["contract-draft", "contract-future"])
    await assert.rejects(
      readFile(join(sandbox, "dist/posts", slug, "index.html")),
      { code: "ENOENT" }
    );
});
test("独立样文环境完整验证技术阅读，不强迫正式站点保留样文", async context => {
  if (!controlPassed) return context.skip("Valid control build did not pass");
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, "test:e2e"],
    {
      cwd: sandbox,
      env: { ...process.env, E2E_MODE: "fixture", E2E_PORT: "4324" },
      encoding: "utf8",
      maxBuffer: 5e6,
      timeout: 120000,
    }
  );
  if (result.status !== 0) {
    const destination = join(root, "output/playwright/fixture-failure");
    await mkdir(destination, { recursive: true });
    await cp(join(sandbox, "output/playwright"), destination, {
      recursive: true,
    }).catch(() => {});
  }
  assert.equal(result.status, 0, result.stdout + result.stderr);
  await mkdir(join(root, "output/playwright/review"), { recursive: true });
  for (const file of [
    "home-desktop.png",
    "home-mobile.png",
    "article-mobile-diagram.png",
  ]) {
    await cp(
      join(sandbox, "output/playwright", file),
      join(root, "output/playwright/review", file)
    );
  }
  process.stdout.write(
    "Fixture reader E2E: " +
      result.stdout.match(/\d+ passed[^\r\n]*/)?.[0] +
      "\n"
  );
});

test("移动 Markdown 文件后，同一 slug 的真实网址保持不变", async context => {
  if (!controlPassed) return context.skip("Valid control build did not pass");
  await mkdir(join(sandbox, "src/content/posts/moved"), { recursive: true });
  await rename(
    join(sandbox, "src/content/posts/contract-public.md"),
    join(sandbox, "src/content/posts/moved/renamed.md")
  );
  const moved = join(sandbox, "src/content/posts/moved/renamed.md");
  await writeFile(
    moved,
    (await readFile(moved, "utf8")).replace(
      "公开契约样文",
      "修改标题后仍然稳定"
    )
  );
  const result = build();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  await verifyBuiltArtifact();
  assert.match(
    await readFile(
      join(sandbox, "dist/posts/contract-public/index.html"),
      "utf8"
    ),
    /修改标题后仍然稳定/
  );
});
test("缺失 draft 必须让实际构建失败，而不是静默隐藏", async context => {
  if (!controlPassed) return context.skip("Valid control build did not pass");
  await writePost(
    "invalid-missing-draft.md",
    base.replace("contract-public", "invalid-contract")
  );
  const result = build();
  await rm(join(sandbox, "src/content/posts/invalid-missing-draft.md"));
  assert.ok(
    Number.isInteger(result.status) && result.status !== 0,
    "Missing draft incorrectly passed the production build or infrastructure failed: " +
      result.error
  );
  assert.match(result.stdout + result.stderr, /invalid-missing-draft|draft/);
});
test("两个相同内容的重复 slug 必须让实际构建失败", async context => {
  if (!controlPassed) return context.skip("Valid control build did not pass");
  await writePost("invalid-duplicate.md", base + "draft: false\n");
  const result = build();
  await rm(join(sandbox, "src/content/posts/invalid-duplicate.md"));
  assert.ok(
    Number.isInteger(result.status) && result.status !== 0,
    "Duplicate slug incorrectly passed the production build or infrastructure failed: " +
      result.error
  );
  assert.match(result.stdout + result.stderr, /重复|duplicate|Duplicate/);
});

async function verifyBuiltArtifact() {
  const result = spawnSync(
    process.execPath,
    [join(sandbox, "scripts/verify-artifact.mjs")],
    {
      cwd: sandbox,
      env: process.env,
      encoding: "utf8",
      timeout: 30000,
    }
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

test("本地开发可以预览草稿和未来文章，而生产契约仍不公开", async context => {
  if (!controlPassed) return context.skip("Valid control build did not pass");
  const port = await new Promise(done => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const value = server.address().port;
      server.close(() => done(value));
    });
  });
  const pkg = JSON.parse(
    await readFile(join(sandbox, "node_modules/astro/package.json"), "utf8")
  );
  const server = spawn(
    process.execPath,
    [
      join(sandbox, "node_modules/astro", pkg.bin.astro),
      "dev",
      "--ignore-lock",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: sandbox, env: process.env, stdio: ["ignore", "pipe", "pipe"] }
  );
  let log = "";
  server.stdout.on("data", value => {
    log = (log + value).slice(-12000);
  });
  server.stderr.on("data", value => {
    log = (log + value).slice(-12000);
  });
  try {
    let response;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        response = await fetch(
          `http://127.0.0.1:${port}/posts/contract-draft/`,
          { signal: AbortSignal.timeout(2000) }
        );
        if (response.status === 200) break;
      } catch {}
      if (server.exitCode !== null) break;
      await delay(250);
    }
    assert.equal(response?.status, 200, "Draft preview failed: " + log);
    assert.match(await response.text(), /UNPUBLISHED_CANARY_DRAFT/);
    const future = await fetch(
      `http://127.0.0.1:${port}/posts/contract-future/`,
      { signal: AbortSignal.timeout(15000) }
    );
    assert.equal(future.status, 200);
    assert.match(await future.text(), /UNPUBLISHED_CANARY_FUTURE/);
  } finally {
    if (server.exitCode === null) {
      server.kill();
      await new Promise(done => server.once("close", done));
    }
  }
});

test("普通下架清除正文、RSS、索引，并删除前次构建的遗留产物", async context => {
  if (!controlPassed) return context.skip("Valid control build did not pass");
  const moved = join(sandbox, "src/content/posts/moved/renamed.md");
  await writeFile(
    moved,
    (await readFile(moved, "utf8")).replace("draft: false", "draft: true")
  );
  await mkdir(join(sandbox, "dist"), { recursive: true });
  await writeFile(join(sandbox, "dist/stale.html"), "STALE_ARTIFACT");
  const result = build();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  await verifyBuiltArtifact();
  await assert.rejects(
    readFile(join(sandbox, "dist/posts/contract-public/index.html")),
    { code: "ENOENT" }
  );
  await assert.rejects(readFile(join(sandbox, "dist/stale.html")), {
    code: "ENOENT",
  });
});

async function removeContentFolder(name) {
  const path = resolve(sandbox, "src/content", name);
  const stat = await lstat(path).catch(error => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!stat) return;
  assert.ok(!stat.isSymbolicLink());
  assert.ok((await realpath(path)).startsWith((await realpath(sandbox)) + sep));
  await rm(path, { recursive: true, force: true });
}

test("空文章和空项目真实构建可用，搜索不会退回索引整站导航", async context => {
  if (!controlPassed) return context.skip("Valid control build did not pass");
  await removeContentFolder("posts");
  await removeContentFolder("projects");
  const result = build();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  await verifyBuiltArtifact();
  assert.match(
    await readFile(join(sandbox, "dist/index.html"), "utf8"),
    /第一篇文章/
  );
  assert.match(
    await readFile(join(sandbox, "dist/projects/index.html"), "utf8"),
    /项目还在整理中/
  );
  const browser = spawnSync(
    process.execPath,
    [process.env.npm_execpath, "test:e2e"],
    {
      cwd: sandbox,
      env: { ...process.env, E2E_MODE: "production", E2E_PORT: "4324" },
      encoding: "utf8",
      maxBuffer: 5e6,
      timeout: 120000,
    }
  );
  assert.equal(browser.status, 0, browser.stdout + browser.stderr);
});

test("从默认草稿模板发布七篇文章，真实分页、标签和栏目链接均有效", async context => {
  if (!controlPassed) return context.skip("Valid control build did not pass");
  const template = await readFile(join(sandbox, "templates/post.md"), "utf8");
  assert.match(template, /draft: true/);
  for (let index = 1; index <= 7; index++) {
    const name = `template-note-${index}`;
    const source = template
      .replace("slug: new-post", "slug: " + name)
      .replace("draft: true", "draft: false")
      .replace('"2026-10-03T09:00:00+08:00"', '"2020-01-01T00:00:00Z"')
      .replace("tags: []", "tags: [分页]");
    await mkdir(join(sandbox, "src/content/posts"), { recursive: true });
    await writeFile(join(sandbox, "src/content/posts", name + ".md"), source);
  }
  const result = build();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  await verifyBuiltArtifact();
  assert.match(
    await readFile(join(sandbox, "dist/posts/2/index.html"), "utf8"),
    /template-note/
  );
  assert.match(
    await readFile(
      join(sandbox, "dist/categories/knowledge/2/index.html"),
      "utf8"
    ),
    /template-note/
  );
});
