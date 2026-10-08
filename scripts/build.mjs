import { cleanBuildOutputs } from "./lib/build-cleanup.mjs";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { readSiteContent } from "../src/lib/content-files.ts";
import { isVisible } from "../src/lib/publication.ts";
import { normalizeSiteUrl } from "../src/lib/site-url.ts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
await cleanBuildOutputs(root);
const env = {
  ...process.env,
  ASTRO_TELEMETRY_DISABLED: "1",
  BUILD_TIMESTAMP: process.env.BUILD_TIMESTAMP ?? new Date().toISOString(),
};
async function runBin(name, args) {
  const manifestPath = resolve(root, "node_modules", name, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const bin =
    typeof manifest.bin === "string" ? manifest.bin : manifest.bin[name];
  if (!bin) throw new Error("Missing executable for " + name);
  await new Promise((done, reject) => {
    const child = spawn(
      process.execPath,
      [resolve(dirname(manifestPath), bin), ...args],
      { cwd: root, env, stdio: "inherit", shell: false }
    );
    child.once("error", reject);
    child.once("exit", code =>
      code === 0
        ? done()
        : reject(new Error(name + " exited with code " + code))
    );
  });
}
await runBin("astro", ["check"]);
await runBin("astro", ["build"]);
const content = await readSiteContent(root);
const published = content.posts.filter(post =>
  isVisible(post.data, Date.parse(env.BUILD_TIMESTAMP))
);
if (published.length) {
  await runBin("pagefind", [
    "--site",
    "dist",
    "--root-selector",
    "[data-pagefind-body]",
  ]);
} else {
  // Pagefind exits nonzero with no documents; an empty site must not index navigation.
  const pagefind = JSON.parse(
    await readFile(resolve(root, "node_modules/pagefind/package.json"), "utf8")
  );
  await mkdir(resolve(root, "dist/pagefind"), { recursive: true });
  await writeFile(
    resolve(root, "dist/pagefind/pagefind-entry.json"),
    JSON.stringify({ version: pagefind.version, languages: {}, empty: true }) +
      "\n"
  );
  process.stdout.write(
    "No published articles: search disabled; empty index descriptor written.\n"
  );
}
await writeFile(
  resolve(root, "dist/build-info.json"),
  JSON.stringify({
    version: 1,
    revision: process.env.GITHUB_SHA ?? "local",
    builtAt: env.BUILD_TIMESTAMP,
    siteUrl: normalizeSiteUrl(process.env.SITE_URL),
  }) + "\n"
);
