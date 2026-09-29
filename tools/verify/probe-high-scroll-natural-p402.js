'use strict';
// Fixed-policy, single-seed paid replay from the P400 armament checkpoint.
// No resource, inventory, offer, level, army, or victory state is injected.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {environment} = require('../../tests/progression/harness');

const root = path.resolve(__dirname, '../..');
const source = 'docs/codex/reports/data/p400-armament-natural-invested-save.json';
const raw = fs.readFileSync(path.join(root, source), 'utf8');
const original = JSON.parse(raw);
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const codeSha256=Object.fromEntries(['config.js','levels.js','math.js'].map(file=>
  [file,sha256(fs.readFileSync(path.join(root,file),'utf8'))]));
const env = environment({rts_save:raw});
const run = env.run;

run(`globalThis.__clockMs=${original.ts};globalThis.__OriginalDate=Date;
  globalThis.Date=class extends __OriginalDate {static now(){return __clockMs}};
  globalThis.__rng=402;globalThis.__rngDraws=0;
  Math.random=()=>{__rngDraws++;let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
  globalThis.__timers=new Map();globalThis.__timerId=1;
  setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};
  clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{
    if(id==='battle-vfx-layer')return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  addLog=m=>{S.log.push({time:'probe',msg:String(m)});if(S.log.length>200)S.log.splice(0,S.log.length-200)};`);

const load = run('loadSaveAndApply()');
assert.equal(load.status, 'migrated');
assert.equal(env.store.get('rts_save_premigration'), raw);
const snapshot = () => run(`({tick:S.tick,clockMs:Date.now(),army:armyCount(),deployed:formSoldierCount(),
  knowledge:S.res.tech,knowledgeCap:resCap('tech'),food:S.res.food,
  market:{level:S.beastExchange.level,progress:S.beastExchange.progress,
    refreshClock:S.beastExchange.refreshClock,charges:S.beastExchange.refreshCharges,
    scrollUsed:S.beastExchange.scrollUsed,usedTiers:{...S.beastExchange.scrollUsedTiers}},
  scrolls:Object.fromEntries([1,2,3,4,5].map(t=>[t,S.items[t===1?'storageScroll':'storageScroll'+t]])),
  materials:Object.fromEntries(CFG.beastExchange.scrollMaterials.map(k=>[k,S.items[k]])),
  offers:{heart:S.beastExchange.heartOffers,heartQuality:S.beastExchange.heartQuality,
    wild:JSON.parse(JSON.stringify(S.beastExchange.wildOffers)),tiers:JSON.parse(JSON.stringify(S.beastExchange.tierOffers))},
  alerts:{turtle:S.killValues.wildTurtle,wyrm:S.killValues.wildWyrm},rng:__rng,draws:__rngDraws})`);
const copy = value => JSON.parse(JSON.stringify(value));
const start = copy(snapshot());
const ledger = [];

function buyAffordableOffers(label) {
  const before = copy(snapshot());
  const purchases = [];
  for (const material of run('([...CFG.beastExchange.scrollMaterials])')) {
    while (run(`beastScrollOfferCount('${material}')`) > 0) {
      const unitCost = run(`beastScrollTradeCost('${material}')`);
      const stock = run(`S.items.${material}`);
      if (stock < unitCost) break;
      const result = run(`exchangeWildMaterialForScrolls('${material}',1)`);
      assert.equal(result.ok, true, `Ⅰ阶交换 ${material}: ${JSON.stringify(result)}`);
      purchases.push({kind:'first',material,unitCost,result:copy(result)});
    }
  }
  // Better warehouse efficiency first; never exchange without real current offer and stock.
  for (const tier of [5,4,3,2]) {
    while (run(`S.beastExchange.tierOffers[${tier}].count`) > 0) {
      const unitCost = run(`beastTierScrollTradeCost(${tier})`);
      if (run('S.items.storageScroll') < unitCost) break;
      const result = run(`exchangeTierScroll(${tier},1)`);
      assert.equal(result.ok, true, `高阶交换 ${tier}: ${JSON.stringify(result)}`);
      purchases.push({kind:'tier',tier,unitCost,result:copy(result)});
      const use = run(`useTierStorageScroll(${tier},1)`);
      assert.equal(use.ok, true, `高阶使用 ${tier}: ${JSON.stringify(use)}`);
      purchases.push({kind:'use',tier,result:copy(use)});
      break;
    }
    if (purchases.some(x=>x.kind==='use')) break;
  }
  const after = copy(snapshot());
  ledger.push({kind:'claim',label,before,purchases,after});
  return purchases.some(x=>x.kind==='use');
}

const initialClaim = buyAffordableOffers('existing-v34-offers');
let battle = null;
if (!initialClaim) {
  const before = copy(snapshot());
  const started = run("openMaterialDomain('turtleShell');S.battleActive");
  assert.equal(started, true, '真实郊野龟壳猎场未开启');
  const enemy = copy(run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})'));
  let callbacks = 0;
  while (run('S.battleActive') && callbacks++ < 3000) assert.equal(run('__step()'), true, '战斗回调中断');
  assert.ok(callbacks < 3000, '战斗回调超限');
  const result = run("document.getElementById('battle-result').className");
  assert.ok(['win','lose'].includes(result), `未结算战斗: ${result}`);
  run('exitBattle()');
  const after = copy(snapshot());
  battle = {kind:'turtleShell',before,enemy,result,callbacks,after,
    casualties:before.army-after.army,materialDelta:after.materials.turtleShell-before.materials.turtleShell,
    alertDelta:after.alerts.turtle-before.alerts.turtle};
  assert.ok(battle.casualties >= 0);
  assert.equal(battle.alertDelta, result==='win'?10:0);
  assert.equal(battle.materialDelta>0, result==='win');
  ledger.push({kind:'battle',...battle});
}

let acquired = initialClaim;
let refreshes = 0, onlineSeconds = 0;
while (!acquired && refreshes < 10) {
  let waitSeconds = 0;
  while (run('S.beastExchange.refreshCharges') === 0 && waitSeconds < 1200) {
    run('__clockMs+=1000;tick()');
    waitSeconds++;
  }
  onlineSeconds += waitSeconds;
  assert.ok(run('S.beastExchange.refreshCharges') > 0, '在线等待未恢复刷新次数');
  const before = copy(snapshot());
  const refresh = run('refreshBeastExchange()');
  assert.equal(refresh.ok, true, `真实刷新失败 ${JSON.stringify(refresh)}`);
  refreshes++;
  const after = copy(snapshot());
  ledger.push({kind:'refresh',number:refreshes,waitSeconds,before,result:copy(refresh),after});
  acquired = buyAffordableOffers(`refresh-${refreshes}`);
}

const final = copy(snapshot());
const gate = copy(run(`({quantumKnowledgeLevel:S.eraStorage.quantumKnowledge,
  nextCost:eraStorageCost('quantumKnowledge'),knowledgeCap:resCap('tech'),
  revivalLeaf:S.items.revivalLeaf,knowledge:S.res.tech,
  nextScience:(typeof canResearch==='function'?canResearch('sci_astral_singularity'):null)})`));
const saved = env.store.get('rts_save');
const parsed = JSON.parse(saved);
assert.equal(parsed.v, run('targetSaveVersion()'));
assert.equal(parsed.items.storageScroll, final.scrolls[1]);
for (const tier of [2,3,4,5]) {
  assert.equal(parsed.items['storageScroll'+tier], final.scrolls[tier]);
  assert.equal(parsed.beastExchange.scrollUsedTiers[tier], final.market.usedTiers[tier]);
}
const reload = environment({rts_save:saved});
assert.equal(reload.run('loadSaveAndApply().status'), 'ok');
assert.equal(reload.run("resCap('tech')"), final.knowledgeCap);
assert.equal(reload.run('S.tick'), final.tick);
assert.equal(sha256(fs.readFileSync(path.join(root, source), 'utf8')), sha256(raw));

const report = {baselineHead:'ba112c4224c13b8898a525abe5c559377a9fca52',source,
  sourceSha256:sha256(raw),codeSha256,seed:402,random:'xorshift32 one stream, no seed search',
  policy:'Claim available affordable I-scroll offers, fight one turtle domain if no immediate higher scroll, then at most ten paid manual refreshes; after each refresh buy affordable I scrolls, then highest affordable II–V scroll and use one. No resource or offer injection.',
  units:'game resources and items; tick and onlineSeconds in seconds; clockMs in milliseconds',
  migration:{status:load.status,premigrationProtected:env.store.get('rts_save_premigration')===raw},
  start,battle,refreshes,onlineSeconds,acquired,ledger,final,gate,
  finalSaveSha256:sha256(saved),reloaded:true};
const reportFile = path.join(root,'docs/codex/reports/data/p402-high-scroll-natural.json');
const saveFile = path.join(root,'docs/codex/reports/data/p402-high-scroll-natural-save.json');
fs.writeFileSync(reportFile, JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(saveFile, saved);
console.log(JSON.stringify({sourceSha256:report.sourceSha256,migration:report.migration,
  start:{cap:start.knowledgeCap,scrolls:start.scrolls,materials:start.materials,charges:start.market.charges},
  battle: battle&&{result:battle.result,casualties:battle.casualties,materialDelta:battle.materialDelta,alertDelta:battle.alertDelta},
  refreshes,onlineSeconds,acquired,purchases:ledger.filter(x=>x.kind==='claim').flatMap(x=>x.purchases),
  final:{cap:final.knowledgeCap,scrolls:final.scrolls,usedTiers:final.market.usedTiers,materials:final.materials,
    army:final.army,alerts:final.alerts,charges:final.market.charges},gate,
  finalSaveSha256:report.finalSaveSha256,reloaded:true},null,2));
