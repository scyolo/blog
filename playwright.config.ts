import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
const astroPackage = JSON.parse(
  readFileSync(
    new URL("./node_modules/astro/package.json", import.meta.url),
    "utf8"
  )
);
const port = Number(process.env.E2E_PORT ?? 4322);
const baseURL = "http://127.0.0.1:" + port;
const astroBin = "./node_modules/astro/" + astroPackage.bin.astro;
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch:
    process.env.E2E_MODE === "fixture"
      ? "reading.spec.ts"
      : "production.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 12000 },
  outputDir: "output/playwright/results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/playwright/report", open: "never" }],
  ],
  use: {
    baseURL,
    headless: true,
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  webServer: {
    command:
      "node " +
      JSON.stringify(astroBin) +
      " preview --ignore-lock --host 127.0.0.1 --port " +
      port,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
