"""Pack the reviewed HD portrait animations into four 512 px frames.

Requires Pillow for this authoring step only. Player assets are plain PNG/JSON.
Run: python assets/art/source/generated/units/actions/pack.py [--check]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


HERE = Path(__file__).resolve().parent
ART = HERE.parents[3]
OUTPUT = ART / "units" / "hires" / "actions"
COMPACT_OUTPUT = OUTPUT / "compact"
PREVIEW = ART.parents[1] / "hd2d-previews" / "qa-hires-actions-eight-units.png"
CAVALRY_PREVIEW = ART.parents[1] / "hd2d-previews" / "qa-cavalry-production-64.png"
COMPACT_PREVIEW = ART.parents[1] / "hd2d-previews" / "qa-cavalry-compact-64.png"
CAVALRY_IDS = ("cavalry_t1", "gold_cavalry")
IDS = ("infantry", "infantry_t1", "star_trooper", "archer", "archer_t1", "archer_crossbow") + CAVALRY_IDS
RUNTIME_IDS = IDS
ACTIONS = ("attack", "hit", "death")
SUGGESTED_TIMING_MS = {
    "attack": [60, 90, 105, 100],
    "hit": [45, 110, 130, 95],
    "death": [50, 135, 170, 280],
}
CELL = 512
COMPACT_CELL = 256
# The 512 px idle portraits occupy different amounts of their canvases.
# Match each generated pose's visible character stature to its own idle art,
# rather than enlarging the idle portrait when an action begins.
POSE_SCALE = {"infantry": 0.68, "infantry_t1": 0.68, "star_trooper": 0.705,
              "archer": 0.70, "archer_t1": 0.70, "archer_crossbow": 0.70,
              "cavalry_t1": 0.78, "gold_cavalry": 0.78}
LAYOUT_ACTIONS = {"attack", "death"}


def visible_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    # Discard nearly invisible antialias fringe for stable authored bounds.
    alpha = image.getchannel("A").point(lambda value: 255 if value > 8 else 0)
    box = alpha.getbbox()
    if box is None:
        raise ValueError("Empty sprite frame")
    return box


def find_seam(image: Image.Image, expected: int) -> int:
    alpha = image.getchannel("A").point(lambda value: 255 if value > 8 else 0)
    lo, hi = max(1, expected - 170), min(image.width - 1, expected + 170)
    gaps = [x for x in range(lo, hi + 1)
            if alpha.crop((x, 0, x + 1, image.height)).getbbox() is None]
    if not gaps:
        raise ValueError(f"No transparent seam near {expected}; source poses overlap")
    seam = min(gaps, key=lambda x: abs(x - expected))
    # A one-column slit can occur inside a bow or spear. Require enough
    # continuous clear space for a safe pose boundary.
    start = seam
    end = seam + 1
    while start > 0 and alpha.crop((start - 1, 0, start, image.height)).getbbox() is None:
        start -= 1
    while end < image.width and alpha.crop((end, 0, end + 1, image.height)).getbbox() is None:
        end += 1
    if end - start < 8:
        raise ValueError(f"Only {end - start}px of clear source seam near {expected}")
    return seam


def paste_grounded(dst: Image.Image, source: Image.Image, *,
                   pose_scale: float, baseline_y: int, foot_center_x: float,
                   max_pose_height: int = 480) -> dict:
    box = visible_bbox(source)
    sprite = source.crop(box)
    # Keep weapons and capes fully inside the cell. The unit-specific scale
    # matches the standing helmet-to-boots height of the original idle art.
    scale = min(pose_scale, 496 / sprite.width, max_pose_height / sprite.height)
    sprite = sprite.resize((round(sprite.width * scale), round(sprite.height * scale)),
                           Image.Resampling.NEAREST)
    # Ground contact is the center of opaque pixels in the bottom 6% of each
    # upright frame. Wide prone poses use the visible box midpoint instead.
    upright = sprite.height > sprite.width * 0.68
    if upright:
        alpha = sprite.getchannel("A")
        strip = alpha.crop((0, max(0, sprite.height - max(8, sprite.height // 16)),
                            sprite.width, sprite.height))
        foot = strip.point(lambda value: 255 if value > 48 else 0).getbbox()
        anchor = (foot[0] + foot[2]) / 2 if foot else sprite.width / 2
    else:
        anchor = sprite.width / 2
    x = round(foot_center_x - anchor)
    x = max(8, min(CELL - 8 - sprite.width, x))
    # Nearest-neighbor downsampling can drop an opaque bottom row. Align the
    # resized visible outline, preserving the original idle ground baseline.
    y = baseline_y - visible_bbox(sprite)[3]
    if x < 0 or y < 0 or x + sprite.width > CELL or y + sprite.height > CELL:
        raise ValueError(f"Sprite clips frame: {source.size}, {sprite.size}, {(x, y)}")
    dst.alpha_composite(sprite, (x, y))
    final = visible_bbox(dst)
    # Cavalry idle art itself stands at y=506/507 (5-6px from the bottom).
    # Keep that exact ground line instead of moving only action frames upward.
    bottom_margin = 4 if max_pose_height > 480 else 7
    if final[0] < 7 or final[2] > CELL - 7 or final[1] < 4 or final[3] > CELL - bottom_margin:
        raise ValueError(f"Sprite has inadequate transparent margin: {final}")
    if final[3] != baseline_y:
        raise ValueError(f"Sprite ground baseline drifted: {final[3]} != {baseline_y}")
    return {"bounds": list(final), "sourceBounds": list(box),
            "scale": round(scale, 5), "baselineY": baseline_y}


def build_one(unit_id: str, action: str) -> tuple[Image.Image, dict]:
    idle = Image.open(ART / "units" / "hires" / f"{unit_id}.png").convert("RGBA")
    is_layout = unit_id in CAVALRY_IDS and action in LAYOUT_ACTIONS
    master_path = HERE / f"{unit_id}-{action}-master{'-layout' if is_layout else ''}.png"
    master = Image.open(master_path).convert("RGBA")
    if unit_id in CAVALRY_IDS:
        if master.size != (2172, 724):
            raise ValueError(f"Cavalry master must use exact 724px cells: {master_path}")
        # A transparent slit anywhere nearby does not prove that each pose is
        # inside its nominal cell. Catch the former attack/death overflow.
        for boundary in (724, 1448):
            gutter = master.crop((boundary - 35, 0, boundary + 35, 724))
            if gutter.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox():
                raise ValueError(f"Cavalry source crosses 35px cell gutter: {master_path}, {boundary}")
    seams = [find_seam(master, round(master.width * fraction / 3)) for fraction in (1, 2)]
    if seams[0] >= seams[1]:
        raise ValueError(f"Non-monotonic seams: {master_path}, {seams}")
    if idle.size != (CELL, CELL):
        raise ValueError(f"Idle portrait is not {CELL} px: {unit_id}")
    idle_box = visible_bbox(idle)
    # Keep frame 0 byte-for-byte identical to the art the battle displays
    # outside an action. Even faint alpha fringe and original coordinates stay.
    cells = [idle.copy()] + [Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
                           for _ in range(3)]
    alpha = idle.getchannel("A").point(lambda value: 255 if value > 48 else 0)
    foot_strip = alpha.crop((0, idle_box[3] - max(8, (idle_box[3]-idle_box[1]) // 16),
                             CELL, idle_box[3]))
    foot_box = foot_strip.getbbox()
    foot_center_x = (foot_box[0] + foot_box[2]) / 2 if foot_box else (idle_box[0]+idle_box[2])/2
    frame_meta = [{"bounds": list(idle_box), "sourceBounds": list(idle_box),
                   "scale": 1.0, "baselineY": idle_box[3],
                   "pixelIdenticalToIdle": True}]
    cuts = [0, *seams, master.width]
    for frame in range(3):
        pose = master.crop((cuts[frame], 0, cuts[frame + 1], master.height))
        frame_meta.append(paste_grounded(cells[frame + 1], pose,
                                         pose_scale=POSE_SCALE[unit_id],
                                         baseline_y=idle_box[3],
                                         foot_center_x=foot_center_x,
                                         max_pose_height=500 if unit_id in CAVALRY_IDS else 480))
    atlas = Image.new("RGBA", (CELL * 4, CELL), (0, 0, 0, 0))
    for index, cell in enumerate(cells):
        atlas.paste(cell, (index * CELL, 0))
    if atlas.crop((0, 0, CELL, CELL)).tobytes() != idle.tobytes():
        raise ValueError(f"Frame 0 differs from original idle portrait: {unit_id}")
    return atlas, {
        "frameWidth": CELL,
        "frameHeight": CELL,
        "frames": 4,
        "order": ["idle", "windup_or_jolt", "contact_or_fall", "recover_or_prone"],
        # Editorial timing for future tuning only. hd2d.js currently splits
        # each battle event's action.duration into four equal frame intervals.
        "suggestedFrameDurationMs": SUGGESTED_TIMING_MS[action],
        "loop": False,
        "facing": "right",
        "source": str(master_path.relative_to(ART)).replace("\\", "/"),
        "sourceSize": list(master.size),
        "sourceSeamsX": seams,
        "frameAudit": frame_meta,
    }


def compact_atlas(atlas: Image.Image) -> Image.Image:
    """Keep four independent transparent frames with crisp pixel sampling."""
    if atlas.size != (CELL * 4, CELL):
        raise ValueError(f"Unexpected action atlas size for compact copy: {atlas.size}")
    compact = Image.new("RGBA", (COMPACT_CELL * 4, COMPACT_CELL), (0, 0, 0, 0))
    for frame in range(4):
        source = atlas.crop((frame * CELL, 0, (frame + 1) * CELL, CELL))
        reduced = source.resize((COMPACT_CELL, COMPACT_CELL), Image.Resampling.NEAREST)
        compact.paste(reduced, (frame * COMPACT_CELL, 0))
    return compact


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Compare packed PNG pixels with source")
    args = parser.parse_args()
    manifest = {
        "version": 5,
        "runtimeSampleEnabled": True,
        "runtimeUnits": list(RUNTIME_IDS),
        "manifestReadAtRuntime": False,
        "runtimeFrameTiming": "four equal intervals of battle event action.duration",
        "units": {},
    }
    preview = Image.new("RGBA", (4 * 160, len(IDS) * len(ACTIONS) * 176),
                        (33, 43, 52, 255))
    cavalry_preview = Image.new("RGBA", (116 + 4 * 72, 24 + 6 * 84),
                                (30, 40, 49, 255))
    ImageDraw.Draw(cavalry_preview).text((8, 5), "CAVALRY | production atlas at 64px", fill=(238, 230, 210, 255))
    compact_preview = Image.new("RGBA", (116 + 4 * 72, 24 + 12 * 74),
                                (30, 40, 49, 255))
    ImageDraw.Draw(compact_preview).text((8, 5), "CAVALRY | full / compact at 64px", fill=(238, 230, 210, 255))
    for row, unit_id in enumerate(IDS):
        manifest["units"][unit_id] = {}
        for column, action in enumerate(ACTIONS):
            atlas, meta = build_one(unit_id, action)
            filename = f"{unit_id}-{action}.png"
            target = OUTPUT / filename
            compact = compact_atlas(atlas)
            compact_target = COMPACT_OUTPUT / filename
            if args.check:
                current = Image.open(target).convert("RGBA")
                if current.size != atlas.size or current.tobytes() != atlas.tobytes():
                    raise ValueError(f"Packed output differs: {target}")
                current_compact = Image.open(compact_target).convert("RGBA")
                if current_compact.size != compact.size or current_compact.tobytes() != compact.tobytes():
                    raise ValueError(f"Compact output differs: {compact_target}")
            else:
                OUTPUT.mkdir(parents=True, exist_ok=True)
                COMPACT_OUTPUT.mkdir(parents=True, exist_ok=True)
                atlas.save(target, optimize=True)
                compact.save(compact_target, optimize=True)
            for i in range(4):
                frame = atlas.crop((i * CELL, 0, (i + 1) * CELL, CELL))
                compact_frame = compact.crop((i * COMPACT_CELL, 0,
                                              (i + 1) * COMPACT_CELL, COMPACT_CELL))
                thumbnail = frame.resize((152, 152), Image.Resampling.NEAREST)
                preview.alpha_composite(thumbnail, (i * 160 + 4, (row * 3 + column) * 176 + 8))
                if unit_id in CAVALRY_IDS:
                    cavalry_row = (row - (len(IDS) - len(CAVALRY_IDS))) * 3 + column
                    y = 24 + cavalry_row * 84
                    if i == 0:
                        labels = ImageDraw.Draw(cavalry_preview)
                        labels.text((7, y + 6), unit_id, fill=(221, 230, 217, 255))
                        labels.text((7, y + 25), action, fill=(185, 207, 217, 255))
                    cavalry_preview.alpha_composite(
                        frame.resize((64, 64), Image.Resampling.NEAREST),
                        (116 + i * 72 + 4, y + 3))
                    for preview_row, preview_frame in enumerate((frame, compact_frame)):
                        compact_y = 24 + (cavalry_row * 2 + preview_row) * 74
                        if i == 0:
                            ImageDraw.Draw(compact_preview).text(
                                (7, compact_y + 6), unit_id, fill=(221, 230, 217, 255))
                            ImageDraw.Draw(compact_preview).text(
                                (7, compact_y + 25), f"{action} {'full' if preview_row == 0 else '256'}",
                                fill=(185, 207, 217, 255))
                        compact_preview.alpha_composite(
                            preview_frame.resize((64, 64), Image.Resampling.NEAREST),
                            (116 + i * 72 + 4, compact_y + 3))
            manifest["units"][unit_id][action] = {
                "path": f"./assets/art/units/hires/actions/{filename}",
                "compactPath": f"./assets/art/units/hires/actions/compact/{filename}",
                "compactFrameWidth": COMPACT_CELL,
                "compactFrameHeight": COMPACT_CELL,
                "compactResampling": "nearest",
                **meta,
            }
            print(f"{filename}: {atlas.width}x{atlas.height}, alpha seams {meta['sourceSeamsX']}, "
                  f"frame bounds {[frame['bounds'] for frame in meta['frameAudit']]}")
    manifest_path = OUTPUT / "manifest.json"
    if args.check:
        current = json.loads(manifest_path.read_text(encoding="utf-8"))
        if current != manifest:
            raise ValueError(f"Manifest differs: {manifest_path}")
        if Image.open(PREVIEW).convert("RGBA").tobytes() != preview.tobytes():
            raise ValueError(f"Preview differs: {PREVIEW}")
        if Image.open(CAVALRY_PREVIEW).convert("RGBA").tobytes() != cavalry_preview.tobytes():
            raise ValueError(f"Cavalry preview differs: {CAVALRY_PREVIEW}")
        if Image.open(COMPACT_PREVIEW).convert("RGBA").tobytes() != compact_preview.tobytes():
            raise ValueError(f"Compact preview differs: {COMPACT_PREVIEW}")
    else:
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                                 encoding="utf-8")
        PREVIEW.parent.mkdir(parents=True, exist_ok=True)
        preview.save(PREVIEW, optimize=True)
        cavalry_preview.save(CAVALRY_PREVIEW, optimize=True)
        compact_preview.save(COMPACT_PREVIEW, optimize=True)
    print(f"PASS: {len(IDS) * len(ACTIONS)} full and compact four-frame atlases; transparent margins, "
          "alpha seams, manifest and preview checked")


if __name__ == "__main__":
    main()
