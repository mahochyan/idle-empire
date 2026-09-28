'use strict';
// 从305人实付战前档，真实建弓兵营地/训练猎人，填四后排挑战守御4000。
// node tools/verify/probe-guardian-archers-p74.js [--snapshot-prebattle=路径] [--snapshot-first-win=路径]
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const source=path.resolve(__dirname,'../../docs/codex/reports/data/p74-guardian4000-roster-paid.json');
const preArg=process.argv.find(x=>x.startsWith('--snapshot-prebattle='));
const winArg=process.argv.find(x=>x.startsWith('--snapshot-first-win='));
const roundArg=process.argv.find(x=>x.startsWith('--conditional-round-limit='));
const roundLimit=roundArg?Number(roundArg.slice('--conditional-round-limit='.length)):null;
assert.ok(roundLimit===null||Number.isSafeInteger(roundLimit)&&roundLimit>=31&&roundLimit<=99);
assert.ok(roundLimit===null||!winArg,'条件回合不得写入实付胜利快照');
const e=environment({rts_save:fs.readFileSync(source,'utf8')});
const run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.defeated.length'),45);
assert.equal(run('armyCount()'),305);
assert.equal(run("bldSt('archer_range').lv"),5);
assert.equal(run("unitCap('archer')"),60);
assert.equal(run("rowSlots('back')"),4);
const start=run('S.tick');
let ticks=0,builds=0,trained=0;
const paid={wood:0,stone:0,food:0};
function wait(condition,max=100000){
  const r=run(`(()=>{let n=0;while(!(${condition})&&n<${max}){tick();n++}return{n,ok:!!(${condition})}})()`);
  ticks+=r.n;
  assert.equal(r.ok,true,`等待 ${condition} 超时: ${JSON.stringify(run("({tick:S.tick,res:S.res,queue:S.queue.archer,pool:S.pool.archer,cap:unitCap('archer'),army:armyCount()})"))}`);
}
function assign(target){
  const current=run('({...S.popAlloc})');
  for(const [rk,n] of Object.entries(current))if(n>0)assert.equal(run(`setPopAlloc('${rk}',0)`)?.ok,true,`撤${rk}失败`);
  for(const [rk,n] of Object.entries(target))if(n>0)assert.equal(run(`setPopAlloc('${rk}',${n})`)?.ok,true,`派${rk}失败`);
  assert.equal(run('popAllocTotal()'),126);
}
assign({food:55,wood:35,stone:36});
while(run("bldSt('archer_range').lv")<32){
  const level=run("bldSt('archer_range').lv"),cost=run("upCost('archer_range')");
  for(const rk of ['wood','stone','food'])assert.ok(run(`resCap('${rk}')`)>=cost[rk],`Lv${level+1} ${rk}单笔超仓`);
  wait(`S.res.wood>=${cost.wood}&&S.res.stone>=${cost.stone}&&S.res.food>=${cost.food+3000}`);
  const before=run('({...S.res})');
  const result=run("buildAct('archer_range')");
  assert.equal(result?.ok,true,`弓兵营地Lv${level+1}建造失败: ${JSON.stringify(result)}`);
  for(const rk of ['wood','stone','food']){
    assert.equal(Math.round(before[rk]-run(`S.res.${rk}`)),cost[rk],`Lv${level+1} ${rk}未实扣`);
    paid[rk]+=cost[rk];
  }
  builds++;
  wait(`bldSt('archer_range').lv===${level+1}&&bldSt('archer_range').state==='idle'`,150);
}
assert.equal(run("unitCap('archer')"),222);
// 扩军会同步抬高军粮维护；建筑阶段的55粮工不足以供养最终470人。
assign({food:90,wood:15,stone:21});
wait('S.res.food>=10000&&S.res.wood>=13200&&S.res.stone>=3300');
const queued=run("train('archer',165)");
assert.equal(queued?.ok,true);
assert.equal(queued.qty,165);
wait('S.pool.archer>=165',200);
trained=165;
assert.equal(run('armyCount()'),470);
assert.equal(run('S.queue.archer.count'),0);
assert.equal(run('save().ok'),true);
const raw=e.store.get('rts_save'),saved=JSON.parse(raw);
assert.equal(saved.tick,run('S.tick'));
const replay=environment({rts_save:raw});
assert.equal(replay.run('loadSaveAndApply().status'),'ok');
assert.equal(replay.run('armyCount()'),470);
if(preArg)fs.writeFileSync(path.resolve(preArg.slice('--snapshot-prebattle='.length)),raw);
const formations=[
  {name:'gold-front',front:['alloy_special','armored_trooper','electro_trooper','gold_cavalry']},
  {name:'iron-front',front:['alloy_special','armored_trooper','electro_trooper','iron_spearman']}
];
const troops={alloy_special:55,armored_trooper:55,electro_trooper:55,gold_cavalry:40,
  bronze_guard:15,iron_spearman:15,silver_heavy:15};
const results=[];
let firstWin=null;
function place(test,row,type,count,slot){
  assert.ok(test.run(`S.pool.${type}`)>=count);
  test.run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(test.run(`S.formation.${row}.some(u=>u.type==='${type}'&&u.count===${count})`),true);
}
for(const form of formations)for(let seed=1;seed<=12;seed++){
  const test=environment({rts_save:raw});
  const trun=test.run;
  assert.equal(trun('loadSaveAndApply().status'),'ok');
  trun(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{let id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
    clrForm('expedition');`);
  form.front.forEach((type,i)=>place(test,'front',type,troops[type],i));
  Object.keys(troops).filter(type=>!form.front.includes(type)).forEach((type,i)=>place(test,'mid',type,troops[type],i));
  for(let i=0;i<4;i++)place(test,'back','archer',55,i);
  assert.equal(trun('armyCount()'),470);
  const before=trun('S.killValues.godGuardian');
  trun("openMaterialDomain('guardianStone')");
  assert.equal(trun('S.battleActive'),true);
  if(roundLimit!==null)trun(`B.maxRound=${roundLimit}`);
  let callbacks=0;
  while(trun('S.battleActive')&&callbacks<1000){assert.equal(trun('__step()'),true);callbacks++;}
  assert.equal(trun('S.battleActive'),false);
  const after=trun('({round:B.round,enemyHp:B.enemyUnits[0].hp,kill:S.killValues.godGuardian,army:armyCount(),stone:S.items.guardianStone})');
  const win=after.kill>before;
  results.push({formation:form.name,seed,win,round:after.round,enemyHp:after.enemyHp,armyAfter:after.army,
    stoneGain:after.stone-saved.items.guardianStone,callbacks});
  if(win&&!firstWin){
    assert.equal(trun('save().ok'),true);
    firstWin=test.store.get('rts_save');
    if(winArg)fs.writeFileSync(path.resolve(winArg.slice('--snapshot-first-win='.length)),firstWin);
  }
  trun('exitBattle()');
}
const ranked=results.slice().sort((a,b)=>Number(b.win)-Number(a.win)||a.enemyHp-b.enemyHp||b.armyAfter-a.armyAfter);
console.log(JSON.stringify({unit:'simulated online seconds; battle rounds; soldiers',sourceTick:start,
  prebattleTick:saved.tick,elapsed:saved.tick-start,builds,trained,paid,prebattleArmy:470,conditionalRoundLimit:roundLimit,
  prebattleSha256:crypto.createHash('sha256').update(raw).digest('hex'),wins:results.filter(x=>x.win).length,
  firstWinSha256:firstWin?crypto.createHash('sha256').update(firstWin).digest('hex'):null,
  best:ranked.slice(0,8),worst:ranked.at(-1),results},null,2));
