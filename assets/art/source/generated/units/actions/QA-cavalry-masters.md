# 骑兵动作母图与生产图集审查（2026-09-27）

## 当前生产状态

`cavalry_t1`、`gold_cavalry` 的 attack / hit / death 已各有 4×512
（2048×512）和 4×256（1024×256）RGBA 图集，共 12 张 PNG。第 0 帧
与各自 512px 原待机图逐像素相同；紧凑版第 0 帧是该待机图的最近邻
256px 缩图。两处图集帧界 x=512/1024/1536 与 x=256/512/768 不串色，
后 3 帧均与原待机图共用脚底基线。`hd2d.js` 的 `hiresActionTypes` 已列入
两种骑兵，密集阵型（`state.density>=7`）选用 `compact/` 图集。清单为
`manifest.json` v4，`runtimeUnits` 为全部六个当前已接入兵种；清单不在
运行时读取。

| 骑兵 | 攻击主帧高度 / 待机 | 姿态排版与透明间隔 | 64px 结果 |
| --- | ---: | --- | --- |
| `cavalry_t1` | 499 / 502px = 99.4% | 攻击母图第 2 姿态原向左越格 27px；生产排版母图每格四周至少 35px 真透明 | 蓝银甲、鸢尾盾、蓝白枪旗、白鼻白蹄棕马和枪尖均清楚 |
| `gold_cavalry` | 496 / 505px = 98.2% | 攻击母图第 2 姿态原距右格线仅 2px；生产排版母图每格四周至少 35px 真透明 | 金甲、金色面甲、青绿枪旗和突刺枪尖均清楚 |

`layout_cavalry.py` 从四张原 ImageGen 母图创建精确 2172×724 三等宽格的
`*-master-layout.png`；保留原 `*-master.png` 和 v1–v4 版本。为腾出 35px
透明边距，整姿态的排版比例在 0.940–1.000（attack）及 0.949–1.000
（death）之间；仅排版缩放与平移，不裁掉任何 alpha>8 的马、骑士、枪尖或
旗帜。hit 母图本来已有足够的名义格线间隔，直接打包。打包后的攻击帧
维持与待机相近的身高；倒地末帧变矮是动作本身。

可编辑生成母图和提示词在本目录；量化排版见 `cavalry-layout-audit.json`。
完整图集位于 `assets/art/units/hires/actions/<id>-<action>.png`，紧凑版在
`assets/art/units/hires/actions/compact/<id>-<action>.png`。移动端 64px
对照预览为 `hd2d-previews/qa-cavalry-compact-64.png`；六组四帧预览为
`hd2d-previews/qa-cavalry-production-64.png`。64px 目视审查通过；真机
帧率与血线、人物相对位置由运行层另行验收，不能由静态 PNG 证明。

作者侧验证命令：

```text
python assets/art/source/generated/units/actions/layout_cavalry.py --check
python assets/art/source/generated/units/actions/pack.py --check
```

两条命令退出码均为 0。新增前已有的 12 张非骑兵 4×512 图集 SHA256
逐张比对后不变。`rts_save` 与战斗数值未被本素材批次修改。需要回退素材时，
移除两骑兵运行名单并沿用高清待机图；已有第 0 帧和原待机图一致。

## 历史候选审查记录（生产版已修复下述格线问题）

以下记录当时的源图候选状态；如今生产版由上述 `layout_cavalry.py` 与 `pack.py` 打包。原始生成提示词在 `PROMPTS-cavalry-pair.md`；ImageGen PNG 本身未修改。`pack_candidates_cavalry.py` 仅在源目录 `candidates/` 生成当时的审查候选。

## 透明分格与尺度

初版六张母图均为 2172×724 RGBA；整张图四边和四角均无 alpha>8 像素。下表的 attack 两行记录已备份的 v1；hit/death 仍为当前母图。表中的间隔为左右姿态之间连续透明列的真实宽度。生成图虽有安全间隔，但部分姿态超出名义等宽格；审查候选用透明间隔中点裁开，不代表等宽格要求已满足。

| 母图 / 版本 | 两处透明间隔 | 越过名义格线的姿态 | 审查候选的主动作可见高度 / 原待机 | 结论 |
| --- | ---: | --- | ---: | --- |
| cavalry_t1 attack v1 | 130 / 16px | 第 2 姿态向第 3 格伸出 94px | 370 / 502 = 74% | 已由 v4 替换，原图保存在 `cavalry_t1-attack-master-v1.png` |
| cavalry_t1 hit | 202 / 187px | 无 | 491 / 502 = 98% | 可作为后续运行候选 |
| cavalry_t1 death | 81 / 67px | 第 1 姿态向第 2 格伸出 15px | 第 2 姿态 411 / 502 = 82% | 建议修正第 1 格后再接入 |
| gold_cavalry attack v1 | 187 / 33px | 第 2 姿态向第 3 格伸出 86px | 353 / 505 = 70% | 已由 v3 替换，原图保存在 `gold_cavalry-attack-master-v1.png` |
| gold_cavalry hit | 148 / 133px | 无 | 493 / 505 = 98% | 可作为后续运行候选 |
| gold_cavalry death | 110 / 82px | 无 | 第 3 姿态 408 / 505 = 81% | 倒地变矮符合动作，可作为后续运行候选 |

历史候选中 `cavalry_t1 death` 第 1 姿态越格；生产版已通过等宽排版母图修正。

### 原始攻击母图（历史生成版本）

| 母图 | 源尺寸 | 两处透明间隔 | 中间姿态压入 512 后可见高度 / idle | 名义等宽格 |
| --- | ---: | ---: | ---: | --- |
| cavalry_t1 attack v4 | 2167×725 | 76 / 205px | 489 / 502 = 97.4% | 中间姿态向第二格左界伸出 27px；与第一姿态之间仍有 76px 全透明间隔 |
| gold_cavalry attack v3 | 2172×724 | 180 / 99px | 475 / 505 = 94.1% | 三姿态各在本格内 |

两张 `*-attack-master.png` 是 ImageGen 新母图的原样复制，完整提示词和中间轮次见 `PROMPTS-cavalry-attacks-revisions.md`。普通骑兵 v4 的严格名义等宽格偏移已由生产版排版母图修正。此表只记录原始生成图。

## 形象与 64px 可读性

对照原 512px 待机立绘逐张查看：普通骑兵保留蓝银盔甲、蓝白羽饰、鸢尾圆盾、枪旗以及白鼻白蹄的棕马；金甲骑兵保留金甲、金盔青白羽饰、金发、青绿披饰、枪旗和金色马面甲。六组姿态均朝右，骑士与坐骑身份没有明显漂移；金甲骑兵倒地末姿态的骑士与马分离，但两者仍可辨认。武器未被源图外边裁切。

历史 64px 源图预览：`hd2d-previews/qa-cavalry-masters-64.png`；候选预览：`hd2d-previews/qa-cavalry-candidates-64.png`。生产版请看上方 `qa-cavalry-production-64.png` 与 `qa-cavalry-compact-64.png`。

六张审查候选均为 2048×512 RGBA，第 0 帧与原待机 PNG 逐字节相同，生成的 18 个动作帧保留至少 8px 左右透明边距。`candidates/cavalry-candidate-audit.json` 记录每帧裁切、缩放、透明间隔及等宽格越界量，并标记 `runtimeEnabled=false`。

## 血线定位提示

骑枪和羽饰常高于骑士头盔；尤其两张 attack 的待机及抬枪帧，按全图 alpha 顶端放血线会远离面部。运行层已接入骑兵动作，需通过浏览器和 Android 截图确认血线锚点与骑士头部关系；本静态素材审查不证明该项验收。
