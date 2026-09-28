"""Build review-only 4-frame action candidates for archer and crossbowman.

These are deliberately written under source/generated, never the runtime
assets/art/units/hires/actions folder. Requires Pillow in the authoring env.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

from pack import ART, CELL, HERE, find_seam, visible_bbox


UNITS = ("archer", "archer_crossbow")
ACTIONS = ("attack", "hit", "death")
SCALE = {"archer": 0.70, "archer_crossbow": 0.70}
OUTPUT = HERE / "candidates"
PREVIEW = ART.parents[1] / "hd2d-previews" / "qa-action-candidates-archer-crossbow-64.png"


def paste_candidate(dst: Image.Image, source: Image.Image, *, unit_id: str,
                    baseline_y: int, foot_center_x: float) -> dict:
    source_box = visible_bbox(source)
    sprite = source.crop(source_box)
    scale = min(SCALE[unit_id], 496 / sprite.width, 480 / sprite.height)
    sprite = sprite.resize((round(sprite.width * scale), round(sprite.height * scale)),
                           Image.Resampling.NEAREST)
    sprite_box = visible_bbox(sprite)
    upright = sprite.height > sprite.width * 0.68
    if upright:
        alpha = sprite.getchannel("A")
        strip = alpha.crop((0, max(0, sprite.height - max(8, sprite.height // 16)),
                            sprite.width, sprite.height))
        foot = strip.point(lambda value: 255 if value > 48 else 0).getbbox()
        anchor = (foot[0] + foot[2]) / 2 if foot else sprite.width / 2
    else:
        anchor = sprite.width / 2
    x = max(8, min(CELL - 8 - sprite.width, round(foot_center_x - anchor)))
    # Nearest-neighbor downsampling can discard one opaque source row, so
    # align against the resized visible bound rather than its canvas height.
    y = baseline_y - sprite_box[3]
    if x < 0 or y < 0 or x + sprite.width > CELL or y + sprite.height > CELL:
        raise ValueError(f"Candidate clips frame: {unit_id}, {source.size}")
    dst.alpha_composite(sprite, (x, y))
    final = visible_bbox(dst)
    if final[0] < 7 or final[1] < 4 or final[2] > CELL-7 or final[3] != baseline_y:
        raise ValueError(f"Candidate border or baseline invalid: {unit_id}, {final}")
    return {"bounds": list(final), "sourceBounds": list(source_box),
            "scale": round(scale, 5), "baselineY": baseline_y}


def find_safe_seam(source: Image.Image, expected: int) -> int:
    """Reject a one-column slit that would split a weapon or neighboring pose."""
    seam = find_seam(source, expected)
    alpha = source.getchannel("A").point(lambda value: 255 if value > 8 else 0)
    start = seam
    end = seam + 1
    while start > 0 and alpha.crop((start - 1, 0, start, source.height)).getbbox() is None:
        start -= 1
    while end < source.width and alpha.crop((end, 0, end + 1, source.height)).getbbox() is None:
        end += 1
    if end - start < 8:
        raise ValueError(f"Only {end - start}px of clear source seam near {expected}")
    return seam


def build(unit_id: str, action: str) -> tuple[Image.Image, dict]:
    idle = Image.open(ART / "units" / "hires" / f"{unit_id}.png").convert("RGBA")
    if idle.size != (CELL, CELL):
        raise ValueError(f"Idle portrait is not {CELL} px: {unit_id}")
    source_path = HERE / f"{unit_id}-{action}-master.png"
    source = Image.open(source_path).convert("RGBA")
    seams = [find_safe_seam(source, round(source.width * fraction / 3))
             for fraction in (1, 2)]
    idle_box = visible_bbox(idle)
    alpha = idle.getchannel("A").point(lambda value: 255 if value > 48 else 0)
    foot_strip = alpha.crop((0, idle_box[3] - max(8, (idle_box[3]-idle_box[1]) // 16),
                             CELL, idle_box[3]))
    foot_box = foot_strip.getbbox()
    foot_center_x = (foot_box[0] + foot_box[2]) / 2 if foot_box else (idle_box[0]+idle_box[2])/2
    cells = [idle.copy()] + [Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0)) for _ in range(3)]
    frame_audit = [{"bounds": list(idle_box), "baselineY": idle_box[3],
                    "pixelIdenticalToIdle": True}]
    cuts = [0, *seams, source.width]
    for frame in range(3):
        pose = source.crop((cuts[frame], 0, cuts[frame + 1], source.height))
        frame_audit.append(paste_candidate(cells[frame + 1], pose,
                                           unit_id=unit_id,
                                           baseline_y=idle_box[3],
                                           foot_center_x=foot_center_x))
    atlas = Image.new("RGBA", (CELL * 4, CELL), (0, 0, 0, 0))
    for index, cell in enumerate(cells):
        atlas.paste(cell, (index * CELL, 0))
    if atlas.crop((0, 0, CELL, CELL)).tobytes() != idle.tobytes():
        raise ValueError(f"Candidate idle mismatch: {unit_id}-{action}")
    return atlas, {"source": source_path.name, "sourceSize": list(source.size),
                   "seamsX": seams, "frameAudit": frame_audit}


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    contact = Image.new("RGBA", (4 * 64 + 120, len(UNITS) * len(ACTIONS) * 80 + 24),
                        (30, 40, 49, 255))
    draw = ImageDraw.Draw(contact)
    draw.text((8, 4), "CANDIDATE ONLY | idle + 3 at 64px", fill=(235, 228, 206, 255))
    audit = {"runtimeEnabled": False, "candidateOnly": True, "units": {}}
    for ui, unit_id in enumerate(UNITS):
        audit["units"][unit_id] = {}
        for ai, action in enumerate(ACTIONS):
            atlas, meta = build(unit_id, action)
            filename = f"{unit_id}-{action}-candidate.png"
            atlas.save(OUTPUT / filename, optimize=True)
            audit["units"][unit_id][action] = {"path": filename, **meta}
            row = ui * len(ACTIONS) + ai
            y = 24 + row * 80
            draw.text((7, y + 7), unit_id, fill=(220, 230, 215, 255))
            draw.text((7, y + 26), action, fill=(180, 205, 215, 255))
            for fi in range(4):
                tile = atlas.crop((fi * CELL, 0, (fi + 1) * CELL, CELL))
                tile = tile.resize((64, 64), Image.Resampling.NEAREST)
                contact.alpha_composite(tile, (120 + fi * 64, y + 4))
            print(f"{filename}: {atlas.size}, seams {meta['seamsX']}, "
                  f"alpha bounds {[frame['bounds'] for frame in meta['frameAudit']]}")
    (OUTPUT / "candidate-audit.json").write_text(
        json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    contact.save(PREVIEW, optimize=True)
    print(f"PASS: review-only candidates and 64px preview: {PREVIEW}")


if __name__ == "__main__":
    main()
