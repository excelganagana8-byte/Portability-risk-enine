# Architecture

The server pipeline is validate → public URL guard → homepage discovery → Shopify signal detection → products/collections public endpoints → sitemap fallback → HTML/SEO parsing → technology signatures → portability findings → Zod-validated report.

Modules are separated by responsibility under `server/src/scan`. `orchestrator.ts` coordinates stages. Zod schemas in `scan/types.ts` define the API contract. The Vue client renders the returned report.

## Deliberate M1 trade-offs
- No database; scan output is returned directly.
- No final portability score.
- Synchronous scan endpoint, bounded by request and scan budgets.
- Discovery is best-effort and gracefully degrades when public endpoints are blocked.
