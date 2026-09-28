# 六兵种动作母图审查（2026-09-27）

范围：`archer`、`electro_trooper`、`bronze_guard`、`silver_heavy`、`infantry_shield`、`archer_crossbow` 的 attack / hit / death，共 18 张三姿态透明母图。完整生成提示词保存在同目录的三个 `PROMPTS-*.md` 文件中。母图保持 ImageGen 原样；本报告与候选打包不改运行资源。

## 检查方法

- 逐张查看原尺寸图，以及 `hd2d-previews/qa-action-masters-64-6units.png` 的 64px 小图，比较原 `assets/art/units/hires/<id>.png` 的发色、衣甲、主武器及朝向。
- Pillow 核查 18 张 PNG 都是 RGBA，四角 alpha 为 0。扫描每个三分之一附近的透明列；下表数字是姿态之间连续透明间隔的像素宽度（门槛 8px）。
- `pack_candidates.py` 只为通过且较稳定的 `archer`、`archer_crossbow` 生成四帧 2048×512 审查图集到本目录 `candidates/`。每张第 0 帧与原 512×512 待机图逐字节相同，后续帧按原脚底线对齐。

| 兵种 | attack 两处间隔 | hit 两处间隔 | death 两处间隔 | 审查结果 |
| --- | ---: | ---: | ---: | --- |
| archer | 270 / 218 | 169 / 230 | 113 / 8 | 可做候选；death 第二间隔正好达到门槛，hit 首姿态头边有多余黄色火花 |
| electro_trooper | 123 / 0 | 19 / 60 | 143 / 56 | attack 的长枪与电弧跨入下一格，需重生该母图 |
| bronze_guard | 123 / 0 | 110 / 104 | 18 / 34 | attack 的长矛穿过分格，需重生该母图 |
| silver_heavy | 70 / 52 | 53 / 56 | 0 / 33 | death 的盾牌或身体连到前一格，需重生该母图 |
| infantry_shield | 45 / 0 | 48 / 74 | 45 / 0 | attack 的挥剑轨迹及 death 的盾牌跨格，需重生两张母图 |
| archer_crossbow | 62 / 62 | 31 / 50 | 44 / 32 | 六兵种中最稳定的一组，机械弩、钢盔、蓝金衣甲清楚 |

64px 下，六种兵的主武器与颜色均可辨认，朝向均指向画面右侧。候选图集仍需在实际战斗镜头中检验切帧节奏、血线与上举武器的距离。`archer`、`archer_crossbow` 已按候选逐像素一致的内容打包至 `assets/art/units/hires/actions/`；其余四种兵保留母图供修订，没有运行图集。`candidates/candidate-audit.json` 的 `runtimeEnabled=false` 只表示源目录候选本身不是游戏加载路径，运行资源以 `actions/manifest.json` 和 `hd2d.js` 白名单为准。

## 逐帧血线头部锚点

帧序号从 0 起，0 为原待机图。以每帧 512×512 原坐标比较 alpha 最高点与头盔 / 兜帽最高点：

| 兵种 | 动作 | 帧 | alpha topY | 头部 topY 建议 | 原因 |
| --- | --- | ---: | ---: | ---: | --- |
| archer | attack | 2 | 82 | 92 | 弓臂顶端高于兜帽约 10px，若按全体 alpha 最高点放血线会偏高 |

`archer` 其余帧的两者差距不超过约 5px；`archer_crossbow` 的弩低于头盔，alpha 最高点均来自头盔。`archer-hit` 帧 1 的多余黄色火花靠头右侧，未超过兜帽顶端，但仍建议后续重绘时移除。头部 topY 是视觉建议，运行层仍需依站位和缩放验证。
