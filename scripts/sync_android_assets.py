from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
source = root / "web" / "index.html"
assets_root = root / "android" / "app" / "src" / "main" / "assets"
out = assets_root / "index.html"
web_assets = root / "web" / "assets"

html = source.read_text(encoding="utf-8")
html = html.replace(
    "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js",
    "three.min.js",
)
html = html.replace(
    "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js",
    "three.min.js",
)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding="utf-8")
if web_assets.exists():
    target_assets = assets_root / "assets"
    target_assets.mkdir(parents=True, exist_ok=True)
    for item in web_assets.iterdir():
        dest = target_assets / item.name
        if item.is_dir():
            if dest.exists(): shutil.rmtree(dest)
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)
print(f"Synced {source.relative_to(root)} and web/assets -> {assets_root.relative_to(root)}")
