import { expect, it } from 'vitest';
import { paginate, pageHref, tagId, groupTags, formatDate } from '../src/lib/lists';
it('空集合仍有可访问的第一页，分页不改变原数组', () => {
  expect(paginate([],6)).toEqual([{items:[],number:1,totalPages:1,totalItems:0}]);
  const input=[1,2,3,4,5]; const pages=paginate(input,2);
  expect(pages.map(p=>p.items)).toEqual([[1,2],[3,4],[5]]); expect(input).toEqual([1,2,3,4,5]);
  expect(pageHref('/posts/',1)).toBe('/posts/');expect(pageHref('/posts/',2)).toBe('/posts/2/');
  expect(()=>paginate([],0)).toThrow();expect(()=>pageHref('/posts/',0)).toThrow();
});
it('标签不会把 C++ 与 C# 错误合并，生成单段稳定地址', () => {
  expect(tagId('C++')).not.toBe(tagId('C#'));
  expect(tagId('Markdown')).toBe('markdown');
  expect(tagId('阅读')).toMatch(/^[a-z0-9~]+$/);
  expect(tagId('a/b')).not.toContain('/');
  expect(tagId('~'+tagId('阅读'))).not.toBe(tagId('阅读'));
});
it('同一文章的大小写重复标签只计一次', () => {
  const a={id:'a',data:{tags:['TypeScript','typescript','C++']}};
  const b={id:'b',data:{tags:['typescript','C#']}};
  const groups=groupTags([a,b]);
  expect(groups.find(t=>t.id==='typescript')?.posts.map(p=>p.id)).toEqual(['a','b']);
  expect(groups).toHaveLength(3); expect(groupTags([])).toEqual([]);
});
it('日期按北京时间显示，不受构建主机时区影响',()=>{
  expect(formatDate(new Date('2026-09-30T20:00:00Z'))).toBe('2026.10.01');
});
