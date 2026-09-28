'use strict';
// Real Edge/CDP smoke for settlement batch expansion and one-step deed purchase.
// Run: node tests/progression/population_batch_browser.js
// Uses an isolated browser profile. Injected market readiness checks the UI/action
// path only; zero-battle progression reachability is covered by the separate probes.
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

const tempRoot=path.resolve(os.tmpdir());
const profile=path.resolve(fs.mkdtempSync(path.join(tempRoot,'population-batch-ui-')));
if(!profile.startsWith(tempRoot+path.sep))throw Error('profile path outside temp');
const pageUrl=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const port=21400+Math.floor(Math.random()*1000);
const browser=spawn(edge,[
  '--headless=new','--disable-gpu','--no-first-run','--disable-extensions',
  '--no-sandbox','--disable-background-networking',
  '--remote-debugging-port='+port,'--user-data-dir='+profile,pageUrl
],{stdio:'ignore',windowsHide:true});

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pending=new Map(),checks=[],exceptions=[],shots=[];
let ws,nextId=0,spawnError;
browser.on('error',error=>{spawnError=error;});
function check(name,ok,detail){checks.push({name,ok:!!ok,detail:ok?undefined:detail});}
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method));},10000);
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
  for(let i=0;i<60;i++){
    try{if(await evalJs("document.readyState==='complete'&&Array.isArray(window.APP_SCRIPTS)&&typeof updateUI==='function'"))return true;}
    catch(_){}
    await sleep(100);
  }
  return false;
}
async function reload(){
  await evalJs("window.__populationBatchReloadMarker=true;'marked'");
  await send('Page.reload',{ignoreCache:true});
  for(let i=0;i<80;i++){
    try{
      if(await evalJs("document.readyState==='complete'&&window.__populationBatchReloadMarker===undefined&&typeof updateUI==='function'"))return true;
    }catch(_){}
    await sleep(100);
  }
  return false;
}
async function setView(width){
  await send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:true});
  await sleep(100);
}
async function layout(selectors){
  return evalJs(`(()=>{
    const phone=document.getElementById('phone').getBoundingClientRect();
    const main=document.getElementById('main');
    const selectors=${JSON.stringify(selectors)};
    const controls=selectors.map(selector=>{
      const el=document.querySelector(selector),r=el?.getBoundingClientRect();
      return {selector,exists:!!el,visible:!!r&&r.width>0&&r.height>0,
        inside:!!r&&r.left>=phone.left-1&&r.right<=phone.right+1,
        left:r?.left,right:r?.right,width:r?.width};
    });
    return {width:innerWidth,document:document.documentElement.scrollWidth,
      body:document.body.scrollWidth,main:main.scrollWidth,mainClient:main.clientWidth,
      overflow:document.documentElement.scrollWidth>innerWidth+1||document.body.scrollWidth>innerWidth+1||main.scrollWidth>main.clientWidth+1,
      controls};
  })()`);
}
async function screenshot(width,name){
  const out=await send('Page.captureScreenshot',{format:'png'});
  const file=path.join(tempRoot,'population-batch-ui-'+process.pid+'-'+width+'-'+name+'.png');
  fs.writeFileSync(file,Buffer.from(out.data,'base64'));
  shots.push(file);
}
async function state(){
  return evalJs("(()=>{const saved=JSON.parse(localStorage.getItem('rts_save')||'null');return {village:S.settlements.village,capacity:maxPop(),population:popCurrent(),deed:S.res.deed,wood:S.res.wood,stone:S.res.stone,coin:S.res.coin,saveProtected:saveProtected(),stored:saved&&{village:saved.settlements.village,population:saved.population.current,deed:saved.res.deed,wood:saved.res.wood,stone:saved.res.stone,coin:saved.res.coin}}})()");
}
async function modal(){
  return evalJs("(()=>({active:document.getElementById('population-action-modal')?.classList.contains('active'),text:document.getElementById('population-action-content')?.textContent||'',confirm:!!document.getElementById('population-action-confirm')}))()");
}
async function freshAt(width){
  await setView(width);
  await evalJs("localStorage.clear();'cleared'");
  check(width+' fresh reload',await reload());
  const first=await state();
  check(width+' fresh 0/4 with 30 deeds',first.village===0&&first.capacity===4&&first.population===0&&first.deed===30,first);
  const scripts=await evalJs("({version:window.APP_VERSION,order:window.APP_SCRIPTS?.join(',')})");
  check(width+' dependency order',scripts.order==='config.js,levels.js,sprites.js,math.js,garrison.js,technology.js,ui.js',scripts);
  const homeLayout=await layout(['#settlement-batch-kind','#settlement-batch-count','#settlement-batch-preview']);
  check(width+' settlement controls fit',homeLayout.width===width&&!homeLayout.overflow&&homeLayout.controls.every(x=>x.exists&&x.visible&&x.inside),homeLayout);
  await evalJs("document.getElementById('settlement-batch-count').value='3';document.getElementById('settlement-batch-preview').click();document.querySelector('#population-action-content button[onclick*=closePopulationActionModal]').click();'returned'");
  const returnedSettlement=await evalJs("({count:document.getElementById('settlement-batch-count')?.value,modal:document.getElementById('population-action-modal')?.classList.contains('active')})");
  check(width+' return preserves settlement input',returnedSettlement.count==='3'&&!returnedSettlement.modal,returnedSettlement);
  await evalJs("document.getElementById('settlement-batch-count').value='4';'reset'");
  await evalJs("document.querySelector('#settlement-batch-preview').scrollIntoView({block:'center'});document.querySelector('#settlement-batch-preview').click();'clicked'");
  const preview=await modal();
  check(width+' four-level quote 5+6+7+8=26 and +4',preview.active&&preview.confirm&&preview.text.includes('5 + 6 + 7 + 8')&&preview.text.includes('总计 26 地契')&&preview.text.includes('人口上限 +4')&&preview.text.includes('余额 30 → 4'),preview);
  const modalLayout=await layout(['#population-action-content','#population-action-confirm']);
  check(width+' settlement preview dialog fits',!modalLayout.overflow&&modalLayout.controls.every(x=>x.exists&&x.visible&&x.inside),modalLayout);
  await screenshot(width,'settlement-preview');
  await evalJs("document.getElementById('population-action-confirm').click();'confirmed'");
  const expanded=await state();
  check(width+' one click expands to village Lv.4 without births',expanded.village===4&&expanded.capacity===8&&expanded.population===0&&expanded.deed===4&&expanded.stored?.village===4&&expanded.stored?.population===0&&expanded.stored?.deed===4,expanded);
  check(width+' settlement reload',await reload());
  const afterReload=await state();
  check(width+' settlement persisted after reload',afterReload.village===4&&afterReload.capacity===8&&afterReload.deed===4&&afterReload.stored?.village===4&&afterReload.stored?.deed===4,afterReload);

  // Injection is only for exercising the real market panel and click handler.
  const setup=await evalJs("(()=>{S.sciences=[...new Set([...S.sciences,'sci_prospect','sci_coal','sci_copper'])];S.buildings.market={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.res.wood=1000;S.res.coin=0;S.page='build';S._buildTab='economy';const result=save();updateUI();return{saved:result.ok,market:bldSt('market').lv,science:scienceUnlocked('sci_copper')}})()");
  check(width+' market presentation setup saved',setup.saved&&setup.market===1&&setup.science,setup);
  const marketLayout=await layout(['#quick-deed-from','#quick-deed-count','#quick-deed-preview']);
  check(width+' deed controls fit',marketLayout.width===width&&!marketLayout.overflow&&marketLayout.controls.every(x=>x.exists&&x.visible&&x.inside),marketLayout);
  await evalJs("document.getElementById('quick-deed-from').value='stone';document.getElementById('quick-deed-count').value='2';document.getElementById('quick-deed-preview').click();document.querySelector('#population-action-content button[onclick*=closePopulationActionModal]').click();'returned'");
  const returnedDeed=await evalJs("({from:document.getElementById('quick-deed-from')?.value,count:document.getElementById('quick-deed-count')?.value,modal:document.getElementById('population-action-modal')?.classList.contains('active')})");
  check(width+' return preserves invalid deed quote inputs',returnedDeed.from==='stone'&&returnedDeed.count==='2'&&!returnedDeed.modal,returnedDeed);
  await evalJs("document.getElementById('quick-deed-from').value='wood';document.getElementById('quick-deed-count').value='1';const d=document.querySelector('.population-batch-more');d.open=true;document.getElementById('deed-sell-wood').value='11';document.getElementById('deed-sell-stone').value='22';document.getElementById('deed-sell-food').value='33';document.getElementById('deed-basket-count').value='2';document.getElementById('deed-basket-preview').click();document.querySelector('#population-action-content button[onclick*=closePopulationActionModal]').click();'returned'");
  const returnedBasket=await evalJs("({open:document.querySelector('.population-batch-more')?.open,wood:document.getElementById('deed-sell-wood')?.value,stone:document.getElementById('deed-sell-stone')?.value,food:document.getElementById('deed-sell-food')?.value,count:document.getElementById('deed-basket-count')?.value})");
  check(width+' return preserves basket expansion and inputs',returnedBasket.open&&returnedBasket.wood==='11'&&returnedBasket.stone==='22'&&returnedBasket.food==='33'&&returnedBasket.count==='2',returnedBasket);
  await evalJs("document.getElementById('quick-deed-from').value='wood';document.getElementById('quick-deed-count').value='1';'reset'");
  await evalJs("document.getElementById('quick-deed-preview').scrollIntoView({block:'center'});document.getElementById('quick-deed-preview').click();'clicked'");
  const deedPreview=await modal();
  check(width+' wood 1000 to one deed quote',deedPreview.active&&deedPreview.confirm&&deedPreview.text.includes('出售木材 1000 → 铜钱 +100')&&deedPreview.text.includes('花铜钱 100 → 地契 +1'),deedPreview);
  const deedModalLayout=await layout(['#population-action-content','#population-action-confirm']);
  check(width+' deed preview dialog fits',!deedModalLayout.overflow&&deedModalLayout.controls.every(x=>x.exists&&x.visible&&x.inside),deedModalLayout);
  await screenshot(width,'deed-preview');
  await evalJs("document.getElementById('population-action-confirm').click();'confirmed'");
  const purchased=await state();
  check(width+' combined purchase commits once',purchased.wood===0&&purchased.coin===0&&purchased.deed===5&&purchased.stored?.wood===0&&purchased.stored?.coin===0&&purchased.stored?.deed===5,purchased);
  check(width+' deed reload',await reload());
  const final=await state();
  check(width+' deed purchase persisted after reload',final.wood===0&&final.coin===0&&final.deed===5&&final.stored?.wood===0&&final.stored?.coin===0&&final.stored?.deed===5,final);

  const basketSetup=await evalJs("(()=>{S.res.wood=500;S.res.stone=360;S.res.coin=0;S.page='build';S._buildTab='economy';const result=save();updateUI();return result.ok})()");
  check(width+' basket presentation setup saved',basketSetup);
  await evalJs("const d=document.querySelector('.population-batch-more');d.open=true;document.getElementById('deed-sell-wood').value='500';document.getElementById('deed-sell-stone').value='360';document.getElementById('deed-sell-food').value='0';document.getElementById('deed-basket-count').value='1';'entered'");
  const basketLayout=await layout(['#deed-sell-wood','#deed-sell-stone','#deed-sell-food','#deed-basket-count','#deed-basket-preview']);
  check(width+' expanded basket controls fit',!basketLayout.overflow&&basketLayout.controls.every(x=>x.exists&&x.visible&&x.inside),basketLayout);
  await evalJs("document.getElementById('deed-basket-preview').scrollIntoView({block:'center'});document.getElementById('deed-basket-preview').click();'clicked'");
  const basketPreview=await modal();
  check(width+' mixed wood and stone quote',basketPreview.active&&basketPreview.confirm&&basketPreview.text.includes('木材 500 → 铜钱 50')&&basketPreview.text.includes('石料 360 → 铜钱 50')&&basketPreview.text.includes('地契 +1'),basketPreview);
  await screenshot(width,'basket-preview');
  await evalJs("document.getElementById('population-action-confirm').click();'confirmed'");
  const basketDone=await state();
  check(width+' mixed basket commits once',basketDone.wood===0&&basketDone.stone===0&&basketDone.coin===0&&basketDone.deed===6&&basketDone.stored?.wood===0&&basketDone.stored?.stone===0&&basketDone.stored?.coin===0&&basketDone.stored?.deed===6,basketDone);
  check(width+' mixed basket reload',await reload());
  const basketAfterReload=await state();
  check(width+' mixed basket persisted after reload',basketAfterReload.wood===0&&basketAfterReload.stone===0&&basketAfterReload.coin===0&&basketAfterReload.deed===6&&basketAfterReload.stored?.wood===0&&basketAfterReload.stored?.stone===0&&basketAfterReload.stored?.coin===0&&basketAfterReload.stored?.deed===6,basketAfterReload);
}

(async()=>{
  let targets;
  for(let i=0;i<40;i++){
    await sleep(500);
    if(spawnError)throw spawnError;
    try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.some(t=>t.type==='page'))break;}catch(_){}
  }
  const page=targets?.find(t=>t.type==='page'&&t.url===pageUrl)||targets?.find(t=>t.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
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
  check('browser ready',await ready(),pageUrl);
  for(const width of [360,400])await freshAt(width);
  check('zero uncaught browser exceptions',exceptions.length===0,exceptions.slice(0,4));
  console.log(JSON.stringify({checks,exceptions,shots,passed:checks.filter(x=>x.ok).length,failed:checks.filter(x=>!x.ok).length,
    note:'Market readiness is injected for UI coverage; this test does not measure normal progression reachability.'},null,2));
  process.exitCode=checks.some(x=>!x.ok)?1:0;
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error&&error.stack||error);process.exitCode=2;}).finally(async()=>{
  try{ws?.close();}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(250);
  try{if(profile.startsWith(tempRoot+path.sep)&&fs.existsSync(profile))fs.rmSync(profile,{recursive:true,force:true});}
  catch(error){console.error('PROFILE_CLEANUP_FAILED',error.message);}
});
