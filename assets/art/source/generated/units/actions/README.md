# 高清角色动作样板（2026-09-27）

这批运行格式素材覆盖 `infantry`、`infantry_t1`、`infantry_shield`、`star_trooper`、`archer`、`archer_t1`、
`archer_crossbow`、`mage_t1`、`iron_spearman`、`cavalry_t1` 和 `gold_cavalry` 十一个兵种，保留原有
`assets/art/units/hires/<id>.png` 待机立绘与所有资源 ID。三十三张母图由内置
ImageGen 参考原立绘生成，具有真正透明的背景；`pack.py` 从每张
三姿态母图中寻找透明分界，按原立绘脚底基线打包成 4×512 的水平 PNG。
每组第 0 帧与现有 512×512 待机 PNG **逐像素一致**，后 3 帧依次是
动作关键姿态。生成帧按各自兵种的原立绘可见身高缩放；武器和披风
允许伸出角色轮廓，但完整保留在帧内。

| 兵种 | 攻击 | 受击 | 倒地 |
| --- | --- | --- | --- |
| infantry | 举剑→挥击→收势 | 冲击→后仰→回防 | 失衡→跪地→卧倒 |
| infantry_t1 | 举短剑→前刺→收势 | 举盾受击→后仰→回防 | 失衡→跪地→卧倒 |
| infantry_shield | 持盾备战→低姿盾击→短剑反击 | 持盾受击→后仰→回防 | 失衡→跪地→侧卧 |
| star_trooper | 举枪→射击→后坐 | 受击→后退→回防 | 失衡→跪地→卧倒 |
| archer | 搭箭→拉弓→放箭 | 受击→后仰→回防 | 失衡→跪地→卧倒 |
| archer_t1 | 搭箭→满弓放箭→收势 | 身体受击→踉跄→回防 | 失衡→跪地→侧卧 |
| archer_crossbow | 抬弩→瞄准→回收 | 受击→后退→回防 | 失衡→跪地→卧倒 |
| mage_t1 | 举杖→施法→回收 | 受击→后退→回防 | 失衡→跪地→卧倒 |
| iron_spearman | 举枪→前刺→回防 | 持枪受击→后仰→回防 | 失衡→跪地→俯卧 |
| cavalry_t1 | 举枪→跃马突刺→收势 | 马身受击→失衡→回正 | 骑士失衡→马跪地→骑士卧倒 |
| gold_cavalry | 举枪→跃马突刺→收势 | 骑士受击→马身后仰→回正 | 骑士失衡→马跪地→骑士卧倒 |

生成提示以原待机 PNG 为 **形象及像素画风参考图**，要求右向、完整
全身、三等宽透明格、衣甲及武器一致、脚底基线一致、无场景文字边框。
具体差异在上表；倒地要求无血腥。`infantry_t1` 的 ImageGen 提示词与首版攻击母图透明分格失败记录在
`PROMPTS-infantry-t1.md`；`archer_t1` 的三套动作提示词与浏览器验证在
`PROMPTS-archer-t1.md`；`infantry_shield` 的新版动作与旧母图问题记录在
`PROMPTS-infantry-shield-v2.md`；早期两兵种完整提示词在
`PROMPTS-archer-electro.md` 和 `PROMPTS-shield-crossbow.md`，审查结果在
`QA-new-masters.md`。骑兵原始生成图与提示词在
`PROMPTS-cavalry-pair.md`、`PROMPTS-cavalry-attacks-revisions.md`；
`layout_cavalry.py` 把四张边距不足的骑兵母图重排为精确等宽格，原图保留。
`mage_t1` 和 `iron_spearman` 的母图、提示词及审核记录在各自同名子目录；
后者首张攻击候选因长枪跨格被弃用，保留原图供审查。
详见 `QA-cavalry-masters.md` 的当前生产状态。其他尚未打包的母图仍在源文件阶段。

```
python assets/art/source/generated/units/actions/pack.py
python assets/art/source/generated/units/actions/pack.py --check
python assets/art/source/generated/units/actions/layout_cavalry.py --check
```

打包依赖开发环境 Pillow；玩家运行不需要 Python。输出为
`assets/art/units/hires/actions/<id>-<action>.png`（2048×512、RGBA）
和 `assets/art/units/hires/actions/compact/<id>-<action>.png`
（1024×256、RGBA）及同目录 `manifest.json`。紧凑版逐帧以最近邻采样，
对应密集阵型的低显存选择；每张解码为约 1 MiB，高清原版约 4 MiB。
预览在 `hd2d-previews/qa-hires-actions-eleven-units.png`、
`qa-cavalry-production-64.png` 和 `qa-cavalry-compact-64.png`。
`archer_t1` 的 64px 三动作画面在 `hd2d-previews/qa-archer-t1-actions-64.png`。
`infantry_shield` 的对应画面在 `hd2d-previews/qa-infantry-shield-actions-64.png`。
打包脚本会拒绝母图之间
没有透明分界、帧溢出、脚底基线漂移、原待机帧变化或透明边距不足的情况。

**运行状态：** 十一种兵均列在 `hd2d.js` 的 `hiresActionTypes` 中，按固定路径
加载对应动作图集；`state.density>=7` 时选择 `compact/` 路径。
`manifest.json` v8 的 `runtimeUnits` 与该名单一致。运行时不读取清单；
浏览器和 Android 中的实际表现需由运行层验收。
`manifest.json` 是打包和审查元数据，运行代码不读取它。运行时根据
图像的宽高比识别 4 帧，按战斗事件的动作总时长平均切换。
`compactPath` 与 `compactFrameWidth` / `compactFrameHeight` 提供 256px
单帧版本的路径和尺寸；运行层需主动选择这些路径，清单本身不是开关。
清单里的 `suggestedFrameDurationMs` 只是后续调节动作节奏的建议，
当前运行时不使用；`runtimeSampleEnabled` 仅记录当前接入情况，不是
开关。缺图时高清待机图仍可回退显示。

**美术限制：** ImageGen 生成的是三张关键姿态，不是逐像素追踪的传统
手绘逐帧动画。装备微细节、脸部表情和武器长度在不同帧仍有轻微变化；
这是已接入运行层的可审查样板；53 类角色中仍有 42 类未补齐高清动作图。
仍需在 Android 浏览器和真机上检查帧速、方向、受击与倒地时机。
