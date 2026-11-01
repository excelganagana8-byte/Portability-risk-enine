import type { Finding, ProductRecord, Evidence, CollectionRecord } from '../types.js';

interface TechItem {
  id: string;
  label: string;
  category: string;
  confidence: 'low' | 'medium' | 'high';
  evidence: Evidence[];
}

interface SeoItem {
  pageUrl: string;
  issues: string[];
  evidence: Evidence[];
}

export function buildFindings(
  products: ProductRecord[],
  seo: SeoItem[],
  technologies: TechItem[],
  collections: CollectionRecord[] = [],
  hasMultiLocale = false,
  multiLocaleEvidence: Evidence[] = []
): Finding[] {
  const findings: Finding[] = [];

  // 1. Variant complexity
  const highVariant = products.filter(p => p.variantCount > 20);
  if (highVariant.length) {
    findings.push({
      id: 'high-variant-products',
      category: 'variants',
      title: 'Products with large variant matrices',
      description: `${highVariant.length} inspected product(s) have more than 20 variants. In WooCommerce, variable products with >30 variations trigger AJAX loading and increase database postmeta rows. Destination variation limits and option indexing must be configured.`,
      severity: 'medium',
      confidence: 'high',
      basis: 'observed',
      evidence: highVariant.slice(0, 5).flatMap(p => p.evidence.slice(0, 2)),
      recommendedInvestigation: 'Requires data mapping and destination performance tuning. WooCommerce supports variable products natively (AJAX threshold defaults to 30 variations); confirm server memory, caching, and variation indexing for large matrices.'
    });
  }

  // 2. Multi-option dimensions (3 options)
  const threeOptionProducts = products.filter(p => p.options.length >= 3);
  if (threeOptionProducts.length) {
    findings.push({
      id: 'multi-option-products',
      category: 'variants',
      title: 'Multi-axis product option matrices (3+ options)',
      description: `${threeOptionProducts.length} inspected product(s) have 3 or more option dimensions (e.g. Size, Color, Fit). Shopify caps options at 3; WooCommerce supports unlimited attributes, but requires structured taxonomy mapping.`,
      severity: 'low',
      confidence: 'high',
      basis: 'observed',
      evidence: threeOptionProducts.slice(0, 5).flatMap(p => p.evidence.slice(0, 1)),
      recommendedInvestigation: 'Has direct WooCommerce equivalent (WooCommerce custom or global product attributes). Map Shopify option names to WooCommerce attribute taxonomies to preserve layered navigation filters.'
    });
  }

  // 3. Tag density vs taxonomy mapping
  const tagHeavy = products.filter(p => (p.tags?.length ?? 0) > 10);
  if (tagHeavy.length) {
    findings.push({
      id: 'tag-heavy-products',
      category: 'products',
      title: 'High product tag density',
      description: `${tagHeavy.length} inspected product(s) use more than 10 tags. In Shopify, tags are flat strings used for automated collections, search, and faceted filtering. In WooCommerce, catalog hierarchy relies on categories (product_cat) and tags (product_tag).`,
      severity: 'low',
      confidence: 'high',
      basis: 'observed',
      evidence: tagHeavy.slice(0, 5).flatMap(p => p.evidence.slice(0, 1)),
      recommendedInvestigation: 'Requires data mapping. Distinguish tags used for navigational grouping (which should map to WooCommerce hierarchical categories) from descriptive search tags (which map to product_tag).'
    });
  }

  // 4. URL structure and 301 redirection
  if (products.length > 0 || collections.length > 0) {
    const urlEvidence: Evidence[] = [];
    if (products[0]) urlEvidence.push(...products[0].evidence.slice(0, 1));
    if (collections[0]) urlEvidence.push(...collections[0].evidence.slice(0, 1));

    findings.push({
      id: 'url-structure-redirects',
      category: 'seo',
      title: 'Shopify URL structure requires 301 redirect mapping',
      description: 'Shopify routes products under /products/:handle and collections under /collections/:handle. WooCommerce defaults to /product/:slug and /product-category/:slug. Preserving search equity and existing backlinks requires a complete 301 redirect table.',
      severity: 'medium',
      confidence: 'high',
      basis: 'observed',
      evidence: urlEvidence.length ? urlEvidence : [{ source: 'url-pattern', locator: '/products/', note: 'Standard Shopify storefront URL structure' }],
      recommendedInvestigation: 'Requires data mapping and 301 redirects. Plan redirect rules (via web server configuration or a WordPress redirection extension) from /products/* and /collections/* to target WooCommerce permalinks.'
    });
  }

  // 5. Multi-locale / Shopify Markets
  if (hasMultiLocale) {
    findings.push({
      id: 'multi-locale-routing',
      category: 'structure',
      title: 'Localized storefront routing detected (Shopify Markets)',
      description: 'Product or sitemap URLs include language/region subfolders (e.g. /es-US/, /en-gb/). Shopify Markets manages localization in a single backend, whereas core WooCommerce is single-locale out of the box.',
      severity: 'medium',
      confidence: 'high',
      basis: 'observed',
      evidence: multiLocaleEvidence.slice(0, 5),
      recommendedInvestigation: 'Requires a plugin or alternative architecture. Evaluate multilingual plugins (e.g. WPML, Polylang) and multi-currency extensions (e.g. WooCommerce Multi-Currency) or WordPress Multisite to recreate regional routing.'
    });
  }

  // 6. SEO metadata gaps
  const seoIssues = seo.filter(s => s.issues.length);
  if (seoIssues.length) {
    findings.push({
      id: 'seo-metadata-gaps',
      category: 'seo',
      title: 'SEO metadata gaps detected on inspected pages',
      description: `${seoIssues.length} inspected page(s) have missing or inconsistent SEO titles, meta descriptions, or canonical URLs.`,
      severity: 'medium',
      confidence: 'high',
      basis: 'observed',
      evidence: seoIssues.slice(0, 5).flatMap(s => s.evidence.slice(0, 1)),
      recommendedInvestigation: 'Requires data mapping. Export existing title tags, meta descriptions, and canonical URLs for import into a WooCommerce SEO suite (e.g. Yoast SEO, Rank Math).'
    });
  }

  // 7. Third-party applications and public technologies
  for (const tech of technologies) {
    const isApp = ['app', 'marketing', 'support', 'checkout'].includes(tech.category);
    if (!isApp) continue;

    let rec: string;
    let severity: 'info' | 'low' | 'medium' | 'high' = 'low';

    switch (tech.id) {
      case 'klaviyo':
        rec = 'Has direct WooCommerce equivalent (official Klaviyo for WooCommerce plugin). Email templates, customer sync, and event triggers can be connected directly.';
        break;
      case 'gorgias':
        rec = 'Has direct WooCommerce equivalent (official Gorgias plugin for WooCommerce). Customer support chat and ticket history integrate natively.';
        break;
      case 'yotpo':
      case 'judge-me':
      case 'loox':
      case 'okendo':
      case 'bazaarvoice':
      case 'stamped':
        rec = 'Requires a plugin or data migration. Review UGC, star ratings, and review photos must be exported to CSV and imported into WooCommerce native reviews or an equivalent review plugin.';
        break;
      case 'recharge':
      case 'bold-subscriptions':
      case 'skio':
        severity = 'medium';
        rec = 'Requires a plugin alternative (e.g. WooCommerce Subscriptions). Recurring subscription orders, payment gateway customer tokens, and billing frequencies require specialized migration planning.';
        break;
      case 'algolia':
      case 'searchanise':
      case 'boost-commerce':
        rec = 'Has direct WooCommerce equivalent or plugin alternative (e.g. Algolia for WooCommerce). Search indices and filtering facets must be re-indexed in the destination.';
        break;
      case 'onetrust':
      case 'cookiebot':
        rec = 'Has direct WooCommerce equivalent (OneTrust / Cookiebot WordPress plugin). Banner styling and consent categories can be re-applied.';
        break;
      case 'klarna':
      case 'afterpay':
        rec = 'Has direct WooCommerce equivalent (official Klarna Payments / Afterpay WooCommerce payment gateways). Merchant accounts must be linked to WooCommerce.';
        break;
      default:
        rec = `Requires a plugin or alternative service. Verify whether ${tech.label} provides an official WooCommerce extension or API integration, and confirm data export feasibility.`;
        break;
    }

    findings.push({
      id: `dependency-${tech.id}`,
      category: 'apps',
      title: `Public dependency signal: ${tech.label}`,
      description: `A public storefront signal associated with ${tech.label} was detected. This represents functionality that must be accounted for in the WooCommerce destination.`,
      severity,
      confidence: tech.confidence,
      basis: 'observed',
      evidence: tech.evidence,
      recommendedInvestigation: rec
    });
  }

  return findings;
}
