'use strict';
// Real Edge/CDP smoke for the early development-science chain.
// Run: node tests/progression/era_chain_browser.js
// Seeded knowledge/deeds/materials and the historical save fixture exercise the real UI,
// action guards and persistence; they do not prove natural growth reachability.
// Screenshots and the isolated browser profile stay in the system temp directory.
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
const profile=path.resolve(fs.mkdtempSync(path.join(tempRoot,'era-chain-ui-')));
if(!profile.startsWith(tempRoot+path.sep))throw Error('profile path outside temp');
const pageUrl=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const port=22600+Math.floor(Math.random()*1000);
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
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method));},30000);
    pending.set(id,{resolve,reject,timer});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function evalJs(expression){
  let result;
  try{result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});}
  catch(error){throw Error(`${error.message}: ${expression.slice(0,120)}`);}
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function ready(){
  for(let i=0;i<80;i++){
    try{if(await evalJs("document.readyState==='complete'&&Array.isArray(window.APP_SCRIPTS)&&typeof updateUI==='function'"))return true;}
    catch(_){}
    await sleep(100);
  }
  return false;
}
async function reload(){
  await evalJs("window.__eraReloadMarker=true;'marked'");
  await send('Page.reload',{ignoreCache:true});
  for(let i=0;i<80;i++){
    try{
      if(await evalJs("document.readyState==='complete'&&window.__eraReloadMarker===undefined&&typeof updateUI==='function'"))return true;
    }catch(_){}
    await sleep(100);
  }
  return false;
}
async function setView(width){
  await send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:true});
  await sleep(120);
}
async function viewTech(){await evalJs("(()=>{S.page='tech';updateUI();const graph=document.getElementById('tech-full');if(!graph.open)graph.querySelector('summary').click();graph.querySelector('.tech-tree-nav button[data-category=\"science\"]')?.click();return 'ok'})()");}
async function viewHome(){await evalJs("S.page='home';updateUI();'ok'");}
async function viewBuild(tab){await evalJs(`S.page='build';S._buildTab=${JSON.stringify(tab)};updateUI();'ok'`);}
async function buildingRow(key){
  return evalJs(`(()=>{const entry=document.getElementById('build-${key}');const button=entry?.querySelector('.build-entry-action');return {exists:!!entry&&!entry.hidden,text:entry?.textContent||'',disabled:button?.disabled??null}})()`);
}
async function clickBuild(key){
  return evalJs(`(()=>{const button=[...document.querySelectorAll('#main button[onclick]')].find(e=>e.getAttribute('onclick')==="buildAct('${key}')");if(!button||button.disabled)return false;button.click();return true})()`);
}
async function scienceRow(name){
  return evalJs(`(()=>{const strong=[...document.querySelectorAll('#tech-full .tech-science-row strong')].find(e=>e.textContent.trim()===${JSON.stringify(name)});const row=strong?.closest('.tech-science-row');const button=row?.querySelector('button');return {exists:!!row,visible:!!row&&row.getClientRects().length>0,text:row?.textContent||'',disabled:button?.disabled??null,hasButton:!!button}})()`);
}
async function settlementRow(key){
  return evalJs(`(()=>{const button=[...document.querySelectorAll('#main button[onclick]')].find(e=>e.getAttribute('onclick')?.startsWith("upgradeSettlement('${key}'"));const row=button?.parentElement;return {exists:!!row,text:row?.textContent||'',disabled:button?.disabled??null,reason:settlementLockReason('${key}')}})()`);
}
async function clickResearch(name){
  return evalJs(`(()=>{const strong=[...document.querySelectorAll('#tech-full .tech-science-row strong')].find(e=>e.textContent.trim()===${JSON.stringify(name)});const button=strong?.closest('.tech-science-row')?.querySelector('button');if(!button||button.disabled||!button.getClientRects().length)return false;button.click();return true})()`);
}
async function clickSettlement(key){
  return evalJs(`(()=>{const button=[...document.querySelectorAll('#main button[onclick]')].find(e=>e.getAttribute('onclick')?.startsWith("upgradeSettlement('${key}'"));if(!button||button.disabled)return false;button.click();return true})()`);
}
async function state(){
  return evalJs("(()=>{const stored=JSON.parse(localStorage.getItem('rts_save')||'null');return {sciences:S.sciences.slice(),tech:S.res.tech,deed:S.res.deed,smallTown:S.settlements.smallTown,city:S.settlements.city,capacity:maxPop(),protected:saveProtected(),stored:stored&&{version:stored.v,sciences:stored.sciences,tech:stored.res.tech,deed:stored.res.deed,smallTown:stored.settlements.smallTown,city:stored.settlements.city}}})()");
}
async function layout(){
  return evalJs("(()=>{const main=document.getElementById('main'),phone=document.getElementById('phone'),card=[...document.querySelectorAll('#main .card')].find(e=>e.querySelector('h3')?.textContent.includes('资源科技'));const p=phone.getBoundingClientRect(),c=card?.getBoundingClientRect();const overflow=document.documentElement.scrollWidth>innerWidth+1||document.body.scrollWidth>innerWidth+1||main.scrollWidth>main.clientWidth+1||!!c&&(c.left<p.left-1||c.right>p.right+1);const offenders=overflow?[...document.querySelectorAll('body *')].filter(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>({node:e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.className&&typeof e.className==='string'?'.'+e.className.split(' ').slice(0,2).join('.'):''),right:Math.round(e.getBoundingClientRect().right),scroll:e.scrollWidth,client:e.clientWidth})):[];return {width:innerWidth,visualWidth:visualViewport?.width,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,main:main.scrollWidth,mainClient:main.clientWidth,card:!!c,cardLeft:c?.left,cardRight:c?.right,phoneLeft:p.left,phoneRight:p.right,phoneWidth:p.width,phoneCss:getComputedStyle(phone).width,offenders,overflow}})()");
}
async function shot(width,name,target){
  if(target){
    await evalJs(`(()=>{const strong=[...document.querySelectorAll('#main strong')].find(e=>e.textContent.trim()===${JSON.stringify(target)});strong?.scrollIntoView({block:'center'});return !!strong})()`);
    await sleep(120);
  }
  const result=await send('Page.captureScreenshot',{format:'png'});
  const file=path.join(tempRoot,'era-chain-ui-'+process.pid+'-'+width+'-'+name+'.png');
  fs.writeFileSync(file,Buffer.from(result.data,'base64'));
  shots.push(file);
}
async function seedKnowledge(id){
  return evalJs(`(()=>{S.res.tech=activeSciences()['${id}'].cost.tech;S.page='tech';updateUI();return S.res.tech})()`);
}
async function research(width,id,name){
  const price=await seedKnowledge(id);
  const before=await scienceRow(name);
  check(width+' '+name+' research button ready',before.exists&&before.visible&&before.hasButton&&before.disabled===false,{price,before});
  check(width+' '+name+' clicked through UI',await clickResearch(name));
  const after=await state();
  check(width+' '+name+' persisted once',after.sciences.includes(id)&&after.stored?.sciences.includes(id)&&after.tech===0&&after.stored?.tech===0,after);
}
async function freshChain(width){
  await setView(width);
  await evalJs("localStorage.clear();'cleared'");
  check(width+' clean reload',await reload());
  await viewTech();
  const scripts=await evalJs("window.APP_SCRIPTS.join(',')");
  check(width+' game script order',scripts==='config.js,levels.js,sprites.js,math.js,garrison.js,technology.js,ui.js',scripts);
  const fresh=await state();
  check(width+' new save omits historical research',!fresh.sciences.includes('sci_metal')&&!(await scienceRow('冶金术')).exists,fresh);
  check(width+' urbanization hidden before copper prerequisite',!(await scienceRow('城镇化')).exists);
  check(width+' iron hidden before urbanization prerequisite',!(await scienceRow('冶铁术')).exists);
  check(width+' city hidden before iron prerequisite',!(await scienceRow('城市化')).exists);
  const freshLayout=await layout();
  check(width+' new science page fits',freshLayout.width===width&&!freshLayout.overflow,freshLayout);
  await shot(width,'fresh-sciences','城镇化');

  const freshCaps=await evalJs("({wood:resCap('wood'),stone:resCap('stone'),food:resCap('food'),woodLabel:document.getElementById('cap-wood').textContent,stoneLabel:document.getElementById('cap-stone').textContent})");
  check(width+' fresh wood stone food caps in state and topbar',freshCaps.wood===1800&&freshCaps.stone===1200&&freshCaps.food===3000&&freshCaps.woodLabel==='/1800'&&freshCaps.stoneLabel==='/1200',freshCaps);
  await viewBuild('basic');
  const warehouseLocked=await buildingRow('warehouse');
  check(width+' new warehouse requires storage research',warehouseLocked.exists&&warehouseLocked.disabled&&warehouseLocked.text.includes('木石仓储'),warehouseLocked);
  await viewTech();
  for(const [id,name] of [['sci_prospect','探矿术'],['sci_wood_store','木石仓储'],['sci_coal','煤炭开采'],['sci_copper','冶铜术']])
    await research(width,id,name);
  await viewHome();
  const currencyLocked=await evalJs("(()=>{const b=[...document.querySelectorAll('#main button[onclick]')].find(e=>e.getAttribute('onclick')===\"setPopAlloc('coin',(S.popAlloc['coin']||0)+1)\");return {exists:!!b,disabled:b?.disabled,text:document.getElementById('main').textContent}})()");
  check(width+' copper coin worker needs currency research',currencyLocked.exists&&currencyLocked.disabled&&currencyLocked.text.includes('铸币技术'),currencyLocked);
  await viewTech();
  await research(width,'sci_currency','铸币技术');
  await viewHome();
  await evalJs("S.population.current=4;S.res.copper=5;S.res.food=1000;updateUI();'seeded copper and free population for UI only'");
  const currencyReady=await evalJs("(()=>{const b=[...document.querySelectorAll('#main button[onclick]')].find(e=>e.getAttribute('onclick')===\"setPopAlloc('coin',(S.popAlloc['coin']||0)+1)\");return {exists:!!b,disabled:b?.disabled,label:document.getElementById('coin-label').textContent}})()");
  check(width+' copper coin worker and topbar label unlocked',currencyReady.exists&&!currencyReady.disabled&&currencyReady.label==='铜钱',currencyReady);
  const currencyClick=await evalJs("(()=>{const b=[...document.querySelectorAll('#main button[onclick]')].find(e=>e.getAttribute('onclick')===\"setPopAlloc('coin',(S.popAlloc['coin']||0)+1)\");if(!b||b.disabled)return false;b.click();return true})()");
  check(width+' copper coin worker assigned through UI',currencyClick);
  const currencyProduced=await evalJs("(()=>{const before={coin:S.res.coin,copper:S.res.copper};tick();const d=JSON.parse(localStorage.getItem('rts_save'));return {coin:S.res.coin-before.coin,copper:S.res.copper-before.copper,mode:S.currencyRecipeMode,storedMode:d.currencyRecipeMode,workers:S.popAlloc.coin,storedWorkers:d.popAlloc.coin,version:d.v}})()");
  check(width+' copper coin produced and saved',currencyProduced.coin===2&&currencyProduced.copper===-1&&currencyProduced.mode==='copper'&&currencyProduced.storedMode==='copper'&&currencyProduced.workers===1&&currencyProduced.storedWorkers===1&&currencyProduced.version===33,currencyProduced);
  await evalJs("setPopAlloc('coin',0);'cleared coin worker after UI coverage'");
  await viewBuild('basic');
  await evalJs("S.res.wood=800;updateUI();'seeded warehouse material for UI only'");
  const warehouseReady=await buildingRow('warehouse');
  check(width+' warehouse displays aligned cost',warehouseReady.exists&&!warehouseReady.disabled&&warehouseReady.text.includes('800'),warehouseReady);
  check(width+' warehouse clicked through UI',await clickBuild('warehouse'));
  const warehouseDone=await evalJs("(()=>{for(let i=0;i<20;i++)tick();return {lv:bldSt('warehouse').lv,wood:resCap('wood'),stone:resCap('stone'),food:resCap('food'),woodLabel:document.getElementById('cap-wood').textContent,stoneLabel:document.getElementById('cap-stone').textContent}})()");
  check(width+' completed warehouse expands separate caps',warehouseDone.lv===1&&warehouseDone.wood===2400&&warehouseDone.stone===1600&&warehouseDone.food===3000&&warehouseDone.woodLabel==='/2400'&&warehouseDone.stoneLabel==='/1600',warehouseDone);
  await viewTech();
  await seedKnowledge('sci_bronze_age');
  const bronzeBlocked=await scienceRow('青铜时代');
  const bronzeReject=await evalJs("researchScience('sci_bronze_age')");
  check(width+' bronze hidden before granary research and action guarded',!bronzeBlocked.exists&&bronzeReject.reason==='science-prerequisite',bronzeBlocked);
  await viewBuild('basic');
  const granaryLocked=await buildingRow('large_granary');
  check(width+' granary build locked before research',granaryLocked.exists&&granaryLocked.disabled===true&&granaryLocked.text.includes('大粮仓'),granaryLocked);
  await research(width,'sci_large_granary','大粮仓');
  await viewBuild('basic');
  await evalJs("S.res.wood=2000;S.res.food=2000;S.res.stone=1000;updateUI();'seeded materials for UI only'");
  const granaryReady=await buildingRow('large_granary');
  check(width+' granary build unlocked',granaryReady.exists&&granaryReady.disabled===false,granaryReady);
  check(width+' granary clicked through UI',await clickBuild('large_granary'));
  const granaryDone=await evalJs("(()=>{for(let i=0;i<20;i++)tick();return {lv:bldSt('large_granary').lv,foodCap:resCap('food'),base:storageCapacity('food'),stored:JSON.parse(localStorage.getItem('rts_save')).buildings.large_granary?.lv}})()");
  check(width+' granary complete adds food cap and persists',granaryDone.lv===1&&granaryDone.foodCap===granaryDone.base+2000&&granaryDone.stored===1,granaryDone);
  const granaryLayout=await layout();
  check(width+' granary build page fits',!granaryLayout.overflow,granaryLayout);
  await shot(width,'granary-building');
  await viewTech();
  await research(width,'sci_bronze_age','青铜时代');
  await shot(width,'granary-branch','青铜时代');
  await seedKnowledge('sci_iron');
  const ironBlocked=await scienceRow('冶铁术');
  const masterBefore=await evalJs("localStorage.getItem('rts_save')");
  const rejected=await evalJs("(()=>{const before=S.res.tech,result=researchScience('sci_iron');return {result,tech:S.res.tech,before,studied:S.sciences.includes('sci_iron')}})()");
  const masterAfter=await evalJs("localStorage.getItem('rts_save')");
  check(width+' iron hidden before urbanization',!ironBlocked.exists,ironBlocked);
  check(width+' iron action guard does not charge or save',rejected.result.ok===false&&rejected.result.reason==='science-prerequisite'&&rejected.tech===rejected.before&&!rejected.studied&&masterAfter===masterBefore,rejected);
  await shot(width,'iron-gated','冶铁术');

  await research(width,'sci_urbanization','城镇化');
  await viewHome();
  const smallTown=await settlementRow('smallTown');
  check(width+' small town expansion unlocked',smallTown.exists&&!smallTown.disabled&&smallTown.reason==='',smallTown);
  check(width+' small town clicked through UI',await clickSettlement('smallTown'));
  const expanded=await state();
  check(width+' small town expansion saved',expanded.smallTown===1&&expanded.capacity===6&&expanded.stored?.smallTown===1&&expanded.stored?.deed===expanded.deed,expanded);
  await shot(width,'small-town-open');

  const policyLocked=await evalJs("(()=>{const b=[...document.querySelectorAll('#main button[onclick]')].find(e=>e.getAttribute('onclick')===\"setSmallTownPolicy(0,'birth')\");return {exists:!!b,disabled:b?.disabled,text:document.getElementById('main').textContent.includes('小镇政策')}})()");
  check(width+' birth policy slot visible but locked before science',policyLocked.exists&&policyLocked.disabled&&policyLocked.text,policyLocked);
  await viewTech();
  await research(width,'sci_birth_policy','鼓励生育');
  await viewHome();
  const policyClick=await evalJs("(()=>{const b=[...document.querySelectorAll('#main button[onclick]')].find(e=>e.getAttribute('onclick')===\"setSmallTownPolicy(0,'birth')\");if(!b||b.disabled)return false;b.click();return true})()");
  check(width+' birth policy applied through UI',policyClick);
  const policyState=await evalJs("(()=>{const d=JSON.parse(localStorage.getItem('rts_save'));return {growth:popGrowthPer10s(),slots:S.townPolicies.smallTown,stored:d.townPolicies.smallTown,version:d.v}})()");
  check(width+' birth policy persisted and adds five per ten seconds',policyState.growth===7&&policyState.slots[0]==='birth'&&policyState.stored[0]==='birth'&&policyState.version===33,policyState);
  const policyBirth=await evalJs("(()=>{S.population.current=0;S.population.growthClock=0;S.res.food=1000;for(let i=0;i<10;i++)tick();return {population:popCurrent(),capacity:maxPop(),stored:JSON.parse(localStorage.getItem('rts_save')).population.current}})()");
  check(width+' policy online births stop at housing capacity',policyBirth.population===6&&policyBirth.capacity===6&&policyBirth.stored===6,policyBirth);
  check(width+' policy home fits narrow viewport',!(await layout()).overflow);

  await seedKnowledge('sci_city');
  const cityBlocked=await scienceRow('城市化');
  const cityReject=await evalJs("(()=>{const before=S.res.tech,result=researchScience('sci_city');return {result,tech:S.res.tech,before,studied:S.sciences.includes('sci_city')}})()");
  check(width+' city hidden before iron',!cityBlocked.exists,cityBlocked);
  check(width+' city action guard rejects bypass',cityReject.result.ok===false&&cityReject.result.reason==='science-prerequisite'&&cityReject.tech===cityReject.before&&!cityReject.studied,cityReject);
  await research(width,'sci_iron','冶铁术');
  await seedKnowledge('sci_iron_age');
  const ironAgeBlocked=await scienceRow('铁器时代');
  const ironAgeReject=await evalJs("researchScience('sci_iron_age')");
  check(width+' iron age hidden before iron warehouse and action guarded',!ironAgeBlocked.exists&&ironAgeReject.reason==='science-prerequisite',ironAgeBlocked);
  await viewBuild('economy');
  const ironStoreLocked=await buildingRow('iron_store');
  check(width+' iron store build locked before research',ironStoreLocked.exists&&ironStoreLocked.disabled===true,ironStoreLocked);
  await research(width,'sci_iron_warehouse','铁仓库');
  await viewBuild('economy');
  await evalJs("S.res.wood=1000;S.res.stone=1000;S.res.food=1000;S.res.iron=250;updateUI();'seeded materials for UI only'");
  const ironStoreReady=await buildingRow('iron_store');
  check(width+' iron store build unlocked',ironStoreReady.exists&&ironStoreReady.disabled===false,ironStoreReady);
  check(width+' iron store clicked through UI',await clickBuild('iron_store'));
  const ironStoreDone=await evalJs("(()=>{for(let i=0;i<20;i++)tick();return {lv:bldSt('iron_store').lv,cap:resCap('iron'),iron:S.res.iron,stored:JSON.parse(localStorage.getItem('rts_save')).buildings.iron_store?.lv}})()");
  check(width+' iron store spends 200 iron, adds cap and persists',ironStoreDone.lv===1&&ironStoreDone.cap===800&&ironStoreDone.iron===50&&ironStoreDone.stored===1,ironStoreDone);
  const ironStoreLayout=await layout();
  check(width+' iron store build page fits',!ironStoreLayout.overflow,ironStoreLayout);
  await shot(width,'iron-store-building');
  await viewTech();
  await research(width,'sci_iron_age','铁器时代');
  await shot(width,'iron-storage-branch','铁器时代');
  await seedKnowledge('sci_city');
  const cityReady=await scienceRow('城市化');
  check(width+' city research enabled after iron',cityReady.exists&&cityReady.disabled===false,cityReady);
  await research(width,'sci_city','城市化');
  await evalJs("S.res.deed=100;S.page='home';updateUI();'seeded deed for UI only'");
  const cityOpen=await settlementRow('city');
  check(width+' city expansion unlocked',cityOpen.exists&&!cityOpen.disabled&&cityOpen.reason==='',cityOpen);
  check(width+' city expansion clicked through UI',await clickSettlement('city'));
  const cityExpanded=await state();
  check(width+' city expansion saved',cityExpanded.city===2&&cityExpanded.capacity===10&&cityExpanded.stored?.city===2&&cityExpanded.stored?.deed===cityExpanded.deed,cityExpanded);
  await viewHome();
  const silverLocked=await evalJs("(()=>{const b=[...document.querySelectorAll('#main button[onclick]')].find(e=>e.getAttribute('onclick')===\"setPopAlloc('silver',(S.popAlloc['silver']||0)+1)\");return {disabled:b?.disabled,hidden:document.getElementById('top-silver').style.display,text:document.getElementById('main').textContent}})()");
  check(width+' silver worker locked before city silver research',silverLocked.disabled===true&&silverLocked.hidden==='none'&&silverLocked.text.includes('冶银技术'),silverLocked);
  await viewTech();
  await research(width,'sci_silver','冶银技术');
  await viewHome();
  await evalJs("S.population.current=10;S.res.stone=100;S.res.coal=50;S.res.food=1000;updateUI();'seeded silver inputs and free population for UI only'");
  const silverReady=await evalJs("(()=>{const buttons=[...document.querySelectorAll('#main button[onclick]')];const find=k=>buttons.find(e=>e.getAttribute('onclick')===\"setPopAlloc('\"+k+\"',(S.popAlloc['\"+k+\"']||0)+1)\");return {metal:!!find('silver')&&!find('silver').disabled,money:!!find('silverCoin')&&!find('silverCoin').disabled,shown:document.getElementById('top-silver').style.display!==\"none\"&&document.getElementById('top-silverCoin').style.display!==\"none\"}})()");
  check(width+' silver and silver money workers visible and unlocked',silverReady.metal&&silverReady.money&&silverReady.shown,silverReady);
  const silverClicks=await evalJs("(()=>{const click=k=>{const b=[...document.querySelectorAll('#main button[onclick]')].find(e=>e.getAttribute('onclick')===\"setPopAlloc('\"+k+\"',(S.popAlloc['\"+k+\"']||0)+1)\");if(!b||b.disabled)return false;b.click();return true};return {silver:click('silver'),silverCoin:click('silverCoin')}})()");
  check(width+' both silver jobs assigned through UI',silverClicks.silver&&silverClicks.silverCoin,silverClicks);
  const silverProduced=await evalJs("(()=>{const before={stone:S.res.stone,coal:S.res.coal,silverCoin:S.res.silverCoin};for(let i=0;i<3;i++)tick();const d=JSON.parse(localStorage.getItem('rts_save'));return {stone:S.res.stone-before.stone,coal:S.res.coal-before.coal,silverCoin:S.res.silverCoin-before.silverCoin,storedSilver:d.popAlloc.silver,storedMoney:d.popAlloc.silverCoin,version:d.v}})()");
  check(width+' silver chain production and save in browser',silverProduced.stone===-6&&silverProduced.coal===-3&&Math.abs(silverProduced.silverCoin-2)<1e-8&&silverProduced.storedSilver===1&&silverProduced.storedMoney===1&&silverProduced.version===33,silverProduced);
  await evalJs("setPopAlloc('silver',0);setPopAlloc('silverCoin',0);S.res.wood=1000;S.res.stone=1000;S.res.food=1000;S.res.silverCoin=200;S.page='build';S._buildTab='economy';updateUI();'seeded market materials and exchange stock for UI only'");
  const marketReady=await buildingRow('market');
  check(width+' silver market building ready',marketReady.exists&&!marketReady.disabled,marketReady);
  check(width+' silver market built through UI',await clickBuild('market'));
  await evalJs("for(let i=0;i<10;i++)tick();'market completed'");
  const silverTrade=await evalJs("(()=>{const select=document.getElementById('mk-rate'),option=[...select.options].find(o=>o.value==='silverCoin|deed');if(!option)return {found:false};select.value=option.value;document.getElementById('mk-qty').value='200';const before={money:S.res.silverCoin,deed:S.res.deed,daily:dailyCount('market')};document.querySelector('#main button[onclick=\"marketExchange(this)\"]').click();const d=JSON.parse(localStorage.getItem('rts_save'));return {found:true,money:S.res.silverCoin-before.money,deed:S.res.deed-before.deed,daily:dailyCount('market')-before.daily,storedDeed:d.res.deed,version:d.v}})()");
  check(width+' silver money buys deed through market UI',silverTrade.found&&silverTrade.money===-200&&silverTrade.deed===1&&silverTrade.daily===0&&silverTrade.storedDeed===cityExpanded.deed+1&&silverTrade.version===33,silverTrade);
  await viewTech();
  check(width+' silver store and age are parallel research',
    (await scienceRow('小银库')).text.includes('前置「冶银技术」')&&
    (await scienceRow('白银时代')).text.includes('前置「冶银技术」'));
  await research(width,'sci_silver_store','小银库');
  await viewBuild('economy');
  await evalJs("S.res.silver=150;updateUI();'seeded first silver store cost for UI'");
  const silverStoreRow=await buildingRow('silver_store');
  check(width+' silver store shows silver cost',silverStoreRow.text.includes('150')&&!silverStoreRow.disabled,silverStoreRow);
  check(width+' silver store built through UI',await clickBuild('silver_store'));
  const silverStoreDone=await evalJs("(()=>{advanceBuildingsBy(30);save();updateUI();return {cap:resCap('silver'),lv:bldSt('silver_store').lv,stored:JSON.parse(localStorage.getItem('rts_save')).buildings.silver_store?.lv}})()");
  check(width+' silver store capacity and save',silverStoreDone.cap===400&&silverStoreDone.lv===1&&silverStoreDone.stored===1,silverStoreDone);
  await viewTech();
  await research(width,'sci_silver_refinery','冶银厂');
  await research(width,'sci_silver_age','白银时代');
  await viewBuild('economy');
  await evalJs("S.res.iron=500;S.res.wood=1000;S.res.food=1500;updateUI();'seeded refinery inputs for UI'");
  check(width+' refinery built through UI',await clickBuild('silver_refinery'));
  const refineryDone=await evalJs("(()=>{advanceBuildingsBy(30);save();updateUI();return {lv:bldSt('silver_refinery').lv,buff:buildingBuff('silver')}})()");
  check(width+' refinery production buff',refineryDone.lv===1&&Math.abs(refineryDone.buff-0.1)<1e-8,refineryDone);
  await viewBuild('barracks');
  await evalJs("S.res.wood=600;S.res.stone=600;S.res.food=2000;updateUI();'seeded silver armory cost for UI'");
  check(width+' silver armory built through UI',await clickBuild('silver_armory'));
  await evalJs("advanceBuildingsBy(30);S.res.silver=100;save();S.page='barracks';S._barracksTab='train';updateUI();'silver unit ready'");
  const silverTrain=await evalJs("(()=>{const b=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===\"trainCustom('silver_heavy','train-barracks-silver_heavy')\");if(!b||b.disabled)return {found:!!b,disabled:b?.disabled};b.click();processQueue();return {found:true,count:S.pool.silver_heavy||0,silver:S.res.silver,food:S.res.food,stored:JSON.parse(localStorage.getItem('rts_save')).pool.silver_heavy||0}})()");
  check(width+' silver heavy recruit through UI and save',silverTrain.found&&silverTrain.count===1&&silverTrain.silver===0&&silverTrain.stored===1,silverTrain);
  await viewTech();
  check(width+' gold metallurgy follows silver age',(await scienceRow('冶金技术')).text.includes('前置「白银时代」'));
  await research(width,'sci_gold','冶金技术');
  await viewHome();
  await evalJs("S.population.current=10;S.res.stone=100;S.res.coal=50;S.res.food=2000;updateUI();'seeded gold inputs and free population for UI'");
  const goldWorker=await evalJs("(()=>{const b=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===\"setPopAlloc('gold',(S.popAlloc['gold']||0)+1)\");if(!b||b.disabled)return {found:!!b,disabled:b?.disabled};b.click();const before={stone:S.res.stone,coal:S.res.coal,gold:S.res.gold};for(let i=0;i<4;i++)tick();return {found:true,shown:document.getElementById('top-gold').style.display!=='none',gold:S.res.gold-before.gold,stone:S.res.stone-before.stone,coal:S.res.coal-before.coal,stored:JSON.parse(localStorage.getItem('rts_save')).popAlloc.gold}})()");
  check(width+' gold worker and topbar use four-second recipe',goldWorker.found&&goldWorker.shown&&Math.abs(goldWorker.gold-1)<1e-8&&goldWorker.stone===-8&&goldWorker.coal===-4&&goldWorker.stored===1,goldWorker);
  await evalJs("setPopAlloc('gold',0);'gold worker released'");
  await viewTech();
  await research(width,'sci_gold_store','小金库');
  await viewBuild('economy');
  await evalJs("S.res.gold=150;updateUI();'seeded gold store first payment'");
  check(width+' gold store built through UI',await clickBuild('gold_store'));
  const goldStoreDone=await evalJs("(()=>{advanceBuildingsBy(30);save();updateUI();return {lv:bldSt('gold_store').lv,cap:resCap('gold')}})()");
  check(width+' gold store capacity',goldStoreDone.lv===1&&goldStoreDone.cap===400,goldStoreDone);
  await viewTech();
  await research(width,'sci_gold_refinery','冶金厂');
  await research(width,'sci_gold_age','黄金时代');
  await viewBuild('economy');
  await evalJs("S.res.silver=180;updateUI();'seeded silver store upgrade'");
  check(width+' second silver store level built through UI',await clickBuild('silver_store'));
  const silverCap500=await evalJs("(()=>{advanceBuildingsBy(30);save();updateUI();return {lv:bldSt('silver_store').lv,cap:resCap('silver')}})()");
  check(width+' gold refinery silver capacity prerequisite',silverCap500.lv===2&&silverCap500.cap===500,silverCap500);
  await evalJs("S.res.silver=500;S.res.wood=1000;S.res.food=1500;updateUI();'seeded gold refinery cost'");
  check(width+' gold refinery built through UI',await clickBuild('gold_refinery'));
  const goldRefineryDone=await evalJs("(()=>{advanceBuildingsBy(30);save();updateUI();return {lv:bldSt('gold_refinery').lv,buff:buildingBuff('gold')}})()");
  check(width+' gold refinery buff',goldRefineryDone.lv===1&&Math.abs(goldRefineryDone.buff-0.1)<1e-8,goldRefineryDone);
  await viewBuild('barracks');
  await evalJs("S.res.wood=800;S.res.stone=700;S.res.food=2500;updateUI();'seeded gold armory cost'");
  check(width+' gold armory built through UI',await clickBuild('gold_armory'));
  await evalJs("advanceBuildingsBy(30);S.res.gold=100;save();S.page='barracks';S._barracksTab='train';updateUI();'gold cavalry ready'");
  const goldTrain=await evalJs("(()=>{const b=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===\"trainCustom('gold_cavalry','train-barracks-gold_cavalry')\");if(!b||b.disabled)return {found:!!b,disabled:b?.disabled};b.click();processQueue();return {found:true,count:S.pool.gold_cavalry||0,gold:S.res.gold,stored:JSON.parse(localStorage.getItem('rts_save')).pool.gold_cavalry||0}})()");
  check(width+' gold cavalry recruit through UI and save',goldTrain.found&&goldTrain.count===1&&goldTrain.gold===0&&goldTrain.stored===1,goldTrain);
  const positionHint=await evalJs("(()=>{S.page='fight';S._fightTab='expedition';updateUI();const expedition=[...document.querySelectorAll('#main .card')].find(x=>x.querySelector('h3')?.textContent.includes('远征阵容'))?.textContent||'';openFormModal('expedition','mid',0);const expeditionModal=document.getElementById('form-modal-content').textContent;closeFormModal();S._fightTab='garrison';updateUI();const garrison=[...document.querySelectorAll('#main .card')].find(x=>x.querySelector('h3')?.textContent.includes('驻军阵容'))?.textContent||'';openFormModal('garrison','back',0);const garrisonModal=document.getElementById('form-modal-content').textContent;closeFormModal();return {expedition:expedition.includes('近战兵只在前排主动攻击')&&expedition.includes('推进后才可出手'),garrison:garrison.includes('近战兵只在前排主动攻击')&&garrison.includes('推进后才可出手'),expeditionModal:expeditionModal.includes('黄金重骑兵')&&expeditionModal.includes('在本排时无法主动攻击'),garrisonModal:garrisonModal.includes('黄金重骑兵')&&garrisonModal.includes('在本排时无法主动攻击')}})()");
  check(width+' melee row guidance in expedition and garrison',Object.values(positionHint).every(Boolean),positionHint);
  check(width+' melee row guidance fits viewport',!(await layout()).overflow);
  await viewTech();
  check(width+' steel metallurgy follows gold age',(await scienceRow('冶钢技术')).text.includes('前置「黄金时代」'));
  await research(width,'sci_steel','冶钢技术');
  await viewHome();
  await evalJs("for(const rk of Object.keys(S.popAlloc))S.popAlloc[rk]=0;S.population.current=26;S.res.iron=20;S.res.stone=20;S.res.coal=20;S.res.food=2500;save();updateUI();'steel worker inputs ready'");
  const steelWorker=await evalJs("(()=>{const b=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===\"setPopAlloc('steel',(S.popAlloc['steel']||0)+1)\");if(!b||b.disabled)return {found:!!b,disabled:b?.disabled};b.click();const before={iron:S.res.iron,stone:S.res.stone,coal:S.res.coal,steel:S.res.steel};for(let i=0;i<4;i++)tick();const d=JSON.parse(localStorage.getItem('rts_save'));return {found:true,shown:document.getElementById('top-steel').style.display!=='none',iron:S.res.iron-before.iron,stone:S.res.stone-before.stone,coal:S.res.coal-before.coal,steel:S.res.steel-before.steel,stored:d.popAlloc.steel,version:d.v}})()");
  check(width+' steel worker and topbar use four-second recipe',steelWorker.found&&steelWorker.shown&&steelWorker.iron===-4&&steelWorker.stone===-4&&steelWorker.coal===-4&&Math.abs(steelWorker.steel-1)<1e-8&&steelWorker.stored===1&&steelWorker.version===33,steelWorker);
  await evalJs("setPopAlloc('steel',0);'steel worker released'");
  await viewTech();
  await research(width,'sci_steel_store','钢仓库');
  await research(width,'sci_steel_refinery','冶钢厂');
  await research(width,'sci_alloy_age','合金时代');
  const alloyGearStart=await evalJs("({tech:S.res.tech,medal:S.res.medal,steel:S.res.steel})");
  const alloySword=await evalJs("(()=>{S.res.tech=10000;S.res.medal=160;S.res.steel=8000;S.page='tech';updateUI();const button=key=>[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===key);const armorHidden=!button(\"researchWeapon('alloyArmor')\");const swordReady=!button(\"researchWeapon('alloySword')\")?.disabled;button(\"researchWeapon('alloySword')\")?.click();const armorReady=!button(\"researchWeapon('alloyArmor')\")?.disabled;let invested=0;for(let i=0;i<20;i++){const b=button(\"forgeWeapon('alloySword')\");if(!b||b.disabled)break;b.click();invested++}button(\"setWeaponEquipped('alloySword',true)\")?.click();return {armorHidden,swordReady,armorReady,invested,level:S.weaponForge.alloySword.level,atk:weaponAttack('alloy_special'),tech:S.res.tech,medal:S.res.medal,steel:S.res.steel}})()");
  check(width+' alloy sword UI reveals armor after prerequisite and pays 20 forging steps',alloySword.armorHidden&&alloySword.swordReady&&alloySword.armorReady&&alloySword.invested===20&&alloySword.level===1&&alloySword.atk===37&&alloySword.tech===5000&&alloySword.medal===80&&alloySword.steel===4000,alloySword);
  const alloyArmor=await evalJs("(()=>{const button=key=>[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===key);button(\"researchWeapon('alloyArmor')\")?.click();let invested=0;for(let i=0;i<20;i++){const b=button(\"forgeWeapon('alloyArmor')\");if(!b||b.disabled)break;b.click();invested++}const shown=button(\"setWeaponEquipped('alloyArmor',true)\")?.closest('.card')?.textContent||'';button(\"setWeaponEquipped('alloyArmor',true)\")?.click();const saved=JSON.parse(localStorage.getItem('rts_save'));return {invested,shown,level:S.weaponForge.alloyArmor.level,def:weaponDefense('alloy_special'),tech:S.res.tech,medal:S.res.medal,steel:S.res.steel,savedArmor:saved.weaponForge.alloyArmor,version:saved.v}})()");
  check(width+' alloy armor UI pays, equips, and saves defense bonus',alloyArmor.invested===20&&alloyArmor.shown.includes('防御+10')&&alloyArmor.level===1&&alloyArmor.def===28&&alloyArmor.tech===0&&alloyArmor.medal===0&&alloyArmor.steel===0&&alloyArmor.savedArmor?.equipped&&alloyArmor.version===33,alloyArmor);
  check(width+' alloy gear card fits narrow viewport',!(await layout()).overflow);
  await shot(width,'alloy-gear','合金甲');
  await evalJs(`S.res.tech=${alloyGearStart.tech};S.res.medal=${alloyGearStart.medal};S.res.steel=${alloyGearStart.steel};save();updateUI();'alloy gear UI seed restored'`);
  const godLocked=await evalJs("(()=>{S.page='fight';S._fightTab='expedition';updateUI();const card=[...document.querySelectorAll('#main .card')].find(e=>e.querySelector('h3')?.textContent.includes('机巧遗迹'));const button=card?.querySelector('button');openGodDomain();return {card:!!card,text:card?.textContent,disabled:button?.disabled,active:S.battleActive}})()");
  check(width+' god domain card locked before research',godLocked.card&&godLocked.disabled&&godLocked.text.includes('知识 50000')&&!godLocked.active,godLocked);
  await evalJs("S.page='tech';S.res.tech=50000;S.res.steel=5000;updateUI();'god research seeded'");
  const godRow=await scienceRow('遗迹勘探');
  check(width+' god domain science ready',godRow.exists&&!godRow.disabled&&godRow.text.includes('钢 5000'),godRow);
  check(width+' god domain science clicked',await clickResearch('遗迹勘探'));
  const godStudied=await evalJs("(()=>{const saved=JSON.parse(localStorage.getItem('rts_save'));return {studied:S.sciences.includes('sci_god_domain'),tech:S.res.tech,steel:S.res.steel,saved:saved.sciences.includes('sci_god_domain')}})()");
  check(width+' god domain paid and persisted',godStudied.studied&&godStudied.tech===0&&godStudied.steel===0&&godStudied.saved,godStudied);
  const godLaunch=await evalJs("(()=>{S.formation={front:[{type:'infantry',count:8,id:12001}],mid:[],back:[]};S.page='fight';S._fightTab='expedition';CFG.battleStepDelay=60000;updateUI();const card=[...document.querySelectorAll('#main .card')].find(e=>e.querySelector('h3')?.textContent.includes('机巧遗迹'));const button=card?.querySelector('button');button?.click();const out={enabled:button?.disabled===false,active:S.battleActive,encounter:S.battleEncounter,enemy:B.enemyCfg?.name,crystal:S.items.godCrystal};fleeBattle();const afterFlee=S.items.godCrystal,cleared=S.battleEncounter===null;S.formation={front:[],mid:[],back:[]};save();return {...out,cleared,afterFlee}})()");
  check(width+' god domain UI launches separate fight and flee gives no crystal',godLaunch.enabled&&godLaunch.active&&godLaunch.encounter==='godCrystal'&&godLaunch.enemy==='机巧遗迹·守卫机兵'&&godLaunch.crystal===0&&godLaunch.cleared&&godLaunch.afterFlee===0,godLaunch);
  const godCurve=await evalJs("(()=>{S.killValues.godRevival=200;S.formation={front:[{type:'infantry',count:8,id:12002}],mid:[],back:[]};S.page='fight';updateUI();const card=[...document.querySelectorAll('#main .card')].find(e=>e.querySelector('h3')?.textContent.includes('机巧遗迹'));const preview=card?.textContent||'';card?.querySelector('button')?.click();const out={preview,enemyHp:B.enemyUnits[0]?.hp,attackMass:B.enemyUnits[0]?.attackMass,bossUnit:document.getElementById('battle-field')?.textContent||'',battleTitle:document.getElementById('battle-title')?.textContent||'',reward:B.enemyCfg?.reward.godCrystal};fleeBattle();S.killValues.godRevival=0;S.formation={front:[],mid:[],back:[]};save();return out})()");
  check(width+' god domain card previews growing reward and single boss HP',godCurve.preview.includes('遗迹晶核 ×2')&&godCurve.preview.includes('战备勋章 ×104')&&godCurve.preview.includes('警戒值 200')&&godCurve.enemyHp===52&&godCurve.attackMass===40&&godCurve.bossUnit.includes('52/52HP')&&godCurve.battleTitle.includes('1个目标·生命52')&&godCurve.reward===2,godCurve);
  const soldierHp=await evalJs("(()=>{S.formation={front:[{type:'alloy_special',count:10,id:12003}],mid:[],back:[]};openGodDomain();const out={hp:B.ourUnits[0]?.hp,attackMass:combatAttackMass(B.ourUnits[0]),shown:document.querySelector('#ou-0 .unit-hpcount')?.textContent||'',title:document.getElementById('ou-0')?.title||'',battleTitle:document.getElementById('battle-title')?.textContent||''};fleeBattle();S.formation={front:[],mid:[],back:[]};save();return out})()");
  check(width+' alloy troops display soldiers separately from aggregate HP',soldierHp.hp===55&&soldierHp.attackMass===10&&soldierHp.shown.includes('10/10人')&&soldierHp.title.includes('生命55/55HP')&&soldierHp.battleTitle.includes('我方1团10人'),soldierHp);
  await viewTech();
  await viewBuild('economy');
  const steelCapsBefore=await evalJs("({steel:resCap('steel'),iron:resCap('iron'),copper:resCap('copper')})");
  await evalJs("S.res.iron=200;S.res.steel=200;updateUI();'steel store payment ready'");
  check(width+' steel store built through UI',await clickBuild('steel_store'));
  const steelCapsAfter=await evalJs("(()=>{advanceBuildingsBy(30);save();updateUI();return {steel:resCap('steel'),iron:resCap('iron'),copper:resCap('copper')}})()");
  check(width+' steel store expands metal capacities',steelCapsAfter.steel===steelCapsBefore.steel+100&&steelCapsAfter.iron===steelCapsBefore.iron+200&&steelCapsAfter.copper===steelCapsBefore.copper+200,steelCapsAfter);
  await evalJs("S.res.gold=400;S.res.wood=1000;S.res.food=2000;updateUI();'steel refinery below gold capacity wall'");
  const blockedSteelRefinery=await evalJs("(()=>{const before={gold:S.res.gold,wood:S.res.wood,food:S.res.food};const r=buildAct('steel_refinery');return {reason:r.reason,gold:S.res.gold-before.gold,wood:S.res.wood-before.wood,food:S.res.food-before.food,lv:bldSt('steel_refinery').lv}})()");
  check(width+' steel refinery action blocked below gold 500',blockedSteelRefinery.reason==='resources'&&blockedSteelRefinery.gold===0&&blockedSteelRefinery.wood===0&&blockedSteelRefinery.food===0&&blockedSteelRefinery.lv===0,blockedSteelRefinery);
  await evalJs("S.res.gold=180;updateUI();'gold store upgrade ready'");
  check(width+' second gold store level built through UI',await clickBuild('gold_store'));
  const goldCap500=await evalJs("(()=>{advanceBuildingsBy(30);save();updateUI();return {lv:bldSt('gold_store').lv,cap:resCap('gold')}})()");
  check(width+' steel refinery gold capacity prerequisite',goldCap500.lv===2&&goldCap500.cap===500,goldCap500);
  await evalJs("S.res.gold=500;S.res.wood=1000;S.res.food=2000;updateUI();'steel refinery payment ready'");
  check(width+' steel refinery built through UI',await clickBuild('steel_refinery'));
  const steelRefineryDone=await evalJs("(()=>{advanceBuildingsBy(30);save();updateUI();return {lv:bldSt('steel_refinery').lv,buff:buildingBuff('steel')}})()");
  check(width+' steel refinery buff',steelRefineryDone.lv===1&&Math.abs(steelRefineryDone.buff-0.1)<1e-8,steelRefineryDone);
  await viewBuild('barracks');
  await evalJs("S.res.wood=1000;S.res.stone=900;S.res.food=3000;updateUI();'alloy armory cost ready'");
  check(width+' alloy armory built through UI',await clickBuild('alloy_armory'));
  await evalJs("advanceBuildingsBy(30);S.res.steel=100;save();S.page='barracks';S._barracksTab='train';updateUI();'alloy special ready'");
  const alloyTrain=await evalJs("(()=>{const b=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===\"trainCustom('alloy_special','train-barracks-alloy_special')\");if(!b||b.disabled)return {found:!!b,disabled:b?.disabled};b.click();processQueue();return {found:true,count:S.pool.alloy_special||0,steel:S.res.steel,stored:JSON.parse(localStorage.getItem('rts_save')).pool.alloy_special||0}})()");
  check(width+' alloy special recruit through UI and save',alloyTrain.found&&alloyTrain.count===1&&alloyTrain.steel===0&&alloyTrain.stored===1,alloyTrain);
  await viewTech();
  await research(width,'sci_library','图书馆');
  await research(width,'sci_workshop','工坊技术');
  const techBeforeLibrary=await evalJs("resCap('tech')");
  await viewBuild('basic');
  await evalJs("S.res.wood=600;S.res.stone=600;updateUI();'library payment ready'");
  check(width+' library built through UI',await clickBuild('library'));
  const libraryDone=await evalJs("(()=>{advanceBuildingsBy(30);save();updateUI();return {lv:bldSt('library').lv,techCap:resCap('tech'),saved:JSON.parse(localStorage.getItem('rts_save')).buildings.library.lv}})()");
  check(width+' library adds 200 knowledge capacity',libraryDone.lv===1&&libraryDone.saved===1&&libraryDone.techCap===techBeforeLibrary+200,libraryDone);
  await viewTech();
  const masteryUI=await evalJs("(()=>{S.res.tech=500;updateUI();const button=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')==='upgradeStorageMastery()');if(!button||button.disabled)return {found:!!button,disabled:button?.disabled};const before=resCap('tech');button.click();const saved=JSON.parse(localStorage.getItem('rts_save'));return {found:true,level:S.storageMasteryLv,tech:S.res.tech,cap:resCap('tech'),before,savedLevel:saved.storageMasteryLv}})()");
  check(width+' storage mastery paid through UI and persisted',masteryUI.found&&masteryUI.level===1&&masteryUI.tech===0&&masteryUI.cap===Math.floor(masteryUI.before*1.1)&&masteryUI.savedLevel===1,masteryUI);
  await research(width,'sci_copper_furnace','冶铜炉');
  await research(width,'sci_stone_store','石仓库');
  await research(width,'sci_institute','研究院');
  await viewBuild('economy');
  await evalJs("S.res.wood=600;S.res.stone=1500;S.res.food=300;updateUI();'copper furnace ready'");
  check(width+' copper furnace built through UI',await clickBuild('copper_furnace'));
  const furnaceDone=await evalJs("(()=>{advanceBuildingsBy(30);save();return {lv:bldSt('copper_furnace').lv,buff:buildingBuff('copper')}})()");
  check(width+' copper furnace stacks with mine bonus',furnaceDone.lv===1&&furnaceDone.buff>=0.1,furnaceDone);
  await viewBuild('basic');
  await evalJs("S.res.stone=1600;updateUI();'stone store ready'");
  check(width+' stone store built through UI',await clickBuild('stone_store'));
  const stoneDone=await evalJs("(()=>{advanceBuildingsBy(30);save();return {lv:bldSt('stone_store').lv,wood:resCap('wood'),stone:resCap('stone'),coal:resCap('coal')}})()");
  check(width+' stone store expands wood stone coal',stoneDone.lv===1&&stoneDone.wood>=1200&&stoneDone.stone>=800&&stoneDone.coal>=400,stoneDone);
  await evalJs("S.res.wood=1800;S.res.stone=1800;updateUI();'institute ready'");
  check(width+' institute built through UI',await clickBuild('institute'));
  const instituteDone=await evalJs("(()=>{advanceBuildingsBy(30);save();return {lv:bldSt('institute').lv,tech:resCap('tech')}})()");
  check(width+' institute expands knowledge',instituteDone.lv===1&&instituteDone.tech>=400,instituteDone);
  await viewTech();
  const steamGuard=await evalJs("(()=>{S.res.tech=100000;S.res.steel=9999;updateUI();const row=[...document.querySelectorAll('#tech-full .tech-science-row strong')].find(x=>x.textContent.trim()==='蒸汽时代')?.closest('.tech-science-row');const disabled=row?.querySelector('button')?.disabled;const r=researchScience('sci_steam_age');return {disabled,feeShown:row?.textContent.includes('钢 10000'),reason:r.reason,tech:S.res.tech,steel:S.res.steel}})()");
  check(width+' steam research requires displayed steel fee at action boundary',steamGuard.disabled&&steamGuard.feeShown&&steamGuard.reason==='insufficient-resources'&&steamGuard.tech===100000&&steamGuard.steel===9999,steamGuard);
  await evalJs("S.res.steel=10000;updateUI();'steam research ready'");
  await sleep(1200);
  await shot(width,'steam-fee','蒸汽时代');
  check(width+' steam research clicked through UI',await clickResearch('蒸汽时代'));
  const steamPaid=await evalJs("(()=>{const saved=JSON.parse(localStorage.getItem('rts_save'));return {studied:S.sciences.includes('sci_steam_age'),tech:S.res.tech,steel:S.res.steel,saved:saved.sciences.includes('sci_steam_age'),savedTech:saved.res.tech,savedSteel:saved.res.steel}})()");
  check(width+' steam dual payment persisted once',steamPaid.studied&&steamPaid.saved&&steamPaid.tech===0&&steamPaid.steel===0&&steamPaid.savedTech===0&&steamPaid.savedSteel===0,steamPaid);
  await viewBuild('barracks');
  await evalJs("S.res.wood=1600;S.res.stone=1400;S.res.food=900;updateUI();'steam armory ready with food upkeep buffer'");
  const steamArmoryRow=await buildingRow('steam_armory');
  check(width+' steam armory built through UI',await clickBuild('steam_armory'),steamArmoryRow);
  const armoryDone=await evalJs("(()=>{advanceBuildingsBy(30);save();return bldSt('steam_armory').lv})()");
  check(width+' steam armory completed',armoryDone===1,armoryDone);
  await evalJs("S.res.copper=2000;S.res.iron=2000;S.res.steel=2000;S.page='barracks';S._barracksTab='train';updateUI();'armored troop ready'");
  const armorTrain=await evalJs("(()=>{const b=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===\"trainCustom('armored_trooper','train-barracks-armored_trooper')\");if(!b||b.disabled)return {found:!!b,disabled:b?.disabled};b.click();processQueue();const saved=JSON.parse(localStorage.getItem('rts_save'));return {found:true,count:S.pool.armored_trooper||0,copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,saved:saved.pool.armored_trooper||0}})()");
  check(width+' armored troop trained and persisted',armorTrain.found&&armorTrain.count===1&&armorTrain.copper===0&&armorTrain.iron===0&&armorTrain.steel===0&&armorTrain.saved===1,armorTrain);
  await viewTech();
  const electricGuard=await evalJs("(()=>{S.res.tech=5000000;S.res.steel=999999;updateUI();const row=[...document.querySelectorAll('#tech-full .tech-science-row strong')].find(x=>x.textContent.trim()==='电力时代')?.closest('.tech-science-row');const disabled=row?.querySelector('button')?.disabled;const r=researchScience('sci_electric_age');return {disabled,feeShown:row?.textContent.includes('钢 1000000'),reason:r.reason,tech:S.res.tech,steel:S.res.steel}})()");
  check(width+' electric research needs full steel payment in UI and action',electricGuard.disabled&&electricGuard.feeShown&&electricGuard.reason==='insufficient-resources'&&electricGuard.tech===5000000&&electricGuard.steel===999999,electricGuard);
  await evalJs("S.res.steel=1000000;updateUI();'electric research ready'");
  check(width+' electric research clicked through UI',await clickResearch('电力时代'));
  const electricPaid=await evalJs("(()=>{const saved=JSON.parse(localStorage.getItem('rts_save'));return {studied:S.sciences.includes('sci_electric_age'),tech:S.res.tech,steel:S.res.steel,saved:saved.sciences.includes('sci_electric_age'),savedTech:saved.res.tech,savedSteel:saved.res.steel}})()");
  check(width+' electric dual payment persisted once',electricPaid.studied&&electricPaid.saved&&electricPaid.tech===0&&electricPaid.steel===0&&electricPaid.savedTech===0&&electricPaid.savedSteel===0,electricPaid);
  const medalTrade=await evalJs("(()=>{if(!scienceUnlocked('sci_mint')){S.res.tech=5000;researchScience('sci_mint')}if(!scienceUnlocked('sci_coin')){S.res.tech=12000;researchScience('sci_coin')}S.res.silverCoin=200;S.page='build';S._buildTab='economy';updateUI();const select=document.getElementById('mk-rate'),option=[...select.options].find(o=>o.value==='silverCoin|medal');if(!option)return {found:false,mint:scienceUnlocked('sci_mint'),coin:scienceUnlocked('sci_coin'),electric:scienceUnlocked('sci_electric_age')};select.value=option.value;document.getElementById('mk-qty').value='200';const before={silver:S.res.silverCoin,medal:S.res.medal,daily:dailyCount('market'),merit:S.merit};document.querySelector('#main button[onclick=\"marketExchange(this)\"]').click();const saved=JSON.parse(localStorage.getItem('rts_save'));return {found:true,silver:S.res.silverCoin-before.silver,medal:S.res.medal-before.medal,daily:dailyCount('market')-before.daily,merit:S.merit-before.merit,savedMedal:saved.res.medal,version:saved.v}})()");
  check(width+' electric market exchanges silver for separate god medal',medalTrade.found&&medalTrade.silver===-200&&medalTrade.medal===10&&medalTrade.daily===1&&medalTrade.merit===0&&medalTrade.savedMedal===10&&medalTrade.version===33,medalTrade);
  await viewBuild('barracks');
  await evalJs("S.res.wood=2500;S.res.stone=2200;S.res.food=1200;updateUI();'electric armory ready'");
  check(width+' electric armory built through UI',await clickBuild('electric_armory'));
  const electricArmory=await evalJs("(()=>{advanceBuildingsBy(30);save();updateUI();const icon=document.querySelector('#main .i-electric_armory');return {level:bldSt('electric_armory').lv,icon:icon?getComputedStyle(icon).backgroundImage:null}})()");
  check(width+' electric armory finished with building icon',electricArmory.level===1&&electricArmory.icon?.includes('electric_armory.png'),electricArmory);
  await evalJs("(()=>{const card=[...document.querySelectorAll('#main .card')].find(x=>x.querySelector('h3')?.textContent.includes('电磁兵坊'));card?.scrollIntoView({block:'center'});return !!card})()");
  await shot(width,'electric-armory');
  await evalJs("S.res.copper=8000;S.res.iron=8000;S.res.steel=8000;S.res.food=1000;S.page='barracks';S._barracksTab='train';updateUI();'electro troop ready'");
  const electricTrain=await evalJs("(()=>{const b=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===\"trainCustom('electro_trooper','train-barracks-electro_trooper')\");if(!b||b.disabled)return {found:!!b,disabled:b?.disabled};b.click();processQueue();const saved=JSON.parse(localStorage.getItem('rts_save'));return {found:true,count:S.pool.electro_trooper||0,copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,saved:saved.pool.electro_trooper||0}})()");
  check(width+' electro troop trained and persisted',electricTrain.found&&electricTrain.count===1&&electricTrain.copper===0&&electricTrain.iron===0&&electricTrain.steel===0&&electricTrain.saved===1,electricTrain);
  await evalJs("(()=>{const row=[...document.querySelectorAll('#main .branch-header')].find(x=>x.textContent.includes('电磁兵'));row?.scrollIntoView({block:'center'});return !!row})()");
  await shot(width,'electro-trooper');
  const materialCards=await evalJs("(()=>{S.page='fight';S._fightTab='expedition';updateUI();return ['guardianStone','phantomFlower','medal'].map(key=>{const button=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===`openMaterialDomain('${key}')`);return {key,found:!!button,disabled:button?.disabled,text:button?.closest('.card')?.textContent||''}})})()");
  check(width+' three industrial challenges show rewards and need a formation',materialCards.length===3&&materialCards.every(x=>x.found&&x.disabled&&x.text.includes('本次胜利预计')&&x.text.includes('挑战威胁等级'))&&materialCards[0].text.includes('防护模块')&&materialCards[0].text.includes('战备勋章 ×40')&&materialCards[1].text.includes('相位晶簇')&&materialCards[1].text.includes('战备勋章 ×40')&&materialCards[2].text.includes('战备勋章'),materialCards);
  const medalTop=await evalJs("(()=>{const toggle=document.getElementById('resources-toggle'),cell=document.getElementById('top-medal');toggle.click();const result={visible:getComputedStyle(cell).display!=='none',label:cell.querySelector('.label')?.textContent,value:document.getElementById('res-medal')?.textContent};toggle.click();return result})()");
  check(width+' war-readiness medal available in expanded topbar after electric research',medalTop.visible&&medalTop.label==='战备勋章'&&medalTop.value==='10',medalTop);
  const materialClicks=await evalJs("(()=>{const original=JSON.parse(JSON.stringify(S.formation));S.formation.front=[{id:7777,type:'electro_trooper',count:1}];updateUI();const results=[];for(const key of ['guardianStone','phantomFlower','medal']){const button=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===`openMaterialDomain('${key}')`);const ready=!!button&&!button.disabled;button?.click();results.push({key,ready,active:S.battleActive,encounter:S.battleEncounter,enemy:B.enemyCfg?.name});fleeBattle()}S.formation=original;save();updateUI();return results})()");
  check(width+' challenge buttons open distinct real battles',materialClicks.length===3&&materialClicks.every(x=>x.ready&&x.active&&x.encounter===x.key&&x.enemy===({guardianStone:'重装防卫机',phantomFlower:'光学拟态机',medal:'战术演算机'})[x.key]),materialClicks);
  await evalJs("(()=>{const card=[...document.querySelectorAll('#main .card')].find(x=>x.querySelector('h3')?.textContent.includes('重装防卫机'));card?.scrollIntoView({block:'center'});return !!card})()");
  check(width+' industrial challenge cards fit narrow viewport',!(await layout()).overflow);
  await shot(width,'industrial-material-challenge','重装防卫机');
  await viewTech();
  const scholarPaid=await evalJs("(()=>{S.buildings.academy={lv:1,state:'idle'};S.popAlloc.tech=1;S.res.tech=500;updateUI();const button=document.querySelector('#tech-full button[onclick=\"upgradeScholarMastery()\"]');const card=button?.closest('.card');const before=prodRate('tech'),shown=card?.textContent||'',ready=!!button&&!button.disabled;button?.click();const saved=JSON.parse(localStorage.getItem('rts_save'));return {ready,shown,before,after:prodRate('tech'),level:S.scholarMasteryLv,tech:S.res.tech,savedLevel:saved.scholarMasteryLv,savedTech:saved.res.tech,version:saved.v}})()");
  check(width+' scholar mastery UI pays once, raises actual output and persists',scholarPaid.ready&&scholarPaid.shown.includes('科研精通')&&scholarPaid.shown.includes('科技点 500')&&scholarPaid.level===1&&scholarPaid.tech===0&&Math.abs(scholarPaid.after-scholarPaid.before*1.05)<1e-8&&scholarPaid.savedLevel===1&&scholarPaid.savedTech===0&&scholarPaid.version===33,scholarPaid);
  const forged=await evalJs("(()=>{S.res.tech=20000;S.res.medal=1000;S.res.iron=200000;S.res.steel=10000;updateUI();const research=[...document.querySelectorAll('#tech-full button[onclick]')].find(x=>x.getAttribute('onclick')===\"researchWeapon('armored')\");const researchShown=research?.closest('.card')?.textContent||'';const researchReady=!!research&&!research.disabled;research?.click();let invested=0;for(let n=0;n<20;n++){const button=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===\"forgeWeapon('armored')\");if(!button||button.disabled)break;button.click();invested++}const level=S.weaponForge.armored.level,attackBefore=weaponAttack('armored_trooper');const equip=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===\"setWeaponEquipped('armored',true)\");equip?.click();const saved=JSON.parse(localStorage.getItem('rts_save'));return {researchReady,researchShown,invested,level,attackBefore,attackAfter:weaponAttack('armored_trooper'),equipped:S.weaponForge.armored.equipped,tech:S.res.tech,medal:S.res.medal,iron:S.res.iron,steel:S.res.steel,savedWeapon:saved.weaponForge.armored,version:saved.v}})()");
  check(width+' armored weapon UI researches, invests 20 times, equips and saves',forged.researchReady&&forged.researchShown.includes('蒸汽装甲枪')&&forged.researchShown.includes('战备勋章 1000')&&forged.invested===20&&forged.level===1&&forged.attackBefore===35&&forged.attackAfter===41&&forged.equipped&&forged.tech===0&&forged.medal===0&&forged.iron===0&&forged.steel===0&&forged.savedWeapon?.equipped&&forged.savedWeapon?.level===1&&forged.version===33,forged);
  const steamStorageReady=await evalJs("(()=>{S.res.tech=300000;updateUI();const button=[...document.querySelectorAll('#tech-full button[onclick]')].find(x=>x.getAttribute('onclick')===\"upgradeEraStorage('steamKnowledge')\");const row=button?.closest('.tech-detail-row');return {found:!!button,disabled:button?.disabled,fee:row?.textContent.includes('300000'),before:resCap('tech')}})()");
  check(width+' steam knowledge storage UI shows single-payment fee',steamStorageReady.found&&!steamStorageReady.disabled&&steamStorageReady.fee,steamStorageReady);
  const steamStoragePaid=await evalJs("(()=>{const button=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===\"upgradeEraStorage('steamKnowledge')\");button?.click();const saved=JSON.parse(localStorage.getItem('rts_save'));return {level:S.eraStorage.steamKnowledge,tech:S.res.tech,after:resCap('tech'),savedLevel:saved.eraStorage.steamKnowledge,savedTech:saved.res.tech,version:saved.v}})()");
  check(width+' steam knowledge storage paid and persisted',steamStoragePaid.level===1&&steamStoragePaid.tech===0&&steamStoragePaid.after===Math.floor(steamStorageReady.before*1.1)&&steamStoragePaid.savedLevel===1&&steamStoragePaid.savedTech===0&&steamStoragePaid.version===33,steamStoragePaid);
  const crystalGate=await evalJs("(()=>{S.eraStorage.steamKnowledge=5;S.res.tech=1800000;updateUI();const b=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===\"upgradeEraStorage('steamKnowledge')\");const text=b?.closest('.tech-detail-row')?.textContent||'';const disabled=b?.disabled;const reason=upgradeEraStorage('steamKnowledge').reason;const tech=S.res.tech;S.eraStorage.steamKnowledge=1;S.res.tech=0;updateUI();return {disabled,text,reason,tech}})()");
  check(width+' steam storage level six displays crystal gate',crystalGate.disabled&&crystalGate.text.includes('遗迹晶核 60')&&crystalGate.reason==='insufficient-items'&&crystalGate.tech===1800000,crystalGate);
  await shot(width,'steam-storage','蒸汽科研技术');
  const electricRows=await evalJs("(()=>{const names=['电力基础仓库','电力金属仓库','电力科研技术','电力生产技术'];return names.map(name=>{const row=[...document.querySelectorAll('#tech-full strong')].find(x=>x.textContent.trim()===name)?.closest('.tech-detail-row');return {name,found:!!row,fee:row?.textContent||''}})})()");
  check(width+' four electric technology rows and first prices are visible',electricRows.length===4&&electricRows.every(x=>x.found)&&electricRows[0].fee.includes('3000000')&&electricRows[1].fee.includes('3000000')&&electricRows[2].fee.includes('2000000')&&electricRows[3].fee.includes('1000000'),electricRows);
  const electricKnowledgeGuard=await evalJs("(()=>{S.res.tech=1999999;updateUI();const b=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===\"upgradeEraStorage('electricKnowledge')\");const reason=upgradeEraStorage('electricKnowledge').reason;return {disabled:b?.disabled,reason,tech:S.res.tech}})()");
  check(width+' electric knowledge requires full two-million payment',electricKnowledgeGuard.disabled&&electricKnowledgeGuard.reason==='insufficient-resources'&&electricKnowledgeGuard.tech===1999999,electricKnowledgeGuard);
  const electricKnowledgePaid=await evalJs("(()=>{S.res.tech=2000000;updateUI();const before=resCap('tech');document.querySelector(\"#main button[onclick=\\\"upgradeEraStorage('electricKnowledge')\\\"]\").click();const saved=JSON.parse(localStorage.getItem('rts_save'));return {before,after:resCap('tech'),level:S.eraStorage.electricKnowledge,tech:S.res.tech,savedLevel:saved.eraStorage.electricKnowledge,version:saved.v}})()");
  check(width+' electric knowledge payment expands cap and persists',electricKnowledgePaid.level===1&&electricKnowledgePaid.after===Math.floor(electricKnowledgePaid.before*1.1)&&electricKnowledgePaid.tech===0&&electricKnowledgePaid.savedLevel===1&&electricKnowledgePaid.version===33,electricKnowledgePaid);
  const electricProductionPaid=await evalJs("(()=>{S.popAlloc.wood=1;S.res.tech=1000000;updateUI();const before=prodRate('wood');const b=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===\"upgradeEraStorage('electricProduction')\");b?.click();const saved=JSON.parse(localStorage.getItem('rts_save'));return {before,after:prodRate('wood'),level:S.eraStorage.electricProduction,tech:S.res.tech,savedLevel:saved.eraStorage.electricProduction}})()");
  check(width+' electric production payment raises worker output and persists',electricProductionPaid.level===1&&Math.abs(electricProductionPaid.after-electricProductionPaid.before*1.1)<1e-8&&electricProductionPaid.tech===0&&electricProductionPaid.savedLevel===1,electricProductionPaid);
  const electricMaterialGate=await evalJs("(()=>{S.eraStorage.electricKnowledge=5;S.res.tech=12000000;updateUI();const b=[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===\"upgradeEraStorage('electricKnowledge')\");const text=b?.closest('.tech-detail-row')?.textContent||'';const disabled=b?.disabled;const reason=upgradeEraStorage('electricKnowledge').reason;S.eraStorage.electricKnowledge=1;S.res.tech=0;updateUI();return {disabled,text,reason}})()");
  check(width+' electric sixth level requires defense module',electricMaterialGate.disabled&&electricMaterialGate.text.includes('防护模块 120')&&electricMaterialGate.reason==='insufficient-items',electricMaterialGate);
  await shot(width,'electric-technology','电力科研技术');
  check(width+' silver market fits narrow viewport',!(await layout()).overflow);
  await viewTech();
  check(width+' historical node absent after full new chain',!(await scienceRow('冶金术')).exists);
  const afterLayout=await layout();
  check(width+' completed science page fits',!afterLayout.overflow,afterLayout);
  await shot(width,'new-chain-complete','城市化');
  check(width+' new-chain reload',await reload());
  const reloaded=await state();
  check(width+' scholar mastery survives real browser reload',await evalJs("S.scholarMasteryLv===1&&JSON.parse(localStorage.getItem('rts_save')).scholarMasteryLv===1"));
  check(width+' armored weapon remains equipped after browser reload',await evalJs("S.weaponForge.armored.level===1&&S.weaponForge.armored.equipped===true&&weaponAttack('armored_trooper')===41"));
  check(width+' new-chain reload preserves science and settlements',reloaded.sciences.includes('sci_city')&&reloaded.sciences.includes('sci_large_granary')&&reloaded.sciences.includes('sci_iron_warehouse')&&!reloaded.sciences.includes('sci_metal')&&reloaded.smallTown===1&&reloaded.city===2&&reloaded.capacity===10&&!reloaded.protected,reloaded);
  await viewTech();
  check(width+' new-chain reload still omits historical node',!(await scienceRow('冶金术')).exists);
  const steamGearUI=await evalJs("(()=>{S.page='tech';S.res.tech=270000;S.res.medal=15000;S.res.steel=400000;updateUI();const button=key=>[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===key);const mortarHidden=!button(\"researchWeapon('mortar')\");const armorHidden=!button(\"researchWeapon('steamArmor')\");const gatlingReady=!button(\"researchWeapon('gatling')\")?.disabled;button(\"researchWeapon('gatling')\")?.click();button(\"researchWeapon('mortar')\")?.click();const armorReady=!button(\"researchWeapon('steamArmor')\")?.disabled;button(\"researchWeapon('steamArmor')\")?.click();let forged=0;for(let i=0;i<20;i++){const b=button(\"forgeWeapon('steamArmor')\");if(!b||b.disabled)break;b.click();forged++}button(\"setWeaponEquipped('steamArmor',true)\")?.click();const d=JSON.parse(localStorage.getItem('rts_save'));return {mortarHidden,armorHidden,gatlingReady,armorReady,forged,level:S.weaponForge.steamArmor.level,equipped:S.weaponForge.steamArmor.equipped,tech:S.res.tech,medal:S.res.medal,steel:S.res.steel,def:weaponDefense('armored_trooper'),savedVersion:d.v,savedArmor:d.weaponForge.steamArmor.equipped,shown:[...document.querySelectorAll('#main .card')].some(x=>x.textContent.includes('蒸汽甲')),overflow:document.documentElement.scrollWidth>innerWidth+1}})()");
  check(width+' steam armor UI reveals complete research chain and pays first forge',steamGearUI.mortarHidden&&steamGearUI.armorHidden&&steamGearUI.gatlingReady&&steamGearUI.armorReady&&steamGearUI.forged===20&&steamGearUI.level===1&&steamGearUI.equipped&&steamGearUI.tech===0&&steamGearUI.medal===0&&steamGearUI.steel===0&&steamGearUI.def===32&&steamGearUI.savedVersion===33&&steamGearUI.savedArmor&&steamGearUI.shown&&!steamGearUI.overflow,steamGearUI);
  check(width+' steam armor survives browser reload',await reload()&&await evalJs("S.weaponForge.steamArmor.equipped&&JSON.parse(localStorage.getItem('rts_save')).v===33"));
  await viewTech();
  const electricGearUI=await evalJs("(()=>{S.weaponForge.electro.researched=true;S.res.tech=2000000;S.res.medal=50000;S.res.steel=10000;S.items.godCore=4;updateUI();const button=key=>[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===key);const sniperHidden=!button(\"researchWeapon('electroSniper')\");const rifle=button(\"researchWeapon('electroRifle')\");const shown=rifle?.parentElement?.parentElement?.textContent||'';const ready=!!rifle&&!rifle.disabled;rifle?.click();const forge=button(\"forgeWeapon('electroRifle')\");const costShown=forge?.parentElement?.parentElement?.textContent||'';const forgeReady=!!forge&&!forge.disabled;forge?.click();const saved=JSON.parse(localStorage.getItem('rts_save'));return {sniperHidden,ready,shown,forgeReady,costShown,progress:S.weaponForge.electroRifle.progress,core:S.items.godCore,steel:S.res.steel,savedCore:saved.items.godCore,savedProgress:saved.weaponForge.electroRifle.progress,version:saved.v,overflow:document.documentElement.scrollWidth>innerWidth+1}})()");
  check(width+' electric rifle UI hides sniper before prerequisite and pays high-energy core once',electricGearUI.sniperHidden&&electricGearUI.ready&&electricGearUI.shown.includes('电磁步枪')&&electricGearUI.forgeReady&&electricGearUI.costShown.includes('高能核心 4')&&electricGearUI.progress===1&&electricGearUI.core===0&&electricGearUI.steel===0&&electricGearUI.savedCore===0&&electricGearUI.savedProgress===1&&electricGearUI.version===33&&!electricGearUI.overflow,electricGearUI);
  await shot(width,'electric-skill-gear','电磁步枪');
  const armorUI=await evalJs("(()=>{S.weaponForge.electroSniper.researched=true;S.weaponForge.electroArmor.researched=true;S.res.tech=6500000;S.res.medal=180000;S.items.godCore=160;S.page='tech';updateUI();const button=key=>[...document.querySelectorAll('#main button[onclick]')].find(x=>x.getAttribute('onclick')===key);const nanoHidden=!button(\"researchWeapon('nanoArmor')\");const energyReady=!button(\"researchWeapon('energyArmor')\")?.disabled;button(\"researchWeapon('energyArmor')\")?.click();const nanoReady=!button(\"researchWeapon('nanoArmor')\")?.disabled;button(\"researchWeapon('nanoArmor')\")?.click();let energyForged=0,nanoForged=0;for(let i=0;i<20;i++){const forge=button(\"forgeWeapon('energyArmor')\");if(!forge||forge.disabled)break;forge.click();energyForged++}button(\"setWeaponEquipped('energyArmor',true)\")?.click();for(let i=0;i<20;i++){const forge=button(\"forgeWeapon('nanoArmor')\");if(!forge||forge.disabled)break;forge.click();nanoForged++}button(\"setWeaponEquipped('nanoArmor',true)\")?.click();const cards=[...document.querySelectorAll('#main .card')].map(x=>x.textContent).join(' ');const d=JSON.parse(localStorage.getItem('rts_save'));return {nanoHidden,energyReady,nanoReady,forged:{energyArmor:energyForged,nanoArmor:nanoForged},levelEnergy:S.weaponForge.energyArmor.level,levelNano:S.weaponForge.nanoArmor.level,equippedEnergy:S.weaponForge.energyArmor.equipped,equippedNano:S.weaponForge.nanoArmor.equipped,tech:S.res.tech,medal:S.res.medal,core:S.items.godCore,savedVersion:d.v,savedEnergy:d.weaponForge.energyArmor.equipped,savedNano:d.weaponForge.nanoArmor.equipped,shown:cards.includes('能源护甲')&&cards.includes('纳米重构'),overflow:document.documentElement.scrollWidth>innerWidth+1}})()");
  check(width+' energy and nano armor UI reveals prerequisite chain and pays two first forges',armorUI.nanoHidden&&armorUI.energyReady&&armorUI.nanoReady&&armorUI.forged.energyArmor===20&&armorUI.forged.nanoArmor===20&&armorUI.levelEnergy===1&&armorUI.levelNano===1&&armorUI.equippedEnergy&&armorUI.equippedNano&&armorUI.tech===0&&armorUI.medal===0&&armorUI.core===0&&armorUI.savedVersion===33&&armorUI.savedEnergy&&armorUI.savedNano&&armorUI.shown&&!armorUI.overflow,armorUI);
  check(width+' energy and nano armor survive browser reload',await reload()&&await evalJs("S.weaponForge.energyArmor.equipped&&S.weaponForge.nanoArmor.equipped&&JSON.parse(localStorage.getItem('rts_save')).v===33"));
  const electricStart=await evalJs("(()=>{for(const key of ['electro','electroRifle','electroSniper','electroArmor'])S.weaponForge[key]={researched:true,level:1,progress:0,equipped:true};S.formation.front=[{id:77001,type:'electro_trooper',count:40}];S.formation.mid=[];S.formation.back=[];S.killValues.godSlaughter=2000;CFG.battleStepDelay=40;CFG.battleRoundDelay=40;S.page='fight';S._fightTab='expedition';updateUI();openMaterialDomain('medal');return S.battleActive})()");
  await sleep(450);
  const electricBattle=await evalJs("(()=>{const logs=(B.msgs||[]).map(x=>x.m);const result={round:B.round,sniped:logs.some(x=>x.includes('[精准狙击]')),rapid:logs.some(x=>x.includes('[电磁连射]')),enemyDef:B.enemyUnits?.[0]?.def,active:S.battleActive};return result})()");
  check(width+' electric skill effects run through real browser battle timer',electricStart&&electricBattle.round>=1&&electricBattle.sniped&&electricBattle.rapid&&electricBattle.enemyDef<132,electricBattle);
  if(electricBattle.active)await evalJs("fleeBattle();'done'" );
}
async function legacySave(width){
  await evalJs("localStorage.clear();'cleared'");
  check(width+' legacy fixture clean reload',await reload());
  const fixture=await evalJs("(()=>{S.sciences=['sci_prospect','sci_coal','sci_copper','sci_metal','sci_iron'];S.settlements.smallTown=2;S.population.current=8;S.res.tech=0;S.res.deed=0;const d=serializeSave();d.v=5;delete d.storageMode;localStorage.setItem('rts_save',JSON.stringify(d));return {saved:{ok:true},version:JSON.parse(localStorage.getItem('rts_save')).v}})()");
  check(width+' historical v5 fixture saved',fixture.saved.ok&&fixture.version===5,fixture);
  check(width+' historical v5 reload',await reload());
  const legacyMoney=await evalJs("({mode:S.currencyRecipeMode,label:document.getElementById('coin-label').textContent,stored:JSON.parse(localStorage.getItem('rts_save')).currencyRecipeMode})");
  check(width+' historical coin recipe and label preserved',legacyMoney.mode==='legacy'&&legacyMoney.label==='金币'&&legacyMoney.stored==='legacy',legacyMoney);
  await viewBuild('basic');
  const legacyWarehouse=await buildingRow('warehouse');
  const legacyCaps=await evalJs("({mode:S.storageMode,wood:resCap('wood'),stone:resCap('stone'),food:resCap('food')})");
  check(width+' historical warehouse remains buildable with original caps',legacyWarehouse.exists&&!legacyWarehouse.disabled&&legacyCaps.mode==='legacy'&&legacyCaps.wood===10000&&legacyCaps.stone===10000&&legacyCaps.food===10000,{legacyWarehouse,legacyCaps});
  await viewTech();
  const legacy=await state(),row=await scienceRow('冶金术');
  check(width+' old researched metal preserved',legacy.sciences.includes('sci_metal')&&legacy.sciences.includes('sci_iron')&&legacy.stored?.sciences.includes('sci_metal')&&legacy.smallTown===2&&legacy.capacity===8&&legacy.tech===0&&legacy.deed===0&&!legacy.protected,legacy);
  check(width+' historical research row is visible and studied',row.exists&&row.text.includes('已研究')&&!row.hasButton,row);
  const legacyLayout=await layout();
  check(width+' historical science page fits',!legacyLayout.overflow,legacyLayout);
  await shot(width,'historical-research','冶金术');
  check(width+' historical second reload',await reload());
  await viewTech();
  const again=await state();
  check(width+' historical record survives another reload',again.sciences.includes('sci_metal')&&again.stored?.sciences.includes('sci_metal')&&(await scienceRow('冶金术')).exists,again);
}

async function wildBoneUI(width){
  await evalJs("localStorage.clear();'cleared'");
  check(width+' wild hunt clean reload',await reload());
  const entry=await evalJs("(()=>{S.page='fight';S._fightTab='expedition';updateUI();const hunt=[...document.querySelectorAll('#main .card')].find(e=>e.textContent.includes('郊野猎场'));const button=[...(hunt?.querySelectorAll('button[onclick]')||[])].find(e=>e.getAttribute('onclick')===\"openMaterialDomain('bone')\");return {hunt:!!hunt,trade:!!document.getElementById('bone-trade-count'),label:document.getElementById('medal-label').textContent,disabled:button?.disabled,layout:document.documentElement.scrollWidth<=innerWidth+1}})()");
  check(width+' early wild hunt and military medal shown',entry.hunt&&entry.trade&&entry.label==='战备勋章'&&entry.disabled&&entry.layout,entry);
  await evalJs("[...document.querySelectorAll('#main .card')].find(e=>e.textContent.includes('郊野猎场'))?.scrollIntoView({block:'center'});'scrolled'");
  await shot(width,'wild-hunt');
  const battle=await evalJs("(()=>{CFG.battleStepDelay=60000;S.formation.front=[{type:'infantry',count:8,id:101}];updateUI();const button=[...document.querySelectorAll('#main button[onclick]')].find(e=>e.getAttribute('onclick')===\"openMaterialDomain('bone')\");const ready=!!button&&!button.disabled;button?.click();const started=S.battleActive&&S.battleEncounter==='bone'&&B.enemyCfg.name==='郊野猎场·野猪群';fleeBattle();return {ready,started,stopped:!S.battleActive}})()");
  check(width+' wild hunt button opens real battle',battle.ready&&battle.started&&battle.stopped,battle);
  const exchange=await evalJs("(()=>{S.res.bone=20;save();updateUI();const input=document.getElementById('bone-trade-count'),button=[...document.querySelectorAll('#main button[onclick]')].find(e=>e.getAttribute('onclick')==='exchangeBonesFromUI()');input.value='1';const ready=!!button&&!button.disabled;button?.click();const d=JSON.parse(localStorage.getItem('rts_save'));const toggle=document.getElementById('resources-toggle');toggle.click();const medalVisible=getComputedStyle(document.getElementById('top-medal')).display!=='none';toggle.click();return {ready,bone:S.res.bone,medal:S.res.medal,savedBone:d.res.bone,savedMedal:d.res.medal,version:d.v,label:document.getElementById('medal-label').textContent,medalVisible,layout:document.documentElement.scrollWidth<=innerWidth+1}})()");
  check(width+' bone exchange UI pays and saves early medal',exchange.ready&&exchange.bone===10&&exchange.medal===20&&exchange.savedBone===10&&exchange.savedMedal===20&&exchange.version===33&&exchange.label==='战备勋章'&&exchange.medalVisible&&exchange.layout,exchange);
  await shot(width,'wild-traded');
  check(width+' wild hunt exchange reload',await reload());
  const persisted=await evalJs("({bone:S.res.bone,medal:S.res.medal,label:document.getElementById('medal-label').textContent})");
  check(width+' early medal persists after reload',persisted.bone===10&&persisted.medal===20&&persisted.label==='战备勋章',persisted);
  const late=await evalJs("(()=>{S.sciences.push('sci_electric_age');updateUI();return {label:document.getElementById('medal-label').textContent,resource:resourceDisplayName('medal')}})()");
  check(width+' electric-era medal uses industrial name',late.label==='战备勋章'&&late.resource==='战备勋章',late);
  const godCoreCard=await evalJs("(()=>{S.page='fight';S._fightTab='expedition';updateUI();const button=[...document.querySelectorAll('#main button[onclick]')].find(e=>e.getAttribute('onclick')===\"openMaterialDomain('medal')\");const card=button?.closest('.card');return {exists:!!card,text:card?.textContent||'',layout:document.documentElement.scrollWidth<=innerWidth+1}})()");
  check(width+' electric-era tactical challenge shows core reward and stock',godCoreCard.exists&&godCoreCard.text.includes('高能核心 ×1')&&godCoreCard.text.includes('高能核心 0')&&godCoreCard.layout,godCoreCard);
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
  for(const width of [360,400]){
    await freshChain(width);
    await legacySave(width);
    await wildBoneUI(width);
  }
  check('zero uncaught browser exceptions',exceptions.length===0,exceptions.slice(0,4));
  const report={checks,exceptions,shots,passed:checks.filter(x=>x.ok).length,failed:checks.filter(x=>!x.ok).length,
    note:'Knowledge, deeds and building materials are seeded for UI/action coverage. This does not prove natural growth reachability.'};
  console.log(JSON.stringify(process.env.ERA_CHAIN_BRIEF?{failedChecks:checks.filter(x=>!x.ok),passed:report.passed,failed:report.failed}:report,null,2));
  process.exitCode=checks.some(x=>!x.ok)?1:0;
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error&&error.stack||error);process.exitCode=2;}).finally(async()=>{
  try{ws?.close();}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(250);
  try{if(profile.startsWith(tempRoot+path.sep)&&fs.existsSync(profile))fs.rmSync(profile,{recursive:true,force:true});}
  catch(error){console.error('PROFILE_CLEANUP_FAILED',error.message);}
});
