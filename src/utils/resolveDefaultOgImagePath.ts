import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ResolvedAstroPaperConfig } from '@/types/config';
import { getAssetPath } from './withBase';

/** A build-time existence check: do not import arbitrary public files as JavaScript. */
export function resolveDefaultOgImagePath(config: ResolvedAstroPaperConfig): string {
  const filename = config.site.ogImage;
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('site.ogImage must be a filename inside public/');
  }
  if (!existsSync(resolve('public', filename))) {
    throw new Error('Missing static share image: public/' + filename);
  }
  return getAssetPath(filename);
}
