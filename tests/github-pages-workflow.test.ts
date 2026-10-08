import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
const load = () =>
  parse(
    readFileSync(
      new URL("../.github/workflows/github-pages.yml", import.meta.url),
      "utf8"
    )
  );

it("只有专用分支可触发 Pages 部署；不修改 main 的发布入口", () => {
  const workflow = load();
  expect(workflow.on.push.branches).toEqual(["codex/github-pages"]);
  expect(workflow.permissions).toEqual({ contents: "read" });
  expect(workflow.jobs.deploy.needs).toBe("verify");
  expect(workflow.jobs.deploy.if).toContain("refs/heads/codex/github-pages");
  expect(workflow.jobs.deploy.if).toContain("!= 'pull_request'");
  expect(workflow.jobs.deploy.environment.name).toBe("github-pages");
  expect(workflow.jobs.deploy.permissions).toEqual({
    contents: "read",
    pages: "write",
    "id-token": "write",
  });
  expect(workflow.jobs.deploy.concurrency["cancel-in-progress"]).toBe(false);
  expect(JSON.stringify(workflow.jobs.verify)).not.toContain("secrets.");
  expect(JSON.stringify(workflow)).not.toContain("CLOUDFLARE");
  for (const job of Object.values(workflow.jobs) as {
    steps: { uses?: string; run?: string }[];
  }[])
    for (const step of job.steps)
      if (step.uses) expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
});

it("Pages 只上传一次完整验证后的 dist；部署不重新构建", () => {
  const workflow = load();
  const steps = workflow.jobs.verify.steps;
  const commands = steps
    .map((step: { run?: string }) => step.run)
    .filter(Boolean);
  expect(
    commands.filter((command: string) => command === "pnpm build")
  ).toHaveLength(1);
  for (const command of [
    "pnpm format:check",
    "pnpm lint",
    "pnpm validate:content",
    "pnpm test:foundation",
    "pnpm test:coverage",
    "pnpm audit:security",
    "pnpm test:build-contract",
    "pnpm verify:artifact",
    "pnpm artifact:seal",
    "pnpm test:e2e",
    "pnpm test:performance",
    "pnpm artifact:check",
  ])
    expect(commands).toContain(command);
  expect(commands.indexOf("pnpm artifact:seal")).toBeLessThan(
    commands.indexOf("pnpm test:e2e")
  );
  expect(commands.indexOf("pnpm artifact:check")).toBeGreaterThan(
    commands.indexOf("pnpm test:performance")
  );
  const uploadIndex = steps.findIndex((step: { uses?: string }) =>
    step.uses?.startsWith("actions/upload-pages-artifact@")
  );
  expect(uploadIndex).toBeGreaterThan(
    steps.findIndex(
      (step: { run?: string }) => step.run === "pnpm artifact:check"
    )
  );
  expect(steps[uploadIndex].with.path).toBe("dist");
  expect(JSON.stringify(workflow.jobs.deploy)).not.toContain("pnpm build");
  expect(JSON.stringify(workflow.jobs.deploy)).toContain(
    "actions/deploy-pages@"
  );
});
