import { afterEach, beforeEach, expect, it, vi } from "vitest";
beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it("无构建时间覆盖时使用当前时间", async () => {
  vi.stubEnv("BUILD_TIMESTAMP", undefined);
  vi.stubEnv("DEV", false);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
  const { postFilter } = await import("../src/utils/postFilter");
  expect(
    postFilter({
      data: { draft: false, pubDatetime: new Date("2026-10-03T00:00:00Z") },
    } as Parameters<typeof postFilter>[0])
  ).toBe(true);
});
it("无效构建时间直接拒绝运行", async () => {
  vi.stubEnv("BUILD_TIMESTAMP", "invalid");
  await expect(import("../src/utils/postFilter")).rejects.toThrow(
    /BUILD_TIMESTAMP/
  );
});
