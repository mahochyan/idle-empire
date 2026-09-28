'use strict';
// 核能门的条件容量账本；这里设定合法等级上限，不是新档自然可达回放。
const assert=require('node:assert/strict');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const source=require(path.join(__dirname,'../../210(1)_unpacked/_analysis/entities_table.json'));
const e=environment();
const nuclear=source.ents[450023],medal=source.ents[160010];
assert.deepEqual(nuclear['developScience:Need'],[[160003,100000000],[160010,800000]]);
assert.equal(nuclear['developScience:LimitID'],450022);
assert.equal(medal['resource2:Max'],100000000000);
assert.equal(e.run("'sci_nuclear_age' in activeSciences()"),false);
assert.equal(e.run("'medal' in CFG.res"),true);
assert.equal(e.run('CFG.tech.sciencesNoMerit'),true);

const medalSources=[540001,540011,540021,570004,290015,380023].map(id=>{
  const obj=source.ents[id],kind=obj.__lists[0];
  return {id,kind,name:obj[`${kind}:Name`]||source.names[id],
    medalGet:(obj[`${kind}:Get`]||[]).find(row=>Array.isArray(row)&&row[0]===160010)?.[1]||0,
    directExchange:obj[`${kind}:Get`]?.[0]===160010?obj[`${kind}:Get`][1]:0};
});

// 先把已有建筑和公共仓储研究设为合法上限，隔离出蒸汽/电力科研科技的必要投入下界。
e.run("S.buildings.academy={lv:50,state:'idle'};S.buildings.library={lv:1000,state:'idle'};S.buildings.institute={lv:1000,state:'idle'};S.storageMasteryLv=100");
const capAt=(steam,electric)=>{
  e.run(`S.eraStorage.steamKnowledge=${steam};S.eraStorage.electricKnowledge=${electric}`);
  return e.run("resCap('tech')");
};
const currentResearchCapWithMaxBuildings=capAt(6,6);
assert.equal(currentResearchCapWithMaxBuildings,19796480);
e.run("S.population.current=102;S.popAlloc.tech=102;S.eraStorage.electricProduction=6");
const allScholarRate=e.run("prodRate('tech')");
assert.equal(allScholarRate,979.2);
const target=100000000;
const upgradeLedger=key=>{
  const amounts=Array.from({length:101},()=>null);
  amounts[6]={tech:0,godCrystal:0,guardianStone:0};
  for(let next=7;next<=100;next++){
    e.run(`S.eraStorage.${key}=${next-1}`);
    const cost=e.run(`eraStorageCost('${key}')`),prev=amounts[next-1];
    amounts[next]={tech:prev.tech+cost.tech,godCrystal:prev.godCrystal+(cost.godCrystal||0),
      guardianStone:prev.guardianStone+(cost.guardianStone||0)};
  }
  return amounts;
};
const steamCosts=upgradeLedger('steamKnowledge'),electricCosts=upgradeLedger('electricKnowledge');
let cheapest=null;
for(let steam=6;steam<=100;steam++)for(let electric=6;electric<=100;electric++){
  const cap=capAt(steam,electric);
  if(cap<target)continue;
  const extraKnowledge=steamCosts[steam].tech+electricCosts[electric].tech;
  if(!cheapest||extraKnowledge<cheapest.extraKnowledge)
    cheapest={steamKnowledge:steam,electricKnowledge:electric,capacity:cap,extraKnowledge,
      extraCrystal:steamCosts[steam].godCrystal,extraStone:electricCosts[electric].guardianStone};
}
assert.ok(cheapest);
console.log(JSON.stringify({source:'workspace unpacked reference and current resCap',
  reference:{nuclearTech:target,nuclearMedal:800000,medalBaseMax:medal['resource2:Max'],medalSources},
  current:{hasNuclearResearch:false,hasSeparateMedal:true,meritNotEquivalent:true,
    conditionalKnowledgeCapAtMaxBuildingsAndLevelSix:currentResearchCapWithMaxBuildings,
    cheapestAdditionalScienceTechAtMaxBuildings:cheapest,
    all102VillagersAsScholarsAtProductionSixPerSecond:allScholarRate,
    hoursForUpgradeKnowledgeAndNuclearFeeAtThatFixedRate:(cheapest.extraKnowledge+target)/allScholarRate/3600,
    caveat:'建筑满级、公共储存精通100级均是条件预置；全102人学者忽略粮食和其它岗位，且固定生产科技6级。未计建筑、战斗、原料和逐笔付款，不能作为自然可达或典型耗时证据。'},
  unit:'game resource units; rate per online second; fixed-rate hours are conditional'},null,2));
