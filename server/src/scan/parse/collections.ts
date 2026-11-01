import type { CollectionRecord, Evidence } from '../types.js';
import { parseHtml } from './html.js';

const COLLECTION_URL_REGEX = /^(?:\/([a-z]{2}(?:-[a-zA-Z]{2,4})?))?\/collections\/([a-zA-Z0-9\-_%]+)(?:\/)?$/i;

export function parseCollectionUrl(urlStr: string): { handle: string; isCollectionUrl: boolean } {
  try {
    const parsed = new URL(urlStr);
    const match = parsed.pathname.match(COLLECTION_URL_REGEX);
    if (!match) return { handle: '', isCollectionUrl: false };
    const rawHandle = match[2] || '';
    const handle = decodeURIComponent(rawHandle).toLowerCase();
    // Exclude generic 'all' or empty handles if desired, but 'all' is sometimes used
    return { handle, isCollectionUrl: true };
  } catch {
    return { handle: '', isCollectionUrl: false };
  }
}

export function parseCollectionsJson(payload: unknown, baseUrl: string, max: number): CollectionRecord[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { collections?: unknown }).collections)) return [];
  return (payload as { collections: Array<{ handle?: string; title?: string }> }).collections
    .slice(0, max)
    .filter(c => typeof c.handle === 'string')
    .map(c => ({
      handle: c.handle!,
      title: c.title,
      url: new URL(`/collections/${encodeURIComponent(c.handle!)}`, baseUrl).toString(),
      evidence: [
        {
          source: 'collections-json' as const,
          locator: new URL('/collections.json', baseUrl).toString(),
          note: 'Returned by public Shopify collections endpoint.'
        }
      ]
    }));
}

export function extractCollectionsFromHtml(html: string, pageUrl: string, baseUrl: string, max: number): CollectionRecord[] {
  const $ = parseHtml(html);
  const collectionsMap = new Map<string, CollectionRecord>();

  $('a[href*="/collections/"]').each((_, el) => {
    if (collectionsMap.size >= max) return;
    const href = $(el).attr('href');
    if (!href) return;

    try {
      const resolved = new URL(href, baseUrl);
      const { handle, isCollectionUrl } = parseCollectionUrl(resolved.toString());
      if (!isCollectionUrl || !handle || handle === 'all') return;

      if (!collectionsMap.has(handle)) {
        const rawTitle = $(el).text().trim() || $(el).attr('title')?.trim() || $(el).attr('aria-label')?.trim();
        const title = rawTitle && rawTitle.length < 100 ? rawTitle : undefined;
        collectionsMap.set(handle, {
          handle,
          ...(title ? { title } : {}),
          url: new URL(`/collections/${encodeURIComponent(handle)}`, baseUrl).toString(),
          evidence: [
            {
              source: 'html' as const,
              locator: pageUrl,
              excerpt: `Link to /collections/${handle}${title ? ` ("${title.slice(0, 50)}")` : ''}`,
              note: 'Discovered in storefront page navigation or layout links.'
            }
          ]
        });
      }
    } catch {}
  });

  return [...collectionsMap.values()];
}

export function extractCollectionsFromSitemap(sitemapXml: string, sitemapUrl: string, baseUrl: string, max: number): CollectionRecord[] {
  const locs = [...sitemapXml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m => m[1]!.trim());
  const collectionsMap = new Map<string, CollectionRecord>();

  for (const loc of locs) {
    if (collectionsMap.size >= max) break;
    const { handle, isCollectionUrl } = parseCollectionUrl(loc);
    if (isCollectionUrl && handle && handle !== 'all' && !collectionsMap.has(handle)) {
      collectionsMap.set(handle, {
        handle,
        url: new URL(`/collections/${encodeURIComponent(handle)}`, baseUrl).toString(),
        evidence: [
          {
            source: 'sitemap' as const,
            locator: sitemapUrl,
            note: 'Discovered in storefront XML sitemap.'
          }
        ]
      });
    }
  }

  return [...collectionsMap.values()];
}
