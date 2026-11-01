# Discovery reliability semantics

PRE's public scan is an evidence sample, not a source of guaranteed store-wide totals.

## Endpoint outcomes

Each product and collection discovery operation records one of:

- `success`: the endpoint returned the expected JSON structure. This does not mean the result is complete.
- `rate_limited`: the endpoint still returned HTTP 429 after bounded retries.
- `http_error`: the endpoint returned another non-success HTTP status after bounded retries where applicable.
- `unavailable`: the request could not be completed (network, timeout, URL validation, or similar failure).
- `invalid_response`: HTTP 200 was returned, but the response did not contain the expected JSON array.

## Retry policy

PRE makes at most two retries for HTTP 429, 500, 502, 503, and 504. It honors a valid `Retry-After` header up to a five-second wait; otherwise it uses bounded exponential waits beginning at one second. It does not retry arbitrary client errors. Attempt and retry counts are included in the scan report.

This is intentionally conservative for anonymous public storefront requests. Shopify documents that API limits differ by API and that automated storefront crawlers can be limited; PRE therefore treats rate limits as an expected partial-data condition, not as proof that the resource is absent.

## Count and confidence rules

- `discoveredCount` is the number of records PRE received and retained, not a verified store total.
- `completeness: unknown` means a public sample was received but no complete inventory was established.
- `completeness: partial` means PRE hit its configured inspection cap or used a limited sitemap fallback.
- A successful empty response is reported as zero discovered records, with an explicit note that this does not prove the store has none.
- Product variant records are extracted from the variants included in each discovered product. The report does not claim those variants represent the whole store.

## Known remaining limits

The public `/products.json` and `/collections.json` endpoints are not an authenticated merchant export. Pagination coverage is not exhaustive in this milestone. Storefront themes, bot protection, markets, endpoint visibility, and platform responses can change between scans. Merchant-authorized API assessment is a later, separate mode.
