import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeFetch } from '../src/scan/fetcher/safeFetch.js';
import * as urlGuard from '../src/scan/fetcher/urlGuard.js';

describe('safeFetch reliability & safety limits', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Stub URL validation to accept test URLs safely
    vi.spyOn(urlGuard, 'validatePublicUrl').mockImplementation(async (u: string) => new URL(u));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('rejects immediately when Content-Length header exceeds safety limit', async () => {
    const hugeBytes = 50 * 1024 * 1024; // 50 MB
    global.fetch = vi.fn().mockResolvedValue(
      new Response('small preview', {
        status: 200,
        headers: { 'content-length': String(hugeBytes) }
      })
    );

    await expect(safeFetch('https://example.com/huge.xml')).rejects.toThrow(/exceeded the .* safety ceiling/i);
  });

  it('aborts stream when response chunks exceed maximum response bytes', async () => {
    // Generate a stream exceeding 10MB
    const chunk = new Uint8Array(2 * 1024 * 1024); // 2 MB chunks
    let count = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (count < 7) { // 7 * 2MB = 14MB > 10MB limit
          controller.enqueue(chunk);
          count++;
        } else {
          controller.close();
        }
      }
    });

    global.fetch = vi.fn().mockResolvedValue(
      new Response(stream, { status: 200 })
    );

    await expect(safeFetch('https://example.com/stream.json')).rejects.toThrow(/exceeded the .* safety ceiling/i);
  });

  it('does NOT retry permanent HTTP failures such as 403 Forbidden and 404 Not Found', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return new Response('Access denied', { status: 403 });
    });

    const res = await safeFetch('https://example.com/products.json');
    expect(res.status).toBe(403);
    expect(callCount).toBe(1);
    expect(res.attempts).toBe(1);
    expect(res.retries).toBe(0);
  });

  it('does NOT retry 404 Not Found', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return new Response('Not found', { status: 404 });
    });

    const res = await safeFetch('https://example.com/collections.json');
    expect(res.status).toBe(404);
    expect(callCount).toBe(1);
    expect(res.attempts).toBe(1);
    expect(res.retries).toBe(0);
  });

  it('retries temporary HTTP failures (429, 503) with bounded attempts', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 2) {
        return new Response('Rate limited', {
          status: 429,
          headers: { 'retry-after': '0' }
        });
      }
      return new Response('{"status":"ok"}', { status: 200 });
    });

    const res = await safeFetch('https://example.com/products.json');
    expect(res.status).toBe(200);
    expect(callCount).toBe(2);
    expect(res.attempts).toBe(2);
    expect(res.retries).toBe(1);
  });
});
