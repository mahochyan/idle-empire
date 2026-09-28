'use strict';
// P121: continue the actual zero-win P101 economic route beyond 18 residents
// using the existing market and settlement actions only.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const sourceProbe=path.join(root,'tools/verify/probe-population-early-18.js');
const sourceArgs=process.argv.slice(2);
assert.ok(sourceArgs.every(arg=>/^--research-workers=[2-7]$/.test(arg)||arg==='--research-priority'),
  `不支持的P101路线参数：${sourceArgs.join(' ')}`);
const source=spawnSync(process.execPath,[sourceProbe,...sourceArgs,'--capture-final-save'],
  {cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
assert.equal(source.status,0,`P101零胜场人口路线失败：${source.stderr||source.stdout}`);
const prepared=JSON.parse(source.stdout);
assert.equal(prepared.battleWins,0);
const e=environment({rts_save:prepared.finalStateSave});
const run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.defeated.length'),0);
assert.equal(run('popCurrent()'),18);
assert.equal(run('maxPop()'),18);

const start={tick:run('S.tick'),population:run('popCurrent()'),capacity:run('maxPop()'),
  allocation:run('({...S.popAlloc})'),resources:run('({...S.res})'),settlements:run('({...S.settlements})')};
const quote=run("settlementBatchPreview('village',1)");
assert.equal(quote.ok,false);
assert.equal(quote.level,5);
const deedNeeded=quote.cost;
const targetCoin=deedNeeded*100;
const trades=[];
let minFood=run('S.res.food');
let waitSeconds=0;

function trackTick(){
  run('tick()');
  waitSeconds++;
  if(Number.isFinite(run('S.res.food')))minFood=Math.min(minFood,run('S.res.food'));
}
function sellSurplus(key,reserve){
  const balance=run(`S.res.${key}`);
  const amount=Math.floor(balance-reserve);
  if(amount<1000)return false;
  const before=run('S.res.coin');
  const result=run(`exchangeResource('${key}','coin',${amount})`);
  assert.equal(result?.ok,true,`出售${key}换币失败：${JSON.stringify(result)}`);
  trades.push({from:key,amount,coinBefore:before,coinAfter:run('S.res.coin'),received:result.get,
    resourcesAfter:{wood:run('S.res.wood'),stone:run('S.res.stone'),food:run('S.res.food')}});
  if(Number.isFinite(run('S.res.food')))minFood=Math.min(minFood,run('S.res.food'));
  return true;
}

let guard=0;
while(run('S.res.coin')+1e-7<targetCoin){
  assert.ok(++guard<100,'筹币循环次数异常');
  let sold=false;
  for(const [key,reserve] of [['wood',100],['stone',1000],['food',1000]])
    if(sellSurplus(key,reserve))sold=true;
  if(run('S.res.coin')+1e-7>=targetCoin)break;
  if(sold)continue;
  const possible=['wood','stone','food'].filter(key=>{
    const reserve=key==='wood'?100:1000;
    return reserve+1000<=run(`resCap('${key}')`);
  });
  assert.ok(possible.length>0,'仓容不足以继续生产下一笔市场兑换');
  const before=run('S.tick');
  while(!possible.some(key=>run(`S.res.${key}>=${key==='wood'?1100:2000}`))){
    assert.ok(waitSeconds<20000,'购契等待超过20000在线秒');
    trackTick();
  }
  assert.ok(run('S.tick')>before);
}
assert.ok(run('S.res.coin')>=targetCoin);
const deedTrade=run(`exchangeResource('coin','deed',${targetCoin})`);
assert.equal(deedTrade?.ok,true,`购入地契失败：${JSON.stringify(deedTrade)}`);
assert.equal(run('S.res.deed')>=deedNeeded,true);
const expansion=run("upgradeSettlement('village')");
assert.equal(expansion?.ok,true,`无战斗扩容失败：${JSON.stringify(expansion)}`);
assert.equal(run('maxPop()'),19);
const beforeBirthTick=run('S.tick');
while(run('popCurrent()')<19){
  assert.ok(run('S.tick')-beforeBirthTick<20,'扩容后自然出生等待超过20秒');
  trackTick();
}
assert.equal(run('S.defeated.length'),0);
assert.ok(minFood>=1000-1e-9,`筹币时跌破粮食保留线：${minFood}`);
const afterBirth={tick:run('S.tick'),population:run('popCurrent()'),capacity:run('maxPop()'),
  free:run('popFree()'),resources:run('({...S.res})'),allocation:run('({...S.popAlloc})'),
  settlements:run('({...S.settlements})')};
const extraWorker=run("setPopAlloc('wood',2)");
assert.equal(extraWorker?.ok,true,`分配第19名村民到木工失败：${JSON.stringify(extraWorker)}`);
assert.equal(run('popAllocTotal()'),17);
const woodRate=run("prodRate('wood')");
assert.equal(run('S.defeated.length'),0);
const artifact={batch:'P121',
  unit:'online simulated seconds; residents; deeds; resources; worker assignments',
  method:'load the exact terminal save from P101 real new-game zero-win route; call the current market exchange, settlement upgrade, population tick and job assignment functions',
  scope:'extend the no-battle 18-person route to the next village capacity and one additional naturally born resident; no candidate level reward, injected resources, manual state edits or player save writes',
  battleWins:0,sourceRoute:prepared.route,sourceOnlineSeconds:prepared.activeOnlineSeconds,
  sourceElapsedSimulationSeconds:prepared.elapsedSimulationSeconds,sourceArgs,
  deedNeeded,targetCoin,start,tradeCount:trades.length,trades,
  deedTrade:{coinSpent:targetCoin,deedsReceived:deedTrade.get},expansion,
  waitSeconds,minFood:Number(minFood.toFixed(4)),beforeBirthTick,afterBirth,
  final:{tick:run('S.tick'),population:run('popCurrent()'),capacity:run('maxPop()'),
    allocated:run('popAllocTotal()'),free:run('popFree()'),woodWorkers:run("S.popAlloc.wood"),
    woodRate,resources:run('({...S.res})'),settlements:run('({...S.settlements})'),battleWins:run('S.defeated.length')}};
const rawPath=path.join(root,'docs/codex/reports/data/p121-zero-win-population-19.json');
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P121',battleWins:artifact.battleWins,
  sourceRoute:artifact.sourceRoute,sourceOnlineSeconds:artifact.sourceOnlineSeconds,
  start:artifact.start,capacityCost:artifact.deedNeeded+' deeds / '+artifact.targetCoin+' coin',
  waitSeconds:artifact.waitSeconds,minFood:artifact.minFood,
  final:artifact.final,rawData:rawPath},null,2));
