# HD-2D 视觉层与日夜界面

## 本地运行

在仓库根目录运行 `node tools/serve-local.js 8000`，再访问 `http://127.0.0.1:8000/`。WebGL 贴图按同源 HTTP 加载；直接用 `file://` 打开时会自动使用原有二维地图和战斗画面。静态服务只用于桌面开发；游戏运行不需要服务器或账号。

Android 离线容器见 [`android/README.md`](../../android/README.md)。设备上的游戏地址是 WebViewAssetLoader 映射的本地 HTTPS 域名；桌面浏览器与 Android WebView 的 `localStorage` 来源不同，旧档需在游戏设置中手动导出再导入。

## 分层

- `config.js → levels.js → sprites.js → math.js → garrison.js → technology.js → ui.js` 的业务脚本顺序保留。`assets/hd2d/three.min.js` 和 `hd2d.js` 先加载，提供可选的只读渲染层。
- 主城渲染器读取建筑等级与施工状态、人口岗位及驻军状态快照。地标的点击回调只导航至已有页面或定位已有操作。
- 战斗渲染器读取 `B` 的快照和携带 `battleEpoch` 的表现事件。伤害、随机数、行动计时、奖励、结算及存档仍由原逻辑负责。
- WebGL 初始化失败或上下文丢失时，移除渲染画布，立即显示当前战斗的二维 DOM 画面；不会重新开战。下一场战斗可以重新尝试 WebGL。

## 美术与布局

日间与夜间 UI 覆盖层在 `visual.css`。在「更多」或设置页手动切换；选择以独立键 `idle_empire_visual_theme` 保存在本机，默认日间，不写入 `rts_save`。夜间模式同步 Android 状态栏与导航栏背景。主城地图默认高 200 CSS px，地图下方保留文字快捷入口；展开地图支持有限平移与缩放。建筑页先列可处理项，完整费用与门槛在每张卡的详情内；科技页先列可执行和接近解锁的研究，完整图谱按类别展开。

原创 PNG、可编辑源、贴图集、GLB、资源 ID 清单与生成步骤见 [`assets/art/README.md`](../../assets/art/README.md)。全部 45 个配置角色，包括 10 个敌方专属角色，各有同 ID 的 512px 透明立绘；[全角色画廊](../../hd2d-previews/portrait-gallery.html)便于逐张检查。45 个兵种各有同 ID 的攻击贴图、独立作图母图和[七项特效配置](../../assets/art/vfx/unit-vfx-profiles.json)；五级强度控制尺寸、发光、拖尾数与命中粒子。[最后九张 64px 浅深色审核图](../../hd2d-previews/qa-vfx-final-nine-runtime-64.png)可检查最高阶兵种。步兵、星际兵、弓兵、弩兵、初阶骑兵和金甲骑兵已接入攻击、受击、倒地各四帧的高清动作样板；密集编队选用每帧 256px 的紧凑图集，稀疏编队保持 512px，[动作图集与元数据](../../assets/art/units/hires/actions/manifest.json)保留可编辑母图及打包脚本。其余高清角色仍以位移、缩放和闪色表现动作，32px 角色保留独立四帧动作图。

少编队缩小角色并提高画布像素比，4–6 团采用每侧两列三层，满编采用每侧前中后三排、每排四列错位摆放；满编的纵向六条扫描线已重新等距排布，以减少同排遮挡。人数在 3px 饱和深红 `#c00019` 血线右侧小字显示；渲染器读取立绘不透明像素的上沿，包括满编在内，以约 2.5 CSS px 的目标距离贴近可见轮廓。步兵举剑、弓兵抬弓及两种骑兵举枪帧另设头部锚点，血线不会随武器升高。当前实拍见[稀疏](../../hd2d-previews/qa-crimson-close-sparse-390-20260927.png)、[六对六](../../hd2d-previews/qa-crimson-close-medium-360-20260927.png)、[满编前后对照 320px](../../hd2d-previews/qa-full-spacing-before-after-320-20260927.png)、[骑兵攻击](../../hd2d-previews/qa-cavalry-actions-sparse-390-20260927.png)与[夜间满编](../../hd2d-previews/qa-battle-night-full-390-20260927.png)。夜间模式使用独立的蓝紫色战场背景，WebGL 场景和二维回退同步切换，立绘与按钮不套用模糊滤镜。九时代主城保留原创全景，在六处地标加入轻微浮雕视差和状态角色；它仍是 2.5D 表现。独立[基础时代三维主城样板](../../hd2d-previews/qa-town-base-200px-original-old-new.png)尚未达到全景的院落和地形细节，没有替换运行中的全景。`hd2d.js` 以 30 fps 为上限，允许 1ms 的垂直同步时钟抖动，避免 60Hz 屏幕上的第二次刷新刚好低于 33.33ms 而多跳一帧；持续慢帧时逐步降低画布像素比，战斗最低保留 1 CSS 像素的画布精度；文字及按钮始终由 DOM 绘制。

## 验证与回退

```sh
node tests/ie001/run.js
node tests/visual/assets.js
node tests/visual/browser_smoke.js
node hd2d-tests/renderer_browser.js
node assets/art/source/check.mjs
node assets/art/source/check-http.mjs
python assets/art/source/generated/units/actions/pack.py --check
```

`tests/visual/browser_smoke.js` 覆盖 320、360、390、430 CSS px、日夜切换与刷新记忆、头顶血线距实际立绘上沿约 0.8–3.2 CSS px、满编与宽体混编站位、256px 密集动作贴图、45 个兵种的特效贴图、五级尺寸与装饰递增、二维回退专属贴图、1/2/4 倍速、`file://` 与 WebGL 上下文丢失后的二维回退。`hd2d-tests/renderer_browser.js` 验证六兵种高清四帧动作、骑兵头部锚点与旧战斗事件接线。`tests/ie001/browser_interact.js` 真实坐标点击次级设置入口并覆盖导入与保护流程。Android Debug APK 构建及资源核对记录在 `android/` 下；Android 模拟器离线补验单独记录。手机真机离线十分钟、触控手感和稳定 30 fps 仍需连接目标设备后验证。

视觉层的回退方式是移除 `visual.css`、`hd2d.js` 与 Three.js 的引用，并恢复 `index.html`、`ui.js`、`math.js` 的本次视觉接线；无需迁移或修改 `rts_save`。回退前建议照常从设置导出存档。
