import { describe, expect, it } from 'vitest';
import { validatePosts, validateProjects } from '../src/lib/content-schema';
const data = { slug: 'hello-world', title: '中文与 TypeScript', description: '用于验证内容流程的样文。', pubDatetime: '2026-10-01T10:00:00+08:00', draft: false, category: 'knowledge', tags: ['TypeScript'] };
const record = (change: Record<string, unknown> = {}, source = 'a.md') => ({ source, body: '正文', data: { ...data, ...change } });
describe('文章元数据', () => {
  it('保留明确的稳定 ID，将带时区时间规范化为 Date', () => {
    const [post] = validatePosts([record()]);
    expect(post.data.slug).toBe('hello-world');
    expect(post.data.pubDatetime.toISOString()).toBe('2026-10-01T02:00:00.000Z');
    expect(validatePosts([record({}, 'moved/a.md')])[0].data.slug).toBe(post.data.slug);
  });
  it.each([{ draft: undefined }, { draft: 'false' }, { title: '' }, { description: '' }, { category: 'other' }, { slug: undefined }, { slug: '2026' }, { slug: '../escape' }, { slug: 'Mixed-Case' }, { tags: [''] }, { pubDatetime: '2026-10-01' }, { pubDatetime: '2026-10-01T10:00:00' }, { pubDatetime: '2026-02-30T10:00:00+08:00' }, { modDatetime: 'invalid' }])('拒绝无效字段 %j，并指出源文件', change => {
    expect(() => validatePosts([record(change, 'bad.md')])).toThrow(/bad.md/);
  });
  it('即使内容完全相同，重复 slug 也必须阻断', () => {
    expect(() => validatePosts([record({}, 'first.md'), record({}, 'second.md')])).toThrow(/重复.*hello-world.*first.md.*second.md/);
  });
  it('标签去重且保留顺序，允许草稿和未来文章进入源数据层', () => {
    const [post] = validatePosts([record({ draft: true, tags: [' TypeScript ', 'TypeScript', '中文'], pubDatetime: '2099-01-01T00:00:00Z', demo: true })]);
    expect(post.data.tags).toEqual(['TypeScript', '中文']);
    expect(post.data.draft).toBe(true);
    expect(post.data.demo).toBe(true);
  });
  it('封面只接受相对的本地资源引用', () => {
    for (const cover of ['https://example.com/a.jpg', '/private/a.png', '../x?token=secret', 'C:\\secret.png', 'data:image/svg+xml,x']) expect(() => validatePosts([record({ cover })])).toThrow();
    expect(validatePosts([record({ cover: '../../assets/images/cover.svg' })])[0].data.cover).toContain('cover.svg');
  });
  it('空集合可用，拼错字段不被静默忽略', () => {
    expect(validatePosts([])).toEqual([]);
    expect(() => validatePosts([record({ publishDate: '2026-10-01' })])).toThrow();
  });
});
describe('项目集合', () => {
  const project = (change = {}) => ({ source: 'project.md', body: '', data: { slug: 'blog', title: '个人博客', description: '实际正在建设的博客。', techStack: ['Astro'], draft: false, ...change } });
  it('使用独立的项目结构，链接为可选字段', () => {
    expect(validateProjects([project()])[0].data.techStack).toEqual(['Astro']);
    expect(validateProjects([])).toEqual([]);
  });
  it('拒绝危险链接、缺失发布状态与重复项目 ID', () => {
    expect(() => validateProjects([project({ repoUrl: 'javascript:alert(1)' })])).toThrow();
    expect(() => validateProjects([project({ draft: undefined })])).toThrow();
    expect(() => validateProjects([project(), { ...project(), source: 'duplicate.md' }])).toThrow(/重复/);
    expect(validateProjects([project({ repoUrl: 'https://github.com/scyolo/blog', demoUrl: 'https://example.com' })])).toHaveLength(1);
  });
});
