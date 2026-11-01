# PRE — Portability Risk Engine

Milestone 1 is a public Shopify storefront scanner for preliminary Shopify → WooCommerce portability assessment.

It collects public evidence, records limitations, and produces structured findings. It does **not** migrate data, access private Shopify admin information, or calculate a final portability score.

## Requirements
- Node.js 20 or newer
- npm 10 or newer
- Internet connection for scanning public storefronts

## Windows PowerShell setup
```powershell
cd path\to\pre
npm install
Copy-Item .env.example .env
npm run dev
```
Open the frontend at http://localhost:5173. The API runs at http://localhost:3000.

## Commands
```powershell
npm run dev
npm run build
npm run typecheck
npm test
```

## API
- `GET /api/health`
- `POST /api/scan` with JSON `{ "url": "https://store.example" }`
- `GET /api/openapi.json` (see `docs/openapi.yaml`)

A scan is synchronous and may take up to 90 seconds. Public endpoints may be unavailable; partial results and limitations are expected. Discovery requests make up to two bounded retries for HTTP 429 and selected transient 5xx responses, respect a valid `Retry-After` header, and record attempts/retries in the report.

## Important limitations
Public scanning cannot inspect private app installations, admin settings, customer/order records, checkout customisations, private metafields, or server-side integrations. A detected script is not proof of a complete app installation. Product and collection endpoints may be blocked or incomplete. Counts are discovered public records, not verified store-wide totals. Variant records are captured only from products returned by the public product endpoint. A successful HTTP response does not establish completeness.

## Scope exclusions
No migration execution, WooCommerce importer, customer/order migration, financial loss prediction, final portability score, billing, user authentication, multi-platform scanning, or PostgreSQL persistence in this milestone.

## Security note
The scanner includes URL checks, DNS resolution checks, manual redirect handling, request timeouts, response caps and crawl budgets. This is an MVP implementation, not a substitute for a production security review. In particular, production-grade DNS pinning must ensure the outbound socket connects to the validated IP; standard Node `fetch` may perform its own DNS lookup. Do not expose this service publicly until the transport-level pinning, per-IP concurrency controls, robots policy, and deployment hardening have been reviewed and tested.
