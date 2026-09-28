// ==================== 全局状态 S ====================
function defaultArmsUpState(){
  return Object.fromEntries(Object.entries(CFG.armsUp).map(([uk,cfg])=>
    [uk,Object.fromEntries(Object.keys(cfg.stats).map(stat=>[stat,{stars:0,progress:0}]))]));
}
function defaultAwakeningState(){return{star_trooper:{level:0,stars:0,tracks:{easy:0,perfect:0,extreme:0}}}}
function defaultSoulRanks(){return{}}
// 发展线独立进度；区域胜次由战斗结算更新，不由资源秒结算暗中发放。
function defaultDevelopmentState(){
  return{
    border:{sites:{copper:{level:0,wins:0},iron:{level:0,wins:0}},
      collection:{activeSite:null,elapsedSec:0}},
    outer:{village:{wins:0,alert:0},town:{wins:0,alert:0},city:{wins:0,alert:0},capital:{wins:0,alert:0}}
  };
}
function defaultMarketSpecialState(){
  return{clockSec:CFG.market.special.refreshSec,offers:{sacredBlood:0,domainCleanser:0,emberElixir:0,aegisElixir:0},cycles:0};
}
// 我方暂定适配：单激活点的周期与基础量由 CFG 定义；离线不推进该独立定时器。
// pool: 训练完成但未编队的后备兵力（拥有 = pool + 远征编队 + 驻军编队）
// formation: 远征阵容（前/中/后排，每团人数≤regMax）
// _garrisonForm: 驻军阵容（防守用，结构与 formation 相同）
// queue: 训练队列 {uk: {count, timer, reason}}，资源在生产完成时扣除
// upgradedUnits: 科技树已研究解锁的兵种变体
// essence: Boss 掉落的精魄库存，用于 T2/T3 兵种研究
let S = {
  res:{wood:300,stone:300,food:300,tech:0,coal:0,copper:0,iron:0,silver:0,gold:0,steel:0,coin:0,silverCoin:0,goldCoin:0,deed:30,medal:0,bone:0,hide:0},
  buildings:{},
  pool:{infantry:0,archer:0},
  formation:{front:[],mid:[],back:[]},
  townLv:1,
  popAlloc:{...CFG.pop.initialAlloc,coal:0,copper:0,iron:0,silver:0,gold:0,steel:0,coin:0,silverCoin:0,goldCoin:0,tech:0},
  metalRecipeMode:'coal',
  currencyRecipeMode:'copper',
  storageMode:'aligned',
  storageMasteryLv:0,
  scholarMasteryLv:0,
  steelMasteryLv:0,
  weaponForge:{alloySword:{researched:false,level:0,progress:0,equipped:false},alloyArmor:{researched:false,level:0,progress:0,equipped:false},armored:{researched:false,level:0,progress:0,equipped:false},gatling:{researched:false,level:0,progress:0,equipped:false},mortar:{researched:false,level:0,progress:0,equipped:false},steamArmor:{researched:false,level:0,progress:0,equipped:false},electro:{researched:false,level:0,progress:0,equipped:false},electroRifle:{researched:false,level:0,progress:0,equipped:false},electroSniper:{researched:false,level:0,progress:0,equipped:false},electroArmor:{researched:false,level:0,progress:0,equipped:false},energyArmor:{researched:false,level:0,progress:0,equipped:false},nanoArmor:{researched:false,level:0,progress:0,equipped:false},starFighter:{researched:false,level:0,progress:0,equipped:false},starMissile:{researched:false,level:0,progress:0,equipped:false}},
  armsUp:defaultArmsUpState(),
  awakening:defaultAwakeningState(),
  soulRanks:defaultSoulRanks(),
  soulRealmTeam:null,
  eraStorage:{steamBasic:0,steamMetal:0,steamKnowledge:0,electricBasic:0,electricMetal:0,electricKnowledge:0,electricProduction:0,nuclearBasic:0,nuclearMetal:0,nuclearKnowledge:0,nuclearProduction:0,quantumBasic:0,quantumMetal:0,quantumKnowledge:0,quantumProduction:0},
  items:{godCrystal:0,guardianStone:0,revivalLeaf:0,trialFruit:0,phantomFlower:0,godCore:0,boarHeart:0,bullHorn:0,snakeGall:0,tigerPelt:0,turtleShell:0,wyrmSinew:0,storageScroll:0,sacredBlood:0,domainCleanser:0,emberElixir:0,aegisElixir:0,soulStone:0},
  bloodline:{},
  attackInfusions:{},
  aegisInfusions:{},
  marketSpecial:defaultMarketSpecialState(),
  beastExchange:{level:1,progress:0,scrollUsed:0,heartOffers:0,heartQuality:100,refreshClock:1200,refreshCharges:5,wildOffers:defaultWildOffers(),soulOffers:defaultSoulOffers(),medalOffers:0,hideOffers:defaultHideOffers()},
  killValues:{godRevival:0,godPhantom:0,godGuardian:0,godRebirth:0,godSilence:0,godSlaughter:0,soulRealm:0,wildBoar:0,wildBull:0,wildSnake:0,wildTiger:0,wildTurtle:0,wildWyrm:0},
  development:defaultDevelopmentState(),
  settlements:{village:0,smallTown:0,city:1},
  townPolicies:{smallTown:[]},
  population:{current:CFG.pop.initial,growthClock:0,legacyBonus:0},
  defeated:[],
  merit:0,
  log:[],
  garrisonLog:[],
  garrison:null,
  tick:0,
  page:'home',
  selEnemy:null,
  battleEncounter:null,
  _awakeningTrial:null,
  queue:{},
  battleSpeed:CFG.defaultBattleSpeed||2,
  battleActive:false,
  _trainQty:{},
  _testUnlocked:false,
  _fastBuild:false,
  _garrisonForm:{front:[],mid:[],back:[]},
  _fightTab:'expedition',
  _buildTab:'ready',
  _barracksTab:'train',
  _barracksFold:{},
  townUpgrade:null,
  upgradedUnits:{},
  essence:{},
  sciences:[],
  // 切片9（存档 v3 骨架）：幂等记录 / 离线结算凭证 / 每日计数（仅在 CFG.save.v3 开启时入档）
  ops:[], offline:{pendingReport:null,populationFoodRule:'all'}, daily:{day:null,counts:{}}
};

// ==================== 辅助 ====================
function bldSt(k){return S.buildings[k]||{lv:0,state:'idle',timer:0,timerEnd:0,tier:0}}
// 切片4b（R5-①②）：食物经济对齐的运行时取值——原始数值保留在 CFG.res/CFG.buildings，展示与实现同源
function alignedResBase(rk){const f=CFG.food;if(f&&f.aligned&&f.res&&f.res[rk]&&typeof f.res[rk].basePerPop==='number')return f.res[rk].basePerPop;return null}
function effConsume(key,res){const f=CFG.food;if(f&&f.aligned&&f.consumes&&f.consumes[key]&&typeof f.consumes[key][res]==='number')return f.consumes[key][res];const c=CFG.buildings[key]&&CFG.buildings[key].consumes;return c?c[res]:undefined}
function prodRate(rk){
  if(!isWorkerResource(rk)||workerLockReason(rk))return 0;
  const alloc=S.popAlloc[rk]||0;
  if(alloc<=0)return 0;
  const ab=alignedResBase(rk);
  const base=rk==='coin'&&S.currencyRecipeMode==='copper'?CFG.currency.copperPerWorkerPerSec:(ab!=null?ab:CFG.res[rk].basePerPop);
  const electricBonus=CFG.res[rk].type==='currency'?1:1+S.eraStorage.electricProduction*CFG.eraStorage.electricProduction.perLevel;
  const nuclearBonus=CFG.res[rk].type==='currency'?1:1+(S.eraStorage.nuclearProduction||0)*CFG.eraStorage.nuclearProduction.perLevel;
  const quantumBonus=CFG.res[rk].type==='currency'?1:1+(S.eraStorage.quantumProduction||0)*CFG.eraStorage.quantumProduction.perLevel;
  const scholarBonus=rk==='tech'?1+S.scholarMasteryLv*CFG.scholarMastery.perLevel:1;
  const steelBonus=rk==='steel'?1+S.steelMasteryLv*CFG.steelMastery.perLevel:1;
  return alloc*base*(1+buildingBuff(rk))*electricBonus*nuclearBonus*quantumBonus*scholarBonus*steelBonus;
}
// 岗位由配置定义，基础采集不依赖提效建筑；建筑岗位需已完工。
// 用同一集合校验存档和动作，地契等不可采集资源不进入劳动力分配。
function isWorkerResource(rk){
  return Object.prototype.hasOwnProperty.call(CFG.res,rk)&&Number.isFinite(CFG.res[rk].basePerPop)&&CFG.res[rk].basePerPop>=0;
}
function workerLockReason(rk){
  if(!isWorkerResource(rk))return '该资源不能分配村民';
  if(rk==='coin'&&S.currencyRecipeMode==='copper')return scienceUnlocked('sci_currency')?'':'需先研究「'+sciName('sci_currency')+'」';
  if(rk==='silver')return scienceUnlocked('sci_silver')?'':'需先研究「'+sciName('sci_silver')+'」';
  if(rk==='gold')return scienceUnlocked('sci_gold')?'':'需先研究「'+sciName('sci_gold')+'」';
  if(rk==='steel')return scienceUnlocked('sci_steel')?'':'需先研究「'+sciName('sci_steel')+'」';
  if(rk==='silverCoin'){
    if(!scienceUnlocked('sci_silver'))return '需先研究「'+sciName('sci_silver')+'」';
    const mintScience=S.currencyRecipeMode==='legacy'?'sci_coin':'sci_currency';
    return scienceUnlocked(mintScience)?'':'需先研究「'+sciName(mintScience)+'」';
  }
  if(rk==='goldCoin'){
    if(!scienceUnlocked('sci_gold'))return '需先研究「'+sciName('sci_gold')+'」';
    const mintScience=S.currencyRecipeMode==='legacy'?'sci_coin':'sci_currency';
    return scienceUnlocked(mintScience)?'':'需先研究「'+sciName(mintScience)+'」';
  }
  if(rk==='coal'&&!scienceUnlocked('sci_coal'))return '需先研究「'+sciName('sci_coal')+'」';
  if(S.metalRecipeMode==='coal'&&(rk==='copper'||rk==='iron')){
    const sid=rk==='copper'?'sci_copper':'sci_iron';
    if(!scienceUnlocked(sid))return '需先研究「'+sciName(sid)+'」';
    return '';
  }
  const bk=CFG.res[rk].workerBuilding;
  if(bk&&bldSt(bk).lv<1)return '需先建造'+CFG.buildings[bk].name;
  return '';
}
function buildingBuff(rk){
  return Object.keys(CFG.buildings).reduce((sum,bk)=>{
    const cfg=CFG.buildings[bk],st=bldSt(bk);
    return cfg.buffRes===rk&&st.state==='idle'&&st.lv>0?sum+cfg.buffBase+st.lv*cfg.buffPerLv:sum;
  },0);
}
function townCfg(){return CFG.town.find(t=>t.lv===S.townLv)||CFG.town[0]}
function resourceDisplayName(rk){return rk==='coin'?(S.currencyRecipeMode==='copper'?'铜钱':'金币'):rk==='medal'&&!scienceUnlocked('sci_electric_age')?'战备勋章':(CFG.res[rk]?.name||rk)}
function settlementCapacity(levels=S.settlements){
  return Object.keys(CFG.settlements).reduce((n,key)=>n+levels[key]*CFG.settlements[key].popPerLv,0);
}
function maxPop(){return settlementCapacity()+(S.population.legacyBonus||0)}
function birthPolicyCount(){return S.townPolicies.smallTown.filter(policy=>policy==='birth').length}
function popGrowthPer10s(){return CFG.pop.per10sBase+CFG.pop.birthPolicyPer10s*birthPolicyCount()}
function popCurrent(){return S.population.current}
function popAllocTotal(){return Object.values(S.popAlloc).reduce((a,b)=>a+b,0)}
function popFree(){return Math.max(0,popCurrent()-popAllocTotal())}
// 聚落扩容为即时建设；基础费用随当前等级线性增长，地契只扣一次。
function settlementCostAt(key,lv){
  const cfg=Object.prototype.hasOwnProperty.call(CFG.settlements,key)?CFG.settlements[key]:null;
  if(!cfg)return null;
  if(!Number.isSafeInteger(lv)||lv<0)return null;
  const cost=Math.floor(cfg.deedBase*(1+0.2*lv));
  return Number.isSafeInteger(cost)&&cost>=0?cost:null;
}
function settlementCost(key){return settlementCostAt(key,S.settlements[key])}
function settlementLockReason(key){
  const cfg=Object.prototype.hasOwnProperty.call(CFG.settlements,key)?CFG.settlements[key]:null;
  if(!cfg)return '未知聚落类型';
  if(_saveProtected)return '存档保护中，无法扩建';
  if(cfg.needScience&&!S.sciences.includes(cfg.needScience))return '需先研究「'+sciName(cfg.needScience)+'」';
  const cost=settlementCost(key);
  if(cost==null||!Number.isSafeInteger(maxPop()+cfg.popPerLv))return '聚落等级已达数值上限';
  if(!Number.isFinite(S.res.deed)||S.res.deed<cost)return '地契不足（需要 '+cost+'）';
  return '';
}
// 逐级采用与单级扩建完全相同的费用；预览无副作用，提交再重验并仅保存一次。
function settlementBatchPreview(key,count,expectedLv){
  const fail=reason=>({ok:false,reason});
  const cfg=Object.prototype.hasOwnProperty.call(CFG.settlements,key)?CFG.settlements[key]:null;
  if(!cfg)return fail('未知聚落类型');
  if(expectedLv!==undefined&&(!Number.isSafeInteger(expectedLv)||expectedLv!==S.settlements[key]))
    return fail('聚落等级已变化，请刷新后再试');
  if(!Number.isSafeInteger(count)||count<=0||count>1000)return fail('单次扩建级数需为 1～1000 的整数');
  if(_saveProtected)return fail('存档保护中，无法扩建');
  if(cfg.needScience&&!S.sciences.includes(cfg.needScience))return fail('需先研究「'+sciName(cfg.needScience)+'」');
  const oldLv=S.settlements[key];
  if(!Number.isSafeInteger(oldLv)||oldLv<0)return fail('聚落等级已达数值上限');
  const level=oldLv+count,gain=cfg.popPerLv*count;
  if(!Number.isSafeInteger(level)||!Number.isSafeInteger(gain)||!Number.isSafeInteger(maxPop()+gain))
    return fail('聚落等级已达数值上限');
  const costs=[];let cost=0;
  for(let i=0;i<count;i++){
    const each=settlementCostAt(key,oldLv+i);
    if(each==null||!Number.isSafeInteger(cost+each))return fail('聚落费用已达数值上限');
    costs.push(each);cost+=each;
  }
  if(!Number.isFinite(S.res.deed)||S.res.deed<cost)return{ok:false,reason:'地契不足（共需 '+cost+'）',cost,costs,gain,level,remainingDeed:S.res.deed-cost};
  return{ok:true,key,count,startLevel:oldLv,level,cost,costs,gain,capacity:maxPop()+gain,remainingDeed:S.res.deed-cost};
}
function upgradeSettlementBatch(key,count,expectedLv,expectedDeedBalance){
  if(expectedDeedBalance!==undefined&&S.res.deed!==expectedDeedBalance){
    if(typeof toast==='function')toast('地契余额已变化，请重新预览');
    return{ok:false,reason:'stale-quote'};
  }
  const plan=settlementBatchPreview(key,count,expectedLv);
  if(!plan.ok){if(typeof toast==='function')toast(plan.reason);return plan;}
  const oldLv=S.settlements[key],oldDeed=S.res.deed;
  S.res.deed-=plan.cost;
  S.settlements[key]=plan.level;
  const written=save();
  if(!written.ok){
    S.res.deed=oldDeed;S.settlements[key]=oldLv;
    const failure='保存失败，扩建未生效';
    if(typeof toast==='function')toast(failure);
    if(typeof updateUI==='function')updateUI();
    return{ok:false,reason:failure};
  }
  if(typeof addLog==='function')addLog(CFG.settlements[key].name+'→Lv.'+plan.level+'，人口上限 '+maxPop()+'（地契 -'+plan.cost+'）');
  if(typeof updateUI==='function')updateUI();
  return{ok:true,cost:plan.cost,level:plan.level,gain:plan.gain,count,remainingDeed:plan.remainingDeed};
}
function upgradeSettlement(key,expectedLv){return upgradeSettlementBatch(key,1,expectedLv)}
// 小镇每级提供一格政策位。研究只解锁选项，实际配置后才改变十秒人口增长。
function setSmallTownPolicy(slot,policy){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  if(!Number.isSafeInteger(slot)||slot<0)return{ok:false,reason:'invalid-slot'};
  if(slot>=S.settlements.smallTown)return{ok:false,reason:'slot-locked'};
  if(policy!==null&&policy!=='birth')return{ok:false,reason:'invalid-policy'};
  if(policy==='birth'&&!S.sciences.includes('sci_birth_policy'))return{ok:false,reason:'need-science'};
  const previous=S.townPolicies.smallTown.slice();
  if((previous[slot]??null)===policy)return{ok:false,reason:'unchanged'};
  const next=previous.slice();
  while(next.length<=slot)next.push(null);
  next[slot]=policy;
  S.townPolicies.smallTown=next;
  const written=save();
  if(!written.ok){S.townPolicies.smallTown=previous;return{ok:false,reason:'save-failed'}}
  if(typeof addLog==='function')addLog(policy==='birth'?'小镇第'+(slot+1)+'位推行鼓励生育':'小镇第'+(slot+1)+'位撤销鼓励生育');
  if(typeof updateUI==='function')updateUI();
  return{ok:true,slot,policy,birthCount:birthPolicyCount()};
}
function advancePopulationOnlineSecond(){
  if(!(S.res.food>0)||S.population.current>=maxPop())return false;
  S.population.growthClock++;
  if(S.population.growthClock>=10){
    S.population.growthClock=0;
    S.population.current=Math.min(maxPop(),S.population.current+popGrowthPer10s());
    return true;
  }
  return false;
}
function townUpgradeNeedBossId(){
  const next=CFG.town.find(t=>t.lv===S.townLv+1);
  return next?next.needBossId:999;
}
function townCanUpgrade(){
  return false; // 历史待完成任务仍结算；新扩容只走 upgradeSettlement。
}
// S8c（D2）：下一级城镇的「地契+科技点」需求（开启开关时生效；关闭时返回 null）
function townGateCost(toLv){
  const g=CFG.townGate;
  if(!g||!g.useDeed)return null;
  return (g.cost||[]).find(c=>c.toLv===toLv)||null;
}
function townGateShortfall(toLv){
  const c=townGateCost(toLv);if(!c)return '';
  const lack=[];
  if((S.res.deed||0)<c.deed)lack.push(`地契 ${c.deed-(S.res.deed||0)}`);
  if((S.res.tech||0)<c.tech)lack.push(`科技点 ${c.tech-(S.res.tech||0)}`);
  return lack.join(' · ');
}
function bossDefeatedCount(){
  return CFG.enemies.filter(e=>e.boss&&S.defeated.includes(e.id)).length;
}
// 切片4（S3 上限扩容）：开关决定是否使用 CFG.caps.expand 的扩容值；关闭时全部走原始数值
function capsExpanded(){return !!(CFG.caps&&CFG.caps.expanded&&CFG.caps.expand)}
function expandedResCap(rk){return (capsExpanded()&&CFG.caps.expand.res&&CFG.caps.expand.res[rk])||null}
function storageCapacity(rk='wood'){
  const whLv=(S.buildings.warehouse||{lv:0}).lv;
  if(S.storageMode==='aligned'&&CFG.basicStorage?.[rk]){
    const basic=CFG.basicStorage[rk];
    return basic.base+whLv*basic.warehousePerLv;
  }
  const cfg=CFG.buildings.warehouse;
  const perLv=capsExpanded()?CFG.caps.expand.warehousePerLv:(cfg.storagePerLv??500);
  return (cfg.storageBase??2000) + whLv * perLv;
}
// 切片8b（R2=A）：建筑等级上限改"自身 LvMax"（对齐竞品：仓库 1000、工坊/学院类 50），解开"城镇等级×k"绑定
function ownMaxFor(key){
  const o=CFG.ownMax; if(!o||!o.enabled) return null;
  const cfg=CFG.buildings[key]; if(!cfg) return null;
  if(cfg.storagePerLv||cfg.storageFor) return o.warehouse;
  if(cfg.trains) return o.training;
  if(cfg.type==='science') return o.science;
  if(cfg.type==='production') return o.production;
  if(cfg.buffRes) return o.resource;
  if(cfg.type==='utility') return o.utility;
  return o.barracks;
}
function upgradeLockReason(key){
  const cfg=CFG.buildings[key],st=bldSt(key),cap=CFG.buildingCaps;
  const ex=capsExpanded()?CFG.caps.expand:null;
  // 切片8b：自身 LvMax 模式（启用时短路，不再回落"城镇×k"）
  const om=ownMaxFor(key);
  if(om!=null){ if(st.lv>=om) return `已达等级上限 Lv.${om}`; return ''; }
  // 兵营建筑（步兵/弓兵/骑兵/矛兵/法师）：上限 = 城镇等级 × buildingCaps.training
  if(cfg.trains && st.lv>=S.townLv*cap.training) return `需升级城镇到Lv.${Math.floor(st.lv/cap.training)+1}`;
  // 仓库：上限 = 城镇等级 × buildingCaps.warehouse（扩容后 × expand.warehouseCapPerTown）
  if(cfg.storagePerLv||cfg.storageFor){const wc=ex?ex.warehouseCapPerTown:cap.warehouse;if(st.lv>=S.townLv*wc)return `需升级城镇到Lv.${Math.floor(st.lv/wc)+1}`;if(ex)return '';}
  // 科技建筑（学院）：扩容后单独上限（命中分支后短路，避免落到 barracks 回退被误锁）
  if(ex&&cfg.type==='science'){if(st.lv>=S.townLv*ex.scienceCapPerTown)return `需升级城镇到Lv.${Math.floor(st.lv/ex.scienceCapPerTown)+1}`;return '';}
  // 生产建筑（矿井/冶炼/铸币）：扩容后单独上限
  if(ex&&cfg.type==='production'){if(st.lv>=S.townLv*ex.productionCapPerTown)return `需升级城镇到Lv.${Math.floor(st.lv/ex.productionCapPerTown)+1}`;return '';}
  // 功能建筑（市场）：扩容后单独上限
  if(ex&&cfg.type==='utility'){if(st.lv>=S.townLv*ex.utilityCapPerTown)return `需升级城镇到Lv.${Math.floor(st.lv/ex.utilityCapPerTown)+1}`;return '';}
  // 采集 buff 建筑（伐木场/采石场/农田）：扩容后单独上限
  if(ex&&cfg.buffRes){if(st.lv>=S.townLv*ex.resourceCapPerTown)return `需升级城镇到Lv.${Math.floor(st.lv/ex.resourceCapPerTown)+1}`;return '';}
  // 营帐：上限 = 城镇等级 × buildingCaps.barracks
  if(!cfg.trains&&!cfg.storagePerLv&&!cfg.storageFor&&!cfg.buffRes && st.lv>=S.townLv*cap.barracks) return `需升级城镇到Lv.${Math.floor(st.lv/cap.barracks)+1}`;
  // 资源建筑（伐木场/采石场/农田）：上限 = 城镇等级 × buildingCaps.resource
  if(cfg.buffRes && st.lv>=S.townLv*cap.resource) return `需升级城镇到Lv.${Math.floor(st.lv/cap.resource)+1}`;
  return '';
}
function regMax(){
  const s=bldSt('barracks');
  return 5+(s.state==='idle'?s.lv*5:0);
}
function baseUnitType(uk){
  return CFG.units[uk]?.baseUnit||uk;
}
// 独立训练线仍可归入已有战斗兵种类，避免丢失基础克制与法师互克规则。
function combatBaseUnitType(uk){return CFG.units[uk]?.combatBase||baseUnitType(uk)}
function unitTag(uk){
  return CFG.units[uk]?.tag||null;
}
// 统一克制结算：有tag优先innerCounters，无tag fallback到counters（避免双重结算）
function cm(atk,def){
  const atkTag=unitTag(atk),defTag=unitTag(def);
  if(atkTag&&defTag)return CFG.innerCounters[atkTag]?.[defTag]||1.0;
  if(atkTag&&!defTag)return CFG.innerCounters[atkTag]?._default||(CFG.counters[combatBaseUnitType(atk)]?.[combatBaseUnitType(def)]||1.0);
  if(!atkTag&&defTag)return (CFG.innerNoTagDef||1.0)*(CFG.counters[combatBaseUnitType(atk)]?.[combatBaseUnitType(def)]||1.0);
  return CFG.counters[combatBaseUnitType(atk)]?.[combatBaseUnitType(def)]||1.0;
}
function trainBuildingKey(uk){
  const bu=baseUnitType(uk);
  return Object.keys(CFG.buildings).find(k=>CFG.buildings[k].trains===bu||CFG.buildings[k].trainsExtra?.includes(bu))||null;
}
function trainBuildingState(uk){
  const key=trainBuildingKey(uk);
  return key?bldSt(key):null;
}
function unitCap(uk){
  const bu=baseUnitType(uk);
  const key=trainBuildingKey(bu);
  if(!key)return 0;
  const st=bldSt(key);
  if(st.lv<=0)return 0;
  const bldTier=st.tier??0;
  const unitTier=CFG.units[uk]?.tier??0;
  if(unitTier>bldTier)return 0;
  const cap=CFG.unitCaps?.[bu];
  if(!cap)return 0;
  // 切片8a（O8 用户批准）：运行时上调单位上限（原始 CFG.unitCaps 不动；回滚＝开关 false）
  const b=CFG.unitCapBoost;
  if(b&&b.enabled&&b.base&&b.perLv&&typeof b.base[bu]==='number'&&typeof b.perLv[bu]==='number'){
    return b.base[bu] + st.lv * b.perLv[bu];
  }
  return cap.base + st.lv * cap.perLv;
}
function garrisonCount(uk){
  let n=0;
  const gf=S._garrisonForm||{front:[],mid:[],back:[]};
  for(const row of['front','mid','back']){
    for(const u of gf[row]){if(u.type===uk)n+=u.count;}
  }
  return n;
}
function expeditionCount(uk){
  let n=0;
  for(const row of['front','mid','back']){
    for(const u of S.formation[row]){if(u.type===uk)n+=u.count;}
  }
  return n;
}
function sameLine(a,b){return baseUnitType(a)===baseUnitType(b)}
function unitCapLeft(uk){
  let used=0;
  for(const[k,v] of Object.entries(S.pool)){if(sameLine(k,uk))used+=v;}
  for(const row of['front','mid','back']){
    for(const u of S.formation[row]){if(sameLine(u.type,uk))used+=u.count;}
    for(const u of S._garrisonForm[row]){if(sameLine(u.type,uk))used+=u.count;}
  }
  return Math.max(0,unitCap(uk)-used);
}
function queueTotal(uk){
  const q=S.queue[uk];
  return q?q.count:0;
}
function queueMax(uk){
  return unitCap(uk)*(CFG.queueMultiplier||5);
}
// 训练队列生产：每秒触发，timer倒数→0时产出1个→资源在产出时扣除（非排队时）
// 暂停条件：解锁未满足 / 上限已满 / 资源不足 → 分别设置 reason 供 UI 显示
function trainingCostKeys(cost){
  return Object.keys(cost||{}).filter(rk=>Object.prototype.hasOwnProperty.call(CFG.res,rk));
}
function maxUnitsByTrainingCost(cost){
  let max=Infinity;
  for(const rk of trainingCostKeys(cost)){
    const amount=cost[rk];
    if(!Number.isFinite(amount)||amount<0)return 0;
    if(amount>0)max=Math.min(max,Math.floor((S.res[rk]||0)/amount));
  }
  return max;
}
function payTrainingCost(cost,n){
  for(const rk of trainingCostKeys(cost))S.res[rk]=(S.res[rk]||0)-cost[rk]*n;
}
function processQueue(persist=true){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const before=persist?{res:{...S.res},pool:{...S.pool},queue:JSON.parse(JSON.stringify(S.queue))}:null;
  let changed=false;
  for(const[uk,q] of Object.entries(S.queue)){
    if(!q)continue;
    if(!q.count){q.reason='';continue;}
    const lock=trainLockReason(uk);
    if(lock){q.reason='';continue;}
    const tt=CFG.units[uk]?.trainTime||CFG.unitTrainTime||1;
    // 每tick产出 = max(1, 1/训练秒数)，tt=0.2→5个/tick, tt=1→1个/tick
    const perTick=tt<1?Math.round(1/tt):1;
    if(perTick>1){
      // 亚秒级训练：每tick直接产出 perTick 个
      if(q.count>0){
        if(unitCapLeft(uk)<=0){q.reason='';continue;}
        const cost=CFG.units[uk].cost;
        const can=Math.min(perTick, q.count, unitCapLeft(uk));
        const maxByRes=maxUnitsByTrainingCost(cost);
        const n=Math.min(can, maxByRes);
        if(n<=0){q.reason='资源不足，暂停生产';continue;}
        payTrainingCost(cost,n);
        S.pool[uk]=(S.pool[uk]||0)+n;
        q.count-=n;
        changed=true;
        q.reason='';
        if(q.count<=0){q.count=0;q.timer=0;q.reason='';}
      }
    }else{
      // 标准训练：timer倒数
      if(q.timer>0){q.timer--;}
      if(q.timer<=0&&q.count>0){
        if(unitCapLeft(uk)<=0){q.reason='';continue;}
        const cost=CFG.units[uk].cost;
        if(maxUnitsByTrainingCost(cost)<1){q.reason='资源不足，暂停生产';continue;}
        payTrainingCost(cost,1);
        S.pool[uk]=(S.pool[uk]||0)+1;
        q.count--;
        changed=true;
        q.reason='';
        if(q.count>0)q.timer=tt;else{q.timer=0;q.reason='';}
      }
    }
  }
  if(changed&&persist){
    const written=save();
    if(!written.ok){
      S.res=before.res;S.pool=before.pool;S.queue=before.queue;
      if(typeof toast==='function')toast('保存失败，训练结算未生效');
      return{ok:false,reason:'save-failed'};
    }
  }
  return{ok:true,changed};
}
function trainLockReason(uk){
  const unitCfg=CFG.units[uk];
  if(!unitCfg)return '未知兵种';
  if(unitCfg.enemyOnly)return '敌方专属兵种';
  if(unitCfg.needScience&&!scienceUnlocked(unitCfg.needScience))return '需先研究「'+sciName(unitCfg.needScience)+'」';
  const science=CFG.buildings[trainBuildingKey(uk)]?.needScience;
  if(science&&!scienceUnlocked(science))return '需先研究「'+sciName(science)+'」';
  if(unitCfg&&unitCfg.locked){
    if(baseUnitType(uk)===uk){
      const key=trainBuildingKey(uk);
      if(!key)return '';
      const cfg=CFG.buildings[key],st=bldSt(key);
      if(cfg.needBoss&&bossDefeatedCount()<cfg.needBoss)return '击败'+cfg.needBoss+'个Boss后解锁'+cfg.name;
      if(st.lv<=0&&st.state==='idle')return `需先建造${cfg.name}`;
      if(st.state==='building')return `${cfg.name}建设中`;
      if(st.state==='upgrading')return `${cfg.name}升级中`;
      return '';
    }else{
      if(!S.upgradedUnits[uk]){
        const tree=CFG.unitUpgrades[baseUnitType(uk)]?.tree;
        for(const[,node] of Object.entries(tree||{})){
          for(const br of node.branches||[]){
            if(br.to===uk){
              let msg=`需在科技树研究「${br.name}」(科技点:${br.needTech||0}`;
              msg+=`, 战功:${br.needMerit||0}`;
              if(br.needEssence){
                const ei=CFG.essences?.[br.needEssence.type];
                msg+=`, ${ei?.name||br.needEssence.type}:${br.needEssence.count}`;
              }
              msg+=`)`;
              return msg;
            }
          }
        }
        return '需在科技树研究升级';
      }
    }
  }
  const key=trainBuildingKey(uk);
  if(!key)return '';
  const cfg=CFG.buildings[key],st=bldSt(key);
  if(cfg.needBoss&&bossDefeatedCount()<cfg.needBoss)return '击败'+cfg.needBoss+'个Boss后解锁'+cfg.name;
  if(st.lv<=0&&st.state==='idle')return `需先建造${cfg.name}`;
  if(st.state==='building')return `${cfg.name}建设中`;
  if(st.state==='upgrading')return `${cfg.name}升级中`;
  if(st.state==='tier_upgrading')return `${cfg.name}时代升级中`;
  const bldTier=st.tier??0;
  const unitTier=CFG.units[uk]?.tier??0;
  if(unitTier>bldTier)return `需将${cfg.name}升级至T${unitTier}`;
  return '';
}
function mageOk(){return bossDefeatedCount()>=2;}
function trainBuildingLabel(uk){
  const key=trainBuildingKey(uk);
  if(!key)return '';
  const cfg=CFG.buildings[key],st=bldSt(key);
  if(st.lv<=0)return `${cfg.name}: \未\建\造`;
  return `${cfg.name}: Lv.${st.lv}${st.state==='idle'?'':' / \暂\停\训\练'}`;
}
function totalSoldiers(){
  let n=0;for(const v of Object.values(S.pool)) n+=v;
  for(const row of['front','mid','back']){
    for(const u of S.formation[row]) n+=u.count;
    for(const u of S._garrisonForm[row]) n+=u.count;
  }
  return n;
}
function formCnt(){return S.formation.front.length+S.formation.mid.length+S.formation.back.length}
function formSoldierCount(){return ['front','mid','back'].reduce((n,row)=>n+S.formation[row].reduce((m,u)=>m+u.count,0),0)}
function poolAvail(uk){ return S.pool[uk]||0; }
// 获取当前编辑目标阵容
function getForm(which){ return which==='garrison'?S._garrisonForm:S.formation; }
let _lastFormationId=0;
function nextFormationId(){
  const used=new Set();
  for(const form of [S.formation,S._garrisonForm])for(const row of ['front','mid','back'])
    for(const u of form[row])used.add(u.id);
  let id=Math.max(Date.now(),_lastFormationId+1);
  while(used.has(id))id++;
  _lastFormationId=id;
  return id;
}
// 切换战斗页子标签
function setFightTab(tab){ S._fightTab=tab; updateUI(); }
function setBuildTab(tab){ S._buildTab=tab; updateUI(); }
function setBarracksTab(tab){ S._barracksTab=tab; updateUI(); }
// 检查指定关卡索引（0-based）是否已击败
function hasLevelDefeated(idx){ return S.defeated.includes(CFG.enemies[idx]?.id); }
// 阵容空位：随关卡进度逐步解锁，上限 3×4（前4/中4/后4）
// 解锁顺序：前→中→后 轮替，每5关解锁一个，从第5关开始
function rowSlots(row){
  if(row==='front'){
    let s=1;
    if(hasLevelDefeated(4)) s++;   // 第5关
    if(hasLevelDefeated(19)) s++;  // 第20关
    if(hasLevelDefeated(34)) s++;  // 第35关
    return s;
  }
  if(row==='mid'){
    let s=1;
    if(hasLevelDefeated(9)) s++;   // 第10关
    if(hasLevelDefeated(24)) s++;  // 第25关
    if(hasLevelDefeated(39)) s++;  // 第40关
    return s;
  }
  let s=1;
  if(hasLevelDefeated(14)) s++;  // 第15关
  if(hasLevelDefeated(29)) s++;  // 第30关
  if(hasLevelDefeated(44)) s++;  // 第45关
  return s;
}
function formSlots(){ return rowSlots('front')+rowSlots('mid')+rowSlots('back'); }
// 切片6（S4 免维护带）：军粮 = 逐兵 upkeep 之和 × 分段倍率。
// 竞品原文（@1315400 区，逐字）：≤200 免维护；200<n≤300 →1×(n−200)；300<n≤500 →100+2×(n−300)；500<n≤1000 →500+4×(n−500)；n>1000 →2500+8×(n−500)
// 我方按尺度缩放：免维护带 = freeBase + freePerBarracksLv×营帐等级；超出后按 segWidths/segSlopes 边际计费（斜率作用于"基准逐兵 upkeep"）
function armyCount(){
  let n=0;
  for(const k of Object.keys(CFG.units)){ n+=(S.pool[k]||0); }
  for(const row of['front','mid','back']){
    for(const u of S.formation[row]){ n+=(u.count||0); }
    for(const u of S._garrisonForm[row]){ n+=(u.count||0); }
  }
  return n;
}
function freeBandSize(){
  const u=CFG.upkeep||{};
  return (u.freeBase||0)+(u.freePerBarracksLv||0)*((S.buildings.barracks||{lv:0}).lv||0);
}
function upkeepBandFactor(n){
  const u=CFG.upkeep||{};
  if(!u.freeBand) return 1;              // 关闭开关＝完全原样（零行为）
  if(n<=0) return 0;
  const free=freeBandSize();
  if(n<=free) return 0;                  // 免维护带内：军粮为 0
  const w=u.segWidths||[20,80,200], s=u.segSlopes||[1,2,4,8];
  let marginal=0, rem=n-free;
  for(let i=0;i<s.length;i++){
    const wi=(i<w.length?w[i]:Infinity);
    const take=Math.min(rem,wi);
    marginal+=take*s[i]; rem-=take;
    if(rem<=0) break;
  }
  if(rem>0) marginal+=rem*s[s.length-1];
  return marginal/n;                     // 平均倍率（使 total = 逐兵 upkeep 之和 × 本值）
}
function rawUpkeep(){
  let up=0;
  for(const[k,c] of Object.entries(CFG.units)){
    up+=(S.pool[k]||0)*(c.upkeep||0);
    for(const row of['front','mid','back']){
      for(const u of S.formation[row]){ if(u.type===k) up+=u.count*(c.upkeep||0); }
      for(const u of S._garrisonForm[row]){ if(u.type===k) up+=u.count*(c.upkeep||0); }
    }
  }
  return up;
}
function totalUpkeep(){
  const up=rawUpkeep();
  if(!(CFG.upkeep&&CFG.upkeep.freeBand)) return up;
  return up*upkeepBandFactor(armyCount());
}
function mm(atk,def){
  const atkBase=combatBaseUnitType(atk), defBase=combatBaseUnitType(def);
  if(atkBase==='mage'&&defBase!=='mage')return CFG.counters.mage[defBase]||1.0;
  if(atkBase!=='mage'&&defBase==='mage')return CFG.normalVsMage;
  return 1.0;
}
function mageSpec(unitType){
  const MS=CFG.mageSpecials||{};
  return MS[unitType]||null;
}
function awakeningTotalStars(){return S.awakening?.[CFG.awakening.unit]?.stars||0}
function ownedUnitCount(unitType){
  let count=Object.prototype.hasOwnProperty.call(S.pool,unitType)?S.pool[unitType]:0;
  for(const form of [S.formation,S._garrisonForm])for(const row of ['front','mid','back'])
    for(const unit of form[row]||[])if(unit.type===unitType)count+=unit.count;
  return count;
}
// 战斗实例聚合单兵生命；S 中仍只记录真实人数，护盾始终是临时量。
function battleVitals(unitType,count,owned=false){
  const configured=CFG.units[unitType]?.hpPerSoldier;
  const bonus=owned?armsUpBonus(unitType,'hp'):0;
  const base=Number.isFinite(configured)&&configured>=1?configured:1;
  const bloodlineUses=owned&&Object.prototype.hasOwnProperty.call(S.bloodline,unitType)?S.bloodline[unitType]:0;
  const aegisUses=owned&&Object.prototype.hasOwnProperty.call(S.aegisInfusions,unitType)?S.aegisInfusions[unitType]:0;
  const soul=owned?S.soulRanks[unitType]:null;
  // 母本先在原始HP量纲取整，再换算为我方每兵生命（100:1）。
  const soulHp=soul?soul.rank*base+Math.floor(soul.stars*base*10)/100:0;
  const hpPerSoldier=base+bonus+soulHp+(owned?base*(awakeningTotalStars()*CFG.awakening.globalStatPerStar+
    bloodlineUses*CFG.bloodline.hpPerUse+aegisUses*CFG.aegisElixir.hpPerUse):0);
  const hp=count*hpPerSoldier;
  const pct=mageSpec(unitType)?.voidShield?.hpPct||0;
  return{hp,maxHp:hp,initialCount:count,hpPerSoldier,shield:Math.floor(hp*pct)};
}
function combatSurvivors(unit){
  if(unit.attackMass)return unit.hp>0?1:0;
  const per=Number.isFinite(unit.hpPerSoldier)&&unit.hpPerSoldier>=1?unit.hpPerSoldier:1;
  const max=Number.isFinite(unit.initialCount)?Math.min(unit.initialCount,unit.survivorCap??Infinity):Math.ceil((unit.maxHp||unit.hp||0)/per);
  return Math.max(0,Math.min(max,Math.ceil(Math.max(0,unit.hp||0)/per-1e-9)));
}
// 普通兵团按幸存人数出手；聚合Boss按其独立出手规模结算。
function combatAttackMass(unit){
  if(Number.isFinite(unit.attackMass)&&unit.attackMass>0){
    if(unit.attackMassFallsWithHp&&Number.isFinite(unit.maxHp)&&unit.maxHp>0)
      return Math.max(0,Math.min(unit.attackMass,Math.ceil(unit.attackMass*Math.max(0,unit.hp||0)/unit.maxHp)));
    return unit.attackMass;
  }
  return combatSurvivors(unit);
}
// 远征与驻军共用：先耗临时护盾，再耗生命，返回实际损失供技能/日志使用。
function applyCombatDamage(unit,amount,attacker=null){
  if(!Number.isFinite(amount)||amount<=0)return{shieldLost:0,hpLost:0,casualties:0};
  const beforeCount=combatSurvivors(unit);
  const shield=Math.max(0,unit.shield||0),hp=Math.max(0,unit.hp||0);
  const shieldLost=Math.min(shield,amount);
  const hpLost=Math.min(hp,Math.max(0,amount-shieldLost));
  unit.shield=shield-shieldLost;
  unit.hp=hp-hpLost;
  if(unit.hp<=0){unit.hp=0;unit.alive=false;}
  // 复苏圣像的回复只修改本场敌方战斗体。死亡后不复活，回复不超过进场生命，绝不进入兵力回写。
  let healed=0,defAdded=0;
  const recovery=unit.type==='revival_god'?CFG.units.revival_god.onHitRecovery:null;
  if(recovery&&attacker&&hpLost>0&&unit.alive!==false&&Number.isFinite(attacker.atk)&&
      attacker.atk>unit.def*recovery.triggerAttackDefRatio){
    healed=Math.max(0,Math.min(unit.maxHp-unit.hp,Math.floor(attacker.atk*recovery.healAttackPct)));
    unit.hp+=healed;
    defAdded=recovery.defPerHit+Math.floor(attacker.atk/recovery.extraDefPerAttack);
    unit.def+=defAdded;
  }
  return{shieldLost,hpLost,casualties:Math.max(0,beforeCount-combatSurvivors(unit)),healed,defAdded};
}
// 母本逐兵在首次出手掷骰；本地兵团按当前存活人数逐次掷骰，只改本场战斗体。
function applyAwakeningOpeningSkills(actor,target,opponents=[target]){
  const result={defReduced:0,trueDamage:0,areaDamage:0,areaDefReduced:0,areaTargets:0};
  if(actor.type!=='star_trooper'||actor.awakeningOpeningUsed)return result;
  actor.awakeningOpeningUsed=true;
  const stars=Math.max(0,Number(S.awakening?.star_trooper?.stars)||0);
  if(!stars||target.alive===false||target.hp<=0)return result;
  const skills=CFG.awakening.combatSkills;
  const count=combatSurvivors(actor);
  const defChance=Math.min(1,Math.floor(stars*skills.starDefBreak.chancePctPerStar)/100);
  const hitChance=Math.min(1,Math.floor(stars*skills.starTrueHit.chancePctPerStar)/100);
  const judgement=skills.starJudgement;
  const areaChance=Math.min(1,Math.floor(stars*judgement.chancePctPerStar)/100);
  const defPerSoldier=Math.floor(Math.max(0,actor.entryAtk??actor.atk)*skills.starDefBreak.entryAtkPct);
  const hitPerSoldier=Math.floor(Math.max(0,actor.entryDef??actor.def)*skills.starTrueHit.entryDefPct);
  for(let i=0;i<count;i++){
    if(target.alive===false||target.hp<=0)break;
    if(defChance>0&&Math.random()<defChance){
      const reduced=Math.min(Math.max(0,target.def),defPerSoldier);
      target.def=Math.max(0,target.def-reduced);
      result.defReduced+=reduced;
    }
    // 源 TeamID=0 仅对应全军首位单兵；合并兵团只在首团第一次掷骰，避免按团人数重复群伤。
    if(i===0&&actor.id===judgement.firstTeamId&&stars>=judgement.minStars&&
        target.hp>target.maxHp*judgement.readyHpPct&&areaChance>0&&Math.random()<areaChance){
      const sourceHp=Math.floor(Math.max(0,actor.hpPerSoldier||0)*judgement.sourceHpPerLocalHp);
      const defPct=Math.min(judgement.maxDefPct,judgement.baseDefPct+
        Math.floor(sourceHp/judgement.hpStep)*judgement.extraDefPctPerHpStep);
      for(const foe of opponents){
        if(!foe||foe.alive===false||foe.hp<=0||!Number.isFinite(foe.maxHp)||foe.maxHp<=0)continue;
        const beforeHp=foe.hp,beforeDef=Math.max(0,foe.def||0);
        // 母本直接设置90%入场生命；本地不把已受伤目标反向治疗，护盾仍是独立临时量。
        foe.hp=Math.max(0,Math.min(beforeHp,Math.floor(foe.maxHp*judgement.remainingHpPct)));
        if(foe.hp<=0)foe.alive=false;
        foe.def=Math.max(0,Math.floor(beforeDef*(1-defPct)));
        result.areaDamage+=beforeHp-foe.hp;
        result.areaDefReduced+=beforeDef-foe.def;
        result.areaTargets++;
      }
    }
    if(hitChance>0&&Math.random()<hitChance&&target.alive!==false&&target.hp>0){
      const hit=applyCombatDamage(target,hitPerSoldier,actor);
      result.trueDamage+=hit.hpLost+hit.shieldLost;
    }
  }
  return result;
}
// 母本540091–093：守卫首次防御时压制本场临时超额属性，并维持自身攻防下限。
// 聚合Boss只触发一次人数增攻；本场HP上限压制不治疗，也不改变S中的真实兵数。
function applyTrialGuardDefensePassives(guard,attacker,allies=[],opponents=[]){
  const result={hpCapped:0,atkCapped:0,defCapped:0,guardAtkRestored:0,guardDefRestored:0,teamAtkAdded:0,changed:false};
  const cfg=CFG.awakening.combatSkills.trialGuardDefense;
  if(!cfg.types.includes(guard?.type)||guard.alive===false||guard.hp<=0||!attacker||attacker.alive===false||attacker.hp<=0)return result;
  const guardEntryAtk=Number.isFinite(guard.entryAtk)?guard.entryAtk:guard.atk;
  const guardEntryDef=Number.isFinite(guard.entryDef)?guard.entryDef:guard.def;
  const entryHp=Number.isFinite(attacker.entryMaxHp)?attacker.entryMaxHp:
    (Number.isFinite(attacker.initialCount)&&Number.isFinite(attacker.hpPerSoldier)?attacker.initialCount*attacker.hpPerSoldier:attacker.maxHp);
  const entryAtk=Number.isFinite(attacker.entryAtk)?attacker.entryAtk:attacker.atk;
  const entryDef=Number.isFinite(attacker.entryDef)?attacker.entryDef:attacker.def;
  if(Number.isFinite(entryHp)&&entryHp>=0&&Number.isFinite(attacker.maxHp)&&attacker.maxHp>entryHp*cfg.statCapMultiplier){
    const old=attacker.maxHp;
    attacker.maxHp=entryHp*cfg.statCapMultiplier;
    attacker.hp=Math.min(attacker.hp,attacker.maxHp);
    result.hpCapped=old-attacker.maxHp;
  }
  if(Number.isFinite(entryAtk)&&entryAtk>=0&&Number.isFinite(attacker.atk)&&attacker.atk>entryAtk*cfg.statCapMultiplier){
    const old=attacker.atk;
    attacker.atk=entryAtk*cfg.statCapMultiplier;
    result.atkCapped=old-attacker.atk;
  }
  if(Number.isFinite(entryDef)&&entryDef>=0&&Number.isFinite(attacker.def)&&
      attacker.def>entryDef*cfg.statCapMultiplier&&attacker.def>guard.atk*cfg.defenseCapGuardAtkPct){
    const old=attacker.def;
    attacker.def=entryDef*cfg.statCapMultiplier;
    result.defCapped=old-attacker.def;
  }
  if(Number.isFinite(guard.atk)&&guard.atk<cfg.floorMaxAttack){
    const atkFloor=Math.floor(Math.max(0,guardEntryAtk)*cfg.attackFloorPct);
    const defFloor=Math.floor(Math.max(0,guardEntryDef)*cfg.defenseFloorPct);
    if(guard.atk<atkFloor){result.guardAtkRestored=atkFloor-guard.atk;guard.atk=atkFloor}
    if(guard.def<defFloor){result.guardDefRestored=defFloor-guard.def;guard.def=defFloor}
    if(!guard.guardFirstDefenseUsed){
      guard.guardFirstDefenseUsed=true;
      const currentOpponents=opponents.reduce((n,u)=>n+(u.alive===false||u.hp<=0?0:combatSurvivors(u)),0);
      const tiers=Math.floor(currentOpponents/1000);
      if(tiers>0)for(const ally of allies){
        if(ally.alive===false||ally.hp<=0)continue;
        const base=Number.isFinite(ally.entryAtk)?ally.entryAtk:ally.atk;
        const added=Math.max(0,base)*cfg.alliesAttackPerThousand*tiers;
        ally.atk+=added;result.teamAtkAdded+=added;
      }
    }
  }
  result.changed=Object.entries(result).some(([key,value])=>key!=='changed'&&value>0);
  return result;
}
// 母本540091简单守卫：按现有Boss出手规模逐次掷骰，追加30%攻击的真实伤害。
function applyEasyTrialGuardAttackSkill(actor,target){
  if(actor.type!=='trial_guard_easy'||target.alive===false||target.hp<=0)return 0;
  const skill=CFG.awakening.combatSkills.easyGuardTrueHit;
  let procs=0;
  for(let i=0;i<combatAttackMass(actor);i++)if(Math.random()<skill.chance)procs++;
  const amount=Math.floor(procs*Math.max(0,actor.atk)*skill.attackPct*skill.localHpScale);
  const hit=applyCombatDamage(target,amount,actor);
  return hit.hpLost+hit.shieldLost;
}
function healCombatUnit(unit,amount){
  if(!Number.isFinite(amount)||amount<=0||unit.alive===false||unit.hp<=0)return 0;
  const per=Number.isFinite(unit.hpPerSoldier)&&unit.hpPerSoldier>=1?unit.hpPerSoldier:1;
  const cap=Math.min(unit.maxHp,combatSurvivors(unit)*per);
  const healed=Math.max(0,Math.min(amount,cap-unit.hp));
  unit.hp+=healed;
  return healed;
}
function missRate(attacker,defender){
  // 刃(blade)刺客不受弓兵基础miss影响
  if(attacker.tag==='blade')return 0;
  const cfg=CFG.miss[attacker.type]||CFG.miss[baseUnitType(attacker.type)];
  if(!cfg)return 0;
  // 弩(crossbow)不受骑兵额外miss影响，仅保留基础miss
  if(attacker.tag==='crossbow'&&baseUnitType(defender.type)==='cavalry')return cfg.base||0;
  return cfg[defender.type]??cfg.base??0;
}
function isAttackMiss(attacker,defender){
  const baseRate=missRate(attacker,defender);
  let rate=baseRate;
  // 弓攻击骑兵：额外50%miss
  if(attacker.tag==='bow'&&baseUnitType(defender.type)==='cavalry'){
    rate=Math.max(rate,CFG.archerSpecials?.bow?.attack?.vsCavalry?.miss||0.5);
  }
  return rate>0&&Math.random()<rate;
}

// ==================== 存档子系统（IE-001）====================
// key 布局：rts_save 主档 | rts_save_backup_1/_2 最近有效备份（轮转） | rts_save_premigration 覆盖前原始副本（仅迁移/导入/恢复时写）
// 写回单点 writeRawKey；自动保存入口 save() 在保护模式下无条件跳过（坏档/未来版本不会被静默覆盖成新档）。
// 单位约定：ts=毫秒时间戳，tick=秒，population.growthClock=0..9 个在线秒。
const SAVE_KEY='rts_save',SAVE_VERSION=32,BACKUP_KEYS=['rts_save_backup_1','rts_save_backup_2'],PRE_MIGRATION_KEY='rts_save_premigration';
const SAVE_V3_KEYS=['ops','offline','daily'];
let _loadedTs=null;   // 切片11：本次加载的存档 ts（离线结算基准；新档为 null → 不结算）
let _offlineSettledFor=null;   // 切片11：已结算过的离线窗口 ts（幂等）
function targetSaveVersion(){return SAVE_VERSION} // schema 不能随玩法开关降级，避免把 v4 误判为未来版本
let _saveProtected=false,_saveProtectReason='',_lastSaveWarn=0;
function saveProtected(){return _saveProtected}
function saveProtectReason(){return _saveProtectReason}
function _isNum(x){return typeof x==='number'&&Number.isFinite(x)}
function _isInt(x){return _isNum(x)&&Math.floor(x)===x}
function _isCount(x){return Number.isSafeInteger(x)&&x>=0}
function _isObj(o){return o!==null&&typeof o==='object'&&!Array.isArray(o)}
function _hasExactKeys(o,keys){return _isObj(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(o,k))}
function validateAwakeningState(x,errors){
  if(!_hasExactKeys(x,[CFG.awakening.unit])){errors.push('awakening 结构非法或缺失');return}
  const a=x[CFG.awakening.unit];
  if(!_hasExactKeys(a,['level','stars','tracks'])||!_isCount(a.level)||a.level>CFG.awakening.maxLevel||
      !_isCount(a.stars)||a.stars>a.level*12||a.stars<a.level||
      !_hasExactKeys(a.tracks,Object.keys(CFG.awakening.trials))||
      Object.values(a.tracks).some(n=>!_isCount(n)||n>CFG.awakening.maxLevel)||
      Object.values(a.tracks).reduce((n,v)=>n+v,0)!==a.level)
    errors.push('awakening.'+CFG.awakening.unit+' 非法');
}
function validateSoulRanks(x,errors){
  if(!_isObj(x)){errors.push('soulRanks 非法或缺失');return}
  for(const [key,value] of Object.entries(x)){
    if(!Object.prototype.hasOwnProperty.call(CFG.units,key)||CFG.units[key].enemyOnly||
       !_hasExactKeys(value,['rank','stars'])||!_isCount(value.rank)||value.rank>CFG.soulRank.maxRank||
       !_isCount(value.stars)||value.stars>CFG.soulRank.starsPerRank||
       value.rank===CFG.soulRank.maxRank&&value.stars!==0)
      errors.push('soulRanks.'+key+' 非法');
  }
}
function validateDevelopmentState(x,errors){
  if(!_hasExactKeys(x,['border','outer'])){errors.push('development 结构非法或缺失');return}
  const border=x.border,outer=x.outer;
  if(!_hasExactKeys(border,['sites','collection'])){errors.push('development.border 结构非法');return}
  if(!_hasExactKeys(border.sites,['copper','iron']))errors.push('development.border.sites 未知或缺失点位');
  else for(const key of ['copper','iron']){
    const site=border.sites[key];
    if(!_hasExactKeys(site,['level','wins'])||!_isCount(site.level)||site.level>CFG.developmentCollection.maxLevel||!_isCount(site.wins))errors.push('development.border.sites.'+key+' 非法');
  }
  const c=border.collection;
  if(!_hasExactKeys(c,['activeSite','elapsedSec']))errors.push('development.border.collection 结构非法');
  else{
    if(c.activeSite!==null&&!['copper','iron'].includes(c.activeSite))errors.push('development.border.collection.activeSite 非法');
    if(!_isCount(c.elapsedSec)||c.elapsedSec>=CFG.developmentCollection.periodSec||c.activeSite===null&&c.elapsedSec!==0)
      errors.push('development.border.collection.elapsedSec 非法');
    if(c.activeSite!==null&&_isObj(border.sites)&&_isObj(border.sites[c.activeSite])&&border.sites[c.activeSite].level===0)
      errors.push('development.border.collection.activeSite 未拥有');
  }
  if(!_hasExactKeys(outer,['village','town','city','capital']))errors.push('development.outer 未知或缺失区域');
  else for(const key of ['village','town','city','capital']){
    const region=outer[key];
    if(!_hasExactKeys(region,['wins','alert'])||!_isCount(region.wins)||!_isCount(region.alert))errors.push('development.outer.'+key+' 非法');
  }
}
// legacy（无 v）旧档缺字段补齐：数值逐项复刻原 load() 的 || 缺省行为（含 popAlloc {5,3,2} 的旧口径，如实保留不修正）
function _legacyDefaults(){return{res:{wood:300,stone:300,food:300,tech:0,copper:0,iron:0,coin:0},buildings:{},pool:{},queue:{},formation:{front:[],mid:[],back:[]},townLv:1,popAlloc:{wood:5,stone:3,food:2},defeated:[],merit:0,garrisonLog:[],garrison:null,tick:0,garrisonForm:{front:[],mid:[],back:[]},townUpgrade:null,upgradedUnits:{},essence:{},sciences:[]}}
function serializeSave(){
  const base={v:targetSaveVersion(),ts:Date.now(),res:S.res,buildings:S.buildings,pool:S.pool,queue:S.queue,formation:S.formation,townLv:S.townLv,popAlloc:S.popAlloc,metalRecipeMode:S.metalRecipeMode,currencyRecipeMode:S.currencyRecipeMode,storageMode:S.storageMode,storageMasteryLv:S.storageMasteryLv,scholarMasteryLv:S.scholarMasteryLv,steelMasteryLv:S.steelMasteryLv,weaponForge:S.weaponForge,armsUp:S.armsUp,awakening:S.awakening,soulRanks:S.soulRanks,soulRealmTeam:S.soulRealmTeam,eraStorage:S.eraStorage,items:S.items,bloodline:S.bloodline,attackInfusions:S.attackInfusions,aegisInfusions:S.aegisInfusions,marketSpecial:S.marketSpecial,beastExchange:S.beastExchange,killValues:S.killValues,development:S.development,settlements:S.settlements,townPolicies:S.townPolicies,population:S.population,defeated:S.defeated,merit:S.merit,garrisonLog:S.garrisonLog,garrison:S.garrison,tick:S.tick,garrisonForm:S._garrisonForm,townUpgrade:S.townUpgrade,upgradedUnits:S.upgradedUnits,essence:S.essence,sciences:S.sciences};
  if(targetSaveVersion()>=3){base.ops=S.ops||[];base.offline={...(S.offline||{pendingReport:null}),populationFoodRule:S.offline?.populationFoodRule??'all'};base.daily=S.daily||{day:null,counts:{}};}
  return base;
}
// 校验策略：结构/枚举/引用严格（未知兵种/建筑/关卡/资源 → 保护，不静默裁剪）；数值宽松（有限数且≥0 即可，超限不裁剪只报告）
function validateSave(d){
  const errors=[];
  if(!_isObj(d))return{ok:false,future:false,errors:['顶层结构不是对象']};
  const hasV='v' in d;
  if(hasV){
    if(!_isInt(d.v)||d.v<1)errors.push('v 版本字段非法');
    else if(d.v>targetSaveVersion())return{ok:false,future:true,errors:['存档版本 v='+d.v+' 高于当前支持的 v='+targetSaveVersion()]};
  }
  if('ts' in d&&!_isNum(d.ts))errors.push('ts 非法');
  if('res' in d){if(!_isObj(d.res))errors.push('res 不是对象');else for(const k of Object.keys(d.res)){if(!(k in CFG.res))errors.push('res: 未知资源 '+k);else if(!_isNum(d.res[k])||d.res[k]<0)errors.push('res.'+k+' 非法（负数或非有限数）')}}
  if(_isObj(d.res)&&'hide' in d.res&&!_isCount(d.res.hide))errors.push('res.hide 非法');
  if('popAlloc' in d){if(!_isObj(d.popAlloc))errors.push('popAlloc 不是对象');else for(const k of Object.keys(d.popAlloc)){if(!isWorkerResource(k))errors.push('popAlloc: 未知项 '+k);else if(!_isNum(d.popAlloc[k])||d.popAlloc[k]<0)errors.push('popAlloc.'+k+' 非法')}}
  if('settlements' in d){
    if(!_isObj(d.settlements))errors.push('settlements 不是对象');
    else{
      for(const key of Object.keys(d.settlements))if(!Object.prototype.hasOwnProperty.call(CFG.settlements,key))errors.push('settlements: 未知聚落 '+key);
      for(const key of Object.keys(CFG.settlements))if(!(key in d.settlements)||!_isCount(d.settlements[key]))errors.push('settlements.'+key+' 非法');
    }
  }
  if(hasV&&d.v>=7&&'townPolicies' in d){
    if(!_isObj(d.townPolicies))errors.push('townPolicies 不是对象');
    else{
      for(const key of Object.keys(d.townPolicies))if(key!=='smallTown')errors.push('townPolicies: 未知聚落 '+key);
      const slots=d.townPolicies.smallTown;
      if(!Array.isArray(slots))errors.push('townPolicies.smallTown 不是数组');
      else{
        if(!_isObj(d.settlements)||!_isCount(d.settlements.smallTown)||slots.length>d.settlements.smallTown)errors.push('townPolicies.smallTown 超出小镇等级');
        for(let i=0;i<slots.length;i++)if(!Object.prototype.hasOwnProperty.call(slots,i)||slots[i]!==null&&slots[i]!=='birth')errors.push('townPolicies.smallTown['+i+'] 非法');
        if(slots.includes('birth')&&(!Array.isArray(d.sciences)||!d.sciences.includes('sci_birth_policy')))errors.push('townPolicies.smallTown 缺少鼓励生育研究');
      }
    }
  }
  if('population' in d){
    if(!_isObj(d.population))errors.push('population 不是对象');
    else{
      for(const key of Object.keys(d.population))if(!['current','growthClock','legacyBonus'].includes(key))errors.push('population: 未知字段 '+key);
      if(!_isCount(d.population.current))errors.push('population.current 非法');
      if(!_isCount(d.population.growthClock)||d.population.growthClock>9)errors.push('population.growthClock 非法');
      if(!_isCount(d.population.legacyBonus))errors.push('population.legacyBonus 非法');
    }
  }
  if('buildings' in d){if(!_isObj(d.buildings))errors.push('buildings 不是对象');else for(const k of Object.keys(d.buildings)){const b=d.buildings[k];if(!(k in CFG.buildings))errors.push('buildings: 未知建筑 '+k);else if(!_isObj(b))errors.push('buildings.'+k+' 不是对象');else{if('lv' in b&&!_isInt(b.lv))errors.push('buildings.'+k+'.lv 非法');if('state' in b&&b.state!=null&&!['idle','building','upgrading','tier_upgrading'].includes(b.state))errors.push('buildings.'+k+'.state 非法');if('timer' in b&&b.timer!=null&&!_isNum(b.timer))errors.push('buildings.'+k+'.timer 非法');if('tier' in b&&'tier' in b&&b.tier!=null&&!_isInt(b.tier))errors.push('buildings.'+k+'.tier 非法');}}}
  const checkUnits=(where,arr)=>{if(!Array.isArray(arr)){errors.push(where+' 不是数组');return;}arr.forEach((u,i)=>{if(!_isObj(u))errors.push(where+'['+i+'] 不是对象');else{if(!(u.type in CFG.units)||CFG.units[u.type]?.enemyOnly)errors.push(where+'['+i+'].type 未知或敌方专属兵种');if(!_isNum(u.count)||u.count<0)errors.push(where+'['+i+'].count 非法');if('id' in u&&!_isNum(u.id))errors.push(where+'['+i+'].id 非法');}})};
  const chkFormation=(name,f)=>{if(!_isObj(f))errors.push(name+' 不是对象');else for(const r of['front','mid','back']){if(!(r in f))errors.push(name+' 缺少排 '+r);else checkUnits(name+'.'+r,f[r]);}};
  if('formation' in d)chkFormation('formation',d.formation);
  if('garrisonForm' in d)chkFormation('garrisonForm',d.garrisonForm);
  if('pool' in d){if(!_isObj(d.pool))errors.push('pool 不是对象');else for(const k of Object.keys(d.pool)){if(!(k in CFG.units)||CFG.units[k]?.enemyOnly)errors.push('pool: 未知或敌方专属兵种 '+k);else if(!_isNum(d.pool[k])||d.pool[k]<0)errors.push('pool.'+k+' 非法')}}
  if('queue' in d){if(!_isObj(d.queue))errors.push('queue 不是对象');else for(const k of Object.keys(d.queue)){const q=d.queue[k];if(!(k in CFG.units)||CFG.units[k]?.enemyOnly)errors.push('queue: 未知或敌方专属兵种 '+k);else if(!_isObj(q))errors.push('queue.'+k+' 不是对象');else{if(q.count!=null&&!_isNum(q.count))errors.push('queue.'+k+'.count 非法');if(q.timer!=null&&!_isNum(q.timer))errors.push('queue.'+k+'.timer 非法');}}}
  if('defeated' in d){if(!Array.isArray(d.defeated))errors.push('defeated 不是数组');else{const ids=new Set(CFG.enemies.map(e=>e.id));d.defeated.forEach(id=>{if(!_isInt(id)||!ids.has(id))errors.push('defeated: 未知或非法关卡 id');});}}
  if('upgradedUnits' in d){if(!_isObj(d.upgradedUnits))errors.push('upgradedUnits 不是对象');else for(const k of Object.keys(d.upgradedUnits))if(!(k in CFG.units)||CFG.units[k]?.enemyOnly)errors.push('upgradedUnits: 未知或敌方专属兵种 '+k)}
  if('essence' in d){if(!_isObj(d.essence))errors.push('essence 不是对象');else for(const k of Object.keys(d.essence)){if(!(k in CFG.essences))errors.push('essence: 未知精魄 '+k);else if(!_isNum(d.essence[k])||d.essence[k]<0)errors.push('essence.'+k+' 非法')}}
  if('townLv' in d&&(!_isInt(d.townLv)||d.townLv<1||d.townLv>CFG.town.length))errors.push('townLv 非法（超出城镇表范围）');
  if('merit' in d&&(!_isNum(d.merit)||d.merit<0))errors.push('merit 非法');
  if('tick' in d&&(!_isNum(d.tick)||d.tick<0))errors.push('tick 非法');
  if('garrisonLog' in d&&!Array.isArray(d.garrisonLog))errors.push('garrisonLog 不是数组');
  if('townUpgrade' in d&&d.townUpgrade!=null){if(!_isObj(d.townUpgrade))errors.push('townUpgrade 非法');else if(!_isNum(d.townUpgrade.timer))errors.push('townUpgrade.timer 非法')}
  if('garrison' in d&&d.garrison!=null){if(!_isObj(d.garrison))errors.push('garrison 不是对象');else{const g=d.garrison;if('phase' in g&&typeof g.phase!=='string')errors.push('garrison.phase 非法');for(const k of['phaseStarted','phaseUntil','cooldownUntil','nextCheckTick','seed'])if(k in g&&!_isNum(g[k]))errors.push('garrison.'+k+' 非法');}}
  // v=1 档必须字段齐全（由 serializeSave 保证）；legacy（无 v）允许缺字段，由迁移补齐；sciences 为上线后追加字段，不强制、由迁移补齐
  if(hasV){for(const k of Object.keys(_legacyDefaults()))if(k!=='sciences'&&!SAVE_V3_KEYS.includes(k)&&!(k in d))errors.push('缺少必需字段 '+k)}
  // v=2 起新增被动/货币资源键（IE-007）；v1 档缺键由迁移补齐
  if(hasV&&d.v>=2){for(const k of['copper','iron','coin'])if(!_isObj(d.res)||!(k in d.res))errors.push('res 缺少 v2 必需字段 '+k)}
  // v=3 起新增骨架字段（切片9：幂等记录/离线凭证/每日计数）；v2 档缺键由迁移补齐，缺失才算坏档
  if(hasV&&d.v>=3){
    for(const k of SAVE_V3_KEYS)if(!(k in d))errors.push('缺少 v3 必需字段 '+k);
    if('ops' in d){if(!Array.isArray(d.ops))errors.push('ops 不是数组');else{let n=0;for(const o of d.ops){n++;if(!_isObj(o)){errors.push('ops 项不是对象');break}if(typeof o.key!=='string'){errors.push('ops.key 非法');break}if(!_isNum(o.t)){errors.push('ops.t 非法');break}}if(n>200)errors.push('ops 条数超上限（200）')}}
    if('offline' in d){if(!_isObj(d.offline))errors.push('offline 不是对象');else{if('pendingReport' in d.offline&&d.offline.pendingReport!=null&&!_isObj(d.offline.pendingReport))errors.push('offline.pendingReport 非法');if('populationFoodRule' in d.offline&&!['legacy-pending','all'].includes(d.offline.populationFoodRule))errors.push('offline.populationFoodRule 非法')}}
    if('daily' in d){if(!_isObj(d.daily))errors.push('daily 不是对象');else{if('day' in d.daily&&d.daily.day!=null&&typeof d.daily.day!=='string')errors.push('daily.day 非法');if('counts' in d.daily){if(!_isObj(d.daily.counts))errors.push('daily.counts 不是对象');else for(const k of Object.keys(d.daily.counts)){if(!_isNum(d.daily.counts[k])||d.daily.counts[k]<0)errors.push('daily.counts.'+k+' 非法')}}}}
  }
  if(hasV&&d.v>=4){
    for(const k of['settlements','population'])if(!(k in d))errors.push('缺少 v4 必需字段 '+k);
    if(!_isObj(d.res)||!('deed' in d.res))errors.push('res 缺少 v4 必需字段 deed');
    if(_isObj(d.settlements)&&_isObj(d.population)&&_isCount(d.population.legacyBonus)){
      const capacity=Object.keys(CFG.settlements).reduce((n,key)=>n+(d.settlements[key]||0)*CFG.settlements[key].popPerLv, d.population.legacyBonus);
      if(!Number.isSafeInteger(capacity))errors.push('人口容量数值溢出');
    }
  }
  if('metalRecipeMode' in d&&!['coal','legacy'].includes(d.metalRecipeMode))errors.push('metalRecipeMode 非法');
  if(hasV&&d.v>=8&&'currencyRecipeMode' in d&&!['copper','legacy'].includes(d.currencyRecipeMode))errors.push('currencyRecipeMode 非法');
  if('storageMode' in d&&!['aligned','legacy'].includes(d.storageMode))errors.push('storageMode 非法');
  if(hasV&&d.v>=5){
    if(!_isObj(d.res)||!('coal' in d.res))errors.push('res 缺少 v5 必需字段 coal');
    if(!_isObj(d.popAlloc)||!('coal' in d.popAlloc))errors.push('popAlloc 缺少 v5 必需字段 coal');
    if(!('metalRecipeMode' in d))errors.push('缺少 v5 必需字段 metalRecipeMode');
  }
  if(hasV&&d.v>=6&&!('storageMode' in d))errors.push('缺少 v6 必需字段 storageMode');
  if(hasV&&d.v>=7&&!('townPolicies' in d))errors.push('缺少 v7 必需字段 townPolicies');
  if(hasV&&d.v>=8&&!('currencyRecipeMode' in d))errors.push('缺少 v8 必需字段 currencyRecipeMode');
  if(hasV&&d.v>=9){
    for(const k of['silver','silverCoin']){
      if(!_isObj(d.res)||!(k in d.res))errors.push('res 缺少 v9 必需字段 '+k);
      if(!_isObj(d.popAlloc)||!(k in d.popAlloc))errors.push('popAlloc 缺少 v9 必需字段 '+k);
    }
  }
  if(hasV&&d.v>=10){
    if(!_isObj(d.res)||!('gold' in d.res))errors.push('res 缺少 v10 必需字段 gold');
    if(!_isObj(d.popAlloc)||!('gold' in d.popAlloc))errors.push('popAlloc 缺少 v10 必需字段 gold');
  }
  if(hasV&&d.v>=11){
    if(!_isObj(d.res)||!('steel' in d.res))errors.push('res 缺少 v11 必需字段 steel');
    if(!_isObj(d.popAlloc)||!('steel' in d.popAlloc))errors.push('popAlloc 缺少 v11 必需字段 steel');
  }
  if(hasV&&d.v>=17&&(!_isObj(d.res)||!_isCount(d.res.medal)))errors.push('res.medal 非法或缺失');
  if(hasV&&d.v>=20&&(!_isObj(d.res)||!_isCount(d.res.bone)))errors.push('res.bone 非法或缺失');
  if(hasV&&d.v>=12&&(!_isCount(d.storageMasteryLv)||d.storageMasteryLv>CFG.storageMastery.maxLevel))errors.push('storageMasteryLv 非法、缺失或超出配置上限');
  if((hasV&&d.v>=18||'scholarMasteryLv' in d)&&(!_isCount(d.scholarMasteryLv)||d.scholarMasteryLv>CFG.scholarMastery.maxLevel))errors.push('scholarMasteryLv 非法、缺失或超出配置上限');
  if((hasV&&d.v>=21||'steelMasteryLv' in d)&&(!_isCount(d.steelMasteryLv)||d.steelMasteryLv>CFG.steelMastery.maxLevel))errors.push('steelMasteryLv 非法、缺失或超出配置上限');
  if(hasV&&d.v>=19||'weaponForge' in d){
    if(!_isObj(d.weaponForge))errors.push('weaponForge 非法或缺失');
    else{
      for(const key of Object.keys(d.weaponForge))if(!Object.prototype.hasOwnProperty.call(CFG.weaponForge,key))errors.push('weaponForge: 未知军备 '+key);
      for(const [key,cfg]of Object.entries(CFG.weaponForge)){
        const w=d.weaponForge[key];
        if(w===undefined&&hasV&&(d.v<22&&(key==='alloySword'||key==='alloyArmor')||d.v<24&&['electroRifle','electroSniper','electroArmor'].includes(key)||d.v<25&&['energyArmor','nanoArmor'].includes(key)||d.v<26&&['gatling','mortar','steamArmor'].includes(key)||['starFighter','starMissile'].includes(key)))continue;
        if(!_isObj(w)||Object.keys(w).some(field=>!['researched','level','progress','equipped'].includes(field))||typeof w.researched!=='boolean'||typeof w.equipped!=='boolean'||!_isCount(w.level)||w.level>cfg.maxLevel||!_isCount(w.progress)||w.progress>=weaponForgeSteps(key,w.level)||w.level===cfg.maxLevel&&w.progress!==0||w.equipped&&(!w.researched||w.level===0)||w.level>0&&!w.researched)errors.push('weaponForge.'+key+' 非法、缺失或超出配置上限');
      }
      if(d.weaponForge.alloyArmor?.researched&&!d.weaponForge.alloySword?.researched)errors.push('weaponForge.alloyArmor 缺少合金剑研发前置');
      for(const key of ['gatling','mortar','steamArmor','electroRifle','electroSniper','electroArmor','energyArmor','nanoArmor','starMissile']){
        const cfg=CFG.weaponForge[key];
        if(d.weaponForge[key]?.researched&&!d.weaponForge[cfg.needWeapon]?.researched)errors.push('weaponForge.'+key+' 缺少前置研发');
      }
    }
  }
  if(hasV&&d.v>=30||'armsUp' in d){
    if(!_isObj(d.armsUp))errors.push('armsUp 非法或缺失');
    else{
      for(const key of Object.keys(d.armsUp))if(!Object.prototype.hasOwnProperty.call(CFG.armsUp,key))errors.push('armsUp: 未知兵种 '+key);
      for(const [key,cfg]of Object.entries(CFG.armsUp)){
        const unit=d.armsUp[key];
        if(unit===undefined&&(key==='quantum_trooper'||hasV&&d.v<31&&key!=='electro_trooper'))continue;
        if(!_isObj(unit)||Object.keys(unit).some(stat=>!Object.prototype.hasOwnProperty.call(cfg.stats,stat))){errors.push('armsUp.'+key+' 非法或缺失');continue}
        for(const stat of Object.keys(cfg.stats)){
          const value=unit[stat];
          if(!_isObj(value)||Object.keys(value).some(field=>!['stars','progress'].includes(field))||!_isCount(value.stars)||!_isCount(value.progress)||value.progress>=cfg.stepsPerStar)
            errors.push('armsUp.'+key+'.'+stat+' 非法或缺失');
        }
      }
    }
  }
  if(hasV&&d.v>=13){
    if(!_isObj(d.eraStorage))errors.push('eraStorage 非法或缺失');
    else{
      for(const key of Object.keys(d.eraStorage))if(!Object.prototype.hasOwnProperty.call(CFG.eraStorage,key))errors.push('eraStorage: 未知研究 '+key);
      for(const [key,cfg] of Object.entries(CFG.eraStorage))if((key in d.eraStorage||!key.startsWith('quantum')&&!key.startsWith('nuclear')&&(d.v>=15||!key.startsWith('electric')))&&(!_isCount(d.eraStorage[key])||d.eraStorage[key]>cfg.maxLevel))errors.push('eraStorage.'+key+' 非法或缺失');
    }
    if(!_isObj(d.items))errors.push('items 非法或缺失');
    else{
      for(const key of Object.keys(d.items))if(!Object.prototype.hasOwnProperty.call(CFG.eraMaterials,key))errors.push('items: 未知道具 '+key);
      for(const [key,cfg] of Object.entries(CFG.eraMaterials))if((['revivalLeaf','trialFruit','sacredBlood','domainCleanser','emberElixir','aegisElixir'].includes(key)?key in d.items:key==='soulStone'?d.v>=33||key in d.items:CFG.beastExchange.scrollMaterials.slice(1).includes(key)?d.v>=29:key==='boarHeart'||key==='storageScroll'?d.v>=27:key==='godCore'?d.v>=23:d.v>=15||key==='godCrystal')&&!_isCount(d.items[key]))errors.push('items.'+key+' 非法或缺失');
    }
  }
  if('marketSpecial' in d){
    const x=d.marketSpecial,cfg=CFG.market.special;
    if(!_isObj(x)||Object.keys(x).some(key=>!['clockSec','offers','cycles'].includes(key))||
      !_isCount(x?.clockSec)||x.clockSec>cfg.refreshSec||!_isCount(x?.cycles)||
      !_isObj(x?.offers)||Object.keys(x.offers).some(key=>!Object.prototype.hasOwnProperty.call(cfg.goods,key))||
      Object.keys(cfg.goods).some(key=>(!['emberElixir','aegisElixir'].includes(key)||Object.prototype.hasOwnProperty.call(x.offers,key))&&(!_isCount(x.offers[key])||x.offers[key]>cfg.slots))||
      Object.keys(cfg.goods).reduce((sum,key)=>sum+(x.offers[key]??0),0)>cfg.slots)
      errors.push('marketSpecial 非法');
  }
  if('bloodline' in d){
    if(!_isObj(d.bloodline))errors.push('bloodline 非法');
    else for(const [unitType,uses] of Object.entries(d.bloodline)){
      if(!Object.prototype.hasOwnProperty.call(CFG.units,unitType)||CFG.units[unitType].enemyOnly||
        !_isCount(uses)||uses>CFG.bloodline.limitPerUnit)errors.push('bloodline.'+unitType+' 非法、未知兵种或超出使用上限');
    }
  }
  if('attackInfusions' in d){
    if(!_isObj(d.attackInfusions))errors.push('attackInfusions 非法');
    else for(const [unitType,uses] of Object.entries(d.attackInfusions)){
      if(!Object.prototype.hasOwnProperty.call(CFG.units,unitType)||CFG.units[unitType].enemyOnly||
        !_isCount(uses)||uses>CFG.emberElixir.limitPerUnit)errors.push('attackInfusions.'+unitType+' 非法、未知兵种或超出使用上限');
    }
  }
  if('aegisInfusions' in d){
    if(!_isObj(d.aegisInfusions))errors.push('aegisInfusions 非法');
    else for(const [unitType,uses] of Object.entries(d.aegisInfusions)){
      if(!Object.prototype.hasOwnProperty.call(CFG.units,unitType)||CFG.units[unitType].enemyOnly||
        !_isCount(uses)||uses>CFG.aegisElixir.limitPerUnit)errors.push('aegisInfusions.'+unitType+' 非法、未知兵种或超出使用上限');
    }
  }
  if(hasV&&d.v>=27){
    const x=d.beastExchange,cfg=CFG.beastExchange;
    if(!_isObj(x)||Object.keys(x).some(key=>!['level','progress','scrollUsed','heartOffers','heartQuality','refreshClock','refreshCharges','wildOffers','soulOffers','medalOffers','hideOffers'].includes(key))||
      !_isCount(x?.level)||x.level<1||x.level>cfg.maxLevel||
      !_isCount(x?.progress)||x.progress>beastExchangeProgressNeed(x.level)||
      !_isCount(x?.scrollUsed)||x.scrollUsed>cfg.scrollUseLimit)
      errors.push('beastExchange 非法或缺失');
    if(d.v>=28&&(!_isCount(x?.heartOffers)||x.heartOffers>cfg.maxOfferSlots||x.level<cfg.scrollLevel&&x.heartOffers!==0||
      ![10,50,80,100].includes(x?.heartQuality)||
      !_isCount(x?.refreshClock)||x.refreshClock>cfg.refreshSeconds||
      !_isCount(x?.refreshCharges)||x.refreshCharges>cfg.maxRefreshCharges))
      errors.push('beastExchange 刷新状态非法或缺失');
    if(d.v>=29){
      if(!_isObj(x?.wildOffers)||Object.keys(x.wildOffers).some(key=>!cfg.scrollMaterials.slice(1).includes(key)))errors.push('beastExchange.wildOffers 非法或缺失');
      else for(const key of cfg.scrollMaterials.slice(1)){
        const offer=x.wildOffers[key];
        if(!_isObj(offer)||Object.keys(offer).some(field=>!['count','quality'].includes(field))||
          !_isCount(offer?.count)||offer.count>cfg.maxOfferSlots||x.level<cfg.scrollLevel&&offer.count!==0||
          ![10,50,80,100].includes(offer?.quality))errors.push('beastExchange.wildOffers.'+key+' 非法或缺失');
      }
    }
    if(_isObj(x)&&'soulOffers' in x){
      if(!_isObj(x.soulOffers)||Object.keys(x.soulOffers).some(key=>!Object.prototype.hasOwnProperty.call(cfg.soulTrades,key)))
        errors.push('beastExchange.soulOffers 非法');
      else for(const key of Object.keys(cfg.soulTrades))
        if(!_isCount(x.soulOffers[key])||x.soulOffers[key]>cfg.maxOfferSlots||x.level<cfg.soulTradeLevel&&x.soulOffers[key]!==0)
          errors.push('beastExchange.soulOffers.'+key+' 非法或缺失');
    }
    if(_isObj(x)&&'medalOffers' in x&&(!_isCount(x.medalOffers)||x.medalOffers>cfg.maxOfferSlots||
      x.level<cfg.medalOfferTrade.level&&x.medalOffers!==0))errors.push('beastExchange.medalOffers 非法');
    if(_isObj(x)&&'hideOffers' in x){
      if(!_isObj(x.hideOffers)||Object.keys(x.hideOffers).some(key=>!Object.prototype.hasOwnProperty.call(cfg.hideTrades,key))||
        Object.keys(cfg.hideTrades).some(key=>{
          const offer=x.hideOffers[key];
          return !_isObj(offer)||Object.keys(offer).some(field=>!['count','quality'].includes(field))||
            !_isCount(offer.count)||offer.count>cfg.maxOfferSlots||![10,50,80,100].includes(offer.quality)
        })||Object.values(x.hideOffers).reduce((sum,offer)=>sum+(offer?.count||0),0)>beastOfferSlots(x.level))
        errors.push('beastExchange.hideOffers 非法');
    }
  }
  if('killValues' in d||hasV&&d.v>=14){
    if(!_isObj(d.killValues))errors.push('killValues 非法或缺失');
    else{
      for(const key of Object.keys(d.killValues))if(!['godRevival','godPhantom','godGuardian','godRebirth','godSilence','godSlaughter','soulRealm','wildBoar','wildBull','wildSnake','wildTiger','wildTurtle','wildWyrm'].includes(key))errors.push('killValues: 未知警戒值 '+key);
      if(!_isCount(d.killValues.godRevival))errors.push('killValues.godRevival 非法或缺失');
      if(d.v>=16)for(const key of ['godPhantom','godGuardian'])if(!_isCount(d.killValues[key]))errors.push('killValues.'+key+' 非法或缺失');
      if(d.v>=17&&!_isCount(d.killValues.godSlaughter))errors.push('killValues.godSlaughter 非法或缺失');
      if('godRebirth' in d.killValues&&!_isCount(d.killValues.godRebirth))errors.push('killValues.godRebirth 非法');
      if('godSilence' in d.killValues&&!_isCount(d.killValues.godSilence))errors.push('killValues.godSilence 非法');
      if((d.v>=33||'soulRealm' in d.killValues)&&!_isCount(d.killValues.soulRealm))errors.push('killValues.soulRealm 非法或缺失');
      if(d.v>=20&&!_isCount(d.killValues.wildBoar))errors.push('killValues.wildBoar 非法或缺失');
      if(d.v>=29)for(const key of ['wildBull','wildSnake','wildTiger','wildTurtle','wildWyrm'])if(!_isCount(d.killValues[key]))errors.push('killValues.'+key+' 非法或缺失');
    }
  }
  if('development' in d||hasV&&d.v>=32)validateDevelopmentState(d.development,errors);
  if('awakening' in d)validateAwakeningState(d.awakening,errors);
  if('soulRanks' in d||hasV&&d.v>=33)validateSoulRanks(d.soulRanks,errors);
  if('soulRealmTeam' in d){
    const team=d.soulRealmTeam;
    if(team!==null){
      if(!_isObj(team)||!_hasExactKeys(team,['day','slots'])||!_isCount(team.day)||
        !Array.isArray(team.slots)||team.slots.length!==CFG.soulRealm.slots)
        errors.push('soulRealmTeam 非法');
      else for(let i=0;i<team.slots.length;i++){
        const id=team.slots[i];
        if(!Object.prototype.hasOwnProperty.call(team.slots,i)||id!==null&&!CFG.soulRealm.tiers.some(t=>t.id===id))
          errors.push('soulRealmTeam.slots['+i+'] 非法');
      }
    }
  }
  // sciences（IE-008 资源科技，上线后追加字段）：存在才校验，缺键由迁移补齐（兼容已在线的 v2 旧档）
  if('sciences' in d){if(!Array.isArray(d.sciences))errors.push('sciences 不是数组');else for(const s of d.sciences){if(!sciIdKnown(s))errors.push('sciences: 未知科技 '+s)}}
  return{ok:errors.length===0,future:false,errors};
}
// 迁移只操作 JSON.parse 得到的独立候选对象；旧人口按当时版本口径还原，不回收分配。
function migrateSave(d){
  const filled=[];
  const sourceVersion=('v' in d)?d.v:0;
  if(!('v' in d)){
    const def=_legacyDefaults();
    for(const k of Object.keys(def))if(!(k in d)){d[k]=def[k];filled.push(k)}
  }
  if((d.v||1)<2){
    const nr=d.res||{};
    for(const k of['copper','iron','coin']){if(!(k in nr)){nr[k]=0;filled.push('res.'+k)}}
    d.res=nr;
    d.v=2;
    if(!('ts' in d))d.ts=Date.now();
  }
  if(!('sciences' in d)){d.sciences=[];filled.push('sciences')}
  // 地契是 v4 基本资源；旧功能开关不能使关闭后的存档丢字段。
  if(_isObj(d.res)&&!('deed' in d.res)){d.res.deed=0;filled.push('res.deed')}
  // 切片9：v3 骨架字段补齐（仅当目标版本为 v3）；可重复执行、不增删资源/兵力/进度
  if(targetSaveVersion()>=3&&(d.v||1)<3){
    if(!('ops' in d)){d.ops=[];filled.push('ops')}
    if(!('offline' in d)){d.offline={pendingReport:null};filled.push('offline')}
    if(!('daily' in d)){d.daily={day:null,counts:{}};filled.push('daily')}
    d.v=3;
  }
  if(sourceVersion<4){
    const oldCap=(CFG.town.find(t=>t.lv===d.townLv)||CFG.town[0]).maxPop;
    const allocation=Object.values(d.popAlloc).reduce((n,v)=>n+v,0);
    const p=CFG.pop;
    const derived=p.legacyBase+Math.floor(d.tick/10)*(p.legacyPer10sBase+p.legacyPer10sPerTown*d.townLv);
    const oldCurrent=sourceVersion>=3?Math.min(oldCap,derived):oldCap;
    if(!('settlements' in d)){d.settlements={village:0,smallTown:0,city:1};filled.push('settlements')}
    if(!('population' in d)){
      const current=Math.max(oldCap,oldCurrent,allocation);
      const initialCap=settlementCapacity(d.settlements);
      d.population={current,growthClock:0,legacyBonus:Math.max(0,oldCap-initialCap,current-initialCap)};
      filled.push('population');
    }
    d.v=4;
  }
  // 已生成的 v4 档也可能遵循旧岗位口粮规则，不能仅凭 schema 版本判断。
  if(_isObj(d.offline)&&!('populationFoodRule' in d.offline)){
    d.offline.populationFoodRule='legacy-pending';filled.push('offline.populationFoodRule');
  }
  if(sourceVersion<5){
    const nr=d.res||{},alloc=d.popAlloc||{};
    if(!('coal' in nr)){nr.coal=0;filled.push('res.coal')}
    if(!('coal' in alloc)){alloc.coal=0;filled.push('popAlloc.coal')}
    d.res=nr;d.popAlloc=alloc;
    const metalScience=(d.sciences||[]).some(id=>['sci_copper','sci_metal','sci_iron','sci_urbanization','sci_city','sci_mint','sci_coin'].includes(id));
    const metalBuilding=['mine','smelter'].some(key=>{
      const st=d.buildings?.[key];return st&&(st.lv>0||st.state&&st.state!=='idle');
    });
    const hasMetalProgress=(nr.copper||0)>0||(nr.iron||0)>0||(alloc.copper||0)>0||(alloc.iron||0)>0||metalScience||metalBuilding;
    if(!('metalRecipeMode' in d)){d.metalRecipeMode=hasMetalProgress?'legacy':'coal';filled.push('metalRecipeMode')}
    d.v=5;filled.push('v5');
  }
  if(sourceVersion<6){
    // v0–v5 从未定义分项仓容；即使旧文本带有同名扩展字段，也不能偷偷降仓。
    if(d.storageMode!=='legacy'){d.storageMode='legacy';filled.push('storageMode')}
    d.v=6;filled.push('v6');
  }
  if(sourceVersion<7){
    d.townPolicies={smallTown:[]};filled.push('townPolicies');
    d.v=7;filled.push('v7');
  }
  if(sourceVersion<8){
    d.currencyRecipeMode='legacy';filled.push('currencyRecipeMode');
    d.v=8;filled.push('v8');
  }
  if(sourceVersion<9){
    for(const k of['silver','silverCoin']){
      if(!(k in d.res)){d.res[k]=0;filled.push('res.'+k)}
      if(!(k in d.popAlloc)){d.popAlloc[k]=0;filled.push('popAlloc.'+k)}
    }
    d.v=9;filled.push('v9');
  }
  if(sourceVersion<10){
    if(!('gold' in d.res)){d.res.gold=0;filled.push('res.gold')}
    if(!('gold' in d.popAlloc)){d.popAlloc.gold=0;filled.push('popAlloc.gold')}
    d.v=10;filled.push('v10');
  }
  if(sourceVersion<11){
    if(!('steel' in d.res)){d.res.steel=0;filled.push('res.steel')}
    if(!('steel' in d.popAlloc)){d.popAlloc.steel=0;filled.push('popAlloc.steel')}
    d.v=11;filled.push('v11');
  }
  if(sourceVersion<12){
    d.storageMasteryLv=0;filled.push('storageMasteryLv');
    d.v=12;filled.push('v12');
  }
  if(sourceVersion<13){
    if(!('eraStorage' in d)){d.eraStorage={steamBasic:0,steamMetal:0,steamKnowledge:0};filled.push('eraStorage')}
    if(!('items' in d)){d.items={godCrystal:0};filled.push('items')}
    d.v=13;filled.push('v13');
  }
  if(sourceVersion<14){
    if(!('killValues' in d)){d.killValues={godRevival:0};filled.push('killValues')}
    d.v=14;filled.push('v14');
  }
  if(sourceVersion<15){
    for(const key of ['electricBasic','electricMetal','electricKnowledge','electricProduction'])if(!(key in d.eraStorage)){d.eraStorage[key]=0;filled.push('eraStorage.'+key)}
    for(const key of ['guardianStone','phantomFlower'])if(!(key in d.items)){d.items[key]=0;filled.push('items.'+key)}
    d.v=15;filled.push('v15');
  }
  if(sourceVersion<16){
    for(const key of ['godPhantom','godGuardian'])if(!(key in d.killValues)){d.killValues[key]=0;filled.push('killValues.'+key)}
    d.v=16;filled.push('v16');
  }
  if(sourceVersion<17){
    if(!('medal' in d.res)){d.res.medal=0;filled.push('res.medal')}
    if(!('godSlaughter' in d.killValues)){d.killValues.godSlaughter=0;filled.push('killValues.godSlaughter')}
    d.v=17;filled.push('v17');
  }
  if(sourceVersion<18){
    if(!('scholarMasteryLv' in d)){d.scholarMasteryLv=0;filled.push('scholarMasteryLv')}
    d.v=18;filled.push('v18');
  }
  if(sourceVersion<19){
    if(!('weaponForge' in d)){d.weaponForge={armored:{researched:false,level:0,progress:0,equipped:false},electro:{researched:false,level:0,progress:0,equipped:false}};filled.push('weaponForge')}
    d.v=19;filled.push('v19');
  }
  if(sourceVersion<20){
    if(!('bone' in d.res)){d.res.bone=0;filled.push('res.bone')}
    if(!('wildBoar' in d.killValues)){d.killValues.wildBoar=0;filled.push('killValues.wildBoar')}
    d.v=20;filled.push('v20');
  }
  if(sourceVersion<21){
    if(!('steelMasteryLv' in d)){d.steelMasteryLv=0;filled.push('steelMasteryLv')}
    d.v=21;filled.push('v21');
  }
  if(sourceVersion<22){
    for(const key of ['alloySword','alloyArmor'])if(!(key in d.weaponForge)){
      d.weaponForge[key]={researched:false,level:0,progress:0,equipped:false};filled.push('weaponForge.'+key)
    }
    d.v=22;filled.push('v22');
  }
  if(sourceVersion<23){
    if(!('godCore' in d.items)){d.items.godCore=0;filled.push('items.godCore')}
    d.v=23;filled.push('v23');
  }
  if(sourceVersion<24){
    for(const key of ['electroRifle','electroSniper','electroArmor'])if(!(key in d.weaponForge)){
      d.weaponForge[key]={researched:false,level:0,progress:0,equipped:false};filled.push('weaponForge.'+key)
    }
    d.v=24;filled.push('v24');
  }
  if(sourceVersion<25){
    for(const key of ['energyArmor','nanoArmor'])if(!(key in d.weaponForge)){
      d.weaponForge[key]={researched:false,level:0,progress:0,equipped:false};filled.push('weaponForge.'+key)
    }
    d.v=25;filled.push('v25');
  }
  if(sourceVersion<26){
    for(const key of ['gatling','mortar','steamArmor'])if(!(key in d.weaponForge)){
      d.weaponForge[key]={researched:false,level:0,progress:0,equipped:false};filled.push('weaponForge.'+key)
    }
    d.v=26;filled.push('v26');
  }
  if(sourceVersion<27){
    for(const key of ['boarHeart','storageScroll'])if(!(key in d.items)){d.items[key]=0;filled.push('items.'+key)}
    if(!('beastExchange' in d)){d.beastExchange={level:1,progress:0,scrollUsed:0};filled.push('beastExchange')}
    d.v=27;filled.push('v27');
  }
  if(sourceVersion<28){
    for(const [key,value] of Object.entries({heartOffers:0,heartQuality:100,refreshClock:1200,refreshCharges:5}))
      if(!(key in d.beastExchange)){d.beastExchange[key]=value;filled.push('beastExchange.'+key)}
    d.v=28;filled.push('v28');
  }
  if(sourceVersion<29){
    for(const key of CFG.beastExchange.scrollMaterials.slice(1))if(!(key in d.items)){d.items[key]=0;filled.push('items.'+key)}
    for(const key of ['wildBull','wildSnake','wildTiger','wildTurtle','wildWyrm'])if(!(key in d.killValues)){d.killValues[key]=0;filled.push('killValues.'+key)}
    if(!('wildOffers' in d.beastExchange)){d.beastExchange.wildOffers=defaultWildOffers();filled.push('beastExchange.wildOffers')}
    d.v=29;filled.push('v29');
  }
  if(sourceVersion<30){
    if(!('armsUp' in d)){
      d.armsUp={electro_trooper:{atk:{stars:0,progress:0},hp:{stars:0,progress:0},def:{stars:0,progress:0}}};
      filled.push('armsUp');
    }
    d.v=30;filled.push('v30');
  }
  if(sourceVersion<31){
    const defaults=defaultArmsUpState();
    for(const key of Object.keys(defaults))if(!(key in d.armsUp)){
      d.armsUp[key]=defaults[key];filled.push('armsUp.'+key);
    }
    d.v=31;filled.push('v31');
  }
  if(sourceVersion<32){
    if(!('development' in d)){d.development=defaultDevelopmentState();filled.push('development')}
    d.v=32;filled.push('v32');
  }
  for(const key of ['starFighter','starMissile'])if(!(key in d.weaponForge)){
    d.weaponForge[key]={researched:false,level:0,progress:0,equipped:false};filled.push('weaponForge.'+key);
  }
  // v32 既有档尚无量子兵装；仅在候选数据补默认值，写回前保留迁移前原文。
  if(!('quantum_trooper' in d.armsUp)){
    d.armsUp.quantum_trooper=defaultArmsUpState().quantum_trooper;
    filled.push('armsUp.quantum_trooper');
  }
  // v32 原档还没有星核四项及圣愈叶；同版本增量仅在候选数据补零并保护原文。
  for(const key of ['nuclearBasic','nuclearMetal','nuclearKnowledge','nuclearProduction'])if(!(key in d.eraStorage)){d.eraStorage[key]=0;filled.push('eraStorage.'+key)}
  for(const key of ['quantumBasic','quantumMetal','quantumKnowledge','quantumProduction'])if(!(key in d.eraStorage)){d.eraStorage[key]=0;filled.push('eraStorage.'+key)}
  if(!('revivalLeaf' in d.items)){d.items.revivalLeaf=0;filled.push('items.revivalLeaf')}
  if(!('godRebirth' in d.killValues)){d.killValues.godRebirth=0;filled.push('killValues.godRebirth')}
  if(!('trialFruit' in d.items)){d.items.trialFruit=0;filled.push('items.trialFruit')}
  if(!('godSilence' in d.killValues)){d.killValues.godSilence=0;filled.push('killValues.godSilence')}
  if(!('awakening' in d)){d.awakening=defaultAwakeningState();filled.push('awakening')}
  // 母本铸金币岗位晚接入 v32；旧档在独立候选数据上补零并保留原始文本。
  if(!('goldCoin' in d.res)){d.res.goldCoin=0;filled.push('res.goldCoin')}
  if(!('goldCoin' in d.popAlloc)){d.popAlloc.goldCoin=0;filled.push('popAlloc.goldCoin')}
  for(const key of ['sacredBlood','domainCleanser','emberElixir','aegisElixir'])if(!(key in d.items)){d.items[key]=0;filled.push('items.'+key)}
  if(!('bloodline' in d)){d.bloodline={};filled.push('bloodline')}
  if(!('attackInfusions' in d)){d.attackInfusions={};filled.push('attackInfusions')}
  if(!('aegisInfusions' in d)){d.aegisInfusions={};filled.push('aegisInfusions')}
  if(!('marketSpecial' in d)){d.marketSpecial=defaultMarketSpecialState();filled.push('marketSpecial')}
  else if(!Object.prototype.hasOwnProperty.call(d.marketSpecial.offers,'emberElixir')){d.marketSpecial.offers.emberElixir=0;filled.push('marketSpecial.offers.emberElixir')}
  if(!Object.prototype.hasOwnProperty.call(d.marketSpecial.offers,'aegisElixir')){d.marketSpecial.offers.aegisElixir=0;filled.push('marketSpecial.offers.aegisElixir')}
  // v32 增量：旧主档可缺这三项，新写出的主档必须具备；候选迁移与原文保护仍走统一加载路径。
  if(!('soulStone' in d.items)){d.items.soulStone=0;filled.push('items.soulStone')}
  if(!('soulRealm' in d.killValues)){d.killValues.soulRealm=0;filled.push('killValues.soulRealm')}
  if(!('soulRanks' in d)){d.soulRanks=defaultSoulRanks();filled.push('soulRanks')}
  if(!('soulRealmTeam' in d)){d.soulRealmTeam=null;filled.push('soulRealmTeam')}
  if(!('soulOffers' in d.beastExchange)){d.beastExchange.soulOffers=defaultSoulOffers();filled.push('beastExchange.soulOffers')}
  if(!('medalOffers' in d.beastExchange)){d.beastExchange.medalOffers=0;filled.push('beastExchange.medalOffers')}
  // 同版旧档在独立候选中补新增兽皮及货位，不追发历史狩猎收益。
  if(!('hide' in d.res)){d.res.hide=0;filled.push('res.hide')}
  if(!('hideOffers' in d.beastExchange)){d.beastExchange.hideOffers=defaultHideOffers();filled.push('beastExchange.hideOffers')}
  return{d,migrated:filled.length>0,filled};
}
// 应用到 S：显式逐字段，不再使用 || 吞合法 0；默认对象全部独立新建
function applySaveToS(d){
  S.res=d.res;S.buildings=d.buildings;S.pool=d.pool;S.queue=d.queue;S.formation=d.formation;S.townLv=d.townLv;S.popAlloc=d.popAlloc;S.metalRecipeMode=d.metalRecipeMode;S.currencyRecipeMode=d.currencyRecipeMode;S.storageMode=d.storageMode;S.storageMasteryLv=d.storageMasteryLv;S.scholarMasteryLv=d.scholarMasteryLv;S.steelMasteryLv=d.steelMasteryLv;S.weaponForge=d.weaponForge;S.armsUp=d.armsUp;S.awakening=d.awakening;S.soulRanks=d.soulRanks;S.soulRealmTeam=d.soulRealmTeam;S.eraStorage=d.eraStorage;S.items=d.items;S.bloodline=d.bloodline;S.attackInfusions=d.attackInfusions;S.aegisInfusions=d.aegisInfusions;S.marketSpecial=d.marketSpecial;S.beastExchange=d.beastExchange;S.killValues=d.killValues;S.development=d.development;S.settlements=d.settlements;S.townPolicies=d.townPolicies;S.population=d.population;S.defeated=d.defeated;S.merit=d.merit;S.garrisonLog=d.garrisonLog;S.garrison=d.garrison;S.tick=d.tick;S._garrisonForm=d.garrisonForm;S.townUpgrade=d.townUpgrade;S.upgradedUnits=d.upgradedUnits;S.essence=d.essence;S.sciences=d.sciences||[];
  S.ops=Array.isArray(d.ops)?d.ops:[];S.offline=_isObj(d.offline)?d.offline:{pendingReport:null,populationFoodRule:'all'};S.daily=(d.daily&&typeof d.daily==='object')?d.daily:{day:null,counts:{}};
  if(typeof ensureGarrisonState==='function')ensureGarrisonState();
}
function readRawKey(key){try{const t=localStorage.getItem(key);return{ok:true,text:t}}catch(e){return{ok:false,err:'存储读取失败'}}}
function writeRawKey(key,text){try{localStorage.setItem(key,text);return{ok:true}}catch(e){return{ok:false,err:'存储写入失败（可能已满）'}}}
function _isGoodText(t){if(t==null)return false;try{return validateSave(JSON.parse(t)).ok}catch(e){return false}}
// 轮转备份：仅当主档内容自身有效时才进备份槽；损坏内容绝不挤掉已有有效备份
function backUpMaster(){
  const cur=readRawKey(SAVE_KEY);if(!cur.ok)return{ok:false,stage:'backup',reason:cur.err};
  if(!_isGoodText(cur.text))return{ok:true,skipped:true};
  const b1=readRawKey(BACKUP_KEYS[0]);
  if(!b1.ok)return{ok:false,stage:'backup',reason:b1.err};
  if(b1.ok&&_isGoodText(b1.text)){const c=writeRawKey(BACKUP_KEYS[1],b1.text);if(!c.ok)return{ok:false,stage:'backup',reason:c.err}}
  const w=writeRawKey(BACKUP_KEYS[0],cur.text);if(!w.ok)return{ok:false,stage:'backup',reason:w.err};
  return{ok:true};
}
// ==================== 诊断环形日志（切片2 基建 · 仅内存 / 不入档 / 零上报）====================
// 用途：离线结算、幂等、迁移等关键路径的失败与异常可观测；容量受 CFG.diag.max 限制。
const _DIAG_MAX=(typeof CFG!=='undefined'&&CFG.diag&&CFG.diag.max)||50;
let _diagRing=[];
function logDiag(tag,msg){
  try{
    if(typeof CFG!=='undefined'&&CFG.diag&&CFG.diag.enabled===false)return _diagRing.length;
    _diagRing.push({t:Date.now(),tag:String(tag==null?'':tag),msg:String(msg==null?'':msg)});
    if(_diagRing.length>_DIAG_MAX)_diagRing.splice(0,_diagRing.length-_DIAG_MAX);
  }catch(e){}
  return _diagRing.length;
}
function diagSnapshot(){try{return _diagRing.slice()}catch(e){return []}}
function diagClear(){_diagRing=[];return 0}

// ==================== 幂等层（切片10 · S4）====================
// 语义：同一 opKey 在窗口（默认 5s）内重复提交 → 返回既有结果，不重复扣费/发奖；记录入 S.ops（v3，环形 ≤ max）
// 口径：优先复用既有互斥屏障（如建筑 state!=='idle'），本层只覆盖"无天然屏障"的操作（研究/兵种解锁/导入/恢复）
function idemActive(){return !!(CFG.idem&&CFG.idem.enabled)}
function idemKey(type,target){return type+':'+String(target)}
function strHash(s){let h=5381;const t=String(s==null?'':s);for(let i=0;i<t.length;i++)h=((h<<5)+h+t.charCodeAt(i))|0;return (h>>>0).toString(36)}
function idemSeen(key){try{const w=(CFG.idem&&CFG.idem.windowMs)||5000,now=Date.now();return (Array.isArray(S.ops)?S.ops:[]).some(o=>o&&o.key===key&&(now-(o.t||0))<w)}catch(e){return false}}
function idemMark(key){
  if(!idemActive())return;
  try{
    const now=Date.now(),w=(CFG.idem&&CFG.idem.windowMs)||5000,max=(CFG.idem&&CFG.idem.max)||200;
    S.ops=Array.isArray(S.ops)?S.ops:[];
    S.ops=S.ops.filter(o=>o&&typeof o.t==='number'&&(now-o.t)<Math.max(w,60000)); // 窗口外清理（留 60s 观察期）
    S.ops.push({key,t:now});
    if(S.ops.length>max)S.ops.splice(0,S.ops.length-max);
  }catch(e){}
}
function idemRepeat(type,target){   // 命中返回 true（调用方应直接返回既有结果）
  if(!idemActive())return false;
  const k=idemKey(type,target);
  if(idemSeen(k)){if(typeof logDiag==='function')logDiag('idem-repeat',k);return true}
  return false;
}

function _warnUnsaved(reason){const now=Date.now();if(now-_lastSaveWarn>30000){_lastSaveWarn=now;logDiag('save-fail',reason);if(typeof toast==='function')toast('保存失败：'+reason+'，原存档未被改动')}}
function writeSave(text){
  if(_saveProtected)return{ok:false,stage:'protected'};
  const b=backUpMaster();if(!b.ok){_warnUnsaved(b.reason||'备份无法写入');return{ok:false,stage:'backup'}}
  const w=writeRawKey(SAVE_KEY,text);if(!w.ok){_warnUnsaved(w.err);return{ok:false,stage:'write'}}
  return{ok:true};
}
function save(){
  if(_saveProtected)return{ok:false,stage:'protected'};
  // 直接调用 loadSaveAndApply() 的入口也不能以普通保存吞掉待结算的旧窗口。
  if(S.offline?.populationFoodRule==='legacy-pending'){
    const transition=settleOffline();
    if(_saveProtected||S.offline?.populationFoodRule==='legacy-pending')return{ok:false,stage:'transition',reason:transition.reason};
    // 结算或短窗检查点已把当前 S 原子写入；不能再写第二次，避免第二次失败后动作回滚与主档分叉。
    return{ok:true,transition:true};
  }
  const data=serializeSave();
  // 启动入口先处理历史窗口；之后任何普通在线保存都以新口粮规则为准。
  data.offline.populationFoodRule='all';
  const written=writeSave(JSON.stringify(data));
  if(written.ok){_loadedTs=data.ts;if(_isObj(S.offline))S.offline.populationFoodRule='all'} // 同页再次后台恢复时，从最近一次成功落盘时刻续算
  return written;
}
function enterProtection(reason){_saveProtected=true;_saveProtectReason=reason;if(typeof addLog==='function')addLog('存档保护：'+reason);if(typeof toast==='function')toast('存档保护模式：'+reason)}
// 启动加载：读原文→解析/校验/迁移在候选对象上完成→备份→才提交使用；一切失败路径保持主档原样并进入保护
function loadSaveAndApply(){
  const r=readRawKey(SAVE_KEY);
  if(!r.ok){enterProtection('存储不可读，本轮不会尝试读写主档');return{status:'storage_error'}}
  if(r.text==null)return{status:'fresh'}; // 无档≠坏档
  let p=null;try{p=JSON.parse(r.text)}catch(e){enterProtection('主档解析失败（损坏档），原文已保留可导出');return{status:'corrupt'}}
  const v=validateSave(p);
  if(!v.ok){enterProtection(v.future?v.errors[0]:'主档校验失败：'+v.errors.slice(0,3).join('；'));return{status:v.future?'future':'invalid',errors:v.errors}}
  const m=migrateSave(p);
  const migratedCheck=validateSave(m.d);
  if(!migratedCheck.ok){enterProtection('迁移候选校验失败：'+migratedCheck.errors.slice(0,3).join('；'));return{status:'invalid',errors:migratedCheck.errors}}
  if(m.migrated){
    const pre=writeRawKey(PRE_MIGRATION_KEY,r.text);
    if(!pre.ok){enterProtection('无法写入迁移前原始副本，已终止格式升级（本会话只读）');return{status:'migrated_readonly'}}
    const w=writeSave(JSON.stringify(m.d));
    if(!w.ok){enterProtection('迁移后主档写入失败（'+(w.stage==='backup'?'备份失败':'存储写入失败')+'），主档保持原样（本会话只读）');return{status:'migrated_readonly'}}
  }
  applySaveToS(m.d);
  _loadedTs=(typeof m.d.ts==='number'&&Number.isFinite(m.d.ts))?m.d.ts:null;   // 切片11：记录本次加载的存档时间戳（离线结算基准）
  return{status:m.migrated?'migrated':'ok',filled:m.filled};
}
function load(){loadSaveAndApply()}

// 同一秒的资源结算：在线和离线共用，返回候选库存而不修改 S。
// ratio 作用于岗位产出、加工原料和口粮；ignoreCaps 仅用于显示当前净速率。
function metalConsumeMap(rk){
  if(rk==='coin'&&S.currencyRecipeMode==='copper')return{copper:CFG.currency.copperPerWorkerCost};
  if(S.metalRecipeMode==='coal'&&CFG.metalChain?.recipes?.[rk])return CFG.metalChain.recipes[rk];
  return CFG.res[rk]?.consumes||null;
}
function productionSecond(ratio=1,ignoreCaps=false,populationFoodRule='all',offlineCache=null){
  const next={...S.res};
  for(const rk of Object.keys(CFG.res)){
    if(rk==='deed')continue;
    const before=next[rk]||0;
    const limit=ignoreCaps?Infinity:Math.max(before,offlineCache?offlineCache.caps[rk]:resCap(rk)); // 旧档超上限库存保留
    let output=(offlineCache?offlineCache.rates[rk]:prodRate(rk))*ratio;
    if(rk==='food'){
      const foodPopulation=populationFoodRule==='legacy-pending'?popAllocTotal():popCurrent();
      const expense=(totalUpkeep()+foodPopulation*(CFG.popFoodCost??0.1))*ratio;
      next.food=Math.min(limit,before-expense+output);
      continue;
    }
    const cons=metalConsumeMap(rk);
    if(cons&&output>0){
      const possible=Math.min(output,Math.max(0,limit-before));
      const fraction=possible/output;
      const bk=CFG.res[rk].workerBuilding;
      const coalRecipe=S.metalRecipeMode==='coal'&&CFG.metalChain?.recipes?.[rk];
      const costs=Object.entries(cons).map(([ck,raw])=>[ck,(coalRecipe?raw:((bk&&effConsume(bk,ck))??raw))*(S.popAlloc[rk]||0)*ratio*fraction]);
      if(costs.every(([ck,amount])=>(next[ck]||0)+1e-9>=amount)){
        for(const[ck,amount]of costs)next[ck]=Math.max(0,(next[ck]||0)-amount);
        output=possible;
      }else output=0;
    }
    next[rk]=Math.min(limit,before+output);
  }
  return next;
}
// 点位采集与岗位配方分开结算：同一候选资源图内入仓，只有当前激活的一处每满周期发放。
function productionAndDevelopmentSecond(ratio=1,populationFoodRule='all',allowDevelopmentCollection=true,offlineCache=null){
  const res=productionSecond(ratio,false,populationFoodRule,offlineCache);
  const development=S.development,collection=development.border.collection;
  const key=collection.activeSite;
  if(key===null||!allowDevelopmentCollection)return{res,development,collected:false};
  const elapsed=collection.elapsedSec+1;
  const cycles=Math.floor(elapsed/CFG.developmentCollection.periodSec);
  const nextCollection={...collection,elapsedSec:elapsed%CFG.developmentCollection.periodSec};
  const nextDevelopment={...development,border:{...development.border,collection:nextCollection}};
  if(cycles===0)return{res,development:nextDevelopment,collected:false};
  const before=res[key]||0,limit=Math.max(before,offlineCache?offlineCache.caps[key]:resCap(key));
  const level=development.border.sites[key].level;
  const offered=level*CFG.developmentCollection.yieldPerLevel[key]*cycles*ratio;
  res[key]=Math.min(limit,before+Math.max(0,offered));
  return{res,development:nextDevelopment,collected:true,resource:key,beforeResource:before,gained:res[key]-before};
}
// 点位取得/升级属于未来独立战斗结算；此动作只选择已拥有的唯一自动采集点。
function selectDevelopmentSite(key){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const blocked=saveOpsBlocked();if(blocked)return{ok:false,reason:'busy'};
  if(key!==null&&!Object.prototype.hasOwnProperty.call(CFG.developmentCollection.yieldPerLevel,key))return{ok:false,reason:'unknown-site'};
  if(key!==null&&S.development.border.sites[key].level<1)return{ok:false,reason:'site-locked'};
  if(S.development.border.collection.activeSite===key)return{ok:true,unchanged:true,activeSite:key};
  // 老档待结算窗口先封口，否则新选择会追溯到此前离线时间。
  if(S.offline?.populationFoodRule==='legacy-pending'){
    settleOffline();
    if(_saveProtected||S.offline?.populationFoodRule==='legacy-pending')return{ok:false,reason:'offline-transition'};
  }
  const before=S.development;
  S.development={...before,border:{...before.border,collection:{...before.border.collection,activeSite:key,elapsedSec:0}}};
  const written=save();
  if(!written.ok){S.development=before;return{ok:false,reason:'save-failed',stage:written.stage}}
  if(typeof updateUI==='function')updateUI();
  return{ok:true,activeSite:key};
}
function potentialFoodCostSecond(ratio=1,populationFoodRule='all'){
  let queuedCount=0,queuedUpkeep=0,queuedFood=0;
  for(const[uk,q]of Object.entries(S.queue)){
    if(!q||!q.count||!CFG.units[uk])continue;
    const tt=CFG.units[uk].trainTime||CFG.unitTrainTime||1;
    const perTick=tt<1?Math.round(1/tt):q.timer<=1?1:0;
    const n=Math.min(perTick,q.count),unit=CFG.units[uk];
    queuedCount+=n;
    queuedUpkeep+=(unit.upkeep||0)*n;
    queuedFood+=(unit.cost.food||0)*n;
  }
  // 队列在本秒产兵后，新增兵及原有兵都可能跨入更高军粮档。
  let cost=queuedFood+(rawUpkeep()+queuedUpkeep)*upkeepBandFactor(armyCount()+queuedCount);
  cost+=(populationFoodRule==='legacy-pending'?popAllocTotal():popCurrent())*(CFG.popFoodCost??0.1);
  for(const rk of Object.keys(CFG.res)){
    const raw=metalConsumeMap(rk)?.food;
    if(raw){const bk=CFG.res[rk].workerBuilding;cost+=((bk&&effConsume(bk,'food'))??raw)*(S.popAlloc[rk]||0)}
  }
  return queuedFood+(cost-queuedFood)*Math.max(0,ratio);
}

// ==================== 离线结算（切片11 · 规格 S2 / C1 裁决 0.6-24h-120s）====================
// 触发：启动加载完成后 1 次 + 回前台 1 次（ui.js 调用）；幂等：同 (ts, 结算时刻口径) 只结一次
// 规则：delta=clamp(now−ts,0,capSec)，delta<minSec 不结；逐秒按在线规则推进资源，ratio 作用于生产与消耗。
//       断粮前截断；不结算战功/精魄/关卡进度/战斗，报告写入 S.offline.pendingReport。
function offlineNetRates(){
  // 旧档启动结算前仅用于预览该历史窗口；启动完成后的在线界面始终是 all。
  const next=productionSecond(1,true,S.offline?.populationFoodRule??'all');
  const rates={};
  for(const rk of Object.keys(CFG.res))rates[rk]=(next[rk]||0)-(S.res[rk]||0);
  return rates;
}
function offlineDeltaSec(now,lastTs){
  const o=CFG.offline||{};
  const raw=Math.floor(((now??Date.now())-(lastTs??0))/1000);
  if(!Number.isFinite(raw)||raw<=0)return{delta:0,raw:raw||0,reason:'时钟回拨或时间戳缺失'};
  const cap=o.capSec||86400;
  const delta=Math.min(raw,cap);
  return{delta,raw,truncated:raw>cap,reason:raw>cap?'超过封顶时长已截断':''};
}
// 旧档无可结算历史窗口时，先持久化切换点，再允许在线 tick 使用新口粮规则。
function checkpointPopulationFoodRule(reason,now){
  const beforeState=JSON.parse(JSON.stringify(S));
  S.offline.populationFoodRule='all';
  const data=serializeSave();
  data.ts=now;
  const written=writeSave(JSON.stringify(data));
  if(!written.ok){
    S=beforeState;
    enterProtection('人口口粮规则切换点写入失败（'+(written.stage==='backup'?'备份失败':'主档写入失败')+'），本会话暂停推进；原档可导出');
    return{ok:false,reason:'save-failed',stage:written.stage};
  }
  _loadedTs=data.ts;
  return{ok:false,reason,checkpoint:true};
}
function settleOffline(){
  const o=CFG.offline||{};
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const legacyPending=S.offline?.populationFoodRule==='legacy-pending';
  if(!o.enabled)return legacyPending?checkpointPopulationFoodRule('offline-disabled',Date.now()):{ok:false,reason:'offline-disabled'};
  if(_loadedTs==null)return legacyPending?checkpointPopulationFoodRule('no-save-ts',Date.now()):{ok:false,reason:'no-save-ts'}; // 新档/未加载档：不结算
  const now=Date.now();
  const {delta,raw,truncated,reason}=offlineDeltaSec(now,_loadedTs);
  if(!legacyPending&&_offlineSettledFor===_loadedTs&&raw>=0&&delta<(o.minSec||120))return{ok:true,repeat:true};
  if(raw<=0)return legacyPending?checkpointPopulationFoodRule(reason,now):{ok:false,reason:reason,delta:0}; // 时钟回拨/缺时间戳：明确原因
  if(delta<(o.minSec||120))return legacyPending?checkpointPopulationFoodRule('below-min',now):{ok:false,reason:'below-min',delta};
  // 持久化 pending 比历史 ops 记录更权威；旧档欠结算不能被碰巧同名的旧幂等键跳过。
  if(!legacyPending&&typeof idemRepeat==='function'&&idemRepeat('offline',String(_loadedTs)))return{ok:true,repeat:true};
  const ratio=(typeof o.ratio==='number')?o.ratio:0.6;
  const beforeState=JSON.parse(JSON.stringify(S));
  const beforeRes={...S.res};
  const adv=offlineAdvanceSec(delta,ratio,legacyPending?'legacy-pending':'all');
  const secs=adv.elapsed,foodClamped=adv.foodClamped;
  const gains={};
  for(const rk of Object.keys(CFG.res)){
    const d=(S.res[rk]||0)-(beforeRes[rk]||0);
    if(d!==0)gains[rk]=d;
  }
  S.offline=S.offline||{pendingReport:null};
  S.offline.pendingReport={at:now,durationSec:secs,rawSec:raw,truncated:!!truncated||foodClamped,reason:reason||(foodClamped?'食物不足已按可支付秒数截断':''),gains,advance:adv,populationFoodRule:legacyPending?'legacy':'all'};
  S.offline.populationFoodRule='all';
  if(typeof idemMark==='function')idemMark(idemKey('offline',String(_loadedTs)));
  // 只在全部推演完成后写一次主档；写入失败时恢复内存状态并允许重试。
  const data=serializeSave();
  const written=writeSave(JSON.stringify(data));
  if(!written.ok){
    S=beforeState;
    if(legacyPending)enterProtection('历史离线口粮结算写入失败（'+(written.stage==='backup'?'备份失败':'主档写入失败')+'），本会话暂停推进；原档可导出');
    return{ok:false,reason:'save-failed',stage:written.stage};
  }
  _loadedTs=data.ts;
  _offlineSettledFor=data.ts;
  if(typeof logDiag==='function')logDiag('offline',`Δ${secs}s ratio${ratio} gains=${Object.keys(gains).length}`);
  return{ok:true,durationSec:secs,gains,truncated:!!truncated||foodClamped};
}
function dismissOfflineReport(){if(S.offline)S.offline.pendingReport=null;if(typeof save==='function')save();if(typeof updateUI==='function')updateUI();}

// 离线逐秒推进：建筑完工后才能产出，队列按真实资源扣费；驻军冻结。
function offlineAdvanceSec(secs,ratio=1,populationFoodRule='all'){
  const o=CFG.offline||{};
  if(!o.enabled||!(secs>0))return{advanced:false,reason:'disabled-or-zero',elapsed:0,foodClamped:false};
  let elapsed=0,produced=0,due=0,foodClamped=false;
  const events=[];
  // 离线窗口内岗位与仓容只会在建筑或城镇完工时变化；每秒仍按实时库存结算配方和口粮。
  const makeProductionCache=()=>{
    const rates={},caps={};
    for(const rk of Object.keys(CFG.res)){
      if(rk==='deed')continue;
      rates[rk]=prodRate(rk);
      caps[rk]=resCap(rk);
    }
    return{rates,caps};
  };
  let productionCache=makeProductionCache();
  for(let i=0;i<secs;i++){
    // 粮食库存接近本秒最大支出时保留候选状态，断粮时回退该秒的建筑与训练变化。
    const potential=potentialFoodCostSecond(ratio,populationFoodRule);
    const previous=potential>0&&(S.res.food||0)<=potential?JSON.parse(JSON.stringify(S)):null;
    const poolBefore=Object.values(S.pool).reduce((n,v)=>n+(v||0),0);
    const beforeTown=S.townLv;
    const beforeBuildings=Object.keys(CFG.buildings).reduce((n,k)=>n+(bldSt(k).state==='idle'?0:1),0);
    if(o.advance){
      if(advanceBuildingsBy(1))productionCache=makeProductionCache();
      processQueue(false);
    }
    // 点位沿同一60秒时钟逐秒推进；离线产量按岗位共用的系数折算，断粮时回退未计入的一秒。
    const candidate=productionAndDevelopmentSecond(ratio,populationFoodRule,!S.battleActive,productionCache);
    const next=candidate.res;
    if(next.food < -1e-9){
      if(previous)S=previous;
      foodClamped=true;
      break;
    }
    next.food=Math.max(0,next.food);
    S.res=next;
    S.development=candidate.development;
    S.tick++;
    advanceMarketSpecialSecond();
    elapsed++;
    if(o.advance){
      produced+=Math.max(0,Object.values(S.pool).reduce((n,v)=>n+(v||0),0)-poolBefore);
      const afterBuildings=Object.keys(CFG.buildings).reduce((n,k)=>n+(bldSt(k).state==='idle'?0:1),0);
      due+=Math.max(0,beforeBuildings-afterBuildings)+(S.townLv>beforeTown?1:0);
    }
  }
  if(due)events.push('建筑/城镇完成 '+due+' 项');
  if(produced)events.push('队列产出 '+produced+' 兵');
  return{advanced:!!o.advance,events,produced,due,elapsed,foodClamped};
}
// ============ 存档管理（导出/导入/恢复/重置）：逻辑在此，UI 只做接线，供测试直接调用真实实现 ============
// 异步回写闸口：远征/训练（行动回调、待重开回调及活动标志）、驻军状态机活跃相位
function saveOpsBlocked(){
  if(typeof S!=='undefined'&&S.battleActive||typeof battleTimer!=='undefined'&&battleTimer!==null||typeof battleRestartTimer!=='undefined'&&battleRestartTimer!==null)return'战斗或训练进行中，请结算后再操作存档';
  const g=(typeof S!=='undefined')?S.garrison:null;
  if(g&&['warning','spawn','sortie','battle','result'].includes(g.phase))return'驻军侵袭进行中，请结算后再操作存档';
  return'';
}
function exportCurrentSaveText(){return JSON.stringify(serializeSave())}
function exportMasterRawText(){const r=readRawKey(SAVE_KEY);return r.ok?r.text:null}
// 校验+摘要，不改任何状态；确认前 UI 只拿摘要数字（字符串仅来自 CFG 城镇名，导入文本永不进 innerHTML）
function inspectSaveText(text){
  const blocked=saveOpsBlocked();if(blocked)return{ok:false,reason:blocked};
  let p=null;try{p=JSON.parse(text)}catch(e){return{ok:false,reason:'JSON 解析失败'}}
  const v=validateSave(p);if(!v.ok)return{ok:false,reason:v.errors[0]};
  const m=migrateSave(p);
  const check=validateSave(m.d);if(!check.ok)return{ok:false,reason:'迁移候选校验失败：'+check.errors[0]};
  const town=CFG.town.find(t=>t.lv===m.d.townLv)||{};
  const poolTotal=Object.values(m.d.pool).reduce((a,b)=>a+(b||0),0);
  let formTotal=0;for(const r of['front','mid','back'])for(const u of(m.d.formation[r]||[]))formTotal+=(u&&u.count)||0;
  return{ok:true,data:m.d,text:JSON.stringify(m.d),summary:{version:SAVE_VERSION,townLv:m.d.townLv,townName:town.name||'?',population:m.d.population.current,capacity:settlementCapacity(m.d.settlements)+m.d.population.legacyBonus,settlements:m.d.settlements,legacyBonus:m.d.population.legacyBonus,levelsDefeated:m.d.defeated.length,merit:m.d.merit,poolTotal,formTotal}};
}
// 覆盖前保护：①当前主档（若存在）写覆盖前副本 ②轮转有效备份 ③才写主档；任一步失败=原档原样
function commitSaveData(text){
  const candidate=inspectSaveText(text);
  if(!candidate.ok)return{ok:false,reason:candidate.reason};
  text=candidate.text;
  const _ik=idemKey('import',strHash(text));                 // 切片10：同一文本窗口内重复导入 → 幂等（不二次覆盖/PRE 不重写）
  if(idemRepeat('import',strHash(text)))return{ok:true,repeat:true};
  const blocked=saveOpsBlocked();if(blocked)return{ok:false,reason:blocked};
  const cur=readRawKey(SAVE_KEY);if(!cur.ok)return{ok:false,reason:(cur.err||'存储读取失败')+'，未做任何改动'};
  if(cur.text!=null){const pre=writeRawKey(PRE_MIGRATION_KEY,cur.text);if(!pre.ok)return{ok:false,reason:'无法写入覆盖前原始副本，已中止本次覆盖'}}
  const b=backUpMaster();if(!b.ok)return{ok:false,reason:'备份写入失败，已中止本次覆盖，原主档未动'};
  const w=writeRawKey(SAVE_KEY,text);if(!w.ok)return{ok:false,reason:'主档写入失败（存储异常），原主档保留'};
  idemMark(_ik);                                             // 切片10：成功后打点
  return{ok:true};
}
function backupSlotSummaries(){
  return BACKUP_KEYS.map((k,i)=>{
    const r=readRawKey(k);if(!r.ok||r.text==null)return{slot:i+1,exists:false,valid:false};
    let p=null;try{p=JSON.parse(r.text)}catch(e){}
    if(!p)return{slot:i+1,exists:true,valid:false};
    const v=validateSave(p);if(!v.ok)return{slot:i+1,exists:true,valid:false};
    const m=migrateSave(p);const town=CFG.town.find(t=>t.lv===m.d.townLv)||{};
    return{slot:i+1,exists:true,valid:true,text:r.text,summary:{townLv:m.d.townLv,townName:town.name||'?',population:m.d.population.current,capacity:settlementCapacity(m.d.settlements)+m.d.population.legacyBonus,settlements:m.d.settlements,legacyBonus:m.d.population.legacyBonus,levelsDefeated:m.d.defeated.length,merit:m.d.merit,ts:m.d.ts}};
  });
}
// 恢复：备份文本必须先过同一校验管线（含战斗闸口），再走与导入相同的覆盖前保护
function restoreBackupByText(text){
  const _rh=strHash(text);                                   // 切片10：同一备份文本窗口内重复恢复 → 幂等
  if(idemRepeat('restore',_rh))return{ok:true,repeat:true};
  const r=inspectSaveText(text);if(!r.ok)return{ok:false,reason:'备份校验未通过：'+r.reason};
  const c=commitSaveData(r.text);
  if(c&&c.ok)idemMark(idemKey('restore',_rh));
  return c;
}
// 定向删除本游戏全部存档 key（替代 localStorage.clear()：不波及同 origin 其它站点数据）
// 返回 removed/failed 清单：删除失败必须显式上报，不得虚报全部完成（IE-001-R1 §4.4）
function resetAllSaves(){
  const keys=[SAVE_KEY,PRE_MIGRATION_KEY,...BACKUP_KEYS];
  const removed=[],failed=[];
  for(const k of keys){try{localStorage.removeItem(k);removed.push(k)}catch(e){failed.push(k)}}
  return{ok:failed.length===0,removed,failed};
}

// ==================== 计时 ====================
// ==================== IE-007 被动资源与市场 ====================
// 被动/货币资源上限：基准 max + maxPerLv × 生产建筑等级；木石粮按存档仓容模式分别取上限。
function producerKey(rk){for(const k of Object.keys(CFG.buildings)){if(CFG.buildings[k].buffRes===rk)return k}return null}
function masteredCapacity(rk,base){
  if(rk==='coin'||rk==='silverCoin'||rk==='goldCoin'||rk==='deed'||rk==='medal')return base;
  let cap=Math.floor(base*(1+S.storageMasteryLv*CFG.storageMastery.perLevel));
  const group=rk==='tech'?'steamKnowledge':(['copper','iron','silver','gold','steel'].includes(rk)?'steamMetal':(['wood','stone','food','coal'].includes(rk)?'steamBasic':null));
  if(group){
    cap=Math.floor(cap*(1+(S.eraStorage[group]||0)*CFG.eraStorage[group].perLevel));
    const electricKey='electric'+group.slice('steam'.length);
    cap=Math.floor(cap*(1+(S.eraStorage[electricKey]||0)*CFG.eraStorage[electricKey].perLevel));
    const nuclearKey='nuclear'+group.slice('steam'.length);
    cap=Math.floor(cap*(1+(S.eraStorage[nuclearKey]||0)*CFG.eraStorage[nuclearKey].perLevel));
    const quantumKey='quantum'+group.slice('steam'.length);
    cap=Math.floor(cap*(1+(S.eraStorage[quantumKey]||0)*CFG.eraStorage[quantumKey].perLevel));
  }
  const used=S.beastExchange?.scrollUsed||0;
  return Math.floor(cap*(1+used*CFG.beastExchange.scrollCapacityPerUse));
}
function resCap(rk){
  if(rk==='silver')return masteredCapacity(rk,CFG.res.silver.max+(CFG.buildings.silver_store.storagePerLv||0)*bldSt('silver_store').lv);
  if(rk==='gold')return masteredCapacity(rk,CFG.res.gold.max+(CFG.buildings.gold_store.storagePerLv||0)*bldSt('gold_store').lv);
  if(rk==='steel')return masteredCapacity(rk,CFG.res.steel.max+50*bldSt('iron_store').lv+(CFG.buildings.steel_store.storagePerLv||0)*bldSt('steel_store').lv);
  if(rk==='coal'||(S.metalRecipeMode==='coal'&&(rk==='copper'||rk==='iron'))){
    const mc=CFG.metalChain,store=mc?.stores?.[rk];
    if(store){const lv=bldSt(store).lv;return masteredCapacity(rk,mc.baseStorage+mc.storagePerLv*lv+(rk==='copper'||rk==='iron'?200*bldSt('steel_store').lv:0)+(rk==='coal'?400*bldSt('stone_store').lv:0));}
  }
  if(rk==='food'){
    const granary=CFG.buildings.large_granary;
    return masteredCapacity(rk,storageCapacity('food')+(granary?.storagePerLv||0)*bldSt('large_granary').lv);
  }
  const r=CFG.res[rk];
  if(r&&r.type!=='basic'&&r.max!=null){
    const x=expandedResCap(rk);
    const baseMax=x?x.max:r.max, perLv=x?x.maxPerLv:(r.maxPerLv||0);
    const pk=producerKey(rk);
    const st=pk?bldSt(pk):null;
    return masteredCapacity(rk,baseMax+perLv*(st&&st.state==='idle'?st.lv:0)+((rk==='copper'||rk==='iron')?200*bldSt('steel_store').lv:0)+(rk==='coal'?400*bldSt('stone_store').lv:0)+(rk==='tech'?CFG.buildings.library.storagePerLv*bldSt('library').lv+CFG.buildings.institute.storagePerLv*bldSt('institute').lv:0));
  }
  return masteredCapacity(rk,storageCapacity(rk)+(rk==='wood'?1200*bldSt('stone_store').lv:0)+(rk==='stone'?800*bldSt('stone_store').lv:0));
}
// 远征与驻军共用逐资源领奖口径；奖励为 0 时不触碰库存，历史超仓也不裁剪。
function creditResourceReward(rk,amount){
  if(!Object.prototype.hasOwnProperty.call(CFG.res,rk)||!Number.isFinite(amount)||amount<=0)return 0;
  const before=S.res[rk]||0;
  const limit=Math.max(before,resCap(rk));
  const after=Math.min(limit,before+amount);
  S.res[rk]=after;
  return after-before;
}
// S8c 占人口制：passiveProduction 简化为仅处理"跨资源消耗"（铁轨每人耗铜3、金币轨每人耗粮5）
// 产出统一由 prodRate（popAlloc 驱动）负责；建筑只做"解锁轨+加成器"
function passiveProduction(){
  for(const rk of Object.keys(CFG.res)){
    const cons=CFG.res[rk]&&CFG.res[rk].consumes;
    if(!cons)continue;
    const workers=S.popAlloc[rk]||0;
    if(workers<=0)continue;
    let ok=true;
    for(const[ck,amt] of Object.entries(cons)){
      if((S.res[ck]||0)<amt*workers){ok=false;break}
    }
    if(!ok)continue;  // 原料不足→该轨罢工（不产出也不消耗，prodRate 在 tick 里会因 consumption 检查返回 0）
    for(const[ck,amt] of Object.entries(cons)){
      S.res[ck]=Math.max(0,(S.res[ck]||0)-amt*workers);
    }
  }
}
// 市场兑换（交易所雏形；每日限制/多汇率等机制由 IE-006 补齐）。汇率往返乘积必须 <1（防套利，测试断言）
// 切片13（C3/C4 裁决）：每日计数（日界=本地 0 点，YYYY-MM-DD）；跨日自动重置
function localDay(ts){const d=new Date(typeof ts==='number'?ts:Date.now());const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())}
function dailyResetIfNeeded(){
  S.daily=(S.daily&&typeof S.daily==='object')?S.daily:{day:null,counts:{}};
  if(!S.daily.counts||typeof S.daily.counts!=='object')S.daily.counts={};
  const today=localDay();
  if(S.daily.day!==today){S.daily.day=today;S.daily.counts={};return true}
  return false;
}
function dailyCount(k){dailyResetIfNeeded();return S.daily.counts[k]||0}
function bumpDaily(k){dailyResetIfNeeded();S.daily.counts[k]=(S.daily.counts[k]||0)+1;return S.daily.counts[k]}
function marketDailyLimit(){return (CFG.market&&CFG.market.multiRate)?(CFG.market.dailyLimit??5):0}
function marketSpecialUnlocked(){
  const market=bldSt('market');
  return scienceUnlocked(CFG.market.special.needScience)&&scienceUnlocked(CFG.buildings.market.needScience)&&market.state==='idle'&&market.lv>0;
}
// 母本市场每20分钟从33种商品按权重有放回抽10格；只记录已接入道具，其余权重保留为空格。
function refreshMarketSpecial(){
  if(!marketSpecialUnlocked())return false;
  const cfg=CFG.market.special,offers={sacredBlood:0,domainCleanser:0,emberElixir:0,aegisElixir:0};
  for(let i=0;i<cfg.slots;i++){
    const roll=Math.random()*cfg.totalWeight;
    if(roll<cfg.weights.sacredBlood)offers.sacredBlood++;
    else if(roll<cfg.weights.sacredBlood+cfg.weights.domainCleanser)offers.domainCleanser++;
    else if(roll<cfg.weights.sacredBlood+cfg.weights.domainCleanser+cfg.weights.emberElixir)offers.emberElixir++;
    else if(roll<cfg.weights.sacredBlood+cfg.weights.domainCleanser+cfg.weights.emberElixir+cfg.weights.aegisElixir)offers.aegisElixir++;
  }
  S.marketSpecial={clockSec:cfg.refreshSec,offers,cycles:Math.min(Number.MAX_SAFE_INTEGER,S.marketSpecial.cycles+1)};
  return true;
}
function advanceMarketSpecialSecond(){
  if(!marketSpecialUnlocked())return false;
  if(S.marketSpecial.cycles===0)return refreshMarketSpecial();
  S.marketSpecial.clockSec=Math.max(0,S.marketSpecial.clockSec-1);
  return S.marketSpecial.clockSec===0?refreshMarketSpecial():false;
}
function buyMarketSpecial(key){
  if(saveProtected())return{ok:false,reason:'save-protected'};
  if(!marketSpecialUnlocked())return{ok:false,reason:'market-locked'};
  const good=CFG.market.special.goods[key];
  if(!good)return{ok:false,reason:'unknown-good'};
  if(S.marketSpecial.offers[key]<1)return{ok:false,reason:'sold-out'};
  const from=good.costKey==='goldCoin'?S.res:S.items;
  const before=from[good.costKey];
  if(!Number.isFinite(before)||before<good.cost)return{ok:false,reason:'insufficient-resource'};
  const oldItem=S.items[key];
  if(!Number.isSafeInteger(oldItem)||oldItem>=CFG.eraMaterials[key].max)return{ok:false,reason:'capacity'};
  const oldOffer=S.marketSpecial.offers[key];
  from[good.costKey]=before-good.cost;
  S.items[key]=oldItem+1;
  S.marketSpecial.offers[key]=oldOffer-1;
  const written=save();
  if(!written.ok){from[good.costKey]=before;S.items[key]=oldItem;S.marketSpecial.offers[key]=oldOffer;return{ok:false,reason:'save-failed'}}
  if(typeof updateUI==='function')updateUI();
  return{ok:true,item:key,count:S.items[key]};
}
function useDomainCleanser(domainKey){
  if(saveProtected())return{ok:false,reason:'save-protected'};
  if(S.battleActive)return{ok:false,reason:'battle-active'};
  if(!scienceUnlocked(CFG.market.special.needScience))return{ok:false,reason:'science-locked'};
  const domain=domainKey==='godCrystal'?CFG.godDomain:CFG.godDomains[domainKey];
  if(!domain||domain.noCleanser||!scienceUnlocked(domain.needScience))return{ok:false,reason:'domain-locked'};
  const killKey=domain.killValueKey||'godRevival',oldKill=S.killValues[killKey];
  if(!Number.isSafeInteger(oldKill)||oldKill<200)return{ok:false,reason:'alert-too-low'};
  if(idemRepeat('domain-cleanser',domainKey))return{ok:true,repeat:true,alert:oldKill};
  if(S.items.domainCleanser<1)return{ok:false,reason:'insufficient-item'};
  const oldItem=S.items.domainCleanser,oldOps=S.ops.slice();
  const alert=Math.max(100,oldKill-100);
  S.items.domainCleanser=oldItem-1;S.killValues[killKey]=alert;
  idemMark(idemKey('domain-cleanser',domainKey));
  const written=save();
  if(!written.ok){S.items.domainCleanser=oldItem;S.killValues[killKey]=oldKill;S.ops=oldOps;return{ok:false,reason:'save-failed'}}
  if(typeof updateUI==='function')updateUI();
  return{ok:true,alert,spent:1};
}
function useSacredBlood(unitType,count=1){
  if(saveProtected())return{ok:false,reason:'save-protected'};
  if(S.battleActive)return{ok:false,reason:'battle-active'};
  const unit=Object.prototype.hasOwnProperty.call(CFG.units,unitType)?CFG.units[unitType]:null;
  if(!unit||unit.enemyOnly)return{ok:false,reason:'invalid-unit'};
  if(ownedUnitCount(unitType)<1)return{ok:false,reason:'unit-unowned'};
  if(!Number.isSafeInteger(count)||count<1)return{ok:false,reason:'invalid-quantity'};
  const hadUses=Object.prototype.hasOwnProperty.call(S.bloodline,unitType);
  const oldUses=hadUses?S.bloodline[unitType]:0,stock=S.items[CFG.bloodline.item];
  if(!Number.isSafeInteger(oldUses)||oldUses<0||oldUses>=CFG.bloodline.limitPerUnit||
      count>CFG.bloodline.limitPerUnit-oldUses)return{ok:false,reason:'use-limit'};
  if(!Number.isSafeInteger(stock)||stock<count)return{ok:false,reason:'insufficient-item'};
  S.items[CFG.bloodline.item]=stock-count;
  S.bloodline[unitType]=oldUses+count;
  const written=save();
  if(!written.ok){
    S.items[CFG.bloodline.item]=stock;
    if(hadUses)S.bloodline[unitType]=oldUses;else delete S.bloodline[unitType];
    return{ok:false,reason:'save-failed'};
  }
  if(typeof updateUI==='function')updateUI();
  return{ok:true,unitType,used:count,total:S.bloodline[unitType]};
}
function soulRankCost(unitType){
  const progress=S.soulRanks[unitType]||{rank:0,stars:0},cfg=CFG.soulRank;
  if(progress.rank>=cfg.maxRank)return 0;
  return cfg.stonePerStar*(progress.rank+1)*(progress.stars>=cfg.starsPerRank?cfg.rankUpMultiplier:1);
}
function upgradeSoulRank(unitType){
  if(saveProtected())return{ok:false,reason:'save-protected'};
  if(S.battleActive)return{ok:false,reason:'battle-active'};
  if(!scienceUnlocked(CFG.soulRank.needScience))return{ok:false,reason:'science-locked'};
  const unit=Object.prototype.hasOwnProperty.call(CFG.units,unitType)?CFG.units[unitType]:null;
  if(!unit||unit.enemyOnly)return{ok:false,reason:'invalid-unit'};
  if(ownedUnitCount(unitType)<1)return{ok:false,reason:'unit-unowned'};
  const current=S.soulRanks[unitType]||{rank:0,stars:0};
  if(current.rank>=CFG.soulRank.maxRank)return{ok:false,reason:'max-rank'};
  const cost=soulRankCost(unitType),oldStock=S.items[CFG.soulRank.item];
  if(!Number.isSafeInteger(oldStock)||oldStock<cost)return{ok:false,reason:'insufficient-item'};
  const had=Object.prototype.hasOwnProperty.call(S.soulRanks,unitType);
  const next=current.stars===CFG.soulRank.starsPerRank?
    {rank:current.rank+1,stars:0}:{rank:current.rank,stars:current.stars+1};
  S.items[CFG.soulRank.item]=oldStock-cost;
  S.soulRanks[unitType]=next;
  if(!save().ok){
    S.items[CFG.soulRank.item]=oldStock;
    if(had)S.soulRanks[unitType]=current;else delete S.soulRanks[unitType];
    return{ok:false,reason:'save-failed'};
  }
  if(typeof updateUI==='function')updateUI();
  return{ok:true,cost,...next};
}
function useEmberElixir(unitType,count=1){
  if(saveProtected())return{ok:false,reason:'save-protected'};
  if(S.battleActive)return{ok:false,reason:'battle-active'};
  const unit=Object.prototype.hasOwnProperty.call(CFG.units,unitType)?CFG.units[unitType]:null;
  if(!unit||unit.enemyOnly)return{ok:false,reason:'invalid-unit'};
  if(ownedUnitCount(unitType)<1)return{ok:false,reason:'unit-unowned'};
  if(!Number.isSafeInteger(count)||count<1)return{ok:false,reason:'invalid-quantity'};
  const hadUses=Object.prototype.hasOwnProperty.call(S.attackInfusions,unitType);
  const oldUses=hadUses?S.attackInfusions[unitType]:0,stock=S.items[CFG.emberElixir.item];
  if(!Number.isSafeInteger(oldUses)||oldUses<0||oldUses>=CFG.emberElixir.limitPerUnit||
      count>CFG.emberElixir.limitPerUnit-oldUses)return{ok:false,reason:'use-limit'};
  if(!Number.isSafeInteger(stock)||stock<count)return{ok:false,reason:'insufficient-item'};
  S.items[CFG.emberElixir.item]=stock-count;
  S.attackInfusions[unitType]=oldUses+count;
  if(!save().ok){
    S.items[CFG.emberElixir.item]=stock;
    if(hadUses)S.attackInfusions[unitType]=oldUses;else delete S.attackInfusions[unitType];
    return{ok:false,reason:'save-failed'};
  }
  if(typeof updateUI==='function')updateUI();
  return{ok:true,unitType,used:count,total:S.attackInfusions[unitType]};
}
function useAegisElixir(unitType,count=1){
  if(saveProtected())return{ok:false,reason:'save-protected'};
  if(S.battleActive)return{ok:false,reason:'battle-active'};
  const unit=Object.prototype.hasOwnProperty.call(CFG.units,unitType)?CFG.units[unitType]:null;
  if(!unit||unit.enemyOnly)return{ok:false,reason:'invalid-unit'};
  if(ownedUnitCount(unitType)<1)return{ok:false,reason:'unit-unowned'};
  if(!Number.isSafeInteger(count)||count<1)return{ok:false,reason:'invalid-quantity'};
  const hadUses=Object.prototype.hasOwnProperty.call(S.aegisInfusions,unitType);
  const oldUses=hadUses?S.aegisInfusions[unitType]:0,stock=S.items[CFG.aegisElixir.item];
  if(!Number.isSafeInteger(oldUses)||oldUses<0||oldUses>=CFG.aegisElixir.limitPerUnit||
      count>CFG.aegisElixir.limitPerUnit-oldUses)return{ok:false,reason:'use-limit'};
  if(!Number.isSafeInteger(stock)||stock<count)return{ok:false,reason:'insufficient-item'};
  S.items[CFG.aegisElixir.item]=stock-count;
  S.aegisInfusions[unitType]=oldUses+count;
  if(!save().ok){
    S.items[CFG.aegisElixir.item]=stock;
    if(hadUses)S.aegisInfusions[unitType]=oldUses;else delete S.aegisInfusions[unitType];
    return{ok:false,reason:'save-failed'};
  }
  if(typeof updateUI==='function')updateUI();
  return{ok:true,unitType,used:count,total:S.aegisInfusions[unitType]};
}
function marketAvailableRates(){
  const rates=CFG.market?.rates||[];
  return rates.filter(r=>(!r.needScience||scienceUnlocked(r.needScience))&&(r.early||scienceUnlocked('sci_coin')));
}
// 在独立候选库存上逐笔试算；单笔兑换与购契组合共用这条动作校验链。
function marketTradePlan(steps){
  const reject=(reason,message)=>({ok:false,reason,message});
  if(saveProtected())return reject('save-protected','存档保护中，无法兑换');
  const market=bldSt('market');
  if(!scienceUnlocked(CFG.buildings.market.needScience)||market.state!=='idle'||market.lv<1)
    return reject('market-locked','需先研究冶铜术并建成市场');
  if(!Array.isArray(steps)||steps.length<1||steps.length>4)return reject('invalid-trades','兑换笔数无效');
  const resources={...S.res};
  const daily=JSON.parse(JSON.stringify(S.daily||{day:null,counts:{}}));
  const trades=[];let remaining=null;
  for(const step of steps){
    const {from,to,qty}=step||{};
    const r=(CFG.market?.rates||[]).find(x=>x.from===from&&x.to===to);
    if(!r)return reject('unknown-rate','暂无该兑换项');
    if(r.needScience&&!scienceUnlocked(r.needScience))return reject('rate-locked','需先研究「'+sciName(r.needScience)+'」');
    if(!r.early&&!scienceUnlocked('sci_coin'))return reject('rate-locked','需先研究货币铸造');
    if(!Number.isSafeInteger(qty)||qty<=0)return reject('invalid-quantity','请输入正整数兑换数量');
    const get=Math.floor(qty*r.rate),beforeFrom=resources[from],beforeTo=resources[to];
    if(!Number.isSafeInteger(get)||get<=0)return reject('invalid-output','兑换数量过小或过大');
    if(!Number.isFinite(beforeFrom)||beforeFrom<qty)return reject('insufficient-resource',(CFG.res[from]?.name||from)+'不足');
    if(!Number.isFinite(beforeTo)||beforeTo+get>resCap(to))return reject('capacity','目标资源容量不足');
    const lim=r.early?0:marketDailyLimit();
    if(lim>0){
      const today=localDay();
      if(daily.day!==today){daily.day=today;daily.counts={};}
      if((daily.counts.market||0)>=lim)return reject('daily-limit','今日兑换次数已用完（'+lim+'次）');
      daily.counts.market=(daily.counts.market||0)+1;
    }
    resources[from]=beforeFrom-qty;
    resources[to]=beforeTo+get;
    trades.push({from,to,qty,get});
    remaining=lim>0?Math.max(0,lim-(daily.counts.market||0)):null;
  }
  return{ok:true,resources,daily,trades,remaining};
}
function commitMarketTradePlan(plan){
  const beforeRes=S.res,beforeDaily=S.daily;
  S.res=plan.resources;S.daily=plan.daily;
  const written=save();
  if(!written.ok){
    S.res=beforeRes;S.daily=beforeDaily;
    if(typeof toast==='function')toast('保存失败，兑换未生效');
    return{ok:false,reason:'save-failed'};
  }
  if(typeof updateUI==='function')updateUI();
  return{ok:true,trades:plan.trades,remaining:plan.remaining};
}
function exchangeResource(from,to,qty){
  const plan=marketTradePlan([{from,to,qty}]);
  if(!plan.ok){if(typeof toast==='function')toast(plan.message);return{ok:false,reason:plan.reason};}
  const written=commitMarketTradePlan(plan);
  return written.ok?{ok:true,get:plan.trades[0].get,remaining:plan.remaining}:written;
}
// 郊野兽骨经独立边贸行兑换勋章；母本290015为Lv0、100%成功，不占本项目市场每日次数。
function beastExchangeProgressNeed(level){return CFG.beastExchange.firstProgress+(level-1)*CFG.beastExchange.progressStep}
function beastBoneTradeCost(){return Math.ceil(CFG.beastExchange.bonePerTrade*(5+S.beastExchange.level-1)/5)}
function beastBoneTradeReward(){return Math.floor(CFG.beastExchange.medalPerTrade*(5+S.beastExchange.level-1)/5)}
function defaultWildOffers(){return Object.fromEntries(CFG.beastExchange.scrollMaterials.slice(1).map(key=>[key,{count:0,quality:100}]))}
function defaultSoulOffers(){return Object.fromEntries(Object.keys(CFG.beastExchange.soulTrades).map(key=>[key,0]))}
function defaultHideOffers(){return Object.fromEntries(Object.keys(CFG.beastExchange.hideTrades).map(key=>[key,{count:0,quality:100}]))}
function beastScrollOfferCount(materialKey){return materialKey==='boarHeart'?S.beastExchange.heartOffers:S.beastExchange.wildOffers[materialKey]?.count||0}
function beastScrollTradeCost(materialKey){
  const quality=materialKey==='boarHeart'?S.beastExchange.heartQuality:S.beastExchange.wildOffers[materialKey]?.quality;
  return Math.ceil(CFG.beastExchange.heartPerScroll*quality/100);
}
function beastHeartTradeCost(){return beastScrollTradeCost('boarHeart')}
function beastOfferTotalWeight(level){
  let total=CFG.beastExchange.offerTotalWeights[0][1];
  for(const [minimum,weight] of CFG.beastExchange.offerTotalWeights){if(level<minimum)break;total=weight}
  return total;
}
function beastOfferSlots(level){return Math.min(CFG.beastExchange.maxOfferSlots,Math.floor(level/CFG.beastExchange.slotsPerLevels)+CFG.beastExchange.baseOfferSlots)}
function rollBeastOfferQuality(level){
  let quality=100;
  if(Math.random()*100<Math.min(level+5,50))quality=80;
  if(Math.random()*100<Math.min(Math.floor(level/5)+1,10))quality=50;
  if(Math.random()*1000<Math.min(Math.floor(level/10)+1,6))quality=10;
  return quality;
}
// 投影母本六种图纸、60级铭石／勋章及十二种兽皮货位；其余商品保留在总权重中。
function rollBeastHeartOffers(){
  const cfg=CFG.beastExchange,x=S.beastExchange;
  x.heartOffers=0;x.heartQuality=100;x.wildOffers=defaultWildOffers();x.soulOffers=defaultSoulOffers();x.medalOffers=0;x.hideOffers=defaultHideOffers();
  const total=beastOfferTotalWeight(x.level),slots=beastOfferSlots(x.level);
  for(let i=0;i<slots;i++){
    const hit=Math.floor(Math.random()*total),scrollWeight=x.level>=cfg.scrollLevel?cfg.scrollMaterials.length*cfg.heartOfferWeight:0;
    if(hit>=scrollWeight){
      let offset=hit-scrollWeight,offered=false;
      if(x.level>=cfg.soulTradeLevel)for(const [key,trade] of Object.entries(cfg.soulTrades)){
        offset-=trade.weight;
        if(offset<0){x.soulOffers[key]++;offered=true;break}
      }
      if(!offered&&x.level>=cfg.medalOfferTrade.level){
        if(offset>=0&&offset<cfg.medalOfferTrade.weight){x.medalOffers++;offered=true}
        offset-=cfg.medalOfferTrade.weight;
      }
      if(!offered&&offset>=0)for(const [key,trade] of Object.entries(cfg.hideTrades)){
        offset-=trade.weight;
        if(offset<0){const offer=x.hideOffers[key];offer.count++;offer.quality=rollBeastOfferQuality(x.level);break}
      }
      continue;
    }
    const index=Math.floor(hit/cfg.heartOfferWeight);
    if(index>=cfg.scrollMaterials.length)continue;
    const materialKey=cfg.scrollMaterials[index];
    const quality=rollBeastOfferQuality(x.level);
    if(materialKey==='boarHeart'){x.heartOffers++;x.heartQuality=quality}
    else{const offer=x.wildOffers[materialKey];offer.count++;offer.quality=quality}
  }
}
function refreshBeastExchange(){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const x=S.beastExchange;
  if(x.refreshCharges<1)return{ok:false,reason:'no-refresh'};
  const old={...x};
  x.refreshCharges--;rollBeastHeartOffers();
  if(!save().ok){Object.assign(x,old);return{ok:false,reason:'save-failed'}}
  if(typeof updateUI==='function')updateUI();
  return{ok:true,offers:x.heartOffers+Object.values(x.wildOffers).reduce((sum,offer)=>sum+offer.count,0)+Object.values(x.soulOffers).reduce((sum,count)=>sum+count,0)+x.medalOffers+Object.values(x.hideOffers).reduce((sum,offer)=>sum+offer.count,0),charges:x.refreshCharges};
}
function advanceBeastExchangeSecond(){
  const x=S.beastExchange,cfg=CFG.beastExchange;
  if(x.refreshClock>1){x.refreshClock--;return}
  x.refreshClock=cfg.refreshSeconds;
  if(x.refreshCharges<cfg.maxRefreshCharges)x.refreshCharges++;
  else rollBeastHeartOffers();
}
function exchangeBonesForMedals(trades){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const cfg=CFG.beastExchange;
  if(!Number.isSafeInteger(trades)||trades<=0)return{ok:false,reason:'invalid-quantity'};
  const boneCost=trades*beastBoneTradeCost(),medalGain=trades*beastBoneTradeReward();
  if(!Number.isSafeInteger(boneCost)||!Number.isSafeInteger(medalGain))return{ok:false,reason:'invalid-quantity'};
  if(!Number.isFinite(S.res.bone)||S.res.bone<boneCost)return{ok:false,reason:'insufficient-bone'};
  if(!Number.isFinite(S.res.medal)||S.res.medal+medalGain>resCap('medal'))return{ok:false,reason:'capacity'};
  const oldBone=S.res.bone,oldMedal=S.res.medal,oldProgress=S.beastExchange.progress;
  S.res.bone-=boneCost;S.res.medal+=medalGain;
  if(S.beastExchange.level<cfg.maxLevel)S.beastExchange.progress=Math.min(beastExchangeProgressNeed(S.beastExchange.level),oldProgress+trades);
  if(!save().ok){S.res.bone=oldBone;S.res.medal=oldMedal;S.beastExchange.progress=oldProgress;return{ok:false,reason:'save-failed'}}
  if(typeof addLog==='function')addLog(`边贸行：兽骨 -${boneCost}，${resourceDisplayName('medal')} +${medalGain}`);
  if(typeof updateUI==='function')updateUI();
  return{ok:true,boneCost,medalGain};
}
function beastHideTradeCost(id){
  if(!Object.prototype.hasOwnProperty.call(CFG.beastExchange.hideTrades,id))return NaN;
  const trade=CFG.beastExchange.hideTrades[id],offer=S.beastExchange.hideOffers[id];
  if(!trade||!offer)return NaN;
  return Math.ceil(trade.cost*offer.quality/100*(1+0.2*(S.beastExchange.level-1)));
}
function beastHideTradeReward(id){
  if(!Object.prototype.hasOwnProperty.call(CFG.beastExchange.hideTrades,id))return NaN;
  const trade=CFG.beastExchange.hideTrades[id];
  return trade?Math.floor(trade.amount*(1+0.2*(S.beastExchange.level-1))):NaN;
}
function exchangeHideForResource(id,trades){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  if(!Object.prototype.hasOwnProperty.call(CFG.beastExchange.hideTrades,id))return{ok:false,reason:'invalid-good'};
  const trade=CFG.beastExchange.hideTrades[id],offer=S.beastExchange.hideOffers[id];
  if(!trade||!offer)return{ok:false,reason:'invalid-good'};
  if(!Number.isSafeInteger(trades)||trades<=0)return{ok:false,reason:'invalid-quantity'};
  if(offer.count<trades)return{ok:false,reason:'not-offered'};
  const hideCost=beastHideTradeCost(id)*trades,gain=beastHideTradeReward(id)*trades;
  if(!Number.isSafeInteger(hideCost)||!Number.isSafeInteger(gain)||hideCost<=0||gain<=0)return{ok:false,reason:'invalid-quantity'};
  if(!Number.isSafeInteger(S.res.hide)||S.res.hide<hideCost)return{ok:false,reason:'insufficient-hide'};
  const stock=S.res[trade.get];
  if(!Number.isFinite(stock)||stock+gain>resCap(trade.get))return{ok:false,reason:'capacity'};
  const oldHide=S.res.hide,oldProgress=S.beastExchange.progress,oldOffer=offer.count;
  S.res.hide=oldHide-hideCost;S.res[trade.get]=stock+gain;offer.count=oldOffer-trades;
  if(S.beastExchange.level<CFG.beastExchange.maxLevel)S.beastExchange.progress=Math.min(beastExchangeProgressNeed(S.beastExchange.level),oldProgress+trades);
  if(!save().ok){S.res.hide=oldHide;S.res[trade.get]=stock;offer.count=oldOffer;S.beastExchange.progress=oldProgress;return{ok:false,reason:'save-failed'}}
  if(typeof addLog==='function')addLog(`边贸行：兽皮 -${hideCost}，${resourceDisplayName(trade.get)} +${gain}`);
  if(typeof updateUI==='function')updateUI();
  return{ok:true,id:Number(id),hideCost,get:trade.get,gain};
}
function exchangeOfferedBonesForMedals(trades){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const cfg=CFG.beastExchange,trade=cfg.medalOfferTrade,x=S.beastExchange;
  if(!Number.isSafeInteger(trades)||trades<=0)return{ok:false,reason:'invalid-quantity'};
  if(x.level<trade.level)return{ok:false,reason:'level'};
  if(x.medalOffers<trades)return{ok:false,reason:'not-offered'};
  const boneCost=trade.boneCost*trades,medalGain=trade.medalGain*trades;
  if(!Number.isSafeInteger(boneCost)||!Number.isSafeInteger(medalGain))return{ok:false,reason:'invalid-quantity'};
  if(!Number.isFinite(S.res.bone)||S.res.bone<boneCost)return{ok:false,reason:'insufficient-bone'};
  if(!Number.isFinite(S.res.medal)||S.res.medal+medalGain>resCap('medal'))return{ok:false,reason:'capacity'};
  const oldBone=S.res.bone,oldMedal=S.res.medal,oldOffer=x.medalOffers,oldProgress=x.progress;
  S.res.bone-=boneCost;S.res.medal+=medalGain;x.medalOffers-=trades;
  if(x.level<cfg.maxLevel)x.progress=Math.min(beastExchangeProgressNeed(x.level),oldProgress+trades);
  if(!save().ok){S.res.bone=oldBone;S.res.medal=oldMedal;x.medalOffers=oldOffer;x.progress=oldProgress;return{ok:false,reason:'save-failed'}}
  if(typeof addLog==='function')addLog(`边贸行限时货位：兽骨 -${boneCost}，${resourceDisplayName('medal')} +${medalGain}`);
  if(typeof updateUI==='function')updateUI();
  return{ok:true,boneCost,medalGain};
}
function upgradeBeastExchange(){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const x=S.beastExchange,cfg=CFG.beastExchange;
  if(x.level>=cfg.maxLevel)return{ok:false,reason:'max-level'};
  if(x.progress<beastExchangeProgressNeed(x.level))return{ok:false,reason:'progress'};
  const oldLevel=x.level,oldProgress=x.progress;
  x.level++;x.progress=0;
  if(!save().ok){x.level=oldLevel;x.progress=oldProgress;return{ok:false,reason:'save-failed'}}
  if(typeof updateUI==='function')updateUI();
  return{ok:true,level:x.level};
}
function exchangeHeartsForScrolls(trades){
  return exchangeWildMaterialForScrolls('boarHeart',trades);
}
function exchangeWildMaterialForScrolls(materialKey,trades){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const cfg=CFG.beastExchange,x=S.beastExchange;
  if(!Number.isSafeInteger(trades)||trades<=0)return{ok:false,reason:'invalid-quantity'};
  if(!cfg.scrollMaterials.includes(materialKey))return{ok:false,reason:'invalid-material'};
  if(x.level<cfg.scrollLevel)return{ok:false,reason:'level'};
  if(beastScrollOfferCount(materialKey)<trades)return{ok:false,reason:'not-offered'};
  const cost=trades*beastScrollTradeCost(materialKey);
  if(!Number.isSafeInteger(cost))return{ok:false,reason:'invalid-quantity'};
  if(S.items[materialKey]<cost)return{ok:false,reason:'insufficient-material'};
  if(S.items.storageScroll+trades>CFG.eraMaterials.storageScroll.max)return{ok:false,reason:'capacity'};
  const oldProgress=x.progress,offer=materialKey==='boarHeart'?null:x.wildOffers[materialKey];
  S.items[materialKey]-=cost;S.items.storageScroll+=trades;
  if(offer)offer.count-=trades;else x.heartOffers-=trades;
  if(x.level<cfg.maxLevel)x.progress=Math.min(beastExchangeProgressNeed(x.level),oldProgress+trades);
  if(!save().ok){S.items[materialKey]+=cost;S.items.storageScroll-=trades;if(offer)offer.count+=trades;else x.heartOffers+=trades;x.progress=oldProgress;return{ok:false,reason:'save-failed'}}
  if(typeof updateUI==='function')updateUI();
  return{ok:true,cost,scrollGain:trades,materialKey};
}
function exchangeSoulElixirForStones(materialKey,trades){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const cfg=CFG.beastExchange,x=S.beastExchange,trade=cfg.soulTrades[materialKey];
  if(!Number.isSafeInteger(trades)||trades<=0)return{ok:false,reason:'invalid-quantity'};
  if(!Object.prototype.hasOwnProperty.call(cfg.soulTrades,materialKey))return{ok:false,reason:'invalid-material'};
  if(x.level<cfg.soulTradeLevel)return{ok:false,reason:'level'};
  if(x.soulOffers[materialKey]<trades)return{ok:false,reason:'not-offered'};
  const cost=trade.cost*trades,gain=trade.stones*trades;
  if(!Number.isSafeInteger(cost)||!Number.isSafeInteger(gain))return{ok:false,reason:'invalid-quantity'};
  const stock=S.items[materialKey],stones=S.items.soulStone;
  if(!Number.isSafeInteger(stock)||stock<cost)return{ok:false,reason:'insufficient-material'};
  if(!Number.isSafeInteger(stones)||stones+gain>CFG.eraMaterials.soulStone.max)return{ok:false,reason:'capacity'};
  const oldProgress=x.progress,oldOffer=x.soulOffers[materialKey];
  S.items[materialKey]=stock-cost;S.items.soulStone=stones+gain;x.soulOffers[materialKey]=oldOffer-trades;
  if(x.level<cfg.maxLevel)x.progress=Math.min(beastExchangeProgressNeed(x.level),oldProgress+trades);
  if(!save().ok){
    S.items[materialKey]=stock;S.items.soulStone=stones;x.soulOffers[materialKey]=oldOffer;x.progress=oldProgress;
    return{ok:false,reason:'save-failed'};
  }
  if(typeof updateUI==='function')updateUI();
  return{ok:true,materialKey,cost,stoneGain:gain};
}
function useStorageScroll(count){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const cfg=CFG.beastExchange,x=S.beastExchange;
  if(!Number.isSafeInteger(count)||count<=0)return{ok:false,reason:'invalid-quantity'};
  if(S.items.storageScroll<count)return{ok:false,reason:'insufficient-scroll'};
  if(x.scrollUsed+count>cfg.scrollUseLimit)return{ok:false,reason:'use-limit'};
  S.items.storageScroll-=count;x.scrollUsed+=count;
  if(!save().ok){S.items.storageScroll+=count;x.scrollUsed-=count;return{ok:false,reason:'save-failed'}}
  if(typeof updateUI==='function')updateUI();
  return{ok:true,used:x.scrollUsed};
}
// 可将最多三种明确指定的基础资源出售与购契合成一笔保存；不绕过中间金币仓容。
function previewDeedBasket(sales,deeds){
  const invalid=(reason,message)=>({ok:false,reason,message});
  if(!Number.isSafeInteger(deeds)||deeds<=0)return invalid('invalid-quantity','请输入正整数地契数量');
  if(!Array.isArray(sales)||sales.length>3)return invalid('invalid-sales','出售项目无效');
  const deedRate=(CFG.market?.rates||[]).find(r=>r.from==='coin'&&r.to==='deed'&&r.early);
  if(!deedRate||!Number.isFinite(deedRate.rate)||deedRate.rate<=0)return invalid('rate-locked','地契汇率不可用');
  const coinCost=Math.ceil(deeds/deedRate.rate);
  if(!Number.isSafeInteger(coinCost)||Math.floor(coinCost*deedRate.rate)!==deeds)
    return invalid('invalid-output','地契数量超出可精确兑换范围');
  const steps=[],seen=new Set();
  for(const item of sales){
    const from=item?.from,qty=item?.qty;
    if(!['wood','stone','food'].includes(from)||seen.has(from)||!Number.isSafeInteger(qty)||qty<=0)
      return invalid('invalid-sales','仅可各出售一次正整数木、石、粮');
    seen.add(from);
    const rate=(CFG.market?.rates||[]).find(r=>r.from===from&&r.to==='coin'&&r.early);
    if(!rate)return invalid('rate-locked','基础出售汇率不可用');
    steps.push({from,to:'coin',qty});
  }
  steps.push({from:'coin',to:'deed',qty:coinCost});
  const plan=marketTradePlan(steps);
  if(!plan.ok)return plan;
  return{...plan,deeds,coinCost,coinUsed:Math.min(S.res.coin,coinCost),
    sourceCost:sales.length===1?sales[0].qty:null,
    coinGained:plan.trades.slice(0,-1).reduce((n,t)=>n+t.get,0),
    startingDeed:S.res.deed,startingCoin:S.res.coin,
    remainingCoin:plan.resources.coin,remainingDeed:plan.resources.deed};
}
function buyDeedsBasket(sales,deeds,expectedCoinCost,expectedGains,expectedDeedBalance){
  if(expectedCoinCost===undefined||!Array.isArray(expectedGains)||!Number.isFinite(expectedDeedBalance))
    return{ok:false,reason:'quote-required'};
  if(S.res.deed!==expectedDeedBalance)return{ok:false,reason:'stale-quote'};
  const plan=previewDeedBasket(sales,deeds);
  if(!plan.ok){if(typeof toast==='function')toast(plan.message);return{ok:false,reason:plan.reason};}
  const gains=plan.trades.slice(0,-1).map(t=>t.get);
  if(expectedCoinCost!==undefined&&(expectedCoinCost!==plan.coinCost||JSON.stringify(expectedGains)!==JSON.stringify(gains))){
    if(typeof toast==='function')toast('报价已变化，请重新预览');
    return{ok:false,reason:'stale-quote'};
  }
  const written=commitMarketTradePlan(plan);
  return written.ok?{ok:true,deeds,coinCost:plan.coinCost,coinGained:plan.coinGained,remainingCoin:plan.remainingCoin,remainingDeed:plan.remainingDeed}:written;
}
// 单资源快捷报价按现有金币余额补足，不自动出售粮食。
function previewDeedPurchase(from,deeds){
  if(!['wood','stone','food'].includes(from))return{ok:false,reason:'invalid-sales',message:'请选择木、石或粮'};
  if(!Number.isSafeInteger(deeds)||deeds<=0)return{ok:false,reason:'invalid-quantity',message:'请输入正整数地契数量'};
  const rate=(CFG.market?.rates||[]).find(r=>r.from===from&&r.to==='coin'&&r.early);
  const deedRate=(CFG.market?.rates||[]).find(r=>r.from==='coin'&&r.to==='deed'&&r.early);
  if(!rate||!deedRate)return{ok:false,reason:'rate-locked',message:'基础汇率不可用'};
  const coinCost=Math.ceil(deeds/deedRate.rate);
  if(!Number.isSafeInteger(coinCost))return{ok:false,reason:'invalid-output',message:'地契数量过大'};
  const missing=Math.max(0,Math.ceil(coinCost-S.res.coin));
  let sourceCost=0;
  if(missing>0){
    let lo=1,hi=Math.ceil(missing/rate.rate)+2;
    if(!Number.isSafeInteger(hi))return{ok:false,reason:'invalid-output',message:'出售数量过大'};
    while(lo<hi){const mid=Math.floor((lo+hi)/2);if(Math.floor(mid*rate.rate)>=missing)hi=mid;else lo=mid+1;}
    sourceCost=lo;
  }
  const sales=sourceCost?[{from,qty:sourceCost}]:[];
  const plan=previewDeedBasket(sales,deeds);
  return plan.ok?{...plan,from,sourceCost,sales}:plan;
}
function buyDeedsWithResource(from,deeds,expectedSourceCost,expectedDeedBalance){
  if(!Number.isSafeInteger(expectedSourceCost)||expectedSourceCost<0||!Number.isFinite(expectedDeedBalance))
    return{ok:false,reason:'quote-required'};
  if(S.res.deed!==expectedDeedBalance)return{ok:false,reason:'stale-quote'};
  const plan=previewDeedPurchase(from,deeds);
  if(!plan.ok){if(typeof toast==='function')toast(plan.message);return{ok:false,reason:plan.reason};}
  if(plan.sourceCost>expectedSourceCost){
    if(typeof toast==='function')toast('报价已变化，请重新预览');
    return{ok:false,reason:'stale-quote'};
  }
  const written=commitMarketTradePlan(plan);
  return written.ok?{ok:true,deeds,sourceCost:plan.sourceCost,coinCost:plan.coinCost,remainingCoin:plan.remainingCoin,remainingDeed:plan.remainingDeed}:written;
}

// IE-008 资源科技（对齐放置时代发展科技 45xxxx：纯科技门=科技点+战功，无击杀前置）
function scienceUnlocked(id){return S.sciences.includes(id)}
// 生效的科技表：默认长阶梯含早期直链与并行军备支线；短表仅供旧开关兼容。
function activeSciences(){return (CFG.tech&&CFG.tech.longLadder&&CFG.sciencesLong)?CFG.sciencesLong:(CFG.sciences||{})}
function sciName(id){const a=activeSciences()[id]||(CFG.sciences||{})[id]||(CFG.sciencesLong||{})[id];return a?a.name:id}
function sciIdKnown(id){return !!(activeSciences()[id]||(CFG.sciences||{})[id]||(CFG.sciencesLong||{})[id])}
function scienceNeedIds(id,sc=activeSciences()[id]){
  const need=Array.isArray(sc?.need)?[...sc.need]:[];
  if(id!=='sci_copper')return need;
  if(S.metalRecipeMode==='coal'){
    if(!need.includes('sci_coal'))need.push('sci_coal');
  }else if(CFG.tech?.longLadder){
    // 旧档沿用原长科技链的探矿前置，不追缴新煤科技。
    const i=need.indexOf('sci_coal');if(i>=0)need.splice(i,1);
    if(!need.includes('sci_prospect'))need.push('sci_prospect');
  }
  return need;
}
function researchScience(id){
  if(_saveProtected){if(typeof toast==='function')toast('存档保护中，无法研究');return{ok:false,reason:'save-protected'}}
  if(activeSciences()[id]?.legacyOnly&&!S.sciences.includes(id)){
    if(typeof toast==='function')toast('该历史研究已停用');
    return{ok:false,reason:'legacy-only'};
  }
  if(idemRepeat('science',id)){return{ok:true,repeat:true}}   // 切片10：窗口内重复研究 → 既有结果、不重复扣费
  const sc=activeSciences()[id];
  if(!sc){if(typeof toast==='function')toast('未知科技');return{ok:false}}
  if(sc.storageMode&&S.storageMode!==sc.storageMode){return{ok:false,reason:'mode-mismatch'}}
  if(sc.currencyMode&&S.currencyRecipeMode!==sc.currencyMode){return{ok:false,reason:'mode-mismatch'}}
  if(S.sciences.includes(id)){if(typeof toast==='function')toast('已研究');return{ok:false}}
  for(const p of scienceNeedIds(id,sc)){if(!S.sciences.includes(p)){if(typeof toast==='function')toast('需先研究「'+sciName(p)+'」');return{ok:false,reason:'science-prerequisite'}}}
  if((S.res.tech||0)<sc.cost.tech){if(typeof toast==='function')toast('科技点不足');return{ok:false,reason:'insufficient-tech'}}
  for(const[rk,amount]of Object.entries(sc.cost)){
    if(rk==='merit'||rk==='tech')continue;
    if(!Object.prototype.hasOwnProperty.call(CFG.res,rk)||!Number.isFinite(amount)||amount<0||!Number.isFinite(S.res[rk])||S.res[rk]<amount){
      if(typeof toast==='function')toast((CFG.res[rk]?.name||rk)+'不足');
      return{ok:false,reason:'insufficient-resources'};
    }
  }
  // 切片3（S1 解死锁）：开关启用时，资源科技不消耗战功——对齐竞品"科技仅耗知识"（450005-450025 Need=知识/粮/木）
  // 原始配置数值保持不变（皮/数值不动），仅运行时按开关豁免；关闭开关即回到改造前行为
  const _noMerit=!!(CFG.tech&&CFG.tech.sciencesNoMerit);
  const meritNeed=_noMerit?0:(sc.cost.merit||0);
  if((S.merit||0)<meritNeed){if(typeof toast==='function')toast('战功不足');return{ok:false}}
  const oldRes={...S.res},oldMerit=S.merit,oldSciences=S.sciences.slice(),oldOps=S.ops.slice();
  for(const[rk,amount]of Object.entries(sc.cost))if(rk!=='merit')S.res[rk]-=amount;
  S.merit-=meritNeed;
  S.sciences.push(id);
  idemMark(idemKey('science',id));   // 切片10：成功后打点
  const written=save();
  if(!written.ok){
    S.res=oldRes;S.merit=oldMerit;S.sciences=oldSciences;S.ops=oldOps;
    if(typeof toast==='function')toast('保存失败，研究未生效');
    if(typeof updateUI==='function')updateUI();
    return{ok:false,reason:'save-failed'};
  }
  if(typeof logDiag==='function')logDiag('science',id);
  if(typeof addLog==='function')addLog('研究完成：「'+sc.name+'」');
  if(typeof updateUI==='function')updateUI();
  return{ok:true};
}
function storageMasteryCost(level=S.storageMasteryLv){
  const c=CFG.storageMastery;
  const rate=level+1;
  const base=level<c.earlyLevels?c.earlyCost:c.laterCost;
  return Object.fromEntries(Object.entries(base).map(([rk,amount])=>[rk,amount*rate]));
}
function upgradeStorageMastery(){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const c=CFG.storageMastery;
  if(!scienceUnlocked(c.needScience))return{ok:false,reason:'science-prerequisite'};
  if(S.storageMasteryLv>=c.maxLevel)return{ok:false,reason:'max-level'};
  const cost=storageMasteryCost();
  if(!Object.entries(cost).every(([rk,amount])=>Number.isFinite(amount)&&amount>=0&&Number.isFinite(S.res[rk])&&S.res[rk]>=amount))return{ok:false,reason:'insufficient-resources',cost};
  const oldLevel=S.storageMasteryLv,oldRes={...S.res};
  for(const[rk,amount]of Object.entries(cost))S.res[rk]-=amount;
  S.storageMasteryLv++;
  const written=save();
  if(!written.ok){S.res=oldRes;S.storageMasteryLv=oldLevel;return{ok:false,reason:'save-failed'}}
  if(typeof addLog==='function')addLog('储存精通升至 Lv'+S.storageMasteryLv);
  if(typeof updateUI==='function')updateUI();
  return{ok:true,level:S.storageMasteryLv,cost};
}
function scholarMasteryCost(level=S.scholarMasteryLv){
  const cfg=CFG.scholarMastery;
  if(!Number.isSafeInteger(level)||level<0||level>=cfg.maxLevel)return null;
  const next=level+1,cost={tech:cfg.techBase*next};
  if(level>=5)cost.medal=cfg.lateMedalBase*next;
  return cost;
}
function upgradeScholarMastery(){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const cfg=CFG.scholarMastery;
  if(!scienceUnlocked(cfg.needScience))return{ok:false,reason:'science-prerequisite'};
  if(S.scholarMasteryLv>=cfg.maxLevel)return{ok:false,reason:'max-level'};
  const cost=scholarMasteryCost();
  if(!cost||!Object.entries(cost).every(([rk,amount])=>Number.isFinite(S.res[rk])&&S.res[rk]>=amount))return{ok:false,reason:'insufficient-resources',cost};
  const oldLevel=S.scholarMasteryLv,oldRes={...S.res};
  for(const[rk,amount]of Object.entries(cost))S.res[rk]-=amount;
  S.scholarMasteryLv++;
  const written=save();
  if(!written.ok){S.res=oldRes;S.scholarMasteryLv=oldLevel;return{ok:false,reason:'save-failed'}}
  if(typeof addLog==='function')addLog('科研精通升至 Lv'+S.scholarMasteryLv);
  if(typeof updateUI==='function')updateUI();
  return{ok:true,level:S.scholarMasteryLv,cost};
}
function steelMasteryCost(level=S.steelMasteryLv){
  const cfg=CFG.steelMastery;
  if(!Number.isSafeInteger(level)||level<0||level>=cfg.maxLevel)return null;
  const next=level+1,cost={tech:cfg.techBase*next};
  if(level>=5)cost.medal=cfg.lateMedalBase*next;
  return cost;
}
function upgradeSteelMastery(){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const cfg=CFG.steelMastery;
  if(!scienceUnlocked(cfg.needScience))return{ok:false,reason:'science-prerequisite'};
  if(S.steelMasteryLv>=cfg.maxLevel)return{ok:false,reason:'max-level'};
  const cost=steelMasteryCost();
  if(!cost||!Object.entries(cost).every(([rk,amount])=>Number.isFinite(S.res[rk])&&S.res[rk]>=amount))return{ok:false,reason:'insufficient-resources',cost};
  const oldLevel=S.steelMasteryLv,oldRes={...S.res};
  for(const[rk,amount]of Object.entries(cost))S.res[rk]-=amount;
  S.steelMasteryLv++;
  const written=save();
  if(!written.ok){S.res=oldRes;S.steelMasteryLv=oldLevel;return{ok:false,reason:'save-failed'}}
  if(typeof addLog==='function')addLog('冶钢精通升至 Lv'+S.steelMasteryLv);
  if(typeof updateUI==='function')updateUI();
  return{ok:true,level:S.steelMasteryLv,cost};
}
function weaponForgeSteps(key,level=S.weaponForge[key]?.level){
  const cfg=CFG.weaponForge[key];
  if(!cfg||!Number.isSafeInteger(level)||level<0)return NaN;
  if(level>=cfg.maxLevel)return Infinity;
  return level===0?cfg.firstSteps:cfg.nextStepBase+cfg.nextStepPerLevel*level;
}
function weaponForgeStepCost(key,level=S.weaponForge[key]?.level){
  const cfg=CFG.weaponForge[key];
  if(!cfg||!Number.isSafeInteger(level)||level<0||level>=cfg.maxLevel)return null;
  return cfg.lateStepCost&&level>=cfg.lateFromLevel?cfg.lateStepCost:cfg.stepCost;
}
function armsUpBonus(uk,stat){
  const cfg=CFG.armsUp[uk]?.stats[stat],stars=S.armsUp[uk]?.[stat]?.stars;
  if(!cfg||!Number.isSafeInteger(stars)||stars<0)return 0;
  let bonus=stars*cfg.perStar;
  const milestone=CFG.armsUpMilestones?.[stat];
  if(milestone&&Number.isSafeInteger(milestone.everyStars)&&milestone.everyStars>0&&Number.isFinite(milestone.basePct)&&milestone.basePct>0){
    const configured=CFG.units[uk];
    const base=stat==='hp'?Math.round((configured?.hpPerSoldier||1)*100):configured?.[stat];
    if(Number.isFinite(base)&&base>0){
      const tiers=Math.floor(stars/milestone.everyStars);
      const sourceBonus=Math.floor(base*tiers*milestone.basePct);
      bonus+=stat==='hp'?sourceBonus/100:sourceBonus;
    }
  }
  return bonus;
}
// 同一兵装维度累计1000次得一星；批量仅合并玩家本可逐次完成的等价投入。
function investArmsUp(uk,stat,times=1){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const cfg=CFG.armsUp[uk];
  if(!cfg||!Object.prototype.hasOwnProperty.call(cfg.stats,stat))return{ok:false,reason:'unknown-upgrade'};
  if(!scienceUnlocked(cfg.needScience))return{ok:false,reason:'science-prerequisite'};
  if(!Number.isSafeInteger(times)||times<1||times>cfg.stepsPerStar)return{ok:false,reason:'invalid-count'};
  const current=S.armsUp[uk][stat],cost=cfg.stepCost*times;
  const total=current.progress+times,stars=current.stars+Math.floor(total/cfg.stepsPerStar);
  if(!Number.isSafeInteger(cost)||!Number.isSafeInteger(stars))return{ok:false,reason:'numeric-limit'};
  if(!Number.isFinite(S.res[cfg.material])||S.res[cfg.material]<cost)return{ok:false,reason:'insufficient-resources',cost};
  const oldStock=S.res[cfg.material],oldStars=current.stars,oldProgress=current.progress;
  S.res[cfg.material]-=cost;
  current.stars=stars;current.progress=total%cfg.stepsPerStar;
  if(!save().ok){S.res[cfg.material]=oldStock;current.stars=oldStars;current.progress=oldProgress;return{ok:false,reason:'save-failed'}}
  if(typeof addLog==='function')addLog(cfg.name+'·'+cfg.stats[stat].name+'投入'+times+'次'+(stars>oldStars?'，升至'+stars+'星':''));
  if(typeof updateUI==='function')updateUI();
  return{ok:true,cost,stars:current.stars,progress:current.progress};
}
function weaponAttack(uk){
  const base=CFG.units[uk]?.atk||0;
  const doses=Object.prototype.hasOwnProperty.call(S.attackInfusions,uk)?S.attackInfusions[uk]:0;
  const aegis=Object.prototype.hasOwnProperty.call(S.aegisInfusions,uk)?S.aegisInfusions[uk]:0;
  return Object.entries(CFG.weaponForge).reduce((atk,[key,cfg])=>{
    const w=S.weaponForge[key];
    return atk+(cfg.unit===uk&&cfg.stat!=='def'&&w?.equipped&&w.level>0?cfg.initialAtk+(w.level-1)*cfg.perLevelAtk:0);
  },base+armsUpBonus(uk,'atk')+Math.floor(base*(S.soulRanks[uk]?.rank||0)/2)+base*(awakeningTotalStars()*CFG.awakening.globalStatPerStar+
    doses*CFG.emberElixir.atkPerUse+aegis*CFG.aegisElixir.atkPerUse));
}
function weaponDefense(uk){
  const base=CFG.units[uk]?.def||0;
  const aegis=Object.prototype.hasOwnProperty.call(S.aegisInfusions,uk)?S.aegisInfusions[uk]:0;
  return Object.entries(CFG.weaponForge).reduce((def,[key,cfg])=>{
    const w=S.weaponForge[key];
    return def+(cfg.unit===uk&&cfg.stat==='def'&&w?.equipped&&w.level>0?cfg.initialDef+(w.level-1)*cfg.perLevelDef:0);
  },base+armsUpBonus(uk,'def')+aegis*CFG.aegisElixir.defPerUse);
}
function equippedWeaponSkills(uk){
  if(uk==='armored_trooper')return{sweep:!!S.weaponForge.gatling?.equipped,bombard:!!S.weaponForge.mortar?.equipped};
  if(uk==='star_trooper')return{starFighter:!!S.weaponForge.starFighter?.equipped,starMissile:!!S.weaponForge.starMissile?.equipped};
  if(uk!=='electro_trooper')return{};
  return{rapid:!!S.weaponForge.electroRifle?.equipped,snipe:!!S.weaponForge.electroSniper?.equipped,
    energy:!!S.weaponForge.energyArmor?.equipped,nano:!!S.weaponForge.nanoArmor?.equipped};
}
function steamSweepActive(actor,enemies){
  return !!actor.weaponSkills?.sweep&&enemies.some(u=>u.row==='front'&&u.alive!==false&&u.hp>0)
    &&enemies.reduce((n,u)=>n+(u.alive===false?0:combatSurvivors(u)),0)>50;
}
// 蒸汽武器只改本场敌人体。扫射替换普攻，迫击炮在首次命中后额外打前排。
function applySteamWeaponSkillHits(actor,enemies,primaryTarget,baseDamage,sweep,firstMortarAttack){
  const result={swept:false,bombarded:false,totalDamage:0,totalHpLost:0,healed:0,defAdded:0,primary:{hpLost:0,shieldLost:0,casualties:0},hits:[]};
  if(!actor.weaponSkills||!Number.isFinite(baseDamage)||baseDamage<=0)return result;
  const front=enemies.filter(u=>u.row==='front'&&u.alive!==false&&u.hp>0);
  const entryHp=(actor.initialCount||0)*(actor.hpPerSoldier||1);
  const bonus=1+Math.floor(entryHp/1300)*0.3;
  function hit(unit,amount){
    if(unit.alive===false||unit.hp<=0)return;
    const dealt=applyCombatDamage(unit,Math.max(1,Math.floor(amount)),actor);
    result.totalDamage+=dealt.hpLost+dealt.shieldLost;result.totalHpLost+=dealt.hpLost;
    result.healed+=dealt.healed||0;result.defAdded+=dealt.defAdded||0;
    result.hits.push({unit,hpLost:dealt.hpLost});
    if(unit===primaryTarget){result.primary.hpLost+=dealt.hpLost;result.primary.shieldLost+=dealt.shieldLost;result.primary.casualties+=dealt.casualties}
  }
  if(sweep){
    for(const unit of front){
      hit(unit,baseDamage*0.3*bonus);
      if(unit.alive!==false&&unit.hp>0&&Math.random()<0.1)unit.def=Math.max(0,unit.def-1);
    }
    result.swept=front.length>0;
  }
  if(firstMortarAttack){
    for(const unit of front)hit(unit,baseDamage*1.2*bonus);
    result.bombarded=front.length>0;
  }
  return result;
}
// 仅在本场首次出手前改变战斗体。以入场总生命/防御计算，不把额外生命写回常驻兵员。
function applyArmorOpeningSkills(actor){
  const result={hpAdded:0,defConverted:0,atkAdded:0};
  if(!actor.weaponSkills||actor.armorOpeningUsed)return result;
  actor.armorOpeningUsed=true;
  const entryHp=Math.max(0,(actor.initialCount||0)*(actor.hpPerSoldier||1));
  const lifeTier=Math.floor(entryHp/550);
  if(actor.weaponSkills.energy){
    actor.survivorCap=combatSurvivors(actor);
    result.hpAdded=Math.floor(entryHp*0.2*(1+lifeTier*0.15));
    actor.maxHp+=result.hpAdded;actor.hp+=result.hpAdded;
  }
  if(actor.weaponSkills.nano){
    result.defConverted=Math.max(0,actor.entryDef??actor.def);
    result.atkAdded=Math.floor(result.defConverted*(1+lifeTier*0.3));
    actor.def=Math.max(0,actor.def-result.defConverted);
    actor.atk+=result.atkAdded;
  }
  return result;
}
// 技能效果只写入本场战斗单位。进场生命按单兵值计算，避免兵团人数被误当成技能倍率。
function applyElectroWeaponSkillHits(actor,target,baseDamage,firstSniperAttack){
  const result={damage:0,hpLost:0,shieldLost:0,casualties:0,hits:0,sniped:false,snipeDamage:0,rapidHits:0,defReduced:0,healed:0,defAdded:0};
  if(!actor.weaponSkills||!Number.isFinite(baseDamage)||baseDamage<=0||target.alive===false||target.hp<=0)return result;
  const lifeTier=Math.max(0,Math.floor((actor.hpPerSoldier||1)/5.5));
  const bonus=1+lifeTier*0.3;
  function hit(amount){
    if(target.alive===false||target.hp<=0)return;
    const dealt=applyCombatDamage(target,Math.max(1,Math.floor(amount)),actor);
    result.damage+=dealt.hpLost+dealt.shieldLost;result.hpLost+=dealt.hpLost;
    result.shieldLost+=dealt.shieldLost;result.casualties+=dealt.casualties;result.hits++;
    result.healed+=dealt.healed||0;result.defAdded+=dealt.defAdded||0;
  }
  if(actor.weaponSkills.snipe&&firstSniperAttack){
    const def=Math.max(0,target.def||0);
    const pierceRatio=(100+def*8)/(100+def*0.3*8);
    const before=result.damage;
    hit(baseDamage*1.3*bonus*pierceRatio);
    result.snipeDamage=result.damage-before;
    if(target.alive!==false&&target.hp>0){
      const old=target.def;
      target.def=Math.max(0,target.def-(30+lifeTier*10));
      result.defReduced=old-target.def;
    }
    result.sniped=true;
  }
  if(actor.weaponSkills.rapid)for(let i=0;i<5;i++){
    const before=result.hits;hit(baseDamage*0.32*bonus);
    result.rapidHits+=result.hits-before;
  }
  return result;
}
// 母本230082/083按单兵结算；本游戏将首次出手映射到兵团，真实伤害绕过防御但仍由临时护盾承受。
function applyStarWeaponSkillHits(actor,target,baseDamage,firstAttack){
  const result={fighter:false,missile:false,replacesNormal:false,hpLost:0,shieldLost:0,casualties:0,defReduced:0,healed:0,defAdded:0};
  if(!firstAttack||actor.type!=='star_trooper'||!actor.weaponSkills||target.alive===false||target.hp<=0)return result;
  const fighter=CFG.starWeaponSkills.fighter,missile=CFG.starWeaponSkills.missile;
  const hpPerSoldier=Math.max(0,actor.hpPerSoldier||0),survivors=combatSurvivors(actor);
  const enemyCount=target.initialCount||0;
  const missileReady=actor.weaponSkills.starMissile&&enemyCount>=missile.minEnemyCount&&target.hp>target.maxHp*missile.readyHpPct;
  function hit(amount){
    if(target.alive===false||target.hp<=0||!Number.isFinite(amount)||amount<=0)return;
    const dealt=applyCombatDamage(target,Math.max(1,Math.floor(amount)),actor);
    result.hpLost+=dealt.hpLost;result.shieldLost+=dealt.shieldLost;result.casualties+=dealt.casualties;
    result.healed+=dealt.healed||0;result.defAdded+=dealt.defAdded||0;
  }
  if(actor.weaponSkills.starFighter&&Number.isFinite(baseDamage)&&baseDamage>0){
    const tier=Math.floor(hpPerSoldier/fighter.hpStep);
    const attack=Math.max(1,Math.floor(baseDamage*fighter.attackPct*(1+tier*fighter.damagePerHpStep)));
    const beastBonus=target.starBeast===true?Math.min(target.hp*fighter.beastCurrentHpPct,
      Math.max(0,actor.atk)*survivors*fighter.beastCapAtk*fighter.sourceHpScale):0;
    hit(attack+beastBonus);
    if(target.alive!==false&&target.hp>0){const before=target.def;target.def=Math.max(0,before-fighter.defBreak-tier*fighter.defPerHpStep);result.defReduced+=before-target.def;}
    result.fighter=true;result.replacesNormal=true;
  }
  if(missileReady&&target.alive!==false&&target.hp>0){
    const tier=Math.floor(hpPerSoldier/missile.hpStep);
    const targetCount=Math.min(missile.maxTargets,enemyCount);
    const raw=Math.max(0,actor.atk)*survivors*targetCount*missile.attackPct*missile.sourceHpScale*(1+tier*missile.damagePerHpStep);
    // 母本每个目标的生命最多降至一半；兵团总生命用同一比例封顶。
    const cap=Math.max(0,target.hp-target.maxHp*missile.readyHpPct);
    hit(Math.min(raw,cap));
    if(target.alive!==false&&target.hp>0){const before=target.def;target.def=Math.max(0,before-missile.defBase-Math.floor(hpPerSoldier/missile.defStep));result.defReduced+=before-target.def;}
    result.missile=true;
  }
  return result;
}
function weaponCostStock(key){return Object.prototype.hasOwnProperty.call(CFG.eraMaterials,key)?S.items[key]:S.res[key]}
function canAffordWeaponCost(cost){
  return Object.entries(cost).every(([key,amount])=>Number.isFinite(weaponCostStock(key))&&weaponCostStock(key)>=amount);
}
function debitWeaponCost(cost){
  for(const [key,amount]of Object.entries(cost)){
    if(Object.prototype.hasOwnProperty.call(CFG.eraMaterials,key))S.items[key]-=amount;
    else S.res[key]-=amount;
  }
}
function researchWeapon(key){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const cfg=CFG.weaponForge[key];if(!cfg)return{ok:false,reason:'unknown-weapon'};
  if(!scienceUnlocked(cfg.needScience))return{ok:false,reason:'science-prerequisite'};
  if(cfg.needWeapon&&!S.weaponForge[cfg.needWeapon]?.researched)return{ok:false,reason:'weapon-prerequisite'};
  const state=S.weaponForge[key];if(state.researched)return{ok:false,reason:'already-researched'};
  if(!Object.entries(cfg.researchCost).every(([rk,amount])=>Number.isFinite(S.res[rk])&&S.res[rk]>=amount))return{ok:false,reason:'insufficient-resources',cost:cfg.researchCost};
  const oldRes={...S.res};
  for(const[rk,amount]of Object.entries(cfg.researchCost))S.res[rk]-=amount;
  state.researched=true;
  if(!save().ok){S.res=oldRes;state.researched=false;return{ok:false,reason:'save-failed'}}
  if(typeof addLog==='function')addLog('完成军备研发：'+cfg.name);
  if(typeof updateUI==='function')updateUI();
  return{ok:true,cost:cfg.researchCost};
}
function forgeWeapon(key){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const cfg=CFG.weaponForge[key];if(!cfg)return{ok:false,reason:'unknown-weapon'};
  const state=S.weaponForge[key];
  if(!scienceUnlocked(cfg.needScience)||!state.researched)return{ok:false,reason:'science-prerequisite'};
  if(state.level>=cfg.maxLevel)return{ok:false,reason:'max-level'};
  const cost=weaponForgeStepCost(key);
  if(!canAffordWeaponCost(cost))return{ok:false,reason:'insufficient-resources',cost};
  const oldRes={...S.res},oldItems={...S.items},oldLevel=state.level,oldProgress=state.progress;
  debitWeaponCost(cost);
  state.progress++;
  if(state.progress>=weaponForgeSteps(key,oldLevel)){state.level++;state.progress=0}
  if(!save().ok){S.res=oldRes;S.items=oldItems;state.level=oldLevel;state.progress=oldProgress;return{ok:false,reason:'save-failed'}}
  if(typeof addLog==='function')addLog(cfg.name+'锻造投入 '+(state.level>oldLevel?'升至 Lv'+state.level:state.progress+'/'+weaponForgeSteps(key)));
  if(typeof updateUI==='function')updateUI();
  return{ok:true,level:state.level,progress:state.progress,cost};
}
function setWeaponEquipped(key,equipped){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const cfg=CFG.weaponForge[key];if(!cfg)return{ok:false,reason:'unknown-weapon'};
  const state=S.weaponForge[key];
  if(typeof equipped!=='boolean')return{ok:false,reason:'invalid-choice'};
  if(equipped&&(!state.researched||state.level<1))return{ok:false,reason:'not-forged'};
  if(state.equipped===equipped)return{ok:true,repeat:true};
  const old=state.equipped;state.equipped=equipped;
  if(!save().ok){state.equipped=old;return{ok:false,reason:'save-failed'}}
  if(typeof addLog==='function')addLog((equipped?'装备':'卸下')+cfg.name);
  if(typeof updateUI==='function')updateUI();
  return{ok:true,equipped};
}
function eraStorageCost(key){
  const cfg=CFG.eraStorage[key];if(!cfg)return null;
  const level=S.eraStorage[key];if(!Number.isSafeInteger(level)||level<0||level>=cfg.maxLevel)return null;
  const next=level+1,cost={tech:cfg.techBase*next};
  if(level>=5)cost[cfg.lateMaterial||'godCrystal']=(cfg.lateMaterialBase??cfg.lateCrystalBase)*next;
  return cost;
}
function upgradeEraStorage(key){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  const cfg=CFG.eraStorage[key];if(!cfg)return{ok:false,reason:'unknown-research'};
  if(!scienceUnlocked(cfg.needScience))return{ok:false,reason:'science-prerequisite'};
  if(S.eraStorage[key]>=cfg.maxLevel)return{ok:false,reason:'max-level'};
  const cost=eraStorageCost(key);
  if(!cost||!Number.isFinite(S.res.tech)||S.res.tech<cost.tech)return{ok:false,reason:'insufficient-resources',cost};
  const material=cfg.lateMaterial||'godCrystal';
  if(cost[material]&&(!Number.isSafeInteger(S.items[material])||S.items[material]<cost[material]))return{ok:false,reason:'insufficient-items',cost};
  const oldTech=S.res.tech,oldMaterial=S.items[material],oldLevel=S.eraStorage[key];
  S.res.tech-=cost.tech;
  if(cost[material])S.items[material]-=cost[material];
  S.eraStorage[key]++;
  const written=save();
  if(!written.ok){S.res.tech=oldTech;S.items[material]=oldMaterial;S.eraStorage[key]=oldLevel;return{ok:false,reason:'save-failed'}}
  if(typeof addLog==='function')addLog(cfg.name+'升至 Lv'+S.eraStorage[key]);
  if(typeof updateUI==='function')updateUI();
  return{ok:true,level:S.eraStorage[key],cost};
}
function switchMetalRecipeMode(){
  if(_saveProtected)return{ok:false,reason:'save-protected'};
  if(S.metalRecipeMode!=='legacy')return{ok:false,reason:'already-coal'};
  if(!scienceUnlocked('sci_coal'))return{ok:false,reason:'need-sci-coal'};
  S.metalRecipeMode='coal';
  const overCap=['copper','iron'].filter(rk=>(S.res[rk]||0)>resCap(rk));
  const written=save();
  if(!written.ok){S.metalRecipeMode='legacy';return{ok:false,reason:'save-failed'}}
  if(typeof addLog==='function')addLog('已切换煤链冶炼配方');
  if(typeof updateUI==='function')updateUI();
  return{ok:true,overCap};
}

// 切片12：推进"计时类"进度（城镇升级 + 建筑建造/升级/tier）——tick 传 1（逐秒），离线传 secs（闭式）
// 说明：本函数由原 tick() 内联块等价抽出（equiv 用"全开关关闭 ⇒ 与 HEAD 逐字节相同"守护该等价性）
function advanceBuildingsBy(secs){
  let ch=false;
  if(S.townUpgrade){
    S.townUpgrade.timer-=secs;
    if(S.townUpgrade.timer<=0){
      S.townLv++;
      // v3 及更早已支付的升级照常完成；容量至少达到历史等级的原定上限。
      S.population.legacyBonus=Math.max(S.population.legacyBonus,townCfg().maxPop-settlementCapacity());
      addLog(`城镇升级为${townCfg().name}，村民上限${maxPop()}`);
      S.townUpgrade=null;ch=true;
    }
  }
  for(const k of Object.keys(CFG.buildings)){
    const st=bldSt(k);
    if((st.state==='building'||st.state==='upgrading'||st.state==='tier_upgrading')&&st.timerEnd>0){
      st.timer-=secs;if(st.timer<=0){
        if(st.state==='building'){st.lv=1;addLog(`${CFG.buildings[k].name}建成`)}
        else if(st.state==='tier_upgrading'){
          refundUnitsByLine(k);  // 先退旧时代兵再升tier
          st.tier=(st.tier||0)+1;
          addLog(`${CFG.buildings[k].name}升级到T${st.tier}`);
        }
        else{st.lv++;addLog(`${CFG.buildings[k].name}→Lv.${st.lv}`)}
        st.state='idle';st.timer=0;st.timerEnd=0;ch=true;
      }
    }
  }
  return ch;
}
function tick(){
  if(_saveProtected)return;
  if(S.offline?.populationFoodRule==='legacy-pending'){
    settleOffline();
    if(_saveProtected||S.offline?.populationFoodRule==='legacy-pending')return;
  }
  S.tick++;advanceBeastExchangeSecond();if(S.battleActive)return;
  let ch=advanceBuildingsBy(1);
  if(ch)save();processQueue();
  const beforeDevelopment=S.development;
  const candidate=productionAndDevelopmentSecond(1);
  S.res=candidate.res;
  S.development=candidate.development;
  S.res.food=Math.max(0,S.res.food); // 在线持续运行：断粮时停止于 0；离线则在该秒前截断
  const marketBefore=S.marketSpecial.clockSec<=1?JSON.parse(JSON.stringify(S.marketSpecial)):null;
  const marketRefreshed=advanceMarketSpecialSecond();
  const populationChanged=advancePopulationOnlineSecond();
  // 死亡机制：粮尽扣人口（开关控制，默认关）
  if(CFG.pop&&CFG.pop.death===true&&S.res.food<=0&&S.tick%5===0&&popAllocTotal()>0){
    const tracks=Object.keys(S.popAlloc).filter(k=>(S.popAlloc[k]||0)>0);
    if(tracks.length){
      const vk=tracks[Math.floor(Math.random()*tracks.length)];
      S.popAlloc[vk]=Math.max(0,(S.popAlloc[vk]||0)-1);
      if(typeof logDiag==='function')logDiag('pop-death',vk+' -1 (food=0)');
    }
  }
  // 点位周期到点即落盘。失败只撤本次点位增量和时钟，岗位同秒产出沿用既有 tick 语义。
  if(candidate.collected){
    const written=save();
    if(!written.ok){
      S.development=beforeDevelopment;
      S.res[candidate.resource]=candidate.beforeResource;
      if(marketRefreshed)S.marketSpecial=marketBefore;
    }
  }
  if(typeof garrisonTick==='function')garrisonTick();
  if(!candidate.collected&&(marketRefreshed||populationChanged||S.tick%60===0)){
    const written=save();
    if(!written.ok&&marketRefreshed)S.marketSpecial=marketBefore;
  }
  updateUI();
}

// ==================== 操作 ====================
function buildingScienceUnlocked(key){
  const cfg=CFG.buildings[key];
  if(!cfg)return false;
  if(cfg.legacyStorageBypassScience&&S.storageMode==='legacy')return true;
  return !cfg.needScience||S.sciences.includes(cfg.needScience)||
    !!(cfg.grandfatherBuiltScience&&bldSt(key).lv>0);
}
function buildingInitialCost(key){
  const cfg=CFG.buildings[key];
  return cfg?.alignedBuild&&S.storageMode==='aligned'?cfg.alignedBuild:cfg?.build;
}
function buildAct(key){
  const cfg=CFG.buildings[key];
  if(!cfg)return{ok:false,reason:'unknown-building'};
  if(_saveProtected){toast('存档保护中，无法建设');return{ok:false,reason:'save-protected'}}
  const st=bldSt(key);
  if(!buildingScienceUnlocked(key)){toast('需先研究「'+sciName(cfg.needScience)+'」');return{ok:false,reason:'need-science'}}
  if(cfg.needBoss && bossDefeatedCount()<cfg.needBoss){toast(`击败${cfg.needBoss}个Boss后解锁`);return{ok:false,reason:'need-boss'}}
  if(st.state!=='idle'){toast(st.state==='building'?'建造中':'升级中');return{ok:false,reason:'building-busy'}}
  const upLock=st.lv>0?upgradeLockReason(key):'';
  if(upLock){toast(upLock);return{ok:false,reason:'upgrade-locked'}}
  const rawCost=st.lv===0?buildingInitialCost(key):upCost(key);
  const cost={...rawCost, time:buildTime(Math.min(rawCost.time, CFG.maxUpgradeTime||120))};
  const payment=Object.entries(cost).filter(([rk])=>rk!=='time');
  if(payment.some(([rk,amount])=>!CFG.res[rk]||!Number.isFinite(amount)||amount<0))return{ok:false,reason:'invalid-cost'};
  if(payment.some(([rk,amount])=>!Number.isFinite(S.res[rk])||S.res[rk]<amount)){toast('资源不足');return{ok:false,reason:'resources'}}
  const oldRes={...S.res};
  const oldBuilding=S.buildings[key]?{...S.buildings[key]}:null;
  for(const [rk,amount] of payment)S.res[rk]-=amount;
  if(!S.buildings[key])S.buildings[key]={lv:0,state:'idle',timer:0,timerEnd:0,tier:(CFG.buildings[key]?.tier||0)};
  const bs=S.buildings[key];
  if(bs.lv===0){bs.state='building';bs.timerEnd=cost.time;bs.timer=cost.time}
  else{bs.state='upgrading';bs.timerEnd=cost.time;bs.timer=cost.time}
  const written=save();
  if(!written.ok){
    S.res=oldRes;
    if(oldBuilding)S.buildings[key]=oldBuilding;else delete S.buildings[key];
    toast('保存失败，建设未生效');updateUI();
    return{ok:false,reason:'save-failed'};
  }
  addLog(`${bs.lv===0?'开始建造':'开始升级'}${cfg.name}`);
  updateUI();
  return{ok:true};
}
function tierUpgradeLockReason(key){
  const cfg=CFG.buildings[key];
  if(!cfg)return '未知建筑';
  if(_saveProtected)return '存档保护中，无法升级营地';
  const st=bldSt(key);
  if(!cfg.tierUpgrade||!cfg.tierUpgrade.length)return '无法时代升级';
  if(st.lv<1)return '需先建造'+cfg.name;
  const currentTier=st.tier||0;
  if(currentTier>=4)return '已达最高时代';
  if(!cfg.tierUpgrade[currentTier])return '无法继续升级';
  if(st.state!=='idle'){
    if(st.state==='building')return '建造中';
    if(st.state==='upgrading')return '升级中';
    if(st.state==='tier_upgrading')return '时代升级中';
    return '建设中';
  }
  const upg=cfg.tierUpgrade[currentTier];
  if(upg.needBossId&&!S.defeated.includes(upg.needBossId)){
    const be=CFG.enemies.find(e=>e.id===upg.needBossId);
    return `需击败第${upg.needBossId}关「${be?.name||'?'}」`;
  }
  const cost=upg.cost;
  if(S.res.wood<cost.wood||S.res.stone<cost.stone||S.res.food<cost.food)return '资源不足';
  return '';
}
function tierUpgradeCost(key){
  const cfg=CFG.buildings[key],st=bldSt(key);
  const currentTier=st.tier||0;
  const upg=cfg.tierUpgrade?.[currentTier];
  if(!upg)return null;
  return {wood:upg.cost.wood,stone:upg.cost.stone,food:upg.cost.food,time:buildTime(Math.min(upg.time||30,CFG.maxUpgradeTime||120))};
}
function buildTierUpgradeAct(key){
  const reason=tierUpgradeLockReason(key);
  if(reason){toast(reason);return{ok:false,reason}}
  const cfg=CFG.buildings[key],st=bldSt(key);
  const currentTier=st.tier||0;
  const upg=cfg.tierUpgrade?.[currentTier];
  const cost=upg.cost;
  const time=buildTime(Math.min(upg.time||30,CFG.maxUpgradeTime||120));
  const before={wood:S.res.wood,stone:S.res.stone,food:S.res.food,building:{...S.buildings[key]}};
  S.res.wood-=cost.wood;S.res.stone-=cost.stone;S.res.food-=cost.food;
  S.buildings[key].state='tier_upgrading';
  S.buildings[key].timerEnd=time;
  S.buildings[key].timer=time;
  const written=save();
  if(!written.ok){
    S.res.wood=before.wood;S.res.stone=before.stone;S.res.food=before.food;S.buildings[key]=before.building;
    const failure='保存失败，营地时代升级未生效';
    toast(failure);updateUI();
    return{ok:false,reason:failure};
  }
  addLog(`开始升级${cfg.name}至T${currentTier+1}`);
  updateUI();
  return{ok:true,tier:currentTier+1};
}
// 时代升级时退还旧时代兵力：遍历 pool + 远征阵容 + 驻军阵容，退还同线且 tier <= maxTier 的单位
// maxTier 可选，默认取建筑当前 tier（建筑升级时），技术研究时传入旧单位 tier
function refundUnitsByLine(buildingKey, maxTier){
  const cfg=CFG.buildings[buildingKey];
  if(!cfg||!cfg.trains)return;
  const lineKey=cfg.trains;
  const threshold=maxTier??(S.buildings[buildingKey]?.tier??0);
  let totalRefund={wood:0,stone:0,food:0}, totalCount=0;
  function refund(uk,count){
    const uc=CFG.units[uk];
    if(!uc||!count)return;
    if((uc.tier??0) > threshold)return;
    const cost=uc.cost||{};
    totalRefund.wood+=Math.floor((cost.wood||0)*count);
    totalRefund.stone+=Math.floor((cost.stone||0)*count);
    totalRefund.food+=Math.floor((cost.food||0)*count);
    totalCount+=count;
  }
  // pool
  for(const[uk,count] of Object.entries(S.pool)){
    if(!count || baseUnitType(uk)!==lineKey)continue;
    refund(uk,count);
    S.pool[uk]=0;
  }
  // 远征阵容
  for(const row of['front','mid','back']){
    S.formation[row]=S.formation[row].filter(u=>{
      if(baseUnitType(u.type)!==lineKey)return true;
      refund(u.type,u.count);
      return false;
    });
  }
  // 驻军阵容
  for(const row of['front','mid','back']){
    S._garrisonForm[row]=(S._garrisonForm[row]||[]).filter(u=>{
      if(baseUnitType(u.type)!==lineKey)return true;
      refund(u.type,u.count);
      return false;
    });
  }
  // 训练队列（取消即可，资源在产出时才扣除所以无需退款）
  for(const[uk,q] of Object.entries(S.queue)){
    if(baseUnitType(uk)!==lineKey)continue;
    const uc=CFG.units[uk];
    if(!uc||(uc.tier??0)>threshold)continue;
    q.count=0;q.timer=0;q.reason='';
  }
  if(totalCount>0){
    for(const rk of['wood','stone','food']){
      const before=S.res[rk]||0;
      S.res[rk]=Math.min(Math.max(before,resCap(rk)),before+totalRefund[rk]);
    }
    addLog(`退还${totalCount}名旧时代士兵，木${totalRefund.wood}石${totalRefund.stone}食${totalRefund.food}`);
  }
}
function upgradeTown(){
  const reason='城镇等级升级已停用，请在聚落中扩建村庄、小镇或城市';
  if(typeof toast==='function')toast(reason);
  return{ok:false,reason};
}
function setPopAlloc(rk,v){
  if(_saveProtected){toast('存档保护中，无法分配村民');return{ok:false,reason:'save-protected'}}
  if(!isWorkerResource(rk)||!Number.isFinite(v)){toast('无效的村民分配');return{ok:false,reason:'invalid-allocation'}}
  const nv=Math.max(0,Math.min(Math.floor(v),999));
  const hadAllocation=Object.prototype.hasOwnProperty.call(S.popAlloc,rk);
  const old=S.popAlloc[rk]||0;
  const diff=nv-old;
  const lock=workerLockReason(rk);
  if(diff>0&&lock){toast(lock);return{ok:false,reason:'worker-locked'}}
  if(diff>0&&popFree()<diff){toast(`空闲村民不足，最多${popAllocTotal()+popFree()}`);return}
  S.popAlloc[rk]=nv;
  const written=save();
  if(!written.ok){
    if(hadAllocation)S.popAlloc[rk]=old;else delete S.popAlloc[rk];
    toast('保存失败，村民分配未生效');updateUI();
    return{ok:false,reason:'save-failed'};
  }
  updateUI();
  return{ok:true};
}
// 建筑升级消耗计算
// 仓储沿用各自仓容费用曲线；显式映射的工坊建筑沿用母本分段费用，其余建筑保留原倍率曲线。
// 升级时间统一线性增长，不受 upCostLv 影响
function repertoryCostMultiplier(lv,step){
  const breaks=CFG.storageCostBreaks,pivot=breaks[0]-1;
  let slope=1;
  for(const threshold of breaks)if(lv>=threshold)slope++;
  return 1+(lv<pivot?lv:pivot+(lv-pivot)*slope)/step;
}
function workshopUpgradeCost(base,lv,divisor,curve){
  const unit=base/divisor;
  const breaks=curve.breaks,slopes=curve.slopes;
  if(lv<breaks[0])return base+lv*unit*slopes[0];
  let slopeIndex=0;
  for(const threshold of breaks)if(lv>=threshold)slopeIndex++;
  const slope=slopes[Math.min(slopeIndex,slopes.length-1)];
  const pivot=breaks[0]-1;
  return base+pivot*unit*slopes[0]+(lv-pivot)*unit*slope;
}
function upCost(key){
  const cfg=CFG.buildings[key],lv=bldSt(key).lv||1;
  if(cfg.alignedUpBase&&S.storageMode==='aligned'){
    const cost={};
    for(const [rk,amount] of Object.entries(cfg.alignedUpBase))if(CFG.res[rk])cost[rk]=Math.ceil(amount*repertoryCostMultiplier(lv,cfg.alignedStorageCostStep));
    const bt=CFG.buildingTimes;
    return{...cost,time:buildTime(Math.min(bt.otherBase+lv*bt.otherPerLv,CFG.maxUpgradeTime||120))};
  }
  const b=cfg.upBase;
  const isStorage=!!(cfg.storagePerLv||cfg.storageFor);
  const isCap1=cfg.buffRes||(!cfg.trains&&!cfg.storagePerLv&&!cfg.storageFor&&!cfg.buffRes);
  const bt=CFG.buildingTimes;
  const rawTime=isCap1?bt.cap1Base+lv*bt.cap1PerLv:bt.otherBase+lv*bt.otherPerLv;
  const time=buildTime(Math.min(rawTime, CFG.maxUpgradeTime||120));
  if(cfg.storageCostStep){
    const cost={};
    for(const [rk,amount] of Object.entries(b))if(CFG.res[rk])cost[rk]=Math.ceil(amount*repertoryCostMultiplier(lv,cfg.storageCostStep));
    return{...cost,time};
  }
  const cost={};
  if(isStorage){
    for(const [rk,amount] of Object.entries(b))if(CFG.res[rk])cost[rk]=Math.ceil(amount*lv);
    return{...cost,time};
  }
  if(cfg.upCostModel==='workshop'){
    const curve=CFG.workshopCostCurve;
    const divisor=cfg.upCostDivisor??curve.baseDivisor;
    for(const [rk,amount] of Object.entries(b))if(CFG.res[rk])cost[rk]=workshopUpgradeCost(amount,lv,divisor,curve);
  }else{
    const multiplier=Math.pow(cfg.upCostLv,lv);
    for(const [rk,amount] of Object.entries(b))if(CFG.res[rk])cost[rk]=Math.ceil(amount*multiplier);
  }
  return{...cost,time};
}
function maxTrainable(uk){
  if(trainLockReason(uk))return 0;
  return Math.max(0, queueMax(uk) - queueTotal(uk));
}
function train(uk,qty){
  if(_saveProtected){toast('存档保护中，无法训练');return{ok:false,reason:'save-protected'}}
  if(!CFG.units[uk])return{ok:false,reason:'unknown-unit'};
  qty=qty||1;
  qty=Math.max(1,Math.floor(qty));
  const lock=trainLockReason(uk);
  if(lock){toast(lock);return{ok:false,reason:'locked'}}
  const max=maxTrainable(uk);
  if(max<=0){toast('训练队列已满');return{ok:false,reason:'queue-full'}}
  if(qty>max){qty=max;toast('已按队列上限训练'+qty);}
  const before=S.queue[uk]?{...S.queue[uk]}:null;
  if(!S.queue[uk])S.queue[uk]={count:0,timer:0};
  S.queue[uk].count+=qty;
  if(S.queue[uk].timer<=0)S.queue[uk].timer=CFG.units[uk].trainTime||CFG.unitTrainTime||1;
  const written=save();
  if(!written.ok){
    if(before)S.queue[uk]=before;else delete S.queue[uk];
    toast('保存失败，训练队列未生效');updateUI();
    return{ok:false,reason:'save-failed'};
  }
  addLog('排队训练'+CFG.units[uk].name+'+'+qty+' (队列'+queueTotal(uk)+'/'+queueMax(uk)+')');
  updateUI();
  return{ok:true,qty};
}
function trainCustom(uk,inputId){
  const el=document.getElementById(inputId);
  const qty=Math.max(1,Math.floor(parseInt(el?.value,10)||1));
  train(uk,qty);
}
function adjTrainInput(uk,d){
  const el=document.getElementById('train-barracks-'+uk);
  if(!el)return;
  let v=(parseInt(el.value)||1)+d;
  if(v<1)v=1;
  if(d>0){const tm=maxTrainable(uk);if(v>tm)v=tm;}
  el.value=v;
}
function trainMax(uk,inputId){
  const qty=maxTrainable(uk);
  if(qty<=0){
    const lock=trainLockReason(uk);
    toast(lock||'训练队列已满');
    return;
  }
  const el=document.getElementById(inputId);
  if(el)el.value=qty;
  train(uk,qty);
}
function dismissN(uk,n){
  if(_saveProtected){toast('存档保护中，无法解散');return{ok:false,reason:'save-protected'}}
  if(!CFG.units[uk])return{ok:false,reason:'unknown-unit'};
  let qty=Math.max(1,Math.floor(n)||1);
  const before={queue:S.queue[uk]?{...S.queue[uk]}:null,pool:S.pool[uk],res:{...S.res}};
  const q=S.queue[uk];
  let fromQ=0;
  if(q&&q.count>0){
    fromQ=Math.min(q.count,qty);
    q.count-=fromQ;qty-=fromQ;
    if(q.count<=0){q.count=0;q.timer=0;q.reason='';}
  }
  const a=qty>0?poolAvail(uk):0;
  if(qty>0&&a<=0&&fromQ===0){
    const inExp=expeditionCount(uk),inGar=garrisonCount(uk);
    const hint=inExp+inGar>0?`（远征${inExp}人 驻军${inGar}人，需先撤下）`:'';
    toast('后备无可用士兵'+hint);return{ok:false,reason:'no-pool'};
  }
  const fromP=Math.min(a,qty);
  if(fromP>0)S.pool[uk]-=fromP;
  // 金属为已消耗军备，不返还；旧兵原有木石粮仍按一半返还。历史超仓不被此次动作裁剪。
  const cost=CFG.units[uk].cost;
  const refund={wood:Math.floor((cost.wood||0)*fromP*0.5),stone:Math.floor((cost.stone||0)*fromP*0.5),food:Math.floor((cost.food||0)*fromP*0.5)};
  for(const rk of ['wood','stone','food']){
    const stock=S.res[rk]||0;
    S.res[rk]=Math.min(Math.max(stock,resCap(rk)),stock+refund[rk]);
  }
  const written=save();
  if(!written.ok){
    if(before.queue)S.queue[uk]=before.queue;else delete S.queue[uk];
    if(before.pool===undefined)delete S.pool[uk];else S.pool[uk]=before.pool;
    S.res=before.res;
    toast('保存失败，解散未生效');updateUI();
    return{ok:false,reason:'save-failed'};
  }
  if(fromQ>0)addLog(`取消训练${CFG.units[uk].name}-${fromQ} (队列${S.queue[uk].count}人)`);
  if(fromP>0)addLog(`解散${CFG.units[uk].name}-${fromP}，返还木${refund.wood}石${refund.stone}食${refund.food}`);
  updateUI();
  return{ok:true,cancelled:fromQ,dismissed:fromP};
}
function cancelQueue(uk){
  const q=S.queue[uk];
  if(!q||q.count<=0){toast('队列为空');return}
  dismissN(uk, q.count);
}
function addRes(rk,inputId){
  const el=document.getElementById(inputId);
  const n=Math.max(1,Math.floor(parseInt(el?.value,10)||0));
  const before=S.res[rk]||0;
  S.res[rk]=Math.min(before+n,Math.max(before,resCap(rk)));
  addLog(`手动添加${CFG.res[rk].name}+${n}`);
  save();updateUI();
}
function addAllRes(inputId){
  const el=document.getElementById(inputId);
  const n=Math.max(1,Math.floor(parseInt(el?.value,10)||0));
  for(const rk of['wood','stone','food','tech']){
    const before=S.res[rk]||0,cap=rk==='tech'?999999:resCap(rk);
    S.res[rk]=Math.min(before+n,Math.max(before,cap));
  }
  addLog(`一键添加木/石/食/科技点各+${n}`);
  save();updateUI();
}
function addMerit(inputId){
  const el=document.getElementById(inputId);
  const n=Math.max(1,Math.floor(parseInt(el?.value,10)||0));
  S.merit=(S.merit||0)+n;
  addLog(`战功 +${n}`);
  save();updateUI();
}

function buildTime(t){ return S._fastBuild?1:t; }
function toggleFastBuild(){ S._fastBuild=!S._fastBuild; toast(S._fastBuild?'秒升建筑：开':'秒升建筑：关'); updateUI(); }
function addAllEssences(inputId){
  const el=document.getElementById(inputId);
  const n=Math.max(1,Math.floor(parseInt(el?.value,10)||0));
  for(const ek of Object.keys(CFG.essences||{})){
    S.essence[ek]=(S.essence[ek]||0)+n;
  }
  addLog(`精魄全部 +${n}`);
  save();updateUI();
}

// 激活码校验：输入1122解锁测试工具
function checkActivationCode(inputId){
  const el=document.getElementById(inputId);
  if(!el)return;
  if(el.value.trim()==='1122'){
    S._testUnlocked=true;
    toast('测试工具已解锁');
    updateUI();
  }else{
    toast('激活码错误');
  }
}

// ==================== 编队弹窗 ====================
let formModalTarget=null; // {which:'expedition'|'garrison', row, idx}

function openFormModal(which,row,idx){
  if(!['front','mid','back'].includes(row)||!Number.isInteger(idx)||idx<0||idx>=rowSlots(row)){toast('该阵位尚未解锁');return}
  formModalTarget={which,row,idx};
  const form=getForm(which);
  const content=document.getElementById('form-modal-content');
  const rm=regMax();
  const label=which==='garrison'?'驻军':'远征';
  let h=`<h3>${pix('army','card-pix')} ${label}编入 — ${row==='front'?'前排':row==='mid'?'中排':'后排'} (上限 ${rm}人/团)</h3>`;
  if(row!=='front')h+='<div style="font-size:11px;color:#e8b86a;margin-bottom:8px">近战兵种在此排时不能主动攻击，推进前排后才可出手；远程兵种可在任意排出手。</div>';
  h+='<div style="max-height:300px;overflow-y:auto">';
  let hasAny=false;
  for(const[k,c] of Object.entries(CFG.units)){
    if(k==='mage'&&!mageOk())continue;
    const av=poolAvail(k);
    if(av<=0)continue;
    hasAny=true;
    const target=form[row][idx];
    const remaining=target&&target.type===k?Math.min(rm-target.count, av):Math.min(rm, av);
    if(remaining<=0)continue;
    h+=`<div class="modal-unit" data-type="${k}" data-avail="${remaining}" onclick="selModalUnit(this,'${k}',${remaining})">
      <span class="mu-icon">${pix(c.icon,'lg')}</span>
      <div class="mu-info"><div class="mu-name">${c.name}</div>
      <div class="mu-detail">可编入:${av}人 | 上限 ${rm}人/团 | ${c.passive.replace(/\n/g,' · ')}${row!=='front'&&!isRanged(k)?' | 在本排时无法主动攻击':''}</div></div>
    </div>`;
  }
  if(!hasAny)h+='<div style="text-align:center;color:#666;padding:20px">余量无可用士兵，请先训练</div>';
  h+='</div>';
  h+=`<div id="modal-qty-area" style="display:none"><div class="modal-qty">
    <button onpointerdown="startModalLongPress(-1)" onpointerup="stopModalLongPress()" onpointerleave="stopModalLongPress()" onpointercancel="stopModalLongPress()" onclick="event.preventDefault()">-</button>
    <input type="text" inputmode="numeric" pattern="[0-9]*" id="modal-qty-input" value="1" onchange="clampQty()" oninput="clampQty()">
    <button onpointerdown="startModalLongPress(1)" onpointerup="stopModalLongPress()" onpointerleave="stopModalLongPress()" onpointercancel="stopModalLongPress()" onclick="event.preventDefault()">+</button>
  </div>
  <div class="modal-quick">
    <button class="btn btn-ghost btn-xs" onclick="setModalQty(S._formModalMax)">MAX</button>
  </div>
  <div style="text-align:center;margin-top:6px;font-size:10px;color:#888">部队人数 (HP)</div>
  <button class="btn btn-go" style="width:100%;margin-top:8px" onclick="confirmForm()">${pix('check','mini')}确认编入</button></div>`;
  content.innerHTML=h;
  document.getElementById('form-modal').classList.add('active');
  S._formModalSel=null;S._formModalQty=1;
}

function selModalUnit(el,type,avail){
  document.querySelectorAll('.modal-unit').forEach(e=>e.classList.remove('sel'));
  el.classList.add('sel');
  S._formModalSel=type;
  S._formModalMax=avail;
  S._formModalQty=Math.min(avail, Math.max(1, Math.floor(avail/2))); // 默认填一半
  const qa=document.getElementById('modal-qty-area');
  qa.style.display='block';
  const inp=document.getElementById('modal-qty-input');
  inp.value=S._formModalQty;
  inp.max=avail;
}

function adjQty(d){
  if(!S._formModalSel)return;
  S._formModalQty=Math.max(1,Math.min(S._formModalMax,S._formModalQty+d));
  document.getElementById('modal-qty-input').value=S._formModalQty;
}
function setModalQty(qty){
  if(!S._formModalSel)return;
  S._formModalQty=Math.max(1,Math.min(S._formModalMax,Math.floor(qty)||1));
  document.getElementById('modal-qty-input').value=S._formModalQty;
}
function clampQty(){
  const v=parseInt(document.getElementById('modal-qty-input').value)||1;
  S._formModalQty=Math.max(1,Math.min(S._formModalMax,v));
  document.getElementById('modal-qty-input').value=S._formModalQty;
}

function confirmForm(){
  if(!S._formModalSel||!formModalTarget)return;
  const type=S._formModalSel,row=formModalTarget.row,idx=formModalTarget.idx;
  const which=formModalTarget.which||'expedition';
  const form=getForm(which);
  const qty=S._formModalQty;
  if(!['front','mid','back'].includes(row)||!Number.isInteger(idx)||idx<0||idx>=rowSlots(row)){toast('该阵位尚未解锁');return}
  if(CFG.units[type]?.enemyOnly){toast('敌方专属兵种不能编队');return}
  if(qty<=0){toast('人数无效');return}
  if(poolAvail(type)<qty){toast('余量不足');return}
  const target=form[row][idx];
  if(target&&target.type===type){
    if(target.count+qty>regMax()){toast(`超过上限${regMax()}人/团`);return}
    target.count+=qty;
  } else {
    const curCnt=form.front.length+form.mid.length+form.back.length;
    if(curCnt>=formSlots()){toast('阵容已满');return}
    if(qty>regMax()){toast(`超过上限${regMax()}人/团`);return}
    form[row].push({type,count:qty,id:nextFormationId()});
  }
  S.pool[type]-=qty;
  closeFormModal();
  updateUI();
}

function closeFormModal(){
  document.getElementById('form-modal').classList.remove('active');
  formModalTarget=null;S._formModalSel=null;
}

// 点击弹窗外部关闭
document.getElementById('form-modal').addEventListener('click',function(e){
  if(e.target===this) closeFormModal();
});

// ==================== 单位详情弹窗 ====================
function openUnitDetail(uk){
  const c=CFG.units[uk];
  if(!c)return;
  const rowLabel={front:'前排',mid:'中排',back:'后排'}[c.row]||c.row;
  const st=trainBuildingState(uk);
  const bldName=st?CFG.buildings[trainBuildingKey(uk)].name:'';
  const portraitKey=uk==='quantum_trooper'?c.icon:uk;
  const portrait=/^[a-z0-9_]+$/.test(portraitKey)?`<img class="unit-detail-portrait" src="./assets/art/units/hires/${portraitKey}.png" alt="" loading="eager">`:pix(c.icon,'lg');
  let h=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span>${portrait}</span><div><div style="font-size:15px;font-weight:bold;color:#e0e0e0">${c.name}</div><div style="font-size:10px;color:#888">${c.race} | ${rowLabel}</div></div></div>`;
  h+=`<div style="background:#121224;border:2px solid #2b3144;border-radius:6px;padding:10px 12px;margin-bottom:8px">`;
  h+=`<div style="font-size:11px;color:#f0d060;margin-bottom:8px;text-align:center;letter-spacing:2px">◆ 属性 ◆</div>`;
  h+=`<div style="font-size:12px;line-height:2.2">`;
  const effectiveAtk=weaponAttack(uk);
  h+=`<div><span style="color:#888">攻击力</span><span style="color:#f0d060;float:right">${effectiveAtk} <span style="color:#888;font-size:10px">→ ${Math.max(1,effectiveAtk-3)}~${effectiveAtk+3}</span></span></div>`;
  h+=`<div><span style="color:#888">防御力</span> <span style="color:#f0d060;float:right">${weaponDefense(uk)}</span></div>`;
  h+=`<div><span style="color:#888">速度</span> <span style="color:#f0d060;float:right">${c.spd}</span></div>`;
  h+=`<div style="margin-top:4px;padding-top:4px;border-top:1px solid #2b3144"><span style="color:#888">训练费</span> <span style="color:#f0d060;float:right">${costHtml(c.cost)}</span></div>`;
  h+=`<div><span style="color:#888">维护费</span> <span style="color:#f0d060;float:right">${c.upkeep||0}食物/秒</span></div>`;
  h+=`<div><span style="color:#888">训练时间</span> <span style="color:#f0d060;float:right">${c.trainTime||CFG.unitTrainTime||1}秒/人</span></div>`;
  h+=`<div style="margin-top:4px;padding-top:4px;border-top:1px solid #2b3144"><span style="color:#888">训练建筑</span> <span style="color:#aaa;float:right">${bldName||'无'}</span></div>`;
  const pool=S.pool[uk]||0;
  const qNow=queueTotal(uk);
  h+=`<div><span style="color:#888">拥有</span> <span style="color:#f0d060;float:right">${pool}人${qNow>0?' | 队列'+qNow+'人':''}</span></div>`;
  h+=`</div></div>`;
  h+=`<div style="background:#1a2220;border:1px solid #2b443b;border-radius:6px;padding:8px 12px;margin-bottom:8px">`;
  h+=`<span style="font-size:11px;color:#888">技能: </span><span style="font-size:11px;color:#40bf80;white-space:pre-line;line-height:1.6">${c.passive}</span></div>`;
  h+=`<button class="btn btn-ghost btn-sm" style="width:100%" onclick="closeUnitDetail()">关闭</button>`;
  document.getElementById('unit-detail-content').innerHTML=h;
  document.getElementById('unit-detail-modal').classList.add('active');
}
function closeUnitDetail(){
  document.getElementById('unit-detail-modal').classList.remove('active');
}
document.getElementById('unit-detail-modal').addEventListener('click',function(e){
  if(e.target===this) closeUnitDetail();
});

// 从阵容移除兵团
function rmForm(which,row,idx){
  const form=getForm(which);
  const u=form[row][idx];
  if(!u)return;
  S.pool[u.type]=(S.pool[u.type]||0)+u.count;
  form[row].splice(idx,1);
  updateUI();
}
// 调整兵团人数
function adjForm(which,row,idx,d){
  const form=getForm(which);
  const u=form[row][idx];
  if(!u)return;
  const nv=u.count+d;
  if(d>0 && nv>regMax()){toast(`上限${regMax()}人/团`);return}
  if(d>0 && poolAvail(u.type)<d){toast('余量不足');return}
  if(nv<=0){S.pool[u.type]=(S.pool[u.type]||0)+u.count;form[row].splice(idx,1);updateUI();return}
  if(d>0){S.pool[u.type]-=d;}
  else if(d<0){S.pool[u.type]=(S.pool[u.type]||0)+(-d);}
  u.count=nv;
  updateUI();
}
function clrForm(which){
  const form=getForm(which);
  for(const row of['front','mid','back']){for(const u of form[row]){S.pool[u.type]=(S.pool[u.type]||0)+u.count}}
  if(which==='garrison'){S._garrisonForm={front:[],mid:[],back:[]}}
  else{S.formation={front:[],mid:[],back:[]}}
  updateUI();
}
function removeFormSlot(which,row,idx){
  const form=getForm(which);
  const u=form[row][idx];
  if(!u)return;
  S.pool[u.type]=(S.pool[u.type]||0)+u.count;
  form[row].splice(idx,1);
  updateUI();
}
function fillFormMax(which,row,idx){
  const form=getForm(which);
  const u=form[row][idx];
  if(!u)return;
  const avail=poolAvail(u.type);
  const cap=regMax();
  const add=Math.min(avail, cap-u.count);
  if(add<=0){toast('已满或余量不足');return}
  u.count+=add;
  S.pool[u.type]-=add;
  updateUI();
}
function useLastFormation(which){
  const form=getForm(which);
  const lastKey=which==='garrison'?'_lastGarrisonForm':'_lastForm';
  if(!S[lastKey]){toast('没有上次阵容记录');return}
  const last=S[lastKey];
  const hasAny=last.front.length+last.mid.length+last.back.length>0;
  if(!hasAny){toast('上次阵容为空');return}
  for(const row of['front','mid','back']){
    for(const u of form[row]){S.pool[u.type]=(S.pool[u.type]||0)+u.count;}
  }
  const newForm={front:[],mid:[],back:[]};
  let shortage=false;
  for(const row of['front','mid','back']){
    for(const u of last[row]){
      const rowMax=rowSlots(row);
      if(newForm[row].length>=rowMax){shortage=true;break;}
      const avail=poolAvail(u.type);
      if(avail<=0){shortage=true;continue;}
      const count=Math.min(u.count, avail, regMax());
      if(count<u.count)shortage=true;
      S.pool[u.type]-=count;
      newForm[row].push({type:u.type,count,id:nextFormationId()});
    }
  }
  if(which==='garrison'){S._garrisonForm=newForm}
  else{S.formation=newForm}
  if(shortage)toast('驻军不足，已按可用人数填充');
  save();updateUI();
}

// ==================== 战斗系统 ====================
let battleTimer=null;
let battleRestartTimer=null;
let battleEpoch=0;
let battleRestartEpoch=0;
let B={};

function stopBattleTimer(){
  if(battleTimer!==null)clearTimeout(battleTimer);
  battleTimer=null;
  battleEpoch++; // 旧回调即使已入队，也不能写入下一场战斗
}
function queueBattleStep(fn,delay,epoch=battleEpoch){
  const timer=setTimeout(()=>{
    if(battleTimer===timer)battleTimer=null;
    if(S.battleActive&&battleEpoch===epoch)fn();
  },delay);
  battleTimer=timer;
}
function cancelBattleRestart(){
  if(battleRestartTimer!==null)clearTimeout(battleRestartTimer);
  battleRestartTimer=null;
  battleRestartEpoch++;
}
function queueBattleRestart(encounterKey=null,soulSlot=null){
  cancelBattleRestart();
  const epoch=battleEpoch,restartEpoch=battleRestartEpoch;
  const timer=setTimeout(()=>{
    if(battleRestartTimer===timer)battleRestartTimer=null;
    if(epoch===battleEpoch&&restartEpoch===battleRestartEpoch&&!saveProtected())openBattle(encounterKey,soulSlot);
  },150);
  battleRestartTimer=timer;
}

function selEnemy(idx){
  S.selEnemy=idx;updateUI();
}

function openTraining(){
  if(S.battleActive)return;
  if(formCnt()===0){toast('请先配置阵容');return}
  cancelBattleRestart();stopBattleTimer();
  S.battleActive=true; B.isTraining=true;
  document.getElementById('battle-screen').classList.add('active');
  document.getElementById('navbar').classList.add('paused');
  document.getElementById('topbar').classList.add('paused');
  document.getElementById('main').classList.add('paused');
  document.getElementById('battle-result').style.display='none';
  document.getElementById('battle-msg').innerHTML='';
  setBattleLogOpen(false);
  initBattleState();
  drawBattleField();
  bmsg('训练开始！训练场×9 各100HP','#f0d060');
  queueBattleStep(battleTurn,(CFG.battleStepDelay||840)/S.battleSpeed);
}

function openBattle(encounterKey=null,soulSlot=null){
  if(S.battleActive||saveProtected())return;
  if(encounterKey!==null){
    const domain=specialEncounterConfig(encounterKey);
    if(!domain){toast('未知挑战');return}
    if(domain.needScience&&!scienceUnlocked(domain.needScience)){toast(`需先研究${sciName(domain.needScience)}`);return}
    if(domain.soulRealm&&(!Number.isInteger(soulSlot)||soulSlot<0||soulSlot>=CFG.soulRealm.slots||
      !S.soulRealmTeam||S.soulRealmTeam.slots[soulSlot]===null)){
      toast('请先选择尚未击败的英魂');return;
    }
    if(domain.soulRealm&&S.battleEncounter!==null){toast('请先退出当前战斗结算');return}
    if(domain.awakeningTrial&&(!S._awakeningTrial?.paid||S._awakeningTrial.level!==S.awakening.star_trooper.level)){
      toast('请先支付圣域异果开启试炼');return;
    }
    // 区域胜利必须与战损、授点一次落盘；旧档待结算离线窗口先在开战前封口。
    if((domain.developmentBorder||domain.developmentOuter)&&S.offline?.populationFoodRule==='legacy-pending'){
      settleOffline();
      if(saveProtected()||S.offline?.populationFoodRule==='legacy-pending'){
        toast('历史离线结算尚未完成，无法进入拓境战斗');return;
      }
    }
  }else if(S.selEnemy===null||S.selEnemy===undefined){toast('请先选择关卡');return}
  if(formCnt()===0){toast('请先配置阵容');return}
  cancelBattleRestart();stopBattleTimer();
  S.battleEncounter=encounterKey;
  B.soulSlot=encounterKey==='soulStone'?soulSlot:null;
  S.battleActive=true; B.isTraining=false;
  document.getElementById('battle-screen').classList.add('active');
  document.getElementById('navbar').classList.add('paused');
  document.getElementById('topbar').classList.add('paused');
  document.getElementById('main').classList.add('paused');
  document.getElementById('battle-result').style.display='none';
  document.getElementById('battle-msg').innerHTML='';
  setBattleLogOpen(false);
  initBattleState();
  drawBattleField();
  bmsg('战斗开始！','#f0d060');
  queueBattleStep(battleTurn,(CFG.battleStepDelay||840)/S.battleSpeed);
}

function openGodDomain(){openBattle(CFG.godDomain.key)}
function openMaterialDomain(key){openBattle(key)}
function soulRealmTier(id){return CFG.soulRealm.tiers.find(t=>t.id===id)||null}
function soulRealmReward(tier,alert){
  return Math.min(CFG.eraMaterials.soulStone.max,Math.max(1,Math.floor(tier.stone*(1+0.3*Math.floor(alert/CFG.soulRealm.growth.alertStep)))));
}
function boundedSoulValue(value,limit=Number.MAX_SAFE_INTEGER){
  return Number.isFinite(value)?Math.min(limit,Math.max(1,value)):limit;
}
function soulRealmDay(){
  const now=new Date(Date.now());
  return Math.floor(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/86400000);
}
function soulRealmRefreshAllowed(day=soulRealmDay()){
  const team=S.soulRealmTeam;
  return team===null||team.slots.every(id=>id===null)||day>team.day;
}
function refreshSoulRealmTeam(){
  if(S.battleActive||S.battleEncounter!==null||saveProtected())return{ok:false,reason:'unavailable'};
  if(!scienceUnlocked(CFG.godDomains.soulStone.needScience))return{ok:false,reason:'science-prerequisite'};
  const day=soulRealmDay();
  if(!soulRealmRefreshAllowed(day))return{ok:false,reason:'refresh-locked'};
  const alert=S.killValues.soulRealm;
  const eligible=CFG.soulRealm.tiers.filter(t=>alert>=t.min&&alert<=t.max);
  // 源表最高到100万警戒；本地存档可继续累积，超出时沿用神话位以免合法进度失去挑战入口。
  if(!eligible.length&&alert>CFG.soulRealm.tiers[CFG.soulRealm.tiers.length-1].max)
    eligible.push(CFG.soulRealm.tiers[CFG.soulRealm.tiers.length-1]);
  if(!eligible.length)return{ok:false,reason:'no-eligible-target'};
  const total=eligible.reduce((sum,t)=>sum+t.weight,0),slots=[];
  for(let i=0;i<CFG.soulRealm.slots;i++){
    let roll=Math.min(Math.max(Math.random(),0),1-Number.EPSILON)*total;
    let picked=eligible[eligible.length-1];
    for(const tier of eligible){roll-=tier.weight;if(roll<0){picked=tier;break}}
    slots.push(picked.id);
  }
  const previous=S.soulRealmTeam;
  S.soulRealmTeam={day,slots};
  const written=save();
  if(!written.ok){S.soulRealmTeam=previous;return{ok:false,reason:'save-failed'}}
  updateUI();return{ok:true,slots};
}
function openSoulRealmSlot(slot){
  if(!Number.isInteger(slot)||slot<0||slot>=CFG.soulRealm.slots||!S.soulRealmTeam||S.soulRealmTeam.slots[slot]===null)
    return{ok:false,reason:'target-unavailable'};
  if(!scienceUnlocked(CFG.godDomains.soulStone.needScience))return{ok:false,reason:'science-prerequisite'};
  if(S.battleActive||S.battleEncounter!==null||saveProtected()||formCnt()===0)return{ok:false,reason:'unavailable'};
  openBattle('soulStone',slot);
  return S.battleActive?{ok:true}:{ok:false,reason:'unavailable'};
}
// 母本实际取 playerData[0].Num：第一个出战兵团人数，而不是所有兵团人数之和。
function awakeningTrialCost(){
  for(const row of ['front','mid','back'])if(S.formation[row].length>0)
    return S.awakening.star_trooper.level*10+S.formation[row][0].count;
  return S.awakening.star_trooper.level*10;
}
function openAwakeningTrial(mode){
  const cfg=CFG.awakening,trial=cfg.trials[mode],unit=cfg.unit,progress=S.awakening[unit];
  if(!trial||S.battleActive||saveProtected())return{ok:false,reason:'unavailable'};
  if(!scienceUnlocked('sci_nuclear_age'))return{ok:false,reason:'science-prerequisite'};
  if(progress.level>=cfg.maxLevel)return{ok:false,reason:'max-level'};
  if(!['front','mid','back'].some(row=>S.formation[row].some(u=>u.type===unit&&u.count>0)))return{ok:false,reason:'unit-not-deployed'};
  const cost=awakeningTrialCost();
  if(!Number.isSafeInteger(cost)||cost<=0)return{ok:false,reason:'numeric-limit'};
  if(S.items[cfg.fruit]<cost)return{ok:false,reason:'insufficient-items',cost};
  S.items[cfg.fruit]-=cost;
  if(!save().ok){S.items[cfg.fruit]+=cost;return{ok:false,reason:'save-failed'}}
  S._awakeningTrial={mode,cost,level:progress.level,paid:true};
  openBattle('awakeningTrial');
  return{ok:true,cost};
}
function openAwakeningTrialFromUI(mode){
  const result=openAwakeningTrial(mode);
  if(!result.ok)toast(({unavailable:'当前无法开战','science-prerequisite':'尚未进入星核时代','max-level':'已达到20阶',
    'unit-not-deployed':'请将星际先遣兵编入远征阵容','insufficient-items':'圣域异果不足','numeric-limit':'人数异常','save-failed':'保存失败，未消耗异果'})[result.reason]||'试炼暂不可用');
  return result;
}
function openDevelopmentBorder(site){
  const domain=Object.prototype.hasOwnProperty.call(CFG.developmentBorder,site)?CFG.developmentBorder[site]:null;
  if(!domain){toast('未知边疆点位');return}
  openBattle(domain.key);
}
function openDevelopmentOuter(region){
  const domain=Object.prototype.hasOwnProperty.call(CFG.developmentOuter,region)?CFG.developmentOuter[region]:null;
  if(!domain){toast('未知外域区域');return}
  openBattle(domain.key);
}

function godDomainConfig(key){
  if(key===CFG.godDomain.key)return CFG.godDomain;
  return CFG.godDomains[key]||null;
}
function specialEncounterConfig(key){
  if(key==='awakeningTrial')return{key,awakeningTrial:true,name:'星际先遣兵·圣域试炼',needScience:'sci_nuclear_age',boss:true};
  if(key===CFG.wildHunt.key)return CFG.wildHunt;
  if(CFG.wildHunts[key])return CFG.wildHunts[key];
  if(godDomainConfig(key))return godDomainConfig(key);
  return Object.values(CFG.developmentBorder).find(domain=>domain.key===key)||
    Object.values(CFG.developmentOuter).find(domain=>domain.key===key)||null;
}

function developmentBorderEncounter(base){
  const site=S.development.border.sites[base.site];
  return developmentAreaEncounter(base,site.wins*base.alertPerWin,site.wins);
}
function developmentOuterEncounter(base){
  const region=S.development.outer[base.region];
  return developmentAreaEncounter(base,region.alert,region.wins);
}
function developmentOuterRareChances(region,alert){
  const rare=CFG.developmentOuterRare,per=rare.getPer;
  // 母本 winBigWar 的稀有抽签只乘战前收益系数，不乘胜后的 getKillPerReward 阶位。
  const rewardScale=alert<1000?1+alert*per/5000:
    1+1000*per/5000+(alert-1000)*per/20000;
  const capital=region==='capital';
  return{bloodDropChance:Math.min(capital?rare.capitalBloodCap:10000,
      Math.floor(rare.bloodBase[region]*rewardScale)),
    emberDropChance:capital?Math.min(rare.capitalEmberCap,
      Math.floor(rare.emberBase.capital*rewardScale)):0};
}
function developmentAreaEncounter(base,rawAlert,wins){
  // 边疆/外域首个试验档都取每胜+20警戒，按母本K增长骨架映射兵团人数与攻防；
  // 我方兵团HP已随人数增长，不再额外乘母本单体HP倍率。后续仍需连续实战校准。
  const alert=Math.min(13000,rawAlert);
  const tier=godDomainTier(alert,CFG.godDomain.monsterTiers);
  const countScale=(1+alert*0.15/100)*tier;
  const statScale=(1+alert*0.05/100)*tier;
  const units=Object.fromEntries(Object.entries(base.units).map(([key,counts])=>
    [key,counts.map(n=>Math.max(1,Math.min(Number.MAX_SAFE_INTEGER,Math.floor(n*countScale))))]));
  const rare=base.developmentOuter?developmentOuterRareChances(base.region,alert):{};
  return{...base,...rare,wins,alert,units,bossMult:{atk:statScale,def:statScale}};
}

function godDomainTier(value,tiers){
  let factor=1;
  for(const [threshold,next] of tiers){if(value<threshold)break;factor=next;}
  return factor;
}
function godEmberDropChance(nextKillValue){
  let chance=CFG.emberElixir.baseDropChance;
  for(const [threshold,next] of CFG.emberElixir.dropChanceTiers)if(nextKillValue>=threshold)chance=next;
  return chance;
}
function godAegisDropChance(nextKillValue){
  let chance=CFG.aegisElixir.baseDropChance;
  for(const [threshold,next] of CFG.aegisElixir.dropChanceTiers)if(nextKillValue>=threshold)chance=next;
  return chance;
}
function materialDomainEncounter(key,killValue=null,soulTierId=null){
  const base=specialEncounterConfig(key);
  if(!base)return null;
  if(base.soulRealm){
    if(killValue===null)killValue=S.killValues.soulRealm;
    const tiers=CFG.soulRealm.tiers;
    // 九个敌位独立抽选；战斗数值仍按我方单兵团 HP/伤害口径换算。
    const tier=soulRealmTier(soulTierId);
    if(!tier)return null;
    const nextKillValue=Math.min(Number.MAX_SAFE_INTEGER,killValue+tier.alert);
    const growth=CFG.soulRealm.growth,steps=Math.floor(killValue/growth.alertStep);
    const hpScale=tier.hp*tier.count/(tiers[0].hp*tiers[0].count);
    // 母本按每满1000警戒分别强化生命、攻防和人数；单体兵团生命承接生命×人数。
    const amount=Math.floor(boundedSoulValue(100*hpScale*Math.pow(growth.hp,steps)*Math.pow(growth.count,steps)));
    // 母本将英魂分到最多六条队列，每条队列同一时刻仅队首出手；所有英魂档初始人数均超过120。
    // 聚合生命没有逐队死亡信息，故保持六队出手直到战斗结束，而非按整群人数或总HP折减。
    const attackMass=CFG.soulRealm.activeQueues;
    const atkMult=boundedSoulValue(tier.atk/tiers[0].atk*Math.pow(growth.atk,steps),Number.MAX_SAFE_INTEGER/CFG.units.soul_wraith.atk);
    const defMult=boundedSoulValue(tier.def/tiers[0].def*Math.pow(growth.def,steps),Number.MAX_SAFE_INTEGER/CFG.units.soul_wraith.def);
    const reward=soulRealmReward(tier,killValue);
    return{...base,name:`英魂遗境·${tier.name}`,soulTierId:tier.id,soulSlot:B.soulSlot,killValue,nextKillValue,units:{soul_wraith:[amount]},attackMass,
      bossMult:{atk:atkMult,def:defMult},
      emberDropChance:0,aegisDropChance:0,reward:{soulStone:reward}};
  }
  if(base.awakeningTrial){
    const a=S.awakening.star_trooper,t=CFG.awakening.trials[S._awakeningTrial?.mode];
    if(!t)return null;
    // 母本 getMonsterDataGod_SS：所选难度以“本次胜场”计入对应历史轨，再分别计算人数/攻/生/防。
    const r=CFG.awakening.reference,tracks={...a.tracks,[S._awakeningTrial.mode]:a.tracks[S._awakeningTrial.mode]+1};
    const easy=tracks.easy,perfect=tracks.perfect,extreme=tracks.extreme;
    const amount=Math.floor((r.guardCount+30*a.level+10*easy+20*perfect+40*extreme)*r.armyGodPer);
    const sourceAtk=Math.floor(Math.floor(r.guardAtk*(1+a.level/5))*(1+0.05*easy+0.1*perfect+0.25*extreme)*r.armyGodPer);
    const sourceHp=Math.floor(Math.floor(r.guardHp*(1+a.level/5))*(1+0.05*easy+0.1*perfect+0.2*extreme)*r.armyGodPer);
    const sourceDef=Math.floor(Math.floor(r.guardDef*(1+a.level/5))*(1+0.02*easy+0.05*perfect+0.15*extreme)*r.armyGodPer);
    // 战斗仍按我方兵团HP/伤害口径：保留母本增长比率，人数单独作为出手规模。
    const cfg=CFG.units[t.unit],hp=Math.max(1,Math.floor(amount*sourceHp/r.hpDivisor));
    return{...base,name:`星际先遣兵·${t.name}试炼 ${a.level+1}阶`,units:{[t.unit]:[hp]},
      attackMass:amount,attackMassFallsWithHp:true,
      bossMult:{atk:sourceAtk/(r.atkDivisor*cfg.atk),def:sourceDef/cfg.def},reward:{}};
  }
  if(base.developmentBorder)return developmentBorderEncounter(base);
  if(base.developmentOuter)return developmentOuterEncounter(base);
  if(base.wildHunt){
    if(killValue===null)killValue=S.killValues[base.killValueKey];
    const nextKillValue=Math.min(Number.MAX_SAFE_INTEGER,killValue+base.killValuePerWin);
    const monsterTier=godDomainTier(killValue,CFG.godDomain.monsterTiers);
    const [unitKey,unitCounts]=Object.entries(base.units)[0];
    const amount=Math.min(Number.MAX_SAFE_INTEGER,Math.floor(unitCounts[0]*(1+killValue*0.15/100)*monsterTier));
    const statScale=(1+killValue*0.05/100)*monsterTier;
    const rewardScale=killValue<1000?1+killValue*40/5000:1+1000*40/5000+(killValue-1000)*40/20000;
    const boneReward=Math.max(1,Math.min(resCap('bone'),Math.floor(base.reward.bone*rewardScale*godDomainTier(nextKillValue,CFG.godDomain.rewardTiers))));
    const hideReward=Math.max(1,Math.min(resCap('hide'),Math.floor(base.reward.hide*rewardScale*godDomainTier(nextKillValue,CFG.godDomain.rewardTiers))));
    const heartChance=Math.min(100,Math.floor(base.heartChanceBase+nextKillValue*base.heartChancePerKill));
    const heartAmount=Math.min(base.heartMaxReward,Math.max(1,Math.floor(rewardScale*godDomainTier(nextKillValue,CFG.godDomain.rewardTiers))));
    return{...base,killValue,nextKillValue,units:{[unitKey]:[amount]},bossMult:{atk:statScale,def:statScale},heartChance,heartAmount,reward:{bone:boneReward,hide:hideReward}};
  }
  const killKey=base.killValueKey||'godRevival';
  if(killValue===null)killValue=S.killValues[killKey];
  const nextKillValue=Math.min(Number.MAX_SAFE_INTEGER,killValue+base.killValuePerWin);
  // 母本按善良/普通/罪恶品质给 +200/+100/+80；我方尚无品质系统，固定采用普通 +100。
  // 母本 580000 的增幅：数量每百杀戮值 +15%，属性每百 +5%；我方把增长后的数量映为单体生命，基准出手规模另记。
  const monsterTier=godDomainTier(killValue,base.monsterTiers||CFG.godDomain.monsterTiers);
  const [unitKey,unitCounts]=Object.entries(base.units)[0];
  const amount=Math.min(Number.MAX_SAFE_INTEGER,Math.floor(unitCounts[0]*(1+killValue*0.15/100)*monsterTier));
  const statScale=(1+killValue*0.05/100)*monsterTier;
  // 母本 winGodWar：奖励基数按战前杀戮值增长，阶位奖励按本次胜利后的值计算。
  const rewardScale=killValue<1000?1+killValue*40/5000:1+1000*40/5000+(killValue-1000)*40/20000;
  const [materialKey,baseReward]=Object.entries(base.reward)[0];
  const rewardMax=base.resourceReward?resCap(materialKey):CFG.eraMaterials[materialKey].max;
  const rewardTier=godDomainTier(nextKillValue,base.rewardTiers||CFG.godDomain.rewardTiers);
  const reward=Math.max(1,Math.min(rewardMax,Math.floor(baseReward*rewardScale*rewardTier)));
  const bonusReward={};
  for(const [rk,baseAmount] of Object.entries(base.bonusReward||{}))
    bonusReward[rk]=Math.max(1,Math.min(resCap(rk),Math.floor(baseAmount*rewardScale*rewardTier)));
  const bonusItemReward={};
  for(const [itemKey,baseAmount] of Object.entries(base.bonusItemReward||{})){
    if(itemKey==='sacredBlood'){
      let blood=baseAmount;
      for(const [threshold,amount] of CFG.godBloodRewardTiers)if(nextKillValue>=threshold)blood=amount;
      bonusItemReward[itemKey]=Math.min(CFG.eraMaterials[itemKey].max,blood);
    }else bonusItemReward[itemKey]=Math.max(1,Math.min(CFG.eraMaterials[itemKey].max,Math.floor(baseAmount*rewardScale*rewardTier)));
  }
  return{...base,killValue,nextKillValue,units:{[unitKey]:[amount]},attackMass:unitCounts[0],bossMult:{atk:statScale,def:statScale},
    emberDropChance:Object.prototype.hasOwnProperty.call(base.bonusItemReward||{},'sacredBlood')?godEmberDropChance(nextKillValue):0,
    aegisDropChance:Object.prototype.hasOwnProperty.call(base.bonusItemReward||{},'sacredBlood')?godAegisDropChance(nextKillValue):0,
    reward:{[materialKey]:reward,...bonusReward,...bonusItemReward}};
}
function godDomainEncounter(killValue=S.killValues.godRevival){return materialDomainEncounter(CFG.godDomain.key,killValue)}

function fleeBattle(){
  if(B.settled){exitBattle();return}
  cancelBattleRestart();stopBattleTimer();
  closeBattleVisual();
  S.battleActive=false;
  S.battleEncounter=null;
  S._awakeningTrial=null;
  document.getElementById('battle-screen').classList.remove('active');
  document.getElementById('navbar').classList.remove('paused');
  document.getElementById('topbar').classList.remove('paused');
  document.getElementById('main').classList.remove('paused');
  document.getElementById('battle-result').style.display='none';
  S.formation=S._preForm;
  if(B.isTraining){B.isTraining=false;addLog('退出训练');}
  else addLog('逃离战斗');
  save(); updateUI();
}

function shiftRows(){
  const hasAlive=r=>B.ourUnits.some(u=>u.alive!==false&&u.row===r);
  if(!hasAlive('front')){
    for(const u of B.ourUnits){
      if(u.alive===false)continue;
      if(u.row==='mid')u.row='front';
      else if(u.row==='back')u.row='mid';
    }
  }
  if(!hasAlive('mid')){
    for(const u of B.ourUnits){
      if(u.alive===false)continue;
      if(u.row==='back')u.row='mid';
    }
  }
}

function initBattleState(){
  B.temporalEchoes=[];
  B.settled=false;
  B.trialMode=S.battleEncounter==='awakeningTrial'?S._awakeningTrial?.mode:null;
  if(B.isTraining){
    S._preForm=JSON.parse(JSON.stringify(S.formation));
    S._lastForm=JSON.parse(JSON.stringify(S.formation));
    B.tactic=CFG.tactics.steady; B.enemyCfg={name:'训练场',boss:false};
    B.round=0; B.maxRound=99; B.winner=null; B.msgs=[];
    B.ourUnits=[]; B.enemyUnits=[]; B.trainingStats={}; B.dummyDmg=[];
    let uid=0;
    for(const row of['front','mid','back']){
      for(let originIndex=0;originIndex<S.formation[row].length;originIndex++){
        const u=S.formation[row][originIndex];
        const cfg=CFG.units[u.type];
        B.ourUnits.push({id:uid++, fid:u.id, type:u.type, row,originRow:row,originIndex,...battleVitals(u.type,u.count,true),
          icon:cfg.icon, name:cfg.name, tier:cfg.tier??0, spd:cfg.spd, baseSpd:cfg.spd, atk:weaponAttack(u.type), entryAtk:weaponAttack(u.type), def:weaponDefense(u.type), entryDef:weaponDefense(u.type), weaponSkills:equippedWeaponSkills(u.type), tag:cfg.tag||null});
      }
    }
    const rows=['front','mid','back'];
    for(let i=0;i<9;i++){
      const rowIdx=Math.floor(i/3);
      B.enemyUnits.push({id:uid++, type:'dummy', name:'训练场', row:rows[rowIdx],
        hp:100, maxHp:100, icon:'dummy', tier:0, spd:0, atk:0, def:1, alive:true, dummyIdx:i});
      B.dummyDmg.push(0);
    }
  }else{
    const e=S.battleEncounter!==null?materialDomainEncounter(S.battleEncounter,null,
      S.battleEncounter==='soulStone'?S.soulRealmTeam.slots[B.soulSlot]:null):CFG.enemies[S.selEnemy];
    const tkey='steady';
    S._preForm=JSON.parse(JSON.stringify(S.formation));
    S._lastForm=JSON.parse(JSON.stringify(S.formation));
    B.tactic=CFG.tactics[tkey]; B.enemyCfg=e;
    B.round=0; B.maxRound=25+(e.boss?5:0); B.winner=null; B.msgs=[];
    B.ourUnits=[]; B.enemyUnits=[];
    let uid=0;
    for(const row of['front','mid','back']){
      for(let originIndex=0;originIndex<S.formation[row].length;originIndex++){
        const u=S.formation[row][originIndex];
        const cfg=CFG.units[u.type];
        B.ourUnits.push({id:uid++, fid:u.id, type:u.type, row,originRow:row,originIndex,...battleVitals(u.type,u.count,true),
          icon:cfg.icon, name:cfg.name, tier:cfg.tier??0, spd:cfg.spd, baseSpd:cfg.spd, atk:weaponAttack(u.type), entryAtk:weaponAttack(u.type), def:weaponDefense(u.type), entryDef:weaponDefense(u.type), weaponSkills:equippedWeaponSkills(u.type), tag:cfg.tag||null});
      }
    }
    for(const[k,counts] of Object.entries(e.units)){
      for(let i=0;i<counts.length;i++){
        const cfg=CFG.units[k];
        const bm=e.bossMult||null;
        B.enemyUnits.push({id:uid++, type:k, row:cfg.row,...battleVitals(k,counts[i]),attackMass:e.attackMass,
          attackMassFallsWithHp:!!e.attackMassFallsWithHp,
          icon:cfg.icon, name:cfg.name, tier:cfg.tier??0,
          spd:cfg.spd,
          atk:bm?Math.floor(cfg.atk*bm.atk):cfg.atk,entryAtk:bm?Math.floor(cfg.atk*bm.atk):cfg.atk,
          def:bm?Math.floor(cfg.def*bm.def):cfg.def,entryDef:bm?Math.floor(cfg.def*bm.def):cfg.def,
          tag:cfg.tag||null});
      }
    }
  }
  shiftRows();
}

function hpTone(u){
  const ratio=Math.max(0, Math.min(1, (u.hp||0)/Math.max(1,u.maxHp||1)));
  if(ratio<=0.28)return 'hp-low';
  if(ratio<=0.58)return 'hp-mid';
  return 'hp-high';
}

function renderBattleUnit(u, side){
  const hpPct=Math.max(0, Math.min(100, Math.round((u.hp||0)/Math.max(1,u.maxHp||1)*100)));
  const tier=Math.max(0, Math.min(3, u.tier??0));
  const id=`${side==='our'?'ou':'eu'}-${u.id}`;
  const hiresKey=side==='enemy'&&u.type==='infantry'?'enemy':u.type;
  const hasPortrait=hiresKey==='enemy'||!!CFG.units[hiresKey];
  const unitArt=hasPortrait?
    `<img src="./assets/art/units/hires/${hiresKey}.png" alt="" loading="eager">`:pix(u.icon,'lg');
  const dummyCls=u.type==='dummy'?' dummy-box':'';
  const isSingle=u.type==='dummy'||!!u.attackMass;
  const remaining=isSingle?u.hp:combatSurvivors(u);
  const maximum=isSingle?u.maxHp:u.initialCount??u.maxHp;
  const hpUnit=isSingle?'HP':'人';
  const shield=Math.max(0,u.shield||0);
  const label=`${u.name} ${remaining}/${maximum}${hpUnit}${!isSingle&&u.hpPerSoldier>1?` · 生命${Math.round(u.hp*10)/10}/${Math.round(u.maxHp*10)/10}HP`:''}${shield>0?' 护盾'+shield:''}`;
  return `<div class="unit-box tier-t${tier} ${hpTone(u)}${dummyCls}" id="${id}" title="${label}" aria-label="${label}">
    <span class="unit-art">${unitArt}</span>
    ${shield>0?`<span class="unit-shield" aria-hidden="true">盾${shield}</span>`:''}
    <span class="unit-hpcount" aria-hidden="true">${remaining}/${maximum}${hpUnit}</span>
    <span class="unit-hpbar" aria-hidden="true"><span class="unit-hpfill" style="width:${hpPct}%"></span></span>
  </div>`;
}

// HD-2D 仅接收战斗状态投影；不持有结算状态，也不参与随机数或行动计时。
let _battleVisualFallbackEpoch=-1;
function battleVisualSnapshot(){
  const project=u=>({
    id:u.id,type:u.type,icon:u.icon,name:u.name,row:u.row,
    count:u.alive===false||u.hp<=0?0:u.attackMass||u.type==='dummy'?1:combatSurvivors(u),
    hp:u.hp,maxHp:u.maxHp,shield:u.shield||0
  });
  return{
    epoch:battleEpoch,round:B.round||0,speed:S.battleSpeed,
    stage:B.isTraining?'training':B.enemyCfg?.boss?'boss':'campaign',
    allies:(B.ourUnits||[]).filter(u=>u.alive!==false).map(project),
    enemies:(B.enemyUnits||[]).filter(u=>u.alive!==false).map(project)
  };
}
function updateBattleVisual(){
  const screen=document.getElementById('battle-screen');
  const host=document.getElementById('battle-scene');
  if(!screen||!host||!window.HD2D||location.protocol==='file:')return;
  if(_battleVisualFallbackEpoch===battleEpoch)return;
  const snapshot=battleVisualSnapshot();
  const status=window.HD2D.status();
  const mounted=status?.battle?.mounted===true;
  const active=mounted
    ?window.HD2D.updateBattle(snapshot)
    :window.HD2D.mountBattle(host,snapshot,{
      onFallback:()=>{_battleVisualFallbackEpoch=battleEpoch;screen.classList.remove('hd2d-active');}
    });
  if(active!==true)_battleVisualFallbackEpoch=battleEpoch;
  screen.classList.toggle('hd2d-active',active===true&&window.HD2D.status()?.battle?.mounted===true);
}
function battleVisualEvent(event){
  if(window.HD2D&&document.getElementById('battle-screen')?.classList.contains('hd2d-active'))
    window.HD2D.playBattle({...event,epoch:battleEpoch});
}
function closeBattleVisual(){
  document.getElementById('battle-screen')?.classList.remove('hd2d-active');
  if(window.HD2D)window.HD2D.disposeBattle();
}

function setBattleLogOpen(open){
  B.battleLogOpen=!!open;
  const screen=document.getElementById('battle-screen');
  const btn=document.getElementById('battle-log-toggle');
  if(screen)screen.classList.toggle('log-open', B.battleLogOpen);
  if(btn){
    btn.classList.toggle('on', B.battleLogOpen);
    btn.textContent=B.battleLogOpen?'收起':'日志';
    btn.setAttribute('aria-expanded', B.battleLogOpen?'true':'false');
  }
}

function toggleBattleLog(){
  setBattleLogOpen(!B.battleLogOpen);
}

function drawBattleField(){
  const f=document.getElementById('battle-field');
  const oa=B.ourUnits.filter(u=>u.alive!==false).length;
  const ea=B.enemyUnits.filter(u=>u.alive!==false).length;
  const ohp=B.ourUnits.filter(u=>u.alive!==false).reduce((s,u)=>s+combatSurvivors(u),0);
  const ehp=B.enemyUnits.filter(u=>u.alive!==false).reduce((s,u)=>s+(u.attackMass?u.hp:combatSurvivors(u)),0);
  const enemySummary=B.isTraining?`训练场${ea}个`:B.enemyUnits.some(u=>u.attackMass)?`敌方${ea}个目标·生命${ehp}`:`敌方${ea}个团${ehp}人`;
  document.getElementById('battle-title').innerHTML=`${pix('battle','sm')} <strong class="battle-title-name">${B.enemyCfg.name}</strong><span class="battle-round">回合 ${B.round}</span><span class="battle-title-legacy"> | 我方${oa}团${ohp}人 vs ${enemySummary}</span>`;
  const ourMax=B.ourUnits.reduce((sum,u)=>sum+Math.max(0,u.maxHp||0),0);
  const enemyMax=B.enemyUnits.reduce((sum,u)=>sum+Math.max(0,u.maxHp||0),0);
  const ourNow=B.ourUnits.reduce((sum,u)=>sum+Math.max(0,u.hp||0),0);
  const enemyNow=B.enemyUnits.reduce((sum,u)=>sum+Math.max(0,u.hp||0),0);
  const ourPct=ourMax?Math.max(0,Math.min(100,Math.round(ourNow/ourMax*100))):0;
  const enemyPct=enemyMax?Math.max(0,Math.min(100,Math.round(enemyNow/enemyMax*100))):0;
  const enemyShort=B.isTraining?`${ea}目标`:B.enemyUnits.some(u=>u.attackMass)?`${ea}目标 · ${ehp}HP`:`${ea}团 · ${ehp}人`;
  const hud=document.getElementById('battle-hud');
  if(hud)hud.innerHTML=`<div class="battle-hud-side enemy"><div class="battle-hud-line"><b>${B.isTraining?'训练场':'敌方'}</b><span>${enemyShort}</span></div><div class="battle-hud-bar"><i style="width:${enemyPct}%"></i></div></div><div class="battle-hud-versus" aria-hidden="true">VS</div><div class="battle-hud-side ally"><div class="battle-hud-line"><b>我方</b><span>${oa}团 · ${ohp}人</span></div><div class="battle-hud-bar"><i style="width:${ourPct}%"></i></div></div>`;

  let h='';
  if(B.isTraining){
    h+=`<div class="enemy-zone dummy-zone"><div class="zone-label">${pix('dummy','sm')} 训练场</div>`;
    for(const row of['back','mid','front']){
      const units=B.enemyUnits.filter(u=>u.alive!==false&&u.row===row);
      if(!units.length)continue;
      h+=`<div class="battle-row"><div class="row-label">${row==='front'?'前排':row==='mid'?'中排':'后排'}</div>`;
      for(const u of units){
        h+=renderBattleUnit(u,'enemy');
      }
      h+='</div>';
    }
    h+=`</div><div style="text-align:center;font-size:10px;color:#3a4158;padding:2px">${pix('battle','sm')} VS ${pix('battle','sm')}</div>`;
  }else{
    h+=`<div class="enemy-zone"><div class="zone-label">${pix(B.enemyCfg.boss?'boss':'enemy','sm')} 敌方</div>`;
    for(const row of['back','mid','front']){
      const units=B.enemyUnits.filter(u=>u.alive!==false&&u.row===row);
      if(!units.length)continue;
      h+=`<div class="battle-row"><div class="row-label">${row==='front'?'前排':row==='mid'?'中排':'后排'}</div>`;
      for(const u of units){
        h+=renderBattleUnit(u,'enemy');
      }
      h+='</div>';
    }
    h+=`</div><div style="text-align:center;font-size:10px;color:#3a4158;padding:2px">${pix('battle','sm')} VS ${pix('battle','sm')}</div>`;
  }

  // 我方
  h+=`<div class="our-zone"><div class="zone-label">${pix('army','sm')} 我方</div>`;
  for(const row of['front','mid','back']){
    const units=B.ourUnits.filter(u=>u.alive!==false&&u.row===row);
    if(!units.length)continue;
    h+=`<div class="battle-row"><div class="row-label">${row==='front'?'前排':row==='mid'?'中排':'后排'}</div>`;
    for(const u of units){
      h+=renderBattleUnit(u,'our');
    }
    h+='</div>';
  }
  h+='</div>';
  f.innerHTML=h;
  updateBattleVisual();
}

function bmsg(m,c=''){
  B.msgs.push({m,c});
  const el=document.getElementById('battle-msg');
  el.innerHTML=B.msgs.slice(-25).map(e=>`<span style="color:${e.c||'#666'}">${e.m}</span>`).join('<br>');
  el.scrollTop=el.scrollHeight;
}

// 兵种攻击类型：melee 只能在前排攻击，ranged 任意排都可攻击
function isRanged(unitType){
  if(unitType==='cavalry_wind')return true;
  const bu=baseUnitType(unitType);
  return bu==='archer'||bu==='mage';
}

// 长矛与猎风弩骑的基础暴击率；远征和驻军共用，其他兵种不额外消费随机数。
function combatBaseCritChance(attacker){
  return attacker.tag==='spear'||attacker.type==='cavalry_wind'?0.1:0;
}

function getTarget(attacker,enemyList){
  const alive=enemyList.filter(u=>u.alive!==false);
  if(!alive.length)return null;
  const rows={front:0,mid:1,back:2};
  const minR=Math.min(...alive.map(u=>rows[u.row]));
  const front=alive.filter(u=>rows[u.row]===minR);

  if(!isRanged(attacker.type) && attacker.row!=='front') return null;

  if(isRanged(attacker.type)){
    // 远程：60%命中前排（被前线阻挡）
    if(front.length>0 && Math.random()<0.6){
      return front[Math.floor(Math.random()*front.length)];
    }
    return alive[Math.floor(Math.random()*alive.length)];
  }
  // 近战：只能打敌方最前排
  return front[Math.floor(Math.random()*front.length)];
}

// 伤害公式：出手规模 × ATK × 0.09 × (100/(100+DEF×8)) × 克制 × 法师互易伤 × 被动 × 随机(0.9~1.1) × 特殊Tag因子。
// 普通兵团的出手规模为幸存人数；区域单体Boss按独立attackMass，群体试炼／英魂再按HP折减。
// 乘攻方HP确保总伤害与编队分组无关——1个100人的团 ≈ 2个50人的团
const DAMAGE_COEF = 0.09;
// 保留既有整数伤害和随机扰动；把取整丢掉的小数按出手者累积到下一次普攻。
// 字段只挂在 B 战斗单位上，不进入 S／存档；格挡伤害仍会消费同一随机步但严格为0。
function finalizeCombatDamage(attacker,raw,isCrit){
  const dmgVar=Math.floor(Math.random()*7)-3;
  const scaled=isCrit?raw*2:raw;
  if(!Number.isFinite(scaled)||scaled<=0)return 0;
  const baseDmg=Math.max(1,Math.floor(scaled));
  const fraction=scaled-Math.floor(scaled);
  const previous=Number.isFinite(attacker.damageRemainder)?Math.max(0,Math.min(0.999999999999,attacker.damageRemainder)):0;
  const combined=previous+fraction;
  const carried=Math.floor(combined+1e-12);
  attacker.damageRemainder=Math.max(0,combined-carried);
  return Math.max(1,baseDmg+dmgVar)+carried;
}
function calcDmg(attacker,defender,isOur){
  // 攻击力（含战术加成）
  let atk=attacker.atk;
  if(isOur){
    if(B.tactic.atkPct) atk=Math.floor(atk*(1+B.tactic.atkPct));
    if(attacker.row==='back'&&B.tactic.backPct) atk=Math.floor(atk*(1+B.tactic.backPct));
  }
  // 防御力（我方被攻击时享受战术防御加成）
  let def=defender.def;
  if(!isOur&&B.tactic.defPct) def=Math.floor(def*(1+B.tactic.defPct));
  // 空间系穿甲：忽略目标部分防御
  const aSpec=mageSpec(attacker.type);
  if(aSpec?.armorPierce) def=Math.floor(def*(1-aSpec.armorPierce.defPct));
  // 因子拆解
  const defenseFactor=100/(100+def*8);
  const counterFactor=cm(attacker.type,defender.type);
  const mageFactor=mm(attacker.type,defender.type);
  const passiveFactor=combatBaseUnitType(attacker.type)==='infantry'?1.1:1.0;
  const randomFactor=0.9+Math.random()*0.2;
  // 暴击（长矛兵与猎风弩骑10% / 梅林贤者次元打击）
  const baseCritChance=combatBaseCritChance(attacker);
  let isCrit=baseCritChance>0&&Math.random()<baseCritChance;
  if(!isCrit&&aSpec?.dimensionalStrike&&Math.random()<aSpec.dimensionalStrike.critChance) isCrit=true;
  let specialFactor=1.0;
  const AS=CFG.archerSpecials||{};
  // 弩攻击盾兵：穿透80%伤害
  if(attacker.tag==='crossbow'&&defender.tag==='shield') specialFactor*=AS.crossbow?.attack?.vsShield?.dmgPct||0.8;
  // 刃攻击远程：+60%伤害
  if(attacker.tag==='blade'&&isRanged(defender.type)) specialFactor*=AS.blade?.attack?.vsRanged?.dmgPct||1.6;
  // 刃攻击盾兵：60%伤害
  if(attacker.tag==='blade'&&defender.tag==='shield') specialFactor*=AS.blade?.attack?.vsShield?.dmgPct||0.6;
  // 弓攻击盾兵：80%被格挡无伤
  if(attacker.tag==='bow'&&defender.tag==='shield'&&Math.random()<(AS.bow?.attack?.vsShield?.block||0.8)){
    specialFactor=0;
  }
  const raw=combatAttackMass(attacker)*atk*DAMAGE_COEF*defenseFactor*counterFactor*mageFactor*passiveFactor*randomFactor*specialFactor;
  return {dmg:finalizeCombatDamage(attacker,raw,isCrit),crit:isCrit};
}

function spawnVFX(actorEl,targetEl,type){
  const layer=document.getElementById('battle-vfx-layer');
  if(!layer||!actorEl||!targetEl||document.getElementById('battle-screen')?.classList.contains('hd2d-active'))return;
  const lRect=layer.getBoundingClientRect();
  const aRect=actorEl.getBoundingClientRect();
  const tRect=targetEl.getBoundingClientRect();
  const ax=aRect.left+aRect.width/2-lRect.left;
  const ay=aRect.top+aRect.height/2-lRect.top;
  const dx=tRect.left+tRect.width/2-(aRect.left+aRect.width/2);
  const dy=tRect.top+tRect.height/2-(aRect.top+aRect.height/2);
  const angle=Math.atan2(dy,dx)*180/Math.PI;
  const dist=Math.sqrt(dx*dx+dy*dy);
  const dur=Math.max(0.22, dist/400);
  const el=document.createElement('div');
  const profile=window.UNIT_VFX_PROFILES?.[type];
  if(profile&&/^[a-z0-9_]+$/.test(type)){
    const rank=Math.max(1,Math.min(5,Number(profile.rank)||1));
    const size=Math.round(58+rank*17);
    const color=/^#[0-9a-fA-F]{6}$/.test(profile.halo)?profile.halo:'#fff0cf';
    const travel=profile.trail||'straight';
    const arc=['arc','double_arc','fan','spiral'].includes(travel)?-Math.min(52,dist*0.22):0;
    const bend=['zigzag','forked','spiral'].includes(travel)?(rank>=4?24:15):0;
    const side=dx<0?-1:1;
    const midX=dx*0.48+bend*side,midY=dy*0.48+arc;
    el.className='vfx vfx-unit';
    el.dataset.unitVfx=type;
    el.dataset.rank=String(rank);
    el.style.width=size+'px';el.style.height=size+'px';
    el.style.left=(ax-size/2)+'px';el.style.top=(ay-size/2)+'px';
    el.style.background=`center / contain no-repeat url('./assets/art/vfx/units/${type}.png')`;
    el.style.imageRendering='pixelated';
    el.style.filter=`drop-shadow(0 0 ${3+rank*2}px ${color})`;
    layer.appendChild(el);
    const rotation=angle+'deg';
    const pose=(x,y,scale)=>`translate(${x}px,${y}px) rotate(${rotation}) scale(${scale})`;
    el.animate([
      {transform:pose(0,0,0.48),opacity:0,offset:0},
      {transform:pose(midX,midY,0.70+rank*0.055),opacity:0.92,offset:0.52},
      {transform:pose(dx,dy,0.82+rank*0.065),opacity:1,offset:0.83},
      {transform:pose(dx,dy,1.04+rank*0.08),opacity:0,offset:1}
    ],{duration:dur*1000,easing:'ease-out',fill:'forwards'});
    setTimeout(()=>el.remove(),dur*1000+200);
    return;
  }
  const base=combatBaseUnitType(type),tag=unitTag(type);
  const vfxMap={infantry:'swordqi',archer:'arrow',spearman:'thrust',cavalry:'cavslash',mage:'magebolt'};
  const vfxType=type==='cavalry_wind'||['alloy_special','armored_trooper'].includes(type)?'arrow':
    ['cavalry_dragon','electro_trooper','star_trooper'].includes(type)?'magebolt':
    ['archer_assassin','archer_shadowblade'].includes(type)?'swordqi':
    tag==='spear'?'thrust':vfxMap[base]||'swordqi';
  const isSwordQi=vfxType==='swordqi';
  const isArcStrike=vfxType==='cavslash';
  const isImageShot=vfxType==='arrow'||vfxType==='thrust'||vfxType==='magebolt';
  const swordW=isSwordQi?Math.max(82,Math.min(132,dist*0.68)):0;
  const swordH=isSwordQi?swordW*813/867:0;
  const arcW=isArcStrike?Math.max(98,Math.min(152,dist*0.74)):0;
  const arcH=isArcStrike?arcW*806/868:0;
  const shotMin=vfxType==='arrow'?74:vfxType==='thrust'?86:78;
  const shotMax=vfxType==='arrow'?132:vfxType==='thrust'?150:138;
  const shotW=isImageShot?Math.max(shotMin,Math.min(shotMax,dist*0.78)):0;
  const shotH=isImageShot?shotW*(vfxType==='arrow'?511/1016:vfxType==='thrust'?451/1146:497/945):0;
  const originX=isSwordQi?swordW*0.18:isArcStrike?arcW*0.76:isImageShot?shotW*0.9:0;
  const originY=isSwordQi?swordH*0.9:isArcStrike?arcH*0.58:isImageShot?shotH*0.5:0;
  el.className=`vfx vfx-${vfxType}`;
  if(isSwordQi||isArcStrike||isImageShot){
    el.style.width=(isSwordQi?swordW:isArcStrike?arcW:shotW)+'px';
    el.style.height=(isSwordQi?swordH:isArcStrike?arcH:shotH)+'px';
    el.style.left=(ax-originX)+'px';
    el.style.top=(ay-originY)+'px';
    el.style.transformOrigin=`${originX}px ${originY}px`;
  }else{
    el.style.left=ax+'px';
    el.style.top=ay+'px';
  }
  layer.appendChild(el);
  const rotateOffset=isSwordQi?72:isArcStrike?180:90;
  const frames=isSwordQi?[
    { transform:`rotate(${angle+rotateOffset}deg) scale(.55)`, opacity:0, filter:'brightness(1.45) drop-shadow(0 0 8px rgba(180,220,255,.95))', offset:0 },
    { transform:`rotate(${angle+rotateOffset}deg) scale(1.08)`, opacity:1, filter:'brightness(1.25) drop-shadow(0 0 16px rgba(210,235,255,.9))', offset:.28 },
    { transform:`rotate(${angle+rotateOffset}deg) scale(.96)`, opacity:.12, filter:'brightness(1) drop-shadow(0 0 4px rgba(120,170,255,.45))', offset:1 }
  ]:isArcStrike?[
    { transform:`rotate(${angle+rotateOffset}deg) scale(.55)`, opacity:0, filter:'brightness(1.4) drop-shadow(0 0 10px rgba(110,190,255,.95))', offset:0 },
    { transform:`rotate(${angle+rotateOffset}deg) scale(1.08)`, opacity:1, filter:'brightness(1.22) drop-shadow(0 0 18px rgba(255,215,90,.9))', offset:.3 },
    { transform:`rotate(${angle+rotateOffset}deg) scale(.98)`, opacity:.12, filter:'brightness(1) drop-shadow(0 0 5px rgba(110,190,255,.4))', offset:1 }
  ]:isImageShot?[
    { transform:`translate(0,0) rotate(${angle}deg) scale(.75)`, opacity:0, filter:`brightness(1.35) drop-shadow(0 0 8px ${vfxType==='magebolt'?'rgba(135,110,255,.9)':'rgba(255,205,95,.85)'})`, offset:0 },
    { transform:`translate(${dx*0.75}px,${dy*0.75}px) rotate(${angle}deg) scale(1)`, opacity:1, filter:`brightness(1.18) drop-shadow(0 0 12px ${vfxType==='magebolt'?'rgba(135,110,255,.85)':'rgba(255,205,95,.75)'})`, offset:.7 },
    { transform:`translate(${dx}px,${dy}px) rotate(${angle}deg) scale(.92)`, opacity:.2, filter:`brightness(1) drop-shadow(0 0 4px ${vfxType==='magebolt'?'rgba(135,110,255,.4)':'rgba(255,205,95,.35)'})`, offset:1 }
  ]:[
    { transform:`rotate(${angle+rotateOffset}deg)`, offset:0 },
    { transform:`translate(${dx}px,${dy}px) rotate(${angle+rotateOffset}deg)`, offset:1 }
  ];
  el.animate(frames,{duration:dur*1000,easing:(isSwordQi||isArcStrike||isImageShot)?'cubic-bezier(.16,.84,.32,1)':'ease-out',fill:'forwards'});
  setTimeout(()=>el.remove(), dur*1000+200);
}

// 同速兵团每回合洗牌一次；随机数不能放在 sort 比较器里，
// 否则比较次数由 JS 引擎决定，战斗结果会随运行环境改变。
function combatSpeedValue(speed){return Number.isFinite(speed)?speed:0}
function sortCombatUnitsBySpeed(units,speedOf){
  const ranked=units.map((unit,index)=>{
    return {unit,speed:combatSpeedValue(speedOf(unit)),index};
  });
  ranked.sort((a,b)=>b.speed-a.speed||a.index-b.index);
  for(let start=0;start<ranked.length;){
    let end=start+1;
    while(end<ranked.length&&ranked[end].speed===ranked[start].speed)end++;
    for(let i=end-1;i>start;i--){
      const j=start+Math.floor(Math.random()*(i-start+1));
      [ranked[i],ranked[j]]=[ranked[j],ranked[i]];
    }
    start=end;
  }
  for(let i=0;i<ranked.length;i++)units[i]=ranked[i].unit;
  return units;
}

function battleTurn(){
  if(!S.battleActive)return;
  const epoch=battleEpoch;
  B.round++;
  shiftRows();
  if(B.round>B.maxRound){endBattle('timeout');return}

  const ourAlive=[], enemyAlive=[];
  for(const u of B.ourUnits) if(u.alive!==false) ourAlive.push(u);
  for(const u of B.enemyUnits) if(u.alive!==false&&u.type!=='dummy') enemyAlive.push(u);

  if(ourAlive.length===0){endBattle('lose');return}

  // 时光回声结算（上回合存储的回声伤害）
  if(B.temporalEchoes&&B.temporalEchoes.length>0){
    const allUnits=[...B.ourUnits,...B.enemyUnits];
    for(const echo of B.temporalEchoes){
      const t=allUnits.find(u=>u.id===echo.targetId);
      if(t&&t.alive!==false&&t.hp>0){
        const source=allUnits.find(u=>u.id===echo.actorId);
        const dealt=applyCombatDamage(t,echo.dmg,source);
        bmsg(`[时光回声] ${echo.actorName} 回声 → ${t.name} ${dealt.shieldLost+dealt.hpLost}点伤害`,'#c0a060');
      }
    }
    B.temporalEchoes=[];
  }

  // 时序疾行：每回合速度累积增长
  for(const u of ourAlive){
    const spec=mageSpec(u.type);
    if(spec?.temporalHaste){
      if(!u.hasteRounds)u.hasteRounds=0;
      u.hasteRounds++;
      u.spd=Math.floor((u.baseSpd||u.spd)*(1+spec.temporalHaste.speedPct*u.hasteRounds));
    }
  }

  const ourSpd=u=>Math.floor(u.spd*(1+(B.tactic.spdPct||0)));
  sortCombatUnitsBySpeed(ourAlive,ourSpd);
  sortCombatUnitsBySpeed(enemyAlive,u=>u.spd);

  const isBossFight=B.enemyCfg&&B.enemyCfg.boss&&enemyAlive.length===1;

  const actions=[];
  if(enemyAlive.length===0){
    // 训练场：只有我方攻击，敌方木人桩不还手
    for(const u of ourAlive){
      actions.push({unit:u,side:'our'});
      if(mageSpec(u.type)?.precognition?.extraAction) actions.push({unit:u,side:'our'});
    }
  } else if(isBossFight){
    for(const u of ourAlive){
      actions.push({unit:u,side:'our'});
      if(mageSpec(u.type)?.precognition?.extraAction) actions.push({unit:u,side:'our'});
    }
    actions.push({unit:enemyAlive[0],side:'enemy'});
  } else {
    const maxCnt=Math.max(ourAlive.length,enemyAlive.length);
    const ourFast=combatSpeedValue(ourSpd(ourAlive[0]));
    const enemyFast=combatSpeedValue(enemyAlive[0].spd);
    const ourFirst=ourFast>enemyFast?true:enemyFast>ourFast?false:Math.random()<0.5;
    for(let i=0;i<maxCnt;i++){
      if(ourFirst){
        const ou=ourAlive[i%ourAlive.length];
        actions.push({unit:ou,side:'our'});
        if(mageSpec(ou.type)?.precognition?.extraAction) actions.push({unit:ou,side:'our'});
        actions.push({unit:enemyAlive[i%enemyAlive.length],side:'enemy'});
      } else {
        actions.push({unit:enemyAlive[i%enemyAlive.length],side:'enemy'});
        const ou=ourAlive[i%ourAlive.length];
        actions.push({unit:ou,side:'our'});
        if(mageSpec(ou.type)?.precognition?.extraAction) actions.push({unit:ou,side:'our'});
      }
    }
  }

  let idx=0,delay=(CFG.battleStepDelay||840)/S.battleSpeed;

  function nextAction(){
    if(!S.battleActive||battleEpoch!==epoch)return;
    if(idx>=actions.length){
      drawBattleField();
      const oa=B.ourUnits.filter(u=>u.alive!==false).length;
      const ea=B.enemyUnits.filter(u=>u.alive!==false).length;
      if(oa===0){endBattle('lose');return}
      if(ea===0){endBattle('win');return}
      bmsg(`── 回合${B.round}结束 ──`,'#555');
      queueBattleStep(battleTurn,(CFG.battleRoundDelay||525)/S.battleSpeed,epoch);
      return;
    }

    const {unit:actor,side}=actions[idx];
    if(actor.alive===false){idx++;nextAction();return}
    // 时锁：跳过本次行动
    if(actor.skipNextAction){actor.skipNextAction=false;idx++;nextAction();return}

    const enemyList=side==='our'?B.enemyUnits:B.ourUnits;
    const target=getTarget(actor,enemyList);
    if(!target){idx++;nextAction();return}

    const actorEl=document.getElementById((side==='our'?'ou-':'eu-')+actor.id);
    const targetEl=document.getElementById((side==='our'?'eu-':'ou-')+target.id);

    if(targetEl)targetEl.classList.add('targeted');
    if(actorEl)actorEl.classList.add('attacking');
    battleVisualEvent({type:'attack',sourceId:actor.id,targetId:target.id,
      sourceSide:side==='our'?'allies':'enemies',targetSide:side==='our'?'enemies':'allies',
      durationMs:Math.max(180,Math.min(1200,delay))});

    const armorOpening=side==='our'?applyArmorOpeningSkills(actor):null;
    if(armorOpening?.hpAdded)bmsg(`[能源护甲] ${actor.name} 临时生命+${armorOpening.hpAdded}`,'#8da8c8');
    if(armorOpening?.defConverted)bmsg(`[纳米重构] ${actor.name} 防御-${armorOpening.defConverted}、攻击+${armorOpening.atkAdded}`,'#8da8c8');
    const awakening=side==='our'?applyAwakeningOpeningSkills(actor,target,enemyList):null;
    if(awakening?.defReduced)bmsg(`[星核干扰] ${actor.name} 令 ${target.name} 防御-${awakening.defReduced}`,'#8da8c8');
    if(awakening?.trueDamage)bmsg(`[星核贯穿] ${actor.name} 对 ${target.name} 造成${awakening.trueDamage}点真实伤害`,'#8da8c8');
    if(awakening?.areaTargets)bmsg(`[星辉裁决] ${actor.name} 波及敌方${awakening.areaTargets}团，生命-${awakening.areaDamage}、防御-${awakening.areaDefReduced}`,'#c6a8e8');
    const guardDefense=side==='our'?applyTrialGuardDefensePassives(target,actor,enemyList,B.ourUnits):null;
    if(guardDefense?.changed)bmsg(`[圣域守御] ${target.name} 稳固本场防御`,'#d8c38d');
    const guardTrueDamage=side==='enemy'?applyEasyTrialGuardAttackSkill(actor,target):0;
    if(guardTrueDamage)bmsg(`[圣域神技] ${actor.name} 对 ${target.name} 造成${guardTrueDamage}点真实伤害`,'#d8c38d');
    if(target.alive===false||target.hp<=0){
      queueBattleStep(()=>{
        if(!S.battleActive||battleEpoch!==epoch)return;
        if(actorEl)actorEl.classList.remove('attacking');
        if(targetEl)targetEl.classList.remove('targeted');
        idx++;drawBattleField();nextAction();
      },delay);
      return;
    }
    const firstSniperAttack=side==='our'&&actor.weaponSkills?.snipe&&!actor.sniperUsed;
    if(firstSniperAttack)actor.sniperUsed=true;
    const firstMortarAttack=side==='our'&&actor.weaponSkills?.bombard&&!actor.mortarUsed;
    if(firstMortarAttack)actor.mortarUsed=true;
    const firstStarAttack=side==='our'&&(actor.weaponSkills?.starFighter||actor.weaponSkills?.starMissile)&&!actor.starWeaponUsed;
    if(firstStarAttack)actor.starWeaponUsed=true;
    const sweeping=side==='our'&&steamSweepActive(actor,enemyList);
    const archerMiss=isAttackMiss(actor,target);
    const cavDodge=!archerMiss&&combatBaseUnitType(target.type)==='cavalry'&&!isRanged(actor.type)&&Math.random()<0.1;
    // 时光折射：时间系法师预见未来闪避攻击
    const tSpec=mageSpec(target.type);
    const temporalDodge=tSpec?.temporalDodge&&Math.random()<tSpec.temporalDodge.chance;
    const missed=archerMiss||cavDodge||temporalDodge;
    const cr=missed?{dmg:0,crit:false}:calcDmg(actor,target,side==='our');
    const dmg=cr.dmg; const isCrit=cr.crit;
    const cmv=cm(actor.type,target.type);
    const mmv=mm(actor.type,target.type);
    const trainingHit=missed?0:Math.min(dmg,target.hp);

    // 伤害转移：空间系法师被攻击时概率转移伤害给随机敌人
    let redirectTarget=null;
    if(!missed){
      const tSpec2=mageSpec(target.type);
      if(tSpec2?.redirect&&Math.random()<tSpec2.redirect.chance){
        const candidates=enemyList.filter(u=>u!==target&&u.alive!==false&&u.hp>0&&u!==actor);
        if(candidates.length>0){
          redirectTarget=candidates[Math.floor(Math.random()*candidates.length)];
        }
      }
    }

    if(!missed&&actorEl&&targetEl){
      spawnVFX(actorEl,targetEl,actor.type);
    }

    if(B.isTraining&&side==='our'){
      if(!B.trainingStats[actor.type])B.trainingStats[actor.type]={dmg:0,atks:0,crits:0,misses:0};
      const ts=B.trainingStats[actor.type];
      ts.atks++;
      if(missed){ts.misses++;}
      else{ts.dmg+=trainingHit;if(isCrit)ts.crits++;}
      if(target.dummyIdx!==undefined)B.dummyDmg[target.dummyIdx]+=trainingHit;
    }

    queueBattleStep(()=>{
      if(!S.battleActive||battleEpoch!==epoch)return;
      if(actorEl)actorEl.classList.remove('attacking');
      if(targetEl)targetEl.classList.remove('targeted');

      const isGood=cmv>=1.3,isBad=cmv<=0.7;

      if(missed){
        const reason=cavDodge?' [闪避]':temporalDodge?' [时光折射]':combatBaseUnitType(target.type)==='cavalry'?' [骑兵闪避]':'';
        bmsg(`${side==="our"?"[我方]":"[敌方]"}${actor.name} → ${target.name} MISS${reason}`,'#6f7890');
        idx++;
        drawBattleField();
        nextAction();
        return;
      }

      // 伤害转移生效：切换目标
      let finalTarget=target, finalEl=targetEl;
      if(redirectTarget){
        bmsg(`[空间扭曲] ${target.name} 将伤害转移至 ${redirectTarget.name}`,'#7a90c0');
        finalTarget=redirectTarget;
        finalEl=document.getElementById((side==='our'?'eu-':'ou-')+redirectTarget.id);
        if(finalEl)finalEl.classList.add('targeted');
      }

      const steamSkill=side==='our'?applySteamWeaponSkillHits(actor,enemyList,finalTarget,dmg,sweeping,firstMortarAttack):null;
      const starSkill=side==='our'?applyStarWeaponSkillHits(actor,finalTarget,dmg,firstStarAttack):null;
      const hit=sweeping||starSkill?.replacesNormal?{hpLost:0,shieldLost:0,casualties:0}:applyCombatDamage(finalTarget,dmg,actor);
      const skill=side==='our'?applyElectroWeaponSkillHits(actor,finalTarget,dmg,firstSniperAttack):null;
      battleVisualEvent({type:'hit',sourceId:actor.id,targetId:finalTarget.id,
        sourceSide:side==='our'?'allies':'enemies',targetSide:side==='our'?'enemies':'allies',durationMs:230});
      const finalKill=hit.casualties+(steamSkill?.primary.casualties||0)+(skill?.casualties||0)+(starSkill?.casualties||0);
      const finalHpDamage=hit.hpLost+(steamSkill?.primary.hpLost||0)+(skill?.hpLost||0)+(starSkill?.hpLost||0);
      const finalDamage=hit.shieldLost+(steamSkill?.primary.shieldLost||0)+finalHpDamage+(skill?.shieldLost||0)+(starSkill?.shieldLost||0);
      if(B.isTraining&&side==='our'&&steamSkill){
        B.trainingStats[actor.type].dmg+=steamSkill.totalHpLost;
        for(const s of steamSkill.hits)if(s.unit.dummyIdx!==undefined)B.dummyDmg[s.unit.dummyIdx]+=s.hpLost;
      }
      if(B.isTraining&&side==='our'&&skill){
        B.trainingStats[actor.type].dmg+=skill.hpLost;
        if(finalTarget.dummyIdx!==undefined)B.dummyDmg[finalTarget.dummyIdx]+=skill.hpLost;
      }
      if(B.isTraining&&side==='our'&&starSkill){
        B.trainingStats[actor.type].dmg+=starSkill.hpLost-(starSkill.replacesNormal?trainingHit:0);
        if(finalTarget.dummyIdx!==undefined)B.dummyDmg[finalTarget.dummyIdx]+=starSkill.hpLost-(starSkill.replacesNormal?trainingHit:0);
      }
      if(skill?.sniped)bmsg(`[精准狙击] ${actor.name} 追加穿甲伤害${skill.snipeDamage}，目标防御-${skill.defReduced}`,'#8da8c8');
      if(steamSkill?.swept)bmsg(`[蒸汽扫射] ${actor.name} 扫过前排，造成${steamSkill.totalDamage}点伤害`,'#b9a16d');
      if(steamSkill?.bombarded)bmsg(`[迫击轰击] ${actor.name} 首击覆盖敌方前排`,'#b9a16d');
      if(skill?.rapidHits)bmsg(`[电磁连射] ${actor.name} 连射${skill.rapidHits}次`,'#8da8c8');
      if(starSkill?.fighter)bmsg(`[星界战机] ${actor.name} 首击命中，目标防御-${starSkill.defReduced}`,'#8da8c8');
      if(starSkill?.missile)bmsg(`[星陨飞弹] ${actor.name} 首击造成无视防御伤害`,'#8da8c8');
      const revivalHeal=(hit.healed||0)+(steamSkill?.healed||0)+(skill?.healed||0)+(starSkill?.healed||0);
      const revivalDef=(hit.defAdded||0)+(steamSkill?.defAdded||0)+(skill?.defAdded||0)+(starSkill?.defAdded||0);
      if(revivalDef>0)bmsg(`[圣辉自愈] ${finalTarget.name} 回复${revivalHeal}点生命、防御+${revivalDef}`,'#d8c38d');
      const targetIsBoss=!!finalTarget.attackMass;

      if(finalTarget.hp<=0){
        if(finalEl){finalEl.classList.add('dead');setTimeout(()=>{if(battleEpoch===epoch)finalEl.classList.add('dead-done')},500);}
        bmsg(`${side==="our"?"[我方]":"[敌方]"}${actor.name} → ${finalTarget.name} ${targetIsBoss?'造成'+finalHpDamage+'点伤害，目标倒下':'击杀'+finalKill+'人，'+finalTarget.name+'全灭'}！`+(isGood?'[克制]':'')+(mmv>1?'[易伤]':''),isGood?'#40bf80':'#e06060');
        // 时光倒流：时间系法师击杀时回复HP
        const aSpec=mageSpec(actor.type);
        if(aSpec?.rewind){
          const heal=healCombatUnit(actor,Math.floor((targetIsBoss?1:finalKill)*aSpec.rewind.healPct));
          bmsg(`[时光倒流] ${actor.name} 回复${heal}点生命`,'#40bf80');
        }
      }else{
        if(finalEl){finalEl.classList.add('hit');setTimeout(()=>{if(battleEpoch===epoch)finalEl.classList.remove('hit')},400);}
        bmsg(`${side==="our"?"[我方]":"[敌方]"}${actor.name} → ${finalTarget.name} ${targetIsBoss?'造成'+finalHpDamage+'点伤害':'造成'+finalHpDamage+'点伤害、阵亡'+finalKill+'人'}${hit.shieldLost?`、破盾${hit.shieldLost}`:''}，${finalTarget.name}剩余${targetIsBoss?finalTarget.hp:combatSurvivors(finalTarget)}${targetIsBoss?'HP':'人'}`+(isBad?'[劣势]':''),'#888');
        // 时锁：时间系法师概率使目标跳过下次行动
        const aSpec=mageSpec(actor.type);
        if(aSpec?.timeLock&&Math.random()<aSpec.timeLock.chance){
          finalTarget.skipNextAction=true;
          bmsg(`[时锁] ${finalTarget.name}行动被跳过`,'#c0a060');
        }
      }
      // 裂隙反伤：空间系法师被攻击时反弹伤害
      const tSpec3=mageSpec(target.type);
      if(tSpec3?.riftReflect&&!redirectTarget&&finalDamage>0){
        const reflectDmg=Math.max(1,Math.floor(finalDamage*tSpec3.riftReflect.dmgPct));
        const reflected=applyCombatDamage(actor,reflectDmg,finalTarget);
        bmsg(`[裂隙反伤] ${target.name} → ${actor.name} 反弹${reflected.shieldLost+reflected.hpLost}点伤害`,'#b080d0');
      }
      // 空间系AOE溅射
      const aSpec=mageSpec(actor.type);
      if(aSpec?.aoe&&finalDamage>0){
        const aoeCount=aSpec.aoe.targets;
        const aoePct=aSpec.aoe.dmgPct;
        const others=enemyList.filter(u=>u!==finalTarget&&u.alive!==false&&u.hp>0);
        for(let i=0;i<Math.min(aoeCount,others.length);i++){
          const at=others[i];
          const aoeDmg=Math.max(1,Math.floor(finalDamage*aoePct));
          const splash=applyCombatDamage(at,aoeDmg,actor);
          bmsg(`[虚空溅射] ${actor.name} → ${at.name} ${splash.shieldLost+splash.hpLost}点伤害`,'#7a90c0');
        }
      }
      // 时光回声：时间系法师造成的伤害部分存储，下回合初释放
      if(aSpec?.temporalEcho&&!redirectTarget&&finalDamage>0){
        const echoDmg=Math.max(1,Math.floor(finalDamage*aSpec.temporalEcho.dmgPct));
        if(!B.temporalEchoes)B.temporalEchoes=[];
        B.temporalEchoes.push({targetId:finalTarget.id, dmg:echoDmg, actorId:actor.id, actorName:actor.name});
      }
      // 清理redirectTarget的高亮
      if(redirectTarget&&finalEl) setTimeout(()=>{if(battleEpoch===epoch)finalEl.classList.remove('targeted')},300);

      idx++;
      drawBattleField();
      nextAction();
    },delay);
  }
  nextAction();
}

// 从存活战斗单位重建阵容，并从军营自动补兵
function rebuildFormation(){
  const newForm={front:[],mid:[],back:[]};
  for(const u of B.ourUnits){
    if(u.alive===false||u.hp<=0)continue;
    const row=u.originRow,fu=S.formation[row]?.[u.originIndex];
    if(fu&&fu.id===u.fid&&fu.type===u.type)
      newForm[row].push({type:fu.type,count:Math.min(fu.count,u.initialCount??fu.count,combatSurvivors(u)),id:fu.id});
  }
  S.formation=newForm;
}

function showTrainingResult(){
  const resEl=document.getElementById('battle-result');
  const ts=B.trainingStats||{};
  let h=`<div style="font-size:14px;font-weight:bold;color:#e0c870;margin-bottom:8px">${pix('dummy','sm')} 训练结束 — 数据统计</div>`;
  h+=`<div style="font-size:10px;color:#888;margin-bottom:8px">回合${B.round} | 击破${B.enemyUnits.filter(u=>u.alive===false).length}/9个训练目标</div>`;
  let totalDmg=0,totalAtks=0;
  for(const[uk,t] of Object.entries(ts)){
    totalDmg+=t.dmg; totalAtks+=t.atks;
  }
  h+=`<div style="font-size:11px;color:#aaa;margin-bottom:6px">总伤害: <span style="color:#f0d060">${totalDmg}</span> | 总攻击: <span style="color:#f0d060">${totalAtks}</span></div>`;
  for(const[uk,t] of Object.entries(ts)){
    const cfg=CFG.units[uk]; if(!cfg)continue;
    const avg=t.atks>t.misses?(t.dmg/Math.max(1,t.atks-t.misses)).toFixed(1):'0';
    h+=`<div class="training-stat-row">
      <span class="ts-icon">${pix(cfg.icon,'sm')}</span>
      <div class="ts-info">
        <div class="ts-name">${cfg.name}</div>
        <div class="ts-num">伤害:${t.dmg} | 攻击:${t.atks}次 | 均伤:${avg} | 暴击:${t.crits||0} | MISS:${t.misses||0}</div>
      </div>
    </div>`;
  }
  h+=`<div class="result-btns" style="margin-top:8px">
    <button class="btn btn-go btn-sm" onclick="retryTraining()">重新测试</button>
    <button class="btn btn-ghost btn-sm" onclick="exitTraining()">退出训练</button>
  </div>`;
  resEl.className='win';
  resEl.innerHTML=h;
  resEl.style.display='flex';
}

function retryTraining(){
  stopBattleTimer();
  document.getElementById('battle-result').style.display='none';
  document.getElementById('battle-msg').innerHTML='';
  S.battleActive=true; B.isTraining=true;
  initBattleState();
  drawBattleField();
  bmsg('重新测试开始！','#f0d060');
  queueBattleStep(battleTurn,(CFG.battleStepDelay||840)/S.battleSpeed);
}

function exitTraining(){
  stopBattleTimer();
  closeBattleVisual();
  S.battleActive=false; B.isTraining=false;
  document.getElementById('battle-screen').classList.remove('active');
  document.getElementById('navbar').classList.remove('paused');
  document.getElementById('topbar').classList.remove('paused');
  document.getElementById('main').classList.remove('paused');
  document.getElementById('battle-result').style.display='none';
  S.formation=S._preForm;
  addLog('退出训练'); save(); updateUI();
}

function endBattle(result){
  if(B.settled)return;
  if(specialEncounterConfig(S.battleEncounter)&&result==='win'&&B.enemyUnits?.some(u=>u.alive!==false))return;
  B.settled=true;
  stopBattleTimer();
  S.battleActive=false;
  const before={formation:S.formation,res:{...S.res},items:{...S.items},killValues:{...S.killValues},soulRealmTeam:S.soulRealmTeam?{...S.soulRealmTeam,slots:[...S.soulRealmTeam.slots]}:null,awakening:S.awakening,development:S.development,merit:S.merit,essence:{...S.essence},defeated:[...S.defeated],log:S.log.slice()};
  rebuildFormation();
  if(B.isTraining){
    B.isTraining=false;
    showTrainingResult();
    if(!save().ok){
      S.formation=before.formation;
      const resEl=document.getElementById('battle-result');
      resEl.innerHTML='<span class="result-text">保存失败，训练结算未生效；请导出可恢复存档后重试。</span>';
      resEl.className='lose';resEl.style.display='flex';
    }
    updateUI();
    return;
  }
  const resEl=document.getElementById('battle-result');
  let text='',cls='';
  let battleLog='';
  if(result==='win'){
    cls='win';text=`${pix('win','sm')} 胜利！`;
    const domain=specialEncounterConfig(S.battleEncounter),special=!!domain;
    const e=special?B.enemyCfg:CFG.enemies[S.selEnemy];
    // 统计战损
    let lossTotal=0;
    const lossByType={};
    const preForm=S._preForm||{front:[],mid:[],back:[]};
    for(const row of['front','mid','back']){
      for(const u of preForm[row]){lossByType[u.type]=(lossByType[u.type]||0)+u.count;}
      for(const u of S.formation[row]){lossByType[u.type]=(lossByType[u.type]||0)-u.count;}
    }
    for(const[k,v] of Object.entries(lossByType)){if(v>0)lossTotal+=v;}
    // 发放奖励（含战功）
    let rewardHtml='';
    if(domain?.awakeningTrial){
      const unit=CFG.awakening.unit,prior=S.awakening[unit],trial=CFG.awakening.trials[B.trialMode];
      const nextLevel=prior.level+1,band=1+Math.floor((nextLevel-1)/5),starGain=band*trial.stars;
      S.awakening={...S.awakening,[unit]:{level:nextLevel,stars:prior.stars+starGain,
        tracks:{...prior.tracks,[B.trialMode]:prior.tracks[B.trialMode]+1}}};
      rewardHtml+=`<div style="font-size:11px;color:#f0d060">${CFG.units[unit].name}觉醒 ${prior.level} → ${nextLevel}阶，星辉 +${starGain}</div>`;
      rewardHtml+=`<div style="font-size:10px;color:#aaa">全军基础攻击与生命随星辉成长；20阶神技另行解锁</div>`;
    }else if(domain?.developmentBorder){
      const siteKey=domain.site,previous=S.development.border.sites[siteKey];
      const level=Math.min(CFG.developmentCollection.maxLevel,previous.level+domain.levelPerWin);
      const wins=Math.min(Number.MAX_SAFE_INTEGER,previous.wins+1);
      S.development={...S.development,border:{...S.development.border,sites:{...S.development.border.sites,
        [siteKey]:{level,wins}}}};
      rewardHtml+=`<div style="font-size:11px;color:#f0d060">${CFG.res[siteKey].name}采集点 ${previous.level} → ${level}级</div>`;
      for(const [rk,amount] of Object.entries(e.reward)){
        const gained=creditResourceReward(rk,amount);
        rewardHtml+=`<div style="font-size:11px;color:#f0d060">${pix(CFG.res[rk].icon,'mini')} ${resourceDisplayName(rk)} +${gained}</div>`;
      }
      rewardHtml+='<div style="font-size:10px;color:#aaa">获得点位等级后，可选择该点每60秒在线采集；本场不直接发金属。</div>';
      rewardHtml+=`<div style="font-size:10px;color:#aaa">边疆警戒值 ${e.alert} → ${Math.min(13000,wins*domain.alertPerWin)}</div>`;
    }else if(domain?.developmentOuter){
      const regionKey=domain.region,previous=S.development.outer[regionKey];
      const wins=Math.min(Number.MAX_SAFE_INTEGER,previous.wins+1);
      const alert=previous.alert>=13000?previous.alert:Math.min(13000,previous.alert+domain.alertPerWin);
      S.development={...S.development,outer:{...S.development.outer,
        [regionKey]:{wins,alert}}};
      for(const [rk,amount] of Object.entries(e.reward)){
        const gained=creditResourceReward(rk,amount);
        rewardHtml+=`<div style="font-size:11px;color:#f0d060">${pix(CFG.res[rk].icon,'mini')} ${resourceDisplayName(rk)} +${gained}</div>`;
      }
      for(const [itemKey,chance] of [['sacredBlood',e.bloodDropChance],['emberElixir',e.emberDropChance]]){
        if(chance>0&&Math.random()*10000<chance){
          const item=CFG.eraMaterials[itemKey],old=S.items[itemKey];
          S.items[itemKey]=old>=item.max?old:Math.min(item.max,old+1);
          if(S.items[itemKey]>old)rewardHtml+=`<div style="font-size:11px;color:#f0d060">${item.name} +1</div>`;
        }
      }
      rewardHtml+=`<div style="font-size:10px;color:#aaa">外域警戒值 ${e.alert} → ${alert}</div>`;
    }else if(special){
      const materialKey=domain.primaryReward||domain.key,material=domain.resourceReward?CFG.res[materialKey]:CFG.eraMaterials[materialKey],killKey=domain.killValueKey||'godRevival';
      let gained;
      if(domain.resourceReward)gained=creditResourceReward(materialKey,e.reward[materialKey]);
      else{
        const old=S.items[materialKey];
        S.items[materialKey]=old>=material.max?old:Math.min(material.max,old+e.reward[materialKey]);
        gained=S.items[materialKey]-old;
      }
      S.killValues[killKey]=e.nextKillValue;
      if(domain.soulRealm)S.soulRealmTeam.slots[e.soulSlot]=null;
      rewardHtml+=`<div style="font-size:11px;color:#f0d060">${material.name} +${gained}</div>`;
      if(materialKey!=='medal'&&e.reward.medal!=null){
        const medalGain=creditResourceReward('medal',e.reward.medal);
        rewardHtml+=`<div style="font-size:11px;color:#f0d060">${resourceDisplayName('medal')} +${medalGain}</div>`;
      }
      if(domain.wildHunt){
        const hideGain=creditResourceReward('hide',e.reward.hide);
        rewardHtml+=`<div style="font-size:11px;color:#f0d060">${resourceDisplayName('hide')} +${hideGain}</div>`;
      }
      for(const itemKey of Object.keys(domain.bonusItemReward||{})){
        const item=CFG.eraMaterials[itemKey],old=S.items[itemKey];
        S.items[itemKey]=old>=item.max?old:Math.min(item.max,old+e.reward[itemKey]);
        rewardHtml+=`<div style="font-size:11px;color:#f0d060">${item.name} +${S.items[itemKey]-old}</div>`;
      }
      if(e.emberDropChance>0&&Math.random()*10000<e.emberDropChance){
        const item=CFG.eraMaterials.emberElixir,old=S.items.emberElixir;
        S.items.emberElixir=old>=item.max?old:Math.min(item.max,old+1);
        if(S.items.emberElixir>old)rewardHtml+=`<div style="font-size:11px;color:#f0d060">${item.name} +1</div>`;
      }
      if(e.aegisDropChance>0&&Math.random()*10000<e.aegisDropChance){
        const item=CFG.eraMaterials.aegisElixir,old=S.items.aegisElixir;
        S.items.aegisElixir=old>=item.max?old:Math.min(item.max,old+1);
        if(S.items.aegisElixir>old)rewardHtml+=`<div style="font-size:11px;color:#f0d060">${item.name} +1</div>`;
      }
      if(domain.wildHunt&&Math.random()*100<e.heartChance){
        const itemKey=domain.dropItem,item=CFG.eraMaterials[itemKey],old=S.items[itemKey];
        S.items[itemKey]=old>=item.max?old:Math.min(item.max,old+e.heartAmount);
        rewardHtml+=`<div style="font-size:11px;color:#f0d060">${item.name} +${S.items[itemKey]-old}</div>`;
      }
      rewardHtml+=`<div style="font-size:10px;color:#aaa">${domain.soulRealm?'英魂遗境':domain.wildHunt?'郊野':materialKey==='godCrystal'?'遗迹':'神域'}警戒值 ${e.killValue} → ${e.nextKillValue}</div>`;
    }else{
      const meritGain=e.boss?15+(Math.floor(e.id/10)-1)*10:Math.ceil(e.id/2)+1;
      S.merit=(S.merit||0)+meritGain;
      rewardHtml+=`<div style="font-size:11px;color:#c0a060">⚔ 战功 +${meritGain}</div>`;
      for(const[r,v] of Object.entries(e.reward)){
        const gained=creditResourceReward(r,v);
        rewardHtml+=`<div style="font-size:11px;color:#f0d060">${pix(CFG.res[r].icon,'mini')} ${CFG.res[r].name} +${gained}</div>`;
      }
      if(!S.defeated.includes(e.id)&&e.firstClearReward){
        for(const[r,v] of Object.entries(e.firstClearReward)){
          const resCfg=CFG.res[r];
          if(!resCfg)continue;
          const gained=creditResourceReward(r,v);
          rewardHtml+=`<div style="font-size:11px;color:#f0d060">${pix(resCfg.icon,'mini')} ${e.firstClearRewardName||resCfg.name}（${resCfg.name}） +${gained}</div>`;
        }
      }
    }
    // 精魄掉落（Boss概率掉落）
    if(!special&&e.boss&&e.drops){
      for(const[ek,dc] of Object.entries(e.drops)){
        if(Math.random()<dc.prob){
          const cnt=dc.count||1;
          S.essence[ek]=(S.essence[ek]||0)+cnt;
          const ei=CFG.essences?.[ek];
          rewardHtml+=`<div style="font-size:11px;color:#b0a0d0">${pix(ei?.icon||ek,'mini')} ${ei?.name||ek} +${cnt}</div>`;
        }
      }
    }
    if(!special&&!S.defeated.includes(e.id)){S.defeated.push(e.id);}
    battleLog=`战胜${e.name}`;
    resEl.innerHTML=`
      <span class="result-text">${text}</span>
      ${lossTotal>0?`<div style="font-size:11px;color:#e06060;margin-top:4px">战损: ${lossTotal}人阵亡</div>`:''}
      <div style="margin-top:8px;padding:8px;background:#121224;border:1px solid #2b3144;border-radius:4px">
        <div style="font-size:10px;color:#888;margin-bottom:4px">战利品</div>
        ${rewardHtml}
      </div>
      <div class="result-btns" style="margin-top:10px">
        ${!special&&S.selEnemy+1<CFG.enemies.length?`<button class="btn btn-go btn-sm" onclick="nextBattle()">下一关</button>`:''}
        ${domain?.soulRealm?'':`<button class="btn btn-go btn-sm" onclick="retryBattle()">重新对战</button>`}
        <button class="btn btn-ghost btn-sm" onclick="exitBattle()">退出</button>
      </div>`;
  }else if(result==='lose'){
    cls='lose';text=`${pix('lose','sm')} 战败`;
    battleLog=`败于${B.enemyCfg?.name||CFG.enemies[S.selEnemy]?.name||'敌军'}`;
    resEl.innerHTML=`
      <span class="result-text">${text}</span>
      <div class="result-btns">
        <button class="btn btn-go btn-sm" onclick="retryBattle()">重新对战</button>
        <button class="btn btn-ghost btn-sm" onclick="exitBattle()">退出</button>
      </div>`;
  }else{
    cls='lose';text=`${pix('timer','sm')} 超时`;
    resEl.innerHTML=`
      <span class="result-text">${text}</span>
      <div class="result-btns">
        <button class="btn btn-go btn-sm" onclick="retryBattle()">重新对战</button>
        <button class="btn btn-ghost btn-sm" onclick="exitBattle()">退出</button>
      </div>`;
  }
  if(battleLog)addLog(battleLog);
  const written=save();
  if(!written.ok){
    S.formation=before.formation;S.res=before.res;S.items=before.items;S.killValues=before.killValues;S.soulRealmTeam=before.soulRealmTeam;S.awakening=before.awakening;S.development=before.development;S.merit=before.merit;S.essence=before.essence;S.defeated=before.defeated;S.log=before.log;
    resEl.innerHTML='<span class="result-text">保存失败，本场结算未生效；请导出可恢复存档后重试。</span>';
    resEl.className='lose';resEl.style.display='flex';updateUI();
    return;
  }
  S._awakeningTrial=null;
  resEl.className=cls;
  resEl.style.display='flex';
  updateUI();
}

function nextBattle(){
  if(S.battleEncounter!==null)return;
  S.selEnemy++;
  const last=S._lastForm;
  if(last&&(last.front.length+last.mid.length+last.back.length>0)){
    for(const row of['front','mid','back']){
      for(const u of S.formation[row]){S.pool[u.type]=(S.pool[u.type]||0)+u.count;}
    }
    const newForm={front:[],mid:[],back:[]};
    let shortage=false;
    for(const row of['front','mid','back']){
      for(const u of last[row]){
        if(newForm[row].length>=rowSlots(row)){shortage=true;break;}
        const avail=poolAvail(u.type);
        if(avail<=0){shortage=true;continue;}
        const count=Math.min(u.count,avail,regMax());
        if(count<u.count)shortage=true;
        S.pool[u.type]-=count;
        newForm[row].push({type:u.type,count,id:nextFormationId()});
      }
    }
    S.formation=newForm;
    if(shortage)toast('余量不足，已按可用人数填充');
  }
  exitBattle();
  queueBattleRestart();
}

function retryBattle(){
  const saveIdx=S.selEnemy; // 保存当前关卡，防止 exitBattle 自动跳关
  const encounterKey=S.battleEncounter;
  const soulSlot=encounterKey==='soulStone'?B.soulSlot:null;
  const trialMode=encounterKey==='awakeningTrial'?B.trialMode:null;
  exitBattle();
  S.selEnemy=saveIdx;
  if(trialMode){const result=openAwakeningTrial(trialMode);if(!result.ok)toast('无法重新试炼：'+result.reason);return}
  queueBattleRestart(encounterKey,soulSlot);
}

function exitBattle(){
  cancelBattleRestart();
  closeBattleVisual();
  const cur=S.battleEncounter===null?CFG.enemies[S.selEnemy]:null;
  if(cur&&S.defeated.includes(cur.id))S.selEnemy=Math.min(S.selEnemy+1,CFG.enemies.length-1);
  S.battleEncounter=null;
  S._awakeningTrial=null;
  document.getElementById('battle-result').style.display='none';
  document.getElementById('battle-screen').classList.remove('active');
  document.getElementById('navbar').classList.remove('paused');
  document.getElementById('topbar').classList.remove('paused');
  document.getElementById('main').classList.remove('paused');
  updateUI();
}

// 速度按钮
document.getElementById('battle-speed').addEventListener('click',e=>{
  if(e.target.classList.contains('btn-speed')){
    document.querySelectorAll('#battle-speed .btn-speed').forEach(b=>b.classList.remove('on'));
    e.target.classList.add('on');
    S.battleSpeed=parseInt(e.target.dataset.spd);
  }
});

document.getElementById('battle-log-toggle').addEventListener('click',toggleBattleLog);
