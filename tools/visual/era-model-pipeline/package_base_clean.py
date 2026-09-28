"""Package the existing ImageGen base-era clear master as a center-only ROI.

The old full-image town-base-clean-candidate.png stays intact for the separate
projective-hall study. This script only crops, resizes, masks and compares art.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ORIGINAL = ROOT / "assets/art/scene/town-base.png"
MASTER = ROOT / "assets/art/source/generated/town-base-clean-candidate/town-base-clean-master.png"
EXISTING_FULL_CLEAN = ROOT / "assets/art/scene/candidates/town-base-clean-candidate.png"
OUT = ROOT / "assets/art/scene/candidates/town-base-clean-roi-candidate.png"
MASK = ROOT / "assets/art/scene/candidates/town-base-clean-center-mask.png"
PREVIEW = ROOT / "hd2d-previews/qa-town-base-clean-roi-360x200.png"
PHONE_PREVIEW = ROOT / "hd2d-previews/qa-town-base-clean-roi-phone-widths.png"
METRICS = HERE / "base-clean-packaging.json"

SIZE = (1024, 525)
SOURCE_CROP = (0, 42, 1672, 899)  # Match scene/optimize.ps1.

# Traced from the original hall: roof apex, overhangs, round palisade, stone
# plinth, front steps and blue standards. The neighboring academy, military
# compound and road-side cottages remain outside the opaque core.
MAIN_HALL_CORE = [
    (490, 92), (545, 94), (610, 135), (653, 190), (660, 255),
    (616, 296), (572, 333), (454, 333), (408, 300), (365, 257),
    (370, 189), (422, 132),
]
EXPAND_PIXELS = 16
FEATHER_PIXELS = 8


def cover_to(image: Image.Image, target: tuple[int, int]) -> Image.Image:
    target_width, target_height = target
    width, height = image.size
    scale = max(target_width / width, target_height / height)
    scaled = image.resize((round(width * scale), round(height * scale)), Image.Resampling.LANCZOS)
    x = (scaled.width - target_width) // 2
    y = (scaled.height - target_height) // 2
    return scaled.crop((x, y, x + target_width, y + target_height)).convert("RGB")


def cover_360x200(image: Image.Image) -> Image.Image:
    return cover_to(image, (360, 200))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    original = Image.open(ORIGINAL).convert("RGBA")
    master = Image.open(MASTER).convert("RGB")
    assert original.size == SIZE and master.size == (1672, 941)
    full_clean = master.crop(SOURCE_CROP).resize(SIZE, Image.Resampling.BICUBIC).convert("RGBA")

    core = Image.new("L", SIZE, 0)
    ImageDraw.Draw(core).polygon(MAIN_HALL_CORE, fill=255)
    mask = core.filter(ImageFilter.MaxFilter(EXPAND_PIXELS * 2 + 1))
    mask = mask.filter(ImageFilter.GaussianBlur(FEATHER_PIXELS))
    roi = Image.composite(full_clean, original, mask)

    outside = mask.point(lambda value: 255 if value == 0 else 0)
    outside_diff = Image.composite(ImageChops.difference(roi, original),
                                   Image.new("RGBA", SIZE), outside)
    assert all(high == 0 for _, high in ImageStat.Stat(outside_diff).extrema)
    assert roi.getpixel((516, 170)) != original.getpixel((516, 170))

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

    phone_sizes = ((320, 180), (360, 200), (390, 210), (430, 220))
    phone = Image.new("RGB", (900, 934), "#faf8f1")
    phone_draw = ImageDraw.Draw(phone)
    y = 5
    for size in phone_sizes:
        width, height = size
        phone_draw.text((6, y), f"ORIGINAL {width}x{height}", fill="#253c42")
        phone_draw.text((450, y), f"CENTER ROI {width}x{height}", fill="#253c42")
        phone.paste(cover_to(original, size), (6, y + 20))
        phone.paste(cover_to(roi, size), (450, y + 20))
        y += height + 28
    phone.save(PHONE_PREVIEW, format="PNG", optimize=True)

    original_rgb = original.convert("RGB")
    full_outside_delta = sum(ImageStat.Stat(
        ImageChops.difference(original_rgb, full_clean.convert("RGB")),
        mask=outside).mean[:3]) / 3
    inner = mask.point(lambda value: 255 if value == 255 else 0)
    inner_delta = sum(ImageStat.Stat(
        ImageChops.difference(original_rgb, roi.convert("RGB")),
        mask=inner).mean[:3]) / 3
    info = {
        "original": str(ORIGINAL.relative_to(ROOT)).replace("\\", "/"),
        "master": str(MASTER.relative_to(ROOT)).replace("\\", "/"),
        "existingFullCleanUnchanged": str(EXISTING_FULL_CLEAN.relative_to(ROOT)).replace("\\", "/"),
        "existingFullCleanSha256": sha256(EXISTING_FULL_CLEAN),
        "roi": str(OUT.relative_to(ROOT)).replace("\\", "/"),
        "mask": str(MASK.relative_to(ROOT)).replace("\\", "/"),
        "preview": str(PREVIEW.relative_to(ROOT)).replace("\\", "/"),
        "phonePreview": str(PHONE_PREVIEW.relative_to(ROOT)).replace("\\", "/"),
        "size": list(SIZE),
        "sourceCrop": list(SOURCE_CROP),
        "corePolygon": MAIN_HALL_CORE,
        "dilatePx": EXPAND_PIXELS,
        "featherPx": FEATHER_PIXELS,
        "maskBounds": list(mask.getbbox()) if mask.getbbox() else None,
        "maskNonzeroFraction": round(sum(value > 0 for value in mask.getdata()) / (SIZE[0] * SIZE[1]), 4),
        "outsideExactRgba": True,
        "outsideFullEditMeanRgbDelta255": round(full_outside_delta, 3),
        "insideOpaqueMeanRgbDelta255": round(inner_delta, 3),
        "originalSha256": sha256(ORIGINAL),
        "masterSha256": sha256(MASTER),
        "roiSha256": sha256(OUT),
        "maskSha256": sha256(MASK),
    }
    METRICS.write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("BASE_CLEAN", json.dumps({key: info[key] for key in (
        "roi", "mask", "preview", "maskBounds", "maskNonzeroFraction",
        "outsideExactRgba", "outsideFullEditMeanRgbDelta255",
        "insideOpaqueMeanRgbDelta255")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
