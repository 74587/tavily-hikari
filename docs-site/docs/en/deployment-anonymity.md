# Deployment & Anonymity

## Pick a deployment shape

Most installations fall into one of these buckets:

- local or single-container POC: prove the image, console, and proxy routes first
- self-hosted long-running instance: terminate TLS yourself and use built-in admin login
- gateway mode: run Hikari behind Caddy, Nginx, Traefik, or another reverse proxy that injects trusted admin identity headers

## Minimum runtime parameters

No matter which shape you choose, these are the core runtime inputs:

| Flag / Env                        | Purpose                               |
| --------------------------------- | ------------------------------------- |
| `--bind` / `PROXY_BIND`           | listen address                        |
| `--port` / `PROXY_PORT`           | listen port                           |
| `--db-path` / `PROXY_DB_PATH`     | SQLite database path                  |
| `--static-dir` / `WEB_STATIC_DIR` | frontend static assets directory      |
| `--upstream` / `TAVILY_UPSTREAM`  | Tavily MCP upstream                   |
| `TAVILY_USAGE_BASE`               | Tavily HTTP / usage upstream base URL |

You also need one admin access strategy:

- ForwardAuth for production or zero-trust gateways
- built-in admin login for self-hosted single-instance setups
- `DEV_OPEN_ADMIN=true` for local or disposable validation only

## Minimum Compose deployment

The repository root ships a stock
[`docker-compose.yml`](https://github.com/IvanLi-CN/tavily-hikari/blob/main/docker-compose.yml):

```bash
docker compose up -d
curl -i http://127.0.0.1:8787/health
```

That file already:

- listens on `0.0.0.0:8787`
- mounts the `tavily-hikari-data` volume
- persists SQLite at `/srv/app/data/tavily_proxy.db`
- runs `ghcr.io/ivanli-cn/tavily-hikari:latest`

It does not provide an admin gateway on its own, so add one of these before real admin work:

- temporary local validation: set `DEV_OPEN_ADMIN=true`
- self-hosted mode: enable built-in admin login
- formal gateway mode: switch to `examples/forwardauth-caddy`

## ForwardAuth gateway example

For production-style gateway wiring, the repository already includes:

- [examples/forwardauth-caddy](https://github.com/IvanLi-CN/tavily-hikari/tree/main/examples/forwardauth-caddy)

Start it directly:

```bash
cd examples/forwardauth-caddy
docker compose up -d
```

That example launches:

- Caddy as the gateway
- `auth-mock` as a ForwardAuth simulator
- `upstream-mock` as a Tavily upstream simulator
- Tavily Hikari itself

Default behavior:

- `GET /health` is public
- everything else is protected by Basic Auth
- on success, Caddy forwards `Remote-Email` and `Remote-Name` to Hikari
- Hikari treats `Remote-Email=admin@example.com` as admin

Use it when you want to validate the gateway, identity-header, and Hikari chain before replacing
the mocks with your real auth system and real Tavily upstream.

## Built-in admin login for self-hosting

If you do not have a separate ForwardAuth gateway, enable the built-in admin login instead.

Recommended setup:

```bash
export ADMIN_AUTH_BUILTIN_ENABLED=true
echo -n 'change-me' | cargo run --quiet --bin admin_password_hash
export ADMIN_AUTH_BUILTIN_PASSWORD_HASH='<phc-string>'
export ADMIN_AUTH_FORWARD_ENABLED=false
```

Key points:

- prefer `ADMIN_AUTH_BUILTIN_PASSWORD_HASH` over plaintext passwords
- keep TLS termination trustworthy so the session cookie can reliably use `Secure`
- treat built-in admin as a self-hosted convenience mode, not the default zero-trust production path

## Checklist before exposing it

- `/health` returns 200
- at least one upstream Tavily key is registered
- an admin can access `/admin` or `/api/keys`
- at least one `/api/tavily/search` or `/mcp` call succeeds
- the database directory is persisted outside the container lifecycle

## Persistence, backup, and upgrades

The key long-lived data is the SQLite file:

- default container path: `/srv/app/data/tavily_proxy.db`
- back it up before upgrades
- the container image itself is stateless, so most upgrades are just a new tag plus restart
- if you maintain Caddy or reverse-proxy config alongside it, back that up too

## High-anonymity forwarding

Tavily Hikari can strip or rewrite sensitive headers before proxying upstream traffic.

The important behaviors are:

- dropping `Forwarded`, `X-Forwarded-*`, `Via`, `CF-*`, and similar chain-revealing headers
- rewriting `Origin` and `Referer` when needed
- recording `forwarded_headers` and `dropped_headers` in SQLite for debugging

For the deeper design notes, see:

[`docs/high-anonymity-proxy.md`](https://github.com/IvanLi-CN/tavily-hikari/blob/main/docs/high-anonymity-proxy.md)

## Recommended public surfaces

Typical exposed surfaces are:

- public homepage and user console
- `/admin` for operators
- `/api/tavily/*` for downstream HTTP clients
- `/mcp` for proxied MCP traffic

## Release surface

The main release artifact is a container image published to:

`ghcr.io/ivanli-cn/tavily-hikari:<tag>`

That image includes the compiled frontend bundle. The public docs-site and Storybook are published
separately through GitHub Pages.

If the deployment gets stuck on admin access, SQLite persistence, or upstream `502` problems,
continue with [FAQ & Troubleshooting](/faq).
