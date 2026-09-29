/*
 * 放置帝国 HD-2D 视觉层。Three.js 0.158.0 由 assets/hd2d/three.min.js 提供。
 * 这里没有 S、B 或存档写入。所有输入是 UI/战斗层给出的只读快照。
 */
(function(root){
  'use strict';

  const live={town:null,battle:null};
  const errors={town:'',battle:''};
  const townEraIds=new Set([
    'base','sci_bronze_age','sci_iron_age','sci_silver_age','sci_gold_age',
    'sci_alloy_age','sci_steam_age','sci_electric_age','sci_nuclear_age'
  ]);
  const townSites=[
    {id:'town',x:0,z:-0.45,w:1.9,h:1.65,d:1.45,body:0xbfa97b,roof:0x856451,icon:'town_hall'},
    {id:'wood',x:-3.25,z:-1.45,w:1.3,h:0.85,d:1.05,body:0xc7a16d,roof:0x9b6946,icon:'lumber_yard'},
    {id:'stone',x:3.05,z:-1.55,w:1.35,h:0.9,d:1.05,body:0xa7a9a2,roof:0x666f72,icon:'quarry_yard'},
    {id:'food',x:-3.15,z:2.05,w:1.3,h:0.74,d:0.95,body:0xd3b786,roof:0xa5774c,icon:'farm_yard'},
    {id:'army',x:3.08,z:1.75,w:1.45,h:0.9,d:1.08,body:0x9ba7a0,roof:0x665f55,icon:'barracks'},
    {id:'tech',x:0.45,z:-3.2,w:1.2,h:1.35,d:1.15,body:0xe0d2ad,roof:0x588890,icon:'academy'},
    {id:'defense',x:0.1,z:3.36,w:1.2,h:1.25,d:0.95,body:0xaab2ad,roof:0x566d74,icon:'arrow_tower'}
  ];

  const unitFallback={
    infantry:'./assets/unit-infantry.png',archer:'./assets/unit-archer.png',
    cavalry:'./assets/unit-cavalry.png',mage:'./assets/unit-mage.png',
    spearman:'./assets/unit-spearman.png'
  };
  // 原创高清待机立绘。已完成动作样板的兵种使用同尺寸四帧图集。
  const hiresUnitTypes=new Set([
    'infantry','infantry_t1','infantry_shield','infantry_spear','infantry_sword',
    'infantry_fortress','infantry_ironrose','infantry_bloodrose',
    'archer','archer_t1','archer_silverbow','archer_crossbow','archer_assassin',
    'archer_longbow','archer_genoese','archer_shadowblade',
    'cavalry','cavalry_t1','cavalry_wind','cavalry_iron','cavalry_dragon','cavalry_teutonic',
    'spearman','bronze_guard','iron_spearman','silver_heavy','gold_cavalry',
    'alloy_special','armored_trooper','electro_trooper','star_trooper','quantum_trooper',
    'mage','mage_t1','mage_time','mage_space','mage_chrono','mage_merlin','arcane_mage','enemy',
    'god_crystal_guard','phantom_god','guardian_god','revival_god','silence_god','slaughter_god',
    'trial_guard_easy','trial_guard_perfect','trial_guard_extreme','soul_wraith',
    'wild_boar','wild_bull','wild_snake','wild_tiger','wild_turtle','wild_wyrm'
  ]);
  const hiresActionTypes=new Set([
    'infantry','infantry_t1','infantry_shield','archer','archer_t1','archer_crossbow','star_trooper','cavalry_t1','gold_cavalry'
  ]);
  // Authored helmet/hood anchors for frames whose raised weapon sits higher
  // than the face. Other frames use measured alpha bounds.
  const actionBadgeHeadTops={
    infantry:{attack:{1:104/512}},
    archer:{attack:{2:92/512}},
    archer_t1:{attack:{1:72/512,2:72/512}},
    cavalry_t1:{attack:{0:32/512,1:43/512,2:8/512,3:45/512}},
    gold_cavalry:{attack:{0:2/512,1:68/512,2:16/512,3:52/512}}
  };
  const idleBadgeHeadTops={cavalry_t1:32/512,gold_cavalry:2/512};

  function three(){return root.THREE;}
  function validOrigin(){return root.location&&/^(https?):$/.test(root.location.protocol);}
  function available(){return !!(validOrigin()&&three()&&root.WebGLRenderingContext);}
  function candidatePickLayout(state){
    if(!state?.candidateReady||!state.width||!state.height)return [];
    const T=three();state.camera.updateMatrixWorld(true);
    return Object.entries(state.townGroups).map(([id,node])=>{
      const center=new T.Box3().setFromObject(node).getCenter(new T.Vector3()).project(state.camera);
      return {id,x:(center.x+1)*state.width/2,y:(1-center.y)*state.height/2};
    });
  }
  function status(){
    const battle=live.battle;
    const layout=battle?battleLayoutStatus(battle):[];
    return {
      available:available(),
      town:{mounted:!!live.town,reason:errors.town,modelsLoaded:live.town?live.town.modelsLoaded:0,
        candidatePreview:!!live.town?.candidateMode,
        candidateReady:!!live.town?.candidateReady,
        candidatePickNodes:live.town?.candidatePickNodes||[],
        candidatePickLayout:candidatePickLayout(live.town),
        candidateError:live.town?.candidateError||'',
        artworkReady:!!live.town?.plate?.ready,artworkEra:live.town?.plate?.artworkEra||'',
        reliefLayers:live.town?.plate?.reliefs?.filter(item=>!!item.mesh.material.map).length||0,
        reliefParallaxPx:live.town?.expanded&&live.town?.plate?
          Math.round(100*Math.hypot(live.town.plate.root.position.x,live.town.plate.root.position.y)*
            0.72*0.035*live.town.width/Math.max(1,live.town.camera.right-live.town.camera.left)*
            live.town.camera.zoom)/100:0,
        visibleWorkers:live.town?.plate?.actors?.filter(item=>item.kind==='worker').length||0,
        visibleGuards:live.town?.plate?.actors?.filter(item=>item.kind==='guard').length||0,
        pointerCount:live.town?.pointers?.size||0,lastPick:live.town?.lastTownPick||null},
      battle:{mounted:!!battle,reason:errors.battle,modelsLoaded:battle?battle.modelsLoaded:0,
        artworkReady:!!battle?.plate?.ready,artworkTheme:battle?.plate?.artworkTheme||'',
        pixelRatio:battle?.pixelRatio||0,
        activeActions:battle?Object.values(battle.units).filter(unit=>!!unit.action).length:0,
        activeEffects:battle?battle.effects.length:0,
        effectStyles:battle?battle.effects.map(effect=>effect.style):[],
        effectDetails:battle?battle.effects.map(effect=>({type:effect.type,
          unitType:effect.unitType,style:effect.style,phase:effect.phase,
          rank:effect.rank,mainAsset:effect.mainPath,
          mainWidth:effect.main.scale.x,
          ornaments:effect.trails.length+effect.particles.length,
          assetReady:!!loadedTexture(battle,effect.mainPath)&&
            effect.main.material.map===loadedTexture(battle,effect.mainPath),
          meshVisible:effect.mesh.visible,mainOpacity:effect.main.material.opacity,
          glowOpacity:effect.glow.material.opacity,
          elapsedMs:Math.round(performance.now()-effect.start),durationMs:effect.duration,
          visible:effect.mesh.visible&&effect.main.material.opacity>0.05})):[],
        lastAcceptedEvent:battle?.lastAcceptedEvent||null,
        visibleUnits:{allies:layout.filter(unit=>unit.side==='allies').length,
          enemies:layout.filter(unit=>unit.side==='enemies').length},
        hiddenUnits:battle?{...battle.hiddenUnits}:{allies:0,enemies:0},layout}
    };
  }
  function number(value,fallback){return Number.isFinite(Number(value))?Number(value):fallback;}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function mat(color,roughness){return new (three().MeshStandardMaterial)({color,roughness:roughness==null?0.96:roughness,metalness:0});}
  function mesh(geometry,material,x,y,z){
    const m=new (three().Mesh)(geometry,material);
    m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;
    return m;
  }
  function addBox(parent,w,h,d,color,x,y,z){
    const T=three(),m=mesh(new T.BoxGeometry(w,h,d),mat(color),x,y,z);
    parent.add(m);return m;
  }
  function addCylinder(parent,top,bottom,height,color,x,y,z,sides){
    const T=three(),m=mesh(new T.CylinderGeometry(top,bottom,height,sides||6),mat(color),x,y,z);
    parent.add(m);return m;
  }
  function seeded(seed){
    let x=seed>>>0;
    return function(){x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
  }
  function groundTexture(kind){
    const T=three(),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    canvas.width=128;canvas.height=128;
    const rand=seeded(kind==='town'?41523:91417);
    const palette=kind==='town'?['#a9b985','#b7c492','#9aaa76','#c4c99b','#d5c49b']:['#d9bc84','#d2b37b','#e2c590','#c4a677','#b99b70'];
    ctx.fillStyle=palette[0];ctx.fillRect(0,0,128,128);
    for(let i=0;i<760;i++){
      ctx.fillStyle=palette[1+Math.floor(rand()*(palette.length-1))];
      ctx.fillRect(Math.floor(rand()*128),Math.floor(rand()*128),rand()<0.72?1:2,rand()<0.8?1:2);
    }
    const texture=new T.CanvasTexture(canvas);
    texture.magFilter=T.NearestFilter;texture.minFilter=T.NearestFilter;
    texture.wrapS=texture.wrapT=T.RepeatWrapping;
    texture.repeat.set(kind==='battle'?16:4,kind==='battle'?16:3);
    texture.colorSpace=T.SRGBColorSpace;
    return texture;
  }
  function pixelFigureTexture(kind){
    const T=three(),c=document.createElement('canvas'),p=c.getContext('2d');
    c.width=32;c.height=48;p.imageSmoothingEnabled=false;
    const color={wood:'#8a704e',stone:'#6f7a82',food:'#a67747',guard:'#637f92',enemy:'#9b5449',infantry:'#768c9f',archer:'#7a9866',cavalry:'#a78166',mage:'#9678a7'}[kind]||'#7b8a9a';
    p.fillStyle='rgba(0,0,0,.22)';p.fillRect(7,43,19,2);
    p.fillStyle='#50483e';p.fillRect(11,30,4,13);p.fillRect(19,30,4,13);
    p.fillStyle=color;p.fillRect(9,17,16,15);p.fillRect(6,20,3,11);p.fillRect(25,20,3,11);
    p.fillStyle='#e6cda5';p.fillRect(11,10,12,8);p.fillRect(6,29,3,4);p.fillRect(25,29,3,4);
    p.fillStyle='#4e3f37';p.fillRect(10,7,14,4);p.fillRect(12,17,10,2);
    p.fillStyle='#2e3634';p.fillRect(13,13,2,2);p.fillRect(20,13,2,2);
    if(kind==='archer'){p.fillStyle='#71553d';p.fillRect(26,8,2,27);}
    if(kind==='mage'){p.fillStyle='#dbcf9b';p.fillRect(6,8,2,31);p.fillRect(4,6,6,4);}
    if(kind==='guard'||kind==='infantry'){p.fillStyle='#b9b8ae';p.fillRect(24,20,7,14);}
    const t=new T.CanvasTexture(c);t.magFilter=T.NearestFilter;t.minFilter=T.NearestFilter;
    t.colorSpace=T.SRGBColorSpace;return t;
  }
  function spriteTexture(state,kind){
    if(!state.generated[kind]){state.generated[kind]=pixelFigureTexture(kind);state.ownedTextures.add(state.generated[kind]);}
    return state.generated[kind];
  }
  function iconPath(unit,options){
    let key=unit.icon||unit.type||'';
    if(typeof key==='string'&&/\.(png|webp)$/i.test(key))return key;
    if(options&&options.spritePaths&&options.spritePaths[key])return options.spritePaths[key];
    if(typeof unit.type==='string'&&/^[a-z0-9_]+$/.test(unit.type))return './assets/art/units/'+unit.type+'-idle.png';
    if(typeof CFG!=='undefined'&&CFG.units&&CFG.units[unit.type]&&CFG.units[unit.type].icon)key=CFG.units[unit.type].icon;
    if(typeof PIX_IMAGE_SPRITES!=='undefined'&&PIX_IMAGE_SPRITES[key])return PIX_IMAGE_SPRITES[key];
    return unitFallback[unit.type]||null;
  }
  function hiresIconPath(unit,options,side){
    const type=unit?.type;
    // 敌方基础步兵使用独立剪影，其他兵种按自身确切 ID 映射。
    const key=side==='enemies'&&type==='infantry'?'enemy':type;
    if(options?.hiresSpritePaths?.[key])return options.hiresSpritePaths[key];
    return hiresUnitTypes.has(key)?'./assets/art/units/hires/'+key+'.png':null;
  }
  function mapIconPath(key,options){
    if(options&&options.spritePaths&&options.spritePaths[key])return options.spritePaths[key];
    if(/^[a-z0-9_]+$/.test(key))return './assets/art/map/'+key+'.png';
    if(typeof MAP_IMAGE_SPRITES!=='undefined'&&MAP_IMAGE_SPRITES[key])return MAP_IMAGE_SPRITES[key];
    return null;
  }
  function parseStaticGlb(buffer,state){
    // 仅实现本项目可编辑模型生成器产出的 glTF 2.0 静态子集。
    const T=three(),header=new DataView(buffer);
    if(buffer.byteLength<20||header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2)throw Error('Invalid GLB');
    let json=null,bin=null,at=12;
    while(at+8<=buffer.byteLength){
      const length=header.getUint32(at,true),type=header.getUint32(at+4,true);
      if(at+8+length>buffer.byteLength)throw Error('Truncated GLB');
      if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,at+8,length)).trim());
      if(type===0x004e4942)bin=new DataView(buffer,at+8,length);
      at+=8+length;
    }
    if(!json||!bin)throw Error('Missing GLB chunks');
    const textureCache=new Map();
    function colorTexture(index){
      if(textureCache.has(index))return textureCache.get(index);
      const spec=json.textures?.[index],image=json.images?.[spec?.source],
        sampler=json.samplers?.[spec?.sampler]||{},
        view=json.bufferViews?.[image?.bufferView];
      if(!view||view.buffer!==0||!/^image\/(png|jpeg|webp)$/.test(image.mimeType||'')||
        !Number.isSafeInteger(view.byteLength)||view.byteLength<=0||view.byteLength>4194304)
        return null;
      const offset=bin.byteOffset+(view.byteOffset||0);
      if(offset<bin.byteOffset||offset+view.byteLength>bin.byteOffset+bin.byteLength)return null;
      const bytes=new Uint8Array(buffer,offset,view.byteLength);
      const url=URL.createObjectURL(new Blob([bytes],{type:image.mimeType}));
      const done=()=>URL.revokeObjectURL(url);
      const map=state.loader.load(url,done,undefined,done);
      map.colorSpace=T.SRGBColorSpace;map.flipY=false;
      // glTF defaults to repeat wrapping and linear filtering. The authored
      // meadow uses UVs beyond 0..1; clamping created striped phone renders.
      const wrap=value=>value===33071?T.ClampToEdgeWrapping:
        value===33648?T.MirroredRepeatWrapping:T.RepeatWrapping;
      map.wrapS=wrap(sampler.wrapS);map.wrapT=wrap(sampler.wrapT);
      map.magFilter=sampler.magFilter===9728?T.NearestFilter:T.LinearFilter;
      map.minFilter=({9728:T.NearestFilter,9729:T.LinearFilter,
        9984:T.NearestMipmapNearestFilter,9985:T.LinearMipmapNearestFilter,
        9986:T.NearestMipmapLinearFilter,9987:T.LinearMipmapLinearFilter})[sampler.minFilter]||
        T.LinearMipmapLinearFilter;
      state.ownedTextures.add(map);textureCache.set(index,map);
      return map;
    }
    function values(index){
      const a=json.accessors[index],v=json.bufferViews[a.bufferView];
      if(!a||!v||v.buffer!==0||a.sparse)throw Error('Unsupported accessor');
      const comps={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
      const bytes={5121:1,5123:2,5125:4,5126:4}[a.componentType];
      if(!comps||!bytes)throw Error('Unsupported component');
      const stride=v.byteStride||comps*bytes,offset=(v.byteOffset||0)+(a.byteOffset||0);
      const out=a.componentType===5126?new Float32Array(a.count*comps):new Uint32Array(a.count*comps);
      for(let i=0;i<a.count;i++)for(let j=0;j<comps;j++){
        const p=offset+i*stride+j*bytes;
        out[i*comps+j]=a.componentType===5126?bin.getFloat32(p,true):
          a.componentType===5125?bin.getUint32(p,true):
          a.componentType===5123?bin.getUint16(p,true):bin.getUint8(p);
      }
      return out;
    }
    function nodeObject(index){
      const data=json.nodes[index],group=new T.Group();
      group.name=typeof data.name==='string'?data.name:'';
      if(data.translation)group.position.fromArray(data.translation);
      if(data.rotation)group.quaternion.fromArray(data.rotation);
      if(data.scale)group.scale.fromArray(data.scale);
      if(data.matrix)group.applyMatrix4(new T.Matrix4().fromArray(data.matrix));
      if(data.mesh!=null){
        const def=json.meshes[data.mesh];
        for(const primitive of def.primitives){
          if(primitive.mode!=null&&primitive.mode!==4)throw Error('Only triangle meshes supported');
          const geometry=new T.BufferGeometry();
          geometry.setAttribute('position',new T.BufferAttribute(values(primitive.attributes.POSITION),3));
          if(primitive.attributes.NORMAL!=null)geometry.setAttribute('normal',new T.BufferAttribute(values(primitive.attributes.NORMAL),3));
          else geometry.computeVertexNormals();
          if(primitive.attributes.TEXCOORD_0!=null)
            geometry.setAttribute('uv',new T.BufferAttribute(values(primitive.attributes.TEXCOORD_0),2));
          if(primitive.indices!=null)geometry.setIndex(new T.BufferAttribute(values(primitive.indices),1));
          const materialDef=(json.materials||[])[primitive.material]||{};
          const pbr=materialDef.pbrMetallicRoughness||{};
          const base=pbr.baseColorFactor||[1,1,1,1];
          const material=new T.MeshStandardMaterial({
            color:new T.Color().setRGB(base[0],base[1],base[2]),
            roughness:pbr.roughnessFactor==null?0.95:pbr.roughnessFactor,
            metalness:pbr.metallicFactor==null?0:pbr.metallicFactor,
            transparent:materialDef.alphaMode==='BLEND'||base[3]<1,opacity:base[3],
            alphaTest:materialDef.alphaMode==='MASK'?(materialDef.alphaCutoff??0.5):0,
            side:materialDef.doubleSided?T.DoubleSide:T.FrontSide
          });
          if(pbr.baseColorTexture&&geometry.hasAttribute('uv'))
            material.map=colorTexture(pbr.baseColorTexture.index);
          const m=new T.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;group.add(m);
        }
      }
      for(const child of data.children||[])group.add(nodeObject(child));
      return group;
    }
    const result=new T.Group();
    const roots=json.scenes?.[json.scene||0]?.nodes||[];
    for(const index of roots)result.add(nodeObject(index));
    return result;
  }
  function loadStaticModel(state,name,onReady){
    if(!/^[a-z0-9_]+$/.test(name)||!validOrigin())return;
    const path='./assets/art/models/'+name+'.glb';
    let url;
    try{url=new URL(path,document.baseURI);if(url.origin!==location.origin)return;}catch(e){return;}
    fetch(url.href).then(response=>{
      if(!response.ok)throw Error('Model HTTP '+response.status);
      return response.arrayBuffer();
    }).then(buffer=>{
      if(state.disposed)return;
      const model=parseStaticGlb(buffer,state);
      onReady(model);
    }).catch(()=>{}); // 程序化三维模型保持可见，图片/模型缺失不阻塞游戏。
  }
  function loadTextureFor(state,path,material,settings){
    if(!path||!validOrigin())return;
    let url;
    try{url=new URL(path,document.baseURI);if(url.origin!==location.origin)return;}catch(e){return;}
    const key=url.href;
    if(state.loaded[key]){
      if(state.loaded[key].failed){if(settings&&settings.onError)settings.onError();return;}
      if(material&&state.loaded[key].texture){
        if(!material.userData.hd2dPreferred){material.map=state.loaded[key].texture;material.needsUpdate=true;}
      }else if(material)state.loaded[key].users.push(material);
      if(settings&&settings.onReady){
        if(state.loaded[key].texture)settings.onReady(state.loaded[key].texture);
        else state.loaded[key].callbacks.push(settings.onReady);
      }
      if(settings&&settings.onError&&!state.loaded[key].texture)
        state.loaded[key].errorCallbacks.push(settings.onError);
      return;
    }
    const entry={texture:null,users:material?[material]:[],callbacks:settings&&settings.onReady?[settings.onReady]:[],
      errorCallbacks:settings&&settings.onError?[settings.onError]:[],failed:false};state.loaded[key]=entry;
    const fail=function(){
      entry.failed=true;entry.users.length=0;entry.callbacks.length=0;
      for(const callback of entry.errorCallbacks)callback();
      entry.errorCallbacks.length=0;
    };
    try{
      state.loader.load(key,function(texture){
        if(state.disposed){texture.dispose();return;}
        texture.magFilter=settings&&settings.pixelArt?three().NearestFilter:
          settings&&settings.linear?three().LinearFilter:three().NearestFilter;
        texture.minFilter=settings&&settings.pixelArt?three().NearestMipmapNearestFilter:
          settings&&settings.mipmap?three().LinearMipmapLinearFilter:
          settings&&settings.linear?three().LinearFilter:three().NearestFilter;
        texture.colorSpace=three().SRGBColorSpace;
        if(settings&&settings.animate){
          const frames=clamp(Math.round(texture.image.width/texture.image.height),1,8);
          texture.userData.hd2dFrames=frames;
          texture.repeat.set(1/frames,1);
          if(settings.idle)state.animatedTextures.add(texture);
        }
        if(settings&&settings.tile){
          texture.wrapS=texture.wrapT=three().RepeatWrapping;
          texture.repeat.set(settings.tile[0],settings.tile[1]);
        }
        texture.needsUpdate=true;
        entry.texture=texture;state.ownedTextures.add(texture);
        for(const m of entry.users)if(!m.userData.hd2dPreferred){m.map=texture;m.needsUpdate=true;}
        entry.users.length=0;
        for(const callback of entry.callbacks)callback(texture);
        entry.callbacks.length=0;
        entry.errorCallbacks.length=0;
      },undefined,fail);
    }catch(e){fail();}
  }
  const plateSites={
    town:[0.50,0.40],wood:[0.17,0.42],stone:[0.82,0.42],food:[0.20,0.70],
    army:[0.65,0.28],tech:[0.26,0.15],defense:[0.82,0.12]
  };
  // 九时代全景采用相同构图。浮雕层直接取自当前时代的原画，在默认镜头下
  // 与底图完全对位；展开地图时仅产生几像素视差，不露出低模方块。
  const townReliefRegions=[
    {id:'tech',u:0.075,v:0.00,w:0.39,h:0.34,depth:0.20},
    {id:'army',u:0.585,v:0.00,w:0.365,h:0.35,depth:0.22},
    {id:'wood',u:0.00,v:0.19,w:0.315,h:0.39,depth:0.41},
    {id:'stone',u:0.705,v:0.20,w:0.295,h:0.47,depth:0.42},
    {id:'town',u:0.345,v:0.115,w:0.31,h:0.51,depth:0.52},
    {id:'food',u:0.00,v:0.48,w:0.415,h:0.43,depth:0.72}
  ];
  function townReliefTexture(state,image,region){
    const T=three(),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    const sx=Math.round(image.width*region.u),sy=Math.round(image.height*region.v);
    const sw=Math.round(image.width*region.w),sh=Math.round(image.height*region.h);
    canvas.width=Math.max(1,sw);canvas.height=Math.max(1,sh);
    ctx.drawImage(image,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
    // 圆角软遮罩把原画边界藏在道路、树冠与远景中，避免裁切硬边。
    ctx.globalCompositeOperation='destination-in';
    ctx.save();ctx.translate(canvas.width/2,canvas.height/2);
    ctx.scale(canvas.width/2,canvas.height/2);
    const fade=ctx.createRadialGradient(0,0,0.55,0,0,1);
    fade.addColorStop(0,'rgba(0,0,0,1)');
    fade.addColorStop(0.66,'rgba(0,0,0,1)');
    fade.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=fade;ctx.fillRect(-1,-1,2,2);ctx.restore();
    const texture=new T.CanvasTexture(canvas);
    texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;
    texture.colorSpace=T.SRGBColorSpace;
    state.ownedTextures.add(texture);
    return texture;
  }
  function syncTownReliefArt(state,texture){
    const T=three(),plate=state.plate;
    if(!plate||state.kind!=='town'||!texture?.image)return;
    if(!plate.reliefs.length){
      townReliefRegions.forEach((region,index)=>{
        // 分段平面保留真实 z 形状；视差只在展开交互时显示。
        const geometry=new T.PlaneGeometry(1,1,8,6);
        const positions=geometry.getAttribute('position');
        for(let i=0;i<positions.count;i++){
          const x=positions.getX(i)*2,y=positions.getY(i)*2;
          positions.setZ(i,Math.max(0,1-x*x-y*y)*region.depth*0.06);
        }
        positions.needsUpdate=true;geometry.computeVertexNormals();
        const material=new T.MeshBasicMaterial({transparent:true,depthTest:false,
          depthWrite:false,toneMapped:false,side:T.DoubleSide});
        const mesh=new T.Mesh(geometry,material);
        mesh.renderOrder=-990+index;plate.root.add(mesh);
        plate.reliefs.push({region,mesh});
      });
    }
    for(const relief of plate.reliefs){
      const material=relief.mesh.material;
      if(material.map){state.ownedTextures.delete(material.map);material.map.dispose();}
      material.map=townReliefTexture(state,texture.image,relief.region);
      material.needsUpdate=true;
    }
    sizePlate(state);
  }
  function positionTownRelief(state){
    const plate=state.plate;if(!plate||state.kind!=='town')return;
    const panX=state.expanded?plate.root.position.x:0;
    const panY=state.expanded?plate.root.position.y:0;
    for(const {region,mesh} of plate.reliefs){
      mesh.position.x=(region.u+region.w/2-0.5)*plate.width-panX*region.depth*0.035;
      mesh.position.y=(0.5-region.v-region.h/2)*plate.height-panY*region.depth*0.035;
      mesh.position.z=0.12+region.depth*0.18;
      mesh.scale.set(plate.width*region.w,plate.height*region.h,1);
    }
    for(const actor of plate.actors){
      const shiftX=panX*actor.depth*0.035,shiftY=panY*actor.depth*0.035;
      actor.sprite.position.x=(actor.u-0.5)*plate.width-shiftX;
      actor.sprite.position.y=(0.5-actor.v)*plate.height-shiftY;
      actor.shadow.position.x=actor.sprite.position.x;
      actor.shadow.position.y=actor.sprite.position.y-
        13*(state.camera.top-state.camera.bottom)/Math.max(1,state.height*state.camera.zoom);
    }
  }
  function townActorShadowTexture(state){
    if(state.plate.shadowTexture)return state.plate.shadowTexture;
    const T=three(),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    canvas.width=32;canvas.height=12;
    ctx.scale(1,0.42);
    const shade=ctx.createRadialGradient(16,14,2,16,14,15);
    shade.addColorStop(0,'rgba(32,32,27,.38)');
    shade.addColorStop(1,'rgba(32,32,27,0)');
    ctx.fillStyle=shade;ctx.fillRect(0,0,32,28);
    const texture=new T.CanvasTexture(canvas);
    texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;
    state.ownedTextures.add(texture);state.plate.shadowTexture=texture;
    return texture;
  }
  function townMarker(state,site){
    const T=three(),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    canvas.width=88;canvas.height=40;
    const texture=new T.CanvasTexture(canvas);
    texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;
    state.ownedTextures.add(texture);
    const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
    sprite.renderOrder=4;sprite.visible=false;
    sprite.userData.marker={site,canvas,ctx,texture,signature:''};
    return sprite;
  }
  function syncPlateMarkers(state,snapshot){
    if(!state.plate||state.kind!=='town')return;
    for(const sprite of state.plate.markers){
      const marker=sprite.userData.marker,site=marker.site;
      const lv=Math.max(0,Math.floor(townLevelFor(site,snapshot)));
      const phase=townBuildingFor(site,snapshot)?.state||'idle';
      const building=phase!=='idle',unbuilt=site.id!=='town'&&lv===0;
      const alert=site.id==='defense'&&/^(warning|spawn|sortie|battle)$/.test(snapshot.garrison?.phase||'');
      const label=alert?'警戒':building?'施工':unbuilt?'待建':'Lv'+Math.min(lv,99)+(lv>99?'+':'');
      sprite.visible=!!(state.expanded||building||unbuilt||alert);
      const signature=label+'|'+phase+'|'+state.expanded+'|'+alert;
      if(signature===marker.signature)continue;
      marker.signature=signature;
      const ctx=marker.ctx;
      ctx.clearRect(0,0,88,40);
      if(state.expanded){
        ctx.fillStyle=alert?'#8a2931':building?'#714a23':unbuilt?'#40575e':'#1d5c52';ctx.fillRect(1,1,86,38);
        ctx.fillStyle=alert?'#ffe7dc':building?'#ffe1a0':unbuilt?'#e6ede9':'#e9fff2';ctx.fillRect(4,4,80,32);
        ctx.fillStyle=alert?'#8a2931':building?'#694222':unbuilt?'#40575e':'#1d5c52';
        ctx.font='bold 20px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(label,44,20,76);
      }else{
        ctx.fillStyle=alert?'#9a3038':building?'#754d2b':'#3d5d64';
        ctx.beginPath();ctx.ellipse(44,20,40,18,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle=alert?'#fff0e4':building?'#ffe4a4':'#eff7ed';ctx.lineWidth=4;
        ctx.beginPath();
        if(alert){ctx.moveTo(44,10);ctx.lineTo(44,25);ctx.moveTo(44,29);ctx.lineTo(44,31);}
        else{ctx.moveTo(27,20);ctx.lineTo(61,20);
          if(!building){ctx.moveTo(44,11);ctx.lineTo(44,29);}}
        ctx.stroke();
      }
      marker.texture.needsUpdate=true;
    }
  }
  function sizePlate(state){
    if(!state.plate)return;
    const viewW=state.camera.right-state.camera.left,viewH=state.camera.top-state.camera.bottom;
    const h=Math.max(viewH,viewW/state.plate.aspect),w=h*state.plate.aspect;
    state.plate.mesh.scale.set(w,h,1);
    state.plate.width=w;state.plate.height=h;
    const touchW=48*viewW/Math.max(1,state.width*state.camera.zoom);
    const touchH=48*viewH/Math.max(1,state.height*state.camera.zoom);
    for(const spot of state.plate.hotspots){
      const uv=plateSites[spot.userData.hotspot];
      spot.position.set((uv[0]-0.5)*w,(0.5-uv[1])*h,0.04);
      spot.scale.set(touchW,touchH,1);
    }
    for(const actor of state.plate.actors){
      actor.sprite.position.set((actor.u-0.5)*w,(0.5-actor.v)*h,0.30);
      actor.sprite.scale.set(23*viewW/Math.max(1,state.width),29*viewH/Math.max(1,state.height),1);
      actor.shadow.position.set(actor.sprite.position.x,actor.sprite.position.y-0.1,0.26);
      actor.shadow.scale.set(18*viewW/Math.max(1,state.width),7*viewH/Math.max(1,state.height),1);
    }
    for(const sprite of state.plate.markers){
      const uv=plateSites[sprite.userData.marker.site.id];
      sprite.position.set((uv[0]-0.5)*w,(0.5-uv[1])*h,0.1);
      const cssW=state.expanded?42:18,cssH=state.expanded?20:18;
      sprite.scale.set(cssW*viewW/Math.max(1,state.width*state.camera.zoom),
        cssH*viewH/Math.max(1,state.height*state.camera.zoom),1);
    }
    clampPlatePan(state);
    positionTownRelief(state);
  }
  function clampPlatePan(state){
    if(!state.plate)return;
    const viewW=(state.camera.right-state.camera.left)/state.camera.zoom;
    const viewH=(state.camera.top-state.camera.bottom)/state.camera.zoom;
    const maxX=Math.max(0,(state.plate.width-viewW)/2);
    const maxY=Math.max(0,(state.plate.height-viewH)/2);
    state.plate.root.position.x=clamp(state.plate.root.position.x,-maxX,maxX);
    state.plate.root.position.y=clamp(state.plate.root.position.y,-maxY,maxY);
  }
  function addTownPlateActor(state,kind,path,u,v,depth){
    const T=three(),shadow=new T.Sprite(new T.SpriteMaterial({
      map:townActorShadowTexture(state),transparent:true,depthTest:false,depthWrite:false}));
    shadow.renderOrder=-980;
    const sprite=makeSprite(state,kind,path,1,1);
    sprite.material.depthTest=false;sprite.renderOrder=3;
    state.plate.root.add(shadow);state.plate.root.add(sprite);
    state.plate.actors.push({kind:kind==='guard'?'guard':'worker',sprite,shadow,u,v,depth});
  }
  function syncPlateActors(state,snapshot){
    if(!state.plate||state.kind!=='town')return;
    const actorKey=JSON.stringify([snapshot.workers||{},!!snapshot.garrison?.active]);
    if(actorKey===state.plate.actorKey)return;
    state.plate.actorKey=actorKey;
    for(const actor of state.plate.actors){
      state.plate.root.remove(actor.sprite,actor.shadow);
      actor.sprite.material.dispose();actor.shadow.material.dispose();
    }
    state.plate.actors.length=0;
    const specs=[['wood',0.20,0.49,0.44],['stone',0.79,0.50,0.43],['food',0.32,0.78,0.75]];
    for(const [key,u,v,depth] of specs){
      const count=Math.max(0,number(snapshot.workers?.[key],0));
      const visible=count>=16?3:count>=6?2:count>0?1:0;
      for(let i=0;i<visible;i++){
        addTownPlateActor(state,key,null,u+(i-1)*0.017,v+(i%2)*0.02,depth);
      }
    }
    if(snapshot.garrison?.active){
      addTownPlateActor(state,'guard','./assets/art/units/infantry_shield-idle.png',0.59,0.25,0.24);
    }
    sizePlate(state);
  }
  function enablePlate(state){
    if(state.disposed||!state.plate)return;
    state.plate.ready=true;state.plate.mesh.visible=true;
    if(state.kind==='town'){
      // 低多边形 GLB 仍在 3D 场景中供缺图回退，但全景可用时不直接露出。
      for(const child of state.scene.children){
        if(child!==state.camera&&!child.isLight)child.visible=false;
      }
      syncPlateActors(state,state.snapshot);
      syncPlateMarkers(state,state.snapshot);
    }else{
      for(const child of state.scene.children){
        if(child!==state.camera&&child!==state.unitGroup&&
          child!==state.effectGroup&&!child.isLight)child.visible=false;
      }
      state.scene.fog=null;
    }
    sizePlate(state);
  }
  function townPlatePath(era){
    return './assets/art/scene/'+(era==='daylight'?'town-daylight':'town-'+era)+'.png';
  }
  function syncTownPlateArt(state,requestedEra){
    const plate=state.plate;if(!plate||state.kind!=='town')return;
    let era=townEraIds.has(requestedEra)?requestedEra:'base';
    if(plate.missingEras.has(era))era=plate.missingEras.has('base')?'daylight':'base';
    if(plate.requestedEra===era)return;
    plate.requestedEra=era;
    loadTextureFor(state,townPlatePath(era),null,{linear:true,
      onReady:function(texture){
        if(state.disposed||state.plate!==plate||plate.requestedEra!==era)return;
        plate.mesh.material.map=texture;plate.mesh.material.needsUpdate=true;
        plate.artworkEra=era;syncTownReliefArt(state,texture);enablePlate(state);
      },
      onError:function(){
        if(state.disposed||state.plate!==plate||plate.requestedEra!==era)return;
        plate.missingEras.add(era);plate.requestedEra='';
        if(era!=='daylight')syncTownPlateArt(state,requestedEra);
      }
    });
  }
  function syncBattlePlateArt(state){
    const plate=state.plate;if(!plate||state.kind!=='battle')return;
    const selected=document.documentElement.dataset.theme==='dark'?'dark':'light';
    const theme=plate.missingThemes.has(selected)?'light':selected;
    if(plate.requestedTheme===theme)return;
    plate.requestedTheme=theme;
    loadTextureFor(state,'./assets/art/scene/battle-'+(theme==='dark'?'night':'daylight')+'.png',null,{
      linear:true,
      onReady:function(texture){
        if(state.disposed||state.plate!==plate||plate.requestedTheme!==theme)return;
        plate.mesh.material.map=texture;plate.mesh.material.needsUpdate=true;
        plate.artworkTheme=theme;enablePlate(state);
      },
      onError:function(){
        if(state.disposed||state.plate!==plate||plate.requestedTheme!==theme)return;
        plate.missingThemes.add(theme);plate.requestedTheme='';
        if(theme==='dark')syncBattlePlateArt(state);
      }
    });
  }
  function makeScenePlate(state,kind){
    const T=three(),rootGroup=new T.Group();
    rootGroup.position.z=-40;
    const material=new T.MeshBasicMaterial({color:0xffffff,depthTest:false,depthWrite:false,toneMapped:false});
    const plate=new T.Mesh(new T.PlaneGeometry(1,1),material);
    plate.visible=false;plate.renderOrder=-1000;rootGroup.add(plate);
    state.camera.add(rootGroup);state.scene.add(state.camera);
    const data={root:rootGroup,mesh:plate,aspect:kind==='town'?1024/525:768/1152,
      width:0,height:0,ready:false,hotspots:[],actors:[],markers:[],reliefs:[],
      requestedEra:'',artworkEra:'',missingEras:new Set(),
      requestedTheme:'',artworkTheme:'',missingThemes:new Set()};
    state.plate=data;
    if(kind==='town'){
      for(const id of Object.keys(plateSites)){
        const hit=new T.Mesh(new T.PlaneGeometry(1,1),
          new T.MeshBasicMaterial({transparent:true,opacity:0,depthTest:false,depthWrite:false,side:T.DoubleSide}));
        hit.userData.hotspot=id;rootGroup.add(hit);data.hotspots.push(hit);
      }
      for(const site of townSites){
        const marker=townMarker(state,site);rootGroup.add(marker);data.markers.push(marker);
      }
    }
    if(kind==='town')syncTownPlateArt(state,state.snapshot.era);
    else syncBattlePlateArt(state);
  }
  function flippedTexture(state,base,shared){
    if(!base)return null;
    if(shared&&state.mirroredTextures.has(base))return state.mirroredTextures.get(base);
    const clone=base.clone(),frameWidth=Math.abs(base.repeat.x)||1;
    clone.repeat.x=-frameWidth;clone.offset.x=frameWidth;
    clone.userData={...base.userData,hd2dMirrored:true};clone.needsUpdate=true;
    state.ownedTextures.add(clone);
    if(shared){
      state.mirroredTextures.set(base,clone);
      if(state.animatedTextures.has(base))state.animatedTextures.add(clone);
    }
    return clone;
  }
  function makeSprite(state,kind,path,width,height,mirror){
    const T=three(),material=new T.SpriteMaterial({map:spriteTexture(state,kind),transparent:true,alphaTest:0.08,depthWrite:false});
    const sprite=new T.Sprite(material);sprite.scale.set(width,height,1);
    sprite.renderOrder=2;
    if(mirror&&!path){material.map=flippedTexture(state,material.map,true);material.userData.hd2dPreferred=true;}
    loadTextureFor(state,path,material,{
      animate:path&&/-(idle|attack|hit|death)\.png$/i.test(path),
      idle:path&&/-idle\.png$/i.test(path),
      onReady:mirror?function(texture){
        if(material.userData.hd2dHighRes)return;
        material.map=flippedTexture(state,texture,true);
        material.userData.hd2dPreferred=true;material.needsUpdate=true;
      }:null
    });
    return sprite;
  }
  function loadedTexture(state,path){
    if(!path)return null;
    try{return state.loaded[new URL(path,document.baseURI).href]?.texture||null;}catch(e){return null;}
  }
  function shadowDisc(parent,x,z,radius,opacity){
    const T=three(),m=new T.Mesh(new T.CircleGeometry(radius,16),new T.MeshBasicMaterial({color:0x433d35,transparent:true,opacity:opacity||0.2,depthWrite:false}));
    m.rotation.x=-Math.PI/2;m.position.set(x,0.025,z);parent.add(m);return m;
  }
  function addTree(scene,x,z,s){
    const T=three(),g=new T.Group();g.position.set(x,0,z);scene.add(g);
    addCylinder(g,0.09*s,0.12*s,0.72*s,0x806345,0,0.36*s,0,5);
    const crown=mesh(new T.ConeGeometry(0.52*s,1.1*s,5),mat(0x729174),0,1.22*s,0);g.add(crown);
    shadowDisc(g,0,0,0.48*s,0.15);return g;
  }
  function addRock(scene,x,z,s){
    const T=three(),m=mesh(new T.DodecahedronGeometry(s,0),mat(0xaaa9a0),x,s*0.48,z);
    scene.add(m);return m;
  }
  function makeGround(state,kind){
    const T=three(),size=kind==='battle'?100:32;
    const ground=mesh(new T.PlaneGeometry(size,kind==='battle'?100:23),new T.MeshStandardMaterial({map:groundTexture(kind),roughness:1}),0,-0.025,0);
    state.ownedTextures.add(ground.material.map);
    if(kind==='town')loadTextureFor(state,'./assets/art/map/terrain.png',ground.material,{tile:[4,3]});
    ground.rotation.x=-Math.PI/2;ground.castShadow=false;ground.receiveShadow=true;state.scene.add(ground);
    return ground;
  }
  function distantBackdrop(state,kind){
    // 背景预模糊在贴图里，前景建筑、人物和 HTML HUD 始终保持锐利。
    const T=three(),c=document.createElement('canvas'),p=c.getContext('2d');
    c.width=256;c.height=80;
    p.clearRect(0,0,256,80);
    p.fillStyle=kind==='town'?'#9baa8d':'#bda57e';
    p.filter='blur(3px)';
    for(let i=0;i<25;i++){
      const x=i*12-12,y=37+(i%5)*3;
      p.fillRect(x,y,15,38-y);
    }
    p.fillStyle=kind==='town'?'#7f997f':'#a48a6c';
    for(let i=0;i<14;i++){
      const x=i*20-8,y=25+(i%4)*3;
      p.fillRect(x,y,9,38-y);
    }
    p.filter='none';
    const t=new T.CanvasTexture(c);t.magFilter=T.LinearFilter;t.minFilter=T.LinearFilter;
    t.colorSpace=T.SRGBColorSpace;state.ownedTextures.add(t);
    const sprite=new T.Sprite(new T.SpriteMaterial({map:t,transparent:true,opacity:kind==='town'?0.67:0.88,depthWrite:false}));
    sprite.scale.set(24,7.5,1);sprite.position.set(0,3.0,-11);
    state.scene.add(sprite);
    if(kind==='battle')loadTextureFor(state,'./assets/art/map/battle-backdrop.png',sprite.material,{linear:true});
  }
  function roof(parent,w,d,color,h){
    const T=three();
    const top=mesh(new T.ConeGeometry(Math.max(w,d)*0.79,h,4),mat(color),0,h*0.5,0);
    top.rotation.y=Math.PI/4;parent.add(top);return top;
  }
  function markHotspot(group,id){group.userData.hotspot=id;group.traverse(o=>{o.userData.hotspot=id;});}
  function makeTownSite(state,site,lv,buildingState){
    const T=three(),g=new T.Group();g.position.set(site.x,0,site.z);state.scene.add(g);
    if(state.plate?.ready)g.visible=false;
    const level=Math.max(0,number(lv,0));
    const built=site.id==='town'||level>0||site.id==='wood'||site.id==='stone'||site.id==='food';
    addBox(g,site.w+0.25,0.12,site.d+0.22,0xd2c5a8,0,0.07,0);
    const fallback=new T.Group();g.add(fallback);
    if(built){
      const h=site.h+Math.min(level,6)*0.055;
      addBox(fallback,site.w,h,site.d,site.body,0,0.13+h/2,0);
      const r=roof(fallback,site.w*1.14,site.d*1.12,site.roof,0.64);
      r.position.y=h+0.46;
      addBox(fallback,site.w*0.2,site.h*0.41,0.045,0x695846,0,0.22+site.h*0.2,site.d/2+0.024);
      const path=site.icon&&mapIconPath(site.icon,state.options);
      if(path){
        const badge=makeSprite(state,'guard',path,site.w*1.17,site.h*1.23);
        badge.position.set(0,site.h*0.9,site.d*0.64);fallback.add(badge);
      }
      if(site.id==='tech'){
        addCylinder(fallback,0.16,0.2,0.9,0x607e8a,-site.w*0.37,h+0.48,-site.d*0.25,6);
        addCylinder(fallback,0.16,0.2,0.9,0x607e8a,site.w*0.37,h+0.48,-site.d*0.25,6);
      }
      if(site.id==='defense'){
        addCylinder(fallback,0.1,0.13,0.8,0x7d8581,-0.38,h+0.3,0,6);
        addCylinder(fallback,0.1,0.13,0.8,0x7d8581,0.38,h+0.3,0,6);
      }
      const modelName=site.id==='defense'?'watch_tower':site.icon;
      loadStaticModel(state,modelName,function(model){
        if(state.disposed||state.townGroups[site.id]!==g){disposeObject(model);return;}
        const scale=site.w/2.8;
        model.scale.setScalar(scale);model.position.y=0.13;
        g.add(model);fallback.visible=false;markHotspot(model,site.id);
        g.userData.hasGlb=true;
        state.modelsLoaded++;
      });
    }else{
      addBox(fallback,site.w*0.82,0.12,site.d*0.75,0xb7ad91,0,0.17,0);
    }
    if(buildingState&&buildingState!=='idle'){
      for(const side of [-1,1]){
        addBox(g,0.055,0.85,0.055,0x8b6d49,side*site.w*0.52,0.48,site.d*0.37);
        addBox(g,0.055,0.85,0.055,0x8b6d49,side*site.w*0.52,0.48,-site.d*0.37);
      }
      addBox(g,site.w*1.08,0.055,0.055,0x8b6d49,0,0.84,site.d*0.37);
      addBox(g,site.w*1.08,0.055,0.055,0x8b6d49,0,0.84,-site.d*0.37);
    }
    shadowDisc(g,0,0,Math.max(site.w,site.d)*0.64,0.14);
    markHotspot(g,site.id);return g;
  }
  function road(state,x,z,w,d,angle){
    const T=three(),m=mesh(new T.BoxGeometry(w,0.026,d),mat(0xc8b28b),x,0.02,z);
    m.rotation.y=angle||0;m.castShadow=false;state.scene.add(m);
  }
  function townBuildingFor(site,snapshot){
    const b=snapshot.buildings||{};
    const keys={town:['town_hall'],wood:['lumber_mill'],stone:['quarry'],food:['farm'],army:['barracks'],tech:['academy'],defense:['arrow_tower']}[site.id]||[];
    for(const key of keys){if(b[key])return b[key];}
    return null;
  }
  function townLevelFor(site,snapshot){
    if(site.id==='town')return number(snapshot.townLevel,1);
    return number(townBuildingFor(site,snapshot)?.lv,0);
  }
  function buildTown(state,snapshot){
    const T=three();makeGround(state,'town');
    distantBackdrop(state,'town');
    const sky=new T.HemisphereLight(0xf8f0d8,0x7d8f74,1.3);state.scene.add(sky);
    const sun=new T.DirectionalLight(0xffe4ae,1.65);sun.position.set(-5,10,7);sun.castShadow=state.shadowEnabled;
    sun.shadow.mapSize.set(512,512);sun.shadow.camera.left=-10;sun.shadow.camera.right=10;
    sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;sun.shadow.camera.near=0.5;
    sun.shadow.camera.far=30;sun.shadow.bias=-0.0003;state.scene.add(sun);
    road(state,0,1.5,1.2,8.6);road(state,0,-1.5,7.5,0.8);road(state,0,2.25,7.4,0.7);
    for(let i=0;i<townSites.length;i++){
      const site=townSites[i],level=townLevelFor(site,snapshot),phase=townBuildingFor(site,snapshot)?.state||'idle';
      state.townGroups[site.id]=makeTownSite(state,site,level,phase);
      state.townLevels[site.id]=level+'|'+phase;
    }
    for(const [x,z,s] of [[-5.3,-3.5,1.1],[-5,-0.6,0.85],[-4.9,3.6,0.9],[5.1,-3.4,1.1],[5.5,-0.3,0.9],[5.3,3.4,1.0],[-2.1,-3.7,0.6],[2.4,-3.9,0.7]])addTree(state.scene,x,z,s);
    for(const [x,z,s] of [[-4.5,0.3,0.28],[4.7,0.4,0.24],[-2.3,3.7,0.22],[2.4,3.8,0.27]])addRock(state.scene,x,z,s);
    state.workerGroup=new T.Group();state.scene.add(state.workerGroup);
    state.workerSprites=[];updateTownWorkers(state,snapshot);
    state.workerKey=JSON.stringify(snapshot.workers||{});
    state.guardGroup=new T.Group();state.scene.add(state.guardGroup);
    state.guard=makeSprite(state,'guard','./assets/art/units/infantry-idle.png',0.8,1.14);state.guard.position.set(1.55,0.62,2.7);
    state.guardGroup.add(state.guard);shadowDisc(state.guardGroup,1.55,2.7,0.35,0.19);
    state.guardGroup.visible=!!(snapshot.garrison&&snapshot.garrison.active);
    state.warningBeacon=mesh(new T.IcosahedronGeometry(0.19,0),
      new T.MeshBasicMaterial({color:0xd65d4a}),0.1,2.38,3.36);
    state.warningBeacon.castShadow=false;state.warningBeacon.visible=false;state.scene.add(state.warningBeacon);
    state.camera.position.set(8.6,9.3,13.4);state.camera.lookAt(0,0.55,0);
    state.cameraTarget=new T.Vector3(0,0.55,0);
    state.raycaster=new T.Raycaster();state.pointer=new T.Vector2();
  }
  function buildCandidateTown(state){
    // Opt-in art review only. Production keeps its bright nine-era panorama
    // until a complete seven-site model passes phone-size visual review.
    const T=three(),cameraSpec=state.options.candidateCamera||{};
    const fallbackPosition=[6.87767,8.029235,10.454059];
    const fallbackTarget=[1.423337,1.282648,2.163474];
    const vector=(input,fallback)=>Array.isArray(input)&&input.length===3&&
      input.every(Number.isFinite)?input:fallback;
    state.candidateMode=true;
    state.candidateReady=false;
    state.candidatePickNodes=[];
    state.candidateError='';
    state.candidateSpan=(Number.isFinite(cameraSpec.width)&&cameraSpec.width>0?
      cameraSpec.width:22)/(9/5);
    state.scene.background=new T.Color(0xdde8cf);
    state.scene.add(new T.HemisphereLight(0xffffff,0x9f9b78,1.35));
    const sun=new T.DirectionalLight(0xffeed1,1.55);
    sun.position.set(-5,11,7);sun.castShadow=state.shadowEnabled;
    sun.shadow.mapSize.set(512,512);
    sun.shadow.camera.left=-15;sun.shadow.camera.right=15;
    sun.shadow.camera.top=15;sun.shadow.camera.bottom=-15;
    state.scene.add(sun);
    state.camera.position.fromArray(vector(cameraSpec.position,fallbackPosition));
    state.cameraTarget=new T.Vector3().fromArray(vector(cameraSpec.target,fallbackTarget));
    state.camera.lookAt(state.cameraTarget);
    state.raycaster=new T.Raycaster();state.pointer=new T.Vector2();
    const name=state.options.candidateModel;
    const url=new URL('./assets/art/models/candidates/'+name+'.glb',document.baseURI);
    if(url.origin!==location.origin){state.candidateError='cross-origin-model';return;}
    fetch(url.href).then(response=>{
      if(!response.ok)throw Error('Model HTTP '+response.status);
      return response.arrayBuffer();
    }).then(buffer=>{
      if(state.disposed)return;
      const model=parseStaticGlb(buffer,state),sites=new Set(townSites.map(site=>site.id));
      model.traverse(node=>{
        const id=typeof node.name==='string'&&node.name.startsWith('PICK_')?
          node.name.slice(5):'';
        if(!sites.has(id))return;
        let meshes=0;node.traverse(child=>{if(child.isMesh)meshes++;});
        if(!meshes||state.townGroups[id])return;
        markHotspot(node,id);state.townGroups[id]=node;
        state.candidatePickNodes.push(id);
      });
      state.scene.add(model);state.candidateReady=true;state.modelsLoaded=1;
    }).catch(error=>{if(!state.disposed)state.candidateError=error.message||'model-load-failed';});
  }
  function updateTownWorkers(state,snapshot){
    for(const s of state.workerSprites){state.workerGroup.remove(s);if(s.material)s.material.dispose();}
    state.workerSprites.length=0;
    const specs=[['wood',-3.65,-0.4],['stone',3.3,-0.45],['food',-3.15,3.1]];
    for(const [key,x,z] of specs){
      const count=Math.max(0,number((snapshot.workers||{})[key],0));
      const visible=count>=16?3:count>=6?2:count>0?1:0;
      for(let i=0;i<visible;i++){
        const sprite=makeSprite(state,key,null,0.46,0.68);
        sprite.position.set(x+(i-1)*0.37,0.37,z+(i%2)*0.22);
        state.workerGroup.add(sprite);state.workerSprites.push(sprite);
      }
    }
  }
  function disposeObject(object){
    object.traverse(function(child){
      if(child.geometry)child.geometry.dispose();
      if(child.material){
        const arr=Array.isArray(child.material)?child.material:[child.material];
        for(const material of arr)material.dispose();
      }
    });
  }
  function updateTown(snapshot){
    const state=live.town;if(!state||!snapshot)return false;
    state.snapshot=snapshot;
    // A candidate preview is a static art review; the running game never uses
    // this path until a complete era model has passed the visual gate.
    if(state.candidateMode)return true;
    syncTownPlateArt(state,snapshot.era);
    for(const site of townSites){
      const lv=townLevelFor(site,snapshot),phase=townBuildingFor(site,snapshot)?.state||'idle';
      const signature=lv+'|'+phase;
      if(state.townLevels[site.id]===signature)continue;
      const prev=state.townGroups[site.id];if(prev){
        if(prev.userData.hasGlb)state.modelsLoaded--;
        state.scene.remove(prev);disposeObject(prev);
      }
      state.townGroups[site.id]=makeTownSite(state,site,lv,phase);state.townLevels[site.id]=signature;
    }
    const workerKey=JSON.stringify(snapshot.workers||{});
    if(workerKey!==state.workerKey){updateTownWorkers(state,snapshot);state.workerKey=workerKey;}
    if(state.guardGroup)state.guardGroup.visible=!!(snapshot.garrison&&snapshot.garrison.active);
    if(state.warningBeacon)state.warningBeacon.visible=/^(warning|spawn|sortie|battle)$/.test(snapshot.garrison?.phase||'');
    const wasExpanded=state.expanded;
    state.expanded=!!snapshot.expanded;
    state.renderer.domElement.style.touchAction=state.expanded?'none':'pan-y';
    if(state.plate?.ready){
      if(wasExpanded&&!state.expanded){
        state.plate.root.position.x=0;state.plate.root.position.y=0;
        state.camera.zoom=1;state.camera.updateProjectionMatrix();
        state.pointers?.clear();state.down=null;state.pinchDistance=0;
      }
      syncPlateActors(state,snapshot);
      syncPlateMarkers(state,snapshot);
      if(wasExpanded!==state.expanded)sizePlate(state);
    }
    return true;
  }
  function countBadge(state,unit){
    const T=three(),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    const compact=state.density>=7;
    canvas.width=compact?128:160;canvas.height=compact?40:44;
    const texture=new T.CanvasTexture(canvas);texture.magFilter=T.NearestFilter;texture.minFilter=T.NearestFilter;
    texture.colorSpace=T.SRGBColorSpace;
    state.ownedTextures.add(texture);
    const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:false,toneMapped:false}));
    sprite.scale.set(2.05,0.64,1);sprite.renderOrder=5;
    sprite.userData.badge={canvas,ctx,texture,compact};drawBadge(sprite,unit);
    return sprite;
  }
  function visiblePortraitTop(texture){
    if(!texture?.image)return 0.12;
    if(Number.isFinite(texture.userData.hd2dVisibleTop))return texture.userData.hd2dVisibleTop;
    let top=0.12;
    try{
      // Anchor the bar to the head/body, not a raised spear or bow at the edge.
      // A short continuous opaque run in the central third excludes thin tips.
      const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(texture.image,0,0,256,256);
      const rgba=ctx.getImageData(0,0,256,256).data;
      top=portraitHeadTop(rgba,256);
    }catch(_){/* 贴图不可读时维持安全的默认边距。 */}
    texture.userData.hd2dVisibleTop=top;
    return top;
  }
  function portraitHeadTop(rgba,size){
    const left=Math.floor(size*0.34),right=Math.ceil(size*0.66);
    const minRun=Math.max(6,Math.round(size*0.045));
    let first=null;
    for(let y=0;y<size;y++){
      let run=0;
      for(let x=0;x<size;x++){
        const opaque=rgba[(y*size+x)*4+3]>=96;
        if(opaque&&first===null)first=y/size;
        if(x<left||x>=right)continue;
        run=opaque?run+1:0;
        if(run>=minRun)return y/size;
      }
    }
    return first??0.12;
  }
  function visibleActionFrameTops(texture){
    if(!texture?.image)return null;
    if(Array.isArray(texture.userData.hd2dFrameTops))return texture.userData.hd2dFrameTops;
    const frames=texture.userData.hd2dFrames||1,side=texture.image.height;
    const tops=[];
    try{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.imageSmoothingEnabled=false;
      for(let frame=0;frame<frames;frame++){
        ctx.clearRect(0,0,128,128);
        ctx.drawImage(texture.image,frame*side,0,side,side,0,0,128,128);
        const rgba=ctx.getImageData(0,0,128,128).data;
        tops.push(portraitHeadTop(rgba,128));
      }
    }catch(_){for(let frame=0;frame<frames;frame++)tops.push(0.12);}
    texture.userData.hd2dFrameTops=tops;
    return tops;
  }
  function drawBadge(sprite,unit){
    const b=sprite.userData.badge,ctx=b.ctx;
    const ratio=unit.maxHp>0?clamp(number(unit.hp,0)/number(unit.maxHp,1),0,1):1;
    const width=b.canvas.width,height=b.canvas.height;
    const barWidth=b.compact?68:100;
    const count='×'+Math.max(0,Math.floor(number(unit.count,0)));
    ctx.clearRect(0,0,width,height);
    const lineY=Math.round(height/2)-3;
    ctx.fillStyle='#29050b';ctx.fillRect(5,lineY,barWidth,6);
    ctx.fillStyle='#a9001b';
    ctx.fillRect(5,lineY,Math.round(barWidth*ratio),6);
    // Compact world badges shrink to roughly 30 CSS px on a 320px battlefield.
    // Draw their count larger within the same texture so it remains legible
    // without widening the badge or separating the red line from the head.
    ctx.font='bold '+(b.compact?28:20)+'px sans-serif';ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.strokeStyle='#fff9ea';ctx.lineWidth=3;
    ctx.strokeText(count,(barWidth+5+width)/2,height/2,width-barWidth-10);
    ctx.fillStyle='#28383a';
    ctx.fillText(count,(barWidth+5+width)/2,height/2,width-barWidth-10);
    b.texture.needsUpdate=true;
  }
  const battleDepthOffset=6.2;
  function sparseBattleFraming(density,stageHeight){
    if(density>2)return 1;
    const tall=clamp((number(stageHeight,440)-440)/195,0,1);
    return 1+0.25*tall;
  }
  function battlePosition(side,index,row,density,stageHeight,slot){
    if(density>=7){
      // 三线各四列；纵向六条等距扫描线让满编相邻立绘露出脸和武器。
      const lane=slot?.row||row,column=slot?.column??index%4;
      const stretch=clamp((number(stageHeight,400)-340)/300,0,1);
      const rowGap=6.4+1.7*stretch;
      const depth=1.3+(lane==='front'?rowGap:lane==='back'?-rowGap:0);
      return {x:(side==='allies'?1:-1)*(1.25+column*1.27),
        z:depth+(column%2?-rowGap/4:rowGap/4)};
    }
    if(density>=4){
      // Six squads still have room for two clear portrait columns per side.
      // Keep the visual slot tied to the squad so losses do not reshuffle art.
      const lane=slot?.row||row,column=slot?.column??index%2;
      const stretch=clamp((number(stageHeight,440)-440)/240,0,1);
      const depth=lane==='front'?6.1+3*stretch:
        lane==='mid'?1.0:-4.1-3*stretch;
      return {x:(side==='allies'?1:-1)*(1.75+column*2.75),z:depth};
    }
    const column=index%4,line=Math.floor(index/4);
    const near=side==='allies'?1:-1;
    const gap=density<=2?2.5:density===3?1.4:1.0;
    const x=(near*(density<=2?2.16:1.95)+near*column*gap)/
      sparseBattleFraming(density,stageHeight);
    const depth=row==='front'?0.45:row==='mid'?-0.55:-1.42;
    const tall=clamp((number(stageHeight,440)-440)/195,0,1);
    // 高屏保留一点前后层次，同时让少量编队聚在战场中段。
    // 旧偏移使第二团比第一团退后约 8 个世界单位，1v2 画面被拉得过散。
    const spread=index%2?-0.8*tall:0.8*tall;
    const stagger=density<=2?7.2:3.2;
    return {x,z:depth+battleDepthOffset-2.5*tall-(index%2)*stagger+line*2.2+spread};
  }
  function battleLayoutStatus(state){
    if(!state.camera||!state.width||!state.height)return [];
    const T=three(),width=state.width,height=state.height,camera=state.camera;
    camera.updateMatrixWorld(true);
    const pixelsPerUnit=width/(camera.right-camera.left)*camera.zoom;
    return Object.values(state.units).filter(model=>model.group.visible&&!model.pendingRemoval).map(model=>{
      const center=new T.Vector3(model.group.position.x+model.badge.position.x,
        model.badge.position.y,
        model.group.position.z).project(camera);
      const bx=(center.x+1)*width/2,by=(1-center.y)*height/2;
      const bw=model.badge.scale.x*pixelsPerUnit,bh=model.badge.scale.y*pixelsPerUnit;
      const imageCenter=new T.Vector3(model.group.position.x+model.sprite.position.x,
        model.sprite.position.y,model.group.position.z).project(camera);
      const sx=(imageCenter.x+1)*width/2,sy=(1-imageCenter.y)*height/2;
      const sw=model.sprite.scale.x*pixelsPerUnit,sh=model.sprite.scale.y*pixelsPerUnit;
      return {id:model.id,type:model.type,side:model.side,facing:model.face<0?'left':'right',
        portraitReady:!!model.hiresIdle,
        portraitActionsReady:['attack','hit','death'].every(kind=>
          !!loadedTexture(state,model.hiresActionPaths[kind])),
        portraitActionCellPx:loadedTexture(state,model.hiresActionPaths.attack)?.image?.height||0,
        portraitAction:model.action?.kind||'idle',
        portraitActionReady:!!model.hiresActionActive,
        portraitActionFrames:model.hiresActionActive?
          model.sprite.material.map?.userData.hd2dFrames||1:1,
        portraitTopFraction:Number.isFinite(model.actionVisibleTopFraction)?
          model.actionVisibleTopFraction:
          Number.isFinite(model.visibleTopFraction)?model.visibleTopFraction:null,
        followersVisible:model.followers.filter(follower=>follower.visible).length,
        index:model.index,row:model.row,
        slotRow:model.slot.row,slotColumn:model.slot.column,
        x:model.group.position.x,z:model.group.position.z,
        badgeRect:{left:bx-bw/2,top:by-bh/2,right:bx+bw/2,bottom:by+bh/2},
        spriteRect:{left:sx-sw/2,top:sy-sh/2,right:sx+sw/2,bottom:sy+sh/2}};
    });
  }
  function keepSparseSpriteInside(state,model){
    if(state.density>2||!state.width||!state.height||!state.camera)return;
    const T=three(),camera=state.camera;
    camera.updateMatrixWorld(true);
    const pixelsPerUnit=state.width/(camera.right-camera.left)*camera.zoom;
    const viewHalfWidth=(camera.right-camera.left)/(2*camera.zoom);
    const xLimit=Math.max(0,viewHalfWidth-model.sprite.scale.x/2-12/pixelsPerUnit);
    model.group.position.x=clamp(model.group.position.x,-xLimit,xLimit);
    const screenY=z=>{
      const point=new T.Vector3(model.group.position.x+model.sprite.position.x,
        model.sprite.position.y,z).project(camera);
      return (1-point.y)*state.height/2;
    };
    const pixelsPerDepth=screenY(model.group.position.z+1)-screenY(model.group.position.z);
    if(Math.abs(pixelsPerDepth)<0.001)return;
    const centerY=screenY(model.group.position.z);
    const halfHeight=model.sprite.scale.y*pixelsPerUnit/2;
    const badgeCenter=new T.Vector3(model.group.position.x+model.badge.position.x,
      model.badge.position.y,
      model.group.position.z).project(camera);
    const badgeY=(1-badgeCenter.y)*state.height/2;
    const top=Math.min(centerY-halfHeight,badgeY-model.badge.scale.y*pixelsPerUnit/2);
    const bottom=Math.max(centerY+halfHeight,badgeY+model.badge.scale.y*pixelsPerUnit/2);
    if(top<8)model.group.position.z+=(8-top)/pixelsPerDepth;
    else if(bottom>state.height-8)model.group.position.z-=(bottom-state.height+8)/pixelsPerDepth;
  }
  function placeBattleBadge(state,model,density){
    // The badge texture also reserves space for the count on the right.
    // Center its red segment over the portrait instead of the whole texture.
    const badgeX=model.sprite.position.x;
    if(density>=7){
      model.badge.scale.set(1.24,0.52,1);
    }else{
      model.badge.scale.set(density>=4?1.72:density===3?1.9:2.05,
        density>=4?0.56:0.64,1);
    }
    const badgeData=model.badge.userData.badge;
    const barWidth=badgeData.compact?68:100;
    const barCenter=5+barWidth/2;
    const barOffset=(badgeData.canvas.width/2-barCenter)/badgeData.canvas.width*
      model.badge.scale.x;
    const centeredBadgeX=badgeX+barOffset;
    // The line sits at the badge canvas center. Start with a safe position until
    // the high-res portrait is ready and its nontransparent top can be measured.
    const portraitTop=model.baseY+model.sprite.scale.y/2;
    model.badge.position.set(centeredBadgeX,portraitTop+model.badge.scale.y/2+
      (density>=7?0.18:-0.25),0);
    const visibleTopFraction=Number.isFinite(model.actionVisibleTopFraction)?
      model.actionVisibleTopFraction:model.visibleTopFraction;
    if(!Number.isFinite(visibleTopFraction)||
      !state.width||!state.height)return;
    const T=three(),camera=state.camera;
    camera.updateMatrixWorld(true);
    const pixelsPerUnit=state.width/(camera.right-camera.left)*camera.zoom;
    const spriteCenter=new T.Vector3(model.group.position.x+model.sprite.position.x,
      model.sprite.position.y,model.group.position.z).project(camera);
    const spriteTopPx=(1-spriteCenter.y)*state.height/2-
      model.sprite.scale.y*pixelsPerUnit/2;
    const visibleTopPx=spriteTopPx+visibleTopFraction*
      model.sprite.scale.y*pixelsPerUnit;
    // The head anchor excludes raised weapons. Keep a narrow gap above the
    // helmet edge; a deeper overlap cuts through the portrait at phone scale.
    const desiredLinePx=visibleTopPx+(density>=7?4:5);
    const badgePoint=new T.Vector3(model.group.position.x+centeredBadgeX,model.badge.position.y,
      model.group.position.z).project(camera);
    const raisedPoint=new T.Vector3(model.group.position.x+centeredBadgeX,model.badge.position.y+1,
      model.group.position.z).project(camera);
    const linePx=(1-badgePoint.y)*state.height/2;
    const pixelsPerWorldY=(raisedPoint.y-badgePoint.y)*state.height/2;
    if(pixelsPerWorldY>0.001)
      model.badge.position.y+=(linePx-desiredLinePx)/pixelsPerWorldY;
  }
  function allocateBattleSlot(state,side,row,index){
    if(state.density<4)return {row,column:index%4};
    const requested=['front','mid','back'].includes(row)?row:'front';
    const priorities=requested==='front'?['front','mid','back']:
      requested==='back'?['back','mid','front']:['mid','front','back'];
    const used=state.slotUsage[side];
    const capacity=state.density<7?2:4;
    for(const lane of priorities)if(used[lane]<capacity)return {row:lane,column:used[lane]++};
    return null;
  }
  function createBattleUnit(state,unit,side,index){
    const slot=allocateBattleSlot(state,side,unit.row,index);
    if(!slot)return null;
    const T=three(),pos=battlePosition(side,index,unit.row,state.density,
      state.height||state.container.clientHeight,slot),g=new T.Group();
    g.position.set(pos.x,0,pos.z);state.unitGroup.add(g);
    const scale=state.heroScale||1,face=side==='allies'?-1:1;
    shadowDisc(g,0,0,0.64*Math.min(scale,1.6),0.25);
    const icon=iconPath(unit,state.options);
    const sprite=makeSprite(state,side==='allies'?'infantry':'enemy',icon,2.1*scale,2.1*scale,face<0);
    sprite.visible=false;
    sprite.position.set(0,1.15*scale,0);g.add(sprite);
    const followers=[];
    for(let i=0;i<2;i++){
      const escortScale=Math.min(scale,1.65);
      const follower=makeSprite(state,side==='allies'?'infantry':'enemy',icon,0.96*escortScale,0.96*escortScale,face<0);
      follower.position.set((i===0?-1:1)*0.56,0.56*escortScale,-0.28-i*0.13);
      follower.material.opacity=0.88;follower.userData.artReady=false;
      follower.visible=false;g.add(follower);followers.push(follower);
    }
    const soloEnemyArt=side==='enemies'&&typeof CFG!=='undefined'&&
      !!CFG.units?.[unit.type]?.enemyOnly;
    const badge=countBadge(state,unit);
    g.add(badge);
    badge.visible=state.options.showWorldBadges!==false;
    const key=side+':'+String(unit.id==null?index:unit.id);
    const type=typeof unit.type==='string'&&/^[a-z0-9_]+$/.test(unit.type)?unit.type:null;
    const actionPaths={idle:icon};
    if(type)for(const action of ['attack','hit','death']){
      const path=state.options.actionSpritePaths?.[type]?.[action]||'./assets/art/units/'+type+'-'+action+'.png';
      actionPaths[action]=path;
    }
    const hiresActionKey=side==='enemies'&&type==='infantry'?'enemy':type;
    const hiresActionPaths={};
    if(hiresActionKey&&(hiresActionTypes.has(hiresActionKey)||state.options.hiresActionPaths?.[hiresActionKey]))
      for(const action of ['attack','hit','death'])
        hiresActionPaths[action]=state.options.hiresActionPaths?.[hiresActionKey]?.[action]||
          './assets/art/units/hires/actions/'+(state.density>=7?'compact/':'')+
          hiresActionKey+'-'+action+'.png';
    const model={key,id:unit.id,type:unit.type,side,face,row:unit.row,slot,group:g,sprite,followers,badge,count:unit.count,hp:unit.hp,index,baseY:1.15*scale,heroScale:scale,soloEnemyArt,
      actionPaths,hiresActionPaths,actionTextures:{},action:null,pendingRemoval:false,kind:side==='allies'?'infantry':'enemy',hiresIdle:null,hiresActionActive:false,actionVisibleTopFraction:null};
    placeBattleBadge(state,model,state.density);
    state.units[key]=model;
    loadTextureFor(state,icon,null,{onReady:function(){
      if(state.disposed||state.units[key]!==model)return;
      if(!model.hiresIdle)model.sprite.visible=true;
      for(const follower of model.followers)follower.userData.artReady=true;
      model.followers[0].visible=!model.soloEnemyArt&&state.density<7&&number(model.count,0)>=3;
      model.followers[1].visible=!model.soloEnemyArt&&state.density<7&&number(model.count,0)>=20;
    }});
    const hires=hiresIconPath(unit,state.options,side);
    if(hires)loadTextureFor(state,hires,null,{pixelArt:true,onReady:function(texture){
      if(state.disposed||state.units[key]!==model)return;
      model.visibleTopFraction=idleBadgeHeadTops[model.type]??visiblePortraitTop(texture);
      model.hiresIdle=model.face<0?flippedTexture(state,texture,true):texture;
      model.sprite.material.userData.hd2dPreferred=true;
      model.sprite.material.userData.hd2dHighRes=true;
      for(const follower of model.followers){
        follower.material.userData.hd2dPreferred=true;
        follower.material.map=model.hiresIdle;
        follower.material.needsUpdate=true;
      }
      model.sprite.visible=true;
      applyUnitActionTexture(state,model,model.action?.kind||'idle');
    }});
    if(type&&root.UNIT_VFX_PROFILES?.[type])
      loadTextureFor(state,unitVfxPath(type),null,{pixelArt:true});
    for(const action of ['attack','hit','death'])if(actionPaths[action])
      loadTextureFor(state,actionPaths[action],null,{animate:true,idle:false});
    for(const action of ['attack','hit','death'])if(hiresActionPaths[action])
      loadTextureFor(state,hiresActionPaths[action],null,{animate:true,pixelArt:true,
        onReady:function(texture){
          visibleActionFrameTops(texture);
          if(!state.disposed&&state.units[key]===model&&model.action?.kind===action)
            applyUnitActionTexture(state,model,action);
        }});
    return model;
  }
  function applyUnitActionTexture(state,model,kind){
    if(model.hiresIdle){
      // 有高清关键帧时使用同角色动作图集；缺图时保留可用的高清立绘。
      const factor=model.heroScale||1;
      const enemyOnly=model.side==='enemies'&&typeof CFG!=='undefined'&&
        !!CFG.units?.[model.type]?.enemyOnly;
      const wild=enemyOnly&&model.type.startsWith('wild_');
      // This ranger's authored silhouette fills almost the full 512px cell,
      // while the starter soldier uses only its center. Match sparse battle
      // body proportions without shrinking the already compact 12v12 art.
      const rangerScale=model.type==='archer_t1'?
        (state.density<=2?0.83:state.density<7?0.92:1):1;
      const pack=(wild?(state.density<=2?0.60:state.density<7?0.75:0.72):
        enemyOnly?(state.density<=2?0.80:state.density<7?0.88:0.82):1)*rangerScale;
      model.portraitPack=pack;
      model.sprite.scale.set(3.0*factor*pack,3.0*factor*pack,1);
      model.baseY=1.15*factor-1.5*factor*(1-pack);
      model.sprite.position.y=model.baseY;
      const source=kind==='idle'?null:loadedTexture(state,model.hiresActionPaths[kind]);
      model.hiresActionActive=!!source;
      model.actionVisibleTopFraction=source?
        actionBadgeHeadTops[model.type]?.[kind]?.[0]??visibleActionFrameTops(source)?.[0]:null;
      if(source&&!model.actionTextures[kind]){
        const clone=model.face<0?flippedTexture(state,source,false):source.clone();
        clone.needsUpdate=true;model.actionTextures[kind]=clone;state.ownedTextures.add(clone);
      }
      const art=source?model.actionTextures[kind]:model.hiresIdle;
      if(model.sprite.material.map!==art){
        model.sprite.material.map=art;model.sprite.material.needsUpdate=true;
      }
      placeBattleBadge(state,model,state.density);
      keepSparseSpriteInside(state,model);
      return true;
    }
    const path=model.actionPaths[kind],source=loadedTexture(state,path);
    const base=kind==='idle'&&model.face<0?flippedTexture(state,source,true):source;
    if(!base)return false;
    const factor=model.heroScale||1;
    model.sprite.scale.set(2.1*factor,2.1*factor,1);model.baseY=1.15*factor;
    model.sprite.position.y=model.baseY;
    placeBattleBadge(state,model,state.density);
    if(kind==='idle'){
      if(model.sprite.material.map!==base){model.sprite.material.map=base;model.sprite.material.needsUpdate=true;}
      return true;
    }
    if(!model.actionTextures[kind]){
      const clone=model.face<0?flippedTexture(state,base,false):base.clone();clone.needsUpdate=true;
      model.actionTextures[kind]=clone;state.ownedTextures.add(clone);
    }
    if(model.sprite.material.map!==model.actionTextures[kind]){
      model.sprite.material.map=model.actionTextures[kind];model.sprite.material.needsUpdate=true;
    }
    return true;
  }
  function startUnitAction(state,model,kind,duration){
    if(!model)return;
    model.action={kind,start:performance.now(),duration:clamp(number(duration,420),160,1100)};
    model.sprite.material.opacity=1;
    applyUnitActionTexture(state,model,kind);
  }
  function removeUnit(state,model){
    state.unitGroup.remove(model.group);
    disposeObject(model.group);
    delete state.units[model.key];
  }
  function addDune(scene,x,z,w,h,color){
    const T=three(),m=mesh(new T.SphereGeometry(1,8,5),mat(color),x,h*0.05,z);
    m.scale.set(w,h,w*0.7);m.castShadow=false;scene.add(m);
  }
  function battleGroundDetail(state){
    const T=three(),rand=seeded(50719),dummy=new T.Object3D();
    const stones=new T.InstancedMesh(new T.DodecahedronGeometry(0.095,0),mat(0xa78f6d),96);
    const grass=new T.InstancedMesh(new T.ConeGeometry(0.06,0.26,3),mat(0x8c986f),60);
    for(let i=0;i<96;i++){
      const x=(rand()-0.5)*19,z=1.6+rand()*7.2,s=0.55+rand()*1.25;
      dummy.position.set(x,0.04*s,z);dummy.rotation.set(0,rand()*Math.PI,0);
      dummy.scale.setScalar(s);dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);
    }
    for(let i=0;i<60;i++){
      const x=(rand()-0.5)*19,z=0.8+rand()*7.4,s=0.52+rand()*1.2;
      dummy.position.set(x,0.11*s,z);dummy.rotation.set(0,rand()*Math.PI,0);
      dummy.scale.setScalar(s);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
    }
    stones.instanceMatrix.needsUpdate=true;grass.instanceMatrix.needsUpdate=true;
    stones.castShadow=false;grass.castShadow=false;
    state.scene.add(stones,grass);
  }
  function battleRuins(state){
    const T=three(),parent=new T.Group();state.scene.add(parent);
    for(const side of [-1,1]){
      const x=side*6.0,z=-4.8;
      addBox(parent,2.3,0.2,1.35,0xb4a080,x,0.1,z);
      for(const offset of [-0.85,0.82]){
        addCylinder(parent,0.16,0.21,1.8,0x9c947e,x+offset,1.05,z,6);
        addBox(parent,0.53,0.17,0.52,0xc7b99a,x+offset,2.0,z);
      }
      addBox(parent,2.3,0.21,0.48,0xa7a08b,x,2.02,z);
      for(let i=0;i<4;i++){
        const rx=x+side*(1.15+i*0.3),rz=z+1.4+(i%2)*0.4;
        addRock(parent,rx,rz,0.13+i*0.025);
      }
    }
  }
  function buildBattle(state,snapshot){
    const T=three();makeGround(state,'battle');
    distantBackdrop(state,'battle');
    battleGroundDetail(state);
    state.scene.fog=new T.Fog(0xe3d5b6,17,37);
    const sky=new T.HemisphereLight(0xfff3d2,0xb5a38b,1.25);state.scene.add(sky);
    const sun=new T.DirectionalLight(0xffe0aa,1.8);sun.position.set(-6,10,7);
    sun.castShadow=state.shadowEnabled;sun.shadow.mapSize.set(512,512);
    sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=9;
    sun.shadow.camera.bottom=-9;sun.shadow.camera.near=0.5;sun.shadow.camera.far=35;
    sun.shadow.bias=-0.0003;state.scene.add(sun);
    addDune(state.scene,-7,-6,4.5,1.5,0xc6aa78);
    addDune(state.scene,5.7,-7,5.1,1.7,0xc7ab79);
    addDune(state.scene,-0.3,-8.2,5.7,1.3,0xd2ba8d);
    battleRuins(state);
    state.battleDecor=new T.Group();state.scene.add(state.battleDecor);
    for(const [x,z,s] of [[-7,1.4,0.48],[-5.7,-3.5,0.35],[6.7,-3,0.5],[5.6,2.3,0.33],[-2.7,-4.2,0.24]])addRock(state.battleDecor,x,z,s);
    for(const x of [-5.8,6.1]){
      addCylinder(state.battleDecor,0.055,0.07,1.9,0x6d5b48,x,0.95,-4.25,5);
      const flag=addBox(state.battleDecor,0.72,0.42,0.02,x<0?0x9f5f56:0x547f8c,x+0.38,1.57,-4.25);
      flag.castShadow=false;
    }
    loadStaticModel(state,'battle_props',function(model){
      if(state.disposed){disposeObject(model);return;}
      state.scene.add(model);model.visible=!state.plate?.ready;
      state.battleDecor.visible=false;state.modelsLoaded++;
    });
    state.unitGroup=new T.Group();state.scene.add(state.unitGroup);
    state.effectGroup=new T.Group();state.scene.add(state.effectGroup);
    state.units={};state.effects=[];
    for(const path of Object.values(battleVfxFiles))loadTextureFor(state,path,null);
    state.slotUsage={allies:{front:0,mid:0,back:0},enemies:{front:0,mid:0,back:0}};
    state.hiddenUnits={allies:0,enemies:0};
    const notice=document.createElement('div');
    notice.className='hd2d-overflow-summary';notice.setAttribute('role','status');
    notice.style.cssText='display:none;position:absolute;z-index:6;top:6px;left:6px;right:6px;padding:5px 8px;border:1px solid #c9965e;border-radius:7px;background:rgba(255,249,226,.96);color:#553b2b;text-align:center;font:700 11px/1.35 sans-serif;pointer-events:none;';
    if(getComputedStyle(state.container).position==='static'){
      state.containerPosition=state.container.style.position;
      state.container.style.position='relative';
    }
    state.container.appendChild(notice);state.overflowNotice=notice;
    state.camera.position.set(0,14.0,16.5);state.camera.lookAt(0,0.56,-0.25);
    state.cameraTarget=new T.Vector3(0,0.56,-0.25);
    updateBattle(snapshot);
  }
  function updateBattle(snapshot){
    const state=live.battle;if(!state||!snapshot)return false;
    if(state.epoch!==snapshot.epoch){
      state.epoch=snapshot.epoch;
      state.lastAcceptedEvent=null;
      for(const m of Object.values(state.units)){
        state.unitGroup.remove(m.group);disposeObject(m.group);
      }
      state.units={};
      clearEffects(state);
      state.density=0;
      state.slotUsage={allies:{front:0,mid:0,back:0},enemies:{front:0,mid:0,back:0}};
    }
    if(!state.density){
      state.density=clamp(Math.max(snapshot.allies?.length||0,snapshot.enemies?.length||0),1,12);
      state.heroScale=state.density===1?2.1:state.density===2?2.05:state.density===3?1.6:
        state.density<=6?1.10:0.86;
    }
    const zoom=sparseBattleFraming(state.density,state.height||state.container.clientHeight);
    if(state.camera.zoom!==zoom){
      state.camera.zoom=zoom;state.camera.updateProjectionMatrix();
      if(state.plate&&state.width&&state.height)sizePlate(state);
    }
    state.snapshot=snapshot;
    const incoming=new Set();
    const hidden={allies:0,enemies:0};
    for(const side of ['allies','enemies']){
      const arr=Array.isArray(snapshot[side])?snapshot[side]:[];
      hidden[side]=Math.max(0,arr.length-12);
      arr.slice(0,12).forEach(function(unit,index){
        const key=side+':'+String(unit.id==null?index:unit.id);
        let model=state.units[key];
        if(!model)model=createBattleUnit(state,unit,side,index);
        if(!model){hidden[side]++;return;}
        incoming.add(key);
        if(model.pendingRemoval&&number(unit.count,0)>0){model.pendingRemoval=false;model.action=null;applyUnitActionTexture(state,model,'idle');}
        model.row=unit.row;
        // The visual slot belongs to the id for the whole battle, even after rank promotion.
        const pos=battlePosition(side,model.index,model.slot.row,state.density,
          state.height||state.container.clientHeight,model.slot);
        model.group.position.set(pos.x,0,pos.z);
        placeBattleBadge(state,model,state.density);
        keepSparseSpriteInside(state,model);
        model.group.visible=true;
        model.followers[0].visible=model.followers[0].userData.artReady&&
          !model.soloEnemyArt&&state.density<7&&number(unit.count,0)>=3;
        model.followers[1].visible=model.followers[1].userData.artReady&&
          !model.soloEnemyArt&&state.density<7&&number(unit.count,0)>=20;
        if(number(unit.count,0)<=0&&!model.pendingRemoval){
          model.pendingRemoval=true;startUnitAction(state,model,'death',620);
        }
        if(model.count!==unit.count||model.hp!==unit.hp){drawBadge(model.badge,unit);model.count=unit.count;model.hp=unit.hp;}
      });
    }
    state.hiddenUnits=hidden;
    if(state.overflowNotice){
      const parts=[];
      if(hidden.enemies)parts.push('敌方另有 '+hidden.enemies+' 团参战');
      if(hidden.allies)parts.push('我方另有 '+hidden.allies+' 团参战');
      state.overflowNotice.textContent=parts.join(' · ')+(parts.length?'（画面未显示）':'');
      state.overflowNotice.style.display=parts.length?'block':'none';
    }
    for(const [key,model] of Object.entries(state.units)){
      if(incoming.has(key))continue;
      if(!model.pendingRemoval){model.pendingRemoval=true;startUnitAction(state,model,'death',620);}
    }
    return true;
  }
  function findUnit(state,id,side){
    if(id==null)return null;
    if(side&&state.units[side+':'+id])return state.units[side+':'+id];
    return state.units['allies:'+id]||state.units['enemies:'+id]||null;
  }
  function clearEffects(state){
    for(const e of state.effects||[]){state.effectGroup?.remove(e.mesh);disposeObject(e.mesh);}
    state.effects=[];
  }
  // 每个兵种有独立攻击图与轨迹配置；视觉层只读取兵种 ID，不参与伤害。
  const battleVfxFiles={
    swordqi:'./assets/art/vfx/hires/swordqi.png',
    arrow:'./assets/art/vfx/hires/arrow.png',
    thrust:'./assets/art/vfx/hires/thrust.png',
    cavslash:'./assets/art/vfx/hires/cavslash.png',
    magebolt:'./assets/art/vfx/hires/magebolt.png',
    beastbite:'./assets/art/vfx/hires/beastbite.png',
    'impact-spark':'./assets/art/vfx/hires/impact-spark.png',
    'impact-magic':'./assets/art/vfx/hires/impact-magic.png',
    dust:'./assets/art/vfx/hires/dust.png'
  };
  const legacyBattleVfxFiles={
    swordqi:'./assets/vfx-infantry-swordqi.png',
    arrow:'./assets/vfx-archer-arrow.png',
    thrust:'./assets/vfx-spearman-thrust.png',
    cavslash:'./assets/vfx-cavalry-slash.png',
    magebolt:'./assets/vfx-mage-bolt.png'
  };
  function unitVfxPath(type){
    return typeof type==='string'&&/^[a-z0-9_]+$/.test(type)&&root.UNIT_VFX_PROFILES?.[type]?
      './assets/art/vfx/units/'+type+'.png':null;
  }
  function vfxColor(hex,fallback){
    return typeof hex==='string'&&/^#[0-9a-f]{6}$/i.test(hex)?parseInt(hex.slice(1),16):fallback;
  }
  const enemyVfxProfiles={
    god_crystal_guard:{style:'magebolt',color:0xe2fbff,halo:0x88dbe7},
    phantom_god:{style:'magebolt',color:0xf4e8ff,halo:0xc1a3ea},
    guardian_god:{style:'thrust',color:0xfff0cf,halo:0xe3c776},
    slaughter_god:{style:'swordqi',color:0xffe0ce,halo:0xe38d80},
    wild_boar:{style:'cavslash',color:0xffe6ce,halo:0xd6a46c},
    wild_bull:{style:'cavslash',color:0xffefc6,halo:0xd8ac72},
    wild_snake:{style:'thrust',color:0xe5f4c8,halo:0x8eb47c},
    wild_tiger:{style:'swordqi',color:0xffedca,halo:0xe9b76c},
    wild_turtle:{style:'thrust',color:0xe5f2e0,halo:0x8bb8a3},
    wild_wyrm:{style:'magebolt',color:0xffe6d6,halo:0xeaa675}
  };
  function battleVfxProfile(unit){
    const type=unit?.type||'';
    const configured=root.UNIT_VFX_PROFILES?.[type];
    if(configured)return {
      unitType:type,style:configured.style,color:vfxColor(configured.accent,0xffffff),
      halo:vfxColor(configured.halo,0xffe7bd),trail:configured.trail,
      impact:configured.impact,impactShape:configured.impactShape,
      rank:clamp(number(configured.rank,1),1,5),art:unitVfxPath(type)
    };
    const cfg=typeof CFG!=='undefined'?CFG.units?.[type]:null;
    const base=cfg?.combatBase||cfg?.baseUnit||type,tag=cfg?.tag;
    if(enemyVfxProfiles[type])return {...enemyVfxProfiles[type]};
    if(type==='cavalry_wind')return {style:'arrow',color:0xf2d9ac,halo:0x77b5b5};
    if(type==='cavalry_dragon')return {style:'magebolt',color:0xffdfbc,halo:0xffa865};
    if(type==='electro_trooper'||type==='star_trooper')
      return {style:'magebolt',color:0xd5faff,halo:type==='star_trooper'?0xa5e5d7:0x74c7ff};
    if(type==='alloy_special'||type==='armored_trooper')
      return {style:'arrow',color:0xffeac4,halo:0xffbb72};
    if(type==='archer_assassin'||type==='archer_shadowblade')
      return {style:'swordqi',color:0xe9f8ff,halo:0x9accc9};
    if(base==='mage'||type.startsWith('mage_'))
      return {style:'magebolt',color:0xebf0ff,halo:tag==='time'?0x86d9e9:0xb9a2ee};
    if(tag==='spear'||base==='spearman'||type==='iron_spearman')
      return {style:'thrust',color:0xfff0d9,halo:0xffc481};
    if(base==='archer'||type.startsWith('archer_'))
      return {style:'arrow',color:0xffffff,halo:tag==='crossbow'?0xe5c183:0xffd78e};
    if(base==='cavalry'||type.startsWith('cavalry_'))
      return {style:'cavslash',color:0xf7fbff,halo:0x98c6e6};
    return {style:'swordqi',color:0xffffff,halo:0xc6def1};
  }
  function battleVfxSize(style){
    return {swordqi:[2.4,2.25],arrow:[2.55,1.55],thrust:[2.5,1.65],
      cavslash:[2.7,2.5],magebolt:[2.65,2.65],beastbite:[2.55,2.35],
      'impact-spark':[2.1,2.1],'impact-magic':[2.55,2.55],dust:[1.85,1.35]}[style]||[2.4,2.25];
  }
  function effectAnchor(model){
    const at=model.group.position;
    return new (three().Vector3)(at.x,clamp(model.baseY*0.92,0.85,2.5),at.z);
  }
  function effectDirection(state,from,to){
    state.camera.updateMatrixWorld(true);
    const a=from.clone().project(state.camera),b=to.clone().project(state.camera);
    return Math.atan2(b.y-a.y,b.x-a.x);
  }
  function effectPoint(effect,progress){
    const p=clamp(progress,0,1),trail=effect.trail;
    const eased=trail==='charge'?p*p:trail==='pulse'?p*(2-p):p;
    const point=effect.from.clone().lerp(effect.to,eased);
    const side=effect.from.x<effect.to.x?1:-1;
    if(trail==='arc'||trail==='double_arc'||trail==='fan')
      point.y+=0.42*Math.sin(Math.PI*p)+(trail==='double_arc'?0.16*Math.sin(3*Math.PI*p):0);
    else if(trail==='spiral'){
      point.y+=0.38*Math.sin(Math.PI*p)+0.20*Math.sin(5*Math.PI*p);
      point.z+=0.18*Math.sin(4*Math.PI*p);
    }else if(trail==='zigzag'||trail==='forked')
      point.y+=0.18*Math.sin((trail==='forked'?7:5)*Math.PI*p);
    else if(trail==='piercing')point.x+=side*0.22*Math.sin(Math.PI*p);
    else if(trail==='charge')point.y+=0.12*Math.sin(Math.PI*p);
    return point;
  }
  function effectSeed(type){
    let hash=0;for(const char of String(type||''))hash=(hash*31+char.charCodeAt(0))>>>0;
    return hash;
  }
  function addBattleEffect(state,profile,kind,from,to,duration){
    const T=three(),attack=kind==='attack',rank=clamp(number(profile.rank,1),1,5);
    const impactStyle=kind==='heal'||kind==='shield'?'impact-magic':
      profile.impact||(/mage|bolt/.test(profile.style)?'impact-magic':'impact-spark');
    const mainPath=attack?(profile.art||battleVfxFiles[profile.style]):battleVfxFiles[impactStyle];
    const glowPath=attack?(profile.art||battleVfxFiles[profile.style]):
      profile.art||battleVfxFiles[impactStyle];
    const fallbackPath=legacyBattleVfxFiles[profile.style];
    const mainTexture=loadedTexture(state,mainPath)||
      (!attack||!profile.art?(loadedTexture(state,battleVfxFiles[profile.style])||
        loadedTexture(state,fallbackPath)):null);
    const glowTexture=loadedTexture(state,glowPath)||mainTexture;
    const size=battleVfxSize(attack?profile.style:impactStyle);
    // Reserve the broader, brighter silhouette for advanced units.
    const factor=clamp(state.heroScale||1,0.72,1.32)*(0.74+0.11*(rank-1));
    const group=new T.Group(),glowMat=new T.SpriteMaterial({map:glowTexture,color:profile.halo,
      transparent:true,opacity:0.12+rank*0.03,blending:T.AdditiveBlending,
      depthTest:false,depthWrite:false,toneMapped:false});
    const mainMat=new T.SpriteMaterial({map:mainTexture,color:attack?0xffffff:profile.color,
      transparent:true,opacity:0.96,depthTest:false,depthWrite:false,toneMapped:false});
    const glow=new T.Sprite(glowMat),main=new T.Sprite(mainMat);
    main.scale.set(size[0]*factor,size[1]*factor,1);
    glow.scale.set(size[0]*factor*1.28,size[1]*factor*1.28,1);
    glow.renderOrder=6;main.renderOrder=7;
    const angle=effectDirection(state,from,to);
    if(attack){mainMat.rotation=angle;glowMat.rotation=angle;}
    group.add(glow,main);
    const launchMat=new T.SpriteMaterial({map:glowTexture,color:profile.halo,
      transparent:true,opacity:0,blending:T.AdditiveBlending,
      depthTest:false,depthWrite:false,toneMapped:false});
    const launch=new T.Sprite(launchMat);launch.renderOrder=6;
    launch.scale.set(size[0]*factor*0.65,size[1]*factor*0.65,1);
    group.add(launch);
    const trails=[];
    if(attack)for(let i=0;i<rank-1;i++){
      const material=new T.SpriteMaterial({map:mainTexture,color:profile.color,
        transparent:true,opacity:0,blending:T.AdditiveBlending,
        depthTest:false,depthWrite:false,toneMapped:false});
      const sprite=new T.Sprite(material);sprite.renderOrder=5-i;
      sprite.scale.set(size[0]*factor*(0.86-i*0.10),size[1]*factor*(0.86-i*0.10),1);
      group.add(sprite);trails.push(sprite);
    }
    const particles=[];
    if(!attack)for(let i=0;i<rank+1;i++){
      const material=new T.SpriteMaterial({map:mainTexture,color:profile.halo,
        transparent:true,opacity:0,blending:T.AdditiveBlending,
        depthTest:false,depthWrite:false,toneMapped:false});
      const sprite=new T.Sprite(material);sprite.renderOrder=8;
      const particleSize=0.24+rank*0.045;
      sprite.scale.set(particleSize,particleSize,1);group.add(sprite);particles.push(sprite);
    }
    group.position.copy(attack?from:to);group.visible=!!mainTexture;
    state.effectGroup.add(group);
    const effect={mesh:group,main,glow,launch,trails,particles,from:from.clone(),to:to.clone(),
      start:performance.now(),duration,type:kind,style:profile.style,
      unitType:profile.unitType||'',trail:profile.trail||'straight',rank,
      mainPath,glowPath,impactShape:profile.impactShape||'burst',phase:attack?'windup':'impact',
      seed:effectSeed(profile.unitType)};
    state.effects.push(effect);
    if(mainPath&&(!mainTexture||mainPath!==battleVfxFiles[profile.style]))
      loadTextureFor(state,mainPath,null,{pixelArt:true,onReady:function(ready){
        if(state.disposed||!state.effects.includes(effect))return;
        mainMat.map=ready;mainMat.needsUpdate=true;
        if(glowPath===mainPath){
          glowMat.map=launchMat.map=ready;
          glowMat.needsUpdate=launchMat.needsUpdate=true;
        }
        for(const sprite of [...trails,...particles]){
          sprite.material.map=ready;sprite.material.needsUpdate=true;
        }
        group.visible=true;
      }});
    if(glowPath&&(!glowTexture||glowPath!==mainPath))
      loadTextureFor(state,glowPath,null,{pixelArt:true,onReady:function(ready){
        if(state.disposed||!state.effects.includes(effect))return;
        glowMat.map=launchMat.map=ready;
        glowMat.needsUpdate=launchMat.needsUpdate=true;
      }});
    if(state.effects.length>32){
      const oldest=state.effects.shift();state.effectGroup.remove(oldest.mesh);disposeObject(oldest.mesh);
    }
  }
  function playBattle(event){
    const state=live.battle;if(!state||!event||event.epoch!==state.epoch)return false;
    const type=event.type||'attack';
    const source=findUnit(state,event.sourceId,event.sourceSide);
    const target=findUnit(state,event.targetId,event.targetSide);
    if(!target&&!source)return false;
    if(type==='attack')startUnitAction(state,source,'attack',number(event.durationMs,420));
    if(type==='hit')startUnitAction(state,target,'hit',number(event.durationMs,280));
    if(type==='death')startUnitAction(state,target,'death',620);
    const duration=clamp(number(event.durationMs,350),120,1200);
    const from=effectAnchor(source||target),to=effectAnchor(target||source);
    const unit=source||target;
    const profile={rank:1,trail:'straight',impact:'impact-spark',
      impactShape:'burst',unitType:unit?.type||'',...battleVfxProfile(unit)};
    if(type==='hit'||type==='death'){
      if(type==='death')profile.rank=Math.min(5,profile.rank+1);
    }else if(type==='heal'){
      profile.impact='impact-magic';profile.halo=0x86d5a8;
    }else if(type==='shield'){
      profile.impact='impact-magic';profile.halo=0x8bcde6;
    }
    addBattleEffect(state,profile,type,from,to,duration);
    state.lastAcceptedEvent={type,unitType:profile.unitType,epoch:event.epoch};
    return true;
  }
  function tickEffects(state,now){
    if(!state.effects||!state.effects.length)return;
    for(let i=state.effects.length-1;i>=0;i--){
      const e=state.effects[i],t=clamp((now-e.start)/e.duration,0,1);
      if(e.type==='attack'){
        const travel=clamp((t-0.15)/0.84,0,1),point=effectPoint(e,travel);
        e.phase=t<0.15?'windup':t<0.95?'travel':'strike';
        e.mesh.position.copy(point);
        const swell=0.78+0.24*Math.sin(Math.PI*travel);
        e.mesh.scale.setScalar(swell);
        e.launch.position.copy(e.from).sub(point);
        e.launch.material.opacity=t<0.32?0.58*(1-t/0.32):0;
        for(let j=0;j<e.trails.length;j++){
          const ghost=e.trails[j],behind=clamp(travel-(j+1)*0.09,0,1);
          ghost.position.copy(effectPoint(e,behind)).sub(point);
          ghost.material.opacity=t<0.15?0:0.34*(1-j/e.trails.length)*
            (1-clamp((t-0.86)/0.14,0,1));
        }
      }else{
        e.mesh.position.copy(e.to);
        e.phase='impact';
        e.mesh.scale.setScalar(0.45+1.0*(1-Math.pow(1-t,2)));
        const spread=(0.25+0.16*e.rank)*t;
        const toward=e.from.x<=e.to.x?1:-1;
        if(e.impactShape==='rune')e.main.material.rotation=t*Math.PI*1.4;
        else if(e.impactShape==='cut'||e.impactShape==='claw')
          e.main.material.rotation=toward*(0.28+0.35*t);
        else if(e.impactShape==='shock')e.main.material.rotation=0.13*Math.sin(t*28);
        for(let j=0;j<e.particles.length;j++){
          const particle=e.particles[j],a=(j/e.particles.length)*Math.PI*2+
            (e.seed%17)*Math.PI/17;
          let x=Math.cos(a)*spread,y=Math.sin(a)*spread*0.72;
          if(e.impactShape==='pierce'){
            x=toward*spread*(0.25+j/e.particles.length);
            y=(j-(e.particles.length-1)/2)*0.11*t;
          }else if(e.impactShape==='cut'||e.impactShape==='claw'){
            x=toward*spread*(0.3+j/e.particles.length*0.7);
            y=(j-(e.particles.length-1)/2)*0.22*t;
          }else if(e.impactShape==='crush')y=Math.abs(y)*0.30-0.12*t;
          else if(e.impactShape==='venom')y=Math.abs(y)*0.5-0.38*t;
          else if(e.impactShape==='bite')x=(j%2?-1:1)*spread*0.72;
          else if(e.impactShape==='shield'){x*=0.75;y*=0.75;}
          else if(e.impactShape==='shock')y+=0.12*Math.sin(t*24+j*2);
          particle.position.set(x,y,0);
          particle.material.opacity=0.55*(1-t);
        }
      }
      const fade=e.type==='attack'?Math.min(1,t*9)*(1-clamp((t-0.90)/0.10,0,1)):
        Math.min(1,t*11)*Math.pow(1-t,0.65);
      e.main.material.opacity=0.96*fade;
      e.glow.material.opacity=(0.12+e.rank*0.03)*fade;
      if(t>=1){state.effectGroup.remove(e.mesh);disposeObject(e.mesh);state.effects.splice(i,1);}
    }
  }
  function resize(state){
    if(state.disposed)return;
    const width=Math.max(1,state.container.clientWidth),height=Math.max(1,state.container.clientHeight);
    if(width===state.width&&height===state.height)return;
    state.width=width;state.height=height;
    const aspect=width/height;
    const minimumWidth=state.kind==='town'?13.8:12.8;
    const span=state.candidateMode?state.candidateSpan:
      Math.max(state.kind==='town'?11.9:10.8,minimumWidth/aspect);
    state.camera.left=-span*aspect/2;state.camera.right=span*aspect/2;
    state.camera.top=span/2;state.camera.bottom=-span/2;
    if(state.kind==='battle')state.camera.zoom=sparseBattleFraming(state.density||12,height);
    state.camera.updateProjectionMatrix();state.renderer.setSize(width,height,false);
    sizePlate(state);
    if(state.kind==='battle')for(const model of Object.values(state.units)){
      const pos=battlePosition(model.side,model.index,model.slot.row,state.density,height,model.slot);
      model.group.position.set(pos.x,0,pos.z);
      placeBattleBadge(state,model,state.density);
      keepSparseSpriteInside(state,model);
    }
  }
  function frame(state,now){
    if(state.disposed)return;
    state.raf=requestAnimationFrame(t=>frame(state,t));
    if(document.hidden||!state.container.isConnected)return;
    if(state.kind==='town'&&document.getElementById('battle-screen')?.classList.contains('active'))return;
    if(state.kind==='battle')syncBattlePlateArt(state);
    resize(state);
    // Allow one millisecond of vsync jitter so a nominal 30 fps frame does
    // not slip from two 60 Hz refreshes to three.
    if(now-state.lastRender<state.frameInterval-1)return;
    const elapsed=now-state.lastRender;state.lastRender=now;
    const minimumRatio=state.kind==='battle'?1:0.82;
    if(elapsed>60&&state.pixelRatio>minimumRatio){
      state.slowFrames++;
      if(state.slowFrames>20){
        state.pixelRatio=Math.max(minimumRatio,Math.round(state.pixelRatio*0.8*100)/100);
        state.renderer.setPixelRatio(state.pixelRatio);state.slowFrames=0;
      }
    }else state.slowFrames=Math.max(0,state.slowFrames-1);
    const idlePhase=Math.floor(now/300);
    if(idlePhase!==state.idleFrame){
      state.idleFrame=idlePhase;
      for(const texture of state.animatedTextures){
        const frames=texture.userData.hd2dFrames||1;
        texture.offset.x=((idlePhase%frames)+(texture.userData.hd2dMirrored?1:0))/frames;
      }
    }
    if(state.kind==='battle'){
      tickEffects(state,now);
      for(const model of Object.values(state.units)){
        const action=model.action;
        let offsetY=0;
        if(action){
          const p=clamp((now-action.start)/action.duration,0,1);
          if(p>=1){
            model.action=null;
            if(model.pendingRemoval){removeUnit(state,model);continue;}
            model.sprite.position.x=0;model.sprite.material.opacity=1;
            model.sprite.material.color.setHex(0xffffff);model.sprite.material.rotation=0;
            applyUnitActionTexture(state,model,'idle');
          }else if(model.hiresIdle){
            const wave=Math.sin(Math.PI*p),material=model.sprite.material,factor=model.heroScale||1,
              pack=model.portraitPack||1;
            if(model.hiresActionActive){
              const texture=material.map,frames=texture.userData.hd2dFrames||1;
              const frameIndex=Math.min(frames-1,Math.floor(p*frames));
              texture.offset.x=(frameIndex+
                (texture.userData.hd2dMirrored?1:0))/frames;
              const source=loadedTexture(state,model.hiresActionPaths[action.kind]);
              const measuredTop=source?.userData.hd2dFrameTops?.[frameIndex];
              const headTop=actionBadgeHeadTops[model.type]?.[action.kind]?.[frameIndex];
              model.actionVisibleTopFraction=Number.isFinite(headTop)?headTop:
                measuredTop??null;
            }
            if(action.kind==='attack'){
              model.sprite.position.x=(model.side==='allies'?-1:1)*0.48*factor*pack*wave;
              offsetY=0.16*factor*pack*wave;
              const size=3.0*factor*pack*(1+0.055*wave);
              model.sprite.scale.set(size,size,1);
              material.color.setRGB(1,1-0.09*wave,1-0.25*wave);
            }else if(action.kind==='hit'){
              model.sprite.position.x=0.16*factor*pack*Math.sin(p*50)*(1-p);
              material.color.setRGB(1,1-0.48*(1-p),1-0.48*(1-p));
            }else if(action.kind==='death'){
              model.sprite.position.x=(model.side==='allies'?1:-1)*0.26*factor*pack*p;
              offsetY=-0.45*factor*pack*p;
              const size=3.0*factor*pack*(1-0.20*p);
              model.sprite.scale.set(size,size,1);
              material.rotation=(model.side==='allies'?-1:1)*0.62*p;
              material.opacity=1-p;
            }
          }else{
            if(applyUnitActionTexture(state,model,action.kind)){
              const texture=model.sprite.material.map,frames=texture.userData.hd2dFrames||4;
              texture.offset.x=(Math.min(frames-1,Math.floor(p*frames))+
                (texture.userData.hd2dMirrored?1:0))/frames;
            }
            model.sprite.position.x=action.kind==='attack'?(model.side==='allies'?-1:1)*0.28*Math.sin(Math.PI*p):
              action.kind==='hit'?0.08*Math.sin(p*40)*(1-p):0;
            model.sprite.material.opacity=action.kind==='death'?1-p:1;
          }
        }
        model.sprite.position.y=model.baseY+0.025*Math.sin(now*0.0015+model.index*1.7)+offsetY;
        if(action&&model.hiresIdle)placeBattleBadge(state,model,state.density);
      }
    }else{
      if(state.guard)state.guard.position.y=0.62+0.028*Math.sin(now*0.002);
      if(state.warningBeacon?.visible)state.warningBeacon.scale.setScalar(0.85+0.28*Math.sin(now*0.006));
    }
    state.renderer.render(state.scene,state.camera);
  }
  function attachInteraction(state){
    if(state.kind!=='town')return;
    const canvas=state.renderer.domElement;
    state.pointers=new Map();
    state.onDown=function(e){
      state.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      state.lastTownPick={event:'down',x:e.clientX,y:e.clientY,hit:null};
      if(state.pointers.size===1)state.down={x:e.clientX,y:e.clientY,moved:false};
      else if(state.down)state.down.moved=true;
      if(state.expanded)canvas.setPointerCapture(e.pointerId);
    };
    state.onMove=function(e){
      const previous=state.pointers.get(e.pointerId);if(!previous)return;
      state.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(!state.expanded||!state.down)return;
      if(state.pointers.size>=2){
        const points=[...state.pointers.values()];
        const distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
        if(state.pinchDistance){
          state.camera.zoom=clamp(state.camera.zoom*distance/state.pinchDistance,0.8,1.7);
          state.camera.updateProjectionMatrix();sizePlate(state);
        }
        state.pinchDistance=distance;state.down.moved=true;
      }else{
        const dx=e.clientX-previous.x,dy=e.clientY-previous.y;
        if(Math.abs(dx)+Math.abs(dy)<1)return;
        if(state.plate?.ready){
          const viewW=(state.camera.right-state.camera.left)/state.camera.zoom;
          const viewH=(state.camera.top-state.camera.bottom)/state.camera.zoom;
          state.plate.root.position.x+=dx*viewW/Math.max(1,state.width);
          state.plate.root.position.y-=dy*viewH/Math.max(1,state.height);
          clampPlatePan(state);
          positionTownRelief(state);
        }else{
          state.camera.position.x=clamp(state.camera.position.x-dx*0.015,6.3,10.8);
          state.camera.position.z=clamp(state.camera.position.z+dy*0.015,10.8,16.5);
          state.camera.lookAt(state.cameraTarget);
        }
        state.down.moved=true;
      }
    };
    state.onUp=function(e){
      const down=state.down;
      state.pointers.delete(e.pointerId);state.pinchDistance=0;
      if(state.pointers.size){state.lastTownPick={event:'other-pointer',x:e.clientX,y:e.clientY,hit:null};return;}
      state.down=null;
      if(!down||down.moved||Math.hypot(e.clientX-down.x,e.clientY-down.y)>9){
        state.lastTownPick={event:'drag',x:e.clientX,y:e.clientY,hit:null};return;
      }
      // CSS 视口改变后 ResizeObserver/下一帧可能尚未运行；点选前用当前容器尺寸更新投影。
      resize(state);
      const rect=canvas.getBoundingClientRect();
      state.camera.updateMatrixWorld(true);
      state.lastTownPick={event:'tap',x:e.clientX,y:e.clientY,hit:null,
        renderWidth:state.width,renderHeight:state.height};
      if(state.plate?.ready){
        // 热区固定为屏幕上的 48 CSS px；镜头平面在部分驱动上偶发射线漏判。
        let chosen=null,best=Infinity;
        for(const spot of state.plate.hotspots){
          const point=spot.getWorldPosition(new (three().Vector3)()).project(state.camera);
          const x=rect.left+(point.x+1)*rect.width/2;
          const y=rect.top+(1-point.y)*rect.height/2;
          if(spot.userData.hotspot==='tech')state.lastTownPick.techCenter={x,y};
          const dx=Math.abs(e.clientX-x),dy=Math.abs(e.clientY-y);
          if(dx>24||dy>24)continue;
          const distance=dx*dx+dy*dy;
          if(distance<best){best=distance;chosen=spot.userData.hotspot;}
        }
        if(chosen){
          state.lastTownPick.hit=chosen;
          if(typeof state.options.onSelect==='function')state.options.onSelect(chosen);
        }
        return;
      }
      state.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
      state.raycaster.setFromCamera(state.pointer,state.camera);
      const hits=state.raycaster.intersectObjects(Object.values(state.townGroups),true);
      for(const hit of hits){
        let obj=hit.object;
        while(obj&&!obj.userData.hotspot)obj=obj.parent;
        if(obj&&obj.userData.hotspot){
          state.lastTownPick.hit=obj.userData.hotspot;
          if(typeof state.options.onSelect==='function')state.options.onSelect(obj.userData.hotspot);
          break;
        }
      }
    };
    state.onWheel=function(e){
      if(!state.expanded)return;
      e.preventDefault();
      state.camera.zoom=clamp(state.camera.zoom+(e.deltaY<0?0.1:-0.1),0.8,1.7);
      state.camera.updateProjectionMatrix();sizePlate(state);
    };
    canvas.addEventListener('pointerdown',state.onDown);
    canvas.addEventListener('pointermove',state.onMove);
    canvas.addEventListener('pointerup',state.onUp);
    canvas.addEventListener('pointercancel',state.onUp);
    canvas.addEventListener('wheel',state.onWheel,{passive:false});
  }
  function fallback(state,reason){
    if(!state||state.disposed)return;
    errors[state.kind]=reason;
    const callback=state.options.onFallback;
    const kind=state.kind;
    dispose(kind);
    if(typeof callback==='function')callback({scene:kind,reason});
  }
  function mount(kind,container,snapshot,options){
    dispose(kind);errors[kind]='';
    if(!container||!container.appendChild){errors[kind]='missing-container';return false;}
    if(!available()){errors[kind]=validOrigin()?'webgl-unavailable':'file-origin';return false;}
    const T=three();let renderer;
    try{
      renderer=new T.WebGLRenderer({antialias:false,alpha:false,powerPreference:'low-power',preserveDrawingBuffer:false});
      renderer.outputColorSpace=T.SRGBColorSpace;
      renderer.toneMapping=T.ACESFilmicToneMapping;
      renderer.toneMappingExposure=0.96;
      const weakDevice=(navigator.hardwareConcurrency||4)<=4;
      const shadowEnabled=!!(!weakDevice&&!(options&&options.lowQuality));
      renderer.shadowMap.enabled=shadowEnabled;
      renderer.shadowMap.type=T.PCFSoftShadowMap;
      const battleDensity=Math.max(snapshot?.allies?.length||0,snapshot?.enemies?.length||0);
      const ratioCap=kind==='battle'?(battleDensity<=2?1.8:battleDensity<=6?1.55:1.4):1.3;
      const pixelRatio=clamp((root.devicePixelRatio||1)*0.85,kind==='battle'?1:0.8,ratioCap);
      renderer.setPixelRatio(pixelRatio);
      renderer.domElement.className='hd2d-canvas';
      renderer.domElement.setAttribute('aria-hidden','true');
      renderer.domElement.style.cssText='display:block;width:100%;height:100%;touch-action:pan-y;image-rendering:pixelated;';
      container.appendChild(renderer.domElement);
      const scene=new T.Scene();scene.background=new T.Color(kind==='town'?0xd6deca:0xe1d0ad);
      const camera=new T.OrthographicCamera(-5,5,5,-5,0.1,80);
      const state={kind,container,renderer,scene,camera,options:options||{},snapshot:snapshot||{},
        loader:new T.TextureLoader(),loaded:{},generated:{},ownedTextures:new Set(),animatedTextures:new Set(),
        mirroredTextures:new Map(),idleFrame:-1,
        townGroups:{},townLevels:{},workerSprites:[],workerKey:'',units:{},effects:[],
        expanded:!!(snapshot&&snapshot.expanded),epoch:snapshot&&snapshot.epoch,
        shadowEnabled,pixelRatio,frameInterval:1000/30,lastRender:0,slowFrames:0,modelsLoaded:0,
        width:0,height:0,raf:0,disposed:false};
      live[kind]=state;
      if(kind==='town'){
        if(options?.candidateModel&&/^[a-z0-9_]+$/.test(options.candidateModel))
          buildCandidateTown(state);
        else{buildTown(state,state.snapshot);updateTown(state.snapshot);}
      }else buildBattle(state,state.snapshot);
      if(!state.candidateMode)makeScenePlate(state,kind);
      state.onContextLost=function(e){e.preventDefault();fallback(state,'webgl-context-lost');};
      renderer.domElement.addEventListener('webglcontextlost',state.onContextLost,false);
      if(root.ResizeObserver){state.observer=new ResizeObserver(()=>resize(state));state.observer.observe(container);}
      attachInteraction(state);resize(state);state.raf=requestAnimationFrame(t=>frame(state,t));
      return true;
    }catch(e){
      errors[kind]='renderer-init-failed';
      if(live[kind])dispose(kind);
      else if(renderer){renderer.dispose();if(renderer.domElement&&renderer.domElement.parentNode)renderer.domElement.remove();}
      if(options&&typeof options.onFallback==='function')options.onFallback({scene:kind,reason:errors[kind]});
      return false;
    }
  }
  function dispose(kind){
    const state=live[kind];if(!state)return;
    state.disposed=true;cancelAnimationFrame(state.raf);
    if(state.observer)state.observer.disconnect();
    const canvas=state.renderer.domElement;
    canvas.removeEventListener('webglcontextlost',state.onContextLost,false);
    if(state.onDown){
      canvas.removeEventListener('pointerdown',state.onDown);
      canvas.removeEventListener('pointermove',state.onMove);
      canvas.removeEventListener('pointerup',state.onUp);
      canvas.removeEventListener('pointercancel',state.onUp);
      canvas.removeEventListener('wheel',state.onWheel);
    }
    disposeObject(state.scene);
    for(const texture of state.ownedTextures)texture.dispose();
    state.renderer.dispose();
    if(canvas.parentNode)canvas.remove();
    if(state.overflowNotice)state.overflowNotice.remove();
    if(Object.prototype.hasOwnProperty.call(state,'containerPosition'))state.container.style.position=state.containerPosition;
    live[kind]=null;
  }
  root.HD2D={
    available,status,
    mountTown:(container,snapshot,options)=>mount('town',container,snapshot,options),
    updateTown,
    mountBattle:(container,snapshot,options)=>mount('battle',container,snapshot,options),
    updateBattle,playBattle,
    disposeTown:()=>dispose('town'),disposeBattle:()=>dispose('battle')
  };
})(window);
