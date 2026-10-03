import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectionEntry } from 'astro:content';

const NOW = new Date('2026-10-03T04:00:00Z');
const entry = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, filePath: 'src/content/posts/' + id + '.md',
  data: { title: id, description: 'test', pubDatetime: new Date('2026-10-01T00:00:00Z'), draft: false, tags: [], ...overrides },
}) as unknown as CollectionEntry<'posts'>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv('DEV', false);
  vi.stubEnv('BUILD_TIMESTAMP', NOW.toISOString());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('发布边界', () => {
  it('只接受显式公开的文章，不将缺失 draft 当作已发布', async () => {
    const { postFilter } = await import('../src/utils/postFilter');
    expect(postFilter(entry('missing', { draft: undefined }))).toBe(false);
    expect(postFilter(entry('published'))).toBe(true);
  });
  it('未来一分钟的文章不能因主题的提前窗口而公开', async () => {
    const { postFilter } = await import('../src/utils/postFilter');
    expect(postFilter(entry('future', { pubDatetime: new Date(NOW.getTime() + 60_000) }))).toBe(false);
  });
  it('发布时间正好等于构建时间时可以公开', async () => {
    const config = await import('./stubs/site-config');
    config.default.posts.scheduledPostMargin = 0;
    const { postFilter } = await import('../src/utils/postFilter');
    expect(postFilter(entry('boundary', { pubDatetime: NOW }))).toBe(true);
  });
  it('生产隐藏草稿，本地开发允许预览草稿与未来文章', async () => {
    const { postFilter } = await import('../src/utils/postFilter');
    expect(postFilter(entry('draft', { draft: true }))).toBe(false);
    vi.stubEnv('DEV', true);
    expect(postFilter(entry('draft', { draft: true }))).toBe(true);
    expect(postFilter(entry('future', { pubDatetime: new Date('2099-01-01T00:00:00Z') }))).toBe(true);
  });
  it('不能公开无效日期', async () => {
    const { postFilter } = await import('../src/utils/postFilter');
    expect(postFilter(entry('invalid', { pubDatetime: new Date('invalid') }))).toBe(false);
  });
});

describe('稳定地址与时间顺序', () => {
  it('移动源文件或改变目录，不改变同一内容 ID 的永久链接', async () => {
    const { getPostUrl, getPostSlug } = await import('../src/utils/getPostPaths');
    const expected = '/posts/stable-note/';
    expect(getPostUrl('stable-note', 'src/content/posts/archive/stable-note.md')).toBe(getPostUrl('stable-note', 'src/content/posts/stable-note.md'));
    expect(getPostUrl('stable-note', 'src/content/posts/stable-note.md')).toBe(expected);
    expect(getPostUrl('stable-note', 'src/content/posts/archive/stable-note.md')).toBe(expected);
    expect(getPostUrl('stable-note', undefined)).toBe(expected);
    expect(getPostSlug('stable-note', 'src/content/posts/archive/stable-note.md')).toBe('stable-note');
  });
  it('列表按发布时间排序，编辑旧文章不能冒充新文章', async () => {
    const { getSortedPosts } = await import('../src/utils/getSortedPosts');
    const old = entry('old', { pubDatetime: new Date('2026-09-01T00:00:00Z'), modDatetime: NOW });
    const recent = entry('recent');
    const original = [old, recent];
    expect(getSortedPosts(original).map(p => p.id)).toEqual(['recent', 'old']);
    expect(original).toEqual([old, recent]);
  });
});

it('相同发布时间使用稳定 ID 顺序，不受输入数组顺序影响', async () => {
  const { getSortedPosts } = await import('../src/utils/getSortedPosts');
  expect(getSortedPosts([entry('z'), entry('a')]).map(p => p.id)).toEqual(['a', 'z']);
});
