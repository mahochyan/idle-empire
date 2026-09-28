'use strict';
// node tests/progression/campaign_enemy_browser.js
// Edge/CDP 冒烟：检查关卡预告和第20/29/30/39/40关战斗初始化；条件编队不证明自然可达。
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(p=>fs.existsSync(p));
if(!edge){console.error('NO_BROWSER: Microsoft Edge 未安装');process.exit(2)}
const tempRoot=fs.realpathSync(os.tmpdir());
const profile=fs.mkdtempSync(path.join(tempRoot,'campaign-mage-ui-'));
if(!path.resolve(profile).startsWith(tempRoot+path.sep))throw Error('profile path outside temp');
const pageUrl=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const port=24200+Math.floor(Math.random()*800);
const browser=spawn(edge,[
  '--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox',
  '--disable-background-networking','--remote-debugging-port='+port,'--user-data-dir='+profile,pageUrl
],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pending=new Map(),exceptions=[],checks=[];
let ws,nextId=0,spawnError;
browser.on('error',e=>{spawnError=e});
function check(name,ok,detail){checks.push({name,ok:!!ok,detail:ok?undefined:detail})}
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method))},10000);
    pending.set(id,{resolve,reject,timer});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function evalJs(expression){
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function ready(){
  for(let i=0;i<80;i++){
    try{if(await evalJs("document.readyState==='complete'&&Array.isArray(window.APP_SCRIPTS)&&typeof openBattle==='function'"))return true}catch(_){}
    await sleep(100);
  }
  return false;
}
(async()=>{
  let targets;
  for(let i=0;i<40;i++){
    await sleep(500);
    if(spawnError)throw spawnError;
    try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.some(t=>t.type==='page'))break}catch(_){}
  }
  const page=targets?.find(t=>t.type==='page'&&t.url===pageUrl)||targets?.find(t=>t.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=message=>{
    const data=JSON.parse(message.data);
    if(data.id&&pending.has(data.id)){
      const item=pending.get(data.id);pending.delete(data.id);clearTimeout(item.timer);
      data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result);
    }
    if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
  };
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await send('Page.reload',{ignoreCache:true});
  check('真实页面按原脚本顺序加载',await ready());
  for(const stage of [3,16,17,20,93,96,97]){
    const view=await evalJs(`(()=>{
      S.page='fight';S._fightTab='expedition';S.selEnemy=${stage-1};updateUI();
      const select=document.querySelector('#main select[onchange*="selEnemy"]');
      const preview=select?.parentElement?.nextElementSibling;
      return {selected:select?.value,name:preview?.querySelector('strong')?.textContent,
        description:preview?.children?.[1]?.textContent,
        roster:preview?.children?.[2]?.textContent,
        cfgName:CFG.enemies[${stage-1}].name,cfgDesc:CFG.enemies[${stage-1}].desc};
    })()`);
    check(`第${stage}关真实页面预告与敌军配置一致`,
      view.selected===String(stage-1)&&view.name===view.cfgName&&view.description===view.cfgDesc&&!!view.roster,view);
  }
  const chapterBoss=await evalJs(`(()=>{
    S.formation={front:[{type:'bronze_guard',count:15,id:20}],mid:[],back:[]};
    S.selEnemy=19;CFG.battleStepDelay=60000;S.battleSpeed=1;openBattle();
    const field=document.getElementById('battle-field');
    const result={active:S.battleActive,stage:B.enemyCfg?.id,
      name:B.enemyCfg?.name,groups:B.enemyUnits.length,
      hp:B.enemyUnits.reduce((sum,u)=>sum+u.hp,0),
      enemyCards:field.querySelectorAll('.enemy-zone .unit-box').length};
    fleeBattle();return result;
  })()`);
  check('第20关军镇统领在浏览器中按54生命、9团开战',
    chapterBoss.active&&chapterBoss.stage===20&&chapterBoss.name==='军镇铁骑统领'&&
    chapterBoss.groups===9&&chapterBoss.hp===54&&chapterBoss.enemyCards===9,chapterBoss);
  for(const stage of [29,30,39,40]){
    const view=await evalJs(`(()=>{
      S.formation={front:[{type:'alloy_special',count:40,id:1}],mid:[{type:'archer',count:20,id:2}],back:[{type:'archer',count:20,id:3}]};
      S.selEnemy=${stage-1};CFG.battleStepDelay=60000;S.battleSpeed=1;openBattle();
      const field=document.getElementById('battle-field');
      const result={active:S.battleActive,stage:B.enemyCfg?.id,
        mageUnits:B.enemyUnits.filter(u=>u.type==='mage_t1').length,
        groups:B.enemyUnits.length,
        hp:B.enemyUnits.reduce((sum,u)=>sum+u.hp,0),
        enemyCards:field.querySelectorAll('.enemy-zone .unit-box').length,
        mageCard:[...field.querySelectorAll('.enemy-zone .unit-box')].some(card=>card.getAttribute('aria-label')?.includes('魔法学徒')),
        visible:document.getElementById('battle-screen').classList.contains('active')};
      fleeBattle();return result;
    })()`);
    check(`第${stage}关法师敌兵在浏览器中正常开战与显示`,view.active&&view.stage===stage&&view.mageUnits>0&&view.enemyCards>0&&view.mageCard&&view.visible&&
      (stage!==30||(view.groups===11&&view.hp===49))&&
      (stage!==40||(view.groups===11&&view.hp===57)),view);
  }
  const wind=await evalJs(`(()=>{
    S.formation={front:[{type:'cavalry_wind',count:15,id:28}],mid:[],back:[]};
    S.selEnemy=28;CFG.battleStepDelay=60000;S.battleSpeed=1;openBattle();
    const actor=B.ourUnits.find(u=>u.type==='cavalry_wind');
    const front=B.enemyUnits.find(u=>u.row==='front');
    const back=B.enemyUnits.find(u=>u.row==='back');
    const previousRandom=Math.random;
    let expeditionTarget,garrisonTarget,crit;
    try{
      Math.random=()=>0.99;
      expeditionTarget=getTarget(actor,[front,back])?.row;
      garrisonTarget=getGarrisonTarget(actor,[front,back])?.row;
      Math.random=()=>0;
      crit=calcDmg({...actor,damageRemainder:0},front,true).crit;
    }finally{Math.random=previousRandom;fleeBattle()}
    return{actor:actor?.type,expeditionTarget,garrisonTarget,crit};
  })()`);
  check('猎风弩骑在真实页面开战后可越前排选敌并触发暴击',
    wind.actor==='cavalry_wind'&&wind.expeditionTarget==='back'&&
    wind.garrisonTarget==='back'&&wind.crit===true,wind);
  check('浏览器无未捕获异常',exceptions.length===0,exceptions.slice(0,3));
  console.log(JSON.stringify({checks,exceptions,passed:checks.filter(x=>x.ok).length,failed:checks.filter(x=>!x.ok).length,
    note:'条件编队仅用于 UI／加载冒烟；自然可达由独立新档探针验证。'},null,2));
  process.exitCode=checks.some(x=>!x.ok)?1:0;
})().catch(e=>{console.error('BROWSER_SMOKE_ERROR',e?.stack||e);process.exitCode=2}).finally(async()=>{
  try{ws?.close()}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(250);
  for(let attempt=0;attempt<20;attempt++){
    try{
      if(path.resolve(profile).startsWith(tempRoot+path.sep)&&fs.existsSync(profile))fs.rmSync(profile,{recursive:true,force:true});
      break;
    }catch(e){
      if(attempt===19){console.error('PROFILE_CLEANUP_FAILED',e.message);process.exitCode=2}
      else await sleep(250);
    }
  }
});
