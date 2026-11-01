import { randomUUID } from 'node:crypto';
import { limits } from './fetcher/limits.js';
import { safeFetch, type SafeResponse } from './fetcher/safeFetch.js';
import { parseHtml } from './parse/html.js';
import {
  parseProductsJsonDetailed,
  deduplicateProductUrls,
  extractProductFromHtml,
  parseProductUrl
} from './parse/products.js';
import {
  parseCollectionsJson,
  extractCollectionsFromHtml,
  extractCollectionsFromSitemap
} from './parse/collections.js';
import { analyzeSeo } from './analyze/seo.js';
import { detectTechnologies } from './detect/scripts.js';
import { buildFindings } from './report/findings.js';
import { ScanResultSchema, type ScanResult, type ScanIssue, type Evidence, type CollectionRecord } from './types.js';

async function runConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      const res = await fn(item);
      results.push(res);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runScan(requestedUrl: string): Promise<ScanResult> {
  const started = Date.now(), startedAt = new Date().toISOString();
  const input = new URL(requestedUrl);
  input.pathname = '/';
  input.search = '';
  input.hash = '';
  const base = input.toString().replace(/\/$/, '');

  const scanController = new AbortController();
  const scanTimeout = setTimeout(() => scanController.abort(), limits.scanTimeoutMs);

  const pages: ScanResult['pagesInspected'] = [];
  const errors: ScanIssue[] = [];
  const warnings: ScanIssue[] = [];
  const limitations: string[] = [];
  const products: ScanResult['products'] = [];
  const collections: ScanResult['collections'] = [];
  const seo: ScanResult['seo'] = [];
  const technologies: ScanResult['technologies'] = [];
  const variants: ScanResult['variants'] = [];

  const discovery: ScanResult['discovery'] = {
    products: { status: 'unavailable', discoveredCount: 0, completeness: 'unknown', attempts: 0, retries: 0 },
    collections: { status: 'unavailable', discoveredCount: 0, completeness: 'unknown', attempts: 0, retries: 0 }
  };

  let homeHtml = '', finalUrl = base, shopifyDetected = false;
  let storeName: string | undefined, currency: string | undefined;
  let hasMultiLocale = false;
  const multiLocaleEvidence: Evidence[] = [];

  const signal = (code: string, message: string, url?: string) =>
    warnings.push({ code, message, url, stage: 'discovery', recoverable: true });

  const fetchCache = new Map<string, Promise<SafeResponse>>();
  const cachedFetch = (url: string, opts: { accept?: string } = {}) => {
    const key = `${url}|${opts.accept ?? ''}`;
    let p = fetchCache.get(key);
    if (!p) {
      p = safeFetch(url, { ...opts, signal: scanController.signal });
      fetchCache.set(key, p);
    }
    return p;
  };

  try {
    const home = await cachedFetch(base);
    finalUrl = home.url;
    pages.push({ url: home.url, status: home.status, bytes: home.bytes, stage: 'homepage', attempts: home.attempts, retries: home.retries });
    if (home.status >= 400) throw new Error(`Storefront returned HTTP ${home.status}.`);

    homeHtml = home.body;
    const $ = parseHtml(homeHtml);
    storeName = $('meta[property="og:site_name"]').attr('content') || $('title').first().text().trim() || undefined;

    const signals = [
      { ok: /cdn\.shopify\.com/i.test(homeHtml), excerpt: 'cdn.shopify.com reference' },
      { ok: /Shopify\.shop|Shopify\.theme|shopify-digital-wallet/i.test(homeHtml), excerpt: 'Shopify storefront global or wallet marker' },
      { ok: /\/cart\.js/i.test(homeHtml), excerpt: 'Shopify cart endpoint reference' }
    ];
    const detectionEvidence = signals.filter(s => s.ok).map(s => ({ source: 'html' as const, locator: home.url, excerpt: s.excerpt }));
    shopifyDetected = detectionEvidence.length > 0;
    if (!shopifyDetected) {
      limitations.push('Shopify could not be confirmed from public homepage evidence. Some Shopify storefronts may conceal common public signals.');
    }

    const tech = detectTechnologies(homeHtml, home.url, home.headers);
    technologies.push(...tech);

    const homeSeo = analyzeSeo(homeHtml, home.url);
    seo.push(homeSeo);

    // 1. Shopify public products JSON endpoint
    try {
      const r = await cachedFetch(`${base}/products.json?limit=250&page=1`, { accept: 'application/json' });
      pages.push({ url: r.url, status: r.status, bytes: r.bytes, stage: 'products-json', attempts: r.attempts, retries: r.retries });
      discovery.products.httpStatus = r.status;
      discovery.products.attempts = r.attempts;
      discovery.products.retries = r.retries;

      if (r.status === 200) {
        const payload = JSON.parse(r.body) as unknown;
        if (payload && typeof payload === 'object' && Array.isArray((payload as { products?: unknown }).products)) {
          const parsed = parseProductsJsonDetailed(payload, base, limits.maxProducts);
          products.push(...parsed.products);
          variants.push(...parsed.variants);
          discovery.products.status = 'success';
          discovery.products.discoveredCount = parsed.products.length;
          discovery.products.completeness = parsed.products.length >= limits.maxProducts ? 'partial' : 'unknown';
          discovery.products.note = parsed.products.length === 0
            ? 'The endpoint responded successfully but exposed zero product records; this does not prove the store has no products.'
            : parsed.products.length >= limits.maxProducts
            ? 'The configured inspection cap was reached; the store total may be higher.'
            : 'A public endpoint sample was discovered; the endpoint does not establish a complete store inventory.';
        } else {
          discovery.products.status = 'invalid_response';
          discovery.products.note = 'The endpoint returned HTTP 200 but not the expected Shopify products JSON structure.';
          limitations.push(discovery.products.note);
        }
      } else {
        discovery.products.status = r.status === 429 ? 'rate_limited' : 'http_error';
        discovery.products.note = `Public products endpoint returned HTTP ${r.status} after ${r.attempts} attempt(s).`;
        limitations.push(`${discovery.products.note} Product discovery may be incomplete.`);
        signal('PRODUCTS_ENDPOINT_UNAVAILABLE', discovery.products.note, r.url);
      }
    } catch (e) {
      discovery.products.status = 'unavailable';
      discovery.products.note = e instanceof Error ? e.message : 'Unknown request error';
      limitations.push(`Public products endpoint was unavailable: ${discovery.products.note}`);
      signal('PRODUCTS_ENDPOINT_UNAVAILABLE', discovery.products.note, `${base}/products.json`);
    }

    // 2. Shopify public collections JSON endpoint
    try {
      const r = await cachedFetch(`${base}/collections.json?limit=250`, { accept: 'application/json' });
      pages.push({ url: r.url, status: r.status, bytes: r.bytes, stage: 'collections-json', attempts: r.attempts, retries: r.retries });
      discovery.collections.httpStatus = r.status;
      discovery.collections.attempts = r.attempts;
      discovery.collections.retries = r.retries;

      if (r.status === 200) {
        const payload = JSON.parse(r.body) as unknown;
        if (payload && typeof payload === 'object' && Array.isArray((payload as { collections?: unknown }).collections)) {
          collections.push(...parseCollectionsJson(payload, base, limits.maxCollections));
          discovery.collections.status = 'success';
          discovery.collections.discoveredCount = collections.length;
          discovery.collections.completeness = collections.length >= limits.maxCollections ? 'partial' : 'unknown';
          discovery.collections.note = collections.length === 0
            ? 'The endpoint responded successfully but exposed zero collection records; this does not prove the store has no collections.'
            : collections.length >= limits.maxCollections
            ? 'The configured inspection cap was reached; the store total may be higher.'
            : 'A public endpoint sample was discovered; completeness cannot be confirmed from this endpoint.';
        } else {
          discovery.collections.status = 'invalid_response';
          discovery.collections.note = 'The endpoint returned HTTP 200 but not the expected Shopify collections JSON structure.';
          limitations.push(discovery.collections.note);
        }
      } else {
        discovery.collections.status = r.status === 429 ? 'rate_limited' : 'http_error';
        discovery.collections.note = `Public collections endpoint returned HTTP ${r.status} after ${r.attempts} attempt(s).`;
        limitations.push(`${discovery.collections.note} Collection discovery may be incomplete.`);
        signal('COLLECTIONS_ENDPOINT_UNAVAILABLE', discovery.collections.note, r.url);
      }
    } catch (e) {
      discovery.collections.status = 'unavailable';
      discovery.collections.note = e instanceof Error ? e.message : 'Unknown request error';
      limitations.push(`Public collections endpoint was unavailable: ${discovery.collections.note}`);
      signal('COLLECTIONS_ENDPOINT_UNAVAILABLE', discovery.collections.note, `${base}/collections.json`);
    }

    // 3. Fallback Discovery via Sitemap & Navigation
    let sitemapXml = '';
    let sitemapFetched = false;

    if (products.length === 0 || collections.length === 0) {
      try {
        const sm = await cachedFetch(`${base}/sitemap.xml`, { accept: 'application/xml,text/xml' });
        pages.push({ url: sm.url, status: sm.status, bytes: sm.bytes, stage: 'sitemap', attempts: sm.attempts, retries: sm.retries });
        if (sm.status === 200) {
          sitemapXml = sm.body;
          sitemapFetched = true;
        } else {
          limitations.push(`Sitemap returned HTTP ${sm.status}.`);
        }
      } catch (e) {
        limitations.push(`Sitemap discovery unavailable: ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    }

    // Alternative collection discovery if collections.json was blocked/empty
    if (collections.length === 0) {
      const altCollections = new Map<string, CollectionRecord>();

      // A) Extract collections from sitemap if available
      if (sitemapFetched && sitemapXml) {
        const smCollections = extractCollectionsFromSitemap(sitemapXml, `${base}/sitemap.xml`, base, limits.maxCollections);
        for (const col of smCollections) altCollections.set(col.handle, col);

        // Check if there is a dedicated collection sitemap (e.g. sitemap_collections_1.xml)
        const locs = [...sitemapXml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m => m[1]!.trim());
        const colSitemapUrls = locs.filter(u => /\/sitemap_collections_\d+\.xml/i.test(u));
        if (colSitemapUrls.length && pages.length < limits.maxPages && altCollections.size < limits.maxCollections) {
          try {
            const csm = await cachedFetch(colSitemapUrls[0]!, { accept: 'application/xml,text/xml' });
            pages.push({ url: csm.url, status: csm.status, bytes: csm.bytes, stage: 'collections-sitemap', attempts: csm.attempts, retries: csm.retries });
            if (csm.status === 200) {
              const fromChild = extractCollectionsFromSitemap(csm.body, csm.url, base, limits.maxCollections);
              for (const col of fromChild) altCollections.set(col.handle, col);
            }
          } catch {}
        }
      }

      // B) Extract collections from homepage navigation and layout links
      const navCollections = extractCollectionsFromHtml(homeHtml, home.url, base, limits.maxCollections);
      for (const col of navCollections) {
        if (!altCollections.has(col.handle)) {
          altCollections.set(col.handle, col);
        }
      }

      if (altCollections.size > 0) {
        collections.push(...altCollections.values());
        discovery.collections.discoveredCount = collections.length;
        discovery.collections.status = 'success';
        discovery.collections.completeness = 'partial';
        discovery.collections.note = `Collections discovered through alternative public sources (sitemap and page navigation); the public collections.json endpoint was unavailable (HTTP ${discovery.collections.httpStatus ?? 'unknown'}).`;
      }
    }

    // Fallback product discovery if products.json was blocked/empty
    if (products.length === 0 && sitemapFetched && sitemapXml) {
      const locs = [...sitemapXml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m => m[1]!.trim());
      const productSitemapUrls = locs.filter(u => /\/sitemap_products_\d+\.xml/i.test(u));
      const childSitemaps = productSitemapUrls.length ? productSitemapUrls.slice(0, 2) : [`${base}/sitemap.xml`];
      const allProductUrls: string[] = [];

      for (const childUrl of childSitemaps) {
        if (pages.length >= limits.maxPages) break;
        let childBody = sitemapXml;
        if (childUrl !== `${base}/sitemap.xml`) {
          try {
            const childRes = await cachedFetch(childUrl, { accept: 'application/xml,text/xml' });
            pages.push({ url: childRes.url, status: childRes.status, bytes: childRes.bytes, stage: 'product-sitemap', attempts: childRes.attempts, retries: childRes.retries });
            if (childRes.status === 200) childBody = childRes.body;
          } catch (e) {
            continue;
          }
        }
        const extractedUrls = [...childBody.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
          .map(m => m[1]!.trim())
          .filter(u => /\/products\//i.test(u));
        allProductUrls.push(...extractedUrls);
      }

      // Deduplicate across locales and track locale presence
      const deduplicatedGroups = deduplicateProductUrls(allProductUrls, base);
      for (const group of deduplicatedGroups) {
        if (group.alternateUrls.length > 0) {
          hasMultiLocale = true;
          for (const alt of group.alternateUrls) {
            const { locale } = parseProductUrl(alt);
            multiLocaleEvidence.push({
              source: 'url-pattern',
              locator: alt,
              note: locale ? `Localized product URL: ${locale}` : 'Alternate product URL'
            });
          }
        }
      }

      // Sample a subset of unique products to inspect with bounded concurrency
      const remainingPageBudget = Math.max(0, limits.maxPages - pages.length);
      const targetInspectionCount = Math.min(10, remainingPageBudget, limits.maxProducts);
      const groupsToInspect = deduplicatedGroups.slice(0, targetInspectionCount);

      await runConcurrent(groupsToInspect, limits.concurrency, async group => {
        if (pages.length >= limits.maxPages) return;
        try {
          const p = await cachedFetch(group.primaryUrl);
          pages.push({ url: p.url, status: p.status, bytes: p.bytes, stage: 'product-html', attempts: p.attempts, retries: p.retries });
          if (p.status === 200) {
            const ps = analyzeSeo(p.body, p.url);
            seo.push(ps);
            const extracted = extractProductFromHtml(p.body, p.url, base, group.alternateUrls);
            if (extracted) {
              products.push(extracted.product);
              variants.push(...extracted.variants);
            }
          }
        } catch (e) {
          signal('PRODUCT_PAGE_UNAVAILABLE', e instanceof Error ? e.message : 'Product page unavailable', group.primaryUrl);
        }
      });

      if (products.length > 0) {
        discovery.products.discoveredCount = products.length;
        discovery.products.status = 'success';
        discovery.products.completeness = 'partial';
        discovery.products.note = `Products discovered through sitemap fallback; inspected a sample of ${products.length} product page(s) to capture variants, prices, and options.`;
      }
    }

    if (products.length === 0) {
      limitations.push('No products were discovered through the public endpoints or sitemap fallback. This does not prove the store has no products.');
    }
    if (collections.length === 0) {
      limitations.push('No public collections were discovered. Collection visibility may be restricted, or the store may not expose collections publicly.');
    }

    if (/Shopify\.theme/i.test(homeHtml)) {
      const match = homeHtml.match(/Shopify\.theme\s*=\s*\{[^}]*name\s*:\s*["']([^"']+)/);
      if (match) {
        technologies.push({
          id: 'shopify-theme-name',
          label: `Shopify theme: ${match[1]}`,
          category: 'theme',
          confidence: 'medium',
          evidence: [{ source: 'html', locator: finalUrl, excerpt: match[0].slice(0, 180) }]
        });
      }
    }
  } catch (e) {
    errors.push({
      code: 'SCAN_FAILED',
      message: e instanceof Error ? e.message : 'The scan could not be completed.',
      url: base,
      stage: 'homepage',
      recoverable: false
    });
  } finally {
    clearTimeout(scanTimeout);
  }

  if (technologies.some(t => t.category === 'app')) {
    limitations.push('Public script detection cannot enumerate private, server-side, or headless app installations.');
  }
  if (technologies.length === 0) {
    limitations.push('No recognizable public technology signatures were detected on inspected storefront pages. This does not prove that no third-party technologies exist.');
  }
  limitations.push('Product and collection counts are discovered public records, not verified total store counts.');
  limitations.push('Variant records are captured from public product responses and inspected product pages; they are not a verified store-wide total.');
  limitations.push('Checkout customisations and admin configuration are not publicly inspectable.');
  limitations.push('Prices reflect the public storefront response; multi-market pricing was not assessed.');

  const findings = buildFindings(products, seo, technologies, collections, hasMultiLocale, multiLocaleEvidence);
  const finishedAt = new Date().toISOString();

  const result: ScanResult = {
    scanId: randomUUID(),
    status: errors.length ? 'failed' : warnings.length ? 'completed_with_warnings' : 'completed',
    requestedUrl,
    finalUrl,
    store: {
      domain: new URL(finalUrl).hostname,
      shopifyDetected,
      detectionEvidence: shopifyDetected ? [{ source: 'html', locator: finalUrl, excerpt: 'Shopify storefront indicators found in homepage HTML.' }] : [],
      ...(storeName ? { name: storeName } : {}),
      ...(currency ? { currency } : {})
    },
    startedAt,
    finishedAt,
    durationMs: Date.now() - started,
    pagesInspected: pages,
    discovery,
    products,
    collections,
    variants,
    seo,
    technologies,
    portabilityIndicators: findings.map(f => ({
      id: f.id,
      label: f.title,
      category: f.category,
      detail: f.description,
      severity: f.severity,
      confidence: f.confidence,
      basis: f.basis,
      evidence: f.evidence
    })),
    findings,
    dataLimitations: [...new Set(limitations)],
    errors,
    warnings,
    summary: {
      productsFound: products.length,
      collectionsFound: collections.length,
      variantsFound: variants.length,
      findingsBySeverity: findings.reduce<Record<string, number>>((a, f) => {
        a[f.severity] = (a[f.severity] ?? 0) + 1;
        return a;
      }, {}),
      pagesInspected: pages.length
    }
  };

  return ScanResultSchema.parse(result);
}
