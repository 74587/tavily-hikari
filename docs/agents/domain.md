# Domain Docs

This repository uses a single-context domain documentation layout.

## Before exploring

- Read the root `CONTEXT.md` for domain vocabulary and boundaries.
- Read relevant decisions under `docs/adr/` before changing the affected architecture.
- If either source is absent or does not cover the topic, continue without inventing domain facts.

## Consumer rules

- Use terms defined in `CONTEXT.md`; avoid introducing synonyms for established concepts.
- Surface conflicts with an existing ADR instead of silently overriding it.
- Add domain terms or ADRs only when a durable decision has actually been made.

## Layout

```text
/
|- CONTEXT.md
|- docs/adr/
`- src/
```
