import { test, expect } from 'vitest';
import { assessAudit } from '../scripts/lib/security-audit.mjs';
const now = new Date('2026-10-03T00:00:00Z');
const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
const exception = { id: 'GHSA-ch52-4w7c-c8xp', module: 'http-cache-semantics', severity: 'high', version: '4.2.0', path: '.>astro>http-cache-semantics', expires: '2026-11-02T23:59:59+08:00', reason: 'Build-only cache without authenticated proxy.' };
const advisory = { github_advisory_id: exception.id, module_name: exception.module, severity: 'high', patched_versions: '<0.0.0', findings: [{ version: '4.2.0', paths: [exception.path] }] };
const report = (a: Record<string, unknown> = advisory) => ({ metadata: { vulnerabilities: { ...counts, high: 1 } }, advisories: { a } });

test('没有告警的完整报告可以通过', () => {
  expect(assessAudit({ metadata: { vulnerabilities: counts }, advisories: {} }, [])).toEqual({ blocked: [], reviewed: [] });
});
test('未审查的告警必须阻止通过', () => {
  expect(assessAudit(report(), [], now).blocked).toHaveLength(1);
});
test('精确匹配的未修复问题保留在报告里', () => {
  const result = assessAudit(report(), [exception], now);
  expect(result.blocked).toHaveLength(0);
  expect(result.reviewed).toHaveLength(1);
});
test('例外到期或缺乏有效期限/理由时拒绝通过', () => {
  expect(assessAudit(report(), [exception], new Date('2026-11-02T16:00:00Z')).blocked).toHaveLength(1);
  for (const invalid of [{ ...exception, expires: 'invalid' }, { ...exception, reason: '' }]) expect(assessAudit(report(), [invalid], now).blocked).toHaveLength(1);
});
test('版本、路径、公告编号或包名变化均不能借用例外', () => {
  for (const changed of [
    { ...advisory, findings: [{ version: '4.2.1', paths: [exception.path] }] },
    { ...advisory, findings: [{ version: '4.2.0', paths: [exception.path, '.>other>http-cache-semantics'] }] },
    { ...advisory, github_advisory_id: 'GHSA-new-alert' },
    { ...advisory, module_name: 'other' },
  ]) expect(assessAudit(report(changed), [exception], now).blocked).toHaveLength(1);
});
test('公告已有补丁或严重级别变化时必须重新审查', () => {
  for (const changed of [{ ...advisory, patched_versions: '>=4.2.1' }, { ...advisory, severity: 'critical' }]) expect(assessAudit(report(changed), [exception], now).blocked).toHaveLength(1);
});
test('网络错误、格式不完整或无效计数必须失败关闭', () => {
  for (const data of [null, {}, { error: { message: 'network' } }, { metadata: {} }, { metadata: { vulnerabilities: counts }, advisories: [] }, { metadata: { vulnerabilities: { ...counts, high: -1 } }, advisories: {} }]) {
    expect(() => assessAudit(data, [exception], now)).toThrow();
  }
});
test('计数与空明细矛盾时，不能伪装为零漏洞', () => {
  expect(() => assessAudit({ metadata: { vulnerabilities: { ...counts, high: 1 } }, advisories: {} }, [], now)).toThrow();
  expect(() => assessAudit({ metadata: { vulnerabilities: counts }, advisories: { a: advisory } }, [], now)).toThrow();
});
test('缺失依赖版本路径不能获得例外', () => {
  for (const findings of [[], [{ version: '4.2.0', paths: [] }], [{ version: '4.2.0' }]]) expect(assessAudit(report({ ...advisory, findings }), [exception], now).blocked).toHaveLength(1);
});
test('支持公告 URL 标识，缺失标识则阻止通过', () => {
  const { github_advisory_id: _id, ...withoutId } = advisory;
  expect(assessAudit(report({ ...withoutId, url: 'https://github.com/advisories/' + exception.id }), [exception], now).reviewed).toHaveLength(1);
  expect(assessAudit(report(withoutId), [exception], now).blocked).toHaveLength(1);
});
