# P394｜未来时间戳误拦截净化剂交易

2026-09-30，基线 `master` / `e9755b245678ad76c2e974cc6563b7fe4847f64a`。P393 真实实付档的 `ops` 中，净化剂兑换和晶域使用记录时间为 `1794055913000`；后续独立读档推进至 `1790777338000`。现行 `idemSeen()` 只判断 `now - t < 5000`，导致远未来记录也被当作窗口内的重复操作。真实 `exchangeDomainCleanser(1)` 和 `useDomainCleanser('godCrystal')` 均返回 `repeat:true`，既不扣费也不执行，阻断晶核材料回流。

修复让幂等检查和旧记录清理都使用“时间距离小于窗口”的同一条件。远未来记录不会拦截当下动作，下一次成功标记会清除它；正常同窗双击、轻微时钟回拨时的重复调用仍被拦截。没有更改窗口长度、付款、存档字段或存档版本。直接修补动作入口之外的共用幂等函数，因而资源科技和其它使用该函数的动作也按相同时间口径处理。

[回归测试](../../tests/progression/idem_future_timestamp.js)只读 [P393 输入档](reports/data/p393-tier3-city-star10-prebattle-paid-save.json)，先核对文件 SHA-256 `df515a38dca073d7ff5fde1c235a48574b395041903b083f87d901c350380d51`，然后调用真实加载、兑换、使用、保存和重载路径。补丁前测试退出 1，因未来记录被误判；补丁后退出 0，真实支付 3 份血剂兑换 1 剂，晶域警戒 5000→4900，同窗再次使用不重复扣费，重载后记录和效果一致。P394 的[量子材料报告](quantum-material-p394.md)沿同一实付档重跑，五次净化和五场晶域材料战可继续付款、补兵与扩仓。

验证：`node --check math.js`、新增回归、`node tests/progression/permanent_domain_cleanser_exchange.js`（5／5）、`node tests/progression/domain_cleanser_market.js`（8／8）、`node tests/ie001/run.js`（96／96）、真实 Edge 的 `node tests/progression/permanent_domain_cleanser_exchange_browser.js`（10／10）及 `node tests/progression/domain_cleanser_browser.js`（19／19）均退出 0。测试未写真实玩家存档。新代码可读旧 `rts_save` v33，合法 `ops` 保留；修复仅使远未来记录不再阻断当下。代码回退可撤去共用幂等判断与回归，但旧错误会再次出现，不能当作功能开关。
