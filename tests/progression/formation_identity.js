'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');

const e=environment();
e.run(`
  globalThis.Date=class extends Date{static now(){return 123456789}};
  Math.random=()=>0.5;
  S.buildings.barracks={lv:7,state:'idle'};
  S.buildings.alloy_armory={lv:12,state:'idle'};
  S.buildings.steam_armory={lv:12,state:'idle'};
  S.buildings.archer_range={lv:2,state:'idle'};
  S.pool={alloy_special:40,armored_trooper:40,archer:40};
  for(const [row,type] of [['front','alloy_special'],['mid','armored_trooper'],['back','archer']]){
    openFormModal('expedition',row,0);S._formModalSel=type;S._formModalQty=40;confirmForm();
  }
`);
const ids=e.run("[...S.formation.front,...S.formation.mid,...S.formation.back].map(u=>u.id)");
assert.equal(new Set(ids).size,3,'同一毫秒、同一随机数的三团编队ID必须唯一');
e.run("B.isTraining=false;S.battleEncounter=CFG.godDomain.key;initBattleState();applyCombatDamage(B.ourUnits[0],110);rebuildFormation()");
assert.deepEqual(JSON.parse(e.run("JSON.stringify([S.formation.front[0].count,S.formation.mid[0].count,S.formation.back[0].count])")),[20,40,40]);
assert.equal(e.run("S.formation.front.concat(S.formation.mid,S.formation.back).reduce((n,u)=>n+u.count,0)"),100);

const old=environment({}, {garrison:true});
old.run(`
  S.formation={front:[{type:'alloy_special',count:40,id:99.5}],mid:[{type:'armored_trooper',count:40,id:99.5}],back:[{type:'archer',count:40,id:99.5}]};
  B.isTraining=false;S.battleEncounter=CFG.godDomain.key;initBattleState();
  applyCombatDamage(B.ourUnits[0],110);applyCombatDamage(B.ourUnits[1],65);rebuildFormation();
`);
assert.deepEqual(JSON.parse(old.run("JSON.stringify([S.formation.front[0].count,S.formation.mid[0].count,S.formation.back[0].count])")),[20,30,40],'历史重复ID档的远征回写必须逐位置对应');
old.run(`
  S._garrisonForm={front:[{type:'alloy_special',count:40,id:99.5}],mid:[{type:'armored_trooper',count:40,id:99.5}],back:[{type:'archer',count:40,id:99.5}]};
  const units=buildGarrisonUnitsFromForm();applyCombatDamage(units[0],110);applyCombatDamage(units[1],65);
  rebuildGarrisonFormationAfterBattle({ourUnits:units});
`);
assert.deepEqual(JSON.parse(old.run("JSON.stringify([S._garrisonForm.front[0].count,S._garrisonForm.mid[0].count,S._garrisonForm.back[0].count])")),[20,30,40],'历史重复ID档的驻军回写必须逐位置对应');
console.log('formation identity: 3/3');
