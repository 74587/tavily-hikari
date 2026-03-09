#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHIM_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$SHIM_DIR"
}
trap cleanup EXIT

cat >"$SHIM_DIR/node" <<'SHIM'
#!/usr/bin/env bash
echo "unexpected node invocation: $*" >&2
exit 1
SHIM
chmod +x "$SHIM_DIR/node"

export PATH="$SHIM_DIR:$PATH"

pushd "$ROOT_DIR" >/dev/null

echo "[no-node] using shim at $(command -v node)"
bunx --bun dprint --version
bunx --bun commitlint --version
(
  cd web
  bun run build
  bun run build-storybook
)

popd >/dev/null
