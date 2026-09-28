"""Verify the final nine distinct per-ID attack VFX and render 64px QA.

Requires Pillow only in the development environment. This does not alter
runtime art; generate it first with generate-unit-vfx.mjs --ids=....
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw


ART = Path(__file__).resolve().parents[2]
REPO = ART.parent.parent
SOURCE = ART / "source/generated/vfx/units"
CANDIDATES = REPO / "hd2d-previews/vfx-final-nine-candidates"
BACKUP = SOURCE / "previous-runtime-final9"
IDS = [
    "archer_shadowblade", "mage_time", "mage_space", "mage_chrono", "mage_merlin",
    "god_crystal_guard", "phantom_god", "guardian_god", "slaughter_god",
]
PROMPT_FILES = [
    SOURCE / "PROMPTS-final-nine-mages-shadow.json",
    SOURCE / "PROMPTS-divine-four.json",
]
VISUAL_REVIEW = {
    "archer_shadowblade": "Two broad steel crescents and blue-green shards read apart from rank-3 assassin's compact X.",
    "mage_time": "A single brass clock ring with a cyan bolt reads as rank-3 time magic.",
    "mage_space": "A fractured violet portal and forward lance read apart from the time clock.",
    "mage_chrono": "Double brass-cyan clock wheels, hourglass and three lances are visibly grander than mage_time; edited to restore clear margins.",
    "mage_merlin": "Gold five-point star and faceted sapphire spear read apart from both spatial portal and clockwork.",
    "god_crystal_guard": "Rank-4 turquoise diamond and octagonal shield counterpulse read on both grounds.",
    "phantom_god": "Rank-5 violet prism lance and staggered afterimages make a separate optical silhouette; tiny shards merge at 64px.",
    "guardian_god": "Rank-5 rectangular bastion shield and two thick square pressure waves read heavier than the octagonal crystal guard; right-side gold is delicate on the light ground.",
    "slaughter_god": "Rank-5 crimson triple cut converges at a clear impact star and differs from shields and lances.",
}


def helper_module():
    path = Path(__file__).with_name("review-techline-batches.py")
    spec = importlib.util.spec_from_file_location("vfx_review_helpers", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load VFX review helpers: {path}")
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    return helper


def meaningful_bbox(path: Path) -> list[int]:
    with Image.open(path) as source:
        alpha = source.convert("RGBA").getchannel("A")
        bbox = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
    if not bbox:
        raise ValueError(f"No meaningful alpha pixels: {path}")
    return list(bbox)


def gallery(helper, pictures: dict[str, Image.Image], output: Path, label: str = "runtime") -> None:
    panel_w, panel_h = 304, 184
    canvas = Image.new("RGB", (panel_w * 3, panel_h * 3), (255, 255, 255))
    draw = ImageDraw.Draw(canvas)
    title = helper.font(16)
    caption = helper.font(14)
    for index, unit_id in enumerate(IDS):
        x, y = index % 3 * panel_w, index // 3 * panel_h
        draw.rectangle((x, y, x + panel_w - 2, y + panel_h - 2), fill=(251, 249, 242), outline=(206, 205, 192))
        draw.text((x + 10, y + 8), unit_id, font=title, fill=helper.INK)
        canvas.paste(helper.present_64(pictures[unit_id], helper.LIGHT), (x + 12, y + 31))
        canvas.paste(helper.present_64(pictures[unit_id], helper.DARK), (x + 164, y + 31))
        draw.text((x + 12, y + 163), f"{label} · light", font=caption, fill=helper.INK)
        draw.text((x + 164, y + 163), f"{label} · dark", font=caption, fill=helper.INK)
    canvas.save(output)


def main() -> None:
    helper = helper_module()
    profiles = json.loads((ART / "vfx/unit-vfx-profiles.json").read_text(encoding="utf-8"))
    manifest = json.loads((ART / "manifest.json").read_text(encoding="utf-8"))["unitVfx"]["finalNineMasters"]
    if set(manifest["integratedIds"]) != set(IDS):
        raise ValueError("Final-nine manifest does not match integrated IDs")
    if manifest["previousRuntimeDirectory"] != "source/generated/vfx/units/previous-runtime-final9":
        raise ValueError("Final-nine backup directory differs from manifest")
    if set(manifest["promptNotes"]) != {str(p.relative_to(ART)).replace("\\", "/") for p in PROMPT_FILES}:
        raise ValueError("Final-nine prompt paths differ from manifest")
    prompted: set[str] = set()
    for path in PROMPT_FILES:
        note = json.loads(path.read_text(encoding="utf-8"))
        prompts = note.get("prompts", {})
        texts = [value if isinstance(value, str) else value.get("prompt") if isinstance(value, dict) else None
                 for value in prompts.values()]
        if not prompts or any(not isinstance(value, str) or len(value) < 150 for value in texts):
            raise ValueError(f"Missing full ImageGen prompts: {path}")
        if prompted.intersection(prompts):
            raise ValueError(f"Duplicate prompt IDs in {path}")
        prompted.update(prompts)
    if prompted != set(IDS):
        raise ValueError("Final-nine prompt files do not cover exactly nine IDs")
    report = {
        "status": "integrated: all nine final per-ID ImageGen masters have runtime PNGs and editable SVGs",
        "method": "Pillow PNG/RGBA, SHA-256 equality/difference, alpha margins, 64px light/dark visual review",
        "visualReview": VISUAL_REVIEW,
        "units": {},
    }
    master_hashes: set[str] = set()
    runtime_hashes: set[str] = set()
    candidates: dict[str, Image.Image] = {}
    runtimes: dict[str, Image.Image] = {}
    for unit_id in IDS:
        if unit_id not in profiles or profiles[unit_id]["art"] != f"./assets/art/vfx/units/{unit_id}.png":
            raise ValueError(f"Missing matching per-ID profile: {unit_id}")
        master_path = SOURCE / f"{unit_id}-master.png"
        _, master_info = helper.read_art(master_path)
        candidate, candidate_info = helper.read_art(CANDIDATES / f"{unit_id}.png")
        runtime, runtime_info = helper.read_art(ART / f"vfx/units/{unit_id}.png")
        _, backup_info = helper.read_art(BACKUP / f"{unit_id}.png")
        if master_info["dimensions"] != [1254, 1254]:
            raise ValueError(f"Unexpected master dimensions: {unit_id}")
        if runtime.size != (256, 256) or not runtime_info["borderClear"]:
            raise ValueError(f"Runtime PNG lacks dimensions or safe margins: {unit_id}")
        if (candidate_info["sha256"] != runtime_info["sha256"]
                or backup_info["sha256"] == runtime_info["sha256"]):
            raise ValueError(f"Candidate/runtime or prior-backup mismatch: {unit_id}")
        if master_info["sha256"] in master_hashes or runtime_info["sha256"] in runtime_hashes:
            raise ValueError(f"Duplicate master/runtime among final nine: {unit_id}")
        svg = ART / f"source/vfx/units/{unit_id}.svg"
        svg_text = svg.read_text(encoding="utf-8")
        if f'data-unit="{unit_id}" data-art-source="per-id"' not in svg_text or f'{unit_id}-master.png' not in svg_text:
            raise ValueError(f"Editable SVG does not reference own master: {unit_id}")
        master_hashes.add(master_info["sha256"])
        runtime_hashes.add(runtime_info["sha256"])
        candidates[unit_id] = candidate
        runtimes[unit_id] = runtime
        report["units"][unit_id] = {
            "rank": profiles[unit_id]["rank"],
            "master": {**master_info, "meaningfulAlphaBBox": meaningful_bbox(master_path)},
            "candidate": candidate_info,
            "runtime": runtime_info,
            "previousRuntime": backup_info,
            "editableSource": svg.relative_to(REPO).as_posix(),
        }
    all_hashes = [hashlib.sha256((ART / f"vfx/units/{unit_id}.png").read_bytes()).hexdigest() for unit_id in profiles]
    if len(all_hashes) != len(set(all_hashes)):
        raise ValueError("At least two CFG units share the same runtime VFX PNG")
    master_paths = [SOURCE / f"{unit_id}-master.png" for unit_id in profiles]
    if any(not path.is_file() for path in master_paths):
        raise ValueError("At least one CFG unit still lacks an independent VFX master")
    all_master_hashes = [hashlib.sha256(path.read_bytes()).hexdigest() for path in master_paths]
    if len(all_master_hashes) != len(set(all_master_hashes)):
        raise ValueError("At least two CFG units share the same VFX master")
    report["allConfiguredUnits"] = {
        "count": len(profiles),
        "uniqueRuntimePngHashes": len(set(all_hashes)),
        "uniqueMasterPngHashes": len(set(all_master_hashes)),
    }
    output = REPO / "hd2d-previews/qa-vfx-final-nine-runtime-64.png"
    gallery(helper, runtimes, output)
    candidate_output = REPO / "hd2d-previews/qa-vfx-final-nine-candidates-64.png"
    gallery(helper, candidates, candidate_output, label="candidate")
    report_path = SOURCE / "final-nine-validation.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Checked {len(IDS)} new distinct per-ID masters, candidate/runtime hashes and backups; {len(all_hashes)} unit VFX hashes are unique.")
    print(f"Wrote {report_path.relative_to(REPO)}, {candidate_output.relative_to(REPO)} and {output.relative_to(REPO)}.")


if __name__ == "__main__":
    main()
