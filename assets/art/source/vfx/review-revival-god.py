"""Narrow asset QA for the new revival_god effect; no runtime edits."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[4]
MASTER = ROOT / "assets/art/source/generated/vfx/units/revival_god-master.png"
PNG = ROOT / "assets/art/vfx/units/revival_god.png"
SVG = ROOT / "assets/art/source/vfx/units/revival_god.svg"
PROFILES = ROOT / "assets/art/vfx/unit-vfx-profiles.json"
PREVIEW = ROOT / "hd2d-previews/qa-vfx-revival-god-64.png"
REPORT = ROOT / "assets/art/source/generated/vfx/units/revival_god-validation.json"

master = Image.open(MASTER).convert("RGBA")
runtime = Image.open(PNG).convert("RGBA")
assert master.size == (1254, 1254), master.size
assert runtime.size == (256, 256), runtime.size
assert master.getchannel("A").getextrema() == (0, 255)
assert runtime.getchannel("A").getextrema() == (0, 255)
box_master = master.getchannel("A").point(lambda n: 255 if n > 8 else 0).getbbox()
box_runtime = runtime.getchannel("A").point(lambda n: 255 if n > 8 else 0).getbbox()
assert box_master and box_runtime
assert min(box_master[0], box_master[1], 1254 - box_master[2], 1254 - box_master[3]) >= 20
assert min(box_runtime[0], box_runtime[1], 256 - box_runtime[2], 256 - box_runtime[3]) >= 4
svg = SVG.read_text(encoding="utf-8")
assert 'data-unit="revival_god"' in svg
assert 'data-art-source="per-id"' in svg
assert "revival_god-master.png" in svg
profile = json.loads(PROFILES.read_text(encoding="utf-8"))["revival_god"]
assert profile == {
    "art": "./assets/art/vfx/units/revival_god.png",
    "style": "magebolt",
    "accent": "#77DCA5",
    "halo": "#F5FFE2",
    "trail": "spiral",
    "impact": "impact-magic",
    "impactShape": "rune",
    "rank": 5,
}
hash_value = hashlib.sha256(PNG.read_bytes()).hexdigest()
other_hashes = {
    hashlib.sha256(path.read_bytes()).hexdigest()
    for path in (ROOT / "assets/art/vfx/units").glob("*.png") if path != PNG
}
assert hash_value not in other_hashes, "Effect duplicates another unit PNG"

# Actual-size left/right previews first; nearest-neighbor enlargement is for
# human inspection and does not modify either game texture.
font_path = Path("C:/Windows/Fonts/msyh.ttc")
font = ImageFont.truetype(str(font_path), 16) if font_path.exists() else ImageFont.load_default()
small = runtime.resize((64, 64), Image.Resampling.LANCZOS)
board = Image.new("RGBA", (330, 176), (247, 243, 232, 255))
draw = ImageDraw.Draw(board)
draw.text((14, 9), "复苏圣像 · 64px 特效", fill=(52, 48, 43), font=font)
for i, bg in enumerate(((230, 210, 171, 255), (32, 39, 48, 255))):
    x = 22 + i * 160
    tile = Image.new("RGBA", (64, 64), bg)
    tile.alpha_composite(small)
    board.alpha_composite(tile.resize((128, 128), Image.Resampling.NEAREST), (x, 37))
PREVIEW.parent.mkdir(parents=True, exist_ok=True)
board.convert("RGB").save(PREVIEW, optimize=True)

result = {
    "id": "revival_god",
    "status": "pass",
    "masterSize": list(master.size),
    "masterAlphaBoxGt8": list(box_master),
    "runtimeSize": list(runtime.size),
    "runtimeAlphaBoxGt8": list(box_runtime),
    "runtimeSha256": hash_value,
    "uniqueAgainstOtherRuntimeVfx": True,
    "editableSvgPerIdMaster": True,
    "rank": profile["rank"],
    "preview": str(PREVIEW.relative_to(ROOT)).replace("\\", "/"),
}
REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, ensure_ascii=False))
