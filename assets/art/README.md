# 放置帝国原创美术资源

本目录是亮色像素界面的美术源与离线打包资源。资源包括项目程序绘制图形与 Codex 内置 imagegen 生成图，未使用《八方旅人》的贴图或模型。

## 资源清单

| 类别 | 数量 | 运行资源 | 可编辑源 |
| --- | ---: | --- | --- |
| 角色、敌人与野兽 | 60 | `units/*.png`（32×32）与待机、攻击、受击、倒地动作图（各 128×32，4 帧） | `source/units/*.svg`、`source/generate.mjs` |
| 角色高清立绘 | 56 | `units/hires/*.png`（512×512，透明单帧；37 个可训练兵种、16 个敌方专属角色及 3 张通用图） | `source/generated/units/*-master.png`（1254×1254）、`source/generated/units/PROMPTS.md`、`source/generated/units/enemy-portrait-prompts.json`、`units/hires/optimize.ps1` |
| 建筑与地标 | 42 | `buildings/*.png`（32×32）；12 个地图图块在 `map/*.png`（64×64） | `source/buildings/*.svg`、`source/generate.mjs` |
| 战斗特效 | 5 套旧版＋9 张通用高清母图＋50 张已接入逐兵种母图＋53 张兵种运行图 | `vfx/*.png`（旧版 32×32）、`vfx/hires/*.png`（512×512）、`vfx/units/*.png`（256×256） | `source/vfx/*.svg`、`source/generated/vfx/*-master.png`、`source/generated/vfx/units/*-master.png`、`source/vfx/units/*.svg`、`source/vfx/generate-unit-vfx.mjs` |
| 界面图标 | 110＋8 | `atlas.png` 中的 `ui:` 图块与 `sprites.js` 内联 SVG；主导航及木、石、粮使用 `ui/primary-atlas.png`（4×2 透明图集，由 `visual.css` 定位） | `sprites.js` 的矩形定义、`source/generated/PROMPTS.md` |
| 地形与战斗远景 | 2 | `map/terrain.png`（64×64）；`map/battle-backdrop.png`（256×96） | `source/generate.mjs` |
| 主城与战斗高清场景 | 11 | `scene/town-daylight.png` 与 `scene/town-{base,时代 ID}.png`（均 1024×525）；`scene/battle-daylight.png`（768×1152） | `source/generated/town-*-master.png`、`source/generated/battle-daylight-master.png`、`source/generated/PROMPTS.md`、`source/generated/town-era-prompts.json`、`scene/optimize.py`、`scene/optimize.ps1` |
| 三维地标与战场道具 | 8 | `models/*.glb` | `models/source/generate-models.mjs` |

`manifest.json` 记录每幅像素图和图集坐标；`models/manifest.json` 记录 GLB 路径和占地。旧 `assets/` 与 `image/` 原图仍保留，便于逐项对照与回退。

2026-09-28 合并玩法与视觉时，新增 `quantum_trooper`、`arcane_mage`、`soul_wraith` 的独立像素动作图、高清立绘和逐 ID 特效。三张立绘母图由 Codex 内置 imagegen 生成，运行图经 `units/hires/optimize.ps1` 缩放；特效基于项目通用母图，由各自 profile 和可编辑 SVG 生成。先前文中的“50 个角色”描述保留为当时批次记录。

高清攻击特效采用原创透明母图，由内置 image_gen 绘制，通用母图提示词保存在 `source/generated/vfx/PROMPTS.json`。`vfx/unit-vfx-profiles.json` 为全部 50 个 `CFG.units` ID 指定同 ID 的运行贴图、出手样式、配色、轨迹和命中符号；每个 ID 都有一张独立的透明 PNG 和一份可编辑 SVG。六只野兽另有逐 ID 母图，提示词在 `source/generated/vfx/units/PROMPTS.json`；基础步兵、猎人弓兵、青铜刀盾兵、白银重甲兵、电磁兵、星际先遣兵也有逐 ID 母图，提示词在 `source/generated/vfx/units/PROMPTS-techline-six.json`。生成器优先使用这些独立主体，缺少时保留原通用母图路径。野兽效果在 [64px 浅色／夜间对照图](../../hd2d-previews/qa-beast-vfx-64-light-dark.png) 中检查；六个科技兵种在 [更新前后对照图](../../hd2d-previews/qa-unit-vfx-techline-six.png) 中检查。低阶效果较克制，高阶逐级增加主体尺寸、能量环和粒子。打包时只需要 PNG 与配置 JSON/JS，图像生成工具不进入玩家运行环境。

科技线第二至第五批的 24 张逐 ID 母图均已接入同 ID 运行 PNG 和源 SVG；旧运行 PNG 分别保存在 `source/generated/vfx/units/previous-runtime-batch{2,3,4,5}/`。其中长枪侍从与铁矛兵分别重画为斜向金翼长枪和有深色外轮廓的横向窄铁矛，旧母图及中间草稿保存在 `source/generated/vfx/units/previous-masters-batch2/`。银弓箭为亮色战场增加了细深蓝轮廓，保留浅色银弓主体。四批提示词保存在同目录的 `PROMPTS-techline-batch{2,3,4,5}.json`；候选运行图分别保存在 `hd2d-previews/vfx-batch2-candidates/`、`hd2d-previews/vfx-batch3-4-candidates/` 和 `hd2d-previews/vfx-batch5-candidates/`，可用 `--ids=... --candidate-dir=...` 重新生成而不改运行资源。第二至第四批 64px 浅/深底对照图和 alpha、SHA、旧图备份及逐 ID SVG 检查由 `python assets/art/source/vfx/review-techline-batches.py` 产生，结果在 `source/generated/vfx/units/techline-batches-2-4-validation.json`，运行图在 `hd2d-previews/qa-vfx-techline-batch{2,3,4}-runtime-64.png`。第五批用 `python assets/art/source/vfx/review-techline-batch5.py` 做同类检查；结果在 `source/generated/vfx/units/techline-batch5-validation.json`，运行图对照在 `hd2d-previews/qa-vfx-techline-batch5-runtime-64.png`，等级对照在 `hd2d-previews/qa-vfx-techline-batch5-rank-comparison-64.png`。

最后九张影刃、四法师与四个遗迹机巧单位的独立母图也已接入，使当时的 45 个 ID 均具有各自的 ImageGen 透明母图、运行 PNG 和可编辑 SVG；后续五个新增敌方 ID 也已补齐，当前共 50 个。九张旧运行图在 `source/generated/vfx/units/previous-runtime-final9/`；时序法师第一稿在 `source/generated/vfx/units/previous-masters-final9/`。完整提示词和边距修订分别记录于 `source/generated/vfx/units/PROMPTS-final-nine-mages-shadow.json` 与 `PROMPTS-divine-four.json`。`python assets/art/source/vfx/review-final-nine.py` 检查的是当时 45 张的批次快照；结果在 `source/generated/vfx/units/final-nine-validation.json`，对照图在 `hd2d-previews/qa-vfx-final-nine-runtime-64.png`。当前 50 张运行图总览由 `pwsh -File assets/art/source/vfx/contact-sheet.ps1` 生成到 `hd2d-previews/qa-unit-vfx-gallery.png`，对应完整覆盖由 `node assets/art/source/check.mjs` 验证。

铁器长枪兵 `iron_spearman` 的第一版攻击主体在亮色战场 64px 下与基础长矛兵过于相近，现改用内置 ImageGen 重画的铁蓝锥形冲击。运行 PNG、可编辑 SVG、[新母图](source/generated/vfx/units/iron_spearman-master-v3.png)与[生成提示词](source/generated/vfx/units/PROMPT-iron-spear-v3.json)保持同 ID；旧 PNG/SVG 备份在 `source/generated/vfx/units/previous-runtime-iron-spearman-v3/`。[320px 旧图](../../hd2d-previews/qa-vfx-iron-spear-current-battle-320.png)与[新版](../../hd2d-previews/qa-vfx-iron-spear-final-battle-320.png)、[390px 新版](../../hd2d-previews/qa-vfx-iron-spear-final-battle-390.png)来自 Edge/WebGL 视觉样本，不能代替 Android 实机效果。

要从母图重新生成运行资源，先运行 `pwsh -File assets/art/vfx/hires/optimize.ps1`，再将开发侧的 `@resvg/resvg-js` 模块目录设为 `VFX_RESVG_MODULE`，运行 `node assets/art/source/vfx/generate-unit-vfx.mjs`。例如在 PowerShell 中：

```powershell
$vfxToolDir = Join-Path $env:TEMP 'idle-empire-vfx-render'
npm install --prefix $vfxToolDir --no-save '@resvg/resvg-js'
$env:VFX_RESVG_MODULE = Join-Path $vfxToolDir 'node_modules\@resvg\resvg-js'
node assets/art/source/vfx/generate-unit-vfx.mjs
pwsh -File assets/art/source/vfx/contact-sheet.ps1
pwsh -File assets/art/source/vfx/contact-sheet-beasts.ps1
node assets/art/source/check.mjs
```

只重绘指定兵种时，在同一个生成器后添加 `--ids=infantry,archer,bronze_guard,silver_heavy,electro_trooper,star_trooper`；其他 39 张运行图不会被写入。横幅比例的母图会保持宽高比居中放入 256×256 画布。六张资产的尺寸、alpha 与 SHA 检查结果记录在 `source/generated/vfx/units/techline-six-validation.json`。改造前的六张运行图逐字节备份在 `source/generated/vfx/units/previous-runtime/`，按同名文件复制回 `vfx/units/` 即可回退这一批贴图。

## 视觉规范

- 逻辑像素为 32×32，放大时用最近邻采样，不做平滑；透明边距保留角色轮廓。
- 每个角色动作横排 4 帧：待机、攻击、受击和倒地。动作由同一角色源图做位移、转身、特效与颜色变化，帧时长记录在 `manifest.json` 中。
- 50 个配置角色（35 个可训练兵种与 15 个敌方专属角色）各有同 ID 的 512px 透明立绘；攻击、受击和倒地通过位移、闪色与倾倒表现。所有角色仍保留各自的 32px 四帧动作图。高清图不更改单位 ID 或战斗状态。
- 浅色砂石、象牙白和草绿作为环境底色，深蓝灰描边保证在亮色地面上可辨。
- 单位区分优先使用装备与轮廓：盾、枪、双手剑、弓、弩、双刀、坐骑、法杖、火器和机甲；颜色只作次级编码。
- 主城地图有基础版及青铜、铁器、白银、黄金、合金、蒸汽、电力、星核八个时代版本，全部保留相同地标位置供点击；场景缺图时回退到日间基础图。
- 金属资源分别使用矿石或锭的形状，钱币与金属金分开；八种精魄各有不同内纹。
- GLB 为 glTF 2.0、Y 向上、正面朝 +Z、地面在 y=0；不引用外部贴图。城镇模型占地约 2.5×2 场景单位，`battle_props.glb` 占地约 8×5。

## 生成与验证

```sh
node assets/art/source/generate.mjs
node assets/art/models/source/generate-models.mjs
pwsh -File assets/art/units/hires/optimize.ps1
pwsh -File assets/art/scene/optimize.ps1
node assets/art/source/check.mjs
node assets/art/source/check-http.mjs
```

像素资源生成器只依赖 Node 内置模块。全部高清立绘由 `units/hires/optimize.ps1` 枚举 `*-master.png`，用 Windows System.Drawing 最近邻缩放，母图保留在 `source/generated/units/`；日间主城与战斗图由 `scene/optimize.py` 导出，九张时代主城图由 `scene/optimize.ps1` 导出。检查器从当前 `CFG.unitUpgrades` 与 `CFG.units` 验证全部配置角色的逐 ID 立绘与母图，并验证九个时代场景、资源、精魄、建筑图标引用，以及 PNG 和 GLB 文件结构；HTTP 检查器临时启动本机静态服务逐一请求运行资源。它们不代替浏览器或 Android 真机的视觉验收。

## 复苏圣像增补

`revival_god` 有独立的 32px 图标与四组 128×32 动作图、512px 透明立绘和 256px 专属复苏特效。立绘母图为 `source/generated/units/revival_god-master.png`，像素图标可编辑源为 `source/units/revival_god.svg`；特效母图、可编辑 SVG、逐 ID profile 与提示词见 `source/generated/vfx/units/revival_god-master.png`、`source/vfx/units/revival_god.svg`、`vfx/unit-vfx-profiles.json`、`source/generated/vfx/units/PROMPTS-revival-god.json`。64px 明暗底预览分别在 `../../hd2d-previews/qa-revival-god-portrait-64.png` 与 `../../hd2d-previews/qa-vfx-revival-god-64.png`。这批美术未变更战斗或存档数据，实机战斗视觉待另行验收。

## 缄默之神与试炼守卫增补

`silence_god`、`trial_guard_easy`、`trial_guard_perfect`、`trial_guard_extreme` 各有原创 32px 图标、四组 128×32 动作图、512px 透明立绘和独立 256px 特效。像素图标在 `source/units/` 保留可编辑 SVG；立绘在 `source/generated/units/` 保留各自 1254px 母图，完整生成提示词见 `PROMPTS-divine-trials.md`。四张立绘的 64px 明暗底预览位于 `../../hd2d-previews/qa-divine-trial-portraits-64.png`，图标预览位于 `../../hd2d-previews/qa-divine-trial-icons-32.png`。特效母图、提示词和可编辑 SVG 分别在 `source/generated/vfx/units/`、`source/vfx/units/`；运行时映射保存在 `vfx/unit-vfx-profiles.json`。浏览器与 Android 实战视觉由整体验收单独验证。
