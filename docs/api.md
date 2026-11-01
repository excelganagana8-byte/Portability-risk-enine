# API

## GET /api/health
Returns service status and version.

## POST /api/scan
Request:
```json
{ "url": "https://example-shop.com" }
```
Returns a `ScanResult` JSON object. A scan may take up to 90 seconds. Invalid requests return 400; upstream scan failures return 502; rate limits return 429.

## GET /api/openapi.json
OpenAPI document is planned as a static documentation artifact in `docs/openapi.yaml`.
