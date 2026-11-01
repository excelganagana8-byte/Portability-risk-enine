import { describe, it, expect } from 'vitest';
import {
  parseCollectionsJson,
  parseCollectionUrl,
  extractCollectionsFromHtml,
  extractCollectionsFromSitemap
} from '../src/scan/parse/collections.js';

describe('Shopify collection parsing & alternative discovery', () => {
  it('parses standard collections.json when endpoint is available', () => {
    const payload = {
      collections: [
        { handle: 'mens-wear', title: "Men's Wear" },
        { handle: 'womens-wear', title: "Women's Wear" }
      ]
    };
    const result = parseCollectionsJson(payload, 'https://gymshark.com', 10);
    expect(result).toHaveLength(2);
    expect(result[0]?.handle).toBe('mens-wear');
    expect(result[0]?.title).toBe("Men's Wear");
    expect(result[0]?.evidence[0]?.source).toBe('collections-json');
  });

  it('correctly parses root and localized collection URLs', () => {
    const root = parseCollectionUrl('https://gymshark.com/collections/mens-t-shirts');
    expect(root.isCollectionUrl).toBe(true);
    expect(root.handle).toBe('mens-t-shirts');

    const localized = parseCollectionUrl('https://gymshark.com/es-US/collections/womens-leggings');
    expect(localized.isCollectionUrl).toBe(true);
    expect(localized.handle).toBe('womens-leggings');

    const productInCol = parseCollectionUrl('https://gymshark.com/collections/mens/products/shirt');
    expect(productInCol.isCollectionUrl).toBe(false);
  });

  it('discovers collections from HTML navigation links when endpoint returns 404', () => {
    const html = `
      <nav>
        <a href="/collections/mens-hoodies">Men's Hoodies</a>
        <a href="/collections/womens-leggings" title="Women's Leggings">Leggings</a>
        <a href="/collections/all">View All</a> <!-- generic ignored -->
        <a href="/products/shirt">Shirt</a>
      </nav>
    `;
    const result = extractCollectionsFromHtml(html, 'https://gymshark.com', 'https://gymshark.com', 10);
    expect(result).toHaveLength(2);
    expect(result.map(c => c.handle)).toEqual(['mens-hoodies', 'womens-leggings']);
    expect(result[0]?.title).toBe("Men's Hoodies");
    expect(result[0]?.evidence[0]?.source).toBe('html');
    expect(result[0]?.evidence[0]?.note).toContain('navigation');
  });

  it('discovers collections from XML sitemap', () => {
    const sitemapXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://gymshark.com/collections/seamless</loc></url>
        <url><loc>https://gymshark.com/collections/oversized</loc></url>
        <url><loc>https://gymshark.com/collections/seamless</loc></url> <!-- duplicate -->
        <url><loc>https://gymshark.com/products/shirt</loc></url>
      </urlset>
    `;
    const result = extractCollectionsFromSitemap(sitemapXml, 'https://gymshark.com/sitemap.xml', 'https://gymshark.com', 10);
    expect(result).toHaveLength(2);
    expect(result.map(c => c.handle)).toEqual(['seamless', 'oversized']);
    expect(result[0]?.evidence[0]?.source).toBe('sitemap');
  });
});
