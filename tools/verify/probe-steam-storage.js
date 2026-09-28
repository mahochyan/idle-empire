'use strict';
// 续接零胜利蒸汽路线，逐秒真实动作支付首级蒸汽科研技术，不注入资源或人口。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const prior=fs.readFileSync(path.join(__dirname,'probe-steam-era.js'),'utf8');
const {run,action,assign,waitFor,point,points,upgradeTo,actions,extraActions}=new Function(
  'require','console','__dirname',prior+'\nreturn {run,action,assign,waitFor,point,points,upgradeTo,actions,extraActions};'
)(require,{log(){}},__dirname);
assert.equal(run('S.eraStorage.steamKnowledge'),0);
assert.equal(run('S.defeated.length'),0);
const allFirst=process.argv.includes('--all-first');
const growthTarget=allFirst||process.argv.includes('--grow-pop=102')?102:(process.argv.includes('--grow-pop')?62:26);
const growPopulation=growthTarget>26;
if(growPopulation){
  while(run('maxPop()')<growthTarget){
    const cost=run("settlementCost('city')");
    while(run('S.res.deed')<cost){
      const missing=cost-run('S.res.deed');
      const chunk=Math.min(missing,Math.floor(run("resCap('silverCoin')")/200));
      const n=Math.floor((run('S.population.current')-3)/4);
      assign({stone:n,food:3,coal:n,silver:n,silverCoin:n});
      waitFor(`S.res.silverCoin>=${chunk*200}`,12000);
      action(`exchangeResource('silverCoin','deed',${chunk*200})`,'market','银两换城市地契');
    }
    action("upgradeSettlement('city',S.settlements.city)",'settlement','扩建城市');
    waitFor('popCurrent()===maxPop()',100);
  }
  assert.equal(run('S.population.current'),growthTarget);
  point('population-expanded');
}
const jobsGold=growthTarget===102?{food:10,stone:30,coal:30,gold:30}:(growPopulation?{food:6,stone:18,coal:18,gold:18}:{food:2,stone:8,coal:10,gold:6});
const jobsSteel=growthTarget===102?{food:10,stone:33,coal:26,iron:20,steel:12}:(growPopulation?{food:6,stone:20,coal:16,iron:12,steel:8}:{food:2,stone:8,coal:7,iron:5,steel:4});
const jobsBasic=growthTarget===102?{wood:32,stone:32,food:10,tech:28}:(growPopulation?{wood:20,stone:20,food:6,tech:16}:{wood:8,stone:8,food:4,tech:6});
const jobsTech=growthTarget===102?{food:20,tech:82}:(growPopulation?{food:12,tech:50}:{food:6,tech:20});
assign(jobsGold);
upgradeTo('gold_store',50);
point('gold-cap-for-mastery');
for(let level=6;level<=10;level++){
  const cost=run('storageMasteryCost()');
  assign(jobsTech);
  waitFor(`S.res.tech>=${cost.tech}`,30000);
  assign(jobsGold);
  waitFor(`S.res.gold>=${cost.gold}`,100000);
  assign(jobsSteel);
  waitFor(`S.res.steel>=${cost.steel}`,100000);
  action('upgradeStorageMastery()','research',`储存精通 ${level}`);
}
assert.equal(run('S.storageMasteryLv'),10);
point('mastery-ten');
assign(jobsBasic);
upgradeTo('stone_store',100);
upgradeTo('large_granary',26);
upgradeTo('academy',50);
upgradeTo('institute',120);
assert.ok(run("resCap('tech')")>=300000);
point('steam-knowledge-cap-ready');
assign(jobsTech);
waitFor('S.res.tech>=300000',30000);
const paid=run('S.res.tech');
action("upgradeEraStorage('steamKnowledge')",'research','蒸汽科研技术 Lv1');
assert.equal(run('S.res.tech'),paid-300000);
assert.equal(run('S.eraStorage.steamKnowledge'),1);
assert.equal(run('S.defeated.length'),0);
point('steam-knowledge-one');
if(allFirst){
  assign(jobsGold);
  upgradeTo('gold_store',70);
  for(let level=11;level<=15;level++){
    const cost=run('storageMasteryCost()');
    assign(jobsTech);waitFor(`S.res.tech>=${cost.tech}`,30000);
    assign(jobsGold);waitFor(`S.res.gold>=${cost.gold}`,100000);
    assign(jobsSteel);waitFor(`S.res.steel>=${cost.steel}`,100000);
    action('upgradeStorageMastery()','research',`储存精通 ${level}`);
  }
  assign(jobsBasic);
  upgradeTo('institute',197);
  assert.ok(run("resCap('tech')")>=500000);
  point('all-steam-cap-ready');
  assign(jobsTech);
  waitFor('S.res.tech>=500000',30000);
  action("upgradeEraStorage('steamMetal')",'research','蒸汽金属仓库 Lv1');
  waitFor('S.res.tech>=500000',30000);
  action("upgradeEraStorage('steamBasic')",'research','蒸汽基础仓库 Lv1');
  assert.equal(run('S.eraStorage.steamMetal'),1);
  assert.equal(run('S.eraStorage.steamBasic'),1);
  point('all-steam-one');
}
console.log(JSON.stringify({unit:'online seconds',onlineSeconds:run('S.tick'),population:run('S.population.current'),wins:run('S.defeated.length'),
  techCap:run("resCap('tech')"),steelCap:run("resCap('steel')"),storageMasteryLv:run('S.storageMasteryLv'),
  steamKnowledgeLv:run('S.eraStorage.steamKnowledge'),steamMetalLv:run('S.eraStorage.steamMetal'),steamBasicLv:run('S.eraStorage.steamBasic'),
  buildings:Object.fromEntries(['stone_store','gold_store','academy','institute'].map(k=>[k,run(`bldSt('${k}').lv`)])),
  actions:{...actions,...extraActions},milestones:points.filter(p=>['population-expanded','gold-cap-for-mastery','mastery-ten','steam-knowledge-cap-ready','steam-knowledge-one','all-steam-cap-ready','all-steam-one'].includes(p.label)).map(p=>({label:p.label,second:p.onlineSeconds,population:p.population,techCap:p.caps.tech,food:p.resources.food}))},null,2));
