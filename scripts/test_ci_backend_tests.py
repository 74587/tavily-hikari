#!/usr/bin/env python3

import argparse
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("ci_backend_tests.py")
SPEC = importlib.util.spec_from_file_location("ci_backend_tests", SCRIPT_PATH)
RUNNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNNER)


class BackendTestRunnerContractTests(unittest.TestCase):
    def test_v2_bundle_deduplicates_and_verifies_checksum(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            executable = root / "executables" / "fixture-abc123"
            executable.parent.mkdir()
            executable.write_bytes(b"fixture executable")
            digest = RUNNER.sha256_file(executable)
            support_binary = root / "executables" / "support-source"
            support_binary.write_bytes(b"fixture support binary")
            support_digest = RUNNER.sha256_file(support_binary)
            manifest = {
                "format_version": RUNNER.ARTIFACT_FORMAT_VERSION,
                "executables": {
                    digest: {
                        "path": "executables/fixture-abc123",
                        "sha256": digest,
                        "name": "fixture",
                        "tests": ["fixture::test"],
                    },
                    support_digest: {
                        "path": "executables/support-source",
                        "sha256": support_digest,
                        "name": "observability_lock_holder",
                    },
                },
                "coverage_targets": {
                    "lib": {
                        "executables": [digest],
                        "support_binaries": {"FIXTURE_BIN": support_digest},
                    }
                },
            }
            (root / RUNNER.ARTIFACT_MANIFEST_NAME).write_text(
                json.dumps(manifest), encoding="utf-8"
            )

            executables, support_binaries = RUNNER.load_prebuilt_executables(root, "lib")

            self.assertEqual(executables[0]["tests"], ["fixture::test"])
            self.assertEqual(
                Path(support_binaries["FIXTURE_BIN"]), support_binary.resolve()
            )
            self.assertEqual(
                RUNNER.artifact_executable_path(
                    root, support_digest, "observability_lock_holder"
                ).name,
                f"observability_lock_holder-{support_digest}",
            )
            executable.write_bytes(b"tampered")
            with self.assertRaises(SystemExit):
                RUNNER.load_prebuilt_executables(root, "lib")

    def test_v1_bundle_remains_readable(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            target_dir = Path(temp_dir) / RUNNER.artifact_target_dir_name("lib")
            target_dir.mkdir()
            executable = target_dir / "legacy"
            executable.write_bytes(b"legacy executable")
            (target_dir / "tests.json").write_text(
                json.dumps({"legacy": ["legacy::test"]}), encoding="utf-8"
            )
            (target_dir / "support_binaries.json").write_text("{}", encoding="utf-8")

            executables, support_binaries = RUNNER.load_prebuilt_executables(temp_dir, "lib")

            self.assertEqual(executables[0]["name"], "legacy")
            self.assertEqual(executables[0]["tests"], ["legacy::test"])
            self.assertEqual(support_binaries, {})

    def test_lane_matrix_is_stable_lpt(self):
        shards = [
            {"id": "gamma", "estimated_seconds": 5},
            {"id": "alpha", "estimated_seconds": 8},
            {"id": "beta", "estimated_seconds": 8},
            {"id": "delta", "estimated_seconds": 3},
        ]

        lanes = RUNNER.build_lane_matrix(shards, 2)

        self.assertEqual(
            lanes,
            [
                {
                    "id": "lane-01",
                    "name": "Lane 01",
                    "estimated_seconds": 13,
                    "shard_ids": ["alpha", "gamma"],
                },
                {
                    "id": "lane-02",
                    "name": "Lane 02",
                    "estimated_seconds": 11,
                    "shard_ids": ["beta", "delta"],
                },
            ],
        )

    def test_low_resource_environment_is_explicit(self):
        environment = RUNNER.cargo_environment(cargo_jobs=2, web_assets_dir="/tmp/assets")

        self.assertEqual(environment["CARGO_BUILD_JOBS"], "2")
        self.assertEqual(environment[RUNNER.WEB_ASSET_ENV], "/tmp/assets")
        self.assertEqual(RUNNER.DEFAULT_LOW_RESOURCE_FILTERED_PROCESS_WORKERS, 1)
        self.assertEqual(RUNNER.DEFAULT_LOW_RESOURCE_FILTERED_TEST_THREADS, 2)

    def test_diagnostic_resources_override_low_resource_defaults(self):
        resources = RUNNER.resources_from_args(
            argparse.Namespace(
                diagnostic=True,
                cargo_jobs=RUNNER.DEFAULT_LOW_RESOURCE_CARGO_JOBS,
                filtered_process_workers=RUNNER.DEFAULT_LOW_RESOURCE_FILTERED_PROCESS_WORKERS,
                filtered_test_threads=RUNNER.DEFAULT_LOW_RESOURCE_FILTERED_TEST_THREADS,
            )
        )

        self.assertEqual(resources, (1, 1, 1))

    def test_requested_workers_do_not_exceed_shard_limit(self):
        workers, threads = RUNNER.shard_resource_limits(
            {"filtered_process_workers": 2, "filtered_test_threads": 1},
            filtered_process_workers=3,
            filtered_test_threads=2,
        )

        self.assertEqual((workers, threads), (2, 1))

    def test_minimal_web_assets_meet_the_web_asset_contract(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            RUNNER.write_minimal_web_assets(temp_dir)

            RUNNER.verify_web_assets(temp_dir)

    def test_request_rollup_integrity_has_one_manifest_owner(self):
        _targets, shards = RUNNER.load_manifest()
        storage = next(shard for shard in shards if shard["id"] == "lib-request-rollup-storage")
        integrity = next(
            shard for shard in shards if shard["id"] == "lib-request-rollup-integrity"
        )

        self.assertNotIn("tests::dashboard_rollup_integrity::", storage["include_prefixes"])
        self.assertEqual(
            integrity["include_prefixes"], ["tests::dashboard_rollup_integrity::"]
        )

    def test_sensitive_shards_cap_ci_parallelism(self):
        _targets, shards = RUNNER.load_manifest()
        reporting = next(
            shard for shard in shards if shard["id"] == "lib-request-rollup-reporting"
        )
        alert = next(shard for shard in shards if shard["id"] == "lib-alert-projection")

        self.assertEqual(
            reporting["isolated_prefixes"],
            ["tests::request_rollup_public_metrics::admin_"],
        )
        self.assertEqual(RUNNER.shard_resource_limits(alert, 3, 2), (3, 1))

    def test_isolated_prefixes_run_as_serial_exact_tests(self):
        executable_tests = [
            "tests::safe::one",
            "tests::request_rollup_public_metrics::admin_one",
            "tests::request_rollup_public_metrics::admin_two",
        ]
        shard = {
            "include_prefixes": [
                "tests::safe::",
                "tests::request_rollup_public_metrics::admin_",
            ],
            "exclude_prefixes": [],
            "serial_prefixes": [],
            "isolated_prefixes": ["tests::request_rollup_public_metrics::admin_"],
        }

        filters, serial_filters, exact_fallback, isolated_tests = RUNNER.select_safe_filter_groups(
            executable_tests, shard
        )

        self.assertEqual(filters, ["tests::safe::"])
        self.assertEqual(serial_filters, [])
        self.assertEqual(exact_fallback, [])
        self.assertEqual(
            isolated_tests,
            [
                "tests::request_rollup_public_metrics::admin_one",
                "tests::request_rollup_public_metrics::admin_two",
            ],
        )


if __name__ == "__main__":
    unittest.main()
