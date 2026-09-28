"""Package the existing ImageGen Bronze Age clear master as a center-only ROI.

This performs crop, resize, alpha masking and comparison only. It does not
paint new art. The original runtime scene and generated master stay untouched.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ORIGINAL = ROOT / "assets/art/scene/town-sci_bronze_age.png"
MASTER = ROOT / "assets/art/source/generated/town-sci_bronze_age-clean-candidate/town-sci_bronze_age-clean-master.png"
OUT = ROOT / "assets/art/scene/candidates/town-sci_bronze_age-clean-candidate.png"
MASK = ROOT / "assets/art/scene/candidates/town-sci_bronze_age-clean-center-mask.png"
PREVIEW = ROOT / "hd2d-previews/qa-town-sci_bronze_age-clean-360x200.png"
METRICS = HERE / "bronze-clean-packaging.json"

SIZE = (1024, 525)
SOURCE_CROP = (0, 42, 1672, 899)  # Same runtime cut as scene/optimize.ps1.

# Original full-resolution runtime scene traced around the hall, walls, steps,
# blue standards and small annexes. The separate circular bronze fountain in
# front is retained from the original art through the cutout below.
MAIN_HALL_CORE = [
    (469, 94), (523, 90), (580, 98), (615, 130), (638, 159),
    (653, 202), (666, 226), (666, 268), (642, 293), (610, 307),
    (591, 311), (581, 293), (563, 282), (551, 289), (480, 289),
    (469, 305), (448, 312), (423, 300), (393, 272), (383, 225),
    (395, 180), (423, 137),
]
EXPAND_PIXELS = 18
FEATHER_PIXELS = 7
FOUNTAIN_KEEP = (491, 282, 558, 333)


def cover_360x200(image: Image.Image) -> Image.Image:
    width, height = image.size
    scale = max(360 / width, 200 / height)
    scaled = image.resize((round(width * scale), round(height * scale)), Image.Resampling.LANCZOS)
    x = (scaled.width - 360) // 2
    y = (scaled.height - 200) // 2
    return scaled.crop((x, y, x + 360, y + 200)).convert("RGB")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    original = Image.open(ORIGINAL).convert("RGBA")
    master = Image.open(MASTER).convert("RGB")
    assert original.size == SIZE and master.size == (1672, 941)
    full_clean = master.crop(SOURCE_CROP).resize(SIZE, Image.Resampling.BICUBIC).convert("RGBA")

    core = Image.new("L", SIZE, 0)
    ImageDraw.Draw(core).polygon(MAIN_HALL_CORE, fill=255)
    expanded = core.filter(ImageFilter.MaxFilter(EXPAND_PIXELS * 2 + 1))
    # The fountain was present in both scenes but the generated version shifts
    # its tiny details; retaining the source one avoids a needless landmark edit.
    ImageDraw.Draw(expanded).ellipse(FOUNTAIN_KEEP, fill=0)
    mask = expanded.filter(ImageFilter.GaussianBlur(FEATHER_PIXELS))
    roi = Image.composite(full_clean, original, mask)

    # Exact four-channel preservation outside alpha support, including the
    # original scene's few partially transparent pixels.
    outside = mask.point(lambda v: 255 if v == 0 else 0)
    outside_diff = Image.composite(ImageChops.difference(roi, original),
                                   Image.new("RGBA", SIZE), outside)
    # RGBA getbbox can default to checking alpha alone, so inspect all four
    # extrema explicitly; RGB drift with unchanged alpha must still fail.
    assert all(high == 0 for _, high in ImageStat.Stat(outside_diff).extrema)
    assert roi.getpixel((520, 310)) == original.getpixel((520, 310))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    roi.save(OUT, format="PNG", optimize=True)
    mask.save(MASK, format="PNG", optimize=True)

    canvas = Image.new("RGB", (1114, 230), "#faf8f1")
    draw = ImageDraw.Draw(canvas)
    panels = (
        (original, "ORIGINAL 360x200"),
        (full_clean, "FULL IMAGEGEN EDIT (outside drifts)"),
        (roi, "CENTER-ONLY 360x200"),
    )
    for index, (art, label) in enumerate(panels):
        left = 6 + index * 370
        canvas.paste(cover_360x200(art), (left, 25))
        draw.text((left, 6), label, fill="#253c42")
    canvas.save(PREVIEW, format="PNG", optimize=True)

    orig_rgb, full_rgb = original.convert("RGB"), full_clean.convert("RGB")
    full_outside_delta = sum(ImageStat.Stat(ImageChops.difference(orig_rgb, full_rgb),
                                            mask=outside).mean[:3]) / 3
    inner_diff = ImageChops.difference(roi.convert("RGB"), orig_rgb)
    inner = mask.point(lambda v: 255 if v == 255 else 0)
    inner_delta = sum(ImageStat.Stat(inner_diff, mask=inner).mean[:3]) / 3
    info = {
        "original": str(ORIGINAL.relative_to(ROOT)).replace("\\", "/"),
        "master": str(MASTER.relative_to(ROOT)).replace("\\", "/"),
        "roi": str(OUT.relative_to(ROOT)).replace("\\", "/"),
        "mask": str(MASK.relative_to(ROOT)).replace("\\", "/"),
        "preview": str(PREVIEW.relative_to(ROOT)).replace("\\", "/"),
        "size": list(SIZE),
        "sourceCrop": list(SOURCE_CROP),
        "corePolygon": MAIN_HALL_CORE,
        "dilatePx": EXPAND_PIXELS,
        "featherPx": FEATHER_PIXELS,
        "fountainKeepEllipse": list(FOUNTAIN_KEEP),
        "maskBounds": list(mask.getbbox()) if mask.getbbox() else None,
        "maskNonzeroFraction": round(sum(v > 0 for v in mask.getdata()) / (SIZE[0] * SIZE[1]), 4),
        "outsideExactRgba": True,
        "outsideFullEditMeanRgbDelta255": round(full_outside_delta, 3),
        "insideOpaqueMeanRgbDelta255": round(inner_delta, 3),
        "originalSha256": sha256(ORIGINAL),
        "masterSha256": sha256(MASTER),
        "roiSha256": sha256(OUT),
        "maskSha256": sha256(MASK),
    }
    METRICS.write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("BRONZE_CLEAN", json.dumps({k: info[k] for k in (
        "roi", "mask", "preview", "maskBounds", "maskNonzeroFraction",
        "outsideExactRgba", "outsideFullEditMeanRgbDelta255",
        "insideOpaqueMeanRgbDelta255")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
