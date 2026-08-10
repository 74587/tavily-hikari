#!/usr/bin/env python3
"""Internal-only production-shape traffic for the recovery comparison."""

from __future__ import annotations

import argparse
import http.client
import json
import threading
import time
from collections import Counter
from pathlib import Path


class Recorder:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.dashboard_ms: list[float] = []
        self.statuses: Counter[str] = Counter()
        self.errors: Counter[str] = Counter()
        self.events: Counter[str] = Counter()

    def status(self, lane: str, status: int, elapsed_ms: float) -> None:
        with self._lock:
            self.statuses[f"{lane}:{status}"] += 1
            if lane == "dashboard":
                self.dashboard_ms.append(elapsed_ms)

    def error(self, lane: str, error: BaseException) -> None:
        with self._lock:
            self.errors[f"{lane}:{type(error).__name__}"] += 1

    def event(self, lane: str) -> None:
        with self._lock:
            self.events[lane] += 1

    def summary(self) -> dict[str, object]:
        with self._lock:
            ordered = sorted(self.dashboard_ms)
            p95 = (
                ordered[min(len(ordered) - 1, int(len(ordered) * 0.95))]
                if ordered
                else None
            )
            return {
                "dashboardRequests": len(ordered),
                "dashboardP95Ms": p95,
                "dashboardMaxMs": max(ordered) if ordered else None,
                "statuses": dict(sorted(self.statuses.items())),
                "errors": dict(sorted(self.errors.items())),
                "events": dict(sorted(self.events.items())),
            }


def request(
    recorder: Recorder,
    lane: str,
    method: str,
    host: str,
    port: int,
    path: str,
    body: bytes | None = None,
    headers: dict[str, str] | None = None,
) -> None:
    started = time.monotonic()
    connection = http.client.HTTPConnection(host, port, timeout=10)
    try:
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        response.read()
        recorder.status(lane, response.status, (time.monotonic() - started) * 1000)
    except (OSError, http.client.HTTPException, TimeoutError) as error:
        recorder.error(lane, error)
    finally:
        connection.close()


def periodic(
    stop: threading.Event,
    interval_secs: float,
    action: callable,
) -> None:
    next_run = time.monotonic()
    while not stop.is_set():
        action()
        next_run += interval_secs
        stop.wait(max(0.0, next_run - time.monotonic()))


def dashboard_lane(stop: threading.Event, recorder: Recorder, host: str, port: int) -> None:
    periodic(stop, 1.0, lambda: request(recorder, "dashboard", "GET", host, port, "/api/dashboard/overview"))


def business_lane(stop: threading.Event, recorder: Recorder, host: str, port: int) -> None:
    payload = json.dumps(
        {"query": "snapshot recovery comparison", "search_depth": "basic", "max_results": 1}
    ).encode()
    headers = {
        "Authorization": "Bearer tvly-load-key",
        "Content-Type": "application/json",
    }
    periodic(
        stop,
        0.2,
        lambda: request(recorder, "business", "POST", host, port, "/api/tavily/search", payload, headers),
    )


def sse_lane(stop: threading.Event, recorder: Recorder, host: str, port: int) -> None:
    while not stop.is_set():
        connection = http.client.HTTPConnection(host, port, timeout=10)
        try:
            connection.request("GET", "/api/events")
            response = connection.getresponse()
            recorder.status("sse", response.status, 0.0)
            if response.status != 200:
                response.read()
                stop.wait(1.0)
                continue
            while not stop.is_set():
                line = response.fp.readline(4096)
                if not line:
                    break
                if line.startswith(b"event:") or line.startswith(b"data:"):
                    recorder.event("sse_frame")
        except (OSError, http.client.HTTPException, TimeoutError) as error:
            recorder.error("sse", error)
            stop.wait(1.0)
        finally:
            connection.close()


def interrupted_ha_export(stop: threading.Event, recorder: Recorder, host: str, port: int) -> None:
    def interrupt() -> None:
        connection = http.client.HTTPConnection(host, port, timeout=10)
        try:
            connection.request("GET", "/api/admin/ha/events?channel=control&cursor=0")
            response = connection.getresponse()
            recorder.status("ha_export", response.status, 0.0)
            response.read(256)
            recorder.event("ha_export_interrupted")
        except (OSError, http.client.HTTPException, TimeoutError) as error:
            recorder.error("ha_export", error)
        finally:
            connection.close()

    periodic(stop, 30.0, interrupt)


def trigger_ha_gc(stop: threading.Event, recorder: Recorder, host: str, port: int) -> None:
    payload = json.dumps({"jobType": "ha_outbox_gc"}).encode()
    headers = {"Content-Type": "application/json"}
    periodic(
        stop,
        60.0,
        lambda: request(recorder, "ha_gc_trigger", "POST", host, port, "/api/jobs/trigger", payload, headers),
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration-secs", type=int, required=True)
    parser.add_argument("--host", default="app")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    recorder = Recorder()
    stop = threading.Event()
    threads = [
        threading.Thread(target=dashboard_lane, args=(stop, recorder, args.host, args.port), daemon=True)
        for _ in range(20)
    ]
    threads += [
        threading.Thread(target=sse_lane, args=(stop, recorder, args.host, args.port), daemon=True)
        for _ in range(20)
    ]
    threads += [
        threading.Thread(target=business_lane, args=(stop, recorder, args.host, args.port), daemon=True),
        threading.Thread(target=interrupted_ha_export, args=(stop, recorder, args.host, args.port), daemon=True),
        threading.Thread(target=trigger_ha_gc, args=(stop, recorder, args.host, args.port), daemon=True),
    ]
    started = time.time()
    for thread in threads:
        thread.start()
    try:
        time.sleep(args.duration_secs)
    finally:
        stop.set()
        for thread in threads:
            thread.join(timeout=2)
    summary = recorder.summary()
    summary["durationSecs"] = args.duration_secs
    summary["startedAt"] = int(started)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(summary, sort_keys=True))


if __name__ == "__main__":
    main()
