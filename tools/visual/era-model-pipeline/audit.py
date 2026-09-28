"""Read-only asset checks and a phone-size nine-era visual review sheet.

The generated JSON/HTML are development evidence, never game resources.
Missing future-era models are reported as gaps, not treated as test failures.
"""

from __future__ import annotations

import hashlib
import html
import json
import os
import struct
from pathlib import Path

from PIL import Image, ImageChops

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
MANIFEST = json.loads((HERE / "manifest.json").read_text(encoding="utf-8"))
EXPECTED_SITES = set(MANIFEST["hotspots"])


def locate(relative: str | None) -> Path | None:
    return ROOT / relative if relative else None


def image_info(relative: str | None) -> dict | None:
    if not relative:
        return None
    path = locate(relative)
    if not path.is_file():
        return {"path": relative, "exists": False}
    with Image.open(path) as im:
        dimensions = list(im.size)
        mode = im.mode
    return {"path": relative, "exists": True, "size": dimensions,
            "mode": mode, "bytes": path.stat().st_size}


def model_info(relative: str | None) -> dict | None:
    if not relative:
        return None
    path = locate(relative)
    if not path.is_file():
        return {"path": relative, "exists": False}
    data = path.read_bytes()
    assert data[:4] == b"glTF", relative
    version, total = struct.unpack_from("<II", data, 4)
    assert version == 2 and total == len(data), relative
    json_length, json_type = struct.unpack_from("<II", data, 12)
    assert json_type == 0x4E4F534A, relative
    gltf = json.loads(data[20:20 + json_length])
    triangles = sum(
        gltf["accessors"][prim["indices"]]["count"] // 3
        for mesh in gltf.get("meshes", [])
        for prim in mesh.get("primitives", [])
        if prim.get("mode", 4) == 4 and "indices" in prim
    )
    nodes = {node.get("name", "") for node in gltf.get("nodes", [])}
    pick_nodes = sorted(nodes.intersection(MANIFEST["pickNodeNames"]))
    external = [item["uri"] for kind in ("buffers", "images")
                for item in gltf.get(kind, []) if "uri" in item]
    return {
        "path": relative, "exists": True, "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(), "triangles": triangles,
        "meshes": len(gltf.get("meshes", [])),
        "materials": len(gltf.get("materials", [])),
        "images": len(gltf.get("images", [])), "externalUris": external,
        "pickNodes": pick_nodes, "missingPickNodes": sorted(set(MANIFEST["pickNodeNames"]) - nodes),
    }


def clean_boundary(era: dict) -> dict | None:
    keys = ("plate", "cleanMask", "cleanRoi")
    if any(not era.get(key) or not locate(era[key]).is_file() for key in keys):
        return None
    with (Image.open(locate(era["plate"])) .convert("RGB") as original,
          Image.open(locate(era["cleanMask"])) .convert("L") as mask,
          Image.open(locate(era["cleanRoi"])) .convert("RGB") as roi):
        assert original.size == mask.size == roi.size == tuple(MANIFEST["plateSize"]), era["id"]
        outside = mask.point(lambda value: 255 if value == 0 else 0)
        diff = ImageChops.difference(original, roi)
        diff_outside = Image.composite(diff, Image.new("RGB", diff.size), outside)
        exact = diff_outside.getbbox() is None
        return {"originalPixelsExactOutsideMask": exact,
                "maskBoundingBox": list(mask.getbbox()) if mask.getbbox() else None,
                "maskNonzeroPixelFraction": round(sum(1 for v in mask.getdata() if v > 0) /
                                                  (mask.width * mask.height), 4)}


def relative_to_review(relative: str | None) -> str | None:
    return Path(os.path.relpath(locate(relative), HERE)).as_posix() if relative else None


def image_panel(relative: str | None, title: str) -> str:
    if relative and locate(relative).is_file():
        url = html.escape(relative_to_review(relative), quote=True)
        return f'<figure><figcaption>{html.escape(title)}</figcaption><img src="{url}" alt="{html.escape(title)}" loading="lazy"></figure>'
    return f'<figure><figcaption>{html.escape(title)}</figcaption><div class="missing">尚未制作</div></figure>'


def review_html(items: list[dict]) -> str:
    cards = []
    for item in items:
        era = item["source"]
        model = item["model"]
        status = "三维候选，画质待人工验收" if model and model["exists"] else "缺三维模型"
        parts = [
            f'<section class="era"><h2>{html.escape(era["label"])} <code>{html.escape(era["id"])}</code></h2>',
            f'<p class="status">{html.escape(status)}</p>',
            '<div class="panels">',
            image_panel(era["plate"], "现有运行原画 · 360 × 200"),
            image_panel(era.get("cleanRoi") or era.get("clean"),
                        "中央清场候选 · 360 × 200"),
            image_panel(era.get("modelPreview"), "独立三维候选 · 360 × 200"),
            '</div>',
            f'<p>中心轮廓：{html.escape(era["silhouette"])}。时代道具：{html.escape("、".join(era["distinctProps"]))}。</p>',
            f'<p>模型：{model["triangles"]:,} 面 / {model["bytes"] / 1048576:.2f} MiB；完整拾取节点 {len(model["pickNodes"])} / 7。</p>'
            if model and model["exists"] else '<p>模型：尚无 GLB / 可编辑源 / 独立重导入对照。</p>',
            '</section>'
        ]
        cards.append("\n".join(parts))
    return """<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>九时代主城 · 360px 画质对照</title>
<style>
:root{font-family:system-ui,'Microsoft YaHei',sans-serif;color:#29383a;background:#f2f0e8}
body{margin:0 auto;padding:20px;max-width:1220px}h1{font-size:1.6rem}h2{font-size:1.25rem;margin:0}
p{line-height:1.5}.intro{max-width:850px}.era{background:#fffdf7;border:1px solid #b6a98f;border-radius:12px;margin:18px 0;padding:16px}
.era code{font-size:.73em;font-weight:normal;color:#5d706e}.status{color:#734b24;font-weight:700;margin:8px 0}
.panels{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;flex:0 1 360px;min-width:260px}
figcaption{font-size:.82rem;min-height:23px}img,.missing{display:block;width:100%;aspect-ratio:9/5;object-fit:cover;border:1px solid #d6cdb7;box-sizing:border-box}
.missing{background:#e8e2d4;color:#746c5d;display:grid;place-items:center}
@media(max-width:430px){body{padding:8px}.era{padding:10px;margin:12px 0}figure{flex-basis:100%}}
</style><body><h1>九时代主城 · 原画与三维候选</h1>
<p class="intro">每块图以真实手机地图尺寸 360 × 200 CSS px 显示；清场是合成候选，三维图是独立镜头渲染，尚未与原全景合成。贴图、镜头、轮廓和场景密度需人工逐项比较。此页只用于制作评审，游戏不会加载。</p>
""" + "\n".join(cards) + "</body></html>\n"


def main() -> None:
    assert len(MANIFEST["eras"]) == 9
    assert len(EXPECTED_SITES) == 7
    assert len({era["id"] for era in MANIFEST["eras"]}) == 9
    assert len(set(MANIFEST["pickNodeNames"])) == 7
    rows = []
    for era in MANIFEST["eras"]:
        plate = image_info(era["plate"])
        assert plate and plate["exists"] and plate["size"] == MANIFEST["plateSize"], era["id"]
        clean = image_info(era.get("clean"))
        clean_master = image_info(era.get("cleanMaster"))
        clean_mask = image_info(era.get("cleanMask"))
        clean_roi = image_info(era.get("cleanRoi"))
        for art in (clean, clean_mask, clean_roi):
            if art and art["exists"]:
                assert art["size"] == MANIFEST["plateSize"], art["path"]
        model = model_info(era.get("model"))
        editable = locate(era.get("editable"))
        preview = image_info(era.get("modelPreview"))
        boundary = clean_boundary(era)
        if boundary:
            assert boundary["originalPixelsExactOutsideMask"], era["id"]
        if model and model["exists"]:
            assert not model["externalUris"], era["id"]
        rows.append({
            "id": era["id"], "label": era["label"], "source": era,
            "plate": plate, "clean": clean, "cleanMaster": clean_master,
            "cleanMask": clean_mask, "cleanRoi": clean_roi,
            "cleanBoundary": boundary, "model": model,
            "editableSourcePresent": bool(editable and editable.is_file()),
            "modelPreview": preview,
            "readyForRuntime": False,
            "runtimeBlockers": [
                *(["center clean composite missing"] if not clean_roi or not clean_roi["exists"] else []),
                *(["GLB missing"] if not model or not model["exists"] else []),
                *(["seven named picking nodes missing"] if not model or len(model["pickNodes"]) != 7 else []),
                "phone-size visual acceptance unrecorded",
                "physical Android ten-minute acceptance unavailable",
            ],
        })
    summary = {
        "baselineSha": "406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d",
        "eraCount": len(rows),
        "originalPlates": sum(row["plate"]["exists"] for row in rows),
        "cleanCenterComposites": sum(bool(row["cleanRoi"] and row["cleanRoi"]["exists"]) for row in rows),
        "candidateModels": sum(bool(row["model"] and row["model"]["exists"]) for row in rows),
        "completeSevenSiteModels": sum(bool(row["model"] and len(row["model"].get("pickNodes", [])) == 7) for row in rows),
        "runtimeReady": sum(row["readyForRuntime"] for row in rows),
        "eras": rows,
    }
    (HERE / "audit.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (HERE / "review.html").write_text(review_html(rows), encoding="utf-8")
    print(f'ERA_AUDIT original={summary["originalPlates"]}/9 clean_center={summary["cleanCenterComposites"]}/9 '
          f'models={summary["candidateModels"]}/9 picks={summary["completeSevenSiteModels"]}/9 '
          f'runtime_ready={summary["runtimeReady"]}/9')
    for row in rows:
        model = row["model"]
        stats = f'{model["triangles"]:,} tris {model["bytes"] / 1048576:.2f} MiB' if model and model["exists"] else "missing"
        print(f'  {row["id"]}: model {stats}, clean center {bool(row["cleanRoi"] and row["cleanRoi"]["exists"])}')


if __name__ == "__main__":
    main()
