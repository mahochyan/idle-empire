'use strict';
// 从真实第45关材料档逐笔扩知识仓，不预置研究、材料、建筑或库存。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {environment}=require('../../tests/progression/harness');
const saveArg=process.argv.find(arg=>arg.startsWith('--save='));
const finalArg=process.argv.find(arg=>arg.startsWith('--snapshot-final='));
const maxBuildArg=process.argv.find(arg=>arg.startsWith('--max-builds='));
const maxBuilds=maxBuildArg?Number(maxBuildArg.slice('--max-builds='.length)):1000;
const knowledgeBuildingArg=process.argv.find(arg=>arg.startsWith('--knowledge-building='));
const knowledgeBuilding=knowledgeBuildingArg?knowledgeBuildingArg.slice('--knowledge-building='.length):'library';
assert.ok(saveArg,'须提供 --save=真实实战存档');
assert.ok(Number.isSafeInteger(maxBuilds)&&maxBuilds>=0&&maxBuilds<=2000);
assert.ok(['library','institute'].includes(knowledgeBuilding),'知识仓建筑须为图书馆或研究院');
const env=environment({rts_save:fs.readFileSync(saveArg.slice('--save='.length),'utf8')});
const run=env.run;
assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')),'旧档加载失败');
assert.equal(run('S.defeated.length'),45);
const start=run("({second:S.tick,cap:resCap('tech'),tech:S.res.tech,medal:S.res.medal,crystal:S.items.godCrystal,stone:S.items.guardianStone,steam:S.eraStorage.steamKnowledge,electric:S.eraStorage.electricKnowledge,library:bldSt('library').lv,institute:bldSt('institute').lv,mastery:S.storageMasteryLv})");
const payments=[],blocks=[];
let builds=0,stoneStoreBuilds=0,buildSeconds=0,studySeconds=0,woodPaid=0,stonePaid=0;
function assign(jobs){
  for(const [key,count] of Object.entries(run('({...S.popAlloc})')))if(count>0)
    assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,`清退${key}失败`);
  for(const [key,count] of Object.entries(jobs))if(count>0)
    assert.equal(run(`setPopAlloc('${key}',${count})`)?.ok,true,`分配${key}失败`);
}
function waitFor(condition,max=100000){
  const result=run(`(()=>{let n=0;while(!(${condition})&&n<${max}){tick();n++}return {n,reached:!!(${condition})}})()`);
  assert.equal(result.reached,true,`${condition} 在${max}在线秒内未达`);
  return result.n;
}
function buildStoneStoreFor(need){
  while(run("resCap('stone')")<need){
    const lock=run("upgradeLockReason('stone_store')");
    if(lock)return {reason:'stone-store-locked',detail:lock,need,cap:run("resCap('stone')")};
    const cost=run("upCost('stone_store')"),before=run("bldSt('stone_store').lv");
    if(run("resCap('stone')")<cost.stone)
      return {reason:'stone-store-self-capacity',need:cost.stone,cap:run("resCap('stone')")};
    assign({food:20,wood:40,stone:42});
    buildSeconds+=waitFor(`S.res.stone>=${cost.stone}`);
    const stock=run('S.res.stone'),result=run("buildAct('stone_store')");
    assert.equal(result?.ok,true,`石仓Lv${before+1}建造失败：${JSON.stringify(result)}`);
    assert.ok(Math.abs(stock-run('S.res.stone')-cost.stone)<1e-6,'石仓石料实扣不符');
    stonePaid+=cost.stone;
    buildSeconds+=waitFor(`bldSt('stone_store').lv===${before+1}&&bldSt('stone_store').state==='idle'`,300);
    stoneStoreBuilds++;
  }
  return null;
}
function buildKnowledgeStoreFor(costTech){
  while(run("resCap('tech')")<costTech){
    if(builds>=maxBuilds)return {reason:'probe-build-limit',target:costTech,cap:run("resCap('tech')")};
    const lock=run(`upgradeLockReason('${knowledgeBuilding}')`);
    if(lock)return {reason:'knowledge-store-locked',building:knowledgeBuilding,detail:lock,target:costTech,cap:run("resCap('tech')")};
    const cost=run(`upCost('${knowledgeBuilding}')`),before=run(`bldSt('${knowledgeBuilding}').lv`);
    const storeBlock=buildStoneStoreFor(cost.stone);
    if(storeBlock)return {target:costTech,building:knowledgeBuilding,level:before,...storeBlock};
    for(const key of ['wood','stone'])if(run(`resCap('${key}')`)<cost[key])
      return {reason:key+'-capacity',target:costTech,need:cost[key],cap:run(`resCap('${key}')`),building:knowledgeBuilding,level:before};
    assign({food:20,wood:40,stone:42});
    buildSeconds+=waitFor(`S.res.wood>=${cost.wood}&&S.res.stone>=${cost.stone}`);
    const old=run('({wood:S.res.wood,stone:S.res.stone})');
    const result=run(`buildAct('${knowledgeBuilding}')`);
    assert.equal(result?.ok,true,`${knowledgeBuilding} Lv${before+1}建造失败：${JSON.stringify(result)}`);
    assert.ok(Math.abs(old.wood-run('S.res.wood')-cost.wood)<1e-6,'知识仓木材实扣不符');
    assert.ok(Math.abs(old.stone-run('S.res.stone')-cost.stone)<1e-6,'知识仓石料实扣不符');
    woodPaid+=cost.wood;stonePaid+=cost.stone;
    buildSeconds+=waitFor(`bldSt('${knowledgeBuilding}').lv===${before+1}&&bldSt('${knowledgeBuilding}').state==='idle'`,300);
    builds++;
  }
  return null;
}
function payUntilBlocked(key){
  const cfg=run(`CFG.eraStorage.${key}`),material=cfg.lateMaterial||'godCrystal';
  while(run(`S.eraStorage.${key}`)<cfg.maxLevel){
    const level=run(`S.eraStorage.${key}`)+1,cost=run(`eraStorageCost('${key}')`);
    if(cost[material]&&run(`S.items.${material}`)<cost[material]){
      blocks.push({key,level,reason:'material',cost,stock:run(`S.items.${material}`)});break;
    }
    const capBlock=buildKnowledgeStoreFor(cost.tech);
    if(capBlock){blocks.push({key,level,...capBlock});break;}
    assign({food:20,tech:82});
    studySeconds+=waitFor(`S.res.tech>=${cost.tech}`,100000);
    const before=run(`({second:S.tick,tech:S.res.tech,material:S.items.${material},cap:resCap('tech'),library:bldSt('library').lv})`);
    const result=run(`upgradeEraStorage('${key}')`);
    assert.equal(result?.ok,true,`${key} Lv${level}付款失败：${JSON.stringify(result)}`);
    assert.ok(Math.abs(before.tech-run('S.res.tech')-cost.tech)<1e-5,'知识实扣不符');
    assert.equal(before.material-run(`S.items.${material}`),cost[material]||0,'材料实扣不符');
    payments.push({key,level,cost,before,capAfter:run("resCap('tech')")});
  }
}
payUntilBlocked('steamKnowledge');
payUntilBlocked('electricKnowledge');
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,29);
assert.equal(saved.defeated.length,45);
const restored=environment({rts_save:JSON.stringify(saved)});
assert.equal(restored.run('loadSaveAndApply().status'),'ok');
for(const key of ['steamKnowledge','electricKnowledge'])
  assert.equal(restored.run(`S.eraStorage.${key}`),saved.eraStorage[key]);
for(const key of ['godCrystal','guardianStone'])
  assert.equal(restored.run(`S.items.${key}`),saved.items[key]);
if(finalArg)fs.writeFileSync(finalArg.slice('--snapshot-final='.length),JSON.stringify(saved),'utf8');
console.log(JSON.stringify({unit:'online seconds; resource units',knowledgeBuilding,start,finish:{second:saved.tick,cap:run("resCap('tech')"),tech:saved.res.tech,medal:saved.res.medal,crystal:saved.items.godCrystal,stone:saved.items.guardianStone,steam:saved.eraStorage.steamKnowledge,electric:saved.eraStorage.electricKnowledge,library:saved.buildings.library.lv,stoneStore:saved.buildings.stone_store.lv,institute:saved.buildings.institute.lv},builds,stoneStoreBuilds,buildSeconds,studySeconds,woodPaid,stonePaid,payments,blocks},null,2));
