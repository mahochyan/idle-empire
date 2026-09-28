"""Review generated per-unit attack art without touching runtime VFX files.

Usage: python assets/art/source/vfx/review-techline-batches.py
Requires Pillow as a development-only tool.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ART = Path(__file__).resolve().parents[2]
REPO = ART.parent.parent
MASTERS = ART / "source/generated/vfx/units"
CANDIDATE_DIRS = {
    2: REPO / "hd2d-previews/vfx-batch2-candidates",
    3: REPO / "hd2d-previews/vfx-batch3-4-candidates",
    4: REPO / "hd2d-previews/vfx-batch3-4-candidates",
}
PREVIEWS = REPO / "hd2d-previews"
BATCHES = {
    2: ["infantry_shield", "infantry_spear", "archer_crossbow", "cavalry_t1", "iron_spearman", "gold_cavalry"],
    3: ["infantry_t1", "archer_t1", "spearman", "cavalry_wind", "alloy_special", "armored_trooper"],
    4: ["infantry_sword", "infantry_fortress", "archer_silverbow", "archer_longbow", "cavalry_iron", "cavalry_dragon"],
}
VISUAL_REVIEW = {
    "infantry_t1": "Rank-2 steel slash is broader than base infantry but keeps a physical blade silhouette.",
    "archer_t1": "Rank-2 green arrow volley reads as arrows rather than an orb on both backgrounds.",
    "spearman": "Rank-1 plain spear is intentionally narrow, but its shaft and iron point remain identifiable at 64px.",
    "cavalry_wind": "Rank-3 turquoise wind quarrel reads apart from the ranger volley.",
    "alloy_special": "Rank-4 segmented alloy dart has a distinct engineered nose and fins.",
    "armored_trooper": "Rank-4 brass piston shell and square steam read as a heavier industrial attack.",
    "infantry_sword": "Rank-3 broad greatsword flash has more weight than the trained infantry cut.",
    "infantry_fortress": "Rank-4 gold-blue shield and teal collision edge form a distinct bash silhouette.",
    "archer_silverbow": "Rank-3 silver shot remains slim; a thin dark-blue SVG centerline makes its arrow point readable on light sand.",
    "archer_longbow": "Rank-4 long dark shaft and blue wake span a larger horizontal silhouette than the silver shot.",
    "cavalry_iron": "Rank-3 plated iron wedge reads as a heavy cavalry impact.",
    "cavalry_dragon": "Rank-4 orange flame S and lance tip read as mounted fire rather than a mage orb.",
}
LIGHT = (246, 240, 224, 255)
DARK = (47, 59, 67, 255)
INK = (40, 51, 57, 255)
PANEL_W = 304


def read_art(path: Path) -> tuple[Image.Image, dict]:
    if not path.is_file():
        raise FileNotFoundError(path)
    source = path.read_bytes()
    with Image.open(path) as original:
        if original.format != "PNG":
            raise ValueError(f"Expected PNG: {path}")
        rgba = original.convert("RGBA")
    alpha = rgba.getchannel("A")
    alpha_range = alpha.getextrema()
    bbox = alpha.getbbox()
    if not bbox or alpha_range[0] != 0 or alpha_range[1] != 255:
        raise ValueError(f"Missing transparent and opaque pixels: {path}")
    count = sum(1 for value in alpha.getdata() if value > 8)
    width, height = rgba.size
    summary = {
        "path": path.relative_to(REPO).as_posix(),
        "sha256": hashlib.sha256(source).hexdigest(),
        "dimensions": [width, height],
        "alphaRange": list(alpha_range),
        "alphaBBox": list(bbox),
        "visibleFraction": round(count / (width * height), 4),
        "borderClear": bbox[0] > 0 and bbox[1] > 0 and bbox[2] < width and bbox[3] < height,
    }
    return rgba, summary


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path = Path("C:/Windows/Fonts/arial.ttf")
    return ImageFont.truetype(str(path), size) if path.is_file() else ImageFont.load_default()


def present_64(image: Image.Image, background: tuple[int, ...]) -> Image.Image:
    # Fit the original image into a 64px game-size square, then magnify using
    # nearest neighbor so a reviewer can inspect the actual small silhouette.
    small = image.copy()
    small.thumbnail((64, 64), Image.Resampling.LANCZOS)
    tile = Image.new("RGBA", (64, 64), background)
    tile.alpha_composite(small, ((64 - small.width) // 2, (64 - small.height) // 2))
    return tile.resize((128, 128), Image.Resampling.NEAREST).convert("RGB")


def gallery(ids: list[str], pictures: dict[str, Image.Image], output: Path,
            candidate_pictures: dict[str, Image.Image] | None = None,
            second_label: str = "candidate") -> None:
    panel_h = 350 if candidate_pictures else 184
    canvas = Image.new("RGB", (PANEL_W * 3, panel_h * 2), (255, 255, 255))
    draw = ImageDraw.Draw(canvas)
    title_font = font(17)
    caption_font = font(14)
    for index, unit_id in enumerate(ids):
        x = index % 3 * PANEL_W
        y = index // 3 * panel_h
        draw.rectangle((x, y, x + PANEL_W - 2, y + panel_h - 2), fill=(251, 249, 242), outline=(206, 205, 192))
        draw.text((x + 11, y + 8), unit_id, font=title_font, fill=INK)
        for row, image in enumerate([pictures[unit_id]] + ([candidate_pictures[unit_id]] if candidate_pictures else [])):
            top = y + 31 + row * 166
            canvas.paste(present_64(image, LIGHT), (x + 12, top))
            canvas.paste(present_64(image, DARK), (x + 164, top))
            label = second_label if candidate_pictures and row else "master"
            draw.text((x + 12, top + 132), f"{label} · light", font=caption_font, fill=INK)
            draw.text((x + 164, top + 132), f"{label} · dark", font=caption_font, fill=INK)
    canvas.save(output)


def main() -> None:
    PREVIEWS.mkdir(exist_ok=True)
    profiles = json.loads((ART / "vfx/unit-vfx-profiles.json").read_text(encoding="utf-8"))
    manifest = json.loads((ART / "manifest.json").read_text(encoding="utf-8"))["unitVfx"]
    masters: dict[str, Image.Image] = {}
    candidates: dict[str, Image.Image] = {}
    runtimes: dict[str, Image.Image] = {}
    report: dict = {
        "status": "integrated: batches 2, 3 and 4 have per-ID runtime PNGs and editable SVGs",
        "method": "Pillow RGBA/SHA-256, candidate/runtime equality, previous PNG backups and 64px light/dark visual review",
        "visualReview": VISUAL_REVIEW,
        "batches": {},
    }
    master_hashes: set[str] = set()
    candidate_hashes: set[str] = set()
    for batch, ids in BATCHES.items():
        meta = manifest[f"techLineBatch{batch}"]
        if (set(meta["integratedIds"]) != set(ids)
                or meta["promptNotes"] != f"source/generated/vfx/units/PROMPTS-techline-batch{batch}.json"
                or meta["previousRuntimeDirectory"] != f"source/generated/vfx/units/previous-runtime-batch{batch}"):
            raise ValueError(f"VFX manifest batch {batch} does not match the integrated art inventory")
        prompts = json.loads((MASTERS / f"PROMPTS-techline-batch{batch}.json").read_text(encoding="utf-8"))
        if set(prompts["subjects"]) != set(ids):
            raise ValueError(f"Prompt ID mismatch in batch {batch}")
        report["batches"][str(batch)] = {}
        for unit_id in ids:
            if unit_id not in profiles:
                raise ValueError(f"Unknown CFG unit profile: {unit_id}")
            if not (ART / f"units/hires/{unit_id}.png").is_file():
                raise ValueError(f"Missing matching unit portrait: {unit_id}")
            if not profiles[unit_id]["art"].endswith(f"/vfx/units/{unit_id}.png"):
                raise ValueError(f"Profile art ID mismatch: {unit_id}")
            master, master_info = read_art(MASTERS / f"{unit_id}-master.png")
            candidate, candidate_info = read_art(CANDIDATE_DIRS[batch] / f"{unit_id}.png")
            runtime, runtime_info = read_art(ART / f"vfx/units/{unit_id}.png")
            _, previous_info = read_art(ART / meta["previousRuntimeDirectory"] / f"{unit_id}.png")
            if master_info["sha256"] in master_hashes:
                raise ValueError(f"Duplicate master hash: {unit_id}")
            if (runtime.size != (256, 256) or not runtime_info["borderClear"]
                    or candidate_info["sha256"] != runtime_info["sha256"]
                    or previous_info["sha256"] == runtime_info["sha256"]
                    or runtime_info["sha256"] in candidate_hashes):
                raise ValueError(f"Candidate/runtime, backup or uniqueness mismatch: {unit_id}")
            source_svg = ART / f"source/vfx/units/{unit_id}.svg"
            source_text = source_svg.read_text(encoding="utf-8")
            if (f'data-unit="{unit_id}" data-art-source="per-id"' not in source_text
                    or f'{unit_id}-master.png' not in source_text):
                raise ValueError(f"Editable SVG does not reference its own master: {unit_id}")
            if unit_id == "archer_silverbow" and 'data-mobile-contrast="silverbow"' not in source_text:
                raise ValueError("Silver bow mobile contrast layer missing")
            master_hashes.add(master_info["sha256"])
            candidate_hashes.add(runtime_info["sha256"])
            masters[unit_id] = master
            candidates[unit_id] = candidate
            runtimes[unit_id] = runtime
            report["batches"][str(batch)][unit_id] = {
                "integrationStatus": "integrated",
                "profileArt": profiles[unit_id]["art"],
                "rank": profiles[unit_id]["rank"],
                "master": master_info,
                "candidate": candidate_info,
                "runtime": runtime_info,
                "previousRuntime": previous_info,
                "editableSource": source_svg.relative_to(REPO).as_posix(),
            }
        gallery(ids, masters, PREVIEWS / f"qa-vfx-techline-batch{batch}-masters-64.png")
        gallery(ids, masters, PREVIEWS / f"qa-vfx-techline-batch{batch}-candidates-64.png", candidates)
        gallery(ids, masters, PREVIEWS / f"qa-vfx-techline-batch{batch}-runtime-64.png", runtimes,
                second_label="runtime")
    output = MASTERS / "techline-batches-2-4-validation.json"
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Reviewed {len(master_hashes)} unique transparent masters and {len(candidate_hashes)} integrated 256px runtime PNGs.")
    print(f"Wrote {output.relative_to(REPO)} and nine 64px light/dark galleries.")


if __name__ == "__main__":
    main()
