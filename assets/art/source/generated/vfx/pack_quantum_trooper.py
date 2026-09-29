"""Pack the reviewed quantum lance source into the 256 px runtime cell.

Authoring utility only; the game loads the resulting PNG without Python.
"""

from pathlib import Path

from PIL import Image


HERE = Path(__file__).resolve().parent
SOURCE = HERE / "quantum_trooper-attack-source.png"
OUTPUT = HERE / "quantum_trooper-v2-packed.png"

with Image.open(SOURCE) as opened:
    source = opened.convert("RGBA")
assert source.size == (1254, 1254), source.size
assert source.getpixel((0, 0))[3] == 0, "master needs transparent background"

# Preserve the original composition while reserving breathing room at phone
# scale. This is deterministic texture packaging, not a redraw of the master.
cell = Image.new("RGBA", (256, 256))
scaled = source.resize((220, 220), Image.Resampling.NEAREST)
cell.alpha_composite(scaled, (18, 18))
alpha = cell.getchannel("A")
box = alpha.point(lambda value: 255 if value >= 24 else 0).getbbox()
assert box and box[0] >= 6 and box[1] >= 6 and box[2] <= 250 and box[3] <= 250, box
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
cell.save(OUTPUT, optimize=True)
print(OUTPUT, box, OUTPUT.stat().st_size)
