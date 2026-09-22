# 章节 A：包体架构与代码保护链（逆向过程记录）

> 本章全部为本次分析实测事实，证据路径均可复核。

## A1. 基本身份

| 项 | 值 | 证据 |
|---|---|---|
| 游戏名 | **《放置时代》** | `deob_main.js` @1230894：登录屏 `createElement('div',{className:'title'},"放置时代")` |
| 包名 | `com.qihuan.fanzhigame` | AndroidManifest（UTF-16 串池）|
| 版本 | versionName `1.0.210`（文件名 210 = 版本尾号）| `210(1)_unpacked\AndroidManifest.xml` |
| 引擎 | Cordova WebView（org.apache.cordova + 自定义插件 com.qihuan.fanzhigame.myplugin 1.0.0）| `assets\www\cordova_plugins.js` |
| 前端栈 | **React（react-dom.production）+ jQuery 3.7.1 + GSAP 3.12.5 + howler.js 2.2.4 + CryptoJS**，webpack 单包 | `assets\www\static\js\main.cb259.js.LICENSE.txt` |
| 签名 | 仅 v2/v3（META-INF 无 SF/RSA）→ 现代构建管线 | `210(1)_unpacked\META-INF\`（35 文件，全是 androidx/kotlinx .version 元数据）|
| 权限 | INTERNET / RECORD_AUDIO / MODIFY_AUDIO_SETTINGS / ACCESS_NETWORK_STATE / ACCESS_WIFI_STATE | Manifest 串池（RECORD_AUDIO 为 cordova-plugin-media 声明性需求，游戏无录音功能文案）|

## A2. 「远程加载壳」真相：离线单机的保护壳

初看 `main.cb259.js`（491 B）像是"远程热更壳"——deviceready 后调原生 `MyPlugin.loadRemoteData("main")`，把返回值当 JS 注入 `<head>`。本次逆向证明**它实际是本地解密壳**：

**解密链（全部硬编码，无服务端参与）**：

```
assets/www/static/js/introduce.325a5.mp4   (4,444,056 B，伪装成开场视频的 Base64 文本)
   │  Base64 解码（插件内 base64Decode，文件头非 ftyp box、熵恰为 6.0 bit/B 的纯 Base64 字符集、"==" 收尾）
   ▼
AES 密文 3,333,040 B（熵 7.9999，16 的整数倍）
   │  MyPlugin.decryptFile()：AES/ECB/PKCS5Padding
   │  密钥 = Base64 硬编码常量 "c+5RzK0m9a1w6ejFasdq8w=="（解码 16 字节：73 EE 51 CC AD 26 F5 AD 70 E9 E8 C5 6A C7 6A F3）
   │  证据：classes.dex MyPlugin.decryptFile@0x1DD040 const "c+5RzK0m9a1w6ejFasdq8w==" / "AES" / "AES/ECB/PKCS5Padding"
   ▼
明文 JS 3,333,037 B（PKCS7 去填充 -3）
   │  前置拼接 `window['platform']='android';`（MyPlugin.loadRemoteData@0x1DD194 const）
   ▼
javascript-obfuscator 混淆态 → 本次用 vm 沙箱离线还原字符串表（6675/6675 处解码，0 失败）
   ▼
_analysis/deob_main.js（3.0 MB 可分析明文）
```

- 混淆层：javascript-obfuscator（控制流平坦化的字符串数组自旋转 + 6675 个字符串引用 + 16 进制数字改写 + `Math["floor"]` 式属性访问）。字符串数组**无二次加密**（解码器为纯索引查表），故完全可离线还原。
- `com.qihuan.fanzhigame.AES` 类（SHA-256 派生 / AES-CBC-PKCS7）**未被主解密链使用**——插件实际走 ECB + 硬编码 key；AES.java 属备用/历史代码（推断，依据：loadRemoteData/decryptFile 只引用 ECB 串）。
- **修正（解密 JS 复核后）**：dex 串池零命中成立，但**解密后的 JS 里存在真实服务器**：`"http://8.217.79.174/fangzhi/"` 字面量 ×2（@1215374、@1402780，逐字亲验）+ `myTime.php` ×5（@1404464 离线结算取服务器 timestamp 防改表、@1416824 校时）。即：**玩法逻辑 100% 本地，但非零请求**——用途限于①时间校准（离线收益/每日上限防改机）②战斗代理发现的加载器热更通道【推断：@1215300 邻域为远程数据装载点，是否热覆盖内联基表未运行时实证】。断网仍可玩（时间校验有本地兜底），但离线结算时长以服务器时间为准。
- **定性修正**：不是"零请求纯离线"，而是"**本地演算 + 轻量 HTTP 校时**"的准离线单机。Umeng 统计、TapTap 跳转不变。

## A3. 原生桥能力面（dex 常量实证）

`MyPlugin` 暴露给 JS 的方法（MyPlugin <init>@0x1DCEF0 注册串）：`getTime`（服务器时间校验防改机【推断】）、`apkVersion`（按 `\.` 拆分版本，"版本落后,请更新"文案对应）、`IAP`（内购，"no support" 兜底=渠道分支）、`initUmeng`（友盟统计）、`coolMethod`、`loadRemoteData`。
`MyPlugin.clone`@0x1DD23C 含 `android_id`/`show`——设备标识与弹窗。CDK `TapTap001` 等表明存在 **TapTap 渠道包**（"taptap和app不互通"文案：两套渠道存档隔离）。

## A4. 反作弊与"保护壳"评价

- 保护设计意图：Base64→AES→改名 .mp4→JS 混淆 四层，防的是"拆包即得源码"，成本极低（单密钥硬编码在 dex，无白盒/无白名单校验/无服务端参与）。
- 实际效果：本地存档明文 JSON（见 §存档），无联网校验——**修改包体或改 localStorage 即可作弊**；游戏内甚至内置"秒杀"（"怪物数据超出记录，无法秒杀"是反滥用提示而非校验）。
- 商用合规痕迹：PrivacyPolicyActivity（隐私合规弹窗）、Umeng、兑换码/Q群客服（QQ 1076403700 硬编码）——独立开发者/小团队发行形态（推断）。

## A5. 本次逆向产物清单（全部本地操作，原 APK SHA256 未变）

| 产物 | 说明 |
|---|---|
| `210(1)_unpacked\game_main.decrypted.js` | AES 解密 + 去混淆前置的原始混淆 JS（3.33 MB）|
| `_analysis\deob.js` | 反混淆管线（vm 沙箱仅执行字符串数组/解码器/旋转自检，游戏代码零执行）|
| `_analysis\deob_main.js` | 全量反混淆明文（3.0 MB，本报告主分析对象）|
| `_analysis\deob_main_strings.json` | 6675 条解码字符串表 |
| `_analysis\cn_strings.txt` | 2706 条唯一中文串（词频降序）|
| `css-analysis\CSS逆向分析报告.md` | UI 层逆向（3002 规则/130 界面 ID/实体 ID 池）|
