#!/usr/bin/env bash
set -euo pipefail

show_help() {
  cat <<'EOF'
Usage: run_snapshot_comparison.sh

Run isolated baseline and candidate performance checks against a copied 101 core/observability
SQLite snapshot. The caller must provide repositories and a snapshot under one owned REMOTE_RUN.

Required environment:
  REMOTE_RUN        Isolated /srv/codex run directory
  CANDIDATE_REPO    Candidate source tree within REMOTE_RUN
  BASELINE_REPO     Baseline source tree within REMOTE_RUN
  SNAPSHOT_DIR      Directory containing tavily_proxy.db and tavily_proxy-observability.db
  COMPOSE_PROJECT   Unique Docker Compose project name

Optional environment:
  DURATION_SECS     Per-variant duration, defaults to 1800
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  show_help
  exit 0
fi

REMOTE_RUN="${REMOTE_RUN:?REMOTE_RUN is required}"
CANDIDATE_REPO="${CANDIDATE_REPO:?CANDIDATE_REPO is required}"
BASELINE_REPO="${BASELINE_REPO:?BASELINE_REPO is required}"
SNAPSHOT_DIR="${SNAPSHOT_DIR:?SNAPSHOT_DIR is required}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:?COMPOSE_PROJECT is required}"
DURATION_SECS="${DURATION_SECS:-1800}"
CORE_DB="${SNAPSHOT_DIR}/tavily_proxy.db"
OBSERVABILITY_DB="${SNAPSHOT_DIR}/tavily_proxy-observability.db"
ARTIFACTS_DIR="${REMOTE_RUN}/artifacts/performance-recovery"
WORK_DIR="${REMOTE_RUN}/performance-recovery"

case "$REMOTE_RUN" in
  /srv/codex/workspaces/*/runs/*) ;;
  *) echo "REMOTE_RUN must be an isolated /srv/codex workspace run" >&2; exit 2 ;;
esac
[[ "$COMPOSE_PROJECT" =~ ^[a-z0-9][a-z0-9_-]{0,62}$ ]] || {
  echo "invalid COMPOSE_PROJECT" >&2
  exit 2
}
[[ "$DURATION_SECS" =~ ^[0-9]+$ ]] && (( DURATION_SECS >= 60 )) || {
  echo "DURATION_SECS must be at least 60" >&2
  exit 2
}
for path in "$CANDIDATE_REPO" "$BASELINE_REPO" "$CORE_DB" "$OBSERVABILITY_DB"; do
  [[ -e "$path" ]] || { echo "missing required path: $path" >&2; exit 2; }
done

compose() {
  docker compose -p "$COMPOSE_PROJECT" -f "$WORK_DIR/compose.yml" "$@"
}

cleanup_compose() {
  compose down -v --remove-orphans >/dev/null 2>&1 || true
}

remove_variant_data() {
  local variant_dir="$1"
  case "$variant_dir" in
    "$WORK_DIR"/baseline|"$WORK_DIR"/candidate) ;;
    *) echo "refusing to remove unexpected variant directory: $variant_dir" >&2; exit 2 ;;
  esac
  rm -rf -- "$variant_dir"
}

trap cleanup_compose EXIT
mkdir -p "$ARTIFACTS_DIR" "$WORK_DIR"

write_compose() {
  local repo="$1"
  local data_dir="$2"
  local artifact_dir="$3"
  local runner_uid runner_gid
  runner_uid="$(id -u)"
  runner_gid="$(id -g)"
  cat > "$WORK_DIR/compose.yml" <<EOF
services:
  upstream:
    build:
      context: $CANDIDATE_REPO
      dockerfile: tests/ha/Dockerfile.mock
    command: ["/usr/local/bin/mock_tavily", "--bind", "0.0.0.0:9001"]
    networks: [recovery]
    cap_drop: [ALL]
    cap_add: [CHOWN, DAC_OVERRIDE, FSETID, FOWNER, MKNOD, NET_RAW, SETGID, SETUID, SETPCAP, NET_BIND_SERVICE, SYS_CHROOT, KILL, AUDIT_WRITE]
  app:
    build:
      context: $repo
      dockerfile: tests/ha/Dockerfile.app
    environment:
      TAVILY_API_KEYS: tvly-load-key
      TAVILY_UPSTREAM: http://upstream:9001
      TAVILY_USAGE_BASE: http://upstream:9001
      PROXY_DB_PATH: /srv/app/data/tavily_proxy.db
      PROXY_BIND: 0.0.0.0
      PROXY_PORT: "8787"
      DEV_OPEN_ADMIN: "true"
      ADMIN_AUTH_FORWARD_ENABLED: "false"
      HA_MODE: single
      NODE_ID: snapshot-comparison
      XRAY_BINARY: /bin/true
    volumes:
      - $data_dir:/srv/app/data
    user: "$runner_uid:$runner_gid"
    networks: [recovery]
    cap_drop: [ALL]
    cap_add: [CHOWN, DAC_OVERRIDE, FSETID, FOWNER, MKNOD, NET_RAW, SETGID, SETUID, SETPCAP, NET_BIND_SERVICE, SYS_CHROOT, KILL, AUDIT_WRITE]
  load:
    image: python:3.12-alpine
    volumes:
      - $CANDIDATE_REPO/tests/performance_recovery:/work:ro
      - $artifact_dir:/artifacts
    user: "$runner_uid:$runner_gid"
    networks: [recovery]
    cap_drop: [ALL]
    cap_add: [CHOWN, DAC_OVERRIDE, FSETID, FOWNER, MKNOD, NET_RAW, SETGID, SETUID, SETPCAP, NET_BIND_SERVICE, SYS_CHROOT, KILL, AUDIT_WRITE]
networks:
  recovery:
    internal: true
EOF
}

wait_for_dashboard_readiness() {
  local artifact_dir="$1"
  local health_status dashboard_status
  local deadline=$((SECONDS + 300))
  while (( SECONDS < deadline )); do
    # A production-shaped snapshot can retain an Xray configuration. The test
    # deliberately replaces Xray with /bin/true, making the strict /health
    # readiness endpoint return 503 even though the HTTP server and SQLite
    # startup both completed. The comparison needs listener readiness here;
    # strict readiness remains observable in the captured status code.
    health_status="$(compose exec -T app sh -c 'curl -sS --max-time 1 -o /dev/null -w "%{http_code}" http://127.0.0.1:8787/health' 2>/dev/null || true)"
    if [[ "$health_status" =~ ^[1-5][0-9][0-9]$ ]]; then
      printf '%s\n' "$health_status" > "$artifact_dir/startup_health_status.txt"
    fi

    # The comparison measures Dashboard traffic. Do not begin that workload
    # until the snapshot's initial overview build has completed successfully.
    dashboard_status="$(compose exec -T app sh -c 'curl -sS --max-time 10 -o /dev/null -w "%{http_code}" http://127.0.0.1:8787/api/dashboard/overview' 2>/dev/null || true)"
    if [[ "$dashboard_status" == "200" ]]; then
      printf '%s\n' "$dashboard_status" > "$artifact_dir/startup_dashboard_status.txt"
      return 0
    fi
    printf '%s\n' "${dashboard_status:-unreachable}" > "$artifact_dir/startup_dashboard_status.txt"
    sleep 1
  done
  compose logs --no-color > "$artifact_dir/startup_failure.log" 2>&1 || true
  echo "Dashboard overview did not become ready" >&2
  return 1
}

sample_rss() {
  local target="$1"
  while compose ps -q app >/dev/null 2>&1 && [[ -n "$(compose ps -q app)" ]]; do
    compose exec -T app sh -c "awk '/VmRSS:/ { print \$2; exit }' /proc/1/status" \
      >> "$target" 2>/dev/null || true
    sleep 5
  done
}

run_variant() {
  local name="$1"
  local repo="$2"
  local variant_dir="$WORK_DIR/$name"
  local artifact_dir="$ARTIFACTS_DIR/$name"
  local load_pid restart_pid rss_pid
  remove_variant_data "$variant_dir"
  rm -rf -- "$artifact_dir"
  mkdir -p "$variant_dir" "$artifact_dir"
  cp --reflink=auto "$CORE_DB" "$variant_dir/tavily_proxy.db"
  cp --reflink=auto "$OBSERVABILITY_DB" "$variant_dir/tavily_proxy-observability.db"
  chmod 600 "$variant_dir/tavily_proxy.db" "$variant_dir/tavily_proxy-observability.db"
  write_compose "$repo" "$variant_dir" "$artifact_dir"
  # The testbox is deliberately isolated from production services. Reusing its
  # locked base-image cache keeps a transient registry failure out of the
  # baseline/candidate comparison.
  compose build app upstream
  compose up -d app upstream
  wait_for_dashboard_readiness "$artifact_dir"
  sample_rss "$artifact_dir/rss_kib.txt" &
  rss_pid=$!
  (
    sleep $((DURATION_SECS / 2))
    compose restart app
  ) &
  restart_pid=$!
  (
    if ! compose run --rm load python /work/load.py \
      --duration-secs "$DURATION_SECS" \
      --output "/artifacts/load.json"; then
      compose logs --no-color >&2 || true
      exit 1
    fi
  ) &
  load_pid=$!
  wait "$load_pid"
  wait "$restart_pid"
  kill "$rss_pid" 2>/dev/null || true
  wait "$rss_pid" 2>/dev/null || true
  compose logs --no-color > "$artifact_dir/compose.log" 2>&1 || true
  python3 - "$name" "$artifact_dir" <<'PY'
import json
import pathlib
import statistics
import sys

name = sys.argv[1]
artifact_dir = pathlib.Path(sys.argv[2])
load = json.loads((artifact_dir / "load.json").read_text())
rss = [int(value) for value in (artifact_dir / "rss_kib.txt").read_text().split() if value.isdigit()]
logs = (artifact_dir / "compose.log").read_text(errors="replace")
summary = {
    "variant": name,
    "load": load,
    "rssP95KiB": sorted(rss)[min(len(rss) - 1, int(len(rss) * 0.95))] if rss else None,
    "sqliteLockErrors": logs.count("database is locked"),
    "nestedTransactionErrors": logs.count("cannot start a transaction within a transaction"),
    "http5xx": sum(count for key, count in load["statuses"].items() if key.endswith(":500") or key.endswith(":502") or key.endswith(":503")),
}
(artifact_dir / "summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n")
PY
  cleanup_compose
  remove_variant_data "$variant_dir"
}

run_variant baseline "$BASELINE_REPO"
run_variant candidate "$CANDIDATE_REPO"

python3 - "$ARTIFACTS_DIR" <<'PY'
import json
import pathlib
import sys

artifacts = pathlib.Path(sys.argv[1])
baseline = json.loads((artifacts / "baseline" / "summary.json").read_text())
candidate = json.loads((artifacts / "candidate" / "summary.json").read_text())

def p95(summary):
    return summary["load"]["dashboardP95Ms"]

def assert_not_worse(metric, base, cand):
    if base is None or cand is None:
        raise SystemExit(f"missing {metric} sample")
    if cand > base * 1.10:
        raise SystemExit(f"candidate {metric} regressed: baseline={base}, candidate={cand}")

for summary in (baseline, candidate):
    statuses = summary["load"]["statuses"]
    events = summary["load"]["events"]
    dashboard_clients = summary["load"].get("dashboardClients")
    dashboard_interval_secs = summary["load"].get("dashboardIntervalSecs")
    if dashboard_clients != 20 or dashboard_interval_secs != 10.0:
        raise SystemExit(f"unexpected dashboard load shape for {summary['variant']}")
    diagnostic = summary["load"]["durationSecs"] <= 120
    dashboard_coverage = 0.40 if diagnostic else 0.70
    business_per_second = 2 if diagnostic else 4
    dashboard_minimum = (
        summary["load"]["durationSecs"] * dashboard_clients / dashboard_interval_secs * dashboard_coverage
    )
    business_minimum = summary["load"]["durationSecs"] * business_per_second
    if summary["load"]["dashboardRequests"] < dashboard_minimum:
        raise SystemExit(f"insufficient dashboard coverage for {summary['variant']}")
    if statuses.get("sse:200", 0) < 20:
        raise SystemExit(f"insufficient SSE coverage for {summary['variant']}")
    if statuses.get("business:200", 0) < business_minimum:
        raise SystemExit(f"insufficient successful business coverage for {summary['variant']}")
    if events.get("ha_export_interrupted", 0) < 1:
        raise SystemExit(f"missing HA export interruption for {summary['variant']}")

assert_not_worse("dashboard p95", p95(baseline), p95(candidate))
assert_not_worse("RSS P95", baseline["rssP95KiB"], candidate["rssP95KiB"])
if candidate["rssP95KiB"] > 256 * 1024:
    raise SystemExit(f"candidate RSS P95 exceeds 256MiB: {candidate['rssP95KiB']}KiB")
if candidate["sqliteLockErrors"] > baseline["sqliteLockErrors"] * 1.10 + 1:
    raise SystemExit(
        "candidate SQLite lock errors regressed: "
        f"baseline={baseline['sqliteLockErrors']}, candidate={candidate['sqliteLockErrors']}"
    )
if candidate["http5xx"] > baseline["http5xx"]:
    raise SystemExit(
        "candidate introduced HTTP 5xx: "
        f"baseline={baseline['http5xx']}, candidate={candidate['http5xx']}"
    )
if candidate["nestedTransactionErrors"]:
    raise SystemExit("candidate emitted a nested transaction error")

result = {"baseline": baseline, "candidate": candidate, "result": "passed"}
(artifacts / "comparison.json").write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
print(json.dumps(result, sort_keys=True))
PY
