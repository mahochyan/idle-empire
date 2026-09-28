"""Narrow QA of four newly authored enemy VFX and their rank hierarchy."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[4]
IDS = ("silence_god", "trial_guard_easy", "trial_guard_perfect", "trial_guard_extreme")
RANKS = (5, 2, 4, 5)
STYLES = ("magebolt", "thrust", "magebolt", "swordqi")
LABELS = ("缄默之神 · 封印波", "圣域守卫 · 短戟", "幻影守卫 · 镜弯月", "修罗守卫 · 双弯刃")
MASTER_DIR = ROOT / "assets/art/source/generated/vfx/units"
PNG_DIR = ROOT / "assets/art/vfx/units"
SVG_DIR = ROOT / "assets/art/source/vfx/units"
PROFILES = json.loads((ROOT / "assets/art/vfx/unit-vfx-profiles.json").read_text(encoding="utf-8"))
PREVIEW = ROOT / "hd2d-previews/qa-vfx-awakening-four-64.png"
REPORT = MASTER_DIR / "awakening-four-validation.json"

font_path = Path("C:/Windows/Fonts/msyh.ttc")
font = ImageFont.truetype(str(font_path), 16) if font_path.exists() else ImageFont.load_default()
board = Image.new("RGBA", (360, 714), (249, 246, 236, 255))
draw = ImageDraw.Draw(board)
result = {}
chosen_hashes = []
for i, (unit_id, rank, style, label) in enumerate(zip(IDS, RANKS, STYLES, LABELS)):
    master_path = MASTER_DIR / f"{unit_id}-master.png"
    runtime_path = PNG_DIR / f"{unit_id}.png"
    svg_path = SVG_DIR / f"{unit_id}.svg"
    master = Image.open(master_path).convert("RGBA")
    runtime = Image.open(runtime_path).convert("RGBA")
    assert master.size == (1254, 1254)
    assert runtime.size == (256, 256)
    assert master.getchannel("A").getextrema() == (0, 255)
    assert runtime.getchannel("A").getextrema() == (0, 255)
    alpha_box = runtime.getchannel("A").point(lambda n: 255 if n > 8 else 0).getbbox()
    assert alpha_box
    assert min(alpha_box[0], alpha_box[1], 256 - alpha_box[2], 256 - alpha_box[3]) >= 4, (unit_id, alpha_box)
    svg = svg_path.read_text(encoding="utf-8")
    assert f'data-unit="{unit_id}"' in svg
    assert 'data-art-source="per-id"' in svg
    assert f"{unit_id}-master.png" in svg
    profile = PROFILES[unit_id]
    assert profile["art"] == f"./assets/art/vfx/units/{unit_id}.png"
    assert profile["style"] == style and profile["rank"] == rank
    hash_value = hashlib.sha256(runtime_path.read_bytes()).hexdigest()
    chosen_hashes.append(hash_value)
    strong_pixels = sum(n > 32 for n in runtime.getchannel("A").getdata())
    result[unit_id] = {
        "rank": rank,
        "style": style,
        "masterAlphaBoxGt8": list(master.getchannel("A").point(lambda n: 255 if n > 8 else 0).getbbox()),
        "runtimeAlphaBoxGt8": list(alpha_box),
        "runtimeStrongAlphaPixelsGt32": strong_pixels,
        "runtimeSha256": hash_value,
        "editableSvgPerIdMaster": True,
    }
    y = 7 + i * 176
    draw.text((10, y), f"{label} · R{rank}", font=font, fill=(49, 45, 44))
    small = runtime.resize((64, 64), Image.Resampling.LANCZOS)
    for j, bg in enumerate(((230, 210, 171, 255), (32, 39, 48, 255))):
        tile = Image.new("RGBA", (64, 64), bg)
        tile.alpha_composite(small)
        board.alpha_composite(tile.resize((128, 128), Image.Resampling.NEAREST),
                              (18 + j * 166, y + 32))

assert len(set(chosen_hashes)) == 4
other_hashes = {
    hashlib.sha256(path.read_bytes()).hexdigest()
    for path in PNG_DIR.glob("*.png") if path.stem not in IDS
}
assert not (set(chosen_hashes) & other_hashes)
assert (result["trial_guard_easy"]["runtimeStrongAlphaPixelsGt32"]
        < result["trial_guard_perfect"]["runtimeStrongAlphaPixelsGt32"]
        < result["trial_guard_extreme"]["runtimeStrongAlphaPixelsGt32"])
PREVIEW.parent.mkdir(parents=True, exist_ok=True)
board.convert("RGB").save(PREVIEW, optimize=True)
report = {"status": "pass", "ids": result, "distinctRuntimeHashes": True,
          "trialIntensityPixelsIncreasing": True,
          "preview": str(PREVIEW.relative_to(ROOT)).replace("\\", "/")}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
