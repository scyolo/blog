export interface PageSlice<T> { items: T[]; number: number; totalPages: number; totalItems: number }
export function paginate<T>(items: T[], size: number): PageSlice<T>[] {
  if (!Number.isSafeInteger(size) || size < 1) throw new Error('Invalid page size');
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  return Array.from({ length: totalPages }, (_, index) => ({ items: items.slice(index * size, (index + 1) * size), number: index + 1, totalPages, totalItems: items.length }));
}
export function pageHref(base: string, page: number): string {
  if (!Number.isSafeInteger(page) || page < 1) throw new Error('Invalid page number');
  return base.replace(/\/?$/, '/') + (page === 1 ? '' : page + '/');
}
export function tagId(label: string): string {
  const key = label.trim().normalize('NFC').toLowerCase();
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) return key;
  return '~' + Array.from(new TextEncoder().encode(key), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function groupTags<T extends { id: string; data: { tags: string[] } }>(posts: T[]) {
  const groups = new Map<string, { id: string; label: string; posts: T[] }>();
  for (const post of posts) {
    const seen = new Set<string>();
    for (const label of post.data.tags) {
      const id = tagId(label);
      if (seen.has(id)) continue;
      seen.add(id);
      if (!groups.has(id)) groups.set(id, { id, label: label.trim(), posts: [] });
      groups.get(id)!.posts.push(post);
    }
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date).replaceAll('/', '.');
}
