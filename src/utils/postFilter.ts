import type { CollectionEntry } from 'astro:content';
import { isVisible } from '../lib/publication';
const buildTime = new Date(process.env.BUILD_TIMESTAMP ?? Date.now()).getTime();
if (!Number.isFinite(buildTime)) throw new Error('Invalid BUILD_TIMESTAMP');
export function postFilter({ data }: CollectionEntry<'posts'>): boolean {
  return isVisible(data, buildTime, import.meta.env.DEV);
}
