# 青铜守卫动作母图

使用内置 ImageGen，以 `assets/art/units/hires/bronze_guard.png` 作为形象和像素画风参考，生成真正透明的三姿态母图。生产稿分别为 `attack-master.png`、`hit-master.png`、`death-master.png`；各格经 `pack.py` 的透明分界、无裁切、脚底基线和待机帧一致性检查。

第一张攻击候选的长枪跨过第二、三格分界，保留在 `attack-master-v1-rejected.png`，**不参与打包**。下列攻击提示生成了当前生产稿。

## 攻击（生产稿）

> Use case: stylized-concept. Asset type: three-pose transparent pixel-art sprite strip for mobile HD-2D battle. Input image: bronze_guard.png is the exact guard design, shape, costume, gear, detailed painted-pixel style and warm bronze/cobalt palette reference. Image dimensions should be wide approximately 3:1. Divide canvas into THREE EQUAL square-like cells; each cell contains ONE full-body pose of the SAME bronze guard, entirely within the cell. Leave a clear transparent vertical gutter of at least 70 pixels at both 1/3 and 2/3 dividers. The guard is a bearded man facing screen right wearing a bronze helmet with deep blue feather crest, white tunic, blue sash, bronze greaves, carrying round bronze sunburst shield and bronze-tipped spear. ATTACK poses: left draws spear back DIAGONALLY upward; center lunges with spear held DIAGONALLY UPWARD toward right, foreshortened so the spear tip stays inside the center cell (NEVER a long horizontal spear); right recovers to upright shield guard with spear nearly vertical. Keep the guard's body, shield and plume the SAME height in all three poses, boots sharing one baseline. Genuine transparent RGBA background. Detailed crisp pixel clusters like reference. No scene, floor, text, border, labels, UI, extra objects, extra characters, cropped weapon or cross-cell parts.

## 受击

> Use case: stylized-concept. Asset type: transparent three-pose source sprite strip for a mobile HD-2D strategy battle. Input image: supplied bronze_guard.png is exact character identity and detailed pixel-art reference. Make EXACTLY THREE distinct full-body copies of the SAME bearded bronze-age guard side by side, one fully within each equal-width third of a wide horizontal canvas. Preserve bronze helmet with vivid cobalt-blue plume, white tunic, blue sash, bronze greaves, gold sunburst round shield, bronze tipped spear; face screen right throughout. HIT animation: first pose flinches and lifts shield against a blow; second rocks backward with shield raised, spear angled down, eyes squeezed; third catches balance and raises guard again. Keep boots on one baseline and all equipment entirely inside each respective third, with broad empty alpha gutters at 1/3 and 2/3. Original-like crisp hand-painted pixel-art clusters and warm bronze highlights. Genuine transparent RGBA background; no scene, floor, shadow, sparks, blood, additional people, words, borders, UI or cropped equipment.

## 倒地

> Use case: stylized-concept. Asset type: transparent three-pose source sprite strip for a mobile HD-2D strategy battle. Input image: supplied bronze_guard.png is exact character identity, costume, equipment, detailed hand-painted pixel-art style reference. Draw EXACTLY THREE separated full-body poses of ONE repeated bearded bronze-age guard, one fully within each equal-width third on a wide horizontal canvas. Preserve bronze helmet with cobalt-blue crest, white tunic, blue sash, bronze greaves, gold sunburst round shield and bronze-tipped spear. Face screen right in every pose. DEATH animation, non-graphic: pose 1 staggers with knees buckling, shield slipping; pose 2 falls to one knee, spear dropping beside him; pose 3 lies still on his side with shield and spear close beside him, helmet and plume visible. Boots of upright poses on same baseline; prone pose remains wholly within final third. Keep clear transparent gutter at 1/3 and 2/3 lines, with no shield, spear, limb or plume crossing the line. True transparent RGBA background. No floor, shadow, particles, blood, gore, scene, other people, words, borders, UI, watermarks or cropped gear.

## 审查

生产稿 `attack` 透明分界 x=724/1542，`hit` x=627/1261，`death` x=724/1446。打包比例 0.80，由脚底/画框上限裁定实际帧比例。390px 稀疏与 320px 满编的浏览器动作回归 26/26，满编同排攻击可见边界最大重叠 0.4%（多次运行有轻微差异）；实物 Android 设备未验收。
