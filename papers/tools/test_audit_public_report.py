"""Verify the manuscript audit's success and rejection paths without file writes."""
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from audit_public_report import audit

from synthetic_report_fixture import create_report
import tempfile
_TEMP_REPORT = tempfile.TemporaryDirectory()
REPORT = create_report(_TEMP_REPORT.name)
import atexit
atexit.register(_TEMP_REPORT.cleanup)


class ManuscriptAuditTests(unittest.TestCase):
    def test_frozen_package_is_consistent_and_does_not_imply_journal_readiness(self):
        result = audit(REPORT)
        self.assertTrue(result["integrity_passed"])
        self.assertEqual(len(result["verified_artifacts"]), 8)
        self.assertEqual(result["records"], 3)
        self.assertFalse(result["journal_submission_ready"])
        self.assertEqual(result["geometry_structure"]["park.geojson"]["point_features"], 3)

    def test_changed_artifact_is_detected(self):
        original = Path.read_bytes
        def read(path):
            return b"changed" if path == REPORT / "olcum.csv" else original(path)
        with patch.object(Path, "read_bytes", read):
            result = audit(REPORT)
        self.assertFalse(result["integrity_passed"])
        self.assertIn("File hash mismatch: olcum.csv", result["errors"])

    def test_duplicate_observation_identity_is_detected(self):
        original = Path.read_text
        def read(path, *args, **kwargs):
            text = original(path, *args, **kwargs)
            if path == REPORT / "data.json":
                value = json.loads(text)
                value["rows"][1]["point_id"] = value["rows"][0]["point_id"]
                return json.dumps(value)
            return text
        with patch.object(Path, "read_text", read):
            result = audit(REPORT)
        self.assertFalse(result["integrity_passed"])
        self.assertIn("Duplicate point_id", result["errors"])


if __name__ == "__main__":
    unittest.main()
