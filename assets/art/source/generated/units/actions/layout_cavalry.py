"""Re-layout generated cavalry triptychs into exact transparent 724px cells.

The ImageGen masters stay untouched. This authoring step moves whole poses and
only scales a pose when it cannot keep a 35px transparent cell margin. It does
not paint, clip, or change the rider, horse, weapon or their facing.

Run: python assets/art/source/generated/units/actions/layout_cavalry.py [--check]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


HERE = Path(__file__).resolve().parent
UNITS = ("cavalry_t1", "gold_cavalry")
ACTIONS = ("attack", "death")
CELL = 724
MARGIN = 35


def transparent_seam(image: Image.Image, expected: int) -> tuple[int, int]:
    """Find a wide, truly alpha-zero separator, including faint edge pixels."""
    alpha = image.getchannel("A")
    search = range(max(1, expected - 170), min(image.width - 1, expected + 170) + 1)
    clear = [x for x in search if alpha.crop((x, 0, x + 1, image.height)).getbbox() is None]
    if not clear:
        raise ValueError(f"No transparent source seam near {expected}")
    runs: list[tuple[int, int]] = []
    start = last = clear[0]
    for x in clear[1:]:
        if x != last + 1:
            runs.append((start, last + 1))
            start = x
        last = x
    runs.append((start, last + 1))
    viable = [run for run in runs if run[1] - run[0] >= 24]
    if not viable:
        raise ValueError(f"No 24px source seam near {expected}: {runs}")
    return min(viable, key=lambda run: abs((run[0] + run[1]) / 2 - expected))


def build_layout(path: Path) -> tuple[Image.Image, dict]:
    original = Image.open(path).convert("RGBA")
    if original.width / original.height < 2.9 or original.width / original.height > 3.1:
        raise ValueError(f"Unexpected triptych dimensions: {path}, {original.size}")
    gaps = [transparent_seam(original, round(original.width * n / 3)) for n in (1, 2)]
    cuts = [0, (gaps[0][0] + gaps[0][1]) // 2,
            (gaps[1][0] + gaps[1][1]) // 2, original.width]
    layout = Image.new("RGBA", (3 * CELL, CELL), (0, 0, 0, 0))
    audit = {"original": path.name, "originalSize": list(original.size),
             "sourceAlphaZeroSeams": [list(gap) for gap in gaps],
             "layoutSize": [3 * CELL, CELL], "cellMarginPx": MARGIN,
             "poses": []}
    for index in range(3):
        source = original.crop((cuts[index], 0, cuts[index + 1], original.height))
        alpha = source.getchannel("A")
        significant = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
        if significant is None:
            raise ValueError(f"Empty cavalry pose: {path}, {index}")
        # Generated PNGs contain a few sub-9-alpha stray pixels far from the
        # subject. Include every visible pixel plus a 2px antialias fringe;
        # otherwise one almost-transparent pixel would shrink the entire horse.
        box = (max(0, significant[0] - 2), max(0, significant[1] - 2),
               min(source.width, significant[2] + 2),
               min(source.height, significant[3] + 2))
        excluded = alpha.copy()
        ImageDraw.Draw(excluded).rectangle((box[0], box[1], box[2] - 1, box[3] - 1), fill=0)
        max_excluded_alpha = excluded.getextrema()[1]
        if max_excluded_alpha > 8:
            raise ValueError(f"Visible pixels outside source crop: {path}, {index}")
        subject = source.crop(box)
        max_size = CELL - 2 * MARGIN
        scale = min(1.0, max_size / subject.width, max_size / subject.height)
        size = (round(subject.width * scale), round(subject.height * scale))
        if max(size) > max_size:
            raise ValueError(f"Scaled pose too large: {path}, {index}, {size}")
        if scale < 1.0:
            subject = subject.resize(size, Image.Resampling.NEAREST)
        x = index * CELL + (CELL - subject.width) // 2
        y = CELL - MARGIN - subject.height
        layout.alpha_composite(subject, (x, y))
        cell = layout.crop((index * CELL, 0, (index + 1) * CELL, CELL))
        result = cell.getchannel("A").getbbox()
        if result is None or min(result[0], result[1], CELL-result[2], CELL-result[3]) < MARGIN:
            raise ValueError(f"Unsafe layout margins: {path}, {index}, {result}")
        audit["poses"].append({
            "sourceCellRange": [cuts[index], cuts[index + 1]],
            "sourceSignificantBoundsWithinCell": list(significant),
            "sourceBoundsWithinCell": list(box),
            "maxExcludedAlpha": max_excluded_alpha,
            "layoutBoundsWithinCell": list(result),
            "layoutScale": round(scale, 6),
            "facing": "right",
            "allAlphaOver8Retained": True,
        })
    for boundary in (CELL, 2 * CELL):
        if layout.crop((boundary - MARGIN, 0, boundary + MARGIN, CELL)).getchannel("A").getbbox():
            raise ValueError(f"Shared silhouette at layout boundary {boundary}: {path}")
    return layout, audit


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Compare layout PNG pixels and audit JSON")
    args = parser.parse_args()
    audit: dict[str, object] = {"version": 1, "method": "whole-pose transparent re-layout",
                                "cellWidth": CELL, "cellMarginPx": MARGIN, "files": {}}
    for unit in UNITS:
        for action in ACTIONS:
            filename = f"{unit}-{action}-master"
            layout, details = build_layout(HERE / f"{filename}.png")
            target = HERE / f"{filename}-layout.png"
            if args.check:
                current = Image.open(target).convert("RGBA")
                if current.size != layout.size or current.tobytes() != layout.tobytes():
                    raise ValueError(f"Layout differs: {target}")
            else:
                layout.save(target, optimize=True)
            audit["files"][target.name] = details
            print(f"{target.name}: {layout.width}x{layout.height}, "
                  f"pose scales {[p['layoutScale'] for p in details['poses']]}")
    audit_path = HERE / "cavalry-layout-audit.json"
    if args.check:
        if json.loads(audit_path.read_text(encoding="utf-8")) != audit:
            raise ValueError(f"Layout audit differs: {audit_path}")
    else:
        audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n",
                              encoding="utf-8")
    print("PASS: four cavalry triptychs in exact 724px cells with 35px alpha-zero margins")


if __name__ == "__main__":
    main()
