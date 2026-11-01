import type { ProductRecord, Evidence } from '../types.js';
import { parseHtml } from './html.js';
import { extractJsonLd } from './structuredData.js';

export type ParsedVariant = {
  productHandle: string;
  id?: string | number;
  title: string;
  sku?: string;
  price?: number | null;
  available?: boolean | null;
  optionValues: Record<string, string>;
  evidence: Evidence[];
};

type ShopifyVariant = {
  id?: string | number;
  title?: string;
  sku?: string;
  price?: string | number;
  available?: boolean;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
};

type ShopifyProduct = {
  id?: string | number;
  handle?: string;
  title?: string;
  variants?: ShopifyVariant[];
  options?: Array<{ name?: string; values?: string[] } | string>;
  tags?: string[] | string;
  product_type?: string;
};

// Recognizes Shopify localized product URLs:
// e.g. /products/handle, /es-US/products/handle, /en-gb/products/handle, /fr/products/handle
const PRODUCT_URL_REGEX = /^(?:\/([a-z]{2}(?:-[a-zA-Z]{2,4})?))?\/products\/([a-zA-Z0-9\-_%]+)/i;

export interface NormalizedProductUrl {
  handle: string;
  locale?: string;
  isProductUrl: boolean;
  canonicalPath: string;
}

export function parseProductUrl(urlStr: string): NormalizedProductUrl {
  try {
    const parsed = new URL(urlStr);
    const match = parsed.pathname.match(PRODUCT_URL_REGEX);
    if (!match) {
      return { handle: '', isProductUrl: false, canonicalPath: parsed.pathname };
    }
    const locale = match[1] || undefined;
    const rawHandle = match[2] || '';
    const handle = decodeURIComponent(rawHandle).toLowerCase();
    return {
      handle,
      locale,
      isProductUrl: true,
      canonicalPath: `/products/${encodeURIComponent(handle)}`
    };
  } catch {
    return { handle: '', isProductUrl: false, canonicalPath: '' };
  }
}

export interface DeduplicatedProductGroup {
  handle: string;
  primaryUrl: string;
  alternateUrls: string[];
}

export function deduplicateProductUrls(urls: string[], baseUrl: string): DeduplicatedProductGroup[] {
  const groups = new Map<string, { primaryUrl: string; alternateUrls: string[] }>();
  const baseOrigin = new URL(baseUrl).origin;

  for (const raw of urls) {
    let fullUrl = raw;
    try {
      fullUrl = new URL(raw, baseUrl).toString();
    } catch {
      continue;
    }

    const { handle, locale, isProductUrl } = parseProductUrl(fullUrl);
    if (!isProductUrl || !handle) continue;

    const existing = groups.get(handle);
    if (!existing) {
      groups.set(handle, { primaryUrl: fullUrl, alternateUrls: [] });
    } else {
      // If the existing primary URL was localized, but this new one is root (no locale),
      // promote the root URL to primaryUrl and demote the localized URL to alternateUrls.
      if (!locale && parseProductUrl(existing.primaryUrl).locale) {
        existing.alternateUrls.push(existing.primaryUrl);
        existing.primaryUrl = fullUrl;
      } else if (existing.primaryUrl !== fullUrl && !existing.alternateUrls.includes(fullUrl)) {
        existing.alternateUrls.push(fullUrl);
      }
    }
  }

  return [...groups.entries()].map(([handle, info]) => ({
    handle,
    primaryUrl: info.primaryUrl,
    alternateUrls: info.alternateUrls
  }));
}

export function parseProductsJsonDetailed(payload: unknown, baseUrl: string, maxProducts: number): { products: ProductRecord[]; variants: ParsedVariant[] } {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { products?: unknown }).products)) return { products: [], variants: [] };
  const source = (payload as { products: ShopifyProduct[] }).products;
  const selected = source.slice(0, maxProducts).filter(p => typeof p.handle === 'string');
  const products: ProductRecord[] = [];
  const variants: ParsedVariant[] = [];

  for (const p of selected) {
    const handle = p.handle!;
    const productUrl = new URL(`/products/${encodeURIComponent(handle)}`, baseUrl).toString();
    const endpoint = new URL('/products.json', baseUrl).toString();
    const evidence: Evidence[] = [{ source: 'products-json', locator: endpoint, excerpt: `Product "${p.title ?? handle}" returned by Shopify public products endpoint.` }];
    const tags = Array.isArray(p.tags) ? p.tags : typeof p.tags === 'string' ? p.tags.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    const productVariants = p.variants ?? [];
    const prices = productVariants.map(v => Number(v.price)).filter(n => Number.isFinite(n));
    products.push({
      handle,
      title: p.title ?? handle,
      url: productUrl,
      priceRange: { min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null },
      variantCount: productVariants.length,
      options: (p.options ?? []).map((o, i) => {
        if (typeof o === 'string') return { name: o, valueCount: 0 };
        return { name: o.name ?? `Option ${i + 1}`, valueCount: o.values?.length ?? 0 };
      }),
      ...(tags ? { tags } : {}),
      ...(p.product_type ? { productType: p.product_type } : {}),
      available: productVariants.some(v => v.available === true) ? true : productVariants.some(v => v.available === false) ? false : null,
      evidence
    });

    for (const v of productVariants) {
      const optionNames = (p.options ?? []).map((o, i) => (typeof o === 'string' ? o : o.name) || `Option ${i + 1}`);
      const optionValues: Record<string, string> = {};
      [v.option1, v.option2, v.option3].forEach((value, i) => {
        if (value && value !== 'Default Title') optionValues[optionNames[i] ?? `Option ${i + 1}`] = value;
      });
      const numericPrice = v.price === undefined || v.price === null || v.price === '' ? null : Number(v.price);
      variants.push({
        productHandle: handle,
        ...(v.id !== undefined ? { id: v.id } : {}),
        title: v.title || 'Default Title',
        ...(v.sku ? { sku: v.sku } : {}),
        price: numericPrice !== null && Number.isFinite(numericPrice) ? numericPrice : null,
        available: typeof v.available === 'boolean' ? v.available : null,
        optionValues,
        evidence: [{ source: 'products-json', locator: endpoint, excerpt: `Variant for product "${p.title ?? handle}" returned by Shopify public products endpoint.` }]
      });
    }
  }
  return { products, variants };
}

export function parseProductsJson(payload: unknown, baseUrl: string, maxProducts: number): ProductRecord[] {
  return parseProductsJsonDetailed(payload, baseUrl, maxProducts).products;
}

export function extractProductFromHtml(
  html: string,
  pageUrl: string,
  baseUrl: string,
  alternateUrls: string[] = []
): { product: ProductRecord; variants: ParsedVariant[] } | null {
  const $ = parseHtml(html);
  const { handle: urlHandle } = parseProductUrl(pageUrl);
  if (!urlHandle) return null;

  const rawTitle = $('meta[property="og:title"]').attr('content') || $('title').first().text().trim();
  const title = (rawTitle || urlHandle).replace(/\s*–\s*.*$|\s*\|\s*.*$/, '').trim();

  const evidence: Evidence[] = [
    {
      source: 'html',
      locator: pageUrl,
      excerpt: `Product page title: "${title.slice(0, 100)}"`
    }
  ];

  for (const altUrl of alternateUrls) {
    const { locale } = parseProductUrl(altUrl);
    evidence.push({
      source: 'url-pattern',
      locator: altUrl,
      note: locale ? `Localized product URL (${locale})` : 'Alternative product URL'
    });
  }

  const variants: ParsedVariant[] = [];
  const optionsMap = new Map<string, Set<string>>();
  let detectedCurrency: string | undefined;

  // 1. Check embedded Shopify product JSON
  $('script[type="application/json"]').each((_, el) => {
    if (variants.length > 0) return;
    const text = $(el).contents().text().trim();
    if (!text.includes('"variants"') && !text.includes('"title"')) return;
    try {
      const data = JSON.parse(text);
      const productObj: ShopifyProduct | undefined =
        data && typeof data === 'object' && Array.isArray((data as ShopifyProduct).variants)
          ? (data as ShopifyProduct)
          : data && typeof data === 'object' && (data as { product?: ShopifyProduct }).product && Array.isArray((data as { product: ShopifyProduct }).product.variants)
          ? (data as { product: ShopifyProduct }).product
          : undefined;

      if (productObj && Array.isArray(productObj.variants) && productObj.variants.length > 0) {
        const rawOptions = productObj.options ?? [];
        const optNames = rawOptions.map((o, i) => (typeof o === 'string' ? o : o.name) || `Option ${i + 1}`);

        for (const v of productObj.variants) {
          const optValues: Record<string, string> = {};
          [v.option1, v.option2, v.option3].forEach((val, i) => {
            if (val && val !== 'Default Title') {
              const name = optNames[i] ?? `Option ${i + 1}`;
              optValues[name] = val;
              if (!optionsMap.has(name)) optionsMap.set(name, new Set());
              optionsMap.get(name)!.add(val);
            }
          });

          let p: number | null = null;
          if (v.price !== undefined && v.price !== null && v.price !== '') {
            const rawP = Number(v.price);
            if (Number.isFinite(rawP)) {
              // Shopify liquid embedded product JSON often stores price in cents (e.g. 2500 for $25.00)
              p = typeof v.price === 'number' && Number.isInteger(v.price) && rawP > 500 && String(v.price).length >= 4
                ? rawP / 100
                : rawP;
            }
          }

          variants.push({
            productHandle: urlHandle,
            ...(v.id !== undefined ? { id: v.id } : {}),
            title: v.title || 'Default Title',
            ...(v.sku ? { sku: v.sku } : {}),
            price: p,
            available: typeof v.available === 'boolean' ? v.available : null,
            optionValues: optValues,
            evidence: [
              {
                source: 'html',
                locator: pageUrl,
                excerpt: `Embedded product JSON variant: "${(v.title || urlHandle).slice(0, 100)}"`
              }
            ]
          });
        }
      }
    } catch {}
  });

  // 2. Fallback to JSON-LD offers if embedded JSON was not present
  if (variants.length === 0) {
    const jsonLd = extractJsonLd(html);
    const jsonLdProd = jsonLd.products[0];
    if (jsonLdProd?.offers && jsonLdProd.offers.length > 0) {
      if (jsonLdProd.priceRange?.currency) {
        detectedCurrency = jsonLdProd.priceRange.currency;
      }
      for (const off of jsonLdProd.offers) {
        let variantId: string | undefined;
        if (off.url) {
          try {
            const u = new URL(off.url, pageUrl);
            const vParam = u.searchParams.get('variant');
            if (vParam) variantId = vParam;
          } catch {}
        }
        const vTitle = off.name && off.name !== title ? off.name : 'Default Title';
        const optValues: Record<string, string> = {};
        if (vTitle !== 'Default Title') {
          optValues['Variant'] = vTitle;
          if (!optionsMap.has('Variant')) optionsMap.set('Variant', new Set());
          optionsMap.get('Variant')!.add(vTitle);
        }

        variants.push({
          productHandle: urlHandle,
          ...(variantId ? { id: variantId } : {}),
          title: vTitle,
          ...(off.sku ? { sku: off.sku } : {}),
          price: off.price ?? null,
          available: off.availability ?? null,
          optionValues: optValues,
          evidence: [
            {
              source: 'json-ld',
              locator: pageUrl,
              excerpt: `JSON-LD offer: "${(off.name || off.sku || 'variant').slice(0, 100)}"`
            }
          ]
        });
      }
    }
  }

  // 3. Fallback to HTML form elements
  if (variants.length === 0) {
    $('form[action*="/cart/add"] select[name="id"] option').each((_, el) => {
      const val = $(el).val();
      const text = $(el).text().trim();
      if (!val || text.toLowerCase().includes('select')) return;
      const sku = $(el).attr('data-sku');
      const rawPrice = $(el).attr('data-price');
      const p = rawPrice ? Number(rawPrice) : null;

      variants.push({
        productHandle: urlHandle,
        id: String(val),
        title: text || 'Default Title',
        ...(sku ? { sku } : {}),
        price: p !== null && Number.isFinite(p) ? p : null,
        available: !$(el).is(':disabled'),
        optionValues: text && text !== 'Default Title' ? { Option: text } : {},
        evidence: [
          {
            source: 'html',
            locator: pageUrl,
            excerpt: `Form option: "${text.slice(0, 100)}"`
          }
        ]
      });
    });
  }

  // Derive options summary from discovered variants
  const options: Array<{ name: string; valueCount: number }> = [];
  for (const [name, set] of optionsMap.entries()) {
    options.push({ name, valueCount: set.size });
  }

  // Prices
  const prices = variants.map(v => v.price).filter((p): p is number => p !== null && Number.isFinite(p));
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;

  // Availability
  const hasAvailable = variants.some(v => v.available === true);
  const hasUnavailable = variants.some(v => v.available === false);
  const availability = hasAvailable ? true : hasUnavailable ? false : null;

  const product: ProductRecord = {
    handle: urlHandle,
    title,
    url: pageUrl,
    priceRange: { min: minPrice, max: maxPrice, ...(detectedCurrency ? { currency: detectedCurrency } : {}) },
    variantCount: variants.length,
    options,
    available: availability,
    evidence
  };

  return { product, variants };
}
