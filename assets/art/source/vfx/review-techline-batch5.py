"""Check integrated batch-5 attack masters, editable SVGs and runtime PNGs.

Usage: python assets/art/source/vfx/review-techline-batch5.py
Requires Pillow only in the development environment. Does not write runtime art.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw


ART = Path(__file__).resolve().parents[2]
REPO = ART.parent.parent
MASTER_DIR = ART / "source/generated/vfx/units"
CANDIDATE_DIR = REPO / "hd2d-previews/vfx-batch5-candidates"
BACKUP_DIR = MASTER_DIR / "previous-runtime-batch5"
IDS = [
    "infantry_ironrose",
    "infantry_bloodrose",
    "archer_assassin",
    "archer_genoese",
    "cavalry_teutonic",
    "mage_t1",
]
COMPARISONS = [
    ("infantry_spear", "infantry_ironrose"),
    ("infantry_sword", "infantry_bloodrose"),
    ("archer_assassin", "archer_shadowblade"),
    ("archer_crossbow", "archer_genoese"),
    ("gold_cavalry", "cavalry_teutonic"),
    ("mage_t1", "mage_time"),
]
VISUAL_REVIEW = {
    "infantry_ironrose": "Pass after edit: broad steel thrust and iron-rose petal guard read at 64px on both grounds; red pressure layers add rank-4 weight beyond the rank-3 gold spear.",
    "infantry_bloodrose": "Pass: crimson paired sword arcs and shield chips remain distinct from the spear and are fuller than the rank-3 sword cut.",
    "archer_assassin": "Pass: compact teal/violet crossed short blades read as a twin-blade strike; less expansive than the rank-4 shadowblade arcs.",
    "archer_genoese": "Pass: reinforced heavy quarrel, thick bodkin and mechanical bowstring echoes read heavier than the rank-3 crossbow shot.",
    "cavalry_teutonic": "Pass: broad ivory steel charge with plated fragments and heraldic cross reads as heavy cavalry; rank-4 complexity comes from armor rather than brighter saturation than gold cavalry.",
    "mage_t1": "Pass after edit: enlarged blue-outlined star and amber rune notches are legible at 64px on light and dark grounds; simpler than the rank-3 time spell.",
}


def runtime_gallery(helper, runtimes: dict, output: Path) -> None:
    panel_w, panel_h = 304, 184
    canvas = Image.new("RGB", (panel_w * 3, panel_h * 2), (255, 255, 255))
    draw = ImageDraw.Draw(canvas)
    title_font = helper.font(17)
    caption_font = helper.font(14)
    for index, unit_id in enumerate(IDS):
        x, y = index % 3 * panel_w, index // 3 * panel_h
        draw.rectangle((x, y, x + panel_w - 2, y + panel_h - 2), fill=(251, 249, 242), outline=(206, 205, 192))
        draw.text((x + 11, y + 8), unit_id, font=title_font, fill=helper.INK)
        canvas.paste(helper.present_64(runtimes[unit_id], helper.LIGHT), (x + 12, y + 31))
        canvas.paste(helper.present_64(runtimes[unit_id], helper.DARK), (x + 164, y + 31))
        draw.text((x + 12, y + 163), "runtime · light", font=caption_font, fill=helper.INK)
        draw.text((x + 164, y + 163), "runtime · dark", font=caption_font, fill=helper.INK)
    canvas.save(output)


def comparison_gallery(helper, profiles: dict, output: Path) -> None:
    panel_w, panel_h = 568, 189
    canvas = Image.new("RGB", (panel_w * 2, panel_h * 3), (255, 255, 255))
    draw = ImageDraw.Draw(canvas)
    font = helper.font(15)
    label_font = helper.font(13)
    for index, (left_id, right_id) in enumerate(COMPARISONS):
        x, y = index % 2 * panel_w, index // 2 * panel_h
        draw.rectangle((x, y, x + panel_w - 2, y + panel_h - 2), fill=(251, 249, 242), outline=(206, 205, 192))
        title = f"{left_id} R{profiles[left_id]['rank']}  →  {right_id} R{profiles[right_id]['rank']}"
        draw.text((x + 10, y + 7), title, fill=helper.INK, font=font)
        for side, unit_id in enumerate((left_id, right_id)):
            sprite, _ = helper.read_art(ART / f"vfx/units/{unit_id}.png")
            base_x = x + 10 + side * 278
            canvas.paste(helper.present_64(sprite, helper.LIGHT), (base_x, y + 31))
            canvas.paste(helper.present_64(sprite, helper.DARK), (base_x + 138, y + 31))
            draw.text((base_x, y + 163), "runtime · light/dark", fill=helper.INK, font=label_font)
    canvas.save(output)


def main() -> None:
    helper_path = Path(__file__).with_name("review-techline-batches.py")
    spec = importlib.util.spec_from_file_location("vfx_review_helpers", helper_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load VFX review helpers: {helper_path}")
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    profiles = json.loads((ART / "vfx/unit-vfx-profiles.json").read_text(encoding="utf-8"))
    batch = json.loads((ART / "manifest.json").read_text(encoding="utf-8"))["unitVfx"]["techLineBatch5"]
    if (set(batch["integratedIds"]) != set(IDS)
            or batch["previousRuntimeDirectory"] != "source/generated/vfx/units/previous-runtime-batch5"
            or batch["promptNotes"] != "source/generated/vfx/units/PROMPTS-techline-batch5.json"):
        raise ValueError("Batch-5 manifest does not match the integrated art inventory")
    prompts = json.loads((MASTER_DIR / "PROMPTS-techline-batch5.json").read_text(encoding="utf-8"))
    if set(prompts["subjects"]) != set(IDS):
        raise ValueError("Batch-5 prompt IDs do not match the six selected CFG units")
    runtimes = {}
    report = {
        "status": "integrated: six per-ID masters rendered to runtime PNGs and editable SVGs",
        "method": "Pillow RGBA, SHA-256, candidate/runtime equality, backup difference, 64px light/dark gallery and manual silhouette/rank comparison",
        "visualReview": VISUAL_REVIEW,
        "units": {},
    }
    master_hashes = set()
    runtime_hashes = set()
    for unit_id in IDS:
        if unit_id not in profiles or not (ART / f"units/hires/{unit_id}.png").is_file():
            raise ValueError(f"Unknown unit ID or missing matching portrait: {unit_id}")
        if not profiles[unit_id]["art"].endswith(f"/vfx/units/{unit_id}.png"):
            raise ValueError(f"Profile art path does not match unit ID: {unit_id}")
        _, master_info = helper.read_art(MASTER_DIR / f"{unit_id}-master.png")
        _, candidate_info = helper.read_art(CANDIDATE_DIR / f"{unit_id}.png")
        runtime, runtime_info = helper.read_art(ART / f"vfx/units/{unit_id}.png")
        _, backup_info = helper.read_art(BACKUP_DIR / f"{unit_id}.png")
        if runtime.size != (256, 256) or not runtime_info["borderClear"]:
            raise ValueError(f"Runtime dimension/transparent margin error: {unit_id}")
        if master_info["sha256"] in master_hashes or runtime_info["sha256"] in runtime_hashes:
            raise ValueError(f"Duplicated master or runtime image: {unit_id}")
        if candidate_info["sha256"] != runtime_info["sha256"] or backup_info["sha256"] == runtime_info["sha256"]:
            raise ValueError(f"Candidate/runtime or backup mismatch: {unit_id}")
        svg = ART / f"source/vfx/units/{unit_id}.svg"
        svg_text = svg.read_text(encoding="utf-8")
        if f'data-unit="{unit_id}" data-art-source="per-id"' not in svg_text or f'{unit_id}-master.png' not in svg_text:
            raise ValueError(f"Editable SVG does not reference its own master: {unit_id}")
        master_hashes.add(master_info["sha256"])
        runtime_hashes.add(runtime_info["sha256"])
        runtimes[unit_id] = runtime
        report["units"][unit_id] = {
            "profileStyle": profiles[unit_id]["style"],
            "rank": profiles[unit_id]["rank"],
            "master": master_info,
            "candidate": candidate_info,
            "runtime": runtime_info,
            "previousRuntime": backup_info,
            "editableSource": svg.relative_to(REPO).as_posix(),
        }
    gallery = REPO / "hd2d-previews/qa-vfx-techline-batch5-runtime-64.png"
    runtime_gallery(helper, runtimes, gallery)
    comparison = REPO / "hd2d-previews/qa-vfx-techline-batch5-rank-comparison-64.png"
    comparison_gallery(helper, profiles, comparison)
    validation = MASTER_DIR / "techline-batch5-validation.json"
    validation.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Checked {len(IDS)} distinct runtime PNGs, same-hash candidates, prior PNG backups and editable SVGs.")
    print(f"Wrote {gallery.relative_to(REPO)}, {comparison.relative_to(REPO)} and {validation.relative_to(REPO)}.")


if __name__ == "__main__":
    main()
