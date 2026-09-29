# ADR 0006: Shared Versioned Prefix for Public Metrics

Status: Accepted

## Context

Three related services expose public aggregate metrics. Their routes need one stable prefix, while each service remains the sole owner and implementation of its own metrics data.

## Decision

All three interfaces use the `/api/public/metrics/v1` prefix and a final project slug to identify the metrics instance:

- `GET /api/public/metrics/v1/codex-vibe-monitor`
- `GET /api/public/metrics/v1/tavily-hikari`
- `GET /api/public/metrics/v1/octo-rill`

Each project independently implements its dedicated GET endpoint. An endpoint does not wrap or reuse another business interface. It returns only approved aggregate fields and never exposes raw logs, request content, keys, user identifiers, IP addresses, URLs, or error details.

Each implementation caches for approximately 10 seconds to one minute, merges concurrent refreshes through single-flight behavior, and serves last-good data after a refresh failure. A cold snapshot that cannot be verified returns `503`. CORS uses an explicit origin allowlist, without wildcard origins or credentials.

Metric dates use Asia/Shanghai boundaries. Current and newly recorded data must not disappear without cause; unavailable historical data may remain unknown. Unknown values are not converted to zero. Trends follow the Hikari public metrics contract for length and future empty positions, and every numeric value is non-negative.

## Consequences

- The project slug is the only route segment that distinguishes these three metrics instances.
- Hikari uses `/api/public/metrics/v1/tavily-hikari`; its approved response fields remain unchanged.
- Each owning repository updates its own endpoint and deployment guidance. This decision does not authorize changes to the other projects from this repository.
- This decision supersedes [ADR 0005](0005-public-project-api-route-namespaces.md).
