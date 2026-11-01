import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

export class UrlGuardError extends Error {
  constructor(message: string) { super(message); this.name = 'UrlGuardError'; }
}

function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);
    if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) return false;
    return parsed.range() === 'unicast';
  } catch { return false; }
}

export async function validatePublicUrl(input: string, allowedPorts = [80,443]): Promise<URL> {
  let url: URL;
  try { url = new URL(input); } catch { throw new UrlGuardError('A valid absolute URL is required.'); }
  if (!['http:','https:'].includes(url.protocol)) throw new UrlGuardError('Only HTTP and HTTPS URLs are allowed.');
  if (url.username || url.password) throw new UrlGuardError('URLs containing credentials are not allowed.');
  if (url.hash) url.hash = '';
  const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80);
  if (!allowedPorts.includes(port)) throw new UrlGuardError('This destination port is not allowed.');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new UrlGuardError('Local destinations are not allowed.');
  if (ipaddr.isValid(host)) {
    if (!isPublicAddress(host)) throw new UrlGuardError('Private or non-public IP destinations are not allowed.');
  } else {
    let records: Awaited<ReturnType<typeof dns.lookup>>[];
    try { records = await dns.lookup(host, { all: true, verbatim: true }) as unknown as Awaited<ReturnType<typeof dns.lookup>>[]; }
    catch { throw new UrlGuardError('The hostname could not be resolved.'); }
    if (!Array.isArray(records) || records.length === 0 || records.some((r: {address:string}) => !isPublicAddress(r.address))) {
      throw new UrlGuardError('The hostname resolves to a non-public address.');
    }
  }
  return url;
}
