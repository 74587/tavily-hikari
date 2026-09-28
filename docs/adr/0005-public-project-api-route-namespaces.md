# ADR 0005: Public Project APIs Use Domain-Specific Versioned Routes

Public project APIs use `/api/public/{domain}/v1/{project}` so the route names both the resource family and its owning project. Hikari and CVM blog-runtime resources use `blog-runtime`, while OctoRill metrics use `metrics`; each contract keeps its domain-specific route without aliases or coupling metrics under the blog-runtime namespace.
