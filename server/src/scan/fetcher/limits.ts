import { env } from '../../config/env.js';
export const limits = {
  maxPages: env.PRE_MAX_PAGES, maxProducts: env.PRE_MAX_PRODUCTS,
  maxCollections: env.PRE_MAX_COLLECTIONS, concurrency: Math.min(3, env.PRE_MAX_CONCURRENCY),
  requestTimeoutMs: env.PRE_REQUEST_TIMEOUT_MS, scanTimeoutMs: env.PRE_SCAN_TIMEOUT_MS,
  maxResponseBytes: env.PRE_MAX_RESPONSE_BYTES, userAgent: env.PRE_SCANNER_USER_AGENT
};
