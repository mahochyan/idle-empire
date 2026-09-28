'use strict';
// P85 兵装阶段奖励 Edge/CDP 回归：node tests/progression/arms_up_milestones_browser.js
// 使用专用临时 Edge profile，不接触用户浏览器存档，也不落测试截图到仓库。
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(candidate=>fs.existsSync(candidate));
if(!edge){console.error('NO_BROWSER: Microsoft Edge 未安装');process.exit(2);}
const pageUrl=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const tempRoot=path.resolve(os.tmpdir());
const profile=path.resolve(tempRoot,'arms-up-milestones-'+process.pid);
if(!profile.startsWith(tempRoot+path.sep))throw Error('profile path outside temp');
const port=20100+Math.floor(Math.random()*800);
const browser=spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox','--disable-background-networking','--remote-debugging-port='+port,'--user-data-dir='+profile,pageUrl],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ws,id=0;
const pending=new Map(),exceptions=[],checks=[];
function check(name,ok,info){checks.push({name,ok:!!ok,info:ok?undefined:info});}
function send(method,params={}){return new Promise((resolve,reject)=>{const token=++id;pending.set(token,{resolve,reject});ws.send(JSON.stringify({id:token,method,params}));});}
async function evalJs(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
(async()=>{
  let targets;
  for(let tries=0;tries<40;tries++){
    await sleep(500);
    try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.some(target=>target.type==='page'))break;}catch(_){}
  }
  const page=targets?.find(target=>target.type==='page'&&target.url===pageUrl)||targets?.find(target=>target.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=message=>{
    const data=JSON.parse(message.data);
    if(data.id&&pending.has(data.id)){const item=pending.get(data.id);pending.delete(data.id);data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result);}
    if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
  };
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await sleep(1000);
  const fixture=await evalJs("(()=>{S.sciences=['sci_bronze_age'];S.res.copper=2000;S.armsUp.bronze_guard.atk={stars:9,progress:999};S.armsUp.bronze_guard.hp={stars:99,progress:999};S.page='tech';updateUI();save();return true})()");
  check('360px 青铜兵装卡片显示两个阶段门槛',fixture&&await evalJs("(()=>{const c=[...document.querySelectorAll('#main .card')].find(x=>x.textContent.includes('青铜盾兵装'));return !!c&&c.textContent.includes('攻击每10星追加基础属性20%')&&c.textContent.includes('生命每100星追加基础属性20%')&&document.documentElement.scrollWidth<=innerWidth+1})()"));
  const before=await evalJs("(()=>{const c=[...document.querySelectorAll('#main .card')].find(x=>x.textContent.includes('青铜盾兵装'));return {text:c?.textContent,atk:weaponAttack('bronze_guard'),hp:battleVitals('bronze_guard',1,true).hpPerSoldier}})()");
  check('跨档前科技页与计算值对应9星攻击、99星生命',before.atk===16&&Math.abs(before.hp-2.99)<1e-9&&before.text.includes('当前攻击 +9')&&before.text.includes('当前单兵生命 +0.99'),before);
  const afterAttack=await evalJs("(()=>{const c=[...document.querySelectorAll('#main .card')].find(x=>x.textContent.includes('青铜盾兵装'));const b=[...c.querySelectorAll('button')].find(x=>x.getAttribute('onclick')===\"investArmsUp('bronze_guard','atk')\");if(!b||b.disabled)return {clicked:false};b.click();const d=JSON.parse(localStorage.getItem('rts_save'));return {clicked:true,stock:S.res.copper,stars:S.armsUp.bronze_guard.atk.stars,progress:S.armsUp.bronze_guard.atk.progress,attack:weaponAttack('bronze_guard'),savedStars:d.armsUp.bronze_guard.atk.stars,version:d.v,text:[...document.querySelectorAll('#main .card')].find(x=>x.textContent.includes('青铜盾兵装')).textContent}})()");
  check('真实攻击按钮实扣铜并将9星升到10星，战斗属性与存档一致',afterAttack.clicked&&afterAttack.stock===1000&&afterAttack.stars===10&&afterAttack.progress===0&&afterAttack.attack===18&&afterAttack.savedStars===10&&afterAttack.version===32&&afterAttack.text.includes('当前攻击 +11'),afterAttack);
  const afterHp=await evalJs("(()=>{const c=[...document.querySelectorAll('#main .card')].find(x=>x.textContent.includes('青铜盾兵装'));const b=[...c.querySelectorAll('button')].find(x=>x.getAttribute('onclick')===\"investArmsUp('bronze_guard','hp')\");if(!b||b.disabled)return {clicked:false};b.click();const d=JSON.parse(localStorage.getItem('rts_save'));return {clicked:true,stock:S.res.copper,stars:S.armsUp.bronze_guard.hp.stars,progress:S.armsUp.bronze_guard.hp.progress,hp:battleVitals('bronze_guard',1,true).hpPerSoldier,savedStars:d.armsUp.bronze_guard.hp.stars,savedVersion:d.v,text:[...document.querySelectorAll('#main .card')].find(x=>x.textContent.includes('青铜盾兵装')).textContent,overflow:document.documentElement.scrollWidth>innerWidth+1}})()");
  check('真实生命按钮跨100星档位后总加值为1.40并写入v32档',afterHp.clicked&&afterHp.stock===0&&afterHp.stars===100&&afterHp.progress===0&&Math.abs(afterHp.hp-3.4)<1e-9&&afterHp.savedStars===100&&afterHp.savedVersion===32&&afterHp.text.includes('当前单兵生命 +1.40')&&!afterHp.overflow,afterHp);
  check('浏览器过程零未捕获异常',exceptions.length===0,exceptions.slice(0,3));
  console.log(JSON.stringify({checks,exceptions,passed:checks.filter(result=>result.ok).length,failed:checks.filter(result=>!result.ok).length},null,2));
  process.exitCode=checks.some(result=>!result.ok)?1:0;
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error&&error.stack||error);process.exitCode=2;}).finally(async()=>{
  try{ws?.close();}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(250);
  try{if(profile.startsWith(tempRoot+path.sep)&&fs.existsSync(profile))fs.rmSync(profile,{recursive:true,force:true});}catch(error){console.error('PROFILE_CLEANUP_FAILED',error.message);}
});
