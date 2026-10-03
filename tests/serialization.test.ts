import { expect, it } from 'vitest';
import { jsonForScript } from '../src/lib/serialization';
it('JSON-LD 不允许元数据闭合 script 标签', () => {
  const value = { title: '</script><script>alert(1)</script>', text: '& 中文' };
  const result = jsonForScript(value);
  expect(result).not.toContain('<'); expect(JSON.parse(result)).toEqual(value);
});
it('保留 Unicode 分隔符的内容但不直接嵌入它们', () => {
  const text = String.fromCharCode(0x2028,0x2029);
  const result = jsonForScript({ text });
  expect(result).not.toContain(text); expect(JSON.parse(result).text).toBe(text);
});
