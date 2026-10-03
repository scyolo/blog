import { z } from 'astro/zod';

export const slugSchema = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'slug 必须以小写英文字母开头，仅含小写字母、数字和连字符');
export const timestampSchema = z.iso.datetime({ offset: true, message: '时间必须是带时区的有效 ISO 日期' }).transform(value => new Date(value));
export const localImageSchema = z.string().trim().min(1).refine(value =>
  !/^[\/]|[\\:?#%\x00-\x1f]/.test(value) && /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(value), '图片必须是无查询参数的相对本地文件路径');
const text = z.string().trim().min(1);
const httpUrl = z.url().refine(value => ['https:', 'http:'].includes(new URL(value).protocol), '链接只允许 HTTP(S)');
const tags = z.array(text).default([]).transform(values => [...new Set(values)]);

export const postSchema = z.object({
  slug: slugSchema,
  title: text,
  description: text,
  pubDatetime: timestampSchema,
  modDatetime: timestampSchema.optional(),
  draft: z.boolean(),
  category: z.enum(['knowledge', 'essay']),
  tags,
  cover: localImageSchema.optional(),
  author: text.default('scyolo'),
  demo: z.boolean().default(false),
  // Retained until upstream presentation components have been replaced.
  featured: z.boolean().optional(),
  ogImage: localImageSchema.optional(),
  canonicalURL: httpUrl.optional(),
  hideEditPost: z.boolean().optional(),
  timezone: z.string().optional(),
}).strict();

export const projectSchema = z.object({
  slug: slugSchema, title: text, description: text,
  techStack: tags, draft: z.boolean(),
  repoUrl: httpUrl.optional(), demoUrl: httpUrl.optional(),
  cover: localImageSchema.optional(), demo: z.boolean().default(false),
}).strict();

export const pageSchema = z.object({ title: text, description: text.optional() }).strict();
export interface RawRecord { source: string; body: string; data: unknown }

function validateRecords<T extends { slug: string }>(records: RawRecord[], schema: z.ZodType<T>) {
  const seen = new Map<string, string>();
  return records.map(record => {
    const result = schema.safeParse(record.data);
    if (!result.success) throw new Error(record.source + ': ' + result.error.issues.map(issue => issue.path.join('.') + ' ' + issue.message).join('; '));
    const previous = seen.get(result.data.slug);
    if (previous) throw new Error('重复 slug ' + result.data.slug + ': ' + previous + ' 与 ' + record.source);
    seen.set(result.data.slug, record.source);
    return { ...record, data: result.data };
  });
}
export const validatePosts = (records: RawRecord[]) => validateRecords(records, postSchema);
export const validateProjects = (records: RawRecord[]) => validateRecords(records, projectSchema);
