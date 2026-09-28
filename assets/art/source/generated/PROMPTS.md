# 作图模型场景源

以下场景母图由 Codex 内置 `image_gen` 生成，之后由项目的视觉层引用。没有使用任何现成游戏的贴图或模型。`battle-daylight-master.png`、`battle-night-master.png` 和 `town-daylight-master.png` 是场景母图；`../../ui/primary-atlas.png` 是八个主界面图标的透明图集。

## 战斗日间场景

> Use case: stylized-concept. Asset type: original 2D pixel-art backdrop for a portrait mobile HD-2D battle scene in a Chinese fantasy idle strategy game. Paint a polished daylight battlefield environment only, to sit behind separately rendered 3D ground and 32px pixel characters. Preserve the friendly, compact pixel-art character of the existing game. Sunlit golden field outside a small frontier settlement, layered old stone walls and watchtower in the distance, pale blue sky, soft clouds, warm sandstone, sparse grass and small shrubs. Gentle atmospheric depth in the far distance only. Hand-painted high-resolution pixel art with carefully clustered pixels, soft painterly light and subtle depth; bright daytime, warm ivory and sage green. Portrait 2:3 composition, horizon in upper third, central and lower area open for characters. Original designs. No characters, UI, text, watermark, night scene, vignette or muddy palette.

## 战斗夜间场景

以运行中的 `scene/battle-daylight.png` 为图像编辑参考，母图保存为 `battle-night-master.png`，由 `assets/art/scene/optimize.py` 打包为 768×1152 的 `scene/battle-night.png`。原始生成文件保留在 Codex generated_images 中，工作区母图为可继续编辑的 PNG。

> Edit the supplied battle background image into its NIGHT MODE counterpart for a portrait mobile HD-2D fantasy strategy game. Preserve the EXACT scene composition, camera angle, roads, structures, banners, walls, plants, and painterly pixel-art texture; do not add characters, text, UI, or new objects. Transform only the lighting and color: blue-violet twilight sky with a faint moonlit glow, muted warm torchlight from the fortress and foreground outposts, readable midtones, rich but not black shadows. The ground where battle units stand should be medium cool slate-blue / desaturated earth so red health lines and warm character sprites remain visible. Maintain the same 1024x1536 framing and original detailed hand-painted style. No blur, no haze over the foreground, no photorealism. Output as a usable full bleed background image.

## 主城日间地图

> Use case: stylized-concept. Asset type: original game home-town map artwork for a 390×200 CSS px mobile viewport. A small frontier town from a high three-quarter isometric camera, keeping the friendly blocky pixel-art charm of a simple mobile idle strategy game. Central timber-and-stone town hall with red terracotta roof; lumber yard and grove to the left; quarry to the right; farm plots below; blue-roof academy, barracks and watchtower toward the back. Dirt paths connect seven clearly separated landmarks. High-quality HD-2D pixel art, crisp clusters, soft light and depth, bright late-morning palette of pale green, cream, muted blue and warm red. Wide roughly 2:1 composition, no horizon or sky, central landmarks visible when reduced to a phone. No humans, UI, text, watermark, dark vignette or photorealism.

## 主界面图标

> Use case: stylized-concept. Asset type: transparent pixel-art UI icon sheet. Eight distinct original icons in an exact four-column by two-row grid, centered in equal square cells with transparent spacing. Row 1: red-roof town hall, hammer with stone block, research book with blue spark, helmet and banner. Row 2: crossed sword and shield, lumber logs, blue-gray rocks, golden wheat sheaf. Crisp stepped outlines, clear silhouettes at 32px, warm ivory, sage green, muted teal, terracotta and gold, consistent light from upper left. Genuinely transparent background. No text, labels, numbers, panels, checkerboard, watermark or dark theme.
