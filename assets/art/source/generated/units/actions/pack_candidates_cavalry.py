"""Build source-only cavalry review atlases; never writes runtime assets.

Requires Pillow for authoring. Output stays in this source folder and
hd2d-previews. A candidate is not approval for runtime integration.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw


HERE = Path(__file__).resolve().parent
ART = HERE.parents[3]
OUTPUT = HERE / "candidates"
PREVIEW = ART.parents[1] / "hd2d-previews" / "qa-cavalry-candidates-64.png"
SOURCE_PREVIEW = ART.parents[1] / "hd2d-previews" / "qa-cavalry-masters-64.png"
UNITS = ("cavalry_t1", "gold_cavalry")
ACTIONS = ("attack", "hit", "death")
CELL = 512
POSE_SCALE = {"cavalry_t1": 0.74, "gold_cavalry": 0.72}


def bounds(image: Image.Image) -> tuple[int, int, int, int]:
    box = image.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
    if box is None:
        raise ValueError("Empty pose")
    return box


def safe_seam(image: Image.Image, expected: int) -> tuple[int, int]:
    alpha = image.getchannel("A").point(lambda value: 255 if value > 8 else 0)
    lo = 1
    hi = image.width - 1
    clear = [alpha.crop((x, 0, x + 1, image.height)).getbbox() is None
             for x in range(lo, hi + 1)]
    gaps = []
    start = None
    for index, is_clear in enumerate(clear):
        if is_clear and start is None:
            start = lo + index
        if start is not None and (not is_clear or index == len(clear) - 1):
            end = lo + index if not is_clear else lo + index + 1
            if end - start >= 8 and abs((start + end) / 2 - expected) <= 170:
                gaps.append((start, end))
            start = None
    if not gaps:
        raise ValueError(f"No safe transparent gap near x={expected}")
    start, end = min(gaps, key=lambda gap: abs((gap[0] + gap[1]) / 2 - expected))
    return (start + end) // 2, end - start


def pack_pose(pose: Image.Image, *, unit_id: str, baseline: int,
              foot_center: float) -> tuple[Image.Image, dict]:
    source_bounds = bounds(pose)
    sprite = pose.crop(source_bounds)
    scale = min(POSE_SCALE[unit_id], 496 / sprite.width, 500 / sprite.height)
    sprite = sprite.resize((round(sprite.width * scale), round(sprite.height * scale)),
                           Image.Resampling.NEAREST)
    resized_bounds = bounds(sprite)
    upright = sprite.height > sprite.width * 0.68
    if upright:
        strip_height = max(8, sprite.height // 16)
        foot_alpha = sprite.getchannel("A").crop((0, sprite.height - strip_height,
                                                  sprite.width, sprite.height))
        foot_box = foot_alpha.point(lambda value: 255 if value > 48 else 0).getbbox()
        anchor = (foot_box[0] + foot_box[2]) / 2 if foot_box else sprite.width / 2
    else:
        anchor = sprite.width / 2
    x = max(8, min(CELL - 8 - sprite.width, round(foot_center - anchor)))
    y = baseline - resized_bounds[3]
    if x < 0 or y < 0 or x + sprite.width > CELL or y + sprite.height > CELL:
        raise ValueError(f"Pose clips frame: {unit_id}, {source_bounds}, {scale}")
    frame = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    frame.alpha_composite(sprite, (x, y))
    frame_bounds = bounds(frame)
    if frame_bounds[0] < 8 or frame_bounds[2] > CELL - 8 or frame_bounds[1] < 0:
        raise ValueError(f"Pose touches horizontal edge: {frame_bounds}")
    if frame_bounds[3] != baseline:
        raise ValueError(f"Pose baseline drift: {frame_bounds[3]} != {baseline}")
    return frame, {"bounds": list(frame_bounds), "sourceBounds": list(source_bounds),
                   "scale": round(scale, 5), "baselineY": baseline}


def make_previews() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    atlas_preview = Image.new("RGBA", (120 + 4 * 64, 24 + 6 * 80), (30, 40, 49, 255))
    source_preview = Image.new("RGBA", (120 + 3 * 64, 24 + 6 * 80), (30, 40, 49, 255))
    audit = {"runtimeEnabled": False, "candidateOnly": True, "units": {}}
    for canvas, title in ((atlas_preview, "CAVALRY CANDIDATES | idle+3 at 64px"),
                          (source_preview, "CAVALRY MASTERS | 3 poses at 64px")):
        ImageDraw.Draw(canvas).text((7, 4), title, fill=(235, 228, 206, 255))
    for unit_index, unit_id in enumerate(UNITS):
        audit["units"][unit_id] = {}
        idle = Image.open(ART / "units" / "hires" / f"{unit_id}.png").convert("RGBA")
        if idle.size != (CELL, CELL):
            raise ValueError(f"Idle is not 512x512: {unit_id}")
        idle_bounds = bounds(idle)
        foot_alpha = idle.getchannel("A").point(lambda value: 255 if value > 48 else 0)
        foot_strip = foot_alpha.crop((0, idle_bounds[3] - max(8, (idle_bounds[3]-idle_bounds[1]) // 16),
                                     CELL, idle_bounds[3]))
        foot_box = foot_strip.getbbox()
        foot_center = ((foot_box[0] + foot_box[2]) / 2 if foot_box
                       else (idle_bounds[0] + idle_bounds[2]) / 2)
        for action_index, action in enumerate(ACTIONS):
            path = HERE / f"{unit_id}-{action}-master.png"
            master = Image.open(path).convert("RGBA")
            if not (700 <= master.height <= 740 and 2.95 <= master.width / master.height <= 3.05):
                raise ValueError(f"Unexpected triptych aspect: {path}, {master.size}")
            seams_with_width = [safe_seam(master, round(master.width * n / 3))
                                for n in (1, 2)]
            seams = [pair[0] for pair in seams_with_width]
            cuts = [0, *seams, master.width]
            frames = [idle.copy()]
            nominal_cross = []
            nominal_left_cross = []
            frame_audit = [{"bounds": list(idle_bounds), "baselineY": idle_bounds[3],
                            "pixelIdenticalToIdle": True}]
            row = unit_index * len(ACTIONS) + action_index
            y = 24 + row * 80
            for canvas in (atlas_preview, source_preview):
                draw = ImageDraw.Draw(canvas)
                draw.text((7, y + 7), unit_id, fill=(220, 230, 215, 255))
                draw.text((7, y + 26), action, fill=(180, 205, 215, 255))
            atlas_preview.alpha_composite(idle.resize((64, 64), Image.Resampling.NEAREST),
                                          (120, y + 4))
            for frame_index in range(3):
                pose = master.crop((cuts[frame_index], 0, cuts[frame_index + 1], master.height))
                frame, meta = pack_pose(pose, unit_id=unit_id,
                                        baseline=idle_bounds[3], foot_center=foot_center)
                frames.append(frame)
                frame_audit.append(meta)
                source_left = cuts[frame_index] + meta["sourceBounds"][0]
                source_right = cuts[frame_index] + meta["sourceBounds"][2]
                nominal_left_cross.append(max(0, round(master.width * frame_index / 3) - source_left)
                                          if frame_index > 0 else 0)
                nominal_cross.append(max(0, source_right - round(master.width * (frame_index + 1) / 3))
                                     if frame_index < 2 else 0)
                atlas_preview.alpha_composite(frame.resize((64, 64), Image.Resampling.NEAREST),
                                              (120 + (frame_index + 1) * 64, y + 4))
                raw_box = bounds(pose)
                raw = pose.crop(raw_box)
                raw_scale = min(60 / raw.width, 60 / raw.height)
                raw = raw.resize((round(raw.width * raw_scale), round(raw.height * raw_scale)),
                                 Image.Resampling.NEAREST)
                source_preview.alpha_composite(raw,
                    (120 + frame_index * 64 + (64 - raw.width) // 2, y + 4 + (64 - raw.height) // 2))
            atlas = Image.new("RGBA", (CELL * 4, CELL), (0, 0, 0, 0))
            for index, frame in enumerate(frames):
                atlas.paste(frame, (index * CELL, 0))
            if atlas.crop((0, 0, CELL, CELL)).tobytes() != idle.tobytes():
                raise ValueError(f"Idle changed: {unit_id}-{action}")
            filename = f"{unit_id}-{action}-candidate.png"
            atlas.save(OUTPUT / filename, optimize=True)
            audit["units"][unit_id][action] = {"path": filename, "source": path.name,
                "sourceSize": list(master.size), "seamsX": seams,
                "seamGapWidths": [item[1] for item in seams_with_width],
                "nominalEqualCellBoundaryCrossPx": nominal_cross,
                "nominalEqualCellLeftCrossPx": nominal_left_cross,
                "strictEqualCellsPass": not any(nominal_cross + nominal_left_cross),
                "frameAudit": frame_audit}
            print(filename, "seams", seams, "gaps", audit["units"][unit_id][action]["seamGapWidths"],
                  "scales", [item.get("scale", 1) for item in frame_audit])
    atlas_preview.save(PREVIEW, optimize=True)
    source_preview.save(SOURCE_PREVIEW, optimize=True)
    (OUTPUT / "cavalry-candidate-audit.json").write_text(
        json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("PASS: source-only cavalry candidates and previews")


if __name__ == "__main__":
    make_previews()
