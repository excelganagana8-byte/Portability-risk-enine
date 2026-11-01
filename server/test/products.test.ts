import { describe, it, expect } from 'vitest';
import {
  parseProductsJson,
  parseProductsJsonDetailed,
  parseProductUrl,
  deduplicateProductUrls,
  extractProductFromHtml
} from '../src/scan/parse/products.js';

describe('Shopify product parsing & URL normalization', () => {
  it('normalizes product variant counts and prices from products.json', () => {
    const result = parseProductsJson(
      {
        products: [
          {
            handle: 'shirt',
            title: 'Shirt',
            variants: [{ price: '10.00', available: true }, { price: '15.00', available: false }],
            options: [{ name: 'Size', values: ['S', 'M'] }]
          }
        ]
      },
      'https://shop.example',
      10
    );
    expect(result[0]?.variantCount).toBe(2);
    expect(result[0]?.priceRange.min).toBe(10);
    expect(result[0]?.priceRange.max).toBe(15);
  });

  it('captures variant records and their option values separately from products.json', () => {
    const result = parseProductsJsonDetailed(
      {
        products: [
          {
            handle: 'shirt',
            title: 'Shirt',
            options: [{ name: 'Size', values: ['S', 'M'] }, { name: 'Color', values: ['Blue'] }],
            variants: [
              {
                id: 123,
                title: 'M / Blue',
                sku: 'SH-M-B',
                price: '19.99',
                available: true,
                option1: 'M',
                option2: 'Blue'
              }
            ]
          }
        ]
      },
      'https://shop.example',
      10
    );
    expect(result.products).toHaveLength(1);
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0]?.id).toBe(123);
    expect(result.variants[0]?.optionValues).toEqual({ Size: 'M', Color: 'Blue' });
    expect(result.variants[0]?.price).toBe(19.99);
  });

  describe('Locale-aware URL parsing and deduplication', () => {
    it('correctly parses root and localized product URLs', () => {
      const root = parseProductUrl('https://gymshark.com/products/crest-t-shirt');
      expect(root.isProductUrl).toBe(true);
      expect(root.handle).toBe('crest-t-shirt');
      expect(root.locale).toBeUndefined();

      const esUS = parseProductUrl('https://gymshark.com/es-US/products/crest-t-shirt?variant=123');
      expect(esUS.isProductUrl).toBe(true);
      expect(esUS.handle).toBe('crest-t-shirt');
      expect(esUS.locale).toBe('es-US');

      const fr = parseProductUrl('https://gymshark.com/fr/products/crest-t-shirt');
      expect(fr.isProductUrl).toBe(true);
      expect(fr.handle).toBe('crest-t-shirt');
      expect(fr.locale).toBe('fr');

      const collection = parseProductUrl('https://gymshark.com/collections/mens');
      expect(collection.isProductUrl).toBe(false);
    });

    it('deduplicates localized variants of the same product without merging different products', () => {
      const urls = [
        'https://gymshark.com/products/crest-t-shirt',
        'https://gymshark.com/es-US/products/crest-t-shirt',
        'https://gymshark.com/fr-ca/products/crest-t-shirt',
        'https://gymshark.com/products/apex-seamless-shorts',
        'https://gymshark.com/es-US/products/apex-seamless-shorts'
      ];

      const deduplicated = deduplicateProductUrls(urls, 'https://gymshark.com');
      expect(deduplicated).toHaveLength(2);

      const crest = deduplicated.find(d => d.handle === 'crest-t-shirt');
      expect(crest).toBeDefined();
      expect(crest?.primaryUrl).toBe('https://gymshark.com/products/crest-t-shirt');
      expect(crest?.alternateUrls).toContain('https://gymshark.com/es-US/products/crest-t-shirt');
      expect(crest?.alternateUrls).toContain('https://gymshark.com/fr-ca/products/crest-t-shirt');

      const apex = deduplicated.find(d => d.handle === 'apex-seamless-shorts');
      expect(apex).toBeDefined();
      expect(apex?.primaryUrl).toBe('https://gymshark.com/products/apex-seamless-shorts');
      expect(apex?.alternateUrls).toContain('https://gymshark.com/es-US/products/apex-seamless-shorts');
    });

    it('promotes root URL as primary even if localized URL was encountered first in sitemap', () => {
      const urls = [
        'https://gymshark.com/es-US/products/power-hoodie',
        'https://gymshark.com/products/power-hoodie'
      ];

      const deduplicated = deduplicateProductUrls(urls, 'https://gymshark.com');
      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0]?.primaryUrl).toBe('https://gymshark.com/products/power-hoodie');
      expect(deduplicated[0]?.alternateUrls).toEqual(['https://gymshark.com/es-US/products/power-hoodie']);
    });
  });

  describe('Variant discovery from HTML product pages', () => {
    it('extracts variants and options from embedded Shopify JSON script tags', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Apex Seamless Shorts | Gymshark</title>
          <meta property="og:title" content="Apex Seamless Shorts">
          <script type="application/json" id="ProductJson-12345">
          {
            "id": 987654321,
            "title": "Apex Seamless Shorts",
            "handle": "apex-seamless-shorts",
            "options": ["Size", "Color"],
            "variants": [
              {
                "id": 40101,
                "title": "Small / Onyx Grey",
                "sku": "APX-S-GRY",
                "price": 4500,
                "available": true,
                "option1": "Small",
                "option2": "Onyx Grey"
              },
              {
                "id": 40102,
                "title": "Medium / Onyx Grey",
                "sku": "APX-M-GRY",
                "price": 4500,
                "available": false,
                "option1": "Medium",
                "option2": "Onyx Grey"
              }
            ]
          }
          </script>
        </head>
        <body></body>
        </html>
      `;

      const result = extractProductFromHtml(
        html,
        'https://gymshark.com/products/apex-seamless-shorts',
        'https://gymshark.com',
        ['https://gymshark.com/es-US/products/apex-seamless-shorts']
      );

      expect(result).not.toBeNull();
      expect(result?.product.handle).toBe('apex-seamless-shorts');
      expect(result?.product.title).toBe('Apex Seamless Shorts');
      expect(result?.product.variantCount).toBe(2);
      expect(result?.product.priceRange.min).toBe(45);
      expect(result?.product.available).toBe(true);
      expect(result?.product.options).toEqual([
        { name: 'Size', valueCount: 2 },
        { name: 'Color', valueCount: 1 }
      ]);
      expect(result?.variants).toHaveLength(2);
      expect(result?.variants[0]?.id).toBe(40101);
      expect(result?.variants[0]?.sku).toBe('APX-S-GRY');
      expect(result?.variants[0]?.price).toBe(45);
      expect(result?.variants[0]?.available).toBe(true);
      expect(result?.variants[0]?.optionValues).toEqual({ Size: 'Small', Color: 'Onyx Grey' });
      // Alternate URL is recorded in evidence
      expect(result?.product.evidence.some(e => e.locator.includes('es-US'))).toBe(true);
    });

    it('extracts variants from JSON-LD offers when embedded JSON is not present', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Gymshark Speed T-Shirt</title>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Gymshark Speed T-Shirt",
            "offers": [
              {
                "@type": "Offer",
                "name": "Small",
                "sku": "SPD-S",
                "price": "32.00",
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock",
                "url": "https://gymshark.com/products/speed-t-shirt?variant=501"
              },
              {
                "@type": "Offer",
                "name": "Medium",
                "sku": "SPD-M",
                "price": "32.00",
                "priceCurrency": "USD",
                "availability": "https://schema.org/OutOfStock",
                "url": "https://gymshark.com/products/speed-t-shirt?variant=502"
              }
            ]
          }
          </script>
        </head>
        <body></body>
        </html>
      `;

      const result = extractProductFromHtml(
        html,
        'https://gymshark.com/products/speed-t-shirt',
        'https://gymshark.com'
      );

      expect(result).not.toBeNull();
      expect(result?.product.variantCount).toBe(2);
      expect(result?.product.priceRange.min).toBe(32);
      expect(result?.product.priceRange.currency).toBe('USD');
      expect(result?.variants).toHaveLength(2);
      expect(result?.variants[0]?.id).toBe('501');
      expect(result?.variants[0]?.sku).toBe('SPD-S');
      expect(result?.variants[0]?.available).toBe(true);
      expect(result?.variants[1]?.available).toBe(false);
    });

    it('extracts variants from cart form select options as last fallback', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Training Tank</title>
        </head>
        <body>
          <form action="/cart/add" method="post">
            <select name="id">
              <option value="601" data-sku="TRN-S" data-price="20">Small - $20</option>
              <option value="602" data-sku="TRN-L" data-price="20" disabled>Large - $20</option>
            </select>
          </form>
        </body>
        </html>
      `;

      const result = extractProductFromHtml(
        html,
        'https://gymshark.com/products/training-tank',
        'https://gymshark.com'
      );

      expect(result).not.toBeNull();
      expect(result?.product.variantCount).toBe(2);
      expect(result?.variants[0]?.id).toBe('601');
      expect(result?.variants[0]?.available).toBe(true);
      expect(result?.variants[1]?.available).toBe(false);
    });

    it('handles product pages with zero variants without inventing missing data', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Gift Card</title>
        </head>
        <body>
          <h1>Gift Card</h1>
        </body>
        </html>
      `;

      const result = extractProductFromHtml(
        html,
        'https://gymshark.com/products/gift-card',
        'https://gymshark.com'
      );

      expect(result).not.toBeNull();
      expect(result?.product.variantCount).toBe(0);
      expect(result?.product.options).toEqual([]);
      expect(result?.variants).toHaveLength(0);
    });
  });
});
