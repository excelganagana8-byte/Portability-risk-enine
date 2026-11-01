import { parseHtml } from './html.js';

export interface JsonLdOffer {
  name?: string;
  sku?: string;
  price?: number | null;
  currency?: string;
  availability?: boolean | null;
  url?: string;
}

export interface JsonLdProduct {
  name?: string;
  url?: string;
  description?: string;
  sku?: string;
  offers?: JsonLdOffer[];
  priceRange?: { min: number | null; max: number | null; currency?: string };
}

function parseAvailability(val: unknown): boolean | null {
  if (typeof val !== 'string') return null;
  if (/InStock|PreOrder|BackOrder/i.test(val)) return true;
  if (/OutOfStock|Discontinued|SoldOut/i.test(val)) return false;
  return null;
}

function parseNumericPrice(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

export function extractJsonLd(html: string): {
  types: string[];
  products: JsonLdProduct[];
} {
  const $ = parseHtml(html);
  const types = new Set<string>();
  const products: JsonLdProduct[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw.trim()) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      const visit = (value: unknown): void => {
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        if (!value || typeof value !== 'object') return;
        const obj = value as Record<string, unknown>;
        const t = obj['@type'];
        for (const type of Array.isArray(t) ? t : [t]) {
          if (typeof type === 'string') types.add(type);
        }

        const isProduct = t === 'Product' || (Array.isArray(t) && t.includes('Product'));
        if (isProduct) {
          const rawOffers = obj.offers;
          const offerList: JsonLdOffer[] = [];
          const prices: number[] = [];
          let currency: string | undefined;

          const processOffer = (off: unknown) => {
            if (!off || typeof off !== 'object') return;
            const o = off as Record<string, unknown>;
            const p = parseNumericPrice(o.price);
            if (p !== null) prices.push(p);
            if (typeof o.priceCurrency === 'string') currency = o.priceCurrency;

            offerList.push({
              name: typeof o.name === 'string' ? o.name : undefined,
              sku: typeof o.sku === 'string' ? o.sku : undefined,
              price: p,
              currency: typeof o.priceCurrency === 'string' ? o.priceCurrency : undefined,
              availability: parseAvailability(o.availability),
              url: typeof o.url === 'string' ? o.url : undefined
            });
          };

          if (Array.isArray(rawOffers)) {
            rawOffers.forEach(processOffer);
          } else if (rawOffers && typeof rawOffers === 'object') {
            const ro = rawOffers as Record<string, unknown>;
            if (Array.isArray(ro.offers)) {
              ro.offers.forEach(processOffer);
            } else {
              processOffer(ro);
            }
          }

          products.push({
            name: typeof obj.name === 'string' ? obj.name : undefined,
            url: typeof obj.url === 'string' ? obj.url : undefined,
            description: typeof obj.description === 'string' ? obj.description : undefined,
            sku: typeof obj.sku === 'string' ? obj.sku : undefined,
            offers: offerList.length ? offerList : undefined,
            priceRange: prices.length ? {
              min: Math.min(...prices),
              max: Math.max(...prices),
              currency
            } : undefined
          });
        }

        if (obj['@graph']) visit(obj['@graph']);
      };
      visit(parsed);
    } catch {
      // Malformed JSON-LD is ignored; caller reports available evidence only
    }
  });

  return { types: [...types], products };
}
