# HD-2D 美术、站位与日夜界面验收记录（2026-09-26）

> 本文记录 2026-09-26 的构建与验收快照。2026-09-27 的深红血线、满编贴合定位、六兽独立特效和主城浮雕后续改动见[血线复验](hd2d-bloodline-followup-2026-09-27.md)与[主城复验](hd2d-town-relief-qa-2026-09-27.md)；下文 APK SHA 只对应旧版快照。

## 基线与范围

- 当前分支 `master`，HEAD `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`；工作区原有大量未提交改动，本次保留原样，没有 reset、切换分支或推送。
- 项目约定提到的参考快照 `98571e38801f71bfdbb982a626e0e58f510abb98` 实际 Git 提交日期为 **2026-05-17**，与约定中的 2026-09-18 不一致；它未作为回退目标。
- 本次补齐 `CFG.units` 中 10 个 `enemyOnly` 单位的独立高清立绘，接入 WebGL 战斗与二维回退；为全部 45 个兵种建立同 ID 的独立攻击贴图和特效参数。低阶到高阶按五级递增主体尺寸、发光、拖尾和命中粒子。战斗立绘保持方图等比例，攻击过程不压扁；稀疏编队缩小角色并提高画布精度，满编三线四列以轻微前后错位给角色留空间。头顶徽标改为细红血线，人数放在右侧小字；读取立绘不透明上沿后把血线放在头顶约 6 CSS px 处，色彩空间校正后不再呈浅粉。未修改伤害、出手顺序、奖励、随机数、`rts_save` 字段或战斗结算。
- 日夜界面通过「更多」及设置手动切换，独立键 `idle_empire_visual_theme` 记忆选择；夜间降低地图与战场背景亮度，Android 原生系统栏随主题变色。日间默认保留。
- 最终 APK 构建前，共享工作区另一改动在 `math.js`、`garrison.js` 将非有限战斗速度归一化。此项不属于本次视觉修改，未被覆盖或回退；本报告的固定随机战斗对照按包含该改动的当前工作区运行。

## 美术交付

| 范围 | 当前证据 |
| --- | --- |
| 角色 | 45 个 `CFG.units` ID 各有同名 512×512 透明 PNG 与 1254×1254 母图；其中 35 个可训练、26 个科技树节点、10 个敌方专属。另有 3 张通用立绘，总计 48 张。十张新增敌方图的四角 alpha 均为 0，轮廓无裁切。 |
| 主城 | 基础版与八个时代共九张独立 1024×525 场景；点击地标和文字入口保留。 |
| 战斗特效 | 九张由作图模型创作的透明高清母图、45 张兵种专属 PNG 和对应可编辑 SVG；每个兵种的主体、轨迹、色彩、命中形态及等级参数在 [配置](../../assets/art/vfx/unit-vfx-profiles.json) 中可查。 |
| 美术源 | 新敌方母图、[生成提示词](../../assets/art/source/generated/units/enemy-portrait-prompts.json)、[资源清单](../../assets/art/manifest.json)、[全角色画廊](../../hd2d-previews/portrait-gallery.html)、[特效画廊](../../hd2d-previews/qa-unit-vfx-gallery.png)。 |

[全角色预览图](../../hd2d-previews/portrait-gallery.png)展示全部 45 个配置角色；[野兽稀疏战斗](../../hd2d-previews/qa-sparse-enemy-beasts-390x844.png)、[野兽攻击](../../hd2d-previews/qa-attack-enemy-beasts-390x844.png)、[敌方混编满编](../../hd2d-previews/qa-full-enemy-390x844-12v12.png)、[宽体混编 320px](../../hd2d-previews/qa-wide-320x568-12v12.png)与[宽体混编 390px](../../hd2d-previews/qa-wide-390x844-12v12.png)为浏览器实拍截图。

[低阶步兵斩击](../../hd2d-previews/qa-vfx-infantry-travel.png)、[高阶机兵攻击](../../hd2d-previews/qa-vfx-star-travel.png)与[高阶机兵命中](../../hd2d-previews/qa-vfx-star-impact.png)为实际 WebGL 帧图。视觉特效以 `battleEpoch` 过滤旧事件；WebGL 失效时从当前战斗快照回到二维画面，二维回退也使用同一套 45 张兵种专属攻击贴图并按等级缩放。特效动画时长与现有命中回调对齐，仅影响表现。

[步兵日间细红血线](../../hd2d-previews/qa-red-health-bars-day-390.png)、[夜间细红血线](../../hd2d-previews/qa-red-health-bars-night-390.png)、[高阶机兵与野兽的头顶位置](../../hd2d-previews/qa-red-health-bars-star-beast-360.png)为用户反馈后重新拍摄的当前版本截图。

## 已通过的检查

| 命令 / 环境 | 结果 |
| --- | --- |
| `node assets/art/source/check.mjs` | 退出码 0；52 个角色动作图、45 个独立配置立绘、九时代主城、42 个建筑、五张旧 VFX、九张高清 VFX、45 张兵种特效、八个 GLB。 |
| `node assets/art/source/check-http.mjs` | 退出码 0；489 个被引用 URL 均返回 200。 |
| `node tests/visual/assets.js` | 退出码 0；按当前 CFG 逐 ID 检查立绘、源母图、图标与场景。 |
| `node tests/visual/browser_smoke.js` | 退出码 0；Edge/CDP **180/180** 项通过。覆盖 320/360/390/430 CSS px、手动夜间切换及刷新记忆、26 个科技立绘、九时代、敌方 10 张高清图、12 对 12 站位、320 与 390px 宽体混编的 24 槽、徽标无重叠、角色入镜、同排可见内容重叠不超过 30%、按实际不透明轮廓验证稀疏及 6 对 6 混编血线距头顶 2–12px、45 张 PNG 解码后内容唯一、45 兵种实际 WebGL 特效、五级装饰和主体大小递增、二维回退专属贴图、1/2/4 倍速、旧 `battleEpoch` 拒绝、固定随机序列的三维/二维战损奖励存档一致。 |
| `node hd2d-tests/renderer_browser.js` | 退出码 0；35 个可训练兵种特效映射、battleEpoch 与上下文丢失回退通过。 |
| `node tests/ie001/browser_interact.js` | 退出码 0；Edge/CDP 360×800 模拟视口 **29/29** 项通过。真实坐标点击「更多 → 设置与存档」、存档导入与保护/恢复路径通过。 |
| `node tests/ie001/run.js` | 退出码 0；96/96 个核心与存档测试通过。 |
| `git diff --check` | 退出码 0；只有既有文件行尾转换提示，无空白错误。 |
| Android `:app:assembleDebug` | 退出码 0；当前 APK SHA-256 `3F4D0A31CF1BA7DC574D73BCA0AAF7AD7569CF7D46605E5C54AC0D48AEC2DDE4`，530 个运行资源与工作区逐文件一致，含 45 张兵种特效、九张高清母图，无 `INTERNET` 权限。[最终构建报告](../../android/BUILD_VALIDATION-2026-09-26-final.md)列明核对方法。 |

以上 Edge/CSS 视口检查是桌面浏览器仿真；资源静态检查也不能代替 Android 渲染。[最终 Android 35 模拟器复验](../../android/validation/emulator-android35-offline-final-3f4d-20260926/README.md)对应上表同一 SHA-256 APK：关闭网络后连续前台运行 **10 分 23.603 秒**，实测 360px 稀疏战斗的深红血线、360/412px 满编 12 对 12、日夜系统栏、45 张攻击贴图、视觉 fixture 的 WebGL 丢失回退和强停重启后的主题与原存档保持。该复验中的倍速攻击及上下文丢失是视觉 fixture，未代替真实战斗结算。**物理 Android 手机离线十分钟、触控手感、发热与稳定 30 fps 尚未运行**：当前 ADB 没有物理手机，用户暂时无法提供。此项是本任务的剩余验收，不计为通过。

极端的 360px 六对六大型野兽混编样板中，血线都贴近各自头顶，但少数立绘仍会相互遮挡或贴到边缘；本次血线验收不把这一画面算作站位完全解决。满编 12 对 12 的独立槽位和无血条碰撞已单独验证。后续需要针对中等规模、大体型混编再调整角色缩放与排布。

## 存档与回退

本次新增文件和视觉接线不改变 `S/B` 权威状态或 `rts_save` 结构；业务脚本 `config.js → levels.js → sprites.js → math.js → garrison.js → technology.js → ui.js` 顺序保留。视觉层失效时从当前战斗快照切到二维 DOM，不重新开战。回退前从设置导出存档；恢复旧视觉版本时保留本次之前的工作区改动，不执行全仓库 reset。Android WebViewAssetLoader 与旧版 `file://` 存档属于不同 origin，跨容器需手动导出导入。
