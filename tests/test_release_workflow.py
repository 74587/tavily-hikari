#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import unittest


WORKFLOW_PATH = Path(__file__).resolve().parents[1] / ".github" / "workflows" / "release.yml"


class ReleaseWorkflowContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.source = WORKFLOW_PATH.read_text(encoding="utf-8")
        github_release_start = cls.source.index("  github-release:\n")
        cls.github_release = cls.source[github_release_start:]

    def test_release_does_not_write_completion_comments_to_source_pr(self):
        for obsolete in (
            "Upsert PR release comment",
            "actions/github-script",
            "tavily-hikari-release-comment",
            "issues.listComments",
            "issues.updateComment",
            "issues.createComment",
            "release comment",
        ):
            self.assertNotIn(obsolete, self.github_release)

        self.assertNotIn("      issues: write\n", self.github_release)
        self.assertNotIn("      pull-requests: write\n", self.github_release)
        self.assertIn("      contents: write\n", self.github_release)

    def test_release_preparation_and_publication_contracts_remain(self):
        for preserved in (
            "      pr_number: ${{ steps.intent.outputs.pr_number }}",
            "      pr_url: ${{ steps.intent.outputs.pr_url }}",
            "            echo \"- pr: ${{ steps.intent.outputs.pr_number }} (${{ steps.intent.outputs.pr_url }})\"",
            "      release_intent_label: ${{ steps.intent.outputs.release_intent_label }}",
            "      - name: Create and push tag (if missing)",
            "  docker-manifest:",
            "  github-release:",
            "      - name: Create/Update GitHub Release",
            "      - name: Upload binary assets to GitHub Release",
            "      - name: Upload CLI assets to GitHub Release",
            "          gh release upload \"${RELEASE_TAG}\"",
        ):
            self.assertIn(preserved, self.source)

    def test_release_job_permissions_are_limited_to_publication(self):
        match = re.search(r"  github-release:\n(?P<block>.*?)(?=\n  [a-z0-9-]+:\n|\Z)", self.source, re.S)
        self.assertIsNotNone(match)
        assert match is not None
        block = match.group("block")
        self.assertIn("    permissions:\n      contents: write", block)
        self.assertNotIn("issues:", block)
        self.assertNotIn("pull-requests:", block)


if __name__ == "__main__":
    unittest.main()
