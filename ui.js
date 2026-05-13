// ==================== UI 渲染 ====================
function updateUI(){
  if(S.battleActive)return;
  const cap=storageCapacity();
  const wood=Math.floor(S.res.wood),stone=Math.floor(S.res.stone),food=Math.floor(S.res.food);
  document.getElementById('res-wood').textContent=wood;
  document.getElementById('res-stone').textContent=stone;
  document.getElementById('res-food').textContent=food;
  document.getElementById('res-tech').textContent=Math.floor(S.res.tech||0);
  document.getElementById('res-pop').textContent=popAllocTotal()+'/'+maxPop();
  document.getElementById('cap-wood').textContent='/'+cap;
  document.getElementById('cap-stone').textContent='/'+cap;
  const netFood=prodRate('food')-totalUpkeep()-popAllocTotal()*0.1;
  const capFoodEl=document.getElementById('cap-food');
  capFoodEl.textContent=(netFood>=0?'+':'')+netFood.toFixed(1)+'/秒';
  capFoodEl.style.color=netFood<0?'#e06060':'';
  document.getElementById('cap-pop').textContent='';
  const woodFull=wood>=cap,stoneFull=stone>=cap,foodFull=food>=cap||(food<=0&&netFood<0);
  document.getElementById('res-wood').style.color=woodFull?'#e06060':'#f0d060';
  document.getElementById('res-stone').style.color=stoneFull?'#e06060':'#f0d060';
  document.getElementById('res-food').style.color=foodFull?'#e06060':'#f0d060';
  const ts=document.getElementById('town-scene');
  if(S.page==='home'){
    ts.style.display='block';
    updateTownScene();
  }else{
    ts.style.display='none';
  }
  renderPage(S.page);
}
function renderPage(p){
  const main=document.getElementById('main');
  const el=document.activeElement;
  if(el&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.tagName==='SELECT')&&main.contains(el))return;
  main.innerHTML={home:rHome,build:rBuild,barracks:rBarracks,fight:rFight,tech:rTech,log:rLog}[p]();
}
// ==================== 主页渲染 ====================
function rHome(){
  const tc=townCfg();
  const canUp=townCanUpgrade(), upNeed=townUpgradeNeed();
  const tu=S.townUpgrade;
  let h=`<div style="padding:4px 0">`;

  h+=`<div class="card"><h3>${pix("home","card-pix")}${tc.name} <span style="color:#f0d060;font-size:12px">Lv.${tc.lv}</span></h3>`;
  h+=`<div style="font-size:12px;color:#999">人口 ${popAllocTotal()}/${maxPop()} | 空闲 ${popFree()} | 仓库 ${storageCapacity()}</div>`;
  if(tu){
    const pct=Math.floor((1-tu.timer/tu.timerEnd)*100);
    h+=`<div style="margin-top:4px"><span style="color:#f0d060;font-size:11px">城镇升级中...</span> <span style="color:#888;font-size:10px">${tu.timer}秒</span></div>`;
    h+=`<div class="prog-wrap"><div class="prog-fill" style="width:${pct}%"></div></div>`;
  } else {
    h+=`<div style="font-size:11px;color:#666">击败Boss ${bossDefeatedCount()}/${upNeed}`;
    if(canUp)h+=` <span style="color:#40bf80">可升级 → ${(CFG.town.find(t=>t.lv===S.townLv+1)||{}).name||"?"} (人口${(CFG.town.find(t=>t.lv===S.townLv+1)||{}).maxPop||"?"})</span>`;
    h+=`</div>`;
    if(canUp)h+=`<button class="btn btn-go btn-sm" onclick="upgradeTown()" style="margin-top:4px">${pix("upgrade","mini")}升级城镇</button>`;
  }
  h+=`</div>`;

  h+=`<div class="card"><h3>${pix("pop","card-pix")}人口分配</h3>`;
  for(const[k,c] of Object.entries(CFG.res)){if(c.basePerPop===0)continue;
    const buf=buildingBuff(k);
    const rate=prodRate(k);
    const alloc=S.popAlloc[k]||0;
    h+=`<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px">`;
    h+=`<span style="width:60px">${pix(c.icon,"sm")} ${c.name}</span>`;
    h+=`<button class="btn btn-ghost btn-xs" onclick="setPopAlloc('${k}',(S.popAlloc['${k}']||0)-1)" ${alloc<=0?"disabled":""}>−</button>`;
    h+=`<input type="text" inputmode="numeric" pattern="[0-9]*" value="${alloc}" onchange="setPopAlloc('${k}',parseInt(this.value)||0)" style="width:42px;text-align:center;font-weight:bold;color:#f0d060;background:#080912;border:2px solid #3a4158;font-family:inherit;font-size:12px">`;
    h+=`<button class="btn btn-ghost btn-xs" onclick="setPopAlloc('${k}',(S.popAlloc['${k}']||0)+1)" ${popFree()<=0?"disabled":""}>+</button>`;
    const rawRate=k==='food'?rate-totalUpkeep()-popAllocTotal()*0.1:rate;
    h+=`<span style="color:${rawRate>=0?'#40bf80':'#e06060'};margin-left:auto">${rawRate>=0?'+':''}${rawRate.toFixed(1)}/秒</span>`;
    h+=`<span style="font-size:10px;color:#666">Buff ${buf>0?"+":""}${(buf*100).toFixed(0)}%${k==='food'?' | 口粮 -'+(totalUpkeep()+popAllocTotal()*0.1).toFixed(1):''}</span>`;
    h+=`</div>`;
  }
  h+=`</div>`;

  h+=`<div class="card"><h3>${pix("log","card-pix")}最近事件</h3><div style="line-height:18px;height:108px;overflow:hidden">`;
  const r=[...S.log].reverse().slice(0,6);
  if(!r.length)h+=`<div style="font-size:11px;color:#666">暂无</div>`;
  else for(const e of r)h+=`<div style="font-size:10px;color:#555">[${e.time}] ${e.msg}</div>`;
  h+=`</div></div>`;
  h+=`<div style="text-align:center;margin-bottom:8px"><button class="btn btn-ghost btn-sm" onclick="openSettings()">${pix('build','mini')}设置</button></div>`;
  if(S._testUnlocked){
    h+=`<div class="card"><h3>${pix('build','card-pix')}测试工具</h3>
      <div class="train-custom" style="margin:4px 0"><span style="width:100px">木/石/食/科技</span><input id="test-all" type="text" inputmode="numeric" pattern="[0-9]*" value="10000" style="width:100px"><button class="btn btn-go btn-xs" onclick="addAllRes('test-all')">一键添加</button></div>
    </div>`;
  }
  h+=`</div>`;return h;
}
// ==================== 城镇巡防地图 ====================
function renderTownMapOverview(){
  const tc=townCfg();
  const woodWorkers=S.popAlloc.wood||0;
  const stoneWorkers=S.popAlloc.stone||0;
  const foodWorkers=S.popAlloc.food||0;
  const garrisonOnly=uk=>{
    let n=0;
    const gf=S._garrisonForm||{front:[],mid:[],back:[]};
    for(const row of['front','mid','back']){
      for(const u of gf[row]){if(u.type===uk)n+=u.count;}
    }
    return n;
  };
  const guardCounts={};
  for(const k of Object.keys(CFG.units)){
    const bu=typeof baseUnitType==='function'?baseUnitType(k):k;
    guardCounts[bu]=(guardCounts[bu]||0)+garrisonOnly(k);
  }
  const hasAny=Object.values(guardCounts).some(n=>n>0);
  const status=typeof garrisonStatusText==='function'?garrisonStatusText(hasAny):(hasAny?'巡逻中':'无');
  const townMapClass=typeof garrisonTownMapClass==='function'?garrisonTownMapClass():'';
  const garrisonLayers=typeof renderGarrisonTownLayers==='function'?renderGarrisonTownLayers():'';
  const troopSummary=hasAny
    ?Object.entries(CFG.units).filter(([k])=>garrisonOnly(k)>0).map(([k,c])=>`${c.name}${garrisonOnly(k)}`).join('｜')
    :'无';

  return `<div class="card town-map-card">
    <div class="town-map-head">
      <h3>🏰 城镇巡防</h3>
      <span class="town-map-status">${status}</span>
    </div>
    <div class="town-map ${townMapClass}" aria-label="城镇巡防地图">
      <div class="town-map-zone town-resource-zone" aria-hidden="true"></div>
      <div class="town-map-zone town-defense-zone" aria-hidden="true"></div>
      <div class="town-map-zone town-frontier-zone" aria-hidden="true"></div>
      <div class="town-road town-road-main"></div>
      <div class="town-road town-road-branch"></div>
      <div class="town-palisade" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="town-gate" aria-hidden="true"></div>
      <div class="town-woods" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="town-stones" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      ${garrisonLayers}

      ${workerDots('wood',woodWorkers,'wood')}
      ${workerDots('stone',stoneWorkers,'stone')}
      ${workerDots('food',foodWorkers,'food')}
      ${renderTownGuards(guardCounts)}
      <div class="town-building town-hall">
        <span class="town-building-sprite">${mapPix('town_hall','town-building-pix')}</span>
        <span class="town-map-badge town-level-badge">Lv.${tc.lv}</span>
      </div>
      <div class="town-building town-lumber">
        <span class="town-building-sprite">${mapPix('lumber_yard','town-building-pix')}</span>
        <span class="town-map-badge">${woodWorkers>0?`木 ${woodWorkers}`:'空闲'}</span>
      </div>
      <div class="town-building town-quarry">
        <span class="town-building-sprite">${mapPix('quarry_yard','town-building-pix')}</span>
        <span class="town-map-badge">${stoneWorkers>0?`石 ${stoneWorkers}`:'空闲'}</span>
      </div>
      <div class="town-building town-farm">
        <span class="town-building-sprite">${mapPix('farm_yard','town-building-pix')}</span>
        <span class="town-map-badge">${foodWorkers>0?`粮 ${foodWorkers}`:'空闲'}</span>
      </div>
      <div class="town-building town-tower">
        <span class="town-building-sprite">${mapPix('watch_tower','town-building-pix')}</span>
      </div>
      ${S.buildings.arrow_tower&&S.buildings.arrow_tower.lv>0?`
      <div class="town-building town-arrow-tower">
        <span class="town-building-sprite">${mapPix('arrow_tower','town-building-pix')}</span>
        <span class="town-map-badge">Lv.${S.buildings.arrow_tower.lv}</span>
      </div>`:''}
    </div>
    <div class="town-troop-summary">驻军：${troopSummary}</div>
  </div>`;
}
function workerDots(resourceKey,assignedCount,type){
  if(assignedCount<=0)return '';
  const count=assignedCount>=16?3:assignedCount>=6?2:1;
  const workClass={wood:'worker-chop',stone:'worker-mine',food:'worker-harvest'}[type]||'worker-harvest';
  let h=`<div class="town-worker-group worker-${type}-group" aria-hidden="true">`;
  for(let i=0;i<count;i++){
    const alt=i%2?'worker-step':workClass;
    h+=`<span class="town-worker worker-${type} ${alt} worker-${resourceKey}-${i+1}"></span>`;
  }
  h+='</div>';
  return h;
}
function renderTownGuards(counts){
  const guards=[
    ['infantry','guard-infantry','guard-patrol'],
    ['archer','guard-archer','guard-watch'],
    ['cavalry','guard-cavalry','guard-ride'],
    ['spearman','guard-spearman','guard-stand'],
    ['mage','guard-mage','guard-pulse']
  ];
  return guards
    .filter(([type])=>(counts[type]||0)>0)
    .slice(0,5)
    .map(([type,cls,anim])=>`<span class="town-guard ${cls} ${anim}" data-unit="${type}" data-count="${counts[type]||0}" aria-hidden="true">${pix(type)}</span>`)
    .join('');
}
let _townHash='';
function townHasAnyGarrison(){
  const gf=S._garrisonForm||{front:[],mid:[],back:[]};
  for(const row of['front','mid','back']){
    for(const u of gf[row]||[]){
      if((u.count||0)>0)return true;
    }
  }
  return false;
}
function updateTownDynamicBits(){
  if(S.page!=='home')return;
  const hasAny=townHasAnyGarrison();
  const statusEl=document.querySelector?.('.town-map-status');
  if(statusEl&&typeof garrisonStatusText==='function')statusEl.textContent=garrisonStatusText(hasAny);

  const bannerEl=document.querySelector?.('.town-phase-banner');
  if(bannerEl&&typeof garrisonStatusText==='function'){
    const gs=S.garrison||{};
    const inv=typeof garrisonById==='function'?garrisonById(gs.templateId):null;
    bannerEl.textContent=`${garrisonStatusText(true)}${inv?` · ${inv.name}`:''}`;
  }

  const barEl=document.querySelector?.('.town-cooldown-bar i');
  if(barEl&&S.garrison&&S.garrison.phase==='cooldown'&&S.garrison.phaseUntil>S.garrison.phaseStarted){
    const g=S.garrison;
    const progress=Math.max(0,Math.min(100,Math.round((g.phaseUntil-S.tick)/(g.phaseUntil-g.phaseStarted)*100)));
    barEl.style.width=progress+'%';
  }
}
function updateTownScene(){
  const woodWorkers=S.popAlloc.wood||0;
  const stoneWorkers=S.popAlloc.stone||0;
  const foodWorkers=S.popAlloc.food||0;
  // 哈希包含驻军阵容结构，确保阵容变化时能刷新
  const gHash=JSON.stringify(S._garrisonForm||{});
  const gs=S.garrison||{};
  const invHash=[gs.phase,gs.templateId,gs.result&&gs.result.outcome,S.merit].join('|');
  const h=woodWorkers+','+stoneWorkers+','+foodWorkers+','+S.townLv+','+gHash+','+invHash;
  if(h===_townHash){updateTownDynamicBits();return;}
  _townHash=h;
  const html=renderTownMapOverview();
  document.getElementById('town-scene').innerHTML=html;
  updateTownDynamicBits();
}
// ==================== 建筑界面（含4个子标签） ====================
const BUILD_CATEGORIES = {
  basic: {name:'\u57fa\u7840\u5efa\u7b51',keys:['barracks','warehouse','lumber_mill','quarry','farm']},
  barracks: {name:'\u5175\u8425\u5efa\u7b51',keys:['infantry_camp','archer_range','stable','spear_crypt','mage_tower']},
  special: {name:'\u7279\u6b8a\u5efa\u7b51',keys:['arrow_tower']}
};

function rBuildCard(key, cfg){
  const st=bldSt(key),locked=cfg.needBoss&&bossDefeatedCount()<cfg.needBoss,upLock=st.lv>0?upgradeLockReason(key):'';
  // \u53f3\u4fa7\u5bf9\u9f50\u6807\u7b7e\uff1a\u8d44\u6e90Buff \u6216 \u89e3\u9501\u6761\u4ef6
  const buffLabel=cfg.buffRes&&st.state==='idle'&&st.lv>0?`<span style="font-size:12px;color:#40bf80">${pix(CFG.res[cfg.buffRes].icon,'sm')} ${CFG.res[cfg.buffRes].name} Buff: +${((st.lv*cfg.buffPerLv+cfg.buffBase)*100).toFixed(0)}%</span>`:'';
  const lockLabel=locked?`<span style="font-size:11px;color:#e06060">${pix('lock','mini')}\u9700\u51fb\u8d25\u7b2c${cfg.needBoss}\u4e2aBoss</span>`:'';
  const rightLabel=lockLabel||buffLabel;
  let h=`<div class="card" style="${locked||upLock?'opacity:.7':''}"><h3 style="display:flex;justify-content:space-between;align-items:center">`;
  h+=`<span>${pix(key,'card-pix')}${cfg.name}`;if(st.state==='idle'&&st.lv>0)h+=` <span style="color:#f0d060">Lv.${st.lv}</span>`;
  // \u8425\u5e10\u7279\u6b8a\uff1a\u663e\u793a\u51fa\u6218\u4e0a\u9650
  if(key==='barracks')h+=` <span style="font-size:11px;color:#888">(\u51fa\u6218\u4e0a\u9650${regMax()}\u4eba/\u683c\uff0c\u6bcf\u7ea7+5)</span>`;
  // \u4ed3\u5e93\u7279\u6b8a\uff1a\u663e\u793a\u5b58\u50a8\u4e0a\u9650
  if(key==='warehouse'&&st.state==='idle'&&st.lv>0)h+=` <span style="font-size:11px;color:#f0d060">\u5b58\u50a8\u4e0a\u9650 ${storageCapacity()}</span>`;
  h+=`</span>${rightLabel}</h3>`;
  // 兵营类建筑：显示训练兵种和训练上限
  if(cfg.trains){
    const u=CFG.units[cfg.trains],cap=unitCap(cfg.trains);
    const nextLv=st.lv+(st.lv===0?1:1);
    const nextCap=(cfg.unitCapBase||0) + nextLv * (cfg.unitCapPerLv||0);
    h+=`<div class="build-meta">\u8bad\u7ec3: ${pix(u.icon,'mini')}${u.name} | \u8bad\u7ec3\u4e0a\u9650 ${st.lv>0?cap:0}${st.lv>0?` \u2192 ${nextCap}`:` (\u5efa\u6210\u540e ${nextCap})`}</div>`;
  }
  if(upLock)h+=`<div class="build-meta limit-warn">${pix('lock','mini')}${upLock}</div>`;
  if(st.state==='idle'){
    if(st.lv===0){
      const c=cfg.build;
      h+=`<div style="font-size:11px;line-height:14px;color:#888">\u5efa\u9020: ${costHtml(c)} | ${c.time}\u79d2</div>`;
      h+=`<button class="btn btn-go btn-sm" onclick="buildAct('${key}')" ${locked?'disabled':''}>${pix('build','mini')}\u5efa\u9020</button>`;
    }else{
      const uc=upCost(key);
      h+=`<div style="font-size:10px;line-height:14px;color:#666">\u5347\u7ea7: ${costHtml(uc)} | ${uc.time}\u79d2</div>`;
      h+=`<button class="btn btn-go btn-sm" onclick="buildAct('${key}')" ${upLock?'disabled':''}>${pix('upgrade','mini')}\u5347\u7ea7\u2192Lv.${st.lv+1}</button>`;
      // \u519b\u4e8b\u5b66\u9662\u5df2\u79fb\u9664
    }
  }else{
    const pct=st.timerEnd>0?((st.timerEnd-st.timer)/st.timerEnd*100).toFixed(0):0;
    h+=`<div class="timer-text pulsing">${pix('timer','mini')} ${st.state==='building'?'\u5efa\u9020':'\u5347\u7ea7'}\u4e2d... ${st.timer}\u79d2</div>`;
    h+=`<div class="prog-wrap"><div class="prog-fill" style="width:${pct}%"></div></div>`;
  }
  h+=`</div>`;
  return h;
}

function rBuild(){
  const tab=S._buildTab||'basic';
  const tabs=[{k:'basic',n:'\u57fa\u7840\u5efa\u7b51'},{k:'barracks',n:'\u5175\u8425\u5efa\u7b51'},{k:'special',n:'\u7279\u6b8a\u5efa\u7b51'}];
  let h=`<div style="display:flex;gap:4px;margin-bottom:6px">`;
  for(const t of tabs){
    h+=`<button class="btn btn-sm ${tab===t.k?'btn-go':'btn-ghost'}" style="flex:1" onclick="setBuildTab('${t.k}')">${t.n}</button>`;
  }
  h+=`</div>`;
  const cat=BUILD_CATEGORIES[tab];
  if(!cat||!cat.keys.length){
    h+=`<div style="text-align:center;color:#666;padding:30px">\u6682\u65e0\u5efa\u7b51</div>`;
  }else{
    for(const key of cat.keys){
      const cfg=CFG.buildings[key];
      if(cfg)h+=rBuildCard(key,cfg);
    }
  }
  return h;
}
// ==================== \u519b\u8425\u754c\u9762 ====================
function rBarracks(){
  const tier=S._barracksTier||'t0';
  let h=`<div style="padding:4px 0"><div style="font-size:12px;color:#888;margin:4px 0">总兵力 ${totalSoldiers()} | 营帐上限 ${regMax()}人/团 <span style="margin-left:10px;color:#e06060">口粮：-${totalUpkeep().toFixed(1)}/秒</span></div>`;
  const tierLabels={t0:'T0 基础',t1:'T1 进阶',t2:'T2 精锐',t3:'T3 终极'};
  h+=`<div style="display:flex;gap:4px;margin-bottom:6px">`;
  for(const[tk,tn] of Object.entries(tierLabels)){
    h+=`<button class="btn btn-sm ${tier===tk?'btn-go':'btn-ghost'}" style="flex:1" onclick="setBarracksTier('${tk}')">${tn}</button>`;
  }
  h+=`</div>`;
  const tierNum={t0:0,t1:1,t2:2,t3:3}[tier];
  const branchNames={infantry:'步兵线',archer:'猎人线',cavalry:'骑兵线',spearman:'枪兵线',mage:'法师线'};
  // 收集当前tier的单位，按分支分组
  const branches={};
  for(const[k,c] of Object.entries(CFG.units)){
    if(tier==='t0' && c.locked && c.baseUnit && c.baseUnit!==k) continue;
    const ut=typeof c.tier==='number'?c.tier:0;
    if(tier==='t0' && ut!==0) continue;
    if(tier!=='t0' && ut!==tierNum) continue;
    if(tier!=='t0' && c.baseUnit!=='infantry' && c.baseUnit!=='archer') continue;
    const bu=c.baseUnit||k;
    if(!branches[bu])branches[bu]=[];
    branches[bu].push([k,c]);
  }
  let shown=0;
  function renderUnitCard(k,c){
    const ow=S.pool[k]||0,lock=trainLockReason(k);
    const tm=maxTrainable(k),disabled=tm<=0?'disabled':'',muted=lock?'opacity:.55':'';
    const isLockedVar=tier!=='t0' && c.locked && !(S.upgradedUnits||{})[k];
    let researchInfo=null;
    if(isLockedVar){
      const tree=CFG.unitUpgrades[baseUnitType(k)]?.tree;
      if(tree){for(const[,node] of Object.entries(tree)){for(const br of node.branches||[]){if(br.to===k){researchInfo=br;break;}}if(researchInfo)break;}}
    }
    const isVariant=tier!=='t0'&&(c.tier||0)>0;
    let capInfo;
    if(isVariant){
      capInfo=`<span style="font-size:10px;color:#888">拥有: ${ow}人</span>`;
    }else{
      capInfo=reserveHtml(k);
    }
    let card=`<div class="card" style="${muted}">
      <div style="display:flex;align-items:center;gap:8px">
        <span>${pix(c.icon,'lg')}</span>
        <div style="flex:1;min-width:0"><strong style="cursor:pointer" onclick="openUnitDetail('${k}')">${c.name}</strong> <span style="font-size:10px;color:#aaa;margin-left:6px">${trainBuildingLabel(k)}</span> <span onclick="event.stopPropagation();openUnitDetail('${k}')" style="font-size:9px;padding:1px 5px;border:1px solid #3a4158;border-radius:0;color:#8890a6;cursor:pointer;display:inline-block;margin-left:6px">属性</span>
          <div style="font-size:10px;color:#777">${c.passive} | ATK:${c.atk} DEF:${c.def}${c.tag?` | [${c.tag}]`:''}</div>
          <div style="font-size:12px;color:#666;line-height:14px;display:flex;justify-content:space-between;align-items:center">
            <span>${costHtml(c.cost)}/人${(S.queue[k]||{}).reason?` <span class="limit-warn" style="margin-left:14px">${pix('lock','mini')}${S.queue[k].reason}</span>`:''}${lock?` <span class="limit-warn" style="margin-left:14px">${pix('lock','mini')}${lock}</span>`:''}</span>
            ${queueTotal(k)>0?`<span onclick="event.stopPropagation();cancelQueue('${k}')" style="font-size:10px;line-height:12px;padding:0 4px;border:1px solid #3a4158;color:#8890a6;cursor:pointer;margin-right:6px;flex-shrink:0">取消队列</span>`:''}
          </div>
          <div class="econ-note" style="line-height:16px">${capInfo}${queueTotal(k)>0?`<span style="margin-left:${isVariant?'24px':'4px'}">| 训练队列 ${queueTotal(k)}人</span>`:''}</div>
          ${isLockedVar?`<button class="btn btn-xs" onclick="upgradeUnit('${researchInfo?.from||''}','${k}')" style="font-size:9px;padding:1px 6px;background:#2a2a1a;border-color:#6a6a3a;color:#f0d060;border:1px solid">研究 ${costHtml(researchInfo?.cost||{})}</button>`
          :lock?'':`<div class="train-custom">
            <input id="train-barracks-${k}" type="text" inputmode="numeric" pattern="[0-9]*" value="${(S._trainQty||{})[k]||1}" oninput="(S._trainQty||{})['${k}']=parseInt(this.value)||1">
            <button class="btn btn-go btn-xs" onclick="trainCustom('${k}','train-barracks-${k}')" ${disabled}>训练</button>
            <button class="btn btn-ghost btn-xs" onclick="trainMax('${k}','train-barracks-${k}')" ${disabled}>MAX</button>
            <button class="btn btn-danger btn-xs" onclick="dismissN('${k}',(S._trainQty||{})['${k}']||1)" style="background:#4a2830;border-color:#6a4050;color:#d09090">删除</button>
          </div>`}
        </div>
      </div></div>`;
    return card;
  }
  const branchOrder=['infantry','archer','cavalry','spearman','mage'];
  if(tier==='t0'||tier==='t1'){
    // T0/T1: 平铺显示
    for(const bu of branchOrder){
      const list=branches[bu];
      if(!list)continue;
      for(const[k,c] of list){
        h+=renderUnitCard(k,c);
        shown++;
      }
    }
  }else{
    // T2/T3: 按分支收纳，带动效折叠
    if(!S._barracksFold)S._barracksFold={};
    for(const bu of branchOrder){
      const list=branches[bu];
      if(!list||!list.length)continue;
      const foldKey=bu+'_'+tier;
      const folded=S._barracksFold[foldKey]===true;
      const anyOwn=list.some(([k])=>(S.pool[k]||0)>0);
      const iconKey=bu==='infantry'?'infantry':bu==='archer'?'archer':bu;
      const tierNum={t2:2,t3:3}[tier]||2;
      // 收纳头
      const firstKey=list[0][0];
      const lineCap=unitCap(firstKey);
      const lineLeft=unitCapLeft(firstKey);
      h+=`<div class="branch-header" onclick="(S._barracksFold||{})['${foldKey}']=!((S._barracksFold||{})['${foldKey}']);updateUI()">
        <span class="branch-arrow${folded?'':' open'}">▶</span>
        <span class="branch-icon">${pix(iconKey,'md')}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:bold;color:#e0d070;letter-spacing:1px">${branchNames[bu]||bu}<span style="font-size:10px;color:#6a7290;font-weight:normal;margin-left:8px">T${tierNum}</span></div>
          <div style="font-size:12px;color:#5a6078;margin-top:2px">${list.length}种兵种  总上限 ${lineCap} </div>
        </div>
        ${anyOwn?`<span class="branch-badge-own">✓ 已拥有</span>`:''}
      </div>`;
      // 收纳体（带动画）
      h+=`<div class="branch-body${folded?' folded':' expanded'}">`;
      for(const[k,c] of list){
        h+=renderUnitCard(k,c);
        shown++;
      }
      h+=`</div>`;
    }
  }
  if(!shown)h+=`<div style="text-align:center;color:#666;padding:20px">暂无兵种 (需在科技树研究解锁)</div>`;
  h+=`</div>`;return h;
}
// ==================== 战斗界面 ====================
function rFight(){
  const tab=S._fightTab||'expedition';
  let h=`<div style="padding:4px 0">`;
  h+=`<div style="display:flex;gap:4px;margin-bottom:6px">`;
  h+=`<button class="btn btn-sm ${tab==='expedition'?'btn-go':'btn-ghost'}" style="flex:1" onclick="setFightTab('expedition')">${pix('battle','mini')}远征</button>`;
  h+=`<button class="btn btn-sm ${tab==='garrison'?'btn-go':'btn-ghost'}" style="flex:1" onclick="setFightTab('garrison')">${pix('army','mini')}驻军</button>`;
  h+=`</div>`;

  if(tab==='expedition'){
    const form=S.formation;
    const rowNames={front:'前排',mid:'中排',back:'后排'};
    const rowCls={front:'r1',mid:'r2',back:'r3'};
    h+=`<div class="card"><h3>${pix('battle','card-pix')}远征阵容</h3>`;
    for(const row of['front','mid','back']){
      const slots=rowSlots(row);
      h+=`<div class="form-row ${rowCls[row]||''}"><div class="ftitle">${rowNames[row]} (${(form[row]||[]).length}/${slots}格)</div>`;
      for(let i=0;i<slots;i++){
        const u=form[row]?.[i];
        if(u){
          const uc=CFG.units[u.type];
          h+=`<span class="form-slot filled" onclick="openFormModal('expedition','${row}',${i})">
            ${pix(uc.icon,'sm')}<span style="font-size:10px;color:#e0e0e0">${uc.name}</span>
            <span class="qty-ctrl" style="margin-top:2px" onclick="event.stopPropagation()">
              <button onpointerdown="startLongPress('expedition','${row}',${i},-1)" onpointerup="stopLongPress()" onpointerleave="stopLongPress()">-</button>
              <span>${u.count}</span>
              <button onpointerdown="startLongPress('expedition','${row}',${i},1)" onpointerup="stopLongPress()" onpointerleave="stopLongPress()">+</button>
            </span>
            <div style="display:flex;gap:3px;margin-top:2px" onclick="event.stopPropagation()">
              <button class="btn btn-xs btn-ghost" onclick="fillFormMax('expedition','${row}',${i})" style="font-size:9px">MAX</button>
              <button class="btn btn-xs btn-ghost" onclick="removeFormSlot('expedition','${row}',${i})" style="font-size:9px;color:#e06060">✕</button>
            </div>
          </span>`;
        } else {
          h+=`<span class="form-slot" onclick="openFormModal('expedition','${row}',${i})"><span class="form-empty">+ 编入</span></span>`;
        }
      }
      h+=`</div>`;
    }
    h+=`<div style="display:flex;gap:6px;margin-top:8px">`;
    h+=`<button class="btn btn-ghost btn-sm" onclick="useLastFormation('expedition')">${pix('check','mini')}使用上次阵容</button>`;
    h+=`<button class="btn btn-ghost btn-sm" onclick="clrForm('expedition')" style="color:#e06060">${pix('reset','mini')}清空阵容</button>`;
    h+=`</div>`;
    h+=`<div style="margin-top:6px"><button class="btn btn-ghost btn-sm" onclick="openTraining()">${pix('battle','mini')}训练场</button></div>`;
    h+=`</div>`;

    // 关卡选择
    h+=`<div class="card"><h3>${pix('battle','card-pix')}关卡选择</h3>`;
    const cur=S.selEnemy!==null?CFG.enemies[S.selEnemy]:null;
    const prevDisabled=S.selEnemy===null||S.selEnemy<=0;
    const nextDisabled=S.selEnemy===null||S.selEnemy>=CFG.enemies.length-1;
    h+=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">`;
    h+=`<button class="btn btn-ghost btn-sm" onclick="selEnemy(${Math.max(0,(S.selEnemy||0)-1)})" ${prevDisabled?'disabled':''}>◀</button>`;
    h+=`<div style="flex:1;text-align:center;font-size:12px;color:#e0e0e0">`;
    if(cur){
      h+=`${cur.name} <span style="color:#888;font-size:10px">(${S.selEnemy+1}/${CFG.enemies.length})</span>`;
      if(S.defeated.includes(cur.id))h+=` <span style="color:#40bf80;font-size:10px">✓已通关</span>`;
      if(cur.boss)h+=` <span style="color:#e06060;font-size:10px">[Boss]</span>`;
      h+=`<div style="font-size:10px;color:#888">${cur.desc||''}</div>`;
    } else {
      h+=`<span style="color:#666">未选择</span>`;
    }
    h+=`</div>`;
    h+=`<button class="btn btn-ghost btn-sm" onclick="selEnemy(${Math.min(CFG.enemies.length-1,(S.selEnemy||0)+1)})" ${nextDisabled?'disabled':''}>▶</button>`;
    h+=`</div>`;
    h+=`<button class="btn btn-go" style="width:100%" onclick="openBattle()" ${cur?'':'disabled'}>${pix('battle','mini')}开战</button>`;
    h+=`</div>`;
  } else {
    // 驻军
    const g=S.garrison||{};
    const form=S._garrisonForm||{front:[],mid:[],back:[]};
    const rowNames={front:'前排',mid:'中排',back:'后排'};
    const rowCls={front:'r1',mid:'r2',back:'r3'};
    h+=`<div class="card"><h3>${pix('army','card-pix')}驻军阵容</h3>`;
    for(const row of['front','mid','back']){
      const slots=rowSlots(row);
      h+=`<div class="form-row ${rowCls[row]||''}"><div class="ftitle">${rowNames[row]} (${(form[row]||[]).length}/${slots}格)</div>`;
      for(let i=0;i<slots;i++){
        const u=form[row]?.[i];
        if(u){
          const uc=CFG.units[u.type];
          h+=`<span class="form-slot filled" onclick="openFormModal('garrison','${row}',${i})">
            ${pix(uc.icon,'sm')}<span style="font-size:10px;color:#e0e0e0">${uc.name}</span>
            <span class="qty-ctrl" style="margin-top:2px" onclick="event.stopPropagation()">
              <button onpointerdown="startLongPress('garrison','${row}',${i},-1)" onpointerup="stopLongPress()" onpointerleave="stopLongPress()">-</button>
              <span>${u.count}</span>
              <button onpointerdown="startLongPress('garrison','${row}',${i},1)" onpointerup="stopLongPress()" onpointerleave="stopLongPress()">+</button>
            </span>
            <div style="display:flex;gap:3px;margin-top:2px" onclick="event.stopPropagation()">
              <button class="btn btn-xs btn-ghost" onclick="fillFormMax('garrison','${row}',${i})" style="font-size:9px">MAX</button>
              <button class="btn btn-xs btn-ghost" onclick="removeFormSlot('garrison','${row}',${i})" style="font-size:9px;color:#e06060">✕</button>
            </div>
          </span>`;
        } else {
          h+=`<span class="form-slot" onclick="openFormModal('garrison','${row}',${i})"><span class="form-empty">+ 编入</span></span>`;
        }
      }
      h+=`</div>`;
    }
    h+=`<div style="display:flex;gap:6px;margin-top:8px">`;
    h+=`<button class="btn btn-ghost btn-sm" onclick="useLastFormation('garrison')">${pix('check','mini')}使用上次阵容</button>`;
    h+=`<button class="btn btn-ghost btn-sm" onclick="clrForm('garrison')" style="color:#e06060">${pix('reset','mini')}清空驻军</button>`;
    h+=`</div>`;
    h+=`</div>`;

    // 驻军状态与操作
    h+=`<div class="card"><h3>${pix('army','card-pix')}驻军状态</h3>`;
    h+=`<div style="font-size:11px;color:#888;margin-bottom:4px">驻军功勋: <span style="color:#c0a060">${S.merit||0}</span> · 驻军人数: ${garrisonTotal()}</div>`;
    const gsText=typeof garrisonStatusText==='function'?garrisonStatusText(garrisonTotal()>0):'巡逻中';
    h+=`<div style="font-size:11px;color:#aaa;margin-bottom:8px">状态: ${gsText}</div>`;
    h+=`<button class="btn btn-ghost btn-sm" onclick="triggerGarrisonInvasion()">${pix('battle','mini')}测试触发入侵</button>`;
    h+=`</div>`;

    // 驻军日志
    h+=`<div class="card"><h3>${pix('log','card-pix')}最近驻军事件</h3>`;
    h+=`<div style="max-height:120px;overflow-y:auto;font-size:11px;line-height:1.8">`;
    const gl=[...(S.garrisonLog||[])].reverse().slice(0,6);
    if(!gl.length)h+=`<span style="color:#666">暂无驻军事件</span>`;
    else for(const e of gl)h+=`<span style="color:#555">[${e.time}]</span> ${e.msg}<br>`;
    h+=`</div></div>`;
  }

  h+=`</div>`;
  return h;
}
function rTech(){
  const boss=bossDefeatedCount();
  let h=`<div style="padding:4px 0">`;

  // 精魄库存卡片
  h+=`<div class="card"><h3>${pix('tech','card-pix')}精魄库存</h3>`;
  h+=`<div style="font-size:10px;color:#888;margin-bottom:6px">击败Boss概率掉落精魄，用于解锁T2/T3兵种</div>`;
  h+=`<div style="display:flex;flex-wrap:wrap;gap:2px;padding:4px 0">`;
  let hasEssence=false;
  for(const[ek,ei] of Object.entries(CFG.essences||{})){
    const cnt=S.essence[ek]||0;
    hasEssence=hasEssence||cnt>0;
    h+=`<span style="display:inline-flex;align-items:center;gap:3px;margin:2px 8px 2px 0;font-size:11px;color:#aab">
      ${pix(ei.icon||ek,'mini')} ${ei.name}: <span style="color:${cnt>0?'#f0d060':'#555'}">${cnt}</span></span>`;
  }
  if(!hasEssence)h+=`<span style="font-size:10px;color:#555">暂无精魄，击败Boss获取</span>`;
  h+=`</div>`;
  h+=`<div style="font-size:10px;color:#888;margin-top:4px">击败Boss: ${boss} | 科技点: <span style="color:#f0d060">${Math.floor(S.res.tech||0)}</span> | 战功: <span style="color:#c0a060">${S.merit||0}</span></div>`;
  h+=`</div>`;

  // 兵谱 — 总收纳
  if(!S._techFold)S._techFold={};
  const compFolded=S._techFold._compendium===true;
  const treeOrder=['infantry','archer'];
  const treeNames={infantry:'\u6b65\u5175\u7ebf',archer:'\u730e\u4eba\u7ebf'};

  h+=`<div class="branch-header" onclick="S._techFold._compendium=!S._techFold._compendium;updateUI()">
    <span class="branch-arrow${compFolded?'':' open'}">\u25b6</span>
    <span class="branch-icon">${pix('army','md')}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:bold;color:#e0d070;letter-spacing:1px">\u5175\u8c31</div>
      <div style="font-size:9px;color:#5a6078;margin-top:2px">\u70b9\u51fb${compFolded?'\u5c55\u5f00':'\u6298\u53e0'} \u00b7 ${treeOrder.length}\u4e2a\u5206\u652f</div>
    </div>
  </div>`;
  h+=`<div class="branch-body${compFolded?' folded':' expanded'}" style="margin-bottom:8px">`;

  for(const treeKey of treeOrder){
    const treeCfg=CFG.unitUpgrades[treeKey];
    if(!treeCfg||!treeCfg.tree)continue;
    const tree=treeCfg.tree;
    const rootKey=Object.keys(tree).find(k=>tree[k].tier===0)||Object.keys(tree)[0];
    const iconKey=treeCfg.icon||'infantry';
    const folded=S._techFold[treeKey]===true;

    h+=`<div class="branch-header" style="margin:4px 0;padding:8px 12px" onclick="S._techFold['${treeKey}']=!S._techFold['${treeKey}'];updateUI()">
      <span class="branch-arrow${folded?'':' open'}">\u25b6</span>
      <span class="branch-icon">${pix(iconKey,'sm')}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:bold;color:#c0c8e0;letter-spacing:1px">${treeNames[treeKey]||treeCfg.name}</div>
        <div style="font-size:9px;color:#5a6078;margin-top:2px">\u70b9\u51fb${folded?'\u5c55\u5f00':'\u6298\u53e0'}</div>
      </div>
    </div>`;
    h+=`<div class="branch-body${folded?' folded':' expanded'}" style="margin-bottom:4px">`;

    function renderOwnedNode(key,depth){
      const node=tree[key];
      if(!node)return'';
      const isRoot=key===rootKey;
      const isUpgraded=S.upgradedUnits[key]===true;
      if(!isRoot&&!isUpgraded)return'';
      const pad=depth*20;
      let r='';
      r+=`<div style="margin:4px 0;padding:6px 10px;background:#1a2a1a;border:1px solid #2b4b3b;border-radius:4px;font-size:11px;margin-left:${pad}px">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:9px;color:#888;min-width:28px">T${node.tier}</span>
          <span style="color:#40bf80">${pix(iconKey,'mini')}${node.name}</span>
          ${node.tag?`<span style="font-size:9px;color:#888">[${node.tag}]</span>`:''}
        </div>
      </div>`;
      if(isRoot||isUpgraded){
        for(const br of node.branches||[]){
          r+=renderOwnedNode(br.to, depth+1);
        }
      }
      return r;
    }

    h+=renderOwnedNode(rootKey,0);
    h+=`</div>`;
  }
  h+=`</div>`;
  h+=`</div>`;
  return h;
}
// ==================== 设置弹窗 ====================
function formatGameTime(ticks){
  const totalSec=Math.floor(ticks*(CFG.tickMs||1000)/1000);
  const h=Math.floor(totalSec/3600),m=Math.floor((totalSec%3600)/60);
  return `${h}时${String(m).padStart(2,'0')}分`;
}
function openSettings(){
  let h=`<h3>${pix('build','card-pix')}设置</h3>`;
  h+=`<div class="settings-time"><span class="label">游戏时间</span>${formatGameTime(S.tick||0)}</div>`;
  h+=`<div class="card"><h3>激活码</h3>
    <div class="train-custom" style="margin:4px 0">
      <input id="activation-code" type="text" value="" style="width:220px" placeholder="请输入激活码">
      <button class="btn btn-go btn-xs" onclick="checkActivationCode('activation-code')">确认</button>
    </div></div>`;
  h+=`<div class="card" style="text-align:center">
    <button class="btn btn-danger btn-sm" onclick="if(confirm('确定重置所有存档?')){localStorage.clear();location.reload()}">重置存档</button>
  </div>`;
  h+=`<button class="btn btn-ghost btn-sm" style="width:100%" onclick="closeSettings()">关闭</button>`;
  document.getElementById('settings-content').innerHTML=h;
  document.getElementById('settings-modal').classList.add('active');
}
function closeSettings(){
  document.getElementById('settings-modal').classList.remove('active');
}
document.getElementById('settings-modal').addEventListener('click',function(e){
  if(e.target===this) closeSettings();
});

// ==================== 日志界面 ====================
function rLog(){
  let h=`<div style="padding:4px 0"><div class="card"><h3>${pix('log','card-pix')}事件日志</h3><div style="max-height:500px;overflow-y:auto;font-size:11px;line-height:1.8">`;
  const l=[...S.log].reverse();
  if(!l.length)h+=`<div style="color:#666">暂无</div>`;
  else for(const e of l)h+=`<span style="color:#555">[${e.time}]</span> ${e.msg}<br>`;
  h+=`</div></div></div>`;return h;
}

// ==================== 工具函数（日志、Toast） ====================
function addLog(msg){S.log.push({time:new Date().toLocaleTimeString(),msg});if(S.log.length>200)S.log.splice(0,S.log.length-200)}
function toast(msg){const e=document.createElement('div');e.className='toast';e.textContent=msg;document.body.appendChild(e);setTimeout(()=>e.remove(),2000)}

// ==================== 长按加速 ====================
let _lpTimer=null,_lpWhich=null,_lpRow=null,_lpIdx=null,_lpDir=null;
function startLongPress(which,row,idx,dir){
  _lpWhich=which;_lpRow=row;_lpIdx=idx;_lpDir=dir;
  adjForm(which,row,idx,dir);
  _lpTimer=setTimeout(()=>{
    _lpTimer=setInterval(()=>{adjForm(which,row,idx,dir);},80);
  },400);
}
function stopLongPress(){
  if(_lpTimer){clearTimeout(_lpTimer);clearInterval(_lpTimer);_lpTimer=null;}
  _lpWhich=_lpRow=_lpIdx=_lpDir=null;
}

let _modalLpTimer=null;
function startModalLongPress(dir){
  adjQty(dir);
  stopModalLongPress();
  _modalLpTimer=setTimeout(()=>{
    _modalLpTimer=setInterval(()=>adjQty(dir),80);
  },400);
}
function stopModalLongPress(){
  if(_modalLpTimer){
    clearTimeout(_modalLpTimer);
    clearInterval(_modalLpTimer);
    _modalLpTimer=null;
  }
}

// ==================== 导航 ====================
document.querySelectorAll('.nav-btn').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');S.page=b.dataset.page;updateUI();
  });
});

// ==================== init ====================
injectPixelIcons();
load();
if(S.defeated.length<CFG.enemies.length&&S.selEnemy===null)S.selEnemy=S.defeated.length;
if(S.selEnemy===null)S.selEnemy=CFG.enemies.length-1;
updateUI();
setInterval(tick,CFG.tickMs);
addLog('欢迎！');
