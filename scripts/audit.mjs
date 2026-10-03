import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { assessAudit } from './lib/security-audit.mjs';

const cli = process.env.npm_execpath;
if (!cli) throw new Error('Run this check using pnpm audit:security');
const run = spawnSync(process.execPath, [cli, 'audit', '--json'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
if (run.error || (run.status !== 0 && run.status !== 1)) throw new Error('Unable to complete dependency audit: ' + (run.error?.message ?? run.stderr));
let report;
try { report = JSON.parse(run.stdout); } catch { throw new Error('Audit did not return valid JSON'); }
if (!report.metadata?.vulnerabilities) throw new Error('Audit report is incomplete');
const exceptions = JSON.parse(await readFile(new URL('../security-exceptions.json', import.meta.url), 'utf8'));
const result = assessAudit(report, exceptions);
for (const item of result.reviewed) process.stdout.write('REVIEWED, NOT PATCHED: ' + JSON.stringify(item) + '\n');
for (const item of result.blocked) process.stderr.write('BLOCKED: ' + JSON.stringify(item) + '\n');
process.stdout.write('Audit: ' + result.blocked.length + ' unreviewed, ' + result.reviewed.length + ' reviewed and still unpatched.\n');
if (result.blocked.length) process.exitCode = 1;
