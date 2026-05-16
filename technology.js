// ==================== 科技树系统 ====================
// 独立文件，类似 levels.js / garrison.js
// 科技树节点配置、解锁逻辑、科技点消耗
// 依赖：config.js(sprites.js)math.js 已加载

// ==================== 科技树配置 ====================
CFG.unitUpgrades = {
  infantry: {
    name: '步兵线',
    icon: 'infantry',
    tree: {
      infantry:          { tier:0, name:'农民', 
        branches:[{ to:'infantry_t1', name:'民兵→T1', cost:{wood:200,stone:100,food:150}, needTech:200, needMerit:5 }] },
      infantry_t1:       { tier:1, name:'民兵', 
        branches:[
          { to:'infantry_shield', name:'重盾手(盾)', cost:{wood:800,stone:600,food:500}, needTech:500, needMerit:10, needEssence:{type:'shield_essence',count:2} },
          { to:'infantry_spear',  name:'长矛扈从(矛)', cost:{wood:600,stone:400,food:700}, needTech:500, needMerit:10, needEssence:{type:'spear_essence',count:2} },
          { to:'infantry_sword',  name:'双手剑士(剑)', cost:{wood:500,stone:300,food:800}, needTech:500, needMerit:10, needEssence:{type:'sword_essence',count:2} }
        ]},
      infantry_shield:   { tier:2, name:'重盾手',
        branches:[{ to:'infantry_fortress', name:'堡垒巨盾', cost:{wood:2000,stone:1500,food:1200}, needTech:1000, needMerit:20, needEssence:{type:'shield_essence',count:3} }] },
      infantry_spear:    { tier:2, name:'长矛扈从',
        branches:[{ to:'infantry_ironrose', name:'铁玫瑰', cost:{wood:1800,stone:1200,food:1500}, needTech:1000, needMerit:20, needEssence:{type:'spear_essence',count:3} }] },
      infantry_sword:    { tier:2, name:'双手剑士',
        branches:[{ to:'infantry_bloodrose', name:'血蔷薇', cost:{wood:1600,stone:1000,food:1800}, needTech:1000, needMerit:20, needEssence:{type:'sword_essence',count:3} }] },
      infantry_fortress: { tier:3, name:'堡垒巨盾', branches:[] },
      infantry_ironrose: { tier:3, name:'铁玫瑰', branches:[] },
      infantry_bloodrose:{ tier:3, name:'血蔷薇', branches:[] }
    }
  },
  archer:    { name:'弓兵线', icon:'archer',    tree:{
    archer:              { tier:0, name:'猎人', 
      branches:[{ to:'archer_t1', name:'游侠→T1', cost:{wood:200,stone:100,food:150}, needTech:200, needMerit:5 }] },
    archer_t1:           { tier:1, name:'游侠', 
      branches:[
        { to:'archer_silverbow', name:'银弓猎手(弓)', cost:{wood:700,stone:400,food:600}, needTech:500, needMerit:10, needEssence:{type:'bow_essence',count:2} },
        { to:'archer_crossbow',  name:'重弩手(弩)', cost:{wood:500,stone:700,food:500}, needTech:500, needMerit:10, needEssence:{type:'crossbow_essence',count:2} },
        { to:'archer_assassin',  name:'双刃刺客(刃)', cost:{wood:500,stone:300,food:800}, needTech:500, needMerit:10, needEssence:{type:'blade_essence',count:2} }
      ]},
    archer_silverbow:    { tier:2, name:'银弓猎手',
      branches:[{ to:'archer_longbow', name:'不列颠长弓手', cost:{wood:2000,stone:1200,food:1500}, needTech:1000, needMerit:20, needEssence:{type:'bow_essence',count:3} }] },
    archer_crossbow:     { tier:2, name:'重弩手',
      branches:[{ to:'archer_genoese', name:'热那亚劲弩', cost:{wood:1500,stone:2000,food:1200}, needTech:1000, needMerit:20, needEssence:{type:'crossbow_essence',count:3} }] },
    archer_assassin:     { tier:2, name:'双刃刺客',
      branches:[{ to:'archer_shadowblade', name:'幽影刃侍', cost:{wood:1500,stone:1000,food:2000}, needTech:1000, needMerit:20, needEssence:{type:'blade_essence',count:3} }] },
    archer_longbow:      { tier:3, name:'不列颠长弓手',branches:[] },
    archer_genoese:      { tier:3, name:'热那亚劲弩', branches:[] },
    archer_shadowblade:  { tier:3, name:'幽影刃侍', branches:[] }
  } },
  cavalry:   { name:'骑兵线', icon:'cavalry',   tree:{
    cavalry_t1:         { tier:1, name:'侍从骑士', 
      unlock:{cost:{wood:300,stone:200,food:250},needTech:250,needMerit:8},
      branches:[
        { to:'cavalry_wind', name:'猎风弩骑(疾风)', cost:{wood:700,stone:500,food:600}, needTech:600, needMerit:15, needEssence:{type:'wind_essence',count:2} },
        { to:'cavalry_iron', name:'重装骑士(铁壁)', cost:{wood:500,stone:700,food:600}, needTech:600, needMerit:15, needEssence:{type:'iron_essence',count:2} }
      ]},
    cavalry_wind:       { tier:2, name:'猎风弩骑', 
      branches:[{ to:'cavalry_dragon', name:'破晓龙息', cost:{wood:2000,stone:1500,food:1800}, needTech:1200, needMerit:25, needEssence:{type:'wind_essence',count:3} }] },
    cavalry_iron:       { tier:2, name:'重装骑士', 
      branches:[{ to:'cavalry_teutonic', name:'条顿骑士', cost:{wood:1500,stone:2000,food:1500}, needTech:1200, needMerit:25, needEssence:{type:'iron_essence',count:3} }] },
    cavalry_dragon:     { tier:3, name:'破晓龙息',  branches:[] },
    cavalry_teutonic:   { tier:3, name:'条顿骑士', branches:[] }
  } },
  mage:      { name:'法师线', icon:'mage',      tree:{
    mage_t1:       { tier:1, name:'魔法学徒', tag:'mage',
      unlock:{cost:{wood:300,stone:300,food:250},needTech:300,needMerit:8},
      branches:[
        { to:'mage_time',  name:'时序术士(时)', cost:{wood:700,stone:500,food:600}, needTech:600, needMerit:15, needEssence:{type:'wind_essence',count:2} },
        { to:'mage_space', name:'虚空术士(空)', cost:{wood:500,stone:700,food:600}, needTech:600, needMerit:15, needEssence:{type:'iron_essence',count:2} }
      ]},
    mage_time:     { tier:2, name:'时序术士', tag:'time',
      branches:[{ to:'mage_chrono', name:'万古之瞳', cost:{wood:2000,stone:1500,food:1800}, needTech:1200, needMerit:25, needEssence:{type:'wind_essence',count:3} }] },
    mage_space:    { tier:2, name:'虚空术士', tag:'space',
      branches:[{ to:'mage_merlin', name:'梅林贤者', cost:{wood:1500,stone:2000,food:1800}, needTech:1200, needMerit:25, needEssence:{type:'iron_essence',count:3} }] },
    mage_chrono:   { tier:3, name:'万古之瞳', tag:'time', branches:[] },
    mage_merlin:   { tier:3, name:'梅林贤者', tag:'space', branches:[] }
  } }
};

// ==================== 解锁逻辑 ====================
function bossEssenceCount(){
  return Object.values(S.essence||{}).reduce((a,b)=>a+(b||0),0);
}
function unlockedVariants(baseUk){
  const tree=CFG.unitUpgrades[baseUk]?.tree;
  if(!tree)return[];
  const result=[];
  for(const[,node] of Object.entries(tree)){
    for(const br of node.branches||[]){
      if(CFG.units[br.to]&&S.upgradedUnits[br.to]) result.push(br.to);
    }
  }
  return result;
}
function upgradeUnit(fromKey,toKey){
  if(S.upgradedUnits[toKey]){toast('已解锁');return;}
  const tree=CFG.unitUpgrades[baseUnitType(fromKey)]?.tree;
  if(!tree)return;
  const node=tree[fromKey];
  if(!node)return;
  const branch=node.branches.find(b=>b.to===toKey);
  if(!branch)return;
  const needTech=branch.needTech||0;
  if((S.res.tech||0)<needTech){toast('科技点不足');return;}
  const needMerit=branch.needMerit||0;
  if((S.merit||0)<needMerit){toast('战功不足');return;}
  const needEssence=branch.needEssence||null;
  if(needEssence){
    if((S.essence[needEssence.type]||0)<needEssence.count){
      const ei=CFG.essences?.[needEssence.type];
      toast((ei?.name||needEssence.type)+'不足');return;
    }
  }
  const cost=branch.cost;
  if(S.res.wood<cost.wood||S.res.stone<cost.stone||S.res.food<cost.food){toast('资源不足');return;}
  S.res.wood-=cost.wood;S.res.stone-=cost.stone;S.res.food-=cost.food;
  S.res.tech-=needTech;
  S.merit-=needMerit;
  if(needEssence){S.essence[needEssence.type]-=needEssence.count;}
  S.upgradedUnits[toKey]=true;
  addLog('解锁'+(CFG.units[toKey]?CFG.units[toKey].name:toKey)+'兵种升级');
  save();updateUI();
}
function unlockUnitRoot(unitKey){
  if(S.upgradedUnits[unitKey]){toast('已解锁');return;}
  const tree=CFG.unitUpgrades[baseUnitType(unitKey)]?.tree;
  if(!tree)return;
  const node=tree[unitKey];
  if(!node||!node.unlock)return;
  const ul=node.unlock;
  const needTech=ul.needTech||0;
  if((S.res.tech||0)<needTech){toast('科技点不足');return;}
  const needMerit=ul.needMerit||0;
  if((S.merit||0)<needMerit){toast('战功不足');return;}
  const needEssence=ul.needEssence||null;
  if(needEssence){
    if((S.essence[needEssence.type]||0)<needEssence.count){
      const ei=CFG.essences?.[needEssence.type];
      toast((ei?.name||needEssence.type)+'不足');return;
    }
  }
  const cost=ul.cost;
  if(S.res.wood<cost.wood||S.res.stone<cost.stone||S.res.food<cost.food){toast('资源不足');return;}
  S.res.wood-=cost.wood;S.res.stone-=cost.stone;S.res.food-=cost.food;
  S.res.tech-=needTech;
  S.merit-=needMerit;
  if(needEssence){S.essence[needEssence.type]-=needEssence.count;}
  S.upgradedUnits[unitKey]=true;
  addLog('解锁'+(CFG.units[unitKey]?CFG.units[unitKey].name:unitKey)+'兵种');
  save();updateUI();
}

// ==================== 科技界面渲染 ====================
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
  const treeOrder=['infantry','archer','cavalry','mage'];
  const treeNames={infantry:'步兵线',archer:'弓兵线',cavalry:'骑兵线',mage:'法师线'};

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
    h+=`<div class="branch-body${folded?' folded':' expanded'}" style="margin-left:8px">`;
    for(const[key] of Object.entries(tree)){
      if(key===rootKey||tree[key].tier===0||S.upgradedUnits[key]){
        h+=renderOwnedNode(tree,rootKey,iconKey,key,0);
      }
    }
    h+=`</div>`;
  }
  h+=`</div>`;

  return h;
}
