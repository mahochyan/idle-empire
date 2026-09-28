'use strict';
// 真实动作/逐秒 tick 探针；输出一条四人口、零关卡的煤铜铁可行路线，未优化用时。
// 运行：node tools/verify/probe-metal-growth.js
const assert=require('node:assert/strict');
const {environment}=require('../../tests/progression/harness');
const e=environment();
let elapsed=0;
const milestones=[];
function run(expression){return e.run(expression)}
function until(condition,max=20000){
  const n=run(`(()=>{let n=0;while(!(${condition})&&n<${max}){tick();n++}return n})()`);
  elapsed+=n;
  assert.equal(run(condition),true,`在 ${max} 秒内未满足 ${condition}`);
}
function mark(label){
  milestones.push({label,onlineSeconds:elapsed,population:run('popCurrent()'),capacity:run('maxPop()'),
    allocated:run('popAllocTotal()'),food:run('Number(S.res.food.toFixed(2))'),
    wood:run('Number(S.res.wood.toFixed(2))'),stone:run('Number(S.res.stone.toFixed(2))'),
    coal:run('Number(S.res.coal.toFixed(2))'),copper:run('Number(S.res.copper.toFixed(2))'),
    iron:run('Number(S.res.iron.toFixed(2))'),tech:run('Number(S.res.tech.toFixed(2))')});
}
function assign(rk,n){assert.equal(run(`setPopAlloc('${rk}',${n}).ok`),true,`分配 ${rk}=${n}`)}
function study(id){
  const cost=run(`activeSciences()['${id}'].cost.tech`);
  until(`S.res.tech>=${cost}`);
  assert.equal(run(`researchScience('${id}').ok`),true,`研究 ${id}`);
  mark(id);
}
function spendOneSecond(){run('tick()');elapsed++}

mark('new-game');
assert.equal(run("buildAct('academy').ok"),true);
until("popCurrent()===4&&bldSt('academy').lv===1",30);
for(const rk of ['wood','stone','food','tech'])assign(rk,1);
study('sci_prospect');
study('sci_coal');
study('sci_copper');
for(const rk of ['wood','food','tech'])assign(rk,0);
assign('coal',2);assign('copper',1);
spendOneSecond();
assert.ok(run('S.res.copper')>0);
mark('first-copper');
assign('coal',0);assign('copper',0);
for(const rk of ['wood','food','tech'])assign(rk,1);
study('sci_urbanization');
study('sci_iron');
for(const rk of ['wood','food','tech'])assign(rk,0);
assign('coal',1);assign('iron',1);
spendOneSecond();
assert.ok(run('S.res.iron')>0);
mark('first-iron');
assert.equal(run('S.defeated.length'),0);
console.log(JSON.stringify({unit:'online seconds',battleWins:0,milestones},null,2));
