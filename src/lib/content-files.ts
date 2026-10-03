import { readdir, readFile, realpath, lstat } from 'node:fs/promises';
import { resolve, relative, dirname, isAbsolute, sep } from 'node:path';
import { parseDocument } from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { localImageSchema, pageSchema, validatePosts, validateProjects, type RawRecord } from './content-schema.ts';

type SyntaxNode = { type: string; url?: string; identifier?: string; children?: SyntaxNode[] };
const markdown = unified().use(remarkParse);
const inside = (base: string, target: string) => { const rel = relative(base, target); return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)); };
const portable = (path: string) => path.split(sep).join('/');

async function filesIn(dir: string): Promise<string[]> {
  const info = await lstat(dir).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
  if (!info) return [];
  if (info.isSymbolicLink()) throw new Error('不允许内容或公开目录符号链接: ' + dir);
  const entries = await readdir(dir, { withFileTypes: true });
  const output: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = resolve(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('不允许符号链接: ' + path);
    if (entry.isDirectory()) output.push(...await filesIn(path));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

async function recordsIn(root: string, folder: string): Promise<RawRecord[]> {
  const records: RawRecord[] = [];
  for (const file of await filesIn(resolve(root, folder))) {
    if (/\.mdx$/i.test(file)) throw new Error('首版不支持 MDX: ' + file);
    if (!file.endsWith('.md')) continue;
    const source = portable(relative(root, file));
    const text = (await readFile(file, 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
    if (!match) throw new Error(source + ': 缺少 YAML frontmatter');
    const document = parseDocument(match[1], { uniqueKeys: true });
    if (document.errors.length) throw new Error(source + ': ' + document.errors.map(error => error.message).join('; '));
    records.push({ source, data: document.toJS({ maxAliasCount: 30 }), body: text.slice(match[0].length) });
  }
  return records;
}

export function imageReferences(body: string, source: string): string[] {
  const tree = markdown.parse(body) as unknown as SyntaxNode;
  const nodes: SyntaxNode[] = [];
  const visit = (node: SyntaxNode) => { nodes.push(node); node.children?.forEach(visit); };
  visit(tree);
  const definitions = new Map(nodes.filter(node => node.type === 'definition').map(node => [node.identifier, node.url]));
  const urls: string[] = [];
  for (const node of nodes) {
    if (node.type === 'html') throw new Error(source + ': 不支持原始 HTML，请使用 Markdown 或代码块');
    if (node.type === 'image') urls.push(node.url ?? '');
    if (node.type === 'imageReference') urls.push(definitions.get(node.identifier) ?? '');
  }
  return urls;
}

async function validateResources(record: RawRecord, root: string): Promise<string[]> {
  const metadata = record.data as Record<string, unknown>;
  const refs = [...imageReferences(record.body, record.source), metadata.cover, metadata.ogImage].filter((value): value is string => typeof value === 'string');
  const assets = [];
  for (const ref of refs) {
    const parsed = localImageSchema.safeParse(ref);
    if (!parsed.success) throw new Error(record.source + ': 图片必须引用 src/assets 中的相对本地资源: ' + ref);
    const allowed = resolve(root, 'src/assets');
    const candidate = resolve(root, dirname(record.source), parsed.data);
    if (!inside(allowed, candidate)) throw new Error(record.source + ': 图片超出 src/assets 公开资源范围: ' + ref);
    const actual = await realpath(candidate).catch(() => { throw new Error(record.source + ': 找不到图片: ' + ref); });
    if (!inside(allowed, actual)) throw new Error(record.source + ': 图片符号链接超出公开资源范围');
    assets.push(portable(relative(root, actual)));
  }
  return assets;
}

export async function readSiteContent(directory = process.cwd()) {
  const root = await realpath(directory);
  const posts = validatePosts(await recordsIn(root, 'src/content/posts'));
  const projects = validateProjects(await recordsIn(root, 'src/content/projects'));
  const pages = (await recordsIn(root, 'src/content/pages')).map(record => {
    const parsed = pageSchema.safeParse(record.data);
    if (!parsed.success) throw new Error(record.source + ': ' + parsed.error.message);
    return { ...record, data: parsed.data };
  });
  for (const file of await filesIn(resolve(root, 'public'))) {
    const name = portable(relative(root, file));
    if (/(?:^|\/)\.(?:env|git)(?:[./]|$)|\.(?:mdx?|tsx?|pem|key|map|html)$/i.test(name)) throw new Error('public 中不能放置源文件或私有文件: ' + name);
  }
  const assets = new Set<string>();
  for (const record of [...posts, ...projects, ...pages]) for (const asset of await validateResources(record, root)) assets.add(asset);
  return { posts, projects, pages, assets: [...assets].sort() };
}

export async function validateMarkdownResources(body: string, source: string, directory = process.cwd()) {
  return validateResources({ body, source, data: {} }, await realpath(directory));
}
