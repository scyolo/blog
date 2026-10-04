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
} from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
let sandbox;
let controlPassed = false;
const base =
  "slug: contract-public\ntitle: 公开契约样文\ndescription: 实际构建验收\npubDatetime: 2026-10-01T10:00:00+08:00\ncategory: knowledge\n";
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
  sandbox = await mkdtemp(resolve(root, ".cache/build-contract-"));
  for (const name of [
    "src",
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
      .replace("2026-10-01", "2099-10-01") + "draft: false\n",
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
  controlPassed = true;
  const output = await texts(join(sandbox, "dist"));
  assert.doesNotMatch(output, /UNPUBLISHED_CANARY_(DRAFT|FUTURE)/);
  for (const slug of ["contract-draft", "contract-future"])
    await assert.rejects(
      readFile(join(sandbox, "dist/posts", slug, "index.html")),
      { code: "ENOENT" }
    );
});
test("移动 Markdown 文件后，同一 slug 的真实网址保持不变", async context => {
  if (!controlPassed) return context.skip("Valid control build did not pass");
  await mkdir(join(sandbox, "src/content/posts/moved"), { recursive: true });
  await rename(
    join(sandbox, "src/content/posts/contract-public.md"),
    join(sandbox, "src/content/posts/moved/renamed.md")
  );
  const result = build();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(
    await readFile(
      join(sandbox, "dist/posts/contract-public/index.html"),
      "utf8"
    ),
    /BUILD_CONTRACT_PUBLIC/
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
