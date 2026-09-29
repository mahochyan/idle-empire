"""Review-only alpha, seam and 64px contact sheet for mage_t1 masters.

This does not write the runtime action atlas or change the shared manifest.
Run: python assets/art/source/generated/units/actions/mage_t1/audit.py
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from pack import ART, CELL, find_seam, paste_grounded, visible_bbox  # noqa: E402

ACTIONS = ("attack", "hit", "death")
PREVIEW = ART.parents[1] / "hd2d-previews" / "qa-mage-t1-actions-64.png"
IDLE = ART / "units" / "hires" / "mage_t1.png"


def gap_at(image, x):
    alpha = image.getchannel("A").point(lambda value: 255 if value > 8 else 0)
    left = x
    while left > 0 and alpha.crop((left - 1, 0, left, image.height)).getbbox() is None:
        left -= 1
    right = x
    while right < image.width and alpha.crop((right, 0, right + 1, image.height)).getbbox() is None:
        right += 1
    return {"start": left, "end": right, "width": right - left}


def main():
    idle = Image.open(IDLE).convert("RGBA")
    if idle.size != (CELL, CELL):
        raise ValueError("Idle portrait must be 512px square")
    idle_box = visible_bbox(idle)
    baseline = idle_box[3]
    foot_center = (idle_box[0] + idle_box[2]) / 2
    report = {"unit": "mage_t1", "candidateOnly": True, "runtimeIntegrated": False,
              "idleBounds": list(idle_box), "actions": {}}
    sheet = Image.new("RGBA", (460, 514), (0, 0, 0, 0))
    draw = ImageDraw.Draw(sheet)
    draw.rectangle((0, 0, 459, 256), fill=(246, 237, 218, 255))
    draw.rectangle((0, 257, 459, 513), fill=(27, 39, 49, 255))
    draw.text((9, 5), "mage_t1 | idle + 3 poses | 64px", fill=(44, 55, 66, 255))
    draw.text((9, 263), "mage_t1 | dark contrast review", fill=(225, 226, 209, 255))
    for row, action in enumerate(ACTIONS):
        source = Image.open(HERE / f"{action}-master.png").convert("RGBA")
        corners = [source.getpixel(point)[3] for point in
                   [(0, 0), (source.width - 1, 0),
                    (0, source.height - 1), (source.width - 1, source.height - 1)]]
        if any(corners):
            raise ValueError(f"{action}: source corners are not transparent: {corners}")
        visible = visible_bbox(source)
        if min(visible[0], visible[1], source.width-visible[2], source.height-visible[3]) < 8:
            raise ValueError(f"{action}: visible pixels too close to source edge: {visible}")
        seams = [find_seam(source, round(source.width * fraction / 3))
                 for fraction in (1, 2)]
        gaps = [gap_at(source, seam) for seam in seams]
        if seams[0] >= seams[1] or any(gap["width"] < 8 for gap in gaps):
            raise ValueError(f"{action}: unsafe transparent seam: {gaps}")
        cells = [idle.copy()]
        frames = [{"bounds": list(idle_box), "scale": 1.0, "idleIdentical": True}]
        cuts = [0, *seams, source.width]
        for index in range(3):
            cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
            pose = source.crop((cuts[index], 0, cuts[index + 1], source.height))
            frames.append(paste_grounded(cell, pose, pose_scale=0.68,
                                         baseline_y=baseline, foot_center_x=foot_center))
            cells.append(cell)
        if any(frame["scale"] < 0.67 for frame in frames[1:]):
            raise ValueError(f"{action}: pose shrank compared with idle and other poses")
        report["actions"][action] = {"source": f"{action}-master.png",
                                      "sourceSize": list(source.size),
                                      "visibleBounds": list(visible),
                                      "seams": seams, "transparentGaps": gaps,
                                      "frames": frames}
        for theme in range(2):
            y = (25 if theme == 0 else 282) + row * 75
            draw.text((9, y + 20), action, fill=(60, 66, 75, 255) if theme == 0
                      else (220, 226, 232, 255))
            for index, cell in enumerate(cells):
                small = cell.resize((64, 64), Image.Resampling.NEAREST)
                sheet.alpha_composite(small, (127 + index * 80, y + 1))
        print(f"{action}: source={source.size}, seams={seams}, gaps={[g['width'] for g in gaps]}, "
              f"scales={[frame['scale'] for frame in frames]}")
    HERE.joinpath("audit.json").write_text(json.dumps(report, indent=2) + "\n",
                                         encoding="utf-8")
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW, optimize=True)
    print(f"PASS: 3 transparent three-pose masters, 64px light/dark preview: {PREVIEW}")


if __name__ == "__main__":
    main()
