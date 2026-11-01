import type { ScanResult } from '../types/scan';

export async function scanStore(url: string): Promise<ScanResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal
    });
    const data = (await response.json()) as
      | ScanResult
      | { error?: { message?: string }; errors?: Array<{ message?: string }> };

    if (!response.ok) {
      if (data && typeof data === 'object') {
        if ('error' in data && data.error?.message) {
          throw new Error(data.error.message);
        }
        if ('errors' in data && Array.isArray(data.errors) && data.errors.length > 0) {
          throw new Error(data.errors[0]?.message || `Scan failed (${response.status})`);
        }
      }
      throw new Error(`Scan failed (${response.status})`);
    }
    return data as ScanResult;
  } finally {
    clearTimeout(timeout);
  }
}
