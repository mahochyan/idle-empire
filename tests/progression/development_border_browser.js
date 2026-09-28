'use strict';
// Real Edge/CDP smoke for the development border battle settlement.
// Run: node tests/progression/development_border_browser.js
// Research and an ample army are injected only to exercise the real browser
// battle loop; progression reachability is covered by separate paid-save probes.
// This test owns one isolated browser profile and cleans up only its process tree.
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

const tempRoot=fs.realpathSync(os.tmpdir());
const profile=fs.mkdtempSync(path.join(tempRoot,'development-border-browser-'));
if(!path.resolve(profile).startsWith(tempRoot+path.sep))throw Error('profile path outside temp');
const pageUrl=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const browser=spawn(edge,[
  '--headless=new','--disable-gpu','--no-first-run','--disable-extensions',
  '--no-sandbox','--disable-background-networking',
  '--remote-debugging-port=0','--user-data-dir='+profile,pageUrl
],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pending=new Map(),checks=[],exceptions=[];
let ws,nextId=0,spawnError;
browser.on('error',error=>{spawnError=error;});

function check(name,ok,detail){checks.push({name,ok:!!ok,detail:ok?undefined:detail});}
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method));},15000);
    pending.set(id,{resolve,reject,timer});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function evalJs(expression){
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function ready(reload=false){
  for(let i=0;i<100;i++){
    try{
      if(await evalJs("document.readyState==='complete'&&Array.isArray(window.APP_SCRIPTS)&&typeof openDevelopmentBorder==='function'"+
        (reload?'&&window.__borderReloadMarker===undefined':'')))return true;
    }catch(_){}
    await sleep(100);
  }
  return false;
}

(async()=>{
  // Edge writes its assigned CDP port inside this run's unique profile.
  // Never probe a guessed port: that could attach to another agent's browser.
  const activePortPath=path.join(profile,'DevToolsActivePort');
  let port;
  for(let i=0;i<80;i++){
    await sleep(100);
    if(spawnError)throw spawnError;
    if(!fs.existsSync(activePortPath))continue;
    const firstLine=fs.readFileSync(activePortPath,'utf8').split(/\r?\n/,1)[0];
    const candidate=Number(firstLine);
    if(Number.isInteger(candidate)&&candidate>0&&candidate<=65535){port=candidate;break;}
  }
  if(!port)throw Error('NO_OWN_CDP_PORT');
  let targets;
  for(let i=0;i<40;i++){
    await sleep(100);
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
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await send('Page.reload',{ignoreCache:true});
  check('real index and scripts load',await ready(),pageUrl);
  const initial=await evalJs("(()=>({order:APP_SCRIPTS.join(','),protected:saveProtected(),level:S.development.border.sites.copper.level,wins:S.development.border.sites.copper.wins,defeated:S.defeated.slice()}))()");
  check('script order and fresh border state',initial.order==='config.js,levels.js,sprites.js,math.js,garrison.js,technology.js,ui.js'&&!initial.protected&&initial.level===0&&initial.wins===0&&initial.defeated.length===0,initial);
  const routeCard=await evalJs("(()=>{S.page='fight';updateUI();const main=document.getElementById('main'),buttons=[...main.querySelectorAll('button')],actions=buttons.map(b=>b.getAttribute('onclick')||'');return{title:main.textContent.includes('拓境远征'),mainline:main.textContent.includes('关卡选择'),border:actions.filter(a=>a.startsWith('openDevelopmentBorder(')).length,outer:actions.filter(a=>a.startsWith('openDevelopmentOuter(')).length,locked:buttons.find(b=>b.getAttribute('onclick')===\"openDevelopmentBorder('copper')\")?.disabled,rarePreview:main.textContent.includes('圣兽血剂 0.10%')&&main.textContent.includes('炽翼战剂 0.50%'),overflow:document.documentElement.scrollWidth>innerWidth}})()");
  check('fight page exposes both development routes and rare preview without overflow',routeCard.title&&routeCard.mainline&&routeCard.border===2&&routeCard.outer===4&&routeCard.locked&&routeCard.rarePreview&&!routeCard.overflow,routeCard);
  if(process.env.P298_SCREENSHOT_PATH){
    const found=await evalJs("(()=>{const card=[...document.querySelectorAll('#main .card')].find(c=>c.textContent.includes('拓境远征'));card?.scrollIntoView({block:'start'});return !!card})()");
    if(found){
      await sleep(100);
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      fs.writeFileSync(process.env.P298_SCREENSHOT_PATH,Buffer.from(shot.data,'base64'));
    }
  }

  const gated=await evalJs("(()=>{openDevelopmentBorder('copper');return{active:S.battleActive,level:S.development.border.sites.copper.level}})()");
  check('copper research gate works in browser',!gated.active&&gated.level===0,gated);

  const started=await evalJs("(()=>{S.sciences.push('sci_copper');S.formation={front:[{type:'infantry',count:35,id:7101}],mid:[{type:'archer',count:25,id:7102}],back:[]};S.battleSpeed=4;CFG.battleStepDelay=1;CFG.battleRoundDelay=1;updateUI();const button=[...document.querySelectorAll('#main button')].find(b=>b.getAttribute('onclick')===\"openDevelopmentBorder('copper')\");const enabled=button&&!button.disabled;button?.click();return{enabled,active:S.battleActive,encounter:S.battleEncounter,name:B.enemyCfg?.name,alert:B.enemyCfg?.alert,enemies:B.enemyUnits?.length,screen:document.getElementById('battle-screen').classList.contains('active')}})()");
  check('real border card button opens and renders battle',started.enabled&&started.active&&started.encounter==='borderCopper'&&started.name==='边疆铜脉哨站'&&started.alert===0&&started.enemies===3&&started.screen,started);

  let settled=false;
  for(let i=0;i<200;i++){
    if(await evalJs('B.settled===true&&S.battleActive===false')){settled=true;break;}
    await sleep(100);
  }
  check('real asynchronous battle settles within 20 seconds',settled);
  if(settled){
    const result=await evalJs("(()=>{const raw=localStorage.getItem('rts_save'),saved=raw&&JSON.parse(raw);return{winner:B.winner,uiClass:document.getElementById('battle-result').className,uiText:document.getElementById('battle-result').textContent,level:S.development.border.sites.copper.level,wins:S.development.border.sites.copper.wins,coin:S.res.coin,defeated:S.defeated.slice(),merit:S.merit,savedLevel:saved?.development?.border?.sites?.copper?.level,savedWins:saved?.development?.border?.sites?.copper?.wins,savedCoin:saved?.res?.coin,savedDefeated:saved?.defeated||[]}})()");
    check('true victory grants point and coin in one save',result.uiClass==='win'&&result.level===1&&result.wins===1&&result.coin===400&&result.savedLevel===1&&result.savedWins===1&&result.savedCoin===400&&result.uiText.includes('采集点')&&result.uiText.includes('铜钱'),result);
    check('border victory leaves mainline progress unchanged',result.defeated.length===0&&result.savedDefeated.length===0&&result.merit===0,result);
    await evalJs("exitBattle();window.__borderReloadMarker=true;'ok'");
    await send('Page.reload',{ignoreCache:true});
    check('reload completes with real scripts',await ready(true));
    const reloaded=await evalJs("(()=>{const saved=JSON.parse(localStorage.getItem('rts_save')||'null');return{protected:saveProtected(),level:S.development.border.sites.copper.level,wins:S.development.border.sites.copper.wins,coin:S.res.coin,defeated:S.defeated.slice(),savedLevel:saved?.development?.border?.sites?.copper?.level,savedWins:saved?.development?.border?.sites?.copper?.wins,savedCoin:saved?.res?.coin}})()");
    check('reload keeps point and coin without mainline clear',!reloaded.protected&&reloaded.level===1&&reloaded.wins===1&&reloaded.coin===400&&reloaded.savedLevel===1&&reloaded.savedWins===1&&reloaded.savedCoin===400&&reloaded.defeated.length===0,reloaded);
    const collectionChoice=await evalJs("(()=>{S.page='fight';updateUI();const find=action=>[...document.querySelectorAll('#main button')].find(b=>b.getAttribute('onclick')===action);const select=find(\"selectDevelopmentSiteFromUI('copper')\");select?.click();const active=S.development.border.collection.activeSite,saved=JSON.parse(localStorage.getItem('rts_save')).development.border.collection.activeSite;find('selectDevelopmentSiteFromUI(null)')?.click();return{hasSelect:!!select,active,saved,stopped:S.development.border.collection.activeSite}})()");
    check('captured border point can be selected and stopped from card',collectionChoice.hasSelect&&collectionChoice.active==='copper'&&collectionChoice.saved==='copper'&&collectionChoice.stopped===null,collectionChoice);

    const outerStart=await evalJs("(()=>{window.__outerBefore={deed:S.res.deed,medal:S.res.medal,defeated:S.defeated.slice()};S.sciences.push('sci_bronze_age');S.formation={front:[{type:'infantry',count:60,id:7201}],mid:[{type:'archer',count:40,id:7202}],back:[]};S.battleSpeed=4;CFG.battleStepDelay=1;CFG.battleRoundDelay=1;updateUI();const button=[...document.querySelectorAll('#main button')].find(b=>b.getAttribute('onclick')===\"openDevelopmentOuter('village')\");const enabled=button&&!button.disabled;button?.click();return{enabled,active:S.battleActive,encounter:S.battleEncounter,name:B.enemyCfg?.name,alert:B.enemyCfg?.alert,enemies:B.enemyUnits?.length}})()");
    check('real outer village card button opens separate battle',outerStart.enabled&&outerStart.active&&outerStart.encounter==='outerVillage'&&outerStart.name==='外域军屯村寨'&&outerStart.alert===0&&outerStart.enemies===8,outerStart);
    let outerSettled=false;
    for(let i=0;i<200;i++){
      if(await evalJs('B.settled===true&&S.battleActive===false')){outerSettled=true;break;}
      await sleep(100);
    }
    check('real outer asynchronous battle settles within 20 seconds',outerSettled);
    if(outerSettled){
      const outer=await evalJs("(()=>{const saved=JSON.parse(localStorage.getItem('rts_save')||'null');return{before:window.__outerBefore,uiClass:document.getElementById('battle-result').className,uiText:document.getElementById('battle-result').textContent,wins:S.development.outer.village.wins,alert:S.development.outer.village.alert,deed:S.res.deed,medal:S.res.medal,defeated:S.defeated.slice(),savedWins:saved?.development?.outer?.village?.wins,savedAlert:saved?.development?.outer?.village?.alert,savedDeed:saved?.res?.deed,savedMedal:saved?.res?.medal,savedDefeated:saved?.defeated||[]}})()");
      check('true outer victory grants deeds and medals in one save',outer.uiClass==='win'&&outer.wins===1&&outer.alert===20&&outer.deed===outer.before.deed+12&&outer.medal===outer.before.medal+5&&outer.savedWins===1&&outer.savedAlert===20&&outer.savedDeed===outer.deed&&outer.savedMedal===outer.medal&&outer.uiText.includes('地契')&&outer.uiText.includes('战备勋章'),outer);
      check('outer victory leaves mainline progress unchanged',JSON.stringify(outer.defeated)===JSON.stringify(outer.before.defeated)&&JSON.stringify(outer.savedDefeated)===JSON.stringify(outer.before.defeated),outer);
      await evalJs("exitBattle();window.__borderReloadMarker=true;'ok'");
      await send('Page.reload',{ignoreCache:true});
      check('outer reload completes with real scripts',await ready(true));
      const outerReloaded=await evalJs("(()=>{const saved=JSON.parse(localStorage.getItem('rts_save')||'null');return{protected:saveProtected(),wins:S.development.outer.village.wins,alert:S.development.outer.village.alert,deed:S.res.deed,medal:S.res.medal,defeated:S.defeated.slice(),savedWins:saved?.development?.outer?.village?.wins,savedDeed:saved?.res?.deed,savedMedal:saved?.res?.medal}})()");
      check('reload keeps outer reward and progress',!outerReloaded.protected&&outerReloaded.wins===1&&outerReloaded.alert===20&&outerReloaded.deed===outer.before.deed+12&&outerReloaded.medal===outer.before.medal+5&&outerReloaded.savedWins===1&&outerReloaded.savedDeed===outerReloaded.deed&&outerReloaded.savedMedal===outerReloaded.medal&&outerReloaded.defeated.length===0,outerReloaded);

      const ironGate=await evalJs("(()=>{openDevelopmentBorder('iron');return{active:S.battleActive,level:S.development.border.sites.iron.level}})()");
      check('iron research gate works in browser',!ironGate.active&&ironGate.level===0,ironGate);
      const ironStart=await evalJs("(()=>{window.__ironBefore={coin:S.res.coin,goldCoin:S.res.goldCoin,defeated:S.defeated.slice()};S.sciences.push('sci_iron');S.formation={front:[{type:'infantry',count:60,id:7301}],mid:[{type:'archer',count:40,id:7302}],back:[]};S.battleSpeed=4;CFG.battleStepDelay=1;CFG.battleRoundDelay=1;openDevelopmentBorder('iron');return{active:S.battleActive,encounter:S.battleEncounter,name:B.enemyCfg?.name,alert:B.enemyCfg?.alert,enemies:B.enemyUnits?.length}})()");
      check('real iron-point battle opens with separate progress',ironStart.active&&ironStart.encounter==='borderIron'&&ironStart.name==='边疆铁脉关隘'&&ironStart.alert===0&&ironStart.enemies===4,ironStart);
      let ironSettled=false;
      for(let i=0;i<200;i++){
        if(await evalJs('B.settled===true&&S.battleActive===false')){ironSettled=true;break;}
        await sleep(100);
      }
      check('real iron asynchronous battle settles within 20 seconds',ironSettled);
      if(ironSettled){
        const iron=await evalJs("(()=>{const saved=JSON.parse(localStorage.getItem('rts_save')||'null');return{before:window.__ironBefore,uiClass:document.getElementById('battle-result').className,uiText:document.getElementById('battle-result').textContent,level:S.development.border.sites.iron.level,wins:S.development.border.sites.iron.wins,coin:S.res.coin,goldCoin:S.res.goldCoin,defeated:S.defeated.slice(),savedLevel:saved?.development?.border?.sites?.iron?.level,savedWins:saved?.development?.border?.sites?.iron?.wins,savedCoin:saved?.res?.coin,savedGoldCoin:saved?.res?.goldCoin,savedDefeated:saved?.defeated||[]}})()");
        check('true iron victory grants point and gold coin in one save',iron.uiClass==='win'&&iron.level===1&&iron.wins===1&&iron.coin===iron.before.coin&&iron.goldCoin===iron.before.goldCoin+50&&iron.savedLevel===1&&iron.savedWins===1&&iron.savedCoin===iron.coin&&iron.savedGoldCoin===iron.goldCoin&&iron.uiText.includes('铁采集点')&&iron.uiText.includes('金铸币')&&!iron.uiText.includes('铜钱 +'),iron);
        check('iron victory leaves mainline progress unchanged',JSON.stringify(iron.defeated)===JSON.stringify(iron.before.defeated)&&JSON.stringify(iron.savedDefeated)===JSON.stringify(iron.before.defeated),iron);
        await evalJs("exitBattle();window.__borderReloadMarker=true;'ok'");
        await send('Page.reload',{ignoreCache:true});
        check('iron reload completes with real scripts',await ready(true));
        const ironReloaded=await evalJs("(()=>{const saved=JSON.parse(localStorage.getItem('rts_save')||'null');S.page='home';updateUI();return{protected:saveProtected(),level:S.development.border.sites.iron.level,wins:S.development.border.sites.iron.wins,coin:S.res.coin,goldCoin:S.res.goldCoin,workerText:document.getElementById('worker-goldCoin')?.textContent,defeated:S.defeated.slice(),savedLevel:saved?.development?.border?.sites?.iron?.level,savedWins:saved?.development?.border?.sites?.iron?.wins,savedGoldCoin:saved?.res?.goldCoin}})()");
        check('reload keeps iron point and gold coin without mainline clear',!ironReloaded.protected&&ironReloaded.level===1&&ironReloaded.wins===1&&ironReloaded.coin===iron.before.coin&&ironReloaded.goldCoin===iron.before.goldCoin+50&&ironReloaded.savedGoldCoin===ironReloaded.goldCoin&&ironReloaded.savedLevel===1&&ironReloaded.savedWins===1&&ironReloaded.defeated.length===0,ironReloaded);
        check('gold coin worker row renders in the real browser',ironReloaded.workerText?.includes('金铸币'),ironReloaded);
      }

      const townGate=await evalJs("(()=>{openDevelopmentOuter('town');return{active:S.battleActive,wins:S.development.outer.town.wins}})()");
      check('iron-era town gate works in browser',!townGate.active&&townGate.wins===0,townGate);
      const townStart=await evalJs("(()=>{window.__townBefore={deed:S.res.deed,medal:S.res.medal,village:S.development.outer.village.wins,defeated:S.defeated.slice()};S.sciences.push('sci_iron_age');S.formation={front:[{type:'infantry',count:80,id:7401}],mid:[{type:'archer',count:60,id:7402}],back:[]};S.battleSpeed=4;CFG.battleStepDelay=1;CFG.battleRoundDelay=1;openDevelopmentOuter('town');return{active:S.battleActive,encounter:S.battleEncounter,name:B.enemyCfg?.name,alert:B.enemyCfg?.alert,enemies:B.enemyUnits?.length}})()");
      check('real outer town battle opens with separate progress',townStart.active&&townStart.encounter==='outerTown'&&townStart.name==='外域工造军镇'&&townStart.alert===0&&townStart.enemies===9,townStart);
      let townSettled=false;
      for(let i=0;i<200;i++){
        if(await evalJs('B.settled===true&&S.battleActive===false')){townSettled=true;break;}
        await sleep(100);
      }
      check('real town asynchronous battle settles within 20 seconds',townSettled);
      if(townSettled){
        const town=await evalJs("(()=>{const saved=JSON.parse(localStorage.getItem('rts_save')||'null');return{before:window.__townBefore,uiClass:document.getElementById('battle-result').className,uiText:document.getElementById('battle-result').textContent,wins:S.development.outer.town.wins,alert:S.development.outer.town.alert,village:S.development.outer.village.wins,deed:S.res.deed,medal:S.res.medal,defeated:S.defeated.slice(),savedWins:saved?.development?.outer?.town?.wins,savedAlert:saved?.development?.outer?.town?.alert,savedDeed:saved?.res?.deed,savedMedal:saved?.res?.medal}})()");
        check('true town victory grants deeds and medals in one save',town.uiClass==='win'&&town.wins===1&&town.alert===20&&town.village===town.before.village&&town.deed===town.before.deed+20&&town.medal===town.before.medal+7&&town.savedWins===1&&town.savedAlert===20&&town.savedDeed===town.deed&&town.savedMedal===town.medal&&town.uiText.includes('地契')&&town.uiText.includes('战备勋章'),town);
        check('town victory leaves mainline progress unchanged',JSON.stringify(town.defeated)===JSON.stringify(town.before.defeated),town);
        await evalJs("exitBattle();window.__borderReloadMarker=true;'ok'");
        await send('Page.reload',{ignoreCache:true});
        check('town reload completes with real scripts',await ready(true));
        const townReloaded=await evalJs("(()=>{const saved=JSON.parse(localStorage.getItem('rts_save')||'null');return{protected:saveProtected(),wins:S.development.outer.town.wins,village:S.development.outer.village.wins,deed:S.res.deed,medal:S.res.medal,savedWins:saved?.development?.outer?.town?.wins,savedDeed:saved?.res?.deed,savedMedal:saved?.res?.medal}})()");
        check('reload keeps town reward and separate progress',!townReloaded.protected&&townReloaded.wins===1&&townReloaded.village===town.before.village&&townReloaded.deed===town.deed&&townReloaded.medal===town.medal&&townReloaded.savedWins===1&&townReloaded.savedDeed===town.deed&&townReloaded.savedMedal===town.medal,townReloaded);
      }

      const cityGate=await evalJs("(()=>{openDevelopmentOuter('city');return{active:S.battleActive,wins:S.development.outer.city.wins}})()");
      check('silver-era city gate works in browser',!cityGate.active&&cityGate.wins===0,cityGate);
      const cityStart=await evalJs("(()=>{window.__cityBefore={deed:S.res.deed,medal:S.res.medal,village:S.development.outer.village.wins,town:S.development.outer.town.wins,defeated:S.defeated.slice()};S.sciences.push('sci_silver_age');S.formation={front:[{type:'infantry',count:120,id:7501}],mid:[{type:'archer',count:100,id:7502}],back:[]};S.battleSpeed=4;CFG.battleStepDelay=1;CFG.battleRoundDelay=1;openDevelopmentOuter('city');return{active:S.battleActive,encounter:S.battleEncounter,name:B.enemyCfg?.name,alert:B.enemyCfg?.alert,enemies:B.enemyUnits?.length}})()");
      check('real outer city battle opens with separate progress',cityStart.active&&cityStart.encounter==='outerCity'&&cityStart.name==='外域铸银城塞'&&cityStart.alert===0&&cityStart.enemies===10,cityStart);
      let citySettled=false;
      for(let i=0;i<200;i++){
        if(await evalJs('B.settled===true&&S.battleActive===false')){citySettled=true;break;}
        await sleep(100);
      }
      check('real city asynchronous battle settles within 20 seconds',citySettled);
      if(citySettled){
        const city=await evalJs("(()=>{const saved=JSON.parse(localStorage.getItem('rts_save')||'null');return{before:window.__cityBefore,uiClass:document.getElementById('battle-result').className,uiText:document.getElementById('battle-result').textContent,wins:S.development.outer.city.wins,alert:S.development.outer.city.alert,village:S.development.outer.village.wins,town:S.development.outer.town.wins,deed:S.res.deed,medal:S.res.medal,defeated:S.defeated.slice(),savedWins:saved?.development?.outer?.city?.wins,savedAlert:saved?.development?.outer?.city?.alert,savedDeed:saved?.res?.deed,savedMedal:saved?.res?.medal}})()");
        check('true city victory grants deeds and medals in one save',city.uiClass==='win'&&city.wins===1&&city.alert===20&&city.village===city.before.village&&city.town===city.before.town&&city.deed===city.before.deed+32&&city.medal===city.before.medal+10&&city.savedWins===1&&city.savedAlert===20&&city.savedDeed===city.deed&&city.savedMedal===city.medal&&city.uiText.includes('地契')&&city.uiText.includes('战备勋章'),city);
        check('city victory leaves mainline progress unchanged',JSON.stringify(city.defeated)===JSON.stringify(city.before.defeated),city);
        await evalJs("exitBattle();window.__borderReloadMarker=true;'ok'");
        await send('Page.reload',{ignoreCache:true});
        check('city reload completes with real scripts',await ready(true));
        const cityReloaded=await evalJs("(()=>{const saved=JSON.parse(localStorage.getItem('rts_save')||'null');return{protected:saveProtected(),wins:S.development.outer.city.wins,village:S.development.outer.village.wins,town:S.development.outer.town.wins,deed:S.res.deed,medal:S.res.medal,savedWins:saved?.development?.outer?.city?.wins,savedDeed:saved?.res?.deed,savedMedal:saved?.res?.medal}})()");
        check('reload keeps city reward and separate progress',!cityReloaded.protected&&cityReloaded.wins===1&&cityReloaded.village===city.before.village&&cityReloaded.town===city.before.town&&cityReloaded.deed===city.deed&&cityReloaded.medal===city.medal&&cityReloaded.savedWins===1&&cityReloaded.savedDeed===city.deed&&cityReloaded.savedMedal===city.medal,cityReloaded);
      }

      const capitalGate=await evalJs("(()=>{openDevelopmentOuter('capital');return{active:S.battleActive,wins:S.development.outer.capital.wins}})()");
      check('gold-era capital gate works in browser',!capitalGate.active&&capitalGate.wins===0,capitalGate);
      const capitalStart=await evalJs("(()=>{window.__capitalBefore={deed:S.res.deed,medal:S.res.medal,village:S.development.outer.village.wins,town:S.development.outer.town.wins,city:S.development.outer.city.wins,defeated:S.defeated.slice()};S.sciences.push('sci_gold_age');S.formation={front:[{type:'infantry',count:200,id:7601}],mid:[{type:'archer',count:160,id:7602}],back:[]};S.battleSpeed=4;CFG.battleStepDelay=1;CFG.battleRoundDelay=1;openDevelopmentOuter('capital');return{active:S.battleActive,encounter:S.battleEncounter,name:B.enemyCfg?.name,alert:B.enemyCfg?.alert,enemies:B.enemyUnits?.length}})()");
      check('real outer capital battle opens with separate progress',capitalStart.active&&capitalStart.encounter==='outerCapital'&&capitalStart.name==='外域铸金王都'&&capitalStart.alert===0&&capitalStart.enemies===13,capitalStart);
      let capitalSettled=false;
      for(let i=0;i<200;i++){
        if(await evalJs('B.settled===true&&S.battleActive===false')){capitalSettled=true;break;}
        await sleep(100);
      }
      check('real capital asynchronous battle settles within 20 seconds',capitalSettled);
      if(capitalSettled){
        const capital=await evalJs("(()=>{const saved=JSON.parse(localStorage.getItem('rts_save')||'null');return{before:window.__capitalBefore,uiClass:document.getElementById('battle-result').className,uiText:document.getElementById('battle-result').textContent,wins:S.development.outer.capital.wins,alert:S.development.outer.capital.alert,village:S.development.outer.village.wins,town:S.development.outer.town.wins,city:S.development.outer.city.wins,deed:S.res.deed,medal:S.res.medal,defeated:S.defeated.slice(),savedWins:saved?.development?.outer?.capital?.wins,savedAlert:saved?.development?.outer?.capital?.alert,savedDeed:saved?.res?.deed,savedMedal:saved?.res?.medal}})()");
        check('true capital victory grants deeds and medals in one save',capital.uiClass==='win'&&capital.wins===1&&capital.alert===20&&capital.village===capital.before.village&&capital.town===capital.before.town&&capital.city===capital.before.city&&capital.deed===capital.before.deed+40&&capital.medal===capital.before.medal+20&&capital.savedWins===1&&capital.savedAlert===20&&capital.savedDeed===capital.deed&&capital.savedMedal===capital.medal&&capital.uiText.includes('地契')&&capital.uiText.includes('战备勋章'),capital);
        check('capital victory leaves mainline progress unchanged',JSON.stringify(capital.defeated)===JSON.stringify(capital.before.defeated),capital);
        await evalJs("exitBattle();window.__borderReloadMarker=true;'ok'");
        await send('Page.reload',{ignoreCache:true});
        check('capital reload completes with real scripts',await ready(true));
        const capitalReloaded=await evalJs("(()=>{const saved=JSON.parse(localStorage.getItem('rts_save')||'null');return{protected:saveProtected(),wins:S.development.outer.capital.wins,village:S.development.outer.village.wins,town:S.development.outer.town.wins,city:S.development.outer.city.wins,deed:S.res.deed,medal:S.res.medal,savedWins:saved?.development?.outer?.capital?.wins,savedDeed:saved?.res?.deed,savedMedal:saved?.res?.medal}})()");
        check('reload keeps capital reward and separate progress',!capitalReloaded.protected&&capitalReloaded.wins===1&&capitalReloaded.village===capital.before.village&&capitalReloaded.town===capital.before.town&&capitalReloaded.city===capital.before.city&&capitalReloaded.deed===capital.deed&&capitalReloaded.medal===capital.medal&&capitalReloaded.savedWins===1&&capitalReloaded.savedDeed===capital.deed&&capitalReloaded.savedMedal===capital.medal,capitalReloaded);
      }
    }
  }
  const offline=await evalJs("(()=>{S.formation={front:[],mid:[],back:[]};S.pool={};S.queue={};S.popAlloc=Object.fromEntries(Object.keys(S.popAlloc).map(k=>[k,0]));S.population.current=0;S.res.food=1000;S.res.iron=0;S.development.border.sites.iron.level=2;const selected=selectDevelopmentSite('iron');S.development.border.collection.elapsedSec=30;save();const now=Date.now();_loadedTs=now-121000;Date.now=()=>now;const result=settleOffline();updateUI();const saved=JSON.parse(localStorage.getItem('rts_save')||'null');return{selected,result,iron:S.res.iron,clock:S.development.border.collection.elapsedSec,savedIron:saved?.res?.iron,savedClock:saved?.development?.border?.collection?.elapsedSec,reportVisible:document.getElementById('main').textContent.includes('离线结算')}})()");
  check('real browser offline point credit and persisted clock',offline.selected?.ok===true&&offline.result?.ok===true&&offline.result?.durationSec===121&&Math.abs(offline.iron-2.4)<1e-9&&Math.abs(offline.savedIron-2.4)<1e-9&&offline.clock===31&&offline.savedClock===31&&offline.reportVisible,offline);
  await send('Page.reload',{ignoreCache:true});
  check('offline point reload completes with real scripts',await ready());
  const offlineReload=await evalJs("(()=>({iron:S.res.iron,clock:S.development.border.collection.elapsedSec,protected:saveProtected()}))()");
  check('real browser reload does not duplicate offline point reward',Math.abs(offlineReload.iron-2.4)<1e-9&&offlineReload.clock===31&&!offlineReload.protected,offlineReload);
  const paused=await evalJs("(()=>{S.battleActive=true;const before={iron:S.res.iron,clock:S.development.border.collection.elapsedSec};const advance=offlineAdvanceSec(121,0.6);S.battleActive=false;return{before,after:{iron:S.res.iron,clock:S.development.border.collection.elapsedSec},advance}})()");
  check('real browser active battle pauses offline point clock',paused.advance?.elapsed===121&&paused.after.clock===paused.before.clock&&paused.after.iron===paused.before.iron,paused);
  check('zero uncaught browser exceptions',exceptions.length===0,exceptions.slice(0,4));
  console.log(JSON.stringify({checks,exceptions,passed:checks.filter(x=>x.ok).length,failed:checks.filter(x=>!x.ok).length,note:'Research and army were injected to test browser settlement, not natural reachability.'},null,2));
  process.exitCode=checks.some(x=>!x.ok)?1:0;
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error&&error.stack||error);process.exitCode=2;}).finally(async()=>{
  try{if(ws?.readyState===1)ws.send(JSON.stringify({id:++nextId,method:'Browser.close'}));}catch(_){}
  await sleep(800);
  try{ws?.close();}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(500);
  try{
    if(path.resolve(profile).startsWith(tempRoot+path.sep)&&fs.existsSync(profile))
      fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});
  }
  catch(error){console.error('PROFILE_CLEANUP_FAILED',error.message);}
  process.exit(process.exitCode??0);
});
