import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runScan } from '../src/scan/orchestrator.js';
import * as urlGuard from '../src/scan/fetcher/urlGuard.js';

describe('Scanner orchestrator end-to-end fixture validation', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.spyOn(urlGuard, 'validatePublicUrl').mockImplementation(async (u: string) => new URL(u));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('handles a storefront with blocked public endpoints via sitemap & navigation fallbacks', async () => {
    // Simulates Gymshark scenario:
    // - Homepage OK (Shopify indicators present)
    // - /products.json -> 403 Forbidden
    // - /collections.json -> 404 Not Found
    // - /sitemap.xml -> child sitemaps with localized duplicate product URLs
    // - product HTML pages -> variants discovered in JSON-LD & embedded JSON
    global.fetch = vi.fn().mockImplementation(async (urlInput: string | URL) => {
      const urlStr = urlInput.toString();

      if (urlStr === 'https://store.example/' || urlStr === 'https://store.example') {
        return new Response(
          `<!DOCTYPE html>
           <html>
           <head>
             <title>Gymshark Store</title>
             <meta property="og:site_name" content="Gymshark">
             <link rel="preconnect" href="https://cdn.shopify.com">
             <link rel="preconnect" href="https://static.klaviyo.com">
             <script>window.Shopify = { shop: 'gymshark.myshopify.com' };</script>
           </head>
           <body>
             <nav>
               <a href="/collections/seamless-leggings">Seamless Leggings</a>
               <a href="/collections/power-collection">Power Collection</a>
             </nav>
           </body>
           </html>`,
          { status: 200, headers: { 'content-type': 'text/html' } }
        );
      }

      if (urlStr.includes('/products.json')) {
        return new Response('Forbidden', { status: 403 });
      }

      if (urlStr.includes('/collections.json')) {
        return new Response('Not Found', { status: 404 });
      }

      if (urlStr.includes('/sitemap.xml')) {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
           <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
             <sitemap><loc>https://store.example/sitemap_products_1.xml</loc></sitemap>
             <sitemap><loc>https://store.example/sitemap_collections_1.xml</loc></sitemap>
           </sitemapindex>`,
          { status: 200, headers: { 'content-type': 'application/xml' } }
        );
      }

      if (urlStr.includes('/sitemap_collections_1.xml')) {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
           <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
             <url><loc>https://store.example/collections/seamless-leggings</loc></url>
             <url><loc>https://store.example/collections/oversized-hoodies</loc></url>
           </urlset>`,
          { status: 200, headers: { 'content-type': 'application/xml' } }
        );
      }

      if (urlStr.includes('/sitemap_products_1.xml')) {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
           <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
             <url><loc>https://store.example/products/crest-t-shirt</loc></url>
             <url><loc>https://store.example/es-US/products/crest-t-shirt</loc></url>
             <url><loc>https://store.example/products/apex-shorts</loc></url>
             <url><loc>https://store.example/es-US/products/apex-shorts</loc></url>
           </urlset>`,
          { status: 200, headers: { 'content-type': 'application/xml' } }
        );
      }

      if (urlStr.includes('/products/crest-t-shirt')) {
        return new Response(
          `<!DOCTYPE html>
           <html>
           <head>
             <title>Crest T-Shirt | Gymshark</title>
             <script type="application/json" id="ProductJson-1">
             {
               "id": 101,
               "title": "Crest T-Shirt",
               "handle": "crest-t-shirt",
               "options": ["Size"],
               "variants": [
                 { "id": 1001, "title": "S", "sku": "CRST-S", "price": 2500, "available": true, "option1": "S" },
                 { "id": 1002, "title": "M", "sku": "CRST-M", "price": 2500, "available": true, "option1": "M" },
                 { "id": 1003, "title": "L", "sku": "CRST-L", "price": 2500, "available": false, "option1": "L" }
               ]
             }
             </script>
           </head>
           <body><h1>Crest T-Shirt</h1></body>
           </html>`,
          { status: 200, headers: { 'content-type': 'text/html' } }
        );
      }

      if (urlStr.includes('/products/apex-shorts')) {
        return new Response(
          `<!DOCTYPE html>
           <html>
           <head>
             <title>Apex Shorts | Gymshark</title>
             <script type="application/ld+json">
             {
               "@context": "https://schema.org",
               "@type": "Product",
               "name": "Apex Shorts",
               "offers": [
                 { "@type": "Offer", "name": "Medium", "sku": "APX-M", "price": "45.00", "priceCurrency": "USD", "availability": "https://schema.org/InStock", "url": "https://store.example/products/apex-shorts?variant=2001" },
                 { "@type": "Offer", "name": "Large", "sku": "APX-L", "price": "45.00", "priceCurrency": "USD", "availability": "https://schema.org/InStock", "url": "https://store.example/products/apex-shorts?variant=2002" }
               ]
             }
             </script>
           </head>
           <body><h1>Apex Shorts</h1></body>
           </html>`,
          { status: 200, headers: { 'content-type': 'text/html' } }
        );
      }

      return new Response('Not found', { status: 404 });
    });

    const result = await runScan('https://store.example');

    // 1. Store detection
    expect(result.store.shopifyDetected).toBe(true);
    expect(result.store.name).toBe('Gymshark');

    // 2. Product discovery & locale deduplication:
    // Although sitemap contained 4 URLs (/ and /es-US/ for 2 products), exactly 2 unique products should be discovered!
    expect(result.products).toHaveLength(2);
    expect(result.discovery.products.discoveredCount).toBe(2);
    expect(result.discovery.products.status).toBe('success');
    expect(result.discovery.products.completeness).toBe('partial');
    expect(result.products.map(p => p.handle)).toEqual(['crest-t-shirt', 'apex-shorts']);

    // Alternate locale URLs preserved in evidence
    const crestProd = result.products.find(p => p.handle === 'crest-t-shirt');
    expect(crestProd?.evidence.some(e => e.locator.includes('/es-US/'))).toBe(true);

    // 3. Variant discovery:
    // Crest T-Shirt has 3 variants from embedded JSON
    // Apex Shorts has 2 variants from JSON-LD
    expect(result.variants).toHaveLength(5);
    expect(result.summary.variantsFound).toBe(5);
    expect(crestProd?.variantCount).toBe(3);
    expect(crestProd?.priceRange.min).toBe(25);

    const apexProd = result.products.find(p => p.handle === 'apex-shorts');
    expect(apexProd?.variantCount).toBe(2);
    expect(apexProd?.priceRange.min).toBe(45);

    // 4. Collection discovery:
    // collections.json failed (404), but fallback discovered collections from sitemap and navigation
    expect(result.collections.length).toBeGreaterThanOrEqual(2);
    expect(result.discovery.collections.status).toBe('success');
    expect(result.discovery.collections.completeness).toBe('partial');
    expect(result.collections.some(c => c.handle === 'seamless-leggings')).toBe(true);

    // 5. Portability findings include WooCommerce relevance and Multi-locale Markets detection
    const findingIds = result.findings.map(f => f.id);
    expect(findingIds).toContain('multi-locale-routing');
    expect(findingIds).toContain('url-structure-redirects');

    const localeFinding = result.findings.find(f => f.id === 'multi-locale-routing');
    expect(localeFinding?.recommendedInvestigation).toContain('WooCommerce');

    // 6. Report status
    expect(result.status).toBe('completed_with_warnings');
    expect(result.warnings.some(w => w.code === 'PRODUCTS_ENDPOINT_UNAVAILABLE')).toBe(true);
  });
});
