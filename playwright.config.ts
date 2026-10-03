import { readFileSync } from "node:fs";
import { defineConfig, devices } from '@playwright/test';
const astroPackage = JSON.parse(readFileSync(new URL("./node_modules/astro/package.json", import.meta.url), "utf8"));
const astroBin = "./node_modules/astro/" + astroPackage.bin.astro;
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, retries: 0,
  timeout: 45000, expect: { timeout: 12000 },
  outputDir: 'output/playwright/results',
  reporter: [['list'], ['html', { outputFolder: 'output/playwright/report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4322', headless: true, colorScheme: 'light', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: { command: 'node ' + JSON.stringify(astroBin) + ' preview --host 127.0.0.1 --port 4322', url: 'http://127.0.0.1:4322', reuseExistingServer: false, timeout: 30000 },
});
