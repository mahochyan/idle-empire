# HD‑2D 视觉重构进度与画质门槛（2026-09-27）

## 工作区基线

仓库 `E:\AIprogram\idlgame`，分支 `master`，开工与交付 HEAD 均为 `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`。已有大量未提交改动，全部保留；未 reset、提交、推送或部署。按 `AGENTS.md`、`CLAUDE.md` 和当前 `index.html` 读取依赖顺序，业务脚本仍为 `config.js → levels.js → sprites.js → math.js → garrison.js → technology.js → ui.js`。参考快照 `98571e38801f71bfdbb982a626e0e58f510abb98`（2026-09-18）仅作审查基准，未回退。

## 本轮交付

| 范围 | 结果 |
| --- | --- |
| 手机科技图谱 | `ui.js` 的资源科技、军备、精通、仓储均拆为名称/状态、说明、费用/前置和操作。`visual.css` 在日夜模式下确保说明/费用 ≥12 CSS px、按钮 ≥48 CSS px，禁用按钮仍可读；既有研究、锻造、投入和升级函数保持。`科研精通` 与 `冶钢精通` 均正确归入精通类。建筑概览原有可操作优先、筛选、搜索和详情交互保持。 |
| 角色与特效 | 50 个运行兵种拥有不同立绘与专属 VFX，另有九时代原创全景和 42 个建筑资源文件。铁器长枪兵过细的特效已换为铁蓝冲击；50 人立绘与 50 种特效已做[手机大小总览](../../hd2d-previews/qa-portrait-gallery-current-50.png)和[特效总览](../../hd2d-previews/qa-unit-vfx-gallery.png)人工审视。战斗血线现在为 `#81000f`、3 CSS px，人数在右侧，并按头部实体像素定位，不再跟随枪尖。 |
| 上一冻结安卓包 | [`android/validation/tech-science-ui-20260927/app-debug.apk`](../../android/validation/tech-science-ui-20260927/app-debug.apk)，SHA‑256 `B410E5B11A3F5D3B7B44162F89E627FA3C1156A13927EE7E4CA6F1994FFB7252`。构建时源码/生成目录/APK 603 项一致，无 `INTERNET` 权限；**此包早于本表的深红头部锚点、铁枪特效和新科技卡片，属于历史基线**。 |
| 上一包安卓模拟器 | Android 15 离线 WebView 320px 26/26、390px 24/24；真实战斗 WebGL 丢失后原 `B` 与 epoch 保持、三张二维单位卡可见，12/12。见[历史验收报告](../../android/validation/tech-science-ui-20260927/README.md)；不能当作本轮新版 APK 的验收。 |

构建后并行玩法工作对 `config.js`、`garrison.js`、`math.js` 增加试炼守卫逻辑，**本视觉 APK 不包含这三项后续改动**。当前源码对冻结生成目录的三处差异见[源码漂移记录](../../android/validation/tech-science-ui-20260927/source-drift-after-build.json)，重新执行三方审计因此退出 1。不能把此 APK 称为此刻工作区全部源码的包，也不能把并行战斗规则归为本次视觉修改。新规则当前独立测试 5/5；本次没有改动它们。

### 最新冻结的 Android 离线包

本轮血线、50 个独立 VFX、军备/精通/仓储卡片和暗色可读性均进入 [`bloodline-head-tech-final-20260927/app-debug.apk`](../../android/validation/bloodline-head-tech-final-20260927/app-debug.apk)，SHA‑256 `B24FA45041A04CE7BF6AFD4D0FC5DC99A98F1DCCD5680512E4C3212FA8C7542F`，87,077,043 字节。构建时源码、Gradle 生成目录、APK 603 项哈希一致；构建后[冻结生成目录与 APK 复审](../../android/validation/bloodline-head-tech-final-20260927/apk-parity-frozen.json)仍为 603/603、差异 0，没有 `INTERNET` 权限，三维画质未通过的候选未打包。并行玩法工作后来又更改 `config.js`、`math.js` 和 `ui.js` 的玩法区域，当前源码与此冻结 APK 有三处漂移；视觉区域未漂移，不将后来玩法更改算作本 APK 功能。

此包在 Android 15 **离线模拟器**通过 320px 44/44、390px 42/42 的 WebView 冒烟，覆盖日夜科技分类、稀疏铁枪兵/野猪、双方 12 对 12；真实 `openBattle()` 后 WebGL 上下文丢失的二维回退 12/12。CDP `Input.dispatchTouchEvent` 另在 320/390px 各通过 18/18 项，实际发送触摸事件完成导航、展开图谱及军备→精通→仓储切换，每个目标 ≥48 CSS px，关键成长字段未变；此项仍是模拟器触控。长测连续 600.261 秒，Three 绘制约 17,992 帧/601.206 秒，即 29.93 帧/秒；708/708 次攻击 VFX 可见，24/24 立绘持续存在，进程和 WebGL 上下文未中断。Android 窗口提交在前三分钟约 59 Hz，第 4 分钟均值 33.55 Hz，之后约 30–31 Hz；窗口节奏下降的原因尚未确定，不能宣称稳定 60 Hz，也不能把模拟器结果当作中端实体手机的 30 FPS 验收。细节、初次测试失败与恢复记录见[本包验收报告](../../android/validation/bloodline-head-tech-final-20260927/README.md)。

### 本轮血线与窄屏科技细节

- WebGL 人数徽标上的血线使用 3 CSS px 视觉厚度和深红 `#81000f`，数字仍放在右侧；HUD 与二维回退同步用此红色。血线位置现在寻找贴图中央 34%–66% 区域的连续实体像素，使高举的长枪、长弓和骑枪不把线拉到武器尖。稀疏与满编分别按屏幕像素偏移定位；[320px 长枪兵](../../hd2d-previews/qa-bloodline-head-anchor-spear-320.png)、[390px 长枪兵](../../hd2d-previews/qa-bloodline-head-anchor-spear-390.png)和[390px 满编](../../hd2d-previews/qa-bloodline-head-anchor-full-390.png)为实际 Edge/WebGL 截图。堡垒巨盾和黄金重骑兵的线贴头顶羽饰，未压到面部；这两种特殊装饰的微调属于后续画质判断。
- 320px 军备、精通、仓储将行内密集文字变为独立卡片，费用和前置分行，禁用操作在日夜两种主题下均保持 `opacity:1`。`CFG.scholarMastery.name` 是「科研精通」，分类改为按配置名称识别，避免错误出现在「科研」页。对应[军备](../../hd2d-previews/qa-tech-arms-cards-320.png)、[仓储](../../hd2d-previews/qa-tech-storage-cards-320.png)截图，操作仍调用原函数。
- 铁器长枪兵原 VFX 在 64px 下近似细线，改为低级兵种应有的简洁铁蓝冲击，仍明显低于高阶兵种的面积与层数。[320px 实战](../../hd2d-previews/qa-vfx-iron-spear-bloodfix-battle-320.png)、[390px 实战](../../hd2d-previews/qa-vfx-iron-spear-bloodfix-battle-390.png)已确认可见；旧 PNG/SVG 与新版 ImageGen 母图、提示词均在 `assets/art/source/generated/vfx/units/`。资源 ID、VFX profile 和战斗结算未变。

## 主城三维画质判断

运行中的九时代城镇仍为明亮手绘全景和局部浮雕；七个地标具备点击区域、状态与文字入口。当前“真实三维场景＋统一动态光影”的九时代目标**未达到**。为避免用低质模型覆盖原画，所有下列资源均留在候选路径，未进入游戏或 APK。

| 候选 | 360×200 目视结论 |
| --- | --- |
| [基础清场底图](../../assets/art/source/generated/town-base-clean-candidate/README.md)＋[旧 3D 主楼](../../hd2d-previews/qa-town-roi-3d-360.png) | 局部羽化可保留外围原画且不重影，主楼屋顶、石阶、蓝旗和道路仍低于原画；拒绝接入。 |
| [青铜主楼 3D](../../hd2d-previews/qa-town-bronze-roi-3d-360.png) | 15 网格、8,126 三角面，柱廊/铜盾/石阶层次不足；拒绝接入。 |
| [八角主楼新版](../../hd2d-previews/qa-town-octagonal-roi-360.png) | 可编辑 Blender/GLB，11,293 三角面、4.36 MB；屋顶和院落细节仍不足，单地标已超过完整场景 4 MB 初始预算；拒绝接入。 |
| [原画投影深度网格](../../hd2d-previews/qa-town-projection-comparison-360x200.png) | 默认镜头能几乎保留原画，8° 转动有有限视差；缺建筑背面/侧面与动态光照，属单视角 2.5D，不能冒充完整三维城镇。 |
| [原画投影实体主楼](../../hd2d-previews/qa-projective-hall-360x200.png) | 79 个闭合构件、两块厚屋坡、1,150 三角面、6 次绘制，默认镜头和 ±8° 视差以及动态光照通过结构检查；侧面贴图和手绘密度仍低于原画，拒绝接入。见[复现说明](../../tools/visual/projective-hall/README.md)。 |
| [实体主楼局部贴图新版](../../hd2d-previews/qa-projective-hall-textured-360x200.png) | ImageGen 屋坡/侧墙贴图映射至 29 个实体面，结构验证 8/8；中央原画 RGB 差仅从 8.68 降至 8.08/255，±8° 从约 23.5 降至约 23.0/255。手机画幅下轮廓和院墙细节仍不足，[局部对照](../../hd2d-previews/qa-projective-hall-textured-local-diff.png)未达到替换门槛；未接入。 |

因此，已有九时代 **二维城镇图**，没有九套通过画质门槛的完整 GLB 城镇。九时代中央主楼清场候选现已齐备（基础、青铜加上[铁、银、金、合金、蒸汽、电气、核能七时代记录](../../assets/art/source/generated/town-era-clean-candidates/README.md)）；每时代有母图、中央遮罩、仅替换中央区域的 ROI 样本与 360×200 对照，外围像素保持原画。它们仅为后续三维叠加底图，未接入运行时或 APK；全幅 ImageGen 编辑会改变外围，不可直接替换。候选的 `.blend`、GLB、ImageGen 母图、复现脚本及各自 README 均保留供后续制作；具体共同镜头、分层背景、七地标和移动预算见[`era_town_bronze/README.md`](../../assets/art/source/models/era_town_bronze/README.md)。

## 验证、限制与回退

- `node tests/visual/browser_smoke.js`：真实 Edge CDP，当前源码复跑退出 0，[210/210](../../hd2d-previews/qa-visual-final-current-source-20260927.json)，覆盖 320/360/390/430px、建筑/科技、日夜切换、1/6/12 编队、长枪兵血线对头盔而非枪尖、VFX、WebGL→2D、战斗结果/存档固定随机对照。浏览器模拟视口不等于真机。
- `node assets/art/source/check.mjs`、`node tests/visual/assets.js`、`node --check ui.js`、`node --check hd2d.js`、`git diff --check`：均退出 0。
- `node tests/ie001/run.js`：96/96；`combat_guards.js`：13/13；`combat_order.js`：5/5；`awakening_trial.js`：8/8；并行新增 `awakening_guard_passives.js`：5/5，均退出 0。最初误用不存在的 `tests/combat_guards/run.js` 等三个路径时退出 1，随后定位 `tests/progression/` 并用真实入口重跑通过；那三次不代表实现失败。
- 上一冻结血线包 `9CCBD100…` 的[历史离线模拟器 600 秒长测](../../android/validation/bloodline-deep-longrun-20260927/README.md)不用于当前包结论；当前 B24F 包已做上节所述独立 600 秒样本，窗口频率下降仍是未解释风险。
- 用户暂时无法提供物理 Android 手机。因此**实体手机**离线十分钟、触控、温升和中端设备稳定 30 fps 均未运行，不能记为通过。模拟器触控与浏览器模拟视口也不等于实机验收。
- 本次科技卡片只修改呈现，没有新增 `S/B` 或 `rts_save` 字段；安卓候选目录排除不影响存档。若回退视觉，恢复相关 `ui.js`/`visual.css` 改动并重新构建；回退 APK 前先导出核对存档，并检查旧代码对当前档的兼容读取。候选 3D 从未接入，无运行画面回退操作。

下一步仍是制作达到原画密度且符合统一镜头/光照的九时代完整三维场景，再以物理手机逐项验收。现阶段不能将目标标记完成。
