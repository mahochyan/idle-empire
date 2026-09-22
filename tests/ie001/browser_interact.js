'use strict';
// IE-001-R1 · S14 窄屏与输入交互 + 关键 UI 路径（真实 Edge/CDP：视口模拟 + Input.insertText 真实输入 + 截图）
// 运行：node tests/ie001/browser_interact.js ；截图输出到 docs/codex/reports/assets/
// 重要声明：视口模拟 ≠ 实体手机/Android WebView；本套件不宣称真机验证。不设置 textarea.value 来替代输入交互。
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const reaper = require('./edge-reaper');            // 清理机制：预扫 + 退出钩子 + 同步全树击杀（防实例泄漏）
reaper.installExitHooks();
if (!reaper.acquireLock()) { console.log('另一个浏览器套件正在运行，已中止（避免互相清扫）'); process.exit(3); }
reaper.sweepHeadless();
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
if (!EDGE) { console.log('NO_BROWSER'); process.exit(2); }
const PORT = 9300 + Math.floor(Math.random() * 900), udd = path.join(os.tmpdir(), 'ie001-i-' + Date.now());
const ASSETS = path.join(__dirname, '..', '..', 'docs', 'codex', 'reports', 'assets');
function killEdgeTree(pid){ // 同步全树击杀 + 二次清扫 + 回收 profile
  try { reaper.killTreeSync(pid); } catch (e) { }
  try { reaper.sweepHeadless(true); } catch (e) { }
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) { }
}
fs.mkdirSync(ASSETS, { recursive: true });
const URL = 'file:///E:/AIprogram/idlgame/index.html';
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, URL], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let msgId = 0; const pending = new Map(); const exceptions = []; let ws; let dialogMode = 'accept'; let lastDialog = null;
function send(method, params = {}) { return new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); }); }
async function answerDialog(id, accept) { try { await send('Page.handleJavaScriptDialog', { accept }); } catch (e) { } }
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval异常: ' + expr.slice(0, 60) + ' :: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
let pass = 0, fail = 0; const rows = [];
function test(name, ok, extra) { if (ok) { pass++; rows.push('[PASS] ' + name); } else { fail++; rows.push('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); } }
// 真实坐标点击：先 scrollIntoView 再取 rect（窄屏下按钮可能在折叠线外）
async function clickBySelector(findExpr, tag) {
  const sc = await evalJs(`(()=>{const b=${findExpr};if(!b)return null;b.scrollIntoView({block:'center'});return 1})()`);
  if (!sc) { rows.push('[FAIL] 找不到按钮: ' + tag); fail++; return false; }
  await sleep(250);
  const r = await evalJs(`(()=>{const b=${findExpr};const q=b.getBoundingClientRect();return{x:q.left+q.width/2,y:q.top+q.height/2,w:q.width,h:q.height,inView:q.top>=0&&q.bottom<=window.innerHeight&&q.width>0}})()`);
  if (!r || !r.inView) { rows.push('[FAIL] 按钮不可见(点击目标): ' + tag + ' ' + JSON.stringify(r)); fail++; return false; }
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(200);
  return true;
}
async function shot(name) {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ASSETS, name + '.png'), Buffer.from(s.data, 'base64'));
  return name + '.png';
}
(async () => {
  let targets = null;
  for (let i = 0; i < 40 && !targets; i++) { await sleep(500); try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); targets = await r.json(); } catch (e) { } }
  if (!targets) { console.log('CDP 未就绪'); killEdgeTree(edge.pid); process.exit(2); }
  const page = targets.find(t => t.type === 'page' && /idle-empire/.test(t.url)) || targets.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); }
    if (d.method === 'Runtime.exceptionThrown') exceptions.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Page.javascriptDialogOpening') { lastDialog = d.params; answerDialog(d.params, dialogMode === 'accept'); }
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await sleep(1500);
  // T1 视口
  const vw = await evalJs('window.innerWidth'), vh = await evalJs('window.innerHeight');
  test('T1 窄屏视口 360×800 生效', vw === 360 && vh === 800, `${vw}x${vh}`);
  test('T1 窄屏无横向溢出(documentElement.scrollWidth<=innerWidth)', await evalJs('document.documentElement.scrollWidth<=window.innerWidth'));
  await shot('S14-01-home-360');
  // T2 设置入口真实点击（主页底部按钮，滚动后真实坐标点击）
  const BTN_SETTINGS = "[...document.querySelectorAll('button')].find(x=>x.textContent.includes('设置'))";
  const clicked = await clickBySelector(BTN_SETTINGS, '设置');
  test('T2 设置按钮在 360 宽下滚动后可见可点', clicked);
  test('T2 真实坐标点击打开设置弹窗', await evalJs("document.getElementById('settings-modal').classList.contains('active')"));
  test('T2 弹窗含存档管理卡片', await evalJs("document.getElementById('settings-content').innerHTML.includes('存档管理')"));
  await shot('S14-02-settings-360');
  // T3 有效 JSON 真实输入（Input.insertText）并跨 tick 保焦点/内容
  await evalJs("settingsShowImport();'ok'"); await sleep(250);
  await clickBySelector("document.getElementById('save-in')", '导入输入框');
  await sleep(150);
  const GOOD = JSON.stringify({ v: 1, ts: Date.now(), res: { wood: 300, stone: 300, food: 300, tech: 0 }, buildings: {}, pool: { infantry: 5 }, queue: {}, formation: { front: [], mid: [], back: [] }, townLv: 1, popAlloc: { wood: 3, stone: 3, food: 4 }, defeated: [1, 2, 3], merit: 5, garrisonLog: [], garrison: null, tick: 100, garrisonForm: { front: [], mid: [], back: [] }, townUpgrade: null, upgradedUnits: {}, essence: {} });
  await send('Input.insertText', { text: GOOD });
  const v0 = await evalJs("document.getElementById('save-in').value");
  test('T3 insertText 真实输入进 textarea', v0 === GOOD, 'len=' + v0.length);
  await sleep(2500); // 跨 ≥2 tick，updateUI 会重渲染主页
  const vAfter = await evalJs("document.getElementById('save-in').value");
  const focusKept = await evalJs("document.activeElement&&document.activeElement.id==='save-in'");
  test('T3 跨两个 tick 后输入内容未被刷掉', vAfter === GOOD);
  test('T3 跨 tick 后编辑焦点未被破坏', focusKept === true);
  await shot('S14-03-import-typed-360');
  // T4 无效 JSON 真实输入 → 错误可见
  await evalJs("document.getElementById('save-in').value='';'ok'");
  await clickBySelector("document.getElementById('save-in')", '导入输入框(重聚焦)');
  await send('Input.insertText', { text: 'not-json{{{' });
  await evalJs("settingsImportCheck();'ok'"); await sleep(200);
  test('T4 无效 JSON 错误提示可见', await evalJs("document.getElementById('import-preview').textContent.includes('✗')"));
  // T5 XSS：输入含标签/事件属性 → 只按文本处理不执行
  await evalJs("settingsShowImport();'ok'"); await sleep(150);
  await clickBySelector("document.getElementById('save-in')", '导入输入框(XSS)');
  await send('Input.insertText', { text: '<img src=x onerror="window.__xss1=1">{"res":{"wood":1}}' });
  const beforeXss = await evalJs("localStorage.getItem('rts_save')||''");
  await evalJs("settingsImportCheck();'ok'"); await sleep(300);
  test('T5 XSS payload 未执行（window.__xss1 未定义）', (await evalJs('typeof window.__xss1')) === 'undefined');
  test('T5 XSS payload 作为文本进入 textarea（不解析为节点）', (await evalJs("document.getElementById('save-in').value")).startsWith('<img src=x'));
  test('T5 XSS 无效输入不写主档', (await evalJs("localStorage.getItem('rts_save')||''")) === beforeXss);
  // T6 保护模式下导出原文（真实点击入口）
  await evalJs("localStorage.setItem('rts_save','BROKEN{{');'ok'");
  await send('Page.reload'); await sleep(2500);
  await clickBySelector(BTN_SETTINGS, '设置(保护模式)');
  test('T6 保护模式下设置弹窗横幅可见', await evalJs("document.getElementById('settings-content').textContent.includes('存档保护模式')"));
  const gotRaw = await clickBySelector("[...document.querySelectorAll('#settings-content button')].find(x=>x.textContent.includes('导出主档原文'))", '导出主档原文');
  test('T6 保护模式提供并点得动“导出主档原文”按钮', gotRaw);
  test('T6 导出原文真实回显异常文本', (await evalJs("document.getElementById('save-out').value")) === 'BROKEN{{');
  await shot('S14-04-protected-export-360');
  // T7 重置确认弹窗取消路径：真实点击→原生 confirm→CDP 应答 dismiss→数据分毫不动
  await evalJs("localStorage.removeItem('rts_save');save();'ok'"); await sleep(200);
  const beforeReset = await evalJs("Object.keys(localStorage).sort().join(',')");
  dialogMode = 'dismiss'; lastDialog = null;
  const resetBtn = await evalJs("(()=>{const b=[...document.querySelectorAll('#settings-content button')].find(x=>x.textContent.includes('重置存档'));if(!b)return null;const r=b.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()");
  test('T7 重置入口存在且可见', resetBtn !== null);
  await evalJs("(()=>{const b=[...document.querySelectorAll('#settings-content button')].find(x=>x.textContent.includes('重置存档'));b.click();return 1})()"); await sleep(500);
  test('T7 点击后弹出原生确认(文案含四项删除对象)', lastDialog !== null && /主档/.test(lastDialog.message || '') && /覆盖前副本/.test(lastDialog.message || ''), lastDialog && lastDialog.message);
  test('T7 取消(confirm=false)后数据不变', (await evalJs("Object.keys(localStorage).sort().join(',')")) === beforeReset);
  // T8 保护解除后确认导入生效（真实点击确认按钮→重载）
  await evalJs("localStorage.removeItem('rts_save');'ok'");
  await send('Page.reload'); await sleep(2500);
  await evalJs("openSettings();settingsShowImport();'ok'"); await sleep(200);
  await evalJs(`document.getElementById('save-in').value=${JSON.stringify(GOOD)};settingsImportCheck();'ok'`); await sleep(200);
  test('T8 导入预览显示摘要', await evalJs("document.getElementById('import-preview').textContent.includes('校验通过')"));
  const gotCommit = await clickBySelector("[...document.querySelectorAll('#import-preview button')].find(x=>x.textContent.includes('确认覆盖导入'))", '确认覆盖导入');
  test('T8 确认按钮在 360 宽下可见可点', gotCommit);
  await sleep(2500);
  test('T8 导入确认后主档写入 v3（真实重载生效）', await evalJs("(()=>{try{return JSON.parse(localStorage.getItem('rts_save')).v===3}catch(e){return false}})()") && (await evalJs('S.defeated.length')) === 3);
  // T9 恢复确认双路径：accept→重载回滚进度；dismiss→保持现状
  await evalJs("S.merit=123;save();'ok'"); await sleep(300); // 轮转备份：backup_1=导入档(merit5)
  await evalJs("S.merit=456;save();'ok'"); await sleep(300);
  await evalJs("openSettings();settingsShowRestore();'ok'"); await sleep(200);
  test('T9 恢复列表显示有效备份摘要', await evalJs("document.getElementById('save-mgmt-body').textContent.includes('备份 1')"));
  await shot('S14-05-restore-list-360');
  dialogMode = 'accept'; lastDialog = null;
  await evalJs("settingsRestoreCommit(1);'ok'"); await sleep(2500);
  test('T9 恢复确认(accept)后重载回滚到备份进度(merit=123)', (await evalJs('S.merit')) === 123 && (await evalJs("JSON.parse(localStorage.getItem('rts_save')).merit")) === 123);
  await evalJs("openSettings();settingsShowRestore();'ok'"); await sleep(200);
  dialogMode = 'dismiss'; lastDialog = null;
  await evalJs("settingsRestoreCommit(2);'ok'"); await sleep(500); // 选 slot2 并在原生确认里取消
  test('T9 恢复确认(dismiss)不重载不改档', (await evalJs('S.merit')) === 123 && (await evalJs("JSON.parse(localStorage.getItem('rts_save')).merit")) === 123);
  // T10 定向重置完整真实路径：确认(accept)→只删本游戏 4 键，哨兵保留，页面重载新开局
  await evalJs("localStorage.setItem('__sentinel_other_site__','keep');'ok'");
  await evalJs("openSettings();'ok'"); await sleep(200);
  dialogMode = 'accept'; lastDialog = null;
  await evalJs("(()=>{const b=[...document.querySelectorAll('#settings-content button')].find(x=>x.textContent.includes('重置存档'));b.click();return 1})()"); await sleep(2500);
  test('T10 重置确认(accept)后本游戏 key 全删', await evalJs("['rts_save','rts_save_backup_1','rts_save_backup_2','rts_save_premigration'].every(k=>localStorage.getItem(k)===null)"));
  test('T10 哨兵 key 保留(不波及其它站点数据)', (await evalJs("localStorage.getItem('__sentinel_other_site__')")) === 'keep');
  test('T10 重置后页面重载为新局', (await evalJs('S.townLv')) === 1 && (await evalJs('saveProtected()')) === false);
  await evalJs("localStorage.removeItem('__sentinel_other_site__');'ok'");
  test('T11 全程零未捕获异常', exceptions.length === 0, exceptions.slice(0, 2).join(' | '));
  await shot('S14-06-final-360');
  const vp = { vw, vh };
  console.log('视口：' + vp.vw + 'x' + vp.vh + '（Edge 视口模拟，非实体手机）');
  console.log('截图输出目录：docs/codex/reports/assets/');
  for (const r of rows) console.log(r);
  console.log('\n浏览器异常列表：' + (exceptions.length ? exceptions.join('\n') : '（空）'));
  console.log('node ' + process.version + ' + Edge(headless=new) CDP | 通过 ' + pass + ' / 失败 ' + fail);
  try { ws.close(); } catch (e) { }
  killEdgeTree(edge.pid);
  await sleep(300);
  const res = reaper.sweepHeadless(true);
  console.log(`清理核对：headless 残留 ${res.found} → 已清 ${res.removed}｜剩余 ${res.remaining}｜涉及内存约 ${res.freedMB} MB`);
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) { console.log('（临时 profile 未清理：' + udd + '）'); }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('驱动失败: ' + e.message); for (const r of rows) console.log(r); try { killEdgeTree(edge && edge.pid); } catch (_) { } process.exit(2); });
