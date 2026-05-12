// ==================== UI 渲染 ====================
function updateUI(){
  if(S.battleActive)return;
  const cap=storageCapacity();
  const wood=Math.floor(S.res.wood),stone=Math.floor(S.res.stone),food=Math.floor(S.res.food);
  document.getElementById('res-wood').textContent=wood;
  document.getElementById('res-stone').textContent=stone;
  document.getElementById('res-food').textContent=food;
  document.getElementById('res-pop').textContent=popAllocTotal()+'/'+maxPop();
  document.getElementById('cap-wood').textContent='/'+cap;
  document.getElementById('cap-stone').textContent='/'+cap;
  const netFood=prodRate('food')-totalUpkeep()-popAllocTotal()*0.1;
  document.getElementById('cap-food').textContent=(netFood>=0?'+':'')+netFood.toFixed(1)+'/秒';
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
  main.innerHTML={home:rHome,build:rBuild,barracks:rBarracks,fight:rFight,log:rLog}[p]();
}
// ==================== 主页渲染 ====================
function rHome(){
  const tc=townCfg();
  const canUp=townCanUpgrade(), upNeed=townUpgradeNeed();
  let h=`<div style="padding:4px 0">`;

  h+=`<div class="card"><h3>${pix("home","card-pix")}${tc.name} <span style="color:#f0d060;font-size:12px">Lv.${tc.lv}</span></h3>`;
  h+=`<div style="font-size:12px;color:#999">人口 ${popAllocTotal()}/${maxPop()} | 空闲 ${popFree()} | 仓库 ${storageCapacity()}</div>`;
  h+=`<div style="font-size:11px;color:#666">击败Boss ${bossDefeatedCount()}/${upNeed}`;
  if(canUp)h+=` <span style="color:#40bf80">可升级 → ${(CFG.town.find(t=>t.lv===S.townLv+1)||{}).name||"?"} (人口${(CFG.town.find(t=>t.lv===S.townLv+1)||{}).maxPop||"?"})</span>`;
  h+=`</div>`;
  if(canUp)h+=`<button class="btn btn-go btn-sm" onclick="upgradeTown()" style="margin-top:4px">${pix("upgrade","mini")}升级城镇</button>`;
  h+=`</div>`;

  h+=`<div class="card"><h3>${pix("pop","card-pix")}人口分配</h3>`;
  for(const[k,c] of Object.entries(CFG.res)){
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

  h+=`<div class="card"><h3>${pix("log","card-pix")}最近事件</h3>`;
  const r=[...S.log].reverse().slice(0,6);
  if(!r.length)h+=`<div style="font-size:11px;color:#666">暂无</div>`;
  else for(const e of r)h+=`<div style="font-size:10px;color:#555;padding:1px 0">[${e.time}] ${e.msg}</div>`;
  h+=`</div></div>`;return h;
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
  const guardCounts=Object.fromEntries(Object.keys(CFG.units).map(k=>[k,garrisonOnly(k)]));
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
  basic: {name:'\u57fa\u7840\u5efa\u7b51',keys:['warehouse','lumber_mill','quarry','farm']},
  barracks: {name:'\u5175\u8425\u5efa\u7b51',keys:['barracks','infantry_camp','archer_range','stable','spear_crypt','mage_tower']},
  special: {name:'\u7279\u6b8a\u5efa\u7b51',keys:[]},
  altar: {name:'\u82f1\u96c4\u796d\u575b',keys:[]}
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
  if(key==='barracks')h+=` <span style="font-size:11px;color:#888">(\u51fa\u6218\u4e0a\u9650${regMax()}\u4eba/\u683c${st.lv<=0?'\uff0c\u5efa\u9020\u540e100\u4eba/\u683c':''})</span>`;
  // \u4ed3\u5e93\u7279\u6b8a\uff1a\u663e\u793a\u5b58\u50a8\u4e0a\u9650
  if(key==='warehouse'&&st.state==='idle'&&st.lv>0)h+=` <span style="font-size:11px;color:#f0d060">\u5b58\u50a8\u4e0a\u9650 ${storageCapacity()}</span>`;
  h+=`</span>${rightLabel}</h3>`;
  // \u5175\u8425\u7c7b\u5efa\u7b51\uff1a\u663e\u793a\u8bad\u7ec3\u5175\u79cd\u548c\u8bad\u7ec3\u4e0a\u9650
  if(cfg.trains){
    const u=CFG.units[cfg.trains],cap=unitCap(cfg.trains);
    const nextLv=st.lv+(st.lv===0?1:1);
    const nextCap=(cfg.unitCapBase||0) + nextLv * (cfg.unitCapPerLv||0);
    h+=`<div class="build-meta">\u8bad\u7ec3: ${pix(u.icon,'mini')}${u.name} | \u8bad\u7ec3\u4e0a\u9650 ${st.lv>0?cap:0}${st.lv>0?` \u2192 ${nextCap}`:` (\u5efa\u6210\u540e ${nextCap})`}</div>`;
  }
  if(cfg.buffRes || cfg.storagePerLv){
    h+=`<div class="build-meta">${resourceCapText()} | \u51fb\u8d25Boss\u540e\u89e3\u9501\u4e0b\u4e00\u7ea7</div>`;
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
  const tabs=[{k:'basic',n:'\u57fa\u7840\u5efa\u7b51'},{k:'barracks',n:'\u5175\u8425\u5efa\u7b51'},{k:'special',n:'\u7279\u6b8a\u5efa\u7b51'},{k:'altar',n:'\u82f1\u96c4\u796d\u575b'}];
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
  let h=`<div style="padding:4px 0"><div style="font-size:12px;color:#888;margin:4px 0">\u603b\u5175\u529b ${totalSoldiers()} | \u8425\u5e10\u4e0a\u9650 ${regMax()}\u4eba/\u56e2</div>`;
  for(const[k,c] of Object.entries(CFG.units)){
    const ow=S.pool[k]||0,lock=trainLockReason(k);
    const tm=maxTrainable(k),disabled=tm<=0?'disabled':'',muted=lock?'opacity:.55':'';
    h+=`<div class="card" style="${muted}">
      <div style="display:flex;align-items:center;gap:8px">
        <span>${pix(c.icon,'lg')}</span>
        <div style="flex:1;min-width:0"><strong style="cursor:pointer" onclick="openUnitDetail('${k}')">${c.name}</strong> <span style="font-size:10px;color:#aaa;margin-left:6px">${trainBuildingLabel(k)}</span> <span onclick="event.stopPropagation();openUnitDetail('${k}')" style="font-size:9px;padding:1px 5px;border:1px solid #3a4158;border-radius:0;color:#8890a6;cursor:pointer;display:inline-block;margin-left:6px">属性</span>
          <div style="font-size:10px;color:#777">${c.passive} | ATK:${c.atk} DEF:${c.def}</div>
          <div style="font-size:12px;color:#666;line-height:14px">${costHtml(c.cost)}/\u4eba${(S.queue[k]||{}).reason?` <span class="limit-warn" style="margin-left:14px">${pix('lock','mini')}${S.queue[k].reason}</span>`:''}${lock?` <span class="limit-warn" style="margin-left:14px">${pix('lock','mini')}${lock}</span>`:''}</div>
          <div class="econ-note" style="line-height:16px">${reserveHtml(k)}${queueTotal(k)>0?` | 训练队列 ${queueTotal(k)}人 <span onclick="event.stopPropagation();cancelQueue('${k}')" style="font-size:10px;height:13px;line-height:12px;padding:0 4px;border:1px solid #3a4158;border-radius:0;color:#8890a6;cursor:pointer;display:inline-block;vertical-align:middle;margin-left:4px">取消队列</span>`:''}</div>
          ${lock?'':
          `<div class="train-custom">
            <input id="train-barracks-${k}" type="text" inputmode="numeric" pattern="[0-9]*" value="${(S._trainQty||{})[k]||1}" oninput="(S._trainQty||{})['${k}']=parseInt(this.value)||1">
            <button class="btn btn-go btn-xs" onclick="trainCustom('${k}','train-barracks-${k}')" ${disabled}>\u8bad\u7ec3</button>
            <button class="btn btn-ghost btn-xs" onclick="trainMax('${k}','train-barracks-${k}')" ${disabled}>MAX</button>
            <button class="btn btn-danger btn-xs" onclick="dismissN('${k}',(S._trainQty||{})['${k}']||1)" style="background:#4a2830;border-color:#6a4050;color:#d09090">\u5220\u9664</button>
          </div>`}
        </div>
      </div></div>`;
  }
  h+=`</div>`;return h;
}
// ==================== 战斗界面（含3个子标签） ====================
function rFight(){
  const tab=S._fightTab||'expedition';
  let h=`<div style="padding:4px 0">`;
  // 子标签切换
  h+=`<div style="display:flex;gap:4px;margin-bottom:8px">`;
  h+=`<button class="btn btn-sm ${tab==='expedition'?'btn-go':'btn-ghost'}" onclick="setFightTab('expedition')">远征</button>`;
  h+=`<button class="btn btn-sm ${tab==='garrison'?'btn-go':'btn-ghost'}" onclick="setFightTab('garrison')">驻军</button>`;
  h+=`<button class="btn btn-sm ${tab==='training'?'btn-go':'btn-ghost'}" onclick="setFightTab('training')">训练场</button>`;
  h+=`</div>`;
  if(tab==='expedition')h+=rExpedition();
  else if(tab==='garrison')h+=rGarrison();
  else if(tab==='training')h+=rTraining();
  h+=`</div>`;
  return h;
}
// --- 远征子标签 ---
function rExpedition(){
  let h=`<div class="card"><h3>${pix('army','card-pix')}远征阵容 (${formCnt()}/${formSlots()}团 | 上限${regMax()}人/团)</h3>`;
  // 显示可用余量
  const poolParts=[];
  for(const[k,c]of Object.entries(CFG.units)){
    const p=S.pool[k]||0;
    if(p>0)poolParts.push(`${pix(c.icon,'mini')}${c.name}${p}`);
  }
  h+=`<div style="font-size:10px;color:#888;margin-bottom:4px">余量: ${poolParts.length?poolParts.join(' '):'无'}</div>`;
  const rs=[{k:'front',n:'前排(承伤)',c:'r1'},{k:'mid',n:'中排(输出)',c:'r2'},{k:'back',n:'后排(远程)',c:'r3'}];
  const which='expedition';
  for(const r of rs){
    h+=`<div class="form-row ${r.c}"><div class="ftitle">${r.n} (${S.formation[r.k].length}/${rowSlots(r.k)})</div>`;
    if(!S.formation[r.k].length){
      h+=`<span class="form-slot" onclick="openFormModal('${which}','${r.k}',0)">+ 空位</span>`;
    }else{
      S.formation[r.k].forEach((u,i)=>{
        const mx=Math.min(regMax()-u.count, poolAvail(u.type));
        h+=`<span class="form-slot filled" style="position:relative">
          <span onclick="rmForm('${which}','${r.k}',${i})" style="position:absolute;top:-6px;right:-4px;cursor:pointer;z-index:1">${pix('close','mini')}</span>
          <div onclick="openFormModal('${which}','${r.k}',${i})">${pix(CFG.units[u.type].icon,'sm')}${CFG.units[u.type].name}</div>
          <div class="qty-ctrl" style="margin-top:3px;gap:2px;justify-content:center">
            <button onpointerdown="startLongPress('${which}','${r.k}',${i},-1)" onpointerup="stopLongPress()" onpointerleave="stopLongPress()" onpointercancel="stopLongPress()" style="width:24px;height:24px;border-radius:50%;border:1px solid #555;background:#1a1a2e;color:#e0e0e0;font-size:14px;cursor:pointer;touch-action:manipulation">−</button>
            <span style="min-width:24px;font-size:12px;color:#f0d060">${u.count}</span>
            <button onpointerdown="startLongPress('${which}','${r.k}',${i},1)" onpointerup="stopLongPress()" onpointerleave="stopLongPress()" onpointercancel="stopLongPress()" style="width:24px;height:24px;border-radius:50%;border:1px solid #555;background:#1a1a2e;color:#e0e0e0;font-size:14px;cursor:pointer;touch-action:manipulation">+</button>
          </div>
          <div style="margin-top:3px;display:flex;gap:3px;justify-content:center">
            ${mx>0?`<span onclick="event.stopPropagation();adjForm('${which}','${r.k}',${i},${mx})" style="font-size:9px;padding:2px 6px;border:1px solid #40bf80;background:#1a2e1a;color:#40bf80;cursor:pointer">MAX</span>`:''}
            <span onclick="event.stopPropagation();rmForm('${which}','${r.k}',${i})" style="font-size:9px;padding:2px 6px;border:1px solid #e06060;background:#2e1a1a;color:#e06060;cursor:pointer">移除</span>
          </div></span>`;
      });
      if(S.formation[r.k].length<rowSlots(r.k))h+=`<span class="form-slot" onclick="openFormModal('${which}','${r.k}',${S.formation[r.k].length})">+ 空位</span>`;
    }
    h+=`</div>`;
  }
  h+=`<button class="btn btn-go btn-sm" onclick="useLastFormation('expedition')">使用上次阵容</button>
  <button class="btn btn-ghost btn-sm" onclick="clrForm('expedition')">清空阵容</button></div>`;
  // 敌人选择
  const selIdx=S.selEnemy;
  const hasSel=selIdx!==null&&selIdx!==undefined;
  h+=`<div class="card"><h3>${pix('enemy','card-pix')}选择敌人</h3>`;
  h+=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">`;
  h+=`<button class="btn btn-ghost btn-xs" onclick="selEnemy(${hasSel?selIdx-1:'null'})" ${!hasSel||selIdx<=0?'disabled':''}>◀</button>`;
  h+=`<select onchange="this.blur();selEnemy(this.value===''?null:parseInt(this.value))" style="flex:1;background:#121224;color:#e0e0e0;border:1px solid #3a4158;padding:4px 8px;font-family:inherit;font-size:13px;cursor:pointer">`;
  h+=`<option value="" ${hasSel?'':'selected'}>-- 请选择关卡 --</option>`;
  for(let i=0;i<CFG.enemies.length;i++){
    const e=CFG.enemies[i],df=S.defeated.includes(e.id);
    const label=`${df?'✓ ':''}第${i+1}关 - ${e.name}${e.boss?' [BOSS]':''}`;
    h+=`<option value="${i}" ${hasSel&&i===selIdx?'selected':''}>${label}</option>`;
  }
  h+=`</select>`;
  h+=`<button class="btn btn-ghost btn-xs" onclick="selEnemy(${hasSel?selIdx+1:'null'})" ${!hasSel||selIdx>=CFG.enemies.length-1?'disabled':''}>▶</button>`;
  h+=`</div>`;
  // 显示选中敌人详情
  if(hasSel){
    const selE=CFG.enemies[selIdx];
    if(selE){
      const df=S.defeated.includes(selE.id);
      const enemyInfo=Object.entries(selE.units).map(([k,counts])=>{const t=counts.reduce((a,b)=>a+b,0);return `${pix(CFG.units[k].icon,'mini')}${CFG.units[k].name}×${t}`;}).join(' ');
      h+=`<div style="background:#121224;border:1px solid #2b3144;border-radius:4px;padding:8px 10px">`;
      h+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span><strong>${selE.name}</strong> ${df?pix('check','mini'):''} ${selE.boss?pix('boss','mini'):''}</span>${df?`<span style="font-size:11px;color:#40bf80">已通关</span>`:''}</div>`;
      h+=`<div style="font-size:11px;color:#888">${selE.desc}</div>`;
      h+=`<div style="font-size:10px;color:#777;margin-top:4px">${enemyInfo}</div>`;
      h+=`</div>`;
    }
  }else{
    h+=`<div style="text-align:center;color:#666;padding:10px">请从上拉菜单选择要出征的关卡</div>`;
  }
  h+=`</div><button class="btn btn-go" style="width:100%;margin-top:8px;padding:12px;font-size:15px" onclick="openBattle()">${pix('battle','sm')}开战</button>`;
  return h;
}
// --- 驻军子标签 ---
function rGarrison(){
  const gf=S._garrisonForm||{front:[],mid:[],back:[]};
  const cnt=gf.front.length+gf.mid.length+gf.back.length;
  const which='garrison';
  let h=`<div class="card"><h3>${pix('army','card-pix')}驻军阵容 (${cnt}/${formSlots()}团 | 上限${regMax()}人/团)</h3>`;
  h+=`<div style="font-size:10px;color:#888;margin-bottom:4px">自动触发：300 tick 新手保护后，每 180 tick 有 25% 概率入侵。驻军阵容会显示在主页城镇巡防地图上。</div>`;
  const rs=[{k:'front',n:'前排',c:'r1'},{k:'mid',n:'中排',c:'r2'},{k:'back',n:'后排',c:'r3'}];
  for(const r of rs){
    h+=`<div class="form-row ${r.c}"><div class="ftitle">${r.n} (${gf[r.k].length}/${rowSlots(r.k)})</div>`;
    if(!gf[r.k].length){
      h+=`<span class="form-slot" onclick="openFormModal('${which}','${r.k}',0)">+ 空位</span>`;
    }else{
      gf[r.k].forEach((u,i)=>{
        const mx=Math.min(regMax()-u.count, poolAvail(u.type));
        h+=`<span class="form-slot filled" style="position:relative">
          <span onclick="rmForm('${which}','${r.k}',${i})" style="position:absolute;top:-6px;right:-4px;cursor:pointer;z-index:1">${pix('close','mini')}</span>
          <div onclick="openFormModal('${which}','${r.k}',${i})">${pix(CFG.units[u.type].icon,'sm')}${CFG.units[u.type].name}</div>
          <div class="qty-ctrl" style="margin-top:3px;gap:2px;justify-content:center">
            <button onpointerdown="startLongPress('${which}','${r.k}',${i},-1)" onpointerup="stopLongPress()" onpointerleave="stopLongPress()" onpointercancel="stopLongPress()" style="width:24px;height:24px;border-radius:50%;border:1px solid #555;background:#1a1a2e;color:#e0e0e0;font-size:14px;cursor:pointer;touch-action:manipulation">−</button>
            <span style="min-width:24px;font-size:12px;color:#f0d060">${u.count}</span>
            <button onpointerdown="startLongPress('${which}','${r.k}',${i},1)" onpointerup="stopLongPress()" onpointerleave="stopLongPress()" onpointercancel="stopLongPress()" style="width:24px;height:24px;border-radius:50%;border:1px solid #555;background:#1a1a2e;color:#e0e0e0;font-size:14px;cursor:pointer;touch-action:manipulation">+</button>
          </div>
          <div style="margin-top:3px;display:flex;gap:3px;justify-content:center">
            ${mx>0?`<span onclick="event.stopPropagation();adjForm('${which}','${r.k}',${i},${mx})" style="font-size:9px;padding:2px 6px;border:1px solid #40bf80;background:#1a2e1a;color:#40bf80;cursor:pointer">MAX</span>`:''}
            <span onclick="event.stopPropagation();rmForm('${which}','${r.k}',${i})" style="font-size:9px;padding:2px 6px;border:1px solid #e06060;background:#2e1a1a;color:#e06060;cursor:pointer">移除</span>
          </div></span>`;
      });
      if(gf[r.k].length<rowSlots(r.k))h+=`<span class="form-slot" onclick="openFormModal('${which}','${r.k}',${gf[r.k].length})">+ 空位</span>`;
    }
    h+=`</div>`;
  }
  h+=`<button class="btn btn-ghost btn-sm" onclick="clrForm('garrison')">清空驻军</button>
  <button class="btn btn-go btn-sm" onclick="triggerGarrisonInvasion()" style="margin-left:4px">测试触发入侵</button>`;
  if(typeof ensureGarrisonState==='function')ensureGarrisonState();
  const gl=[...(S.garrisonLog||[])].reverse().slice(0,5);
  h+=`<div style="margin-top:8px;padding-top:7px;border-top:1px solid #2b3144">
    <div style="font-size:11px;color:#d6a83f;margin-bottom:4px">驻军功勋 ${S.merit||0} · 最近驻军事件</div>`;
  if(!gl.length)h+=`<div style="font-size:10px;color:#666">暂无驻军事件</div>`;
  else for(const e of gl)h+=`<div style="font-size:10px;color:#777;line-height:1.55">[${e.time}] ${e.msg}</div>`;
  h+=`</div></div>`;
  return h;
}
// --- 训练场子标签 ---
function rTraining(){
  let h=`<div class="card" style="border-color:#5a4a30;background:#12100a;margin-bottom:6px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div><strong>木人桩训练场</strong> <span style="font-size:10px;color:#888">3×3木人桩 各100HP</span></div>
      <button class="btn btn-go btn-sm" onclick="openTraining()">进入训练</button>
    </div>
  </div>`;
  h+=`<div style="font-size:11px;color:#666;padding:8px">使用远征阵容进行训练，测试伤害输出和兵种搭配。</div>`;
  return h;
}
// ==================== 日志界面 ====================
function rLog(){
  let h=`<div style="padding:4px 0"><div class="card"><h3>${pix('log','card-pix')}事件日志</h3><div style="max-height:500px;overflow-y:auto;font-size:11px;line-height:1.8">`;
  const l=[...S.log].reverse();
  if(!l.length)h+=`<div style="color:#666">暂无</div>`;
  else for(const e of l)h+=`<span style="color:#555">[${e.time}]</span> ${e.msg}<br>`;
  h+=`</div></div>`;
  if(!S._testUnlocked){
    h+=`<div class="card"><h3>激活码</h3>
      <div class="train-custom" style="margin:4px 0">
        <input id="activation-code" type="text" value="" style="width:100px" placeholder="请输入激活码">
        <button class="btn btn-go btn-xs" onclick="checkActivationCode('activation-code')">确认</button>
      </div></div>`;
  }
  if(S._testUnlocked){
    h+=`<div class="card"><h3>${pix('build','card-pix')}测试工具</h3>
      <div class="train-custom" style="margin:4px 0"><span style="width:40px">木材</span><input id="test-wood" type="text" inputmode="numeric" pattern="[0-9]*" value="5000" style="width:70px"><button class="btn btn-go btn-xs" onclick="addRes('wood','test-wood')">添加</button></div>
      <div class="train-custom" style="margin:4px 0"><span style="width:40px">石料</span><input id="test-stone" type="text" inputmode="numeric" pattern="[0-9]*" value="5000" style="width:70px"><button class="btn btn-go btn-xs" onclick="addRes('stone','test-stone')">添加</button></div>
      <div class="train-custom" style="margin:4px 0"><span style="width:40px">食物</span><input id="test-food" type="text" inputmode="numeric" pattern="[0-9]*" value="5000" style="width:70px"><button class="btn btn-go btn-xs" onclick="addRes('food','test-food')">添加</button></div>
    </div>`;
  }
  h+=`<button class="btn btn-danger btn-sm" onclick="if(confirm('重置?')){localStorage.clear();location.reload()}">${pix('reset','mini')}重置</button></div>`;
  return h;
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
