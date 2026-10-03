import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const config = await readFile(new URL('../astro.config.ts', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
test('构建不依赖远程字体服务', () => assert.doesNotMatch(config, /fontProviders|fonts\.google/));
test('构建命令不调用平台专属复制命令', () => assert.doesNotMatch(pkg.scripts.build, /\bcp\s|\bxcopy\s/));
test('移除首版不使用的动态 OG 运行依赖', () => assert.equal(pkg.dependencies.satori, undefined));
test('不引入首版未使用的 MDX 编译链', () => assert.equal(pkg.dependencies['@astrojs/mdx'], undefined));
test('Astro 使用已核验的安全修复基线', () => assert.equal(pkg.dependencies.astro, '7.3.5'));

// Exercise the formatter's own ignore resolution, not just the command exit code.
test('格式校验必须覆盖新增脚本、测试、配置和文档', async () => {
  const { getFileInfo } = await import('prettier');
  const { fileURLToPath } = await import('node:url');
  for (const name of ['scripts/build.mjs', 'tests/publication.test.ts', 'vitest.config.ts', 'astro-paper.config.ts', 'docs/UPSTREAM.md']) {
    const info = await getFileInfo(fileURLToPath(new URL('../' + name, import.meta.url)), { ignorePath: fileURLToPath(new URL('../.prettierignore', import.meta.url)) });
    assert.equal(info.ignored, false, name + ' must not be silently excluded');
  }
});
