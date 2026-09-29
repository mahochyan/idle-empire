'use strict';
// Edge/CDP high-tier scroll UI and v34 migration smoke. Uses an isolated temp profile.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {spawn}=require('node:child_process');
const {killTreeSync}=require('../ie001/edge-reaper');

const root=path.resolve(__dirname,'../..');
const fixturePath=path.join(root,'docs/codex/reports/data/p400-four-strategy-economic-l40-frontier-save.json');
const resultPath=path.join(root,'docs/codex/reports/data/p401-high-scroll-browser.json');
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js','ui.js','index.html'];
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const sourceBefore=Object.fromEntries(sourceFiles.map(file=>[file,sha(file)]));
const edgePath=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!edgePath){console.error('NO_BROWSER');process.exit(2)}
const tempRoot=path.resolve(os.tmpdir());
const profile=fs.mkdtempSync(path.join(tempRoot,'high-scroll-p401-edge-'));
if(!path.resolve(profile).startsWith(tempRoot+path.sep))throw Error('profile outside temp');
const port=10000+Math.floor(Math.random()*20000);
const url=pathToFileURL(path.join(root,'index.html')).href;
const edge=spawn(edgePath,['--headless=new','--disable-gpu','--no-first-run',
  '--disable-extensions','--no-sandbox','--disable-background-networking',
  '--disable-component-update','--disable-sync','--remote-debugging-port='+port,
  '--user-data-dir='+profile,url],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ws,id=0,passed=0;
const pending=new Map(),exceptions=[],checks=[];
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const n=++id;pending.set(n,{resolve,reject});
    ws.send(JSON.stringify({id:n,method,params}));
  });
}
async function evalJs(expression){
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)
    throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function ready(expression){
  for(let n=0;n<50;n++){
    try{if(await evalJs(expression))return true}catch(_){}
    await sleep(200);
  }
  return false;
}
function check(name,actual,expected){
  assert.deepEqual(actual,expected,name);
  passed++;checks.push({name,actual});console.log('PASS '+name);
}
async function viewport(width){
  await send('Emulation.setDeviceMetricsOverride',
    {width,height:780,deviceScaleFactor:1,mobile:true});
  await evalJs("S.page='fight';S._fightTab='expedition';updateUI()");
  const geometry=await evalJs(`(()=>{const card=[...document.querySelectorAll('#main .card')]
    .find(x=>x.textContent.includes('边贸行 Lv'));
    return {width:innerWidth,documentOverflow:document.documentElement.scrollWidth>innerWidth,
      cardOverflow:!!card&&card.scrollWidth>card.clientWidth+1,cardPresent:!!card}})()`);
  check(width+'px 边贸行无横向溢出',geometry,
    {width,documentOverflow:false,cardOverflow:false,cardPresent:true});
}
async function tierUi(){
  return evalJs(`(()=>{const tiers=[2,3,4,5];
    return Object.fromEntries(tiers.map(t=>{
      const input=document.getElementById('tier-scroll-count-'+t);
      const trade=[...document.querySelectorAll('button')].find(b=>
        b.getAttribute('onclick')===\"tierScrollActionFromUI('trade',\"+t+')');
      const use=[...document.querySelectorAll('button')].find(b=>
        b.getAttribute('onclick')===\"tierScrollActionFromUI('use',\"+t+')');
      return [t,{input:!!input,trade:!!trade,use:!!use,
        tradeDisabled:trade?.disabled??null,useDisabled:use?.disabled??null}]
    }))})()`);
}
async function setLevel(level){
  check('设置隔离夹具边贸行 Lv'+level,
    await evalJs(`(()=>{S.beastExchange.level=${level};const saved=save();updateUI();
      return {ok:saved.ok,level:JSON.parse(localStorage.getItem('rts_save')).beastExchange.level}})()`),
    {ok:true,level});
}
async function clickOnclick(value){
  const expression=`(()=>{const button=[...document.querySelectorAll('button')].find(b=>
    b.getAttribute('onclick')===${JSON.stringify(value)});
    if(!button)return{found:false};
    const beforeDisabled=button.disabled;
    button.click();return{found:true,beforeDisabled}})()`;
  return evalJs(expression);
}

(async()=>{
  let pages;
  for(let n=0;n<40;n++){
    try{pages=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
      if(pages.some(page=>page.type==='page'))break}catch(_){}
    await sleep(250);
  }
  const page=pages?.find(page=>page.type==='page'&&page.url===url)||
    pages?.find(page=>page.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=event=>{
    const data=JSON.parse(event.data);
    if(data.id&&pending.has(data.id)){
      const job=pending.get(data.id);pending.delete(data.id);
      data.error?job.reject(Error(JSON.stringify(data.error))):job.resolve(data.result);
    }
    if(data.method==='Runtime.exceptionThrown')
      exceptions.push(data.params.exceptionDetails.exception?.description||
        data.params.exceptionDetails.text);
  };
  await send('Runtime.enable');await send('Page.enable');
  check('真实页面加载高阶密卷动作',
    await ready('typeof S!=="undefined"&&typeof tierScrollActionFromUI==="function"&&typeof exchangeTierScroll==="function"'),true);

  // A checked-in, legitimate v34 game save is copied only into this browser profile.
  // Resetting the fixture timestamp avoids unrelated offline production on reload.
  const fixture=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
  assert.equal(fixture.v,34);
  fixture.ts=Date.now();
  const fixtureText=JSON.stringify(fixture);
  await evalJs(`localStorage.setItem('rts_save',${JSON.stringify(fixtureText)})`);
  await send('Page.reload',{ignoreCache:true});
  check('v34 档真实页面迁移到 v35',
    await ready('typeof S!=="undefined"&&JSON.parse(localStorage.getItem("rts_save"))?.v===35'),true);
  check('迁移前原文独立保留',
    await evalJs(`localStorage.getItem('rts_save_premigration')===${JSON.stringify(fixtureText)}`),true);
  check('迁移前常规备份保留原文',
    await evalJs(`localStorage.getItem('rts_save_backup_1')===${JSON.stringify(fixtureText)}`),true);
  check('新增密卷字段安全默认值',await evalJs(`(()=>{
    const save=JSON.parse(localStorage.getItem('rts_save'));
    return {items:[2,3,4,5].map(t=>save.items['storageScroll'+t]),
      used:[2,3,4,5].map(t=>save.beastExchange.scrollUsedTiers[t]),
      offers:[2,3,4,5].map(t=>save.beastExchange.tierOffers[t].count)};
  })()`),{items:[0,0,0,0],used:[0,0,0,0],offers:[0,0,0,0]});

  await viewport(320);
  check('低等级隐藏全部高阶密卷入口',await tierUi(),Object.fromEntries(
    [2,3,4,5].map(t=>[t,{input:false,trade:false,use:false,
      tradeDisabled:null,useDisabled:null}])));
  await setLevel(29);
  check('29级仍隐藏二阶密卷',await tierUi(),Object.fromEntries(
    [2,3,4,5].map(t=>[t,{input:false,trade:false,use:false,
      tradeDisabled:null,useDisabled:null}])));
  for(const [level,unlocked] of [[30,2],[40,3],[50,4],[60,5]]){
    await setLevel(level);
    const ui=await tierUi();
    check(level+'级按阶显示密卷',Object.fromEntries([2,3,4,5].map(t=>
      [t,{input:ui[t].input,trade:ui[t].trade,use:ui[t].use}])),
    Object.fromEntries([2,3,4,5].map(t=>
      [t,{input:t<=unlocked,trade:t<=unlocked,use:t<=unlocked}])));
  }
  await viewport(390);
  await setLevel(30);
  check('30级二阶未上架时禁用交易', (await tierUi())[2].tradeDisabled,true);

  // Deterministic offer roll: at Lv30, hit=floor(.18*445)=80 falls into tier II.
  // First-tier stock is only a test fixture; exchange and use are actual button clicks.
  check('隔离夹具准备三张一阶图纸',await evalJs(`(()=>{
    S.items.storageScroll=3;const result=save();updateUI();
    return {ok:result.ok,stock:S.items.storageScroll}})()`),{ok:true,stock:3});
  await evalJs('Math.random=()=>0.18');
  check('点击刷新货品入口',await clickOnclick("beastExchangeActionFromUI('refresh')"),
    {found:true,beforeDisabled:false});
  check('刷新真实生成二阶货位并写档',await evalJs(`(()=>{
    const saved=JSON.parse(localStorage.getItem('rts_save'));
    return {count:S.beastExchange.tierOffers[2].count,
      savedCount:saved.beastExchange.tierOffers[2].count,
      quality:S.beastExchange.tierOffers[2].quality,
      cost:beastTierScrollTradeCost(2),charges:S.beastExchange.refreshCharges};
  })()`),{count:11,savedCount:11,quality:80,cost:3,charges:4});
  await viewport(320);
  check('上架后二阶交易按钮可点击',(await tierUi())[2].tradeDisabled,false);
  check('点击交易密卷入口',await clickOnclick("tierScrollActionFromUI('trade',2)"),
    {found:true,beforeDisabled:false});
  check('交易实际扣三张图纸并写档',await evalJs(`(()=>{
    const saved=JSON.parse(localStorage.getItem('rts_save'));
    return {first:S.items.storageScroll,tier:S.items.storageScroll2,
      offer:S.beastExchange.tierOffers[2].count,progress:S.beastExchange.progress,
      savedFirst:saved.items.storageScroll,savedTier:saved.items.storageScroll2};
  })()`),{first:0,tier:1,offer:10,progress:1,savedFirst:0,savedTier:1});
  check('交易后使用密卷按钮可点击',(await tierUi())[2].useDisabled,false);
  const capBefore=await evalJs("resCap('wood')");
  check('使用前木仓基数',capBefore,2400);
  check('点击使用密卷入口',await clickOnclick("tierScrollActionFromUI('use',2)"),
    {found:true,beforeDisabled:false});
  check('使用后库存与仓容持久增加',await evalJs(`(()=>{
    const saved=JSON.parse(localStorage.getItem('rts_save'));
    return {stock:S.items.storageScroll2,used:S.beastExchange.scrollUsedTiers[2],
      savedStock:saved.items.storageScroll2,savedUsed:saved.beastExchange.scrollUsedTiers[2],
      woodCap:resCap('wood')};
  })()`),{stock:0,used:1,savedStock:0,savedUsed:1,woodCap:2436});

  await send('Page.reload',{ignoreCache:true});
  check('刷新重载保留二阶使用及货位',
    await ready('typeof S!=="undefined"&&S.beastExchange?.scrollUsedTiers?.[2]===1&&S.beastExchange?.tierOffers?.[2]?.count===10'),true);
  await viewport(390);
  check('重载后已用二阶密卷仍可见', (await tierUi())[2].input,true);
  check('重载后准确保持木仓 2436',await evalJs("resCap('wood')"),2436);
  check('页面无未捕获异常',exceptions,[]);
  check('运行页面源文件执行期间未变化',
    Object.fromEntries(sourceFiles.map(file=>[file,sha(file)])),sourceBefore);
  const result={batch:'P401',test:'Edge high-tier scroll UI and v34 migration',
    baselineSave:fixturePath,baselineVersion:34,fixtureSha256:crypto.createHash('sha256')
      .update(fixtureText).digest('hex'),runtimeSaveVersion:35,
    viewports:[320,390],sourceSha256:sourceBefore,checks,passed,exceptions,
    final:await evalJs(`({v:JSON.parse(localStorage.getItem('rts_save')).v,
      level:S.beastExchange.level,first:S.items.storageScroll,
      tier2:S.items.storageScroll2,used2:S.beastExchange.scrollUsedTiers[2],
      offer2:S.beastExchange.tierOffers[2].count,woodCap:resCap('wood')})`)};
  fs.writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n');
  console.log(`high scroll browser: ${passed} passed; data ${resultPath}`);
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error?.stack||error);process.exitCode=1})
  .finally(async()=>{
    try{ws?.close()}catch(_){}
    killTreeSync(edge.pid);
    if(path.resolve(profile).startsWith(tempRoot+path.sep))
      for(let n=0;n<8&&fs.existsSync(profile);n++){
        await sleep(250);
        try{fs.rmSync(profile,{recursive:true,force:true})}
        catch(error){if(n===7)console.error('PROFILE_CLEANUP_FAILED',error.message)}
      }
  });
