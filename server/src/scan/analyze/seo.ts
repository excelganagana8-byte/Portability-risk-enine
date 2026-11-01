import { parseHtml } from '../parse/html.js';
import { extractJsonLd } from '../parse/structuredData.js';
import type { Evidence } from '../types.js';
export function analyzeSeo(html: string, pageUrl: string) {
  const $ = parseHtml(html);
  const title = $('title').first().text().trim() || undefined;
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || undefined;
  const canonicalRaw = $('link[rel="canonical"]').attr('href');
  let canonical: string | undefined;
  try { if (canonicalRaw) canonical = new URL(canonicalRaw,pageUrl).toString(); } catch {}
  const json = extractJsonLd(html);
  const evidence: Evidence[] = [{source:'html',locator:pageUrl,excerpt:`title=${(title ?? '').slice(0,100)}`}];
  return {
    pageUrl, title, titleLength:title?.length, metaDescription, metaDescriptionLength:metaDescription?.length,
    canonical, canonicalMatchesRequested:canonical ? canonical === pageUrl : null,
    h1Count:$('h1').length, jsonLdTypes:json.types,
    issues:[...(!title?['Missing page title']:[]),...(!metaDescription?['Missing meta description']:[]),...(canonical && canonical !== pageUrl?['Canonical URL differs from inspected URL']:[])],
    evidence
  };
}
