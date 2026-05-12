// ==================== Garrison invasion phase 1 ====================
// This file is intentionally independent, similar to levels.js.
// It owns invasion templates, phase state, headless auto-battle, rewards,
// penalties, logs, and town-map rendering helpers.

CFG.garrisonInvade = {
  protectTicks:300,
  checkEveryTicks:180,
  chance:0.25,
  emptyCooldownTicks:120,
  cooldownMinTicks:360,
  cooldownMaxTicks:480,
  warningTicks:3,
  spawnTicks:2,
  sortieTicks:2,
  battleTicks:5,
  resultTicks:4,
  visualCooldownTicks:30,
  maxRounds:25
};

CFG.invasions = [
  {
    id:'forest_scout',
    name:'林缘斥候',
    desc:'小股盗匪在林缘探路。',
    units:{infantry:[3,2]},
    reward:{wood:60,stone:30,food:40},
    loss:{wood:40,food:40}
  },
  {
    id:'grain_raiders',
    name:'偷粮小队',
    desc:'几名盗匪试图趁巡夜空隙偷走粮食。',
    units:{infantry:[4],archer:[2]},
    reward:{wood:70,stone:40,food:90},
    loss:{food:80}
  },
  {
    id:'quarry_ambush',
    name:'采石路伏击',
    desc:'采石路旁发现埋伏的敌人。',
    units:{infantry:[5,3]},
    reward:{wood:80,stone:110,food:50},
    loss:{stone:90},
    minTownLv:2
  },
  {
    id:'night_archers',
    name:'夜巡弓手',
    desc:'夜色里出现一队弓手骚扰城镇。',
    units:{infantry:[4],archer:[3,2]},
    reward:{wood:120,stone:80,food:90},
    loss:{wood:50,stone:50,food:50},
    minTownLv:2
  },
  {
    id:'cavalry_probe',
    name:'骑哨试探',
    desc:'敌方骑哨绕到城镇边缘试探防线。',
    units:{cavalry:[4],infantry:[5]},
    reward:{wood:160,stone:120,food:130},
    loss:{wood:80,food:120},
    requires:()=>bossDefeatedCount()>=1
  }
];

function defaultGarrisonState(){
  const now=(typeof S!=='undefined'&&typeof S.tick==='number')?S.tick:0;
  return {
    phase:'idle',
    phaseStarted:now,
    phaseUntil:0,
    cooldownUntil:0,
    nextCheckTick:now+(CFG.garrisonInvade?.protectTicks||300),
    templateId:null,
    result:null,
    seed:0
  };
}

function ensureGarrisonState(){
  if(!Array.isArray(S.garrisonLog))S.garrisonLog=[];
  if(typeof S.merit!=='number')S.merit=0;
  if(!S.garrison||typeof S.garrison!=='object')S.garrison=defaultGarrisonState();

  const d=defaultGarrisonState();
  for(const [key,value] of Object.entries(d)){
    if(S.garrison[key]===undefined)S.garrison[key]=value;
  }
  if(!S.garrison.phase)S.garrison.phase='idle';
  if(typeof S.garrison.nextCheckTick!=='number'){
    S.garrison.nextCheckTick=S.tick+CFG.garrisonInvade.protectTicks;
  }
  if(!S._garrisonForm)S._garrisonForm={front:[],mid:[],back:[]};
  for(const row of ['front','mid','back']){
    if(!Array.isArray(S._garrisonForm[row]))S._garrisonForm[row]=[];
  }
  return S.garrison;
}

function garrisonById(id){
  return (CFG.invasions||[]).find(x=>x.id===id)||null;
}

function garrisonTotal(){
  const gf=S._garrisonForm||{front:[],mid:[],back:[]};
  let n=0;
  for(const row of ['front','mid','back']){
    for(const u of gf[row]||[])n+=u.count||0;
  }
  return n;
}

function unlockedGarrisonInvasions(){
  return (CFG.invasions||[]).filter(inv=>{
    if(inv.minTownLv&&S.townLv<inv.minTownLv)return false;
    if(inv.requires&&!inv.requires())return false;
    return true;
  });
}

function pickGarrisonInvasion(){
  const list=unlockedGarrisonInvasions();
  return list.length?list[Math.floor(Math.random()*list.length)]:null;
}

function setGarrisonPhase(phase,durationTicks){
  const g=ensureGarrisonState();
  g.phase=phase;
  g.phaseStarted=S.tick;
  g.phaseUntil=S.tick+Math.max(0,durationTicks||0);
  return g;
}

function scheduleGarrisonCheck(delayTicks){
  const g=ensureGarrisonState();
  g.nextCheckTick=S.tick+Math.max(1,delayTicks||CFG.garrisonInvade.checkEveryTicks);
  return g.nextCheckTick;
}

function scheduleGarrisonCooldown(empty){
  const c=CFG.garrisonInvade;
  const delay=empty
    ?c.emptyCooldownTicks
    :c.cooldownMinTicks+Math.floor(Math.random()*(c.cooldownMaxTicks-c.cooldownMinTicks+1));
  scheduleGarrisonCheck(delay);
}

function startGarrisonInvasion(inv){
  const g=setGarrisonPhase('warning',CFG.garrisonInvade.warningTicks);
  g.templateId=inv.id;
  g.result=null;
  g.seed=Math.random();
  addGarrisonLog(`预警：${inv.name}正在靠近城镇。`,true);
}

function triggerGarrisonInvasion(templateId){
  const g=ensureGarrisonState();
  if(g.phase!=='idle'){
    if(typeof toast==='function')toast('已有驻军事件正在进行');
    return false;
  }
  const inv=templateId?garrisonById(templateId):pickGarrisonInvasion();
  if(!inv){
    if(typeof toast==='function')toast('暂无可触发的入侵模板');
    return false;
  }
  startGarrisonInvasion(inv);
  save();
  if(typeof updateUI==='function')updateUI();
  return true;
}

function garrisonTick(){
  const g=ensureGarrisonState();
  let changed=false;

  while(g.phase!=='idle'&&S.tick>=g.phaseUntil){
    advanceGarrisonPhase();
    changed=true;
    if(g.phase==='idle'||S.tick<g.phaseUntil)break;
  }

  if(g.phase==='idle'&&S.tick>=g.nextCheckTick){
    scheduleGarrisonCheck(CFG.garrisonInvade.checkEveryTicks);
    changed=true;
    if(S.tick>=CFG.garrisonInvade.protectTicks&&Math.random()<CFG.garrisonInvade.chance){
      const inv=pickGarrisonInvasion();
      if(inv){
        startGarrisonInvasion(inv);
        changed=true;
      }
    }
  }

  if(changed)save();
}

function advanceGarrisonPhase(){
  const g=ensureGarrisonState();
  const inv=garrisonById(g.templateId);
  if(!inv){
    Object.assign(g,defaultGarrisonState());
    return;
  }

  if(g.phase==='warning'){
    if(garrisonTotal()<=0){
      g.result={
        outcome:'empty',
        summary:'无人驻守，敌人靠近后自行退去。',
        reward:{},
        loss:{}
      };
      addGarrisonLog(`${inv.name}出现，但当前没有驻军。未造成资源损失。`,true);
      scheduleGarrisonCooldown(true);
      setGarrisonPhase('cooldown',CFG.garrisonInvade.visualCooldownTicks);
      return;
    }
    setGarrisonPhase('spawn',CFG.garrisonInvade.spawnTicks);
    return;
  }

  if(g.phase==='spawn'){
    setGarrisonPhase('sortie',CFG.garrisonInvade.sortieTicks);
    return;
  }

  if(g.phase==='sortie'){
    const result=resolveGarrisonBattle(inv);
    applyGarrisonResult(inv,result);
    setGarrisonPhase('battle',CFG.garrisonInvade.battleTicks);
    return;
  }

  if(g.phase==='battle'){
    setGarrisonPhase('result',CFG.garrisonInvade.resultTicks);
    return;
  }

  if(g.phase==='result'){
    scheduleGarrisonCooldown(false);
    setGarrisonPhase('cooldown',CFG.garrisonInvade.visualCooldownTicks);
    g.cooldownUntil=g.phaseUntil;
    return;
  }

  if(g.phase==='cooldown'){
    g.phase='idle';
    g.phaseStarted=S.tick;
    g.phaseUntil=0;
    g.templateId=null;
    g.result=null;
  }
}

function cloneResMap(src){
  return Object.assign({wood:0,stone:0,food:0},src||{});
}

function formatGarrisonRes(res){
  const labels={wood:'木',stone:'石',food:'粮'};
  return Object.entries(res||{})
    .filter(([,v])=>v>0)
    .map(([k,v])=>`${labels[k]||k}${Math.floor(v)}`)
    .join('、')||'无';
}

function addGarrisonLog(msg,mirror){
  if(!Array.isArray(S.garrisonLog))S.garrisonLog=[];
  S.garrisonLog.push({time:new Date().toLocaleTimeString(),msg});
  if(S.garrisonLog.length>100)S.garrisonLog.splice(0,S.garrisonLog.length-100);
  if(mirror&&typeof addLog==='function')addLog(`[驻军] ${msg}`);
}

function buildGarrisonUnitsFromForm(){
  const units=[];
  const gf=S._garrisonForm||{front:[],mid:[],back:[]};
  let id=0;
  for(const row of ['front','mid','back']){
    for(const u of gf[row]||[]){
      if(!u||!u.type||u.count<=0)continue;
      const cfg=CFG.units[u.type];
      if(!cfg)continue;
      units.push({
        id:id++,
        fid:u.id,
        type:u.type,
        row,
        originRow:row,
        hp:u.count,
        maxHp:u.count,
        icon:cfg.icon,
        name:cfg.name,
        spd:cfg.spd,
        atk:cfg.atk,
        def:cfg.def,
        alive:true
      });
    }
  }
  return units;
}

function buildGarrisonEnemyUnits(inv){
  const units=[];
  let id=1000;
  for(const [type,counts] of Object.entries(inv.units||{})){
    const cfg=CFG.units[type];
    if(!cfg)continue;
    for(const count of counts){
      units.push({
        id:id++,
        type,
        row:cfg.row,
        originRow:cfg.row,
        hp:count,
        maxHp:count,
        icon:cfg.icon,
        name:cfg.name,
        spd:cfg.spd,
        atk:cfg.atk,
        def:cfg.def,
        alive:true
      });
    }
  }
  return units;
}

function shiftGarrisonRows(units){
  const alive=u=>u.alive!==false&&u.hp>0;
  const hasAlive=row=>units.some(u=>alive(u)&&u.row===row);
  if(!hasAlive('front')){
    for(const u of units){
      if(!alive(u))continue;
      if(u.row==='mid')u.row='front';
      else if(u.row==='back')u.row='mid';
    }
  }
  if(!hasAlive('mid')){
    for(const u of units){
      if(!alive(u))continue;
      if(u.row==='back')u.row='mid';
    }
  }
}

function getGarrisonTarget(attacker,enemyList){
  const alive=enemyList.filter(u=>u.alive!==false&&u.hp>0);
  if(!alive.length)return null;
  if(!isRanged(attacker.type)&&attacker.row!=='front')return null;

  const rows={front:0,mid:1,back:2};
  const minRow=Math.min(...alive.map(u=>rows[u.row]));
  const front=alive.filter(u=>rows[u.row]===minRow);
  if(isRanged(attacker.type)){
    if(front.length&&Math.random()<0.6)return front[Math.floor(Math.random()*front.length)];
    return alive[Math.floor(Math.random()*alive.length)];
  }
  return front[Math.floor(Math.random()*front.length)];
}

function calcGarrisonDmg(attacker,defender){
  const defenseFactor=100/(100+defender.def*8);
  const counterFactor=cm(attacker.type,defender.type);
  const mageFactor=mm(attacker.type,defender.type);
  const passiveFactor=attacker.type==='infantry'?1.1:1.0;
  const randomFactor=0.9+Math.random()*0.2;
  const isCrit=attacker.type==='spearman'&&Math.random()<0.1;
  const raw=attacker.hp*attacker.atk*DAMAGE_COEF*defenseFactor*counterFactor*mageFactor*passiveFactor*randomFactor;
  return Math.max(1,Math.floor(isCrit?raw*2:raw));
}

function resolveGarrisonBattle(inv){
  const ourUnits=buildGarrisonUnitsFromForm();
  const enemyUnits=buildGarrisonEnemyUnits(inv);
  let rounds=0;

  for(;rounds<CFG.garrisonInvade.maxRounds;rounds++){
    shiftGarrisonRows(ourUnits);
    shiftGarrisonRows(enemyUnits);

    const ourAlive=ourUnits.filter(u=>u.alive!==false&&u.hp>0);
    const enemyAlive=enemyUnits.filter(u=>u.alive!==false&&u.hp>0);
    if(!ourAlive.length)break;
    if(!enemyAlive.length)break;

    ourAlive.sort((a,b)=>b.spd-a.spd||(Math.random()<0.5?1:-1));
    enemyAlive.sort((a,b)=>b.spd-a.spd||(Math.random()<0.5?1:-1));

    const actions=[];
    const maxCnt=Math.max(ourAlive.length,enemyAlive.length);
    const ourFirst=ourAlive[0].spd>enemyAlive[0].spd?true:enemyAlive[0].spd>ourAlive[0].spd?false:Math.random()<0.5;
    for(let i=0;i<maxCnt;i++){
      if(ourFirst){
        actions.push({unit:ourAlive[i%ourAlive.length],side:'our'});
        actions.push({unit:enemyAlive[i%enemyAlive.length],side:'enemy'});
      }else{
        actions.push({unit:enemyAlive[i%enemyAlive.length],side:'enemy'});
        actions.push({unit:ourAlive[i%ourAlive.length],side:'our'});
      }
    }

    for(const action of actions){
      const actor=action.unit;
      if(actor.alive===false||actor.hp<=0)continue;
      const foes=action.side==='our'?enemyUnits:ourUnits;
      const target=getGarrisonTarget(actor,foes);
      if(!target)continue;

      const archerMiss=isAttackMiss(actor,target);
      const cavDodge=!archerMiss&&target.type==='cavalry'&&actor.type!=='archer'&&Math.random()<0.1;
      if(archerMiss||cavDodge)continue;

      const dmg=Math.min(calcGarrisonDmg(actor,target),target.hp);
      target.hp-=dmg;
      if(target.hp<=0){
        target.hp=0;
        target.alive=false;
      }
    }
  }

  const ourLeft=ourUnits.filter(u=>u.alive!==false&&u.hp>0).reduce((s,u)=>s+u.hp,0);
  const enemyLeft=enemyUnits.filter(u=>u.alive!==false&&u.hp>0).reduce((s,u)=>s+u.hp,0);
  const outcome=enemyLeft<=0&&ourLeft>0?'win':ourLeft<=0?'lose':'timeout';
  return {outcome,rounds:rounds+1,ourUnits,enemyUnits,ourLeft,enemyLeft};
}

function rebuildGarrisonFormationAfterBattle(result){
  const newForm={front:[],mid:[],back:[]};
  for(const u of result.ourUnits||[]){
    if(u.alive===false||u.hp<=0)continue;
    const row=u.originRow||u.row||'front';
    newForm[row].push({type:u.type,count:u.hp,id:u.fid||Date.now()+Math.random()});
  }
  S._garrisonForm=newForm;
}

function applyGarrisonResult(inv,result){
  rebuildGarrisonFormationAfterBattle(result);

  const win=result.outcome==='win';
  const reward=win?cloneResMap(inv.reward):{wood:0,stone:0,food:0};
  const loss=win?{wood:0,stone:0,food:0}:cloneResMap(inv.loss);
  const cap=storageCapacity();

  if(win){
    for(const k of Object.keys(CFG.res)){
      S.res[k]=Math.min(cap,(S.res[k]||0)+(reward[k]||0));
    }
    S.merit=(S.merit||0)+1;
  }else{
    for(const k of Object.keys(CFG.res)){
      S.res[k]=Math.max(0,(S.res[k]||0)-(loss[k]||0));
    }
  }

  const msg=win
    ?`${inv.name}被击退，获得${formatGarrisonRes(reward)}，功勋+1。`
    :`${inv.name}突破巡防，损失${formatGarrisonRes(loss)}。`;
  addGarrisonLog(msg,true);

  const g=ensureGarrisonState();
  g.result={
    outcome:win?'win':'lose',
    summary:msg,
    reward,
    loss,
    rounds:result.rounds,
    ourLeft:result.ourLeft,
    enemyLeft:result.enemyLeft
  };
}

function garrisonCountdownTicks(){
  const g=ensureGarrisonState();
  const target=(g.phase==='idle'||g.phase==='cooldown')?g.nextCheckTick:g.phaseUntil;
  if(typeof target!=='number'||target<=S.tick)return 0;
  return target-S.tick;
}

function formatGarrisonCountdown(ticks){
  const seconds=Math.max(0,Math.ceil(ticks*((CFG.tickMs||1000)/1000)));
  const m=Math.floor(seconds/60);
  const s=seconds%60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function garrisonStatusText(hasAny){
  const g=ensureGarrisonState();
  if(g.phase==='warning')return '入侵预警';
  if(g.phase==='spawn')return '敌人出现';
  if(g.phase==='sortie')return '驻军出击';
  if(g.phase==='battle')return '自动交战';
  if(g.phase==='result'){
    if(g.result?.outcome==='win')return '击退入侵';
    if(g.result?.outcome==='lose')return '防线失守';
    if(g.result?.outcome==='empty')return '无人驻守';
    return '结算中';
  }
  if(g.phase==='cooldown')return `巡防整备 · 入侵倒计时 ${formatGarrisonCountdown(garrisonCountdownTicks())}`;
  return hasAny?`巡逻中 · 入侵倒计时 ${formatGarrisonCountdown(garrisonCountdownTicks())}`:'无驻军';
}

function garrisonTownMapClass(){
  const g=ensureGarrisonState();
  if(!g||g.phase==='idle')return '';
  const cls=['is-'+g.phase];
  if(g.result?.outcome)cls.push('result-'+g.result.outcome);
  return cls.join(' ');
}

function garrisonVfxClass(type){
  return {
    infantry:'swordqi',
    archer:'arrow',
    spearman:'thrust',
    cavalry:'cavslash',
    mage:'magebolt'
  }[type]||'swordqi';
}

function garrisonCombatTypes(){
  const types=[];
  const gf=S._garrisonForm||{front:[],mid:[],back:[]};
  for(const row of ['front','mid','back']){
    for(const u of gf[row]||[]){
      if(u.count>0&&!types.includes(u.type))types.push(u.type);
    }
  }
  return types.length?types:['infantry'];
}

function renderGarrisonTownLayers(){
  const g=ensureGarrisonState();
  const inv=garrisonById(g.templateId);
  const active=g.phase!=='idle';
  const banner=active?`<div class="town-phase-banner">${garrisonStatusText(true)}${inv?` · ${inv.name}`:''}</div>`:'';

  let enemies='';
  if(inv&&['spawn','sortie','battle','result'].includes(g.phase)){
    const shown=[];
    for(const [type,counts] of Object.entries(inv.units||{})){
      for(let i=0;i<counts.length&&shown.length<3;i++)shown.push(type);
      if(shown.length>=3)break;
    }
    enemies=shown.map((type,i)=>`<span class="town-invader invader-${i+1}" aria-hidden="true">${pix(type)}</span>`).join('');
  }

  let vfx='';
  if(g.phase==='battle'){
    const types=garrisonCombatTypes().slice(0,3);
    vfx+=`<span class="town-skirmish-flash" aria-hidden="true"></span>`;
    vfx+=types.map((type,i)=>{
      const cls=garrisonVfxClass(type);
      const top=[59,66,62][i]||62;
      const left=[40,50,57][i]||50;
      const size=type==='cavalry'?96:type==='infantry'?88:78;
      return `<span class="town-demo-vfx vfx vfx-${cls}" style="left:${left}%;top:${top}%;width:${size}px;height:${Math.floor(size*.55)}px"></span>`;
    }).join('');
  }

  const progress=g.phase==='cooldown'&&g.phaseUntil>g.phaseStarted
    ?Math.max(0,Math.min(100,Math.round((g.phaseUntil-S.tick)/(g.phaseUntil-g.phaseStarted)*100)))
    :0;
  const cooldown=`<div class="town-cooldown-bar" aria-hidden="true"><i style="width:${progress}%"></i></div>`;

  return `${banner}<div class="town-invasion-layer" aria-hidden="true">${enemies}</div><div class="town-vfx-layer" aria-hidden="true">${vfx}</div>${cooldown}`;
}
