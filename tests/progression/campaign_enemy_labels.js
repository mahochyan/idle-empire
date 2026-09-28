'use strict';
// Enemy previews must not promise a troop type absent from the real campaign roster.
const assert=require('node:assert/strict');
const {environment}=require('./harness');

const {stages,units}=JSON.parse(environment().run('JSON.stringify({stages:CFG.enemies,units:CFG.units})'));
assert.equal(stages.length,100);
const errors=[];
for(const stage of stages){
  const preview=`${stage.name} ${stage.desc||''}`;
  const roster=Object.entries(stage.units).filter(([,counts])=>Array.isArray(counts)&&counts.some(count=>count>0));
  const hasFamily=family=>roster.some(([key])=>units[key]?.baseUnit===family);
  const hasHeavyCavalry=roster.some(([key])=>units[key]?.baseUnit==='cavalry'&&/重装|重骑/.test(units[key].name));
  if(/弓|射/.test(preview)&&!hasFamily('archer'))errors.push(`${stage.id}: 弓兵未入场`);
  if(/骑/.test(preview)&&!hasFamily('cavalry'))errors.push(`${stage.id}: 骑兵未入场`);
  if(/重骑/.test(preview)&&!hasHeavyCavalry)errors.push(`${stage.id}: 重骑兵未入场`);
}
assert.deepEqual(errors,[],`关卡预告与实际敌阵不一致：${errors.join('，')}`);
console.log('PASS 100关敌情文案与已配置的弓兵、骑兵兵种一致');
