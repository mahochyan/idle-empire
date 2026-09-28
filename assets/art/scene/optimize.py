"""Package the editable AI scene masters as smaller lossless runtime textures.

Run with Pillow installed: python assets/art/scene/optimize.py
The generated masters stay untouched under source/generated/.
"""

from pathlib import Path

from PIL import Image


ART = Path(__file__).resolve().parents[1]
SPECS = (
    ("town-daylight-master.png", "town-daylight.png", (1024, 525)),
    ("battle-daylight-master.png", "battle-daylight.png", (768, 1152)),
    ("battle-night-master.png", "battle-night.png", (768, 1152)),
)


for source_name, output_name, size in SPECS:
    source = ART / "source" / "generated" / source_name
    output = Path(__file__).parent / output_name
    with Image.open(source) as original:
        original.convert("RGB").resize(size, Image.Resampling.LANCZOS).save(
            output, format="PNG", optimize=True, compress_level=9
        )
    print(f"{output.relative_to(ART)} {size[0]}x{size[1]} {output.stat().st_size} bytes")
