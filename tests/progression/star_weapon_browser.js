'use strict';
// 独立 Edge/CDP 冒烟；测试浏览器 profile 位于系统临时目录，不接触玩家存档。
const assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const edge=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!edge){console.error('NO_BROWSER: Edge 未安装');process.exit(2)}
const root=path.resolve(os.tmpdir()),profile=fs.mkdtempSync(path.join(root,'star-weapon-ui-'));
if(!path.resolve(profile).startsWith(root+path.sep))throw Error('profile outside temp');
const url=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const port=23100+Math.floor(Math.random()*1000);
const browser=spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox','--disable-background-networking','--remote-debugging-port='+port,'--user-data-dir='+profile,url],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ws,id=0,passed=0;const pending=new Map(),exceptions=[];
function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))})}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value}
function check(name,actual,expected){assert.deepEqual(actual,expected,name);passed++;console.log('PASS '+name)}
async function ready(){for(let i=0;i<80;i++){try{if(await evaluate("document.readyState==='complete'&&typeof researchWeapon==='function'&&typeof updateUI==='function'"))return true}catch(_){}await sleep(100)}return false}
async function row(key){return evaluate(`(()=>{const button=[...document.querySelectorAll('#main button[onclick]')].find(e=>e.getAttribute('onclick')==="researchWeapon('${key}')"||e.getAttribute('onclick')==="forgeWeapon('${key}')");return {found:!!button,disabled:button?.disabled,description:button?.closest('.tech-detail-row')?.textContent||''}})()`)}
async function click(key){return evaluate(`(()=>{const button=[...document.querySelectorAll('#main button[onclick]')].find(e=>e.getAttribute('onclick')==="researchWeapon('${key}')"||e.getAttribute('onclick')==="forgeWeapon('${key}')");if(!button||button.disabled)return false;button.click();return true})()`)}
(async()=>{
  let targets;
  for(let i=0;i<40;i++){await sleep(500);try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.some(t=>t.type==='page'))break}catch(_){}}
  const page=targets?.find(t=>t.type==='page'&&t.url===url)||targets?.find(t=>t.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=event=>{const data=JSON.parse(event.data);if(data.id&&pending.has(data.id)){const p=pending.get(data.id);pending.delete(data.id);data.error?p.reject(Error(JSON.stringify(data.error))):p.resolve(data.result)}if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text)};
  await send('Runtime.enable');await send('Page.enable');
  check('页面脚本加载完成',await ready(),true);
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await evaluate("S.sciences.push('sci_nuclear_age');S.page='tech';updateUI();true");
  const fighter=await row('starFighter'),missile=await row('starMissile');
  check('360px战机与飞弹显示主题名和首击说明',[fighter.found,missile.found,fighter.description.includes('星界战机'),missile.description.includes('星陨飞弹'),fighter.description.includes('135%'),missile.description.includes('1000')],[true,true,true,true,true,true]);
  check('飞弹研发被前置锁定',missile.disabled,true);
  await evaluate("S.res.tech=100000000;S.res.medal=1000000;updateUI();true");
  check('战机研发按钮实点',await click('starFighter'),true);
  check('战机费用与研究状态写档',await evaluate("({tech:S.res.tech,medal:S.res.medal,research:S.weaponForge.starFighter.researched,saved:JSON.parse(localStorage.getItem('rts_save')).weaponForge.starFighter.researched})"),{tech:0,medal:0,research:true,saved:true});
  await evaluate("S.res.tech=100000000;S.res.medal=1000000;updateUI();true");
  check('飞弹研发按钮实点',await click('starMissile'),true);
  check('飞弹研究保存',await evaluate("({research:S.weaponForge.starMissile.researched,saved:JSON.parse(localStorage.getItem('rts_save')).weaponForge.starMissile.researched})"),{research:true,saved:true});
  await evaluate("S.res.steel=10000;S.items.godCore=8;updateUI();true");
  check('战机锻造按钮实点',await click('starFighter'),true);
  check('一次锻造扣钢与核心且写进度',await evaluate("({steel:S.res.steel,core:S.items.godCore,progress:S.weaponForge.starFighter.progress,saved:JSON.parse(localStorage.getItem('rts_save')).weaponForge.starFighter.progress})"),{steel:0,core:0,progress:1,saved:1});
  await evaluate('window.__starReloadMarker=true');await send('Page.reload',{ignoreCache:true});
  for(let i=0;i<80;i++){if(await evaluate("document.readyState==='complete'&&window.__starReloadMarker===undefined&&typeof updateUI==='function'"))break;await sleep(100)}
  check('重载后研究与锻造保留',await evaluate("({fighter:S.weaponForge.starFighter.researched,missile:S.weaponForge.starMissile.researched,progress:S.weaponForge.starFighter.progress})"),{fighter:true,missile:true,progress:1});
  check('360px无横向溢出',await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
  await send('Emulation.setDeviceMetricsOverride',{width:400,height:800,deviceScaleFactor:1,mobile:true});await evaluate("S.page='tech';updateUI();true");
  check('400px无横向溢出',await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
  check('页面无未捕获异常',exceptions,[]);
  console.log(`star weapon browser: ${passed} passed`);
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error?.stack||error);process.exitCode=1}).finally(async()=>{
  if(ws?.readyState===WebSocket.OPEN)try{await Promise.race([send('Browser.close'),sleep(1000)])}catch(_){}
  try{ws?.close()}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  for(let i=0;i<8&&fs.existsSync(profile);i++){await sleep(250);try{if(path.resolve(profile).startsWith(root+path.sep))fs.rmSync(profile,{recursive:true,force:true})}catch(error){if(i===7)console.error('PROFILE_CLEANUP_FAILED',error.message)}}
  process.exit(process.exitCode||0);
});
