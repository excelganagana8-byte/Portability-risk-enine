import { limits } from './limits.js';
import { validatePublicUrl, UrlGuardError } from './urlGuard.js';

export interface SafeResponse {
  url: string;
  status: number;
  headers: Headers;
  body: string;
  bytes: number;
  attempts: number;
  retries: number;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;

function retryDelayMs(response: Response, retryIndex: number): number {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 5_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay) && dateDelay > 0) return Math.min(dateDelay, 5_000);
  }
  // Shopify recommends waiting before retrying throttled requests. Keep the
  // anonymous storefront scanner conservative and bounded.
  return Math.min(1_000 * (2 ** retryIndex), 4_000);
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Request timed out or scan was cancelled.'));
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    const timer = setTimeout(() => { cleanup(); resolve(); }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('Request timed out or scan was cancelled.'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function safeFetch(input: string, options: { signal?: AbortSignal; accept?: string } = {}): Promise<SafeResponse> {
  let current = input;
  let redirects = 0;
  let attempts = 0;
  let retries = 0;

  while (redirects <= 5) {
    const url = await validatePublicUrl(current);
    let retryIndex = 0;

    while (true) {
      attempts += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), limits.requestTimeoutMs);
      const abort = () => controller.abort();
      options.signal?.addEventListener('abort', abort, { once: true });
      try {
        // Redirects are manual so each new destination is validated separately.
        const response = await fetch(url, {
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'user-agent': limits.userAgent,
            accept: options.accept ?? 'text/html,application/json,application/xml;q=0.9,*/*;q=0.5'
          }
        });

        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location) throw new Error('Redirect response did not include a location.');
          if (redirects === 5) throw new Error('Maximum redirect count exceeded.');
          current = new URL(location, url).toString();
          redirects += 1;
          break;
        }

        if (RETRYABLE_STATUS.has(response.status) && retryIndex < MAX_RETRIES) {
          const delay = retryDelayMs(response, retryIndex);
          await response.body?.cancel();
          retryIndex += 1;
          retries += 1;
          clearTimeout(timer);
          options.signal?.removeEventListener('abort', abort);
          await wait(delay, options.signal);
          continue;
        }

        // Fast rejection if Content-Length exceeds ceiling
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          const parsedLength = Number(contentLength);
          if (Number.isFinite(parsedLength) && parsedLength > limits.maxResponseBytes) {
            await response.body?.cancel();
            throw new Error(`Response exceeded the ${Math.round(limits.maxResponseBytes / 1024 / 1024)} MB safety ceiling (Content-Length: ${parsedLength} bytes).`);
          }
        }

        // Stream body with strict byte-counting ceiling
        const reader = response.body?.getReader();
        let body = '';
        let bytes = 0;
        if (reader) {
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              bytes += value.byteLength;
              if (bytes > limits.maxResponseBytes) {
                await reader.cancel();
                throw new Error(`Response exceeded the ${Math.round(limits.maxResponseBytes / 1024 / 1024)} MB safety ceiling.`);
              }
              body += decoder.decode(value, { stream: true });
            }
            body += decoder.decode();
          } catch (streamError) {
            try { await reader.cancel(); } catch {}
            throw streamError;
          }
        }
        return {
          url: response.url || url.toString(),
          status: response.status,
          headers: response.headers,
          body,
          bytes,
          attempts,
          retries
        };
      } catch (error) {
        if (error instanceof UrlGuardError) throw error;
        if (controller.signal.aborted) throw new Error('Request timed out or scan was cancelled.');
        throw error;
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
      }
    }
  }
  throw new Error('Redirect handling failed.');
}
