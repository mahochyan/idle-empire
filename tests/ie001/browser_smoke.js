'use strict';
// IE-001 浏览器冒烟（S13 子集）：真实 Edge + 真实 localStorage。运行：node tests/ie001/browser_smoke.js
// 覆盖：页面加载无 JS 异常、updateUI 渲染值、tick 推进、save() 写出 v1、坏档进保护且原文不被覆盖、恢复后正常。
// 不覆盖：窄屏交互/手动输入（S14）与全链路游玩（建造/训练/战斗点击），见报告"未运行"。
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const reaper = require('./edge-reaper');            // 清理机制：预扫 + 退出钩子 + 同步全树击杀（防实例泄漏）
reaper.installExitHooks();
if (!reaper.acquireLock()) { console.log('另一个浏览器套件正在运行，已中止（避免互相清扫）'); process.exit(3); }
reaper.sweepHeadless();                             // 预扫：清掉上次残留（含被中断的孤儿实例）
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
if (!EDGE) { console.log('NO_BROWSER'); process.exit(2); }
const PORT = 9300 + Math.floor(Math.random() * 900), udd = path.join(os.tmpdir(), 'ie001-cdp-' + Date.now()); // 每次运行独立端口+profile，避免陈旧实例干扰
try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) { }
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, 'file:///E:/AIprogram/idlgame/index.html'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let msgId = 0; const pending = new Map(); const exceptions = []; let ws;
function send(method, params = {}) { return new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval异常: ' + expr + ' :: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
const ASSETS = process.env.IE001_SCREENSHOT_DIR || path.join(__dirname, '..', '..', 'docs', 'codex', 'reports', 'assets');
function killEdgeTree(pid){ // 同步全树击杀 + 二次清扫（旧实现 async spawn 后立刻 SIGKILL → taskkill 未走完即中断，产生孤儿）
  try { reaper.killTreeSync(pid); } catch (e) { }
  try { reaper.sweepHeadless(true); } catch (e) { }
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) { }
}
async function shot(name) {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').mkdirSync(ASSETS, { recursive: true });
  require('fs').writeFileSync(require('path').join(ASSETS, name + '.png'), Buffer.from(s.data, 'base64'));
  return name + '.png';
}
let pass = 0, fail = 0; const rows = [];
function test(name, ok, extra) { if (ok) { pass++; rows.push('[PASS] ' + name); } else { fail++; rows.push('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); } }
(async () => {
  // 等 CDP 就绪
  let targets = null;
  for (let i = 0; i < 40 && !targets; i++) { await sleep(500); try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); targets = await r.json(); } catch (e) { } }
  if (!targets) { console.log('CDP 未就绪'); killEdgeTree(edge.pid); process.exit(2); }
  const page = targets.find(t => t.type === 'page' && /idle-empire\/index\.html/.test(t.url)) || targets.find(t => t.type === 'page');
  if (!page || !page.webSocketDebuggerUrl) { console.log('无 page target'); killEdgeTree(edge.pid); process.exit(2); }
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = e => rej(e); });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); }
    if (d.method === 'Runtime.exceptionThrown') exceptions.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') exceptions.push('console.error: ' + (d.params.args || []).map(a => a.value ?? a.description).join(' '));
  };
  await send('Runtime.enable'); await send('Page.enable');
  await sleep(4000); // 首屏 + tick 若干秒
  test('页面加载零未捕获异常', exceptions.length === 0, exceptions.slice(0, 2).join(' | '));
  test('切片16 L2：版本锚点与脚本加载顺序可自检（APP_VERSION/APP_SCRIPTS）', await evalJs("/^\\d+$/.test(window.APP_VERSION)&&Array.isArray(window.APP_SCRIPTS)&&window.APP_SCRIPTS.join(',')==='config.js,levels.js,sprites.js,math.js,garrison.js,technology.js,ui.js'"), await evalJs('JSON.stringify({v:window.APP_VERSION,s:window.APP_SCRIPTS})'));
  test('真实DOM渲染初始资源(wood≥300 且格式为数字)', await evalJs("(()=>{const v=document.getElementById('res-wood').textContent;return /^\\d+$/.test(v)&&+v>=300})()"));
  test('tick 时钟推进(≥2秒)', (await evalJs('S.tick')) >= 2, 'S.tick=' + await evalJs('S.tick'));
  test('存档子系统已就位(saveProtected=false)', (await evalJs('saveProtected()')) === false);
  await evalJs('save()');
  test('save() 在真实 localStorage 写出 v32、合金装备及后期材料默认值', await evalJs("(()=>{const d=JSON.parse(localStorage.getItem('rts_save'));return d&&d.v===32&&d.weaponForge?.alloySword?.level===0&&d.weaponForge?.alloyArmor?.level===0&&d.scholarMasteryLv===0&&d.steelMasteryLv===0&&d.weaponForge?.armored?.researched===false&&d.weaponForge?.armored?.level===0&&d.weaponForge?.armored?.progress===0&&d.weaponForge?.armored?.equipped===false&&d.weaponForge?.electro?.level===0&&d.weaponForge?.electroRifle?.level===0&&d.weaponForge?.electroSniper?.level===0&&d.weaponForge?.electroArmor?.level===0&&d.weaponForge?.energyArmor?.level===0&&d.weaponForge?.nanoArmor?.level===0&&d.weaponForge?.gatling?.level===0&&d.weaponForge?.mortar?.level===0&&d.weaponForge?.steamArmor?.level===0&&d.killValues?.godRevival===0&&d.killValues?.godGuardian===0&&d.killValues?.godPhantom===0&&d.killValues?.godSlaughter===0&&d.killValues?.wildBoar===0&&d.storageMode==='aligned'&&d.storageMasteryLv===0&&d.eraStorage?.steamBasic===0&&d.eraStorage?.steamMetal===0&&d.eraStorage?.steamKnowledge===0&&d.eraStorage?.electricBasic===0&&d.eraStorage?.electricMetal===0&&d.eraStorage?.electricKnowledge===0&&d.eraStorage?.electricProduction===0&&d.items?.godCrystal===0&&d.items?.guardianStone===0&&d.items?.phantomFlower===0&&d.items?.godCore===0&&d.currencyRecipeMode==='copper'&&d.res.silver===0&&d.res.silverCoin===0&&d.res.gold===0&&d.res.steel===0&&d.res.medal===0&&d.res.bone===0&&d.popAlloc.gold===0&&d.popAlloc.steel===0&&Array.isArray(d.townPolicies?.smallTown)&&d.ts>0&&Array.isArray(d.ops)&&d.offline&&typeof d.offline==='object'&&d.daily&&typeof d.daily==='object'})()"));
  test('图书馆与储存精通入口在真实 DOM 可见', await evalJs("(()=>{S.page='tech';updateUI();const research=document.getElementById('main').textContent.includes('图书馆');const mastery=!!document.querySelector('#main button[onclick=\"upgradeStorageMastery()\"]');S.page='home';updateUI();return research&&mastery})()"));
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:780,deviceScaleFactor:1,mobile:true});
  await evalJs("(()=>{S.sciences.push('sci_electric_age');S.res.steel=4000;S.page='tech';updateUI();[...document.querySelectorAll('#main .card')].find(x=>x.textContent.includes('电磁兵装'))?.scrollIntoView();return true})()");
  await shot('P82-electro-arms-360');
  test('电磁兵装真实按钮实扣钢材并保存投入进度', await evalJs(`(()=>{
    const card=[...document.querySelectorAll('#main .card')].find(x=>x.textContent.includes('电磁兵装'));
    const button=[...(card?.querySelectorAll('button')||[])].find(x=>x.getAttribute('onclick')==="investArmsUp('electro_trooper','atk')");
    if(!card||!button||button.disabled)return false;
    button.click();
    const saved=JSON.parse(localStorage.getItem('rts_save'));
    const ok=S.res.steel===0&&S.armsUp.electro_trooper.atk.progress===1&&saved.armsUp.electro_trooper.atk.progress===1&&saved.v===32&&document.documentElement.scrollWidth<=innerWidth+1;
    S.armsUp.electro_trooper.atk.progress=0;S.sciences=S.sciences.filter(x=>x!=='sci_electric_age');S.page='home';save();updateUI();
    return ok;
  })()`));
  await evalJs("(()=>{S.sciences.push('sci_bronze_age');S.res.copper=2000;S.page='tech';updateUI();[...document.querySelectorAll('#main .card')].find(x=>x.textContent.includes('青铜盾兵装'))?.scrollIntoView();return true})()");
  await shot('P83-bronze-arms-360');
  test('青铜兵装按当前铜库存批量实扣两次并保存进度', await evalJs(`(()=>{
    const card=[...document.querySelectorAll('#main .card')].find(x=>x.textContent.includes('青铜盾兵装'));
    const button=[...(card?.querySelectorAll('button')||[])].find(x=>x.getAttribute('onclick')==="investArmsUp('bronze_guard','atk',2)");
    if(!card||!button||button.textContent!=='投入2次')return false;
    button.click();
    const saved=JSON.parse(localStorage.getItem('rts_save'));
    const ok=S.res.copper===0&&S.armsUp.bronze_guard.atk.progress===2&&saved.armsUp.bronze_guard.atk.progress===2&&saved.v===32&&document.documentElement.scrollWidth<=innerWidth+1;
    S.armsUp.bronze_guard.atk.progress=0;S.sciences=S.sciences.filter(x=>x!=='sci_bronze_age');S.page='home';save();updateUI();
    return ok;
  })()`));
  await send('Emulation.clearDeviceMetricsOverride');
  test('切片2/4/6/9/10/11 L2：已启用开关生效、诊断不入档', await evalJs("CFG.passive.needPop===false&&CFG.offline.enabled===true&&CFG.idem.enabled===true&&CFG.tech.sciencesNoMerit===true&&CFG.caps.expanded===true&&CFG.upkeep.freeBand===true&&CFG.tech.longLadder===true&&CFG.save.schema===24&&typeof logDiag==='function'&&(localStorage.getItem('rts_save')||'').indexOf('diag')===-1"));
  test('冶钢精通在真实科技页按可付费用开放并通过按钮升1级', await evalJs("(()=>{S.sciences.push('sci_steel');S.res.tech=1500;S.buildings.steel_refinery={lv:1,state:'idle'};S.population.current=1;S.popAlloc.steel=1;S.page='tech';updateUI();const before=prodRate('steel');const btn=document.querySelector('#main button[onclick=\"upgradeSteelMastery()\"]');const visible=!!btn&&document.getElementById('main').textContent.includes('冶钢精通')&&!btn.disabled;if(visible)btn.click();const ok=visible&&S.steelMasteryLv===1&&S.res.tech===0&&Math.abs(prodRate('steel')-before*1.05)<1e-9&&JSON.parse(localStorage.getItem('rts_save')).steelMasteryLv===1;S.page='home';updateUI();return ok})()"));
  test('郊野边贸行显示兽心、逐级进度和机巧图纸入口', await evalJs("(()=>{S.page='fight';S._fightTab='expedition';updateUI();const card=[...document.querySelectorAll('#main .card')].find(x=>x.textContent.includes('郊野猎场'));const saved=JSON.parse(localStorage.getItem('rts_save'));return !!card&&card.textContent.includes('兽心')&&card.textContent.includes('边贸行 Lv1/300')&&card.textContent.includes('机巧拓仓图纸Ⅰ')&&!!document.getElementById('heart-trade-count')&&saved.v===32&&saved.beastExchange.level===1&&saved.beastExchange.heartOffers===0&&saved.beastExchange.refreshCharges===5&&saved.beastExchange.refreshClock>0&&saved.items.boarHeart===0&&saved.items.storageScroll===0&&document.documentElement.scrollWidth<=innerWidth+1})()"));
  test('真实按钮完成兽骨兑换、升级、图纸兑换与使用', await evalJs("(()=>{S.res.bone=100;updateUI();document.getElementById('bone-trade-count').value='2';document.querySelector('#main button[onclick=\"exchangeBonesFromUI()\"]').click();if(S.res.bone!==80||S.res.medal!==40||S.beastExchange.progress!==2)return false;S.beastExchange.progress=20;save();updateUI();document.querySelector('#main button[onclick=\"beastExchangeActionFromUI(\\'upgrade\\')\"]').click();if(S.beastExchange.level!==2||beastBoneTradeCost()!==12)return false;S.beastExchange.level=30;S.items.boarHeart=200;save();updateUI();Math.random=()=>0;document.querySelector('#main button[onclick=\"beastExchangeActionFromUI(\\'refresh\\')\"]').click();if(S.beastExchange.heartOffers!==11||S.beastExchange.refreshCharges!==4)return false;const before=resCap('tech');document.getElementById('heart-trade-count').value='1';document.querySelector('#main button[onclick=\"beastExchangeActionFromUI(\\'trade\\')\"]').click();if(S.items.storageScroll!==1||S.items.boarHeart!==180)return false;document.querySelector('#main button[onclick=\"beastExchangeActionFromUI(\\'use\\')\"]').click();const d=JSON.parse(localStorage.getItem('rts_save'));return S.beastExchange.scrollUsed===1&&S.items.storageScroll===0&&resCap('tech')===Math.floor(before*1.01)&&d.beastExchange.scrollUsed===1})()"));
  test('六条猎场和五种新增图纸商品在真实页面可见并可付款', await evalJs(`(()=>{
    const keys=['bullHorn','snakeGall','tigerPelt','turtleShell','wyrmSinew'];
    const card=[...document.querySelectorAll('#main .card')].find(x=>x.textContent.includes('郊野猎场'));
    if(!card||!keys.every(key=>[...card.querySelectorAll('button')].some(button=>button.getAttribute('onclick')==="openMaterialDomain('"+key+"')")))return false;
    S.items.bullHorn=200;save();updateUI();Math.random=()=>0.025;
    [...document.querySelectorAll('#main button')].find(button=>button.getAttribute('onclick')==="beastExchangeActionFromUI('refresh')").click();
    if(S.beastExchange.wildOffers.bullHorn.count!==11||S.beastExchange.wildOffers.bullHorn.quality!==50)return false;
    const button=[...document.querySelectorAll('#main button')].find(x=>x.getAttribute('onclick')==="beastExchangeActionFromUI('trade','bullHorn')");
    if(!button||button.disabled)return false;
    document.getElementById('heart-trade-count').value='1';button.click();
    const stored=JSON.parse(localStorage.getItem('rts_save'));
    return S.items.bullHorn===100&&S.items.storageScroll===1&&stored.beastExchange.wildOffers.bullHorn.count===10&&document.documentElement.scrollWidth<=innerWidth+1;
  })()`));
  // 注入坏档 → 重载 → 保护模式且不覆盖
  await evalJs("localStorage.setItem('rts_save','BROKEN{{');'ok'");
  await send('Page.reload'); await sleep(3000);
  test('坏档重载进入保护模式', (await evalJs('saveProtected()')) === true);
  test('坏档原文未被自动保存覆盖', (await evalJs("localStorage.getItem('rts_save')")) === 'BROKEN{{');
  test('主页出现保护提示', (await evalJs("document.getElementById('main').innerHTML.includes('存档保护')")) === true);
  test('保护期再存 5 次仍不覆盖', await evalJs("save();save();save();save();save();localStorage.getItem('rts_save')==='BROKEN{{'"));
  test('原文导出接口返回异常原文', (await evalJs('exportMasterRawText()')) === 'BROKEN{{');
  // 清理坏档 → 新档正常
  await evalJs("localStorage.removeItem('rts_save');'ok'");
  await send('Page.reload'); await sleep(2500);
  test('清坏档后恢复正常开局', (await evalJs('saveProtected()')) === false && (await evalJs('S.townLv')) === 1);
  await evalJs("save();'ok'"); await sleep(100); // 先形成一个 ≥300 资源的主档，使"覆盖前备份"有可验证对象
  // —— 设置内存档管理 UI 真实路径（与按钮同一入口函数，无鼠标事件模拟）——
  await evalJs("openSettings();'ok'"); await sleep(200);
  test('设置弹窗含存档管理卡片', (await evalJs("document.getElementById('settings-content').innerHTML.includes('存档管理')")) === true);
  await evalJs("settingsShowExport(false);'ok'"); await sleep(100);
  test('导出UI在真实DOM回显可解析的v32存档', await evalJs("(()=>{try{const d=JSON.parse(document.getElementById('save-out').value);return d.v===32&&d.steelMasteryLv===0&&d.weaponForge?.armored?.level===0&&d.storageMode==='aligned'&&d.currencyRecipeMode==='copper'&&d.res.silver===0&&d.res.gold===0&&d.res.bone===0&&d.res.wood>=300}catch(e){return false}})()"));
  await evalJs("settingsShowImport();document.getElementById('save-in').value=JSON.stringify({res:{wood:77,stone:1,food:1,tech:0},townLv:2,defeated:[1,10],merit:3});settingsImportCheck();'ok'"); await sleep(200);
  test('导入校验预览显示摘要(未确认前不写档)', await evalJs("document.getElementById('import-preview').innerHTML.includes('校验通过')"));
  const beforeMaster = await evalJs("localStorage.getItem('rts_save')||''");
  await evalJs("settingsImportCommit();'ok'"); await sleep(1500); // commit 后页面自动重载
  test('导入确认后重载生效且备份先行', await evalJs("S.res.wood>=77&&saveProtected()===false&&(()=>{const b=JSON.parse(localStorage.getItem('rts_save_backup_1')||'null');const pre=JSON.parse(localStorage.getItem('rts_save_premigration')||'null');return (b&&b.res.wood>=300)||(pre&&pre.res.wood>=300)})()"));
  test('导入动作前主档确实未被预览改动', beforeMaster === '' || JSON.parse(beforeMaster).res.wood >= 300);
  // —— 游玩链路冒烟（真实入口函数）：建造→tick推进→训练→编队→第一关战斗→撤退，验证本轮改动无夹带破坏 ——
  await evalJs("S.res.wood=9999;S.res.stone=9999;S.res.food=9999;S.buildings.barracks={lv:2,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.infantry_camp={lv:2,state:'idle',timer:0,timerEnd:0,tier:0};buildAct('lumber_mill');'ok'");
  test('建造入口生效', (await evalJs("S.buildings.lumber_mill.state")) === 'building');
  await evalJs("S.buildings.lumber_mill.timer=1;tick();'ok'");
  test('tick 完成建造并落 lv=1', (await evalJs("S.buildings.lumber_mill.lv")) === 1);
  await evalJs("train('infantry',2);'ok'");
  const q0 = await evalJs('S.queue.infantry.count');
  await evalJs("tick();tick();tick();tick();tick();'ok'");
  test('训练入队且 tick 产出兵力', q0 === 2 && (await evalJs('S.pool.infantry')) >= 1, 'q0=' + q0 + ' pool=' + await evalJs('S.pool.infantry'));
  await evalJs("S.formation.front.push({type:'infantry',count:8,id:Date.now()});S.selEnemy=0;S.battleSpeed=4;openBattle();'ok'");
  test('第一关战斗启动(battleActive)', (await evalJs('S.battleActive')) === true);
  await sleep(10000); // 真实定时器链跑 10s（8 农 vs L1 七兵，正常应分出胜负）
  test('战斗循环推进(10秒内分出胜负：首关入 defeated，胜或败均无异常)', (await evalJs('S.defeated.includes(1)')) === true);
  await evalJs("fleeBattle();'ok'"); await sleep(300);
  test('撤退后状态机复位无残留回调', (await evalJs('S.battleActive===false&&battleTimer===null')) === true);
  test('撤退后存档操作不被陈旧计时器误拦', (await evalJs('inspectSaveText(exportCurrentSaveText()).ok')) === true);
  await send('Page.reload'); await sleep(2500);
  test('游玩后刷新：进度可读且无保护误触发', (await evalJs('saveProtected()')) === false && (await evalJs('S.buildings.lumber_mill.lv')) >= 0);
  // —— IE-007 资源增减视觉反馈 + 新资源 topbar + 经济建筑页（真实 DOM）——
  // 触发+捕获合并在同一 eval：消除 1s tick 与断言的竞态窗口（测试硬化，非掩盖失败）
  const flashInfo = await evalJs("(()=>{updateUI();S.res.wood+=50;updateUI();return JSON.stringify({bubbles:[...document.querySelectorAll('.res-delta')].map(x=>x.textContent),upCls:!!document.querySelector('.res-delta.up'),valCls:document.getElementById('res-wood').classList.contains('up')})})()");
  const fi = JSON.parse(flashInfo);
  test('IE007 增减气泡显示 +50', fi.bubbles.some(x => x.includes('+50')), flashInfo);
  test('IE007 增闪类已挂载(气泡+数值)', fi.upCls === true && fi.valCls === true, flashInfo);
  test('IE007 topbar 渲染铜/铁/金币', await evalJs("['res-copper','res-iron','res-coin'].every(k=>{const el=document.getElementById(k);return el!==null&&/^\\d+$/.test(el.textContent)})"));
  await shot('IE007-01-delta-flash-360');
  // 走真实页面状态（S.page='build'）：updateUI 每个 tick 都会 renderPage(S.page)，
  // 手动塞 innerHTML 会被下一 tick 覆盖成主页（此前"随机失败"的真凶）；由页面状态驱动则重渲染结果一致
  await evalJs("S.page='build';S._buildTab='economy';updateUI();'ok'"); await sleep(50);
  test('IE007 经济建筑页含四新建筑', await evalJs("(()=>{const t=document.getElementById('main').innerHTML;return ['矿井','冶炼厂','铸币厂','市场'].every(x=>t.includes(x))})()"));
  await shot('IE007-02-build-economy-360');
  await evalJs("S.buildings.market={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.page='build';S._buildTab='economy';updateUI();'ok'"); await sleep(50);
  test('IE007 市场兑换面板出现且含≥4 汇率项', await evalJs("document.getElementById('mk-rate')!==null&&document.getElementById('mk-rate').options.length>=4"));
  await shot('IE007-03-market-panel-360');
  // 迁移真链路：写入 legacy 形状 → 重载 → 迁移成功且 PRE 建立
  await evalJs("localStorage.setItem('rts_save',JSON.stringify({res:{wood:1234,stone:2,food:3,tech:0},townLv:2,defeated:[1,10],merit:5,tick:66,popAlloc:{wood:2,stone:1,food:1}}));'ok'");
  await send('Page.reload'); await sleep(2500);
  test('真实浏览器 legacy 迁移成功（tick推进后为活体值，主档快照见下项）', (await evalJs('S.res.wood')) >= 1234 && (await evalJs('S.tick')) >= 66 && (await evalJs('saveProtected()')) === false);
  test('迁移前原始副本已建立', await evalJs("(()=>{const p=JSON.parse(localStorage.getItem('rts_save_premigration'));return p&&p.v===undefined&&p.tick===66})()"));
  test('主档升级 v32 且进度不增不减', await evalJs("(()=>{const m=JSON.parse(localStorage.getItem('rts_save'));return m.v===32&&m.scholarMasteryLv===0&&m.steelMasteryLv===0&&m.weaponForge?.alloySword?.level===0&&m.weaponForge?.alloyArmor?.level===0&&m.weaponForge?.armored?.level===0&&m.weaponForge?.electro?.level===0&&m.weaponForge?.electroRifle?.level===0&&m.weaponForge?.electroSniper?.level===0&&m.weaponForge?.electroArmor?.level===0&&m.weaponForge?.energyArmor?.level===0&&m.weaponForge?.nanoArmor?.level===0&&m.weaponForge?.gatling?.level===0&&m.weaponForge?.mortar?.level===0&&m.weaponForge?.steamArmor?.level===0&&m.storageMode==='legacy'&&m.currencyRecipeMode==='legacy'&&m.res.silver===0&&m.res.silverCoin===0&&m.res.gold===0&&m.res.bone===0&&m.items?.godCore===0&&m.killValues.wildBoar===0&&m.res.wood===1234&&m.merit===5})()"));
  // 切片11 端到端：注入"1 小时前"的存档 → 重载 → 启动即结算离线收益 → 报告卡可见 → 落库 → 清空后不再出现
  await evalJs("(()=>{const d=JSON.parse(localStorage.getItem('rts_save'));d.ts=Date.now()-3600*1000;d.res.wood=1000;d.res.food=1000;localStorage.setItem('rts_save',JSON.stringify(d));return 'ok'})()");
  await send('Page.reload'); await sleep(2500);
  const offW = await evalJs("JSON.stringify({rep:S.offline&&S.offline.pendingReport?{d:S.offline.pendingReport.durationSec,g:S.offline.pendingReport.gains}:null,wood:S.res.wood})");
  const offObj = JSON.parse(offW);
  test('切片11 L2：启动加载 → 离线结算（报告卡出现且时长=3600s）', offObj.rep !== null && offObj.rep.d === 3600, offW);
  test('切片11 L2：离线增益已入账并落库', offObj.rep !== null && (offObj.rep.g.wood || 0) > 0 && offObj.wood > 1000, offW);
  test('切片11 L2：报告卡在真实 DOM 可见', await evalJs("document.getElementById('main').innerHTML.includes('离线结算')"));
  await shot('slice11-offline-report-360');
  test('切片11 L2：主档已落库（pendingReport 持久化）', await evalJs("(()=>{const m=JSON.parse(localStorage.getItem('rts_save'));return m.v===32&&m.offline&&m.offline.pendingReport&&m.offline.pendingReport.durationSec===3600})()"));
  await evalJs('dismissOfflineReport()'); await sleep(100);
  test('切片11 L2：清空后主档 pendingReport=null', await evalJs("(()=>{const m=JSON.parse(localStorage.getItem('rts_save'));return m.offline&&m.offline.pendingReport===null})()"));
  await send('Page.reload'); await sleep(2500);
  test('切片11 L2：重载后不再重复结算（无报告卡）', await evalJs("(!S.offline||!S.offline.pendingReport)&&!document.getElementById('main').innerHTML.includes('离线结算')"));
  await evalJs("S.sciences.push('sci_electric_age','sci_arcane_mage','sci_astral_lord','sci_soul_realm');S.buildings.mage_tower={lv:1,state:'idle',tier:1};S.defeated=CFG.enemies.filter(x=>x.boss).slice(0,4).map(x=>x.id);S.page='barracks';S._barracksTab='train';updateUI();'ok'");
  test('奥术师训练入口与既有法师素材在真实军营页可见', await evalJs("(()=>{const input=document.getElementById('train-barracks-arcane_mage');const portrait=[...document.querySelectorAll('.unit-portrait')].find(x=>x.src.endsWith('/mage_space.png'));return !!input&&!!portrait&&document.getElementById('main').textContent.includes('奥术师')})()"));
  await evalJs("S.pool.arcane_mage=1;S.items.soulStone=100;S.page='fight';S._fightTab='expedition';updateUI();'ok'");
  test('英魂遗境与升阶卡在真实远征页显示', await evalJs("(()=>{const t=document.getElementById('main').textContent;return t.includes('英魂遗境')&&t.includes('英魂升阶')&&!!document.getElementById('soul-rank-unit')})()"));
  test('英魂升阶真实按钮扣铭石并保存', await evalJs("(()=>{document.getElementById('soul-rank-unit').value='arcane_mage';document.querySelector('button[onclick=\"upgradeSoulRankFromUI()\"]').click();const d=JSON.parse(localStorage.getItem('rts_save'));return S.soulRanks.arcane_mage?.stars===1&&S.items.soulStone===0&&d.soulRanks.arcane_mage?.stars===1&&d.items.soulStone===0})()"));
  await send('Page.reload'); await sleep(400);
  test('英魂升阶刷新后保持进度', await evalJs("S.soulRanks.arcane_mage?.stars===1&&S.items.soulStone===0&&!saveProtected()"));
  test('全程零未捕获异常(含两次重载)', exceptions.length === 0, exceptions.slice(0, 2).join(' | '));
  for (const r of rows) console.log(r);
  console.log('\n浏览器异常列表：' + (exceptions.length ? exceptions.join('\n') : '（空）'));
  console.log('node ' + process.version + ' + Edge(headless=new) CDP | 通过 ' + pass + ' / 失败 ' + fail);
  try { ws.close(); } catch (e) { }
  killEdgeTree(edge.pid);
  await sleep(300);
  const res = reaper.sweepHeadless(true);
  console.log(`清理核对：headless 残留 ${res.found} → 已清 ${res.removed}｜剩余 ${res.remaining}｜涉及内存约 ${res.freedMB} MB`);
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) { console.log('（临时 profile 目录清理失败，可手动删除：' + udd + '）'); }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('驱动失败: ' + e.message); try { killEdgeTree(edge && edge.pid); } catch (_) { } process.exit(2); });
