import lighthouse from "lighthouse";
import { readdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
const freePort = () =>
  new Promise((done, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => done(port));
    });
  });
const port = await freePort();
const debugPort = await freePort();
const pkg = JSON.parse(
  await readFile("node_modules/astro/package.json", "utf8")
);
const { siteUrl } = JSON.parse(await readFile("dist/build-info.json", "utf8"));
const server = spawn(
  process.execPath,
  [
    resolve("node_modules/astro", pkg.bin.astro),
    "preview",
    "--ignore-lock",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, SITE_URL: siteUrl, ASTRO_TELEMETRY_DISABLED: "1" },
  }
);
let serverLog = "";
server.stdout.on("data", bytes => {
  serverLog = (serverLog + bytes).slice(-6000);
});
server.stderr.on("data", bytes => {
  serverLog = (serverLog + bytes).slice(-6000);
});
const origin = "http://127.0.0.1:" + port;
const baseURL = origin + new URL(siteUrl).pathname;
const previewUrl = path => new URL(path.replace(/^\/+/, ""), baseURL).href;
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(baseURL, { signal: AbortSignal.timeout(1000) })).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (server.exitCode !== null) break;
    await delay(250);
  }
  if (!ready)
    throw new Error("Performance preview did not start: " + serverLog);
  browser = await chromium.launch({
    headless: true,
    args: ["--remote-debugging-port=" + debugPort],
  });
  await mkdir(".cache/performance", { recursive: true });
  const samples = [];
  const entries = await readdir("dist/posts", { withFileTypes: true });
  const slugs = entries
    .filter(
      entry => entry.isDirectory() && /^[a-z][a-z0-9-]*$/.test(entry.name)
    )
    .map(entry => entry.name);
  const preferred = ["technical-writing", "static-blog-architecture"].filter(
    slug => slugs.includes(slug)
  );
  const sampled = [...new Set([...preferred, ...slugs.sort()])].slice(0, 2);
  const paths = ["/", ...sampled.map(slug => "/posts/" + slug + "/")];
  const runs = 3;
  for (const path of paths)
    for (let run = 1; run <= runs; run++) {
      const result = await lighthouse(previewUrl(path), {
        port: debugPort,
        logLevel: "error",
        output: "json",
        onlyCategories: ["performance", "accessibility", "seo"],
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 360,
          height: 800,
          deviceScaleFactor: 1,
          disabled: false,
        },
        throttlingMethod: "simulate",
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
          requestLatencyMs: 562.5,
          downloadThroughputKbps: 1474.56,
          uploadThroughputKbps: 675,
        },
      });
      if (!result || result.lhr.runtimeError)
        throw new Error(
          "Lighthouse runtime error: " +
            JSON.stringify(result?.lhr.runtimeError)
        );
      const { lhr } = result;
      const sample = {
        path,
        run,
        performance: Math.round(lhr.categories.performance.score * 100),
        accessibility: Math.round(lhr.categories.accessibility.score * 100),
        seo: Math.round(lhr.categories.seo.score * 100),
        cls: lhr.audits["cumulative-layout-shift"].numericValue,
      };
      samples.push(sample);
      await writeFile(
        `.cache/performance/${path.replaceAll("/", "_")}-${run}.json`,
        JSON.stringify(lhr)
      );
      process.stdout.write(JSON.stringify(sample) + "\n");
    }
  const median = values =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const summary = paths.map(path => {
    const group = samples.filter(sample => sample.path === path);
    const scores = Object.fromEntries(
      ["performance", "accessibility", "seo", "cls"].map(key => [
        key,
        median(group.map(sample => sample[key])),
      ])
    );
    return {
      path,
      ...scores,
      targetsMet:
        scores.performance >= 90 &&
        scores.accessibility >= 95 &&
        scores.seo >= 95 &&
        scores.cls <= 0.1,
    };
  });
  const report = {
    measuredAt: new Date().toISOString(),
    browser: browser.version(),
    node: process.version,
    viewport: "360x800@1",
    cpuSlowdown: 4,
    network: "simulated mobile 150ms / 1638.4 Kbps",
    runsPerPage: runs,
    summary,
    samples,
  };
  await writeFile(
    ".cache/performance/summary.json",
    JSON.stringify(report, null, 2) + "\n"
  );
  const text =
    "\n### Lighthouse (three mobile runs per page; median)\n\n" +
    summary
      .map(
        row =>
          `- ${row.path}: performance ${row.performance}, a11y ${row.accessibility}, SEO ${row.seo}, CLS ${row.cls}; ${row.targetsMet ? "targets met" : "follow-up required"}`
      )
      .join("\n") +
    "\n";
  process.stdout.write(text);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, text);
} finally {
  await browser?.close();
  if (server.exitCode === null) server.kill();
}
