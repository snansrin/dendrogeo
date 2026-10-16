import hashlib
import io
import json
import unittest

from dendrogeo_client import DendroGeoClient, DendroGeoError


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()


class ClientTests(unittest.TestCase):
    def make_client(self, files):
        manifest = {"report_id": "DGR-2026-0026", "files": [
            {"name": name, "sha256": hashlib.sha256(body).hexdigest()}
            for name, body in files.items()
        ]}

        def opener(request, timeout):
            name = request.full_url.rsplit("/", 1)[-1]
            body = json.dumps(manifest).encode() if name == "manifest.json" else files[name]
            return Response(body)

        return DendroGeoClient("https://example.test/rapor/", opener=opener)

    def test_valid_report_returns_manifest_checked_metadata_and_data(self):
        files = {
            "metadata.json": json.dumps({"identifier": "DGR-2026-0026", "license": "CC-BY-NC-4.0"}).encode(),
            "data.json": b'{"result_hash":"sha256:abc"}',
        }
        result = self.make_client(files).get_report("DGR-2026-0026")
        self.assertEqual(result["metadata"]["identifier"], "DGR-2026-0026")
        self.assertEqual(result["data"]["result_hash"], "sha256:abc")

    def test_rejects_invalid_identifier_before_network(self):
        with self.assertRaises(ValueError):
            DendroGeoClient().get_report("../DGR-2026-0026")

    def test_rejects_path_traversal_artifact(self):
        with self.assertRaises(ValueError):
            self.make_client({}).get_artifact("DGR-2026-0026", "../private.json")

    def test_rejects_tampered_artifact(self):
        expected = b'{"altered":true}'
        manifest = {"report_id": "DGR-2026-0026", "files": [
            {"name": "data.json", "sha256": hashlib.sha256(expected).hexdigest()}
        ]}

        def opener(request, timeout):
            body = json.dumps(manifest).encode() if request.full_url.endswith("manifest.json") else b'{"different":true}'
            return Response(body)

        client = DendroGeoClient("https://example.test/rapor/", opener=opener)
        with self.assertRaisesRegex(DendroGeoError, "SHA-256 mismatch"):
            client.get_artifact("DGR-2026-0026", "data.json")


if __name__ == "__main__":
    unittest.main()
