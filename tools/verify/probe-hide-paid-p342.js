'use strict';
// One paid P338 continuation: a real wild victory, the pending exchange level-up, and available hide stock slots.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data='docs/codex/reports/data/';
const sourceFile=data+'p338-soul-production-knowledge-restored-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8'),origin=JSON.parse(raw);
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const seed=Number(process.argv[2]||1);
assert.ok(Number.isSafeInteger(seed)&&seed>0);
const e=environment({rts_save:raw}),r=e.run;
assert.equal(r('loadSaveAndApply().status'),'migrated');
assert.equal(r('S.res.hide'),0);
r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
  globalThis.__timers=new Map();globalThis.__nextTimer=1;
  setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  addLog=m=>S.log.push(String(m));
  globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
const opening=r('({army:armyCount(),deployed:formSoldierCount(),hide:S.res.hide,bone:S.res.bone,level:S.beastExchange.level,progress:S.beastExchange.progress,charges:S.beastExchange.refreshCharges,alert:S.killValues.wildWyrm,rng:__rng})');
r("openMaterialDomain('wyrmSinew')");assert.equal(r('S.battleActive'),true);
let callbacks=0;while(r('S.battleActive')&&callbacks++<3000)assert.equal(r('__step()'),true);
assert.ok(callbacks<3000);
const battleResult=r("document.getElementById('battle-result').className");
const afterBattle=r('({army:armyCount(),deployed:formSoldierCount(),hide:S.res.hide,bone:S.res.bone,level:S.beastExchange.level,progress:S.beastExchange.progress,charges:S.beastExchange.refreshCharges,alert:S.killValues.wildWyrm,rng:__rng})');
assert.equal(battleResult,'win','chosen stream should actually win');
assert.equal(afterBattle.hide,88);assert.equal(afterBattle.bone,opening.bone+666);
r('exitBattle()');
const upgrade=r('upgradeBeastExchange()');assert.equal(upgrade?.ok,true);assert.equal(upgrade.level,31);
const refreshes=[];let purchase=null;
for(let i=0;i<5;i++){
  const refresh=r('refreshBeastExchange()');assert.equal(refresh?.ok,true);
  const offers=r(`Object.entries(CFG.beastExchange.hideTrades).map(([id,trade])=>({id,
    count:S.beastExchange.hideOffers[id].count,quality:S.beastExchange.hideOffers[id].quality,
    cost:beastHideTradeCost(id),get:trade.get,gain:beastHideTradeReward(id)})).filter(x=>x.count>0)`);
  const eligible=offers.find(x=>x.cost<=r('S.res.hide')&&r(`S.res.${x.get}`)+x.gain<=r(`resCap('${x.get}')`));
  refreshes.push({i:i+1,offers,charges:refresh.charges,eligible:eligible?.id??null});
  if(eligible){purchase=r(`exchangeHideForResource(${eligible.id},1)`);assert.equal(purchase?.ok,true);break}
}
const final=r('({army:armyCount(),deployed:formSoldierCount(),hide:S.res.hide,bone:S.res.bone,level:S.beastExchange.level,progress:S.beastExchange.progress,charges:S.beastExchange.refreshCharges,alert:S.killValues.wildWyrm,rng:__rng})');
const save=e.store.get('rts_save'),reload=environment({rts_save:save});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
for(const key of ['hide','bone'])assert.equal(reload.run(`S.res.${key}`),final[key]);
assert.equal(reload.run('S.beastExchange.progress'),final.progress);
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const saveFile=data+`p342-hide-paid-seed${seed}-save.json`;
fs.writeFileSync(path.join(root,saveFile),save);
const out=data+`p342-hide-paid-seed${seed}.json`;
fs.writeFileSync(path.join(root,out),JSON.stringify({sourceFile,sourceSha256:sha(raw),seed,
  unit:'one real battle, resources, soldiers, exchange transactions, refresh charges',
  opening,battleResult,callbacks,afterBattle,upgrade,refreshes,purchase,final,saveFile,saveSha256:sha(save),
  limits:['One selected deterministic battle stream from a historically paid late-game checkpoint, not a fresh-game progression or player win rate.',
    'No soldier replenishment or online calendar advancement; refreshes spend stored charges only.']},null,2)+'\n');
console.log(JSON.stringify({seed,opening,battleResult,afterBattle,upgrade,
  refreshes:refreshes.map(x=>({i:x.i,offers:x.offers.length,charges:x.charges,eligible:x.eligible})),purchase,final,saveFile,out},null,2));
