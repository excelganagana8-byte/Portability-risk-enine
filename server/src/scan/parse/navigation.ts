import { parseHtml } from './html.js';
export function extractLinks(html: string, base: string): string[] {
  const $ = parseHtml(html); const out = new Set<string>();
  $('a[href]').each((_,el)=>{ try { const u = new URL($(el).attr('href')!,base); if (u.origin === new URL(base).origin) out.add(u.toString()); } catch {} });
  return [...out];
}
