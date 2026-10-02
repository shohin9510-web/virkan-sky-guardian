"""Sync the offline Android payload from the canonical checked-in web files."""
from pathlib import Path
import argparse
import shutil
import zipfile

CDN_URLS = (
    "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js",
)


def expected_assets(root):
    web_root = root / "web"
    for name in ("index.html", "three.min.js"):
        source = web_root / name
        if not source.is_file() or not source.stat().st_size:
            raise FileNotFoundError(f"Missing canonical game asset: {source}")
    html = (web_root / "index.html").read_text(encoding="utf-8")
    for url in CDN_URLS:
        html = html.replace(url, "three.min.js")
    files = {Path("index.html"): html.encode("utf-8"),
             Path("three.min.js"): (web_root / "three.min.js").read_bytes()}
    assets = web_root / "assets"
    if assets.exists():
        for source in assets.rglob("*"):
            if source.is_file():
                files[source.relative_to(web_root)] = source.read_bytes()
    return files


def sync_assets(root, check=False):
    files = expected_assets(root)
    destination = root / "android" / "app" / "src" / "main" / "assets"
    actual = {path.relative_to(destination): path.read_bytes()
              for path in destination.rglob("*") if path.is_file()}
    if check:
        if actual != files:
            raise ValueError("Android assets differ from canonical web files; run this script to sync.")
        return destination
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)
    for name, data in files.items():
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    return destination


def verify_apk(root, apk):
    expected = {"assets/" + name.as_posix(): data for name, data in expected_assets(root).items()}
    with zipfile.ZipFile(apk) as package:
        if package.testzip() is not None:
            raise ValueError("APK ZIP integrity check failed")
        if not {"AndroidManifest.xml", "classes.dex"}.issubset(package.namelist()):
            raise ValueError("APK is missing its manifest or executable classes")
        actual = {name: package.read(name) for name in package.namelist()
                  if name.startswith("assets/") and not name.endswith("/")}
    if actual != expected:
        raise ValueError("APK does not contain the exact canonical offline game payload")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify the generated payload without changes")
    parser.add_argument("--apk", type=Path, help="Also verify the compiled APK's offline payload")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    destination = sync_assets(root, check=args.check)
    print(f"{'Verified' if args.check else 'Synced'} offline game assets: {destination.relative_to(root)}")
    if args.apk:
        verify_apk(root, args.apk)
        print(f"Verified APK ZIP integrity and canonical offline payload: {args.apk}")
