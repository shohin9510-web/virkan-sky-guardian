"""Focused offline-payload regression tests; no SDK or network required."""
from pathlib import Path
import tempfile
import unittest
import zipfile

from sync_android_assets import CDN_URLS, expected_assets, sync_assets, verify_apk


class AndroidAssetsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.web = self.root / "web"
        (self.web / "assets").mkdir(parents=True)
        (self.web / "index.html").write_text(f'<script src="{CDN_URLS[0]}"></script>\n')
        (self.web / "three.min.js").write_bytes(b"canonical local library")
        (self.web / "assets" / "test.txt").write_text("game asset")

    def test_local_library_and_html_are_copied(self):
        destination = sync_assets(self.root)
        self.assertEqual((destination / "three.min.js").read_bytes(), b"canonical local library")
        self.assertEqual((destination / "index.html").read_text(), '<script src="three.min.js"></script>\n')
        self.assertEqual((destination / "assets" / "test.txt").read_text(), "game asset")
        sync_assets(self.root, check=True)

    def test_html_without_terminal_newline_is_preserved(self):
        html = '<script src="three.min.js"></script>'
        (self.web / "index.html").write_text(html, encoding="utf-8")
        destination = sync_assets(self.root)
        self.assertEqual((destination / "index.html").read_bytes(), html.encode("utf-8"))
        sync_assets(self.root, check=True)

    def test_sync_removes_stale_assets(self):
        destination = sync_assets(self.root)
        (self.web / "assets" / "test.txt").unlink()
        (destination / "stale.txt").write_text("old payload")
        sync_assets(self.root)
        self.assertFalse((destination / "stale.txt").exists())
        self.assertFalse((destination / "assets" / "test.txt").exists())

    def test_missing_library_fails_before_changing_payload(self):
        destination = sync_assets(self.root)
        (self.web / "three.min.js").unlink()
        with self.assertRaises(FileNotFoundError):
            sync_assets(self.root)
        self.assertEqual((destination / "three.min.js").read_bytes(), b"canonical local library")

    def test_check_detects_modified_library_without_writing(self):
        destination = sync_assets(self.root)
        library = destination / "three.min.js"
        library.write_bytes(b"stale library")
        with self.assertRaises(ValueError):
            sync_assets(self.root, check=True)
        self.assertEqual(library.read_bytes(), b"stale library")

    def create_test_apk(self, corrupt_library=False):
        apk = self.root / "test.apk"
        with zipfile.ZipFile(apk, "w") as package:
            package.writestr("AndroidManifest.xml", "manifest placeholder for ZIP test")
            package.writestr("classes.dex", "dex placeholder for ZIP test")
            for name, data in expected_assets(self.root).items():
                if corrupt_library and name == Path("three.min.js"):
                    data = b"wrong library"
                package.writestr("assets/" + name.as_posix(), data)
        return apk

    def test_apk_payload_matches_canonical_web_files(self):
        verify_apk(self.root, self.create_test_apk())

    def test_apk_rejects_wrong_bundled_library(self):
        with self.assertRaises(ValueError):
            verify_apk(self.root, self.create_test_apk(corrupt_library=True))


if __name__ == "__main__":
    unittest.main()
