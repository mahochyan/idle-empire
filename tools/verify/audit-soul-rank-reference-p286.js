'use strict';
// Extract the source-backed soul-rank chain; do not run the reference client or alter game saves.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const tablePath=path.join(root,'210(1)_unpacked/_analysis/entities_table.json');
const sourcePath=path.join(root,'210(1)_unpacked/_analysis/deob_main.js');
const tableRaw=fs.readFileSync(tablePath,'utf8'),sourceRaw=fs.readFileSync(sourcePath,'utf8');
const table=JSON.parse(tableRaw),e=table.ents;
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const extract=(id,kind)=>{
  const ent=e[String(id)];assert.ok(ent?.__lists?.includes(kind),`${id} ${kind}`);
  return Object.fromEntries(Object.entries(ent).filter(([key])=>key.startsWith(kind+':')).map(([key,value])=>[key.slice(kind.length+1),value]));
};
const science=[450122,450222,450322].map(id=>({id,...extract(id,'developScience')}));
assert.deepEqual(science.map(s=>s.LimitID),[450022,450122,450222]);
assert.deepEqual(science.map(s=>s.Need),[[[160003,8000000],[160010,100000]],
  [[160003,10000000],[160010,200000]],[[160003,20000000],[160010,300000]]]);
const item=extract(170091,'itemStuff'),outer=extract(570000,'bigWar');
assert.equal(item.MonsterKillID,580056);
assert.equal(item.Max,500000);
assert.equal(outer.LimitID,450222);
const bosses=[540199,540299,540399,540499,540599,540699].map(id=>({id,...extract(id,'godWar')}));
assert.deepEqual(bosses.map(b=>b.KillValueID),Array(6).fill(580062));
assert.deepEqual(bosses.map(b=>b.Get.find(([id])=>id===170091)?.[1]),[1,2,3,5,7,15]);
const exchanges=[290098,290099].map(id=>({id,...extract(id,'exchangeShop')}));
assert.deepEqual(exchanges.map(x=>x.Get),[[170091,4],[170091,12]]);
const snippets={
  rank:sourceRaw.indexOf('"armyLvUP"',1610000),
  rankAttack:sourceRaw.indexOf('0.5*_0x1ddfef',1288000),
  rankHp:sourceRaw.indexOf('0.1*_0x3db73a',1290000),
  team:sourceRaw.indexOf('getGeneralTeam',1390000),
  reward:sourceRaw.indexOf('"winGeneralBattle"',1550000),
  gate:sourceRaw.indexOf('0x6df12]&&_0x3a9830',2100000)
};
for(const [key,offset]of Object.entries(snippets))assert.ok(offset>0,`${key} source offset`);
const rankSource=sourceRaw.slice(snippets.rank,snippets.rank+1450);
assert.ok(rankSource.includes('0x64*(0x1+')&&rankSource.includes('0xa')&&rankSource.includes('0x5'));
assert.ok(rankSource.includes('adjustArmyATK')&&rankSource.includes('adjustArmyHP'));
const rewardSource=sourceRaw.slice(snippets.reward,snippets.reward+1550);
assert.ok(rewardSource.includes('0.3*Math["floor"]')&&rewardSource.includes('0x2986b'));
const teamSource=sourceRaw.slice(snippets.team,snippets.team+1300);
assert.ok(teamSource.includes('NeedKillValue')&&teamSource.includes('MonsterTeam')&&teamSource.includes('Rate'));
const rankCosts=Array.from({length:5},(_,rank)=>({toRank:rank+1,starSteps:10,
  starCostEach:100*(rank+1),promotionCost:1000*(rank+1),totalToNextRank:2000*(rank+1),
  cumulative:1000*(rank+1)*(rank+2)}));
const report={batch:'P286',kind:'source-code/entity extraction and arithmetic; no client execution',
  sources:{entities:'210(1)_unpacked/_analysis/entities_table.json',entitiesSha256:sha(tableRaw),
    code:'210(1)_unpacked/_analysis/deob_main.js',codeSha256:sha(sourceRaw),offsets:snippets},
  science,item,outer,bosses,exchanges,rankCosts,
  conflict:{itemMonsterKillID:item.MonsterKillID,itemMonsterName:table.names[String(item.MonsterKillID)],
    actualBossKillValueID:bosses[0].KillValueID,actualBossKillValueName:table.names[String(bosses[0].KillValueID)]},
  formulas:{rankAttack:'floor(0.5 * rank * source initial attack)',
    rankHp:'floor(rank * source initial HP) + floor(0.1 * stars * source initial HP)',
    soulReward:'floor(base soul drop * (1 + 0.3 * floor(pre-win GeneralBattle.KillValue / 1000)) * (1 + battle-reward power-position percent / 100))',
    bossPool:'nine picks, weighted Rate among NeedKillValue-eligible 540199–540699 entries'}};
const output='docs/codex/reports/data/p286-soul-rank-source-audit.json';
fs.writeFileSync(path.join(root,output),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({sources:report.sources,science:science.map(s=>({id:s.id,name:s.Name,need:s.Need,limit:s.LimitID})),
  conflict:report.conflict,rankCosts,bosses:bosses.map(b=>({id:b.id,name:b.Name,stone:b.Get.find(([id])=>id===170091)?.[1],
    killValue:b.KillValueID,range:b.NeedKillValue})),output},null,2));
