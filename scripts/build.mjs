import { spawn } from 'node:child_process';
import { readFile, rm, lstat } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
// Only fixed generated directories may be cleaned; never follow workspace symlinks.
for (const name of ['dist', '.astro', 'public/pagefind']) {
  const target = resolve(root, name);
  const rel = relative(root, target);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Unsafe build cleanup path');
  const entry = await lstat(target).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
  if (entry?.isSymbolicLink()) throw new Error('Refusing to clean a symlink: ' + target);
  await rm(target, { recursive: true, force: true });
}
const env = { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' };
async function runBin(name, args) {
  const manifestPath = resolve(root, 'node_modules', name, 'package.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin[name];
  if (!bin) throw new Error('Missing executable for ' + name);
  await new Promise((done, reject) => {
    const child = spawn(process.execPath, [resolve(dirname(manifestPath), bin), ...args], { cwd: root, env, stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? done() : reject(new Error(name + ' exited with code ' + code)));
  });
}
await runBin('astro', ['check']);
await runBin('astro', ['build']);
await runBin('pagefind', ['--site', 'dist']);
