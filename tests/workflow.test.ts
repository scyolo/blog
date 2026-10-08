import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
const workflow = parse(
  readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")
);
it("PR 不获得部署密钥；所有三方 action 固定完整提交", () => {
  expect(JSON.stringify(workflow.jobs.verify)).not.toMatch(
    /\$\{\{[^}]*\bsecrets(?:\.|\[)/
  );
  expect(workflow.permissions).toEqual({ contents: "read" });
  for (const job of Object.values(workflow.jobs) as {
    steps: Record<string, string>[];
  }[])
    for (const step of job.steps)
      if (step.uses) expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
});
it("最终产物只构建一次，测试前封存，测试后校验再上传", () => {
  const commands = workflow.jobs.verify.steps
    .map((step: { run?: string }) => step.run)
    .filter(Boolean);
  expect(commands.filter((cmd: string) => cmd === "pnpm build")).toHaveLength(
    1
  );
  expect(commands.indexOf("pnpm artifact:seal")).toBeLessThan(
    commands.indexOf("pnpm test:e2e")
  );
  expect(commands.indexOf("pnpm artifact:check")).toBeGreaterThan(
    commands.indexOf("pnpm test:performance")
  );
  expect(JSON.stringify(workflow.jobs.deploy)).not.toMatch(/pnpm build/);
});
it("部署依赖成功校验并以不取消的共享组串行；过时构建可取消", () => {
  expect(workflow.jobs.deploy.needs).toBe("verify");
  expect(workflow.jobs.deploy.if).toContain("refs/heads/main");
  expect(workflow.jobs.deploy.if).toContain("!= 'pull_request'");
  expect(workflow.jobs.deploy.concurrency).toEqual({
    group: "blog-production",
    "cancel-in-progress": false,
  });
  expect(workflow.jobs.verify.concurrency["cancel-in-progress"]).toBe(true);
  expect(workflow).not.toHaveProperty("concurrency");
  expect(JSON.stringify(workflow.jobs.deploy)).not.toContain("always()");
});
it("提供真实失败演练入口，诊断文件仅失败上传且七天过期", () => {
  expect(workflow.on.workflow_dispatch.inputs.failure_drill.default).toBe(
    false
  );
  const drill = workflow.jobs.verify.steps.find(
    (step: { name?: string }) => step.name === "Deliberate test failure drill"
  );
  expect(drill.run).toContain("assert.fail");
  const diagnostics = workflow.jobs.verify.steps.find(
    (step: { name?: string }) =>
      step.name === "Keep diagnostics only on failure"
  );
  expect(diagnostics.if).toContain("failure()");
  expect(diagnostics.with["retention-days"]).toBe(7);
});
