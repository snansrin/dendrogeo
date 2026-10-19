"""Verify candidate scope, deterministic output and unchanged source artifacts."""
import csv
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from prepare_primary_dataset import stage

from synthetic_report_fixture import create_report
import tempfile
_TEMP_REPORT = tempfile.TemporaryDirectory()
REPORT = create_report(_TEMP_REPORT.name)
import atexit
atexit.register(_TEMP_REPORT.cleanup)

class PrimaryDatasetTests(unittest.TestCase):
    def test_staging_is_deterministic_and_preserves_source(self):
        before = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in REPORT.iterdir() if p.is_file()}
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'candidate'
            self.assertEqual(stage(REPORT, out)['records'], 3)
            first = {p.name: p.read_bytes() for p in out.iterdir()}
            stage(REPORT, out)
            self.assertEqual(first, {p.name: p.read_bytes() for p in out.iterdir()})
            with (out / 'tree-observations.csv').open(encoding='utf-8', newline='') as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual(len(rows), 3)
            self.assertFalse({'photo', 'photo_file', 'id'} & set(rows[0]))
            self.assertEqual(sum(not row['horizontal_accuracy_m'] for row in rows), 1)
            manifest = json.loads((out / 'manifest.json').read_text(encoding='utf-8'))
            for entry in manifest['files']:
                self.assertEqual(hashlib.sha256((out / entry['name']).read_bytes()).hexdigest(), entry['sha256'])
        after = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in REPORT.iterdir() if p.is_file()}
        self.assertEqual(before, after)

if __name__ == '__main__':
    unittest.main()
