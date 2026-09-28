'use strict';
// Settle the P343 paid hunting yield against actually offered exchange goods.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data='docs/codex/reports/data/';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceFile=data+'p343-wild-paid-recovery-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8'),origin=JSON.parse(raw);
assert.equal(sha(raw),'22428e5ead012ec16c45f82ce0885166b09054a90c5cc93e11a130a2f862fee7');
const prior=JSON.parse(fs.readFileSync(path.join(root,data+'p343-wild-paid-recovery.json'),'utf8'));
assert.equal(prior.finalSha256,sha(raw));
const e=environment({rts_save:raw}),r=e.run;
assert.equal(r('loadSaveAndApply().status'),'ok');
r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
  globalThis.__rng=${prior.final.rng};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
const state=()=>r('({tick:S.tick,bone:S.res.bone,hide:S.res.hide,medal:S.res.medal,scroll:S.items.storageScroll,level:S.beastExchange.level,progress:S.beastExchange.progress,need:beastExchangeProgressNeed(S.beastExchange.level),charges:S.beastExchange.refreshCharges,rng:__rng})');
const offers=()=>r(`({hide:Object.entries(S.beastExchange.hideOffers).filter(([id,o])=>o.count>0).map(([id,o])=>({id:Number(id),count:o.count,cost:beastHideTradeCost(id),gain:beastHideTradeReward(id),get:CFG.beastExchange.hideTrades[id].get})),
  wild:Object.entries(S.beastExchange.wildOffers).filter(([key,o])=>o.count>0).map(([key,o])=>({key,count:o.count,cost:beastScrollTradeCost(key),stock:S.items[key]})),
  heart:S.beastExchange.heartOffers,heartCost:beastHeartTradeCost(),heartStock:S.items.boarHeart,
  soul:Object.entries(S.beastExchange.soulOffers).filter(([key,n])=>n>0).map(([key,n])=>({key,count:n,cost:CFG.beastExchange.soulTrades[key].cost,stock:S.items[key],gain:CFG.beastExchange.soulTrades[key].stones})),
  medal:S.beastExchange.medalOffers})`);
const opening=state(),screens=[],purchases=[];
assert.equal(opening.bone,7756);assert.equal(opening.hide,955);assert.equal(opening.progress,1);
function purchaseOne(kind,key,call){
  const before=state(),action=r(call);
  assert.equal(action?.ok,true,kind+':'+key+' '+JSON.stringify(action));
  const after=state();assert.equal(after.progress,before.progress+1);
  purchases.push({kind,key,before,action,after});
}
function settle(label){
  const seen=offers();screens.push({label,offers:seen});
  // Use offered goods before the always-available bone trade; each successful action grants one XP.
  for(const o of seen.hide)for(let i=0;i<o.count;i++){
    if(state().progress>=state().need)break;
    const now=r(`({cost:beastHideTradeCost(${o.id}),gain:beastHideTradeReward(${o.id}),get:CFG.beastExchange.hideTrades[${o.id}].get,count:S.beastExchange.hideOffers[${o.id}].count})`);
    if(now.count<1||state().hide<now.cost||!r(`S.res.${now.get}+${now.gain}<=resCap('${now.get}')`))break;
    purchaseOne('hide',o.id,`exchangeHideForResource(${o.id},1)`);
  }
  for(const o of seen.wild)for(let i=0;i<o.count;i++){
    if(state().progress>=state().need)break;
    if(r(`S.items.${o.key}`)<r(`beastScrollTradeCost('${o.key}')`)||r('S.items.storageScroll')>=r('CFG.eraMaterials.storageScroll.max'))break;
    purchaseOne('wild',o.key,`exchangeWildMaterialForScrolls('${o.key}',1)`);
  }
  for(let i=0;i<seen.heart;i++){
    if(state().progress>=state().need)break;
    if(r('S.items.boarHeart')<r('beastHeartTradeCost()')||r('S.items.storageScroll')>=r('CFG.eraMaterials.storageScroll.max'))break;
    purchaseOne('heart','boarHeart','exchangeHeartsForScrolls(1)');
  }
  for(const o of seen.soul)for(let i=0;i<o.count;i++){
    if(state().progress>=state().need)break;
    if(r(`S.items.${o.key}`)<o.cost||!r(`S.items.soulStone+${o.gain}<=CFG.eraMaterials.soulStone.max`))break;
    purchaseOne('soul',o.key,`exchangeSoulElixirForStones('${o.key}',1)`);
  }
  for(let i=0;i<seen.medal;i++){
    if(state().progress>=state().need)break;
    const cost=r('CFG.beastExchange.medalOfferTrade.boneCost'),gain=r('CFG.beastExchange.medalOfferTrade.medalGain');
    if(state().bone<cost||!r(`S.res.medal+${gain}<=resCap('medal')`))break;
    purchaseOne('medal','offered','exchangeOfferedBonesForMedals(1)');
  }
}
settle('existing');
for(let i=0;i<5;i++){
  const refresh=r('refreshBeastExchange()');assert.equal(refresh?.ok,true);
  settle('manual-'+(i+1));
}
const beforeBones=state();
const boneTrades=Math.min(Math.floor(beforeBones.bone/r('beastBoneTradeCost()')),beforeBones.need-beforeBones.progress);
assert.ok(boneTrades>0);
const boneAction=r(`exchangeBonesForMedals(${boneTrades})`);assert.equal(boneAction?.ok,true);
const final=state();assert.equal(final.progress,beforeBones.progress+boneTrades);
assert.equal(final.tick,opening.tick,'market actions do not advance online time');
assert.equal(final.level,31);
assert.equal(r('save().ok'),true);
const save=e.store.get('rts_save'),reload=environment({rts_save:save});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
for(const key of ['bone','hide','medal'])assert.equal(reload.run(`S.res.${key}`),final[key]);
assert.equal(reload.run('S.beastExchange.progress'),final.progress);
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const saveFile=data+'p343-wild-market-save.json',reportFile=data+'p343-wild-market.json';
fs.writeFileSync(path.join(root,saveFile),save,'utf8');
const report={batch:'P343',kind:'same-stream offered market settlement after 30 paid wild attempts',sourceFile,sourceSha256:sha(raw),rngStart:prior.final.rng,
  opening,screens,purchases,boneTrades,boneAction,final,saveFile,saveSha256:sha(save),
  limits:['Only five stored manual refresh charges are spent; no new online time or extra battle is introduced.',
    'Policy buys affordable offered goods first, then the always-available bone trade. Other player purchase policies may differ.',
    'The input is one selected historical checkpoint, not a population or proof of level-60 reachability.']};
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({opening,screens:screens.map(s=>({label:s.label,hide:s.offers.hide.length,wild:s.offers.wild.length,heart:s.offers.heart,soul:s.offers.soul.length,medal:s.offers.medal})),purchases:purchases.map(p=>({kind:p.kind,key:p.key,action:p.action})),boneTrades,boneAction,final,missingToNextLevel:final.need-final.progress,reportFile,saveFile,saveSha256:report.saveSha256},null,2));
