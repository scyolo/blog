import test from 'node:test';
import assert from 'node:assert/strict';
const now = new Date('2026-10-03T00:00:00Z');
const exception = { id: 'GHSA-ch52-4w7c-c8xp', module: 'http-cache-semantics', version: '4.2.0', path: '.>astro>http-cache-semantics', expires: '2026-11-02', reason: 'Build-only image cache; no authenticated proxy or visitor-supplied cache headers.' };
const advisory = { github_advisory_id: exception.id, module_name: exception.module, severity: 'high', findings: [{ version: '4.2.0', paths: [exception.path] }] };
const report = (a = advisory) => ({ metadata: { vulnerabilities: { high: 1 } }, advisories: { a } });
const load = () => import('../scripts/lib/security-audit.mjs');

test('没有告警的完整报告可以通过', async () => {
  const { assessAudit } = await load();
  assert.deepEqual(assessAudit({ metadata: {}, advisories: {} }, [], now), { blocked: [], reviewed: [] });
});
test('未审查的高危告警必须阻止通过', async () => {
  const { assessAudit } = await load();
  assert.equal(assessAudit(report(), [], now).blocked.length, 1);
});
test('有期限且精确匹配的例外仍要明确报告，不能假装零漏洞', async () => {
  const { assessAudit } = await load();
  const result = assessAudit(report(), [exception], now);
  assert.equal(result.blocked.length, 0);
  assert.equal(result.reviewed.length, 1);
});
test('例外到期、依赖路径变化或版本变化时拒绝沿用', async () => {
  const { assessAudit } = await load();
  assert.equal(assessAudit(report(), [exception], new Date('2026-11-03T00:00:00Z')).blocked.length, 1);
  for (const findings of [ [{ version: '4.2.1', paths: [exception.path] }], [{ version: '4.2.0', paths: [exception.path, '.>other>http-cache-semantics'] }] ]) {
    assert.equal(assessAudit(report({ ...advisory, findings }), [exception], now).blocked.length, 1);
  }
});
test('换了公告编号的告警不能被同包名例外吞掉', async () => {
  const { assessAudit } = await load();
  assert.equal(assessAudit(report({ ...advisory, github_advisory_id: 'GHSA-new-alert' }), [exception], now).blocked.length, 1);
});
test('网络错误、格式不完整和缺失依赖路径都必须失败关闭', async () => {
  const { assessAudit } = await load();
  for (const data of [{}, { error: { message: 'network' } }, { metadata: {} }]) assert.throws(() => assessAudit(data, [exception], now));
  assert.equal(assessAudit(report({ ...advisory, findings: [] }), [exception], now).blocked.length, 1);
});
