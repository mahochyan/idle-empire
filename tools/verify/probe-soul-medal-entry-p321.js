'use strict';
// P321: inspect current medal routes from the immutable P319 paid save; no player save is touched.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p319-armored18-crystal-alert5200-recovered-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'983b8afdbc24c8c9143f58024139c51663ef870b7ed8c516811a7c6059c3fde4');
function setup(){
  const e=environment({rts_save:raw}),load=e.run('loadSaveAndApply().status');
  assert.ok(['ok','migrated'].includes(load),load);
  e.run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
  return e;
}
function fight(key){
  const e=setup(),r=e.run,before=r('({bone:S.res.bone,medal:S.res.medal,army:formSoldierCount(),alert:{...S.killValues},form:JSON.parse(JSON.stringify(S.formation))})');
  r(`openMaterialDomain('${key}')`);
  assert.equal(r('S.battleActive'),true,`${key} failed to open`);
  let steps=0;while(r('S.battleActive')&&steps++<2000)assert.equal(r('__step()'),true,`${key} callback missing`);
  assert.ok(steps<2000,`${key} battle timeout`);
  const after=r('({bone:S.res.bone,medal:S.res.medal,army:formSoldierCount(),alert:{...S.killValues},form:JSON.parse(JSON.stringify(S.formation)),round:B.round,result:document.getElementById("battle-result").className,enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)})');
  const domain=r(`specialEncounterConfig('${key}')`),killKey=domain.killValueKey;
  const byType=form=>Object.values(form).flat().reduce((all,u)=>(all[u.type]=(all[u.type]||0)+u.count,all),{});
  const original=byType(before.form),remaining=byType(after.form);
  const lossByType=Object.fromEntries(Object.entries(original).map(([unit,n])=>[unit,n-(remaining[unit]||0)]).filter(([,n])=>n>0));
  return{key,result:after.result,round:after.round,enemyHp:after.enemyHp,loss:before.army-after.army,
    lossByType,boneGain:after.bone-before.bone,medalGain:after.medal-before.medal,alertBefore:before.alert[killKey]??null,
    alertAfter:after.alert[killKey]??null};
}
const keys=['bone','bullHorn','snakeGall','tigerPelt','turtleShell','wyrmSinew','outerVillage','outerTown','outerCity','outerCapital'];
const results=keys.map(fight);
const e=setup(),r=e.run,initial=r('({tech:S.res.tech,techCap:resCap("tech"),medal:S.res.medal,bone:S.res.bone,food:S.res.food})');
const trades=Math.floor(initial.bone/r('beastBoneTradeCost()'));
const exchanged=r(`exchangeBonesForMedals(${trades})`);
assert.equal(exchanged.ok,true);
const afterExchange=r('({tech:S.res.tech,medal:S.res.medal,bone:S.res.bone,tradeLevel:S.beastExchange.level})');
const paid=setup(),p=paid.run,origin=JSON.parse(raw);
p(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {
  constructor(...args){super(...(args.length?args:[${origin.ts}+(S.tick-${origin.tick})*1000]))}
  static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}
}`);
const opening=p('({tick:S.tick,tech:S.res.tech,medal:S.res.medal,bone:S.res.bone,food:S.res.food,wood:S.res.wood,stone:S.res.stone,army:armyCount(),deployed:formSoldierCount(),goldWorkers:S.popAlloc.gold,techWorkers:S.popAlloc.tech})');
assert.deepEqual({tech:opening.tech,medal:opening.medal,bone:opening.bone},{tech:initial.tech,medal:initial.medal,bone:initial.bone});
const paidExchange=p(`exchangeBonesForMedals(${trades})`);assert.equal(paidExchange.ok,true);
const buildCost=p('({...buildingInitialCost("mage_tower")})');
assert.equal(p("buildAct('mage_tower').ok"),true);
assert.equal(p("setPopAlloc('gold',0).ok"),true);
assert.equal(p("setPopAlloc('tech',902).ok"),true);
const rates=p('({tech:prodRate("tech"),food:prodRate("food"),foodNet:prodRate("food")-totalUpkeep()-popCurrent()*CFG.popFoodCost})');
assert.ok(rates.tech>0&&rates.foodNet>0);
const researchWait=p('(()=>{let seconds=0,minFood=S.res.food;while(S.res.tech<8000000&&seconds<10000){tick();seconds++;minFood=Math.min(minFood,S.res.food)}return{seconds,minFood,tech:S.res.tech,food:S.res.food,mageTower:bldSt("mage_tower")}})()');
assert.ok(researchWait.seconds<10000&&researchWait.minFood>0);
assert.equal(researchWait.mageTower.lv,1);
const beforeResearch=p('({tech:S.res.tech,medal:S.res.medal,scienceCount:S.sciences.length})');
const researched=p("researchScience('sci_arcane_mage')");assert.equal(researched.ok,true);
const afterResearch=p('({tech:S.res.tech,medal:S.res.medal,scienceCount:S.sciences.length})');
assert.equal(beforeResearch.tech-afterResearch.tech,8000000);
assert.equal(beforeResearch.medal-afterResearch.medal,100000);
assert.equal(afterResearch.scienceCount,beforeResearch.scienceCount+1);
const trained=p("train('arcane_mage',1)");assert.equal(trained.ok,true);
const trainWait=p('(()=>{let seconds=0;while((S.pool.arcane_mage||0)<1&&seconds<20){tick();seconds++}return{seconds,ready:S.pool.arcane_mage||0,queue:S.queue.arcane_mage?.count||0}})()');
assert.equal(trainWait.ready,1);
const final=p('({tick:S.tick,tech:S.res.tech,medal:S.res.medal,bone:S.res.bone,food:S.res.food,wood:S.res.wood,stone:S.res.stone,army:armyCount(),deployed:formSoldierCount(),arcaneMage:S.pool.arcane_mage,cap:unitCap("arcane_mage"),goldWorkers:S.popAlloc.gold,techWorkers:S.popAlloc.tech,science:scienceUnlocked("sci_arcane_mage"),soulRanks:{...S.soulRanks},soulStone:S.items.soulStone})');
assert.equal(final.medal,opening.medal+paidExchange.medalGain-100000-100);
assert.equal(final.army,opening.army+1);
assert.equal(final.deployed,opening.deployed);
assert.equal(p('save().ok'),true);
const saveFile='docs/codex/reports/data/p321-arcane-mage-paid-save.json',finalRaw=paid.store.get('rts_save');
const reload=environment({rts_save:finalRaw});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.pool.arcane_mage'),1);
assert.equal(reload.run("scienceUnlocked('sci_arcane_mage')"),true);
assert.equal(reload.run('S.res.medal'),final.medal);
assert.equal(paid.store.get('rts_save_premigration'),raw);
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
fs.writeFileSync(path.join(root,saveFile),finalRaw,'utf8');
const report={batch:'P321',sourceFile,sourceSha256:sha(raw),unit:'simulated online seconds, resource units, soldiers',
  initial,firstRoutes:{trades,exchanged,afterExchange,results},paidArcane:{opening,paidExchange,buildCost,rates,researchWait,beforeResearch,researched,afterResearch,trained,trainWait,final},
  saveFile,saveSha256:sha(finalRaw)};
fs.writeFileSync(path.join(root,'docs/codex/reports/data/p321-arcane-mage-paid.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,initial,trades,exchanged,afterExchange,results,paidArcane:report.paidArcane,saveFile,saveSha256:report.saveSha256},null,2));
