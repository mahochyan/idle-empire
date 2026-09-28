# 高分辨率兵种立绘来源

以下源图由 Codex 内置 `image_gen` 生成，保留在本目录。运行图位于 `../../../units/hires/`，由 `../../../units/hires/optimize.ps1` 枚举所有 `*-master.png`，以最近邻缩放到 512×512，保留透明通道。源图均为 1254×1254 RGBA。画面仅参考本项目角色的像素技法，不引用现成游戏贴图。

## 复苏圣像（revival_god，2026-09-27）

使用 Codex 内置 `image_gen` 生成 `revival_god-master.png`，再按相同最近邻规则导出 `units/hires/revival_god.png`。参考本项目守卫机兵、重装防卫机、光学拟态机和战术演算机的成品，独立设计象牙石、金关节、翡翠生命核心和断环剪影。最终生成提示词：

> Use case: stylized-concept. Asset type: original transparent full-body HD-2D enemy portrait for a bright daylight mobile strategy game. Create exactly ONE distinct character: 复苏圣像, an ancient divine self-renewing guardian statue, clearly different from a shield-bearing mechanical knight. Full humanoid figure built from segmented warm ivory stone and antique gold joints, a vivid emerald leaf-shaped life core in its chest, small green regrowth motifs emerging from cracked stone, a restrained broken circular halo behind the head, two complete open hands that radiate renewal rather than carry weapons, and sturdy visible feet. Three-quarter front view facing screen right, dynamic but balanced upright stance, compact silhouette with a readable head and chest at 64 pixels. Polished hand-placed stepped pixel clusters, crisp dark blue-grey contour pixels, limited bright daylight palette, hard-edged highlights, no blurry painting or smooth gradients. Center the complete figure on a square canvas with generous transparent margins; genuine transparent alpha background. No scenery, floor, cast shadow, shield, cannon, wings, extra character, text, letters, logo, UI frame, cropping, or horror imagery.

- `infantry-master.png`：由项目主任务提供的原创步兵风格基准图。原始提示词在主任务记录中。
- `archer-master.png`：以步兵图为风格参考生成。
- `cavalry-master.png`：以步兵与弓手图为风格参考生成。
- `spearman-master.png`：以步兵与弓手图为风格参考生成。
- `mage-master.png`：以步兵与弓手图为风格参考生成。
- `enemy-master.png`：以步兵与枪兵图为风格参考生成。

## 最终提示词

### 弓手

> Use case: stylized-concept. Asset type: a standalone original playable character sprite for a bright HD-2D mobile fantasy strategy game. Input image: style reference only, do not copy its armor or pose. Subject: one chibi elf archer, warm fair skin, long golden hair beneath a forest-green hood, fitted sage cloak, light cream leather armor, and a clearly readable curved longbow held diagonally. Match the reference's precise stepped pixel clusters, black-blue contour pixels, appealing oversized head, compact full body, polished highlights, scale, and three-quarter front pose. Entire character centered and fully visible with generous transparent margins, 1024×1024 square. Bright daylight palette, original design. Genuinely transparent background and no floor shadow. No additional character, environment, UI, text, letters, watermark, or panel.

### 骑兵

> Use case: stylized-concept. Asset type: one standalone original playable cavalry sprite for the same bright HD-2D mobile fantasy strategy game as the two style reference images. Input images: style and character-scale references only; create a new design. Subject: one chibi beastfolk cavalry knight with warm moss-green skin and compact steel-blue armor riding one sturdy tawny wolf mount, carrying a short upright lance. The rider and mount form one clear readable silhouette and fit completely inside a square canvas. Match the references' polished stepped pixel clusters, dark blue contour pixels, lively oversized face, warm cream highlights, three-quarter front view and daylight palette. Center the full rider-and-mount sprite with generous transparent margins. Truly transparent background, 1024×1024 square. No other character, environment, floor shadow, UI, text, letters, watermark or panel.

### 枪兵

> Use case: stylized-concept. Asset type: a standalone original human spearman sprite for the same bright HD-2D mobile fantasy strategy game as the two style reference images. Input images: style and character-scale references only; create a new identity. Subject: one chibi human spearman in pale steel helmet with a small crimson plume, ivory tunic, teal-blue scarf, leather boots, and one long readable spear held diagonally upright; compact round buckler on the other arm. Make the silhouette clearly different from the reference sword infantry and green elf archer. Match polished stepped pixel clusters, dark blue contour pixels, oversized expressive face, soft daylight highlights, three-quarter front pose and full-body framing of the references. Center one entire character within a square transparent canvas with generous margins, 1024×1024. No environment, floor shadow, other character, UI, text, letters, watermark or panel.

### 法师

> Use case: stylized-concept. Asset type: one standalone original mage sprite for the same bright HD-2D mobile fantasy strategy game as the two style reference images. Input images: visual style and scale references only; create a distinct character. Subject: one chibi human mage with a layered indigo-and-lavender hooded robe, warm ivory trim, a clearly readable wooden staff crowned by a cyan crystal, and a small spellbook at the belt. Friendly thoughtful oversized face, no skull or undead features. Match the references' polished stepped pixel clusters, dark blue contour pixels, clean full-body three-quarter front pose, rich but bright daylight highlights and transparent padding. One full character centered on an actual transparent 1024×1024 square canvas. No floor shadow, background, other character, UI, text, letters, watermark or panel.

### 敌方掠夺者

> Use case: stylized-concept. Asset type: one standalone original enemy raider sprite for the same bright HD-2D mobile fantasy strategy game as the two style reference images. Input images: pixel technique, proportions and lighting references only; create a visibly different opponent. Subject: one chibi frontier raider in dusty burgundy-and-charcoal armor, dark red hood under a short battered iron helmet, angular shoulder guards, a hooked short saber in one hand and a small worn shield in the other. Determined but readable face, compact full body, three-quarter front stance. Match the references' polished stepped pixel clusters, dark blue contour pixels and soft warm daylight highlights. Center the full single enemy in a square truly transparent 1024×1024 canvas with generous empty margins. No environment, floor shadow, other character, UI, text, letters, watermark or panel.

## 科技树与时代兵种补图

以下兵种各调用一次 `image_gen`，将共同提示词与对应的 `Subject` 组合。输出作为 `{unitId}-master.png` 保留；打包图使用相同的单位 ID，不做别名复用。

> Use case: stylized game sprite. Create ONE original standalone full-body character portrait for the SAME bright daylight HD-2D mobile fantasy strategy game. Genuine transparent square background. Chibi proportions, oversized expressive head, compact full body, polished hand-placed stepped pixel clusters, dark blue-grey contour pixels, warm ivory highlights. Three-quarter front pose facing screen-right, centered with generous transparent margins, visual scale suitable for a 512px game unit portrait. Distinct identity and equipment silhouette. No environment, ground shadow, second character, UI, text, letters, watermark or panel. Subject:

每张图实际使用的 `Subject` 文案按单位 ID 保存在 [new-portrait-prompts.json](new-portrait-prompts.json)，共 32 项，覆盖科技树其余 24 个节点及 8 个独立时代兵种。JSON 的 `commonPrompt` 与上段相同；生成时直接拼接对应 `subjects[id]`。`infantry_t1` 是首张单独生成的样板，JSON 中的描述是接近原调用的整理稿，措辞可能与原调用略有差异；其余 31 项记录生成时的实际文案。
