import { describe, it, expect } from 'vitest';
import { detectTechnologies } from '../src/scan/detect/scripts.js';

describe('Public technology signature detection', () => {
  it('detects technologies from script src tags with high confidence', () => {
    const html = `
      <html>
      <head>
        <script src="https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=123"></script>
        <script src="https://cdn.shopify.com/s/files/1/theme.js"></script>
        <script src="https://cdn.cookielaw.org/scripttemplates/otSDKStub.js"></script>
      </head>
      <body></body>
      </html>
    `;
    const detected = detectTechnologies(html, 'https://gymshark.com');
    const ids = detected.map(t => t.id);

    expect(ids).toContain('klaviyo');
    expect(ids).toContain('shopify-cdn');
    expect(ids).toContain('onetrust');

    const klaviyo = detected.find(t => t.id === 'klaviyo');
    expect(klaviyo?.confidence).toBe('high');
    expect(klaviyo?.disclaimer).toBeDefined();
    expect(klaviyo?.evidence[0]?.source).toBe('html');
  });

  it('detects technologies from inline scripts and SDK initialization', () => {
    const html = `
      <html>
      <head>
        <script>
          window.datadogRum && window.datadogRum.init({ applicationId: 'abc', clientToken: 'xyz' });
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)}}(window, document,'script');
          fbq('init', '123456789');
        </script>
      </head>
      <body></body>
      </html>
    `;
    const detected = detectTechnologies(html, 'https://gymshark.com');
    const ids = detected.map(t => t.id);

    expect(ids).toContain('datadog-rum');
    expect(ids).toContain('meta-pixel');
    expect(detected.find(t => t.id === 'datadog-rum')?.confidence).toBe('high');
  });

  it('detects technologies from HTTP headers and link preconnects', () => {
    const html = `
      <html>
      <head>
        <link rel="preconnect" href="https://cdn.klarna.com">
      </head>
      <body></body>
      </html>
    `;
    const headers = new Headers({
      'server': 'cloudflare',
      'cf-ray': '8dc8e7abcdef-IAD'
    });
    const detected = detectTechnologies(html, 'https://gymshark.com', headers);
    const ids = detected.map(t => t.id);

    expect(ids).toContain('cloudflare');
    expect(ids).toContain('klarna');
  });

  it('returns empty array when no known public signatures match without false positives', () => {
    const html = '<html><head><title>Clean Shop</title></head><body><h1>Hello</h1></body></html>';
    const detected = detectTechnologies(html, 'https://clean.example');
    expect(detected).toEqual([]);
  });
});
