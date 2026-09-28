'use strict';
// 勋章曲线的条件诊断：奖励使用真实配置函数，战斗使用真实战斗循环。
// 预置警戒值和三排55人只用于定位门槛；不是从新档自然可达证明。时间单位为在线秒。
const assert=require('node:assert/strict');
const {environment}=require('../../tests/progression/harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json');
assert.deepEqual(source.ents[540001]['godWar:Get'],[[160010,40],[170011,1]]);
assert.deepEqual(source.ents[380023]['market:Need'],[160005,200]);
assert.deepEqual(source.ents[380023]['market:Get'],[160010,10]);

const rewards=environment();
const milestones=[];
let total=0,firstEnough=null;
for(let win=1;win<=500;win++){
  const kill=(win-1)*100;
  const encounter=rewards.run(`materialDomainEncounter('medal',${kill})`);
  const gain=encounter.reward.medal;
  total+=gain;
  if([1,2,5,10,15,16,20,30,40,50,80,100,130,150,200,300,500].includes(win))
    milestones.push({win,killBefore:kill,gain,cumulative:total,enemyCount:encounter.units.slaughter_god[0],
      attackMultiplier:encounter.bossMult.atk});
  if(total>=800000){firstEnough={win,killBefore:kill,gain,cumulative:total,
    enemyCount:encounter.units.slaughter_god[0],attackMultiplier:encounter.bossMult.atk};break}
}
assert.ok(firstEnough,'500次奖励仍达不到80万，需增加评估范围');

function fight(kill,front='alloy_special',mid='armored_trooper',back='archer',count=55,formation=null,guns={}){
  const e=environment();
  const selected=formation||{front:[{type:front,count,id:101}],
    mid:[{type:mid,count,id:102}],back:[{type:back,count,id:103}]};
  e.run(`
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const entry=__timers.entries().next().value;if(!entry)return false;__timers.delete(entry[0]);entry[1].fn();return true};
    globalThis.__nodes=new Map();
    document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id);
    };
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;
    S.sciences=['sci_alloy_age','sci_steam_age','sci_electric_age'];
    S.buildings.barracks={lv:10,state:'idle'};
    S.formation=${JSON.stringify(selected)};
    S.killValues.godSlaughter=${kill};
    for(const [key,level] of Object.entries(${JSON.stringify(guns)}))
      S.weaponForge[key]={researched:true,level,progress:0,equipped:true};
    openMaterialDomain('medal');
  `);
  assert.equal(e.run('S.battleActive'),true,'挑战未开始');
  const encounter=e.run('({enemy:B.enemyCfg.units.slaughter_god[0],atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,reward:B.enemyCfg.reward.medal})');
  let steps=0;
  while(e.run('S.battleActive')&&steps<500){assert.equal(e.run('__step()'),true,'战斗回调丢失');steps++}
  assert.equal(e.run('S.battleActive'),false,'战斗未在500步内结算');
  const survivors=e.run("['front','mid','back'].map(row=>S.formation[row].reduce((n,u)=>n+u.count,0))");
  return {kill,front,mid,back,count,guns,...encounter,win:e.run('S.res.medal')>0,
    received:e.run('S.res.medal'),steps,round:e.run('B.round'),survivors};
}

const battles=[];
for(const kill of [0,100,200,300,400,500,600,700,800,900,1000,1200,1500,2000,3000,5000,8000,13000])
  battles.push(fight(kill));
const firstObservedLoss=battles.find(row=>!row.win)?.kill??null;
const electro=[];
for(const kill of [firstObservedLoss,firstEnough.killBefore].filter((v,i,a)=>v!==null&&a.indexOf(v)===i))
  electro.push(fight(kill,'electro_trooper','armored_trooper','archer'));
const rosterComparisons=[];
for(const kill of [1500,5000,firstEnough.killBefore]){
  const sample=[];
  for(const front of ['alloy_special','electro_trooper'])
    for(const mid of ['armored_trooper','cavalry_dragon','cavalry_teutonic'])
      for(const back of ['archer','archer_genoese','archer_longbow','mage_merlin'])
        sample.push(fight(kill,front,mid,back));
  rosterComparisons.push({kill,conditionalRosters:sample.length,wins:sample.filter(row=>row.win).length,
    winningRosters:sample.filter(row=>row.win).map(({front,mid,back,survivors,round})=>({front,mid,back,survivors,round}))});
}
const fullFormation={
  front:['alloy_special','electro_trooper','gold_cavalry','silver_heavy'].map((type,i)=>({type,count:55,id:100+i})),
  mid:['armored_trooper','iron_spearman','bronze_guard','infantry_fortress'].map((type,i)=>({type,count:55,id:200+i})),
  back:['archer','mage_merlin','mage_chrono','archer_genoese'].map((type,i)=>({type,count:type==='mage_chrono'?50:55,id:300+i}))
};
const fullRoster=[0,1500,3000,3500,4000,4500,4900,5000,8000,13000,firstEnough.killBefore].map(kill=>
  fight(kill,'twelve slots','twelve slots','twelve slots',55,fullFormation));
const gunComparisons=[
  fight(1500),fight(1500,'alloy_special','armored_trooper','archer',55,null,{armored:1}),
  fight(1500,'alloy_special','armored_trooper','archer',55,null,{armored:3}),
  fight(4000,'twelve slots','twelve slots','twelve slots',55,fullFormation,{armored:1,electro:1}),
  fight(4000,'twelve slots','twelve slots','twelve slots',55,fullFormation,{armored:3,electro:3})
];
const silverCap=rewards.run("resCap('silverCoin')"),marketRate=rewards.run("CFG.market.rates.find(x=>x.from==='silverCoin'&&x.to==='medal').rate"),dailyLimit=rewards.run('marketDailyLimit()');
const economicRoute={silverCoinPerMedal:1/marketRate,requiredSilverCoin:Math.ceil(800000/marketRate),
  normalSilverCoinCap:silverCap,medalPerFullStock:Math.floor(silverCap*marketRate),dailyLimit,
  maxMedalPerDayAtFullStock:Math.floor(silverCap*marketRate)*dailyLimit,
  minimumCalendarDaysIfOnlyMarket:Math.ceil(800000/(Math.floor(silverCap*marketRate)*dailyLimit))};
console.log(JSON.stringify({unit:'reward units per win; kill points; army count; battle steps',
  assumption:'normal quality; killValue advances +100 per victory; rank 55 in each of 3 rows; random 0.5; preseeded army and kill value for conditional fights',
  firstEnough,milestones,battles,electro,rosterComparisons,fullRoster,gunComparisons,economicRoute},null,2));
