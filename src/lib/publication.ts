export interface PublicationData { draft?: boolean; pubDatetime: Date }
export function isVisible(data: PublicationData, now: number, development = false): boolean {
  const publishedAt = new Date(data.pubDatetime).getTime();
  if (typeof data.draft !== 'boolean' || !Number.isFinite(publishedAt)) return false;
  return development || (data.draft === false && publishedAt <= now);
}
