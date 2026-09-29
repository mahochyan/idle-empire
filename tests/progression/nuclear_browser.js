'use strict';
// 独立 Edge/CDP 冒烟：检查真实加载顺序、星核锁定和 360/400px 布局。
// 仅使用本进程专用临时浏览器 profile，不触碰玩家存档。
const assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(candidate=>fs.existsSync(candidate));
if(!edge){console.error('NO_BROWSER: Microsoft Edge 未安装');process.exit(2)}
const pageUrl=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const tempRoot=path.resolve(os.tmpdir());
const profile=path.resolve(tempRoot,'nuclear-ui-smoke-'+process.pid);
if(!profile.startsWith(tempRoot+path.sep))throw Error('profile path outside temp');
const port=20600+Math.floor(Math.random()*700);
const browser=spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox','--disable-background-networking','--remote-debugging-port='+port,'--user-data-dir='+profile,pageUrl],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ws,id=0,passed=0;
const pending=new Map(),exceptions=[];
function send(method,params={}){return new Promise((resolve,reject)=>{const token=++id;pending.set(token,{resolve,reject});ws.send(JSON.stringify({id:token,method,params}));});}
async function evalJs(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
function check(name,actual,expected){assert.deepEqual(actual,expected,name);passed++;console.log('PASS '+name)}
(async()=>{
  let targets;
  for(let tries=0;tries<40;tries++){
    await sleep(500);
    try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.some(t=>t.type==='page'))break}catch(_){}
  }
  const page=targets?.find(t=>t.type==='page'&&t.url===pageUrl)||targets?.find(t=>t.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=message=>{
    const data=JSON.parse(message.data);
    if(data.id&&pending.has(data.id)){const item=pending.get(data.id);pending.delete(data.id);data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result)}
    if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
  };
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});await sleep(900);
  check('v26 scripts keep dependency order',await evalJs("[window.APP_VERSION,...window.APP_SCRIPTS]"),['26','config.js','levels.js','sprites.js','math.js','garrison.js','technology.js','ui.js']);
  const locked=await evalJs("(()=>{S.sciences.push('sci_steam_age','sci_electric_age');S.buildings.electric_armory={lv:1,state:'idle'};S.page='barracks';updateUI();return {text:document.getElementById('main').textContent,overflow:document.documentElement.scrollWidth>innerWidth,portrait:document.querySelector(\".unit-portrait-mini[src*='star_trooper']\")?.getAttribute('src')||''}})()");
  check('unresearched star unit stays hidden',locked.text.includes('星际先遣兵'),false);
  check('unresearched star portrait stays hidden',locked.portrait,'');
  check('360px barracks has no horizontal overflow',locked.overflow,false);
  const capacity=await evalJs("(()=>{S.page='tech';updateUI();return document.getElementById('main').textContent})()");
  check('tech page shows exact one-payment capacity gap',capacity.includes('知识仓上限')&&capacity.includes('星核时代'),true);
  const conditional=await evalJs("(()=>{S.res.tech=100000000;S.res.medal=800000;S.res.copper=8000;S.res.iron=8000;S.res.steel=8000;const research=researchScience('sci_nuclear_age');S.page='barracks';updateUI();return {research:research.ok,shown:document.getElementById('main').textContent.includes('星际先遣兵'),train:train('star_trooper',1).ok}})()");
  check('conditional fixture researches and queues first star unit',conditional,{research:true,shown:true,train:true});
  const domain=await evalJs("(()=>{S.page='fight';S._fightTab='expedition';updateUI();return {shown:document.getElementById('main').textContent.includes('复苏圣域·复苏圣像'),overflow:document.documentElement.scrollWidth>innerWidth}})()");
  check('revival material challenge appears after nuclear research',domain,{shown:true,overflow:false});
  const nuclearCard=await evalJs("(()=>{S.page='tech';S.res.tech=20000000;updateUI();const card=[...document.querySelectorAll('.card')].find(x=>x.textContent.includes('星核仓储与生产科技'));return {found:!!card,rows:card?.querySelectorAll('button').length,overflow:document.documentElement.scrollWidth>innerWidth}})()");
  check('nuclear capacity card exposes four upgrades without overflow',nuclearCard,{found:true,rows:4,overflow:false});
  const nuclearPaid=await evalJs("(()=>{const card=[...document.querySelectorAll('.card')].find(x=>x.textContent.includes('星核仓储与生产科技'));card.querySelectorAll('button')[2].click();return {level:S.eraStorage.nuclearKnowledge,saved:JSON.parse(localStorage.getItem('rts_save')).eraStorage.nuclearKnowledge,tech:S.res.tech}})()");
  check('knowledge upgrade button pays once and saves',nuclearPaid,{level:1,saved:1,tech:0});
  const quantumLocked=await evalJs("(()=>{S.res.tech=3000000000;S.res.medal=2999999;S.page='tech';updateUI();const button=[...document.querySelectorAll('button')].find(x=>x.getAttribute('onclick')===\"researchScience('sci_quantum_age')\");return {found:!!button,disabled:button?.disabled,cost:button?.closest('.tech-science-row')?.textContent.includes('战备勋章 3000000'),card:[...document.querySelectorAll('.card h3')].some(x=>x.textContent.includes('星界仓储与生产科技'))}})()");
  check('quantum research shows medal price and stays locked one medal short',quantumLocked,{found:true,disabled:true,cost:true,card:false});
  const quantumPaid=await evalJs("(()=>{S.res.medal=3000000;S.page='tech';updateUI();const button=[...document.querySelectorAll('button')].find(x=>x.getAttribute('onclick')===\"researchScience('sci_quantum_age')\");button.click();return {unlocked:S.sciences.includes('sci_quantum_age'),tech:S.res.tech,medal:S.res.medal,saved:JSON.parse(localStorage.getItem('rts_save')).sciences.includes('sci_quantum_age'),card:[...document.querySelectorAll('.card h3')].some(x=>x.textContent.includes('星界仓储与生产科技')),overflow:document.documentElement.scrollWidth>innerWidth}})()");
  check('quantum research pays once and opens its four-upgrade card at 360px',quantumPaid,{unlocked:true,tech:0,medal:0,saved:true,card:true,overflow:false});
  const quantumKnowledge=await evalJs("(()=>{S.res.tech=500000000;updateUI();const card=[...document.querySelectorAll('.card')].find(x=>x.querySelector('h3')?.textContent.includes('星界仓储与生产科技'));const rows=card.querySelectorAll('button').length;card.querySelectorAll('button')[2].click();return {rows,level:S.eraStorage.quantumKnowledge,tech:S.res.tech,saved:JSON.parse(localStorage.getItem('rts_save')).eraStorage.quantumKnowledge}})()");
  check('quantum knowledge upgrade button pays and saves',quantumKnowledge,{rows:4,level:1,tech:0,saved:1});
  await send('Emulation.setDeviceMetricsOverride',{width:400,height:800,deviceScaleFactor:1,mobile:true});await sleep(100);
  const wide=await evalJs("(()=>{S.page='barracks';updateUI();return {overflow:document.documentElement.scrollWidth>innerWidth,trained:document.getElementById('main').textContent.includes('星际先遣兵')}})()");
  check('400px star barracks has no horizontal overflow',wide,{overflow:false,trained:true});
  const trialCard=await evalJs("(()=>{S.formation={front:[{type:'star_trooper',count:1,id:9010}],mid:[],back:[]};S.items.trialFruit=2;save();S.page='fight';S._fightTab='expedition';updateUI();const card=[...document.querySelectorAll('.card')].find(x=>x.textContent.includes('圣域试炼 · 星际先遣兵'));return {found:!!card,buttons:card?.querySelectorAll('button').length,sourceCost:card?.textContent.includes('首个出战兵团人数'),fruitSource:document.getElementById('main').textContent.includes('缄默神域·缄默之神'),overflow:document.documentElement.scrollWidth>innerWidth}})()");
  check('trial card and fruit source render at 400px',trialCard,{found:true,buttons:3,sourceCost:true,fruitSource:true,overflow:false});
  const trialStart=await evalJs("(()=>{const card=[...document.querySelectorAll('.card')].find(x=>x.textContent.includes('圣域试炼 · 星际先遣兵'));card.querySelector('button').click();return {active:S.battleActive,fruit:S.items.trialFruit,saved:JSON.parse(localStorage.getItem('rts_save')).items.trialFruit,mode:B.trialMode}})()");
  check('browser trial button pays and starts encounter once',trialStart,{active:true,fruit:1,saved:1,mode:'easy'});
  await evalJs("(()=>{window.__trialSkillRandom=Math.random;S.awakening.star_trooper.stars=5;Math.random=()=>0;B.enemyUnits[0].hp=100000;B.enemyUnits[0].maxHp=100000;B.enemyUnits[0].def=0;return true})()");
  for(let tries=0;tries<12;tries++){
    if(await evalJs("B.msgs.some(row=>row.m.includes('圣域神技'))"))break;
    await sleep(300);
  }
  check('real browser trial logs both opening skills',await evalJs("({star:B.msgs.some(row=>row.m.includes('星核贯穿')),guard:B.msgs.some(row=>row.m.includes('圣域神技'))})"),{star:true,guard:true});
  check('real browser trial logs guard defense',await evalJs("B.msgs.some(row=>row.m.includes('圣域守御'))"),true);
  await evalJs('Math.random=window.__trialSkillRandom;S.awakening.star_trooper.stars=0');
  await evalJs('fleeBattle()');
  const thirdStarted=await evalJs("(()=>{S.awakening.star_trooper={level:20,stars:100,tracks:{easy:20,perfect:0,extreme:0}};S.formation={front:[{type:'star_trooper',count:10,id:9011}],mid:[],back:[]};S.battleSpeed=4;S.page='fight';S._fightTab='expedition';CFG.battleStepDelay=20;CFG.battleRoundDelay=20;Math.random=()=>0;selEnemy(0);openBattle();return S.battleActive})()");
  check('conditional 100-star campaign fight starts in browser',thirdStarted,true);
  for(let tries=0;tries<20;tries++){
    if(await evalJs("B.msgs.some(row=>row.m.includes('星辉裁决'))"))break;
    await sleep(200);
  }
  check('real browser campaign logs star judgement',await evalJs("B.msgs.some(row=>row.m.includes('星辉裁决'))"),true);
  await evalJs("Math.random=window.__trialSkillRandom;if(S.battleActive)fleeBattle();S.awakening.star_trooper={level:0,stars:0,tracks:{easy:0,perfect:0,extreme:0}}");
  const started=await evalJs("(()=>{S.formation={front:[{type:'electro_trooper',count:55,id:9001}],mid:[],back:[]};S.battleSpeed=4;S.page='fight';S._fightTab='expedition';updateUI();openMaterialDomain('revivalLeaf');if(S.battleActive){B.enemyUnits[0].hp=500;B.enemyUnits[0].maxHp=500;B.ourUnits[0].atk=92}return S.battleActive})()");
  check('conditional revival fight starts in browser',started,true);
  await sleep(1000);
  check('revival recovery appears in real battle log',await evalJs("B.msgs.some(row=>row.m.includes('圣辉自愈'))"),true);
  check('no uncaught page exceptions',exceptions,[]);
  console.log(`nuclear browser: ${passed}/22`);
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error&&error.stack||error);process.exitCode=1}).finally(async()=>{
  if(ws?.readyState===WebSocket.OPEN){
    try{await Promise.race([send('Browser.close'),sleep(1000)])}catch(_){}
  }
  try{ws?.close()}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  for(let attempt=0;attempt<8&&fs.existsSync(profile);attempt++){
    await sleep(250);
    try{if(profile.startsWith(tempRoot+path.sep))fs.rmSync(profile,{recursive:true,force:true})}
    catch(error){if(attempt===7)console.error('PROFILE_CLEANUP_FAILED',error.message)}
  }
  process.exit(process.exitCode||0);
});
