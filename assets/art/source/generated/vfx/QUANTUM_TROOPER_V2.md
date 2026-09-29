# 量子兵专属攻击光效 · 第二版（2026-09-30）

运行 ID 与路径保留为 `quantum_trooper` / `assets/art/vfx/units/quantum_trooper.png`。第一版运行贴图另存为 `quantum_trooper-runtime-v1.png`，可单独回退。本次替换 PNG，并把该兵种的视觉命中粒子排列由通用护盾形改为相位分裂形；不改变等级、战斗数值、事件、`S/B` 或存档。

## 原稿与打包

- 内置 ImageGen 原稿：`quantum_trooper-attack-source.png`，1254×1254 RGBA，透明背景；它是项目内可编辑母图。
- `python assets/art/source/generated/vfx/pack_quantum_trooper.py`：退出码 0，将原稿按最近邻缩放到 220×220，居中放进 256×256 透明运行贴图。审查版保留为 `quantum_trooper-v2-packed.png`，同一内容复制到原有运行路径；有效 Alpha 边界为 `(31,82,229,179)`，没有截边。
- 第二版运行图 SHA-256 `05C515F800393E471644A7C58E0421A190A86587D29A93BF88327B48D2B271F4`；第一版 `8928D3D165633E55783BF8E546E351FA681FBDCEC88552D12C0B5C18B043A655`。与同阶 `arcane_mage` 的圆形符文图也不同：新图为横向相位分裂棱枪，轮廓、颜色位置和尺寸均可辨。

生成工具：内置 `image_gen`。最终提示词：

> Use case: stylized-concept. Asset type: original transparent 2D pixel-art projectile sprite for the high-tier 'quantum_trooper' unit in a bright HD-2D mobile battle. Primary request: a single fast horizontal quantum lance flying to the RIGHT, built from a sharp cyan-white crystalline core and two visibly offset phase-split afterimages above and below it. Distinctive asymmetrical fractured hexagon shards and short broken magenta/teal trails, but one clear projectile silhouette, not a circular magic orb or clockwork rune. Style: highly polished 32-bit fantasy game VFX pixel art with clearly stepped pixel edges, small bright highlights, readable when reduced to 64×64 pixels. Composition: one centered object inside a square image, all detail inside 75% of the frame with generous transparent padding. Colors: electric cyan, deep teal, small violet accents, white-hot core. Constraints: genuinely transparent background and soft alpha only at the glow edge; no scene, character, shadow, frame, letters, numbers, watermark, or opaque background. Avoid circular spell seals, concentric rings, blue lightning ball, and photo-real rendering.

## 画面与运行验证

- [53 兵种深色并排图](../../../../../hd2d-previews/qa-vfx-all-53-dark.png)和[浅色并排图](../../../../../hd2d-previews/qa-vfx-all-53-light.png)由 `python tools/visual/make-vfx-contact.py` 生成（退出码 0），用于目视比较，非玩家资源。
- `node tools/visual/qa_iron_spear_vfx.js --unit=quantum_trooper`：退出码 0；在实际 Edge/WebGL 战斗夹具中，等级 5 攻击资源 `quantum_trooper.png` 解码并可见，四层拖尾，攻击中段截图为 [390px 战斗](../../../../../hd2d-previews/qa-bloodline-quantum_trooper-current-battle-390.png)。测试结束曾打印临时 Edge profile `EPERM` 清理提示，不影响测试结论，但需在测试工具中修理清理时序。
- `node tools/visual/qa_iron_spear_vfx.js --unit=quantum_trooper --event=hit`：退出码 0；命中中段可见，六个粒子按相位两侧展开，[390px 命中截图](../../../../../hd2d-previews/qa-bloodline-quantum_trooper-current-hit-battle-390.png)。测试同样有临时 profile 清理提示。
- `node tests/visual/assets.js`：退出码 0，运行资源目录及全部角色／城镇资源清单通过。

这是一张兵种专属攻击贴图的视觉改善。其他 52 张特效的存在性和差异不能由这张样本代替完整主观美术验收。Android 实体手机目前未接入，触控、发热和十分钟稳定帧率尚未验收。
