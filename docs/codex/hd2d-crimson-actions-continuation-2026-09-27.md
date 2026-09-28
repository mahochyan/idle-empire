# 战斗血线、高清动作与专属特效续改（2026-09-27）

## 基线与范围

- 分支 `master`，起止 HEAD 均为 `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`；当前视觉目录是未跟踪文件，工作区原有改动全部保留，未 reset、提交或推送。
- 本次只改视觉层、可编辑美术资源、视觉检查与 Android 打包排除候选资源。未改 `S/B`、数值、随机数、结算、奖励或 `rts_save`。
- 手机真机尚未连接；Android 15 模拟器结果需与物理设备验收分开记录。

## 修改与画面

- `hd2d.js` 的世界血线改为 `#c00019`，深色轨道改为 `#4c0710`；`visual.css` 的 HUD 与二维回退同步使用 `#c00019`。世界血线以立绘可见顶边向上约 2.5 CSS px 为目标，同时跟随动作帧的 alpha 顶边及角色位移。步兵举剑帧与弓兵抬弓帧分别用已审过的头部锚点 `104/512`、`92/512` 放置血线，避免它离头部过远；其余帧仍以透明边界为准。六对六野兽缩放后同步更新角色基线，避免血线仍停在缩放前位置。
- 步兵、星际兵、弓兵与弩兵新增攻击、受击、倒地各四帧高清贴图。每张第 0 帧与原待机 PNG 逐像素一致；后 3 帧是 ImageGen 原创关键姿态，按原人物身高和脚底线打包。运行时仅对这四个兵种启用；缺图仍显示原高清立绘，旧 32px 动作贴图仍可用。图集元数据与可复现脚本在 `assets/art/units/hires/actions/` 及 `assets/art/source/generated/units/actions/`。
- 步兵、猎人弓手、青铜刀盾兵、白银重甲兵、电磁兵、星际先遣兵、盾步兵、枪步兵、弩兵、初阶骑兵、铁枪兵与黄金骑兵新增逐 ID 的原创特效母图和 256px 运行图，保留现有资源 ID。连同此前六只野兽，18 个兵种已有独立 ImageGen 特效母图；其余 27 个运行图仍从通用母图衍生，尚需继续重绘。
- 满编 12 对 12 的纵向六条站位线改为等距错位，保留原有角色宽度和独立阵型槽位。320×568 浏览器舞台中，最外侧立绘底边仍距舞台边约 20.8 CSS px，徽标无裁切；[320px 前后对照](../../hd2d-previews/qa-full-spacing-before-after-320-20260927.png)与[390px 前后对照](../../hd2d-previews/qa-full-spacing-before-after-390-20260927.png)。
- 基础时代主城完成可编辑 Blender/GLB 地标样板及原画并置图。100px 下与现有全景的院落、植被和手绘轮廓仍不一致，因此只保留于 `assets/art/models/candidates/`，不替换运行时地图。`hd2d.js` 的静态 GLB 解析器补充 UV、内嵌底色贴图和 alpha 模式支持；候选 3D 美术仍需进一步匹配九时代全景。
- 后续六种科技线特效母图与两种骑兵动作母图只放在源目录候选区，未改变上述 APK。第五批特效通过 64px 浅深底身份与等级对照。骑兵冲锋初稿在 512px 格内会缩到原待机身高的约 70–74%，已重画到普通骑兵 97.4%、金甲骑兵 94.1%；普通骑兵中间姿态仍越过名义分格线 27px，虽然与相邻姿态有透明间隔，接入运行图前还需修正。

当前画面：[稀疏 1v2](../../hd2d-previews/qa-crimson-close-sparse-390-20260927.png) · [六对六](../../hd2d-previews/qa-crimson-close-medium-360-20260927.png) · [满编站位前后对照](../../hd2d-previews/qa-full-spacing-before-after-320-20260927.png) · [步兵举剑头部血线](../../hd2d-previews/qa-infantry-headline-390-20260927.png) · [四兵种动作图集](../../hd2d-previews/qa-hires-actions-four-units.png) · [第二批六个专属特效](../../hd2d-previews/qa-vfx-techline-batch2-candidates-64.png) · [主城 3D 画风并置](../../hd2d-previews/qa-town-hall-base-paint-vs-3d.png)。

## 已完成验证

| 命令或检查 | 结果 |
| --- | --- |
| `node tests/visual/browser_smoke.js` | 退出码 0，195/195；320、360、390、430px，稀疏、六对六、满编、夜间、二维回退与存档对照通过。 |
| `node hd2d-tests/renderer_browser.js` | 退出码 0；步兵、弓兵、弩兵攻击及星际兵三动作均切换到四帧图集，头部锚点血线间隔 2.5px；WebGL 上下文丢失回退通过。 |
| `python -B assets/art/source/generated/units/actions/pack.py --check` | 退出码 0；12 张 2048×512 图集、第 0 帧逐像素一致、透明边界与 manifest 校验通过。 |
| `node tests/visual/assets.js` | 退出码 0；45 个独立角色立绘、九时代全景、42 座建筑及资源路径通过。 |
| `node assets/art/source/check.mjs`、`node assets/art/source/check-http.mjs` | 均退出码 0；后者检查 489 个本地资源 URL。 |
| `python -B assets/art/source/vfx/review-techline-batches.py` | 退出码 0；18 张不同母图、第二批六张运行候选的透明度、留边、哈希和 64px 浅深底对照通过。 |
| `node --check hd2d.js`、`git diff --check` | 均退出码 0；Git 只报告既有文件的 CRLF 转换提示。 |

浏览器画面为 Edge/CDP 手机 CSS 视口，不等同 Android 真机触控或性能。Android 15 模拟器在头盔锚点修改**之前**的 APK `850C498AD43B91C8598216F024C1A2515770143ACADFF630A8AF86B5537A1D4E` 上完成了混合满编 12 对 12 的 600.299 秒离线采样：18,030 UI 帧，30.035 fps，P50 23ms、P95 34ms，GPU P95 20ms；开始与结束均为 PID 8459，24/24 立绘及两套动作图集就绪，WebGL 未丢失，`B` 为空且存档版本 32。结果与截图在 `android/validation/emulator-android35-action-final-20260927/`；它只适用于修改前包。

新 APK `15DA2AF33C8FDB56FFDA60A0F78DA27386B87AC80C0AC92D65F1616D0B68E8B3` 已完成 543/543 资源 SHA 对照和 Android 15 模拟器 320/360px 冒烟，四兵种四帧攻击与满编站位可见。`android/validation/emulator-android35-four-atlas-20260927/` 的独立 600.221 秒满编采样得到 18,036 UI 帧、30.049 fps，P50 22ms、P95 34ms、GPU P95 21ms；应用 PID 9152 前后一致，24/24 角色与四种动作资源就绪，WebGL 未丢失，`B` 为空、`battleEpoch` 为 0、存档版本 32。WebView 渲染进程 PSS 为 208,527→134,973 KiB，应用 PSS 为 100,709→104,551 KiB；模拟器 Graphics PSS 报 0，不能据此推断物理 GPU 占用。`portraitActionsReady` 只证明动作图集解码缓存就绪，不代表全部图集已上传 GPU。独立的 12 图集 attack/hit/death 压力短测逐一触发所有动作，四帧状态均就绪，WebGL 与同一应用 PID 保持正常；压力前后 WebView 渲染进程 PSS 为 135,317→134,997 KiB，应用 PSS 为 102,961→102,935 KiB。360px 稀疏[举剑截图](../../hd2d-previews/qa-android-crimson-headline-360-20260927.png)显示血线位于头盔上方、剑尖下方，无覆盖。

## 存档、回退与剩余工作

视觉层只读取主城快照、战斗快照与 `battleEpoch` 表现事件。二维回退从同一战斗状态显示，不重开战、不改存档。当前战斗画面中人物动作图集为四个兵种的样板，逐帧装备细节有轻微 ImageGen 漂移，弓兵受击帧有一处多余黄色火花；扩展到全部兵种前需做按动作懒加载、弱机分辨率档位和物理手机内存/帧时测量。当前 12 张动作图集若同时上传，按 RGBA8 加 mipmap 估算约需 64 MiB GPU 空间，不计待机图和场景；这是估算，不是设备实测。

如需回退这次视觉修改，在 `hd2d.js` 关闭四兵种 `hiresActionTypes` 样板并还原血线颜色/距离与满编纵向 `rowGap`、在 `visual.css` 还原血线色；先保留原有资源和可编辑母图，不清理未提交工作区。Android 可重新打包上一版已核对的运行资产；物理手机验收之前，不宣称稳定 30 fps 达标。
