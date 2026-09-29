'use strict';
// node tests/progression/campaign_stage65_browser_p375.js
// Real Edge/CDP page smoke for the stage-64/65/66 enemy roster. The synthetic
// unlock progress and formation only permit battle entry; this is not a reachability test.
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(p=>fs.existsSync(p));
if(!edge){console.error('NO_BROWSER: Microsoft Edge not installed');process.exit(2)}
const tempRoot=path.resolve(__dirname,'.edge-temp');
fs.mkdirSync(tempRoot,{recursive:true});
const profile=fs.mkdtempSync(path.join(tempRoot,'p375-'));
if(path.dirname(path.resolve(profile))!==tempRoot)throw Error('profile path outside test temp root');
const pageUrl=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const port=25000+Math.floor(Math.random()*1000);
const browser=spawn(edge,[
  '--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox',
  '--disable-background-networking','--remote-debugging-port='+port,'--user-data-dir='+profile,pageUrl
],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pending=new Map(),exceptions=[],checks=[];
let ws,nextId=0,spawnError;
browser.on('error',error=>{spawnError=error});
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
  const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text);
  return response.result.value;
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
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await send('Page.reload',{ignoreCache:true});
  check('page and game scripts loaded in Edge',await ready());
  const scripts=await evalJs('window.APP_SCRIPTS');
  check('game script order intact',JSON.stringify(scripts)===JSON.stringify([
    'config.js','levels.js','sprites.js','math.js','garrison.js','technology.js','ui.js']),scripts);

  for(const [stage,expected] of [[64,[10,7,4]],[65,[11,8,5]],[66,[12,9,5]]]){
    const view=await evalJs(`(()=>{
      const index=${stage-1};
      S.defeated=CFG.enemies.slice(0,index).map(enemy=>enemy.id);
      S.formation={front:[{type:'bronze_guard',count:15,id:375}],mid:[],back:[]};
      S.page='fight';S._fightTab='expedition';S.selEnemy=index;
      updateUI();
      const select=document.querySelector('#main select[onchange*="selEnemy"]');
      const preview=select?.parentElement?.nextElementSibling;
      const roster=preview?.children?.[2]?.textContent||'';
      CFG.battleStepDelay=60000;S.battleSpeed=1;
      openBattle();
      const field=document.getElementById('battle-field');
      const result={selected:select?.value,previewName:preview?.querySelector('strong')?.textContent,
        previewRoster:roster,active:S.battleActive,stage:B.enemyCfg?.id,name:B.enemyCfg?.name,
        infantry:B.enemyUnits.filter(unit=>unit.type==='infantry').map(unit=>unit.hp),
        archers:B.enemyUnits.filter(unit=>unit.type==='archer').map(unit=>unit.hp),
        totalHp:B.enemyUnits.reduce((sum,unit)=>sum+unit.hp,0),
        groups:B.enemyUnits.length,cards:field.querySelectorAll('.enemy-zone .unit-box').length,
        visible:document.getElementById('battle-screen').classList.contains('active')};
      fleeBattle();
      result.fled=!S.battleActive&&S.defeated.length===index;
      return result;
    })()`);
    const count=expected.reduce((sum,n)=>sum+n,0);
    check(`stage ${stage} preview and combat roster`,
      view.selected===String(stage-1)&&view.previewName===view.name&&
      (view.previewRoster.match(new RegExp('×'+count,'g'))||[]).length===2&&
      view.active&&view.stage===stage&&view.visible&&view.fled&&
      JSON.stringify(view.infantry)===JSON.stringify(expected)&&
      JSON.stringify(view.archers)===JSON.stringify(expected)&&
      view.totalHp===count*2&&view.groups===6&&view.cards===6,view);
  }
  check('no uncaught browser exception',exceptions.length===0,exceptions.slice(0,3));
  console.log(JSON.stringify({checks,exceptions,passed:checks.filter(x=>x.ok).length,
    failed:checks.filter(x=>!x.ok).length,
    note:'Synthetic progress and army are battle-entry fixtures only; no victory or natural route asserted.'},null,2));
  process.exitCode=checks.some(x=>!x.ok)?1:0;
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error?.stack||error);process.exitCode=2}).finally(async()=>{
  try{ws?.close()}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(250);
  for(let attempt=0;attempt<20;attempt++){
    try{
      if(path.dirname(path.resolve(profile))===tempRoot&&fs.existsSync(profile))fs.rmSync(profile,{recursive:true,force:true});
      break;
    }catch(error){
      if(attempt===19){console.error('PROFILE_CLEANUP_FAILED',error.message);process.exitCode=2}
      else await sleep(250);
    }
  }
});
