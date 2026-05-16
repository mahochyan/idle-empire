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
  const netFood=prodRate('food')-totalUpkeep()-popAllocTotal()*(CFG.popFoodCost||0.1);
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
  const canUp=townCanUpgrade(), bossId=townUpgradeNeedBossId();
  const tu=S.townUpgrade;
  const bossName=bossId?((CFG.enemies.find(e=>e.id===bossId)||{}).name||'?'):'';
  let h=`<div style="padding:4px 0">`;

  // 城镇 + 村民分配 合并卡片
  h+=`<div class="card">`;
  h+=`<h3 style="display:flex;justify-content:space-between;align-items:center">`;
  h+=`<span>${pix("home","card-pix")}${tc.name} <span style="color:#f0d060;font-size:12px">Lv.${tc.lv}</span></span>`;
  if(tu){
    const pct=Math.floor((1-tu.timer/tu.timerEnd)*100);
    h+=`<span style="font-size:10px;color:#f0d060">升级中 ${tu.timer}秒</span>`;
  } else if(canUp){
    h+=`<span style="font-size:10px;color:#40bf80">可升级 → ${(CFG.town.find(t=>t.lv===S.townLv+1)||{}).name||"?"} (${(CFG.town.find(t=>t.lv===S.townLv+1)||{}).maxPop||"?"}人)</span>`;
  } else {
    h+=`<span style="font-size:10px;color:#666">需击败第${bossId}关Boss「${bossName}」</span>`;
  }
  h+=`</h3>`;
  h+=`<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#999;margin-bottom:4px">`;
  h+=`<span>村民 ${popAllocTotal()}/${maxPop()} | 空闲 ${popFree()} | 仓库 ${storageCapacity()}</span>`;
  if(canUp&&!tu)h+=`<button class="btn btn-go btn-sm" onclick="upgradeTown()">${pix("upgrade","mini")}升级城镇</button>`;
  h+=`</div>`;
  if(tu){
    const pct=Math.floor((1-tu.timer/tu.timerEnd)*100);
    h+=`<div class="prog-wrap"><div class="prog-fill" style="width:${pct}%"></div></div>`;
  }
  h+=`<div style="border-top:1px solid #1e1e32;margin:8px 0 4px;padding-top:6px;font-size:10px;color:#666">${pix("pop","mini")}村民分配</div>`;
  for(const[k,c] of Object.entries(CFG.res)){if(c.basePerPop===0)continue;
    const buf=buildingBuff(k);
    const rate=prodRate(k);
    const alloc=S.popAlloc[k]||0;
    h+=`<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px">`;
    h+=`<span style="width:60px">${pix(c.icon,"sm")} ${c.name}</span>`;
    h+=`<button class="btn btn-ghost btn-xs" onclick="setPopAlloc('${k}',(S.popAlloc['${k}']||0)-1)" ${alloc<=0?"disabled":""}>−</button>`;
    h+=`<span style="width:36px;text-align:center;font-weight:bold;color:#f0d060;font-size:14px">${alloc}</span>`;
    h+=`<button class="btn btn-ghost btn-xs" onclick="setPopAlloc('${k}',(S.popAlloc['${k}']||0)+1)" ${popFree()<=0?"disabled":""}>+</button>`;
    if(k==='food')h+=`<span style="font-size:10px;color:#666;margin-left:auto">口粮 -${(totalUpkeep()+popAllocTotal()*(CFG.popFoodCost||0.1)).toFixed(1)}</span>`;
    const rawRate=k==='food'?rate-totalUpkeep()-popAllocTotal()*(CFG.popFoodCost||0.1):rate;
    h+=`<span style="font-size:10px;color:#666;margin-left:${k==='food'?'2px':'auto'}">Buff ${buf>0?"+":""}${(buf*100).toFixed(0)}%</span>`;
    h+=`<span style="color:${rawRate>=0?'#40bf80':'#e06060'};margin-left:2px">${rawRate>=0?'+':''}${rawRate.toFixed(1)}/秒</span>`;
    h+=`</div>`;
  }
  h+=`</div>`;

  h+=`<div class="card"><h3>${pix("log","card-pix")}最近事件</h3><div style="line-height:18px;height:90px;overflow:hidden">`;
  const r=[...S.log].reverse().slice(0,5);
  if(!r.length)h+=`<div style="font-size:11px;color:#666">暂无</div>`;
  else for(const e of r){
    const isG=e.msg.startsWith('[驻军]');
    const txt=isG?e.msg.replace('[驻军] ','').replace(/预警.*$/,'[防御预警]').replace(/【防御失败】.*$/,'[防御失败] 敌人来袭，城镇遭受损失').replace(/突破巡防.*$/,'[防御失败] 城镇遭受损失').replace(/被击退.*$/,'[防御成功]'):e.msg;
    h+=`<div style="font-size:10px;color:${isG?'#c0a060':'#555'}">[${e.time}] ${txt}</div>`;
  }
  h+=`</div></div>`;
  h+=`<div style="text-align:center;margin-bottom:8px"><button class="btn btn-ghost btn-sm" onclick="openSettings()">${pix('build','mini')}设置</button></div>`;
  if(S._testUnlocked){
    h+=`<div class="card"><h3>${pix('build','card-pix')}测试工具</h3>
      <div class="train-custom" style="margin:4px 0"><span style="width:100px">木/石/食/科技</span><input id="test-all" type="text" inputmode="numeric" pattern="[0-9]*" value="30000" style="width:100px"><button class="btn btn-go btn-xs" onclick="addAllRes('test-all')">一键添加</button></div>
      <div class="train-custom" style="margin:4px 0"><span style="width:100px">⚔ 战功</span><input id="test-merit" type="text" inputmode="numeric" pattern="[0-9]*" value="50" style="width:100px"><button class="btn btn-go btn-xs" onclick="addMerit('test-merit')">添加战功</button></div>
  <div class="train-custom" style="margin:4px 0"><span style="width:100px">💎 精魄</span><input id="test-essence" type="text" inputmode="numeric" pattern="[0-9]*" value="5" style="width:100px"><button class="btn btn-go btn-xs" onclick="addAllEssences('test-essence')">添加精魄</button></div>
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
  basic: {name:'基础建筑',keys:['barracks','warehouse','lumber_mill','quarry','farm']},
  barracks: {name:'兵营建筑',keys:['infantry_camp','archer_range','stable','spear_crypt','mage_tower']},
  special: {name:'特殊建筑',keys:['arrow_tower']}
};

function rBuildCard(key, cfg){
  const st=bldSt(key),locked=cfg.needBoss&&bossDefeatedCount()<cfg.needBoss,upLock=st.lv>0?upgradeLockReason(key):'';
  // 右侧对齐标签：资源Buff 或 解锁条件
  const buffLabel=cfg.buffRes&&st.state==='idle'&&st.lv>0?`<span style="font-size:12px;color:#40bf80">${pix(CFG.res[cfg.buffRes].icon,'sm')} ${CFG.res[cfg.buffRes].name} Buff: +${((st.lv*cfg.buffPerLv+cfg.buffBase)*100).toFixed(0)}%</span>`:'';
  const lockLabel=locked?`<span style="font-size:11px;color:#e06060">${pix('lock','mini')}需击败第${cfg.needBoss}个Boss</span>`:'';
  const rightLabel=lockLabel||buffLabel;
  let h=`<div class="card" style="${locked?'opacity:.7':''}"><h3 style="display:flex;justify-content:space-between;align-items:center">`;
  h+=`<span>${pix(key,'card-pix')}${cfg.name}`;if(st.state==='idle'&&st.lv>0)h+=` <span style="color:#f0d060">Lv.${st.lv}</span>`;if(cfg.trains){const tls=['T0基础','T1进阶','T2精锐','T3终极','T4传说'];h+=` <span style="font-size:10px;color:#f0d060">时代:${tls[st.tier??0]||'T'+(st.tier??0)}</span>`;if(st.state==='tier_upgrading')h+=` → <span style="color:#40bf80">${tls[(st.tier??0)+1]||'T'+((st.tier??0)+1)}</span>`;}
  // 营帐特殊：显示出战上限
  if(key==='barracks')h+=` <span style="font-size:11px;color:#888">(出战上限${regMax()}人/格，每级+5)</span>`;
  // 仓库特殊：显示存储上限
  if(key==='warehouse'&&st.state==='idle'&&st.lv>0)h+=` <span style="font-size:11px;color:#f0d060">存储上限 ${storageCapacity()}</span>`;
  h+=`</span>${rightLabel}</h3>`;
  // 兵营类建筑：显示训练兵种和训练上限
  const bldTier=st.tier??0;
  if(cfg.trains){
    const baseK=cfg.trains;
    const repU=CFG.units[baseK]||Object.values(CFG.units).find(u=>u.baseUnit===baseK);
    const u=repU||{icon:baseK,name:baseK};
    const cap=unitCap(baseK);
    const nextLv=st.lv+(st.lv===0?1:1);
    const nextCap=(cfg.unitCapBase||0) + nextLv * (cfg.unitCapPerLv||0);
    h+=`<div class="build-meta">训练: ${pix(u.icon,'mini')}${u.name} | 训练上限 ${st.lv>0?cap:0}${st.lv>0?` → ${nextCap}`:` (建成后 ${nextCap})`}</div>`;
  }
  if(st.state==='idle'){
    if(st.lv===0){
      const c=cfg.build;
      h+=`<div style="display:flex;justify-content:space-between;align-items:center">`;
      h+=`<span style="font-size:11px;color:#888">建造: ${costHtml(c)} | ${c.time}秒</span>`;
      h+=`<button class="btn btn-go btn-sm" style="width:80px;text-align:center" onclick="buildAct('${key}')" ${locked?'disabled':''}>建造</button>`;
      h+=`</div>`;
      if(upLock)h+=`<div class="build-meta limit-warn" style="margin-top:2px">${pix('lock','mini')}${upLock}</div>`;
    }else{
      const uc=upCost(key);
      h+=`<div style="display:flex;justify-content:space-between;align-items:center">`;
      h+=`<span style="font-size:10px;color:#666">升级: ${costHtml(uc)} | ${uc.time}秒</span>`;
      h+=`<button class="btn btn-go btn-sm" style="width:80px;text-align:center" onclick="buildAct('${key}')" ${upLock?'disabled':''}>升级→Lv.${st.lv+1}</button>`;
      h+=`</div>`;
      if(upLock)h+=`<div class="build-meta limit-warn" style="margin-top:2px">${pix('lock','mini')}${upLock}</div>`;
      // 时代进阶按钮
      if(cfg.tierUpgrade&&st.lv>0){
        const tuCost=tierUpgradeCost(key);
        const tuLock=tierUpgradeLockReason(key);
        if(tuCost){
          const nextTier=bldTier+1;
          h+=`<div style="margin-top:4px;display:flex;justify-content:space-between;align-items:center">`;
          h+=`<span style="font-size:10px;color:#888">进阶: ${costHtml(tuCost)} | ${tuCost.time}秒</span>`;
          h+=`<button class="btn btn-go btn-sm" style="width:80px;text-align:center" onclick="buildTierUpgradeAct('${key}')" ${tuLock?'disabled':''}>进阶→T${nextTier}</button>`;
          h+=`</div>`;
          if(tuLock)h+=`<div style="font-size:9px;color:#e06060;margin-top:2px">${tuLock}</div>`;
        }
      }
      // 军事学院已移除
    }
  }else{
    const pct=st.timerEnd>0?((st.timerEnd-st.timer)/st.timerEnd*100).toFixed(0):0;
    const stateLabels={building:'建造',upgrading:'升级',tier_upgrading:'时代升级'};
    h+=`<div class="timer-text pulsing">${pix('timer','mini')} ${stateLabels[st.state]||st.state}中... ${st.timer}秒</div>`;
    h+=`<div class="prog-wrap"><div class="prog-fill" style="width:${pct}%"></div></div>`;
  }
  h+=`</div>`;
  return h;
}

function rBuild(){
  const tab=S._buildTab||'basic';
  const tabs=[{k:'basic',n:'基础建筑'},{k:'barracks',n:'兵营建筑'},{k:'special',n:'特殊建筑'}];
  let h=`<div style="display:flex;gap:4px;margin-bottom:6px">`;
  for(const t of tabs){
    h+=`<button class="btn btn-sm ${tab===t.k?'btn-go':'btn-ghost'}" style="flex:1" onclick="setBuildTab('${t.k}')">${t.n}</button>`;
  }
  h+=`</div>`;
  const cat=BUILD_CATEGORIES[tab];
  if(!cat||!cat.keys.length){
    h+=`<div style="text-align:center;color:#666;padding:30px">暂无建筑</div>`;
  }else{
    for(const key of cat.keys){
      const cfg=CFG.buildings[key];
      if(cfg)h+=rBuildCard(key,cfg);
    }
  }
  return h;
}
// ==================== 军营界面 ====================
function rBarracks(){
  const tier=S._barracksTier||'t0';
  let h=`<div style="padding:4px 0"><div style="font-size:12px;color:#888;margin:4px 0">总兵力 ${totalSoldiers()} | 营帐上限 ${regMax()}人/团 <span style="margin-left:10px;color:#e06060">口粮消耗：-${totalUpkeep().toFixed(1)}/秒</span></div>`;
  const tierLabels={t0:'T0 基础',t1:'T1 进阶',t2:'T2 精锐',t3:'T3 终极',t4:'T4 传说'};
  h+=`<div style="display:flex;gap:4px;margin-bottom:6px">`;
  for(const[tk,tn] of Object.entries(tierLabels)){
    h+=`<button class="btn btn-sm ${tier===tk?'btn-go':'btn-ghost'}" style="flex:1" onclick="setBarracksTier('${tk}')">${tn}</button>`;
  }
  h+=`</div>`;
  const tierNum={t0:0,t1:1,t2:2,t3:3,t4:4}[tier];
  const branchNames={infantry:'步兵线',archer:'弓兵线',cavalry:'骑兵线',mage:'法师线'};
  // 收集当前tier的单位，按分支分组
  const branches={};
  for(const[k,c] of Object.entries(CFG.units)){
    if(tier==='t0' && c.locked && c.baseUnit) continue;
    const ut=typeof c.tier==='number'?c.tier:0;
    if(tier==='t0' && ut!==0) continue;
    if(tier!=='t0' && ut!==tierNum) continue;
    if(tier!=='t0' && c.baseUnit!=='infantry' && c.baseUnit!=='archer' && c.baseUnit!=='cavalry' && c.baseUnit!=='mage') continue;
    const bu=c.baseUnit||k;
    if(!branches[bu])branches[bu]=[];
    branches[bu].push([k,c]);
  }
  let shown=0;
  function renderUnitCard(k,c){
    const ow=(S.pool[k]||0)+expeditionCount(k)+garrisonCount(k),lock=trainLockReason(k);
    const tm=maxTrainable(k),disabled=tm<=0?'disabled':'',muted=lock?'opacity:.55':'';
    const isLockedUnit=c.locked && !(S.upgradedUnits||{})[k];
    let researchInfo=null,isRootUnlock=false;
    if(isLockedUnit){
      const tree=CFG.unitUpgrades[baseUnitType(k)]?.tree;
      if(tree){
        const rootNode=tree[k];
        if(rootNode&&rootNode.unlock){researchInfo=rootNode.unlock;isRootUnlock=true;}
        else{for(const[,node] of Object.entries(tree)){for(const br of node.branches||[]){if(br.to===k){researchInfo=br;break;}}if(researchInfo)break;}}
      }
    }
    const cap=unitCap(k);
    const isVariantLocked=!(S.upgradedUnits||{})[k]&&c.locked;
    let capInfo=isVariantLocked?'':`<span style="font-size:12px;margin-left:15px;color:#888">上限 ${cap} | 拥有 ${ow}</span>`;
    let card=`<div class="card" style="${muted}">
      <div style="display:flex;align-items:center;gap:8px">
        <span>${pix(c.icon,'lg')}</span>
        <div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px"><strong style="cursor:pointer" onclick="openUnitDetail('${k}')">${c.name}</strong> <span style="font-size:10px;color:#aaa">${trainBuildingLabel(k)}</span> <span onclick="event.stopPropagation();openUnitDetail('${k}')" style="font-size:9px;padding:1px 5px;border:1px solid #3a4158;border-radius:0;color:#8890a6;cursor:pointer;display:inline-block">属性</span>${!isLockedUnit&&unitCapLeft(k)<=0?`<span class="limit-warn" style="margin-left:auto;font-size:9px">${pix('lock','mini')}已达上限</span>`:''}</div>
          <div style="font-size:10px;color:#777">${c.passive} | ATK:${c.atk} DEF:${c.def}</div>
          <div style="font-size:12px;color:#666;line-height:14px;display:flex;justify-content:space-between;align-items:center">
            <span>${costHtml(c.cost)}/人${(S.queue[k]||{}).reason?` <span class="limit-warn" style="margin-left:14px">${pix('lock','mini')}${S.queue[k].reason}</span>`:''}${!isLockedUnit&&lock?` <span class="limit-warn" style="margin-left:14px">${pix('lock','mini')}${lock}</span>`:''}</span>
            ${queueTotal(k)>0?`<span style="display:inline-flex;align-items:center;gap:5px;margin-right:6px;flex-shrink:0"><span style="font-size:10px;color:#888">训练队列 ${queueTotal(k)}人</span><span onclick="event.stopPropagation();cancelQueue('${k}')" style="font-size:10px;line-height:12px;padding:0 4px;border:1px solid #3a4158;color:#8890a6;cursor:pointer">取消队列</span></span>`:''}
          </div>
          ${isLockedUnit?`<div style="font-size:10px;color:#e06060;margin:2px 0">${lock.replace(/ ?\(科技点[^)]*\)/,'')}</div>`:''}
          ${isLockedUnit||lock?'':`<div class="train-custom">
            <input id="train-barracks-${k}" type="text" inputmode="numeric" pattern="[0-9]*" value="${(S._trainQty||{})[k]||1}" oninput="(S._trainQty||{})['${k}']=parseInt(this.value)||1">
            <button class="btn btn-go btn-xs" onclick="trainCustom('${k}','train-barracks-${k}')" ${disabled}>训练</button>
            <button class="btn btn-ghost btn-xs" onclick="trainMax('${k}','train-barracks-${k}')" ${disabled}>MAX</button>
            <button class="btn btn-danger btn-xs" onclick="dismissN('${k}',(S._trainQty||{})['${k}']||1)" style="background:#4a2830;border-color:#6a4050;color:#d09090">删除</button>
            ${capInfo}
          </div>`}
        </div>
      </div></div>`;
    return card;
  }
  const branchOrder=['infantry','archer','cavalry','mage'];
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
      const tierNum={t2:2,t3:3,t4:4}[tier]||2;
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
    h+=`<button class="btn btn-ghost btn-sm" onclick="openTraining()">${pix('battle','mini')}训练场</button>`;
    h+=`</div>`;
    h+=`</div>`;

    // 关卡选择
    h+=`<div class="card"><h3>${pix('battle','card-pix')}关卡选择</h3>`;
    const cur=S.selEnemy!==null&&S.selEnemy!==undefined?CFG.enemies[S.selEnemy]:null;
    const hasSel=cur!==null;
    h+=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">`;
    h+=`<button class="btn btn-ghost btn-xs" onclick="selEnemy(${hasSel?(S.selEnemy-1):'null'})" ${!hasSel||S.selEnemy<=0?'disabled':''}>◀</button>`;
    h+=`<select onchange="this.blur();selEnemy(this.value===''?null:parseInt(this.value))" style="flex:1;background:#121224;color:#e0e0e0;border:1px solid #3a4158;padding:4px 8px;font-family:inherit;font-size:13px;cursor:pointer">`;
    h+=`<option value="" ${hasSel?'':'selected'}>-- 请选择关卡 --</option>`;
    for(let i=0;i<CFG.enemies.length;i++){
      const e=CFG.enemies[i],df=S.defeated.includes(e.id);
      h+=`<option value="${i}" ${hasSel&&i===S.selEnemy?'selected':''}>${df?'✓ ':''}第${i+1}关 - ${e.name}${e.boss?' [BOSS]':''}</option>`;
    }
    h+=`</select>`;
    h+=`<button class="btn btn-ghost btn-xs" onclick="selEnemy(${hasSel?(S.selEnemy+1):'null'})" ${!hasSel||S.selEnemy>=CFG.enemies.length-1?'disabled':''}>▶</button>`;
    h+=`</div>`;
    if(cur){
      const df=S.defeated.includes(cur.id);
      h+=`<div style="background:#121224;border:1px solid #2b3144;border-radius:4px;padding:8px 10px;margin-bottom:8px">`;
      h+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span><strong>${cur.name}</strong> ${df?pix('check','mini'):''} ${cur.boss?pix('boss','mini'):''}</span>${df?'<span style="font-size:11px;color:#40bf80">已通关</span>':''}</div>`;
      h+=`<div style="font-size:11px;color:#888">${cur.desc||''}</div>`;
      const enemyInfo=Object.entries(cur.units).map(([k,counts])=>{const t=counts.reduce((a,b)=>a+b,0);return `${pix(CFG.units[k].icon,'mini')}${CFG.units[k].name}×${t}`;}).join(' ');
      h+=`<div style="font-size:10px;color:#777;margin-top:4px">${enemyInfo}</div>`;
      h+=`</div>`;
    }
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
  const treeOrder=['infantry','archer','cavalry'];
  const treeNames={infantry:'步兵线',archer:'弓兵线',cavalry:'骑兵线'};

  h+=`<div class="branch-header" onclick="S._techFold._compendium=!S._techFold._compendium;updateUI()">
    <span class="branch-arrow${compFolded?'':' open'}">▶</span>
    <span class="branch-icon">${pix('army','md')}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:bold;color:#e0d070;letter-spacing:1px">兵谱</div>
      <div style="font-size:9px;color:#5a6078;margin-top:2px">点击${compFolded?'展开':'折叠'} · ${treeOrder.length}个分支</div>
    </div>
  </div>`;
  h+=`<div class="branch-body${compFolded?' folded':' expanded'}" style="margin-bottom:8px">`;

  function renderOwnedNode(tree,rootKey,iconKey,key,depth){
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
      </div>`;
    if(isRoot&&!isUpgraded&&node.unlock){
      const ul=node.unlock;
      const needTech=ul.needTech||0;
      const needMerit=ul.needMerit||0;
      const needEssence=ul.needEssence||null;
      const canAfford=(S.res.tech||0)>=needTech
        && (S.merit||0)>=needMerit
        && (!needEssence||(S.essence[needEssence.type]||0)>=needEssence.count)
        && S.res.wood>=ul.cost.wood&&S.res.stone>=ul.cost.stone&&S.res.food>=ul.cost.food;
      r+=`<div style="margin-top:5px">
        <button class="btn btn-xs" onclick="unlockUnitRoot('${key}')"
          style="font-size:10px;padding:2px 8px;background:${canAfford?'#2a2a1a':'#1a1a1a'};border-color:${canAfford?'#6a6a3a':'#333'};color:${canAfford?'#f0d060':'#666'};border:1px solid"
          ${canAfford?'':'disabled'}>🔬 研究解锁 ${techCostHtml(ul.cost,needTech,needMerit,needEssence)}</button>
      </div>`;
    }
    if((isRoot||isUpgraded)&&node.branches&&node.branches.length){
      r+=`<div style="margin-top:6px;padding-left:16px;border-left:2px solid #3a4158">`;
      for(const br of node.branches){
        const brUp=S.upgradedUnits[br.to]===true;
        if(brUp)continue;
        const needTech=br.needTech||0;
        const needMerit=br.needMerit||0;
        const needEssence=br.needEssence||null;
        const canAfford=(S.res.tech||0)>=needTech
          && (S.merit||0)>=needMerit
          && (!needEssence||(S.essence[needEssence.type]||0)>=needEssence.count)
          && S.res.wood>=br.cost.wood&&S.res.stone>=br.cost.stone&&S.res.food>=br.cost.food;
        r+=`<div style="margin:3px 0;font-size:10px;display:flex;align-items:center;gap:4px;flex-wrap:wrap">
          <span style="color:#888">→</span>
          <span style="color:#aaa">${pix(iconKey,'mini')}${br.name}</span>
          <button class="btn btn-xs" onclick="upgradeUnit('${key}','${br.to}')"
            style="font-size:9px;padding:1px 6px;background:${canAfford?'#2a2a1a':'#1a1a1a'};border-color:${canAfford?'#6a6a3a':'#333'};color:${canAfford?'#f0d060':'#666'};border:1px solid"
            ${canAfford?'':'disabled'}>研究 ${techCostHtml(br.cost,needTech,needMerit,needEssence)}</button>
        </div>`;
      }
      r+=`</div>`;
    }
    r+=`</div>`;
    if(isRoot||isUpgraded){
      for(const br of node.branches||[]){
        r+=renderOwnedNode(tree,rootKey,iconKey,br.to, depth+1);
      }
    }
    return r;
  }

  for(const treeKey of treeOrder){
    const treeCfg=CFG.unitUpgrades[treeKey];
    if(!treeCfg||!treeCfg.tree)continue;
    const tree=treeCfg.tree;
    const rootKey=Object.keys(tree).find(k=>tree[k].tier===0)||Object.keys(tree)[0];
    const iconKey=treeCfg.icon||'infantry';
    const folded=S._techFold[treeKey]===true;

    h+=`<div class="branch-header" style="margin:4px 0;padding:8px 12px" onclick="S._techFold['${treeKey}']=!S._techFold['${treeKey}'];updateUI()">
      <span class="branch-arrow${folded?'':' open'}">▶</span>
      <span class="branch-icon">${pix(iconKey,'sm')}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:bold;color:#c0c8e0;letter-spacing:1px">${treeNames[treeKey]||treeCfg.name}</div>
        <div style="font-size:9px;color:#5a6078;margin-top:2px">点击${folded?'展开':'折叠'}</div>
      </div>
    </div>`;
    h+=`<div class="branch-body${folded?' folded':' expanded'}" style="margin-bottom:4px">`;

    h+=renderOwnedNode(tree,rootKey,iconKey,rootKey,0);
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
