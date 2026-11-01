import { parseHtml } from '../parse/html.js';
import { signatures } from './techSignatures.js';
import type { Evidence } from '../types.js';

export interface DetectedTechnology {
  id: string;
  label: string;
  category: 'app' | 'analytics' | 'marketing' | 'support' | 'checkout' | 'theme' | 'cdn' | 'other';
  confidence: 'low' | 'medium' | 'high';
  evidence: Evidence[];
  disclaimer?: string;
}

export function detectTechnologies(html: string, pageUrl: string, headers?: Headers): DetectedTechnology[] {
  const $ = parseHtml(html);
  const scripts: string[] = [];
  const links: string[] = [];
  const inlineScripts: string[] = [];
  const metaTags: string[] = [];

  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) {
      try {
        const u = new URL(src, pageUrl);
        scripts.push(u.hostname + u.pathname);
      } catch {
        scripts.push(src);
      }
    }
  });

  $('link[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      try {
        const u = new URL(href, pageUrl);
        links.push(u.hostname + u.pathname);
      } catch {
        links.push(href);
      }
    }
  });

  $('script:not([src])').each((_, el) => {
    const text = $(el).contents().text();
    if (text) {
      inlineScripts.push(text);
    }
  });

  $('meta').each((_, el) => {
    const name = $(el).attr('name') || $(el).attr('property') || '';
    const content = $(el).attr('content') || '';
    if (name || content) {
      metaTags.push(`${name}=${content}`);
    }
  });

  return signatures.flatMap(sig => {
    const matchedEvidence: Evidence[] = [];
    let confidence: 'low' | 'medium' | 'high' = 'medium';

    if (sig.host) {
      const matchedScripts = scripts.filter(s => sig.host?.test(s));
      for (const s of matchedScripts.slice(0, 3)) {
        matchedEvidence.push({
          source: 'html',
          locator: pageUrl,
          excerpt: `script src: ${s.slice(0, 150)}`
        });
        confidence = 'high';
      }

      if (!matchedEvidence.length) {
        const matchedLinks = links.filter(l => sig.host?.test(l));
        for (const l of matchedLinks.slice(0, 2)) {
          matchedEvidence.push({
            source: 'html',
            locator: pageUrl,
            excerpt: `link href: ${l.slice(0, 150)}`
          });
          confidence = 'medium';
        }
      }
    }

    if (sig.inline && !matchedEvidence.length) {
      for (const code of inlineScripts) {
        const match = code.match(sig.inline);
        if (match) {
          const start = Math.max(0, match.index! - 20);
          const excerpt = code.slice(start, start + 120).trim();
          matchedEvidence.push({
            source: 'html',
            locator: pageUrl,
            excerpt: `inline script: ${excerpt}`
          });
          confidence = 'high';
          break;
        }
      }
    }

    if (sig.meta && !matchedEvidence.length) {
      for (const meta of metaTags) {
        if (sig.meta.test(meta)) {
          matchedEvidence.push({
            source: 'html',
            locator: pageUrl,
            excerpt: `meta tag: ${meta.slice(0, 120)}`
          });
          confidence = 'medium';
          break;
        }
      }
    }

    if (sig.header && headers && !matchedEvidence.length) {
      const headerVal = headers.get(sig.header.name);
      if (headerVal && sig.header.pattern.test(headerVal)) {
        matchedEvidence.push({
          source: 'http',
          locator: pageUrl,
          excerpt: `header ${sig.header.name}: ${headerVal.slice(0, 100)}`
        });
        confidence = 'medium';
      }
    }

    if (!matchedEvidence.length) return [];

    if (sig.id === 'shopify-cdn') {
      confidence = 'high';
    }

    return [{
      id: sig.id,
      label: sig.label,
      category: sig.category,
      confidence,
      evidence: matchedEvidence.slice(0, 3),
      disclaimer: ['app', 'marketing', 'support', 'checkout'].includes(sig.category)
        ? 'Public script evidence does not prove complete app installation, configuration or plan.'
        : undefined
    }];
  });
}
