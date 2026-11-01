# Security controls and limitations

- Only HTTP/HTTPS; rejects URL credentials and local/private IP destinations after DNS resolution.
- Redirects are manual and each hop is revalidated; maximum five hops.
- Request timeout, response byte cap, page/product/collection caps and concurrency settings are configurable.
- API JSON body limited to 4 KB and scan endpoint rate-limited.
- No cookies, credentials, auth headers, challenge bypass, or raw response-body logging.

## Important production hardening
The initial safeFetch uses Node's built-in fetch after DNS validation. Because fetch can resolve the hostname again internally, this is not strict DNS pinning and remains vulnerable to DNS rebinding in some threat models. Before public deployment, replace the transport with an undici dispatcher/custom lookup that pins the validated address while retaining correct TLS SNI and Host behavior. Add a per-IP single-flight scan lock, robots.txt parser enforcement, IPv4/IPv6 exhaustive address-range tests, outbound network policy, and an independent security review.
