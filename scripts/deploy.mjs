import { readFile, appendFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { assertManifest, verifyArtifact } from "./lib/artifact.mjs";
import { readSiteContent } from "../src/lib/content-files.ts";
import {
  deploymentConfig,
  releaseArtifact,
  fetchJson,
  smokeDeployment,
} from "./lib/deployment.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const config = deploymentConfig(process.env);
const result = await releaseArtifact(config, {
  verify: async () => {
    const info = JSON.parse(
      await readFile(resolve(root, "dist/build-info.json"), "utf8")
    );
    await assertManifest(
      resolve(root, "dist"),
      JSON.parse(
        await readFile(resolve(root, ".cache/artifact-manifest.json"), "utf8")
      )
    );
    const content = await readSiteContent(root);
    await verifyArtifact({
      directory: resolve(root, "dist"),
      posts: content.posts,
      siteUrl: config.siteUrl,
    });
    return info;
  },
  project: async () =>
    (
      await fetchJson(
        `https://api.cloudflare.com/client/v4/accounts/${config.account}/pages/projects/${config.project}`,
        {
          headers: {
            Authorization: "Bearer " + process.env.CLOUDFLARE_API_TOKEN,
          },
        }
      )
    ).result,
  mainRevision: async () =>
    (
      await fetchJson(
        `https://api.github.com/repos/${config.repository}/commits/main`,
        {
          headers: {
            Authorization: "Bearer " + process.env.GH_TOKEN,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      )
    ).sha,
  upload: async () => {
    const manifestPath = resolve(root, "node_modules/wrangler/package.json");
    const pkg = JSON.parse(await readFile(manifestPath, "utf8"));
    const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.wrangler;
    await new Promise((done, reject) => {
      const child = spawn(
        process.execPath,
        [
          resolve(dirname(manifestPath), bin),
          "pages",
          "deploy",
          "dist",
          "--project-name",
          config.project,
          "--branch",
          "main",
          "--commit-hash",
          config.revision,
          "--commit-dirty=false",
          "--no-bundle",
        ],
        {
          cwd: root,
          env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
          stdio: "inherit",
          shell: false,
        }
      );
      child.once("error", reject);
      child.once("exit", code =>
        code === 0
          ? done()
          : reject(new Error("Wrangler upload failed: " + code))
      );
    });
  },
  smoke: async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        await smokeDeployment(config.siteUrl, config.revision);
        return;
      } catch (error) {
        if (attempt === 5) throw error;
        await delay(5000);
      }
    }
  },
});
process.stdout.write(JSON.stringify(result) + "\n");
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    result.deployed
      ? `\nDeployed and smoke-tested **${config.revision}** to ${config.siteUrl}\n`
      : `\nNot deployed: ${result.reason} (${config.revision}).\n`
  );
