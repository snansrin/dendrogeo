"""Small, read-only client for immutable public DGR artifacts."""

from __future__ import annotations

import hashlib
import json
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class DendroGeoError(Exception):
    """Raised when a public report cannot be fetched or verified."""


_REPORT_ID = re.compile(r"^DGR-[0-9]{4}-[0-9]{4}$")
_ARTIFACT_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


class DendroGeoClient:
    """Retrieve public report metadata and artifacts with hash verification."""

    def __init__(self, base_url="https://dendrogeo.org/rapor/", timeout=20, opener=None):
        if not isinstance(base_url, str) or not base_url.startswith("https://"):
            raise ValueError("base_url must be an HTTPS URL")
        self.base_url = base_url.rstrip("/") + "/"
        self.timeout = timeout
        self._opener = opener or urlopen

    @staticmethod
    def _validate_id(report_id):
        if not isinstance(report_id, str) or not _REPORT_ID.fullmatch(report_id):
            raise ValueError("report_id must match DGR-YYYY-NNNN")

    def _read(self, url):
        request = Request(url, headers={"Accept": "application/json, application/geo+json, */*", "User-Agent": "dendrogeo-client/0.1"})
        try:
            response = self._opener(request, timeout=self.timeout)
            with response:
                return response.read()
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            raise DendroGeoError(f"Public report request failed: {exc}") from exc

    @staticmethod
    def _json(raw, label):
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise DendroGeoError(f"Invalid UTF-8 JSON in {label}") from exc

    @staticmethod
    def _verify(name, raw, manifest):
        files = manifest.get("files")
        if not isinstance(files, list):
            raise DendroGeoError("Manifest files must be a list")
        names = [item.get("name") for item in files if isinstance(item, dict)]
        if len(names) != len(files) or len(names) != len(set(names)):
            raise DendroGeoError("Manifest contains malformed or duplicate file entries")
        records = {item["name"]: item.get("sha256") for item in files}
        expected = records.get(name)
        if not isinstance(expected, str) or not re.fullmatch(r"[a-f0-9]{64}", expected):
            raise DendroGeoError(f"Artifact is not protected by the report manifest: {name}")
        actual = hashlib.sha256(raw).hexdigest()
        if actual != expected:
            raise DendroGeoError(f"SHA-256 mismatch for {name}")

    def get_manifest(self, report_id):
        self._validate_id(report_id)
        manifest = self._json(self._read(f"{self.base_url}{report_id}/manifest.json"), "manifest.json")
        if manifest.get("report_id") != report_id:
            raise DendroGeoError("Manifest report_id does not match the requested report")
        return manifest

    def get_artifact(self, report_id, name):
        """Return raw bytes for a manifest-listed artifact after SHA-256 check."""
        self._validate_id(report_id)
        if not isinstance(name, str) or not _ARTIFACT_NAME.fullmatch(name) or name in {".", ".."}:
            raise ValueError("Invalid artifact name")
        manifest = self.get_manifest(report_id)
        return self._get_verified_artifact(report_id, name, manifest)

    def _get_verified_artifact(self, report_id, name, manifest):
        raw = self._read(f"{self.base_url}{report_id}/{name}")
        self._verify(name, raw, manifest)
        return raw

    def get_report(self, report_id):
        """Return verified manifest, metadata, and analysis JSON."""
        manifest = self.get_manifest(report_id)
        result = {"manifest": manifest}
        for name, key in (("metadata.json", "metadata"), ("data.json", "data")):
            raw = self._get_verified_artifact(report_id, name, manifest)
            result[key] = self._json(raw, name)
        if result["metadata"].get("identifier") != report_id:
            raise DendroGeoError("metadata identifier does not match the requested report")
        return result

