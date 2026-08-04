# Issue tracker: GitHub

Issues and PRDs for this repository live in GitHub Issues. Use the `gh` CLI for all operations.

## Conventions

- Create issues with `gh issue create` and read them with `gh issue view <number> --comments`.
- Use `gh issue list` with explicit state and label filters to discover work.
- Comment, label, assign, and close issues with the matching `gh issue` commands.
- Infer the repository from the existing Git remote; do not change remote or authentication settings.

## Pull requests as a triage surface

**PRs as a request surface: no.**

Pull requests remain delivery artifacts. They are not included in the issue triage queue.

## Publishing and fetching

- When a skill says to publish to the issue tracker, create a GitHub Issue.
- When a skill says to fetch a ticket, read the matching GitHub Issue and its comments.
- A bare `#<number>` refers to this repository unless a canonical external URL is supplied.

## Initiative work

An aggregate initiative uses one tracker Issue plus child Issues. Dependencies use GitHub's native
issue dependency API when available and retain a textual `Depends on` field for replay safety.
