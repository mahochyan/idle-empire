'use strict';
// Editable, isolated Silver Age art prototype. The game never loads this file.
// The panorama supplies reference-view paint; separate closed wall, roof, tower,
// plinth and stair solids provide depth, light response and camera parallax.
(() => {
  const W=1024,H=525;
  const stage=document.getElementById('stage');
  const status=document.getElementById('status');
  const params=new URLSearchParams(location.search);
  const yaw=Math.max(-8,Math.min(8,Number(params.get('yaw')||0)));
  const mode=params.get('mode');
  const originalUrl='../../../assets/art/scene/town-sci_silver_age.png';
  const cleanUrl='../../../assets/art/scene/candidates/town-sci_silver_age-clean-candidate.png';
  function fit(){
    const scale=Math.max(innerWidth/W,innerHeight/H);
    stage.style.transform=`translate(-50%,-50%) scale(${scale})`;
  }
  addEventListener('resize',fit);fit();
  if(mode==='original'){
    const image=new Image();image.src=originalUrl;stage.append(image);
    image.onload=()=>{status.textContent='当前白银时代原画';document.documentElement.dataset.ready='1';};
    image.onerror=()=>{document.documentElement.dataset.error='original image';};
    return;
  }
  if(!window.THREE){document.documentElement.dataset.error='Three.js unavailable';return;}
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1);renderer.setSize(W,H);
  renderer.outputEncoding=THREE.LinearEncoding;
  stage.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#c9dfd4');
  const camera=new THREE.OrthographicCamera(-W/2,W/2,H/2,-H/2,1,2000);
  camera.position.set(W/2,H/2,1000);camera.lookAt(W/2,H/2,0);
  const loader=new THREE.TextureLoader();
  const getTexture=url=>new Promise((resolve,reject)=>loader.load(url,resolve,undefined,reject));
  Promise.all([getTexture(originalUrl),getTexture(cleanUrl)]).then(([original,clean])=>{
    for(const texture of [original,clean]){
      texture.encoding=THREE.LinearEncoding;
      texture.minFilter=texture.magFilter=THREE.LinearFilter;
    }
    const turn=Math.abs(yaw)/8;
    const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.ShaderMaterial({
      uniforms:{original:{value:original},clean:{value:clean},
        blend:{value:mode==='clay'?1:turn*.94}},
      vertexShader:'varying vec2 tex;void main(){tex=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform sampler2D original,clean;uniform float blend;
        varying vec2 tex;void main(){
          vec2 p=vec2(tex.x*1024.,(1.-tex.y)*525.);
          float d=length(vec2((p.x-512.)/138.,(p.y-171.)/109.));
          float hallMask=1.-smoothstep(.84,1.,d);
          gl_FragColor=mix(texture2D(original,tex),texture2D(clean,tex),blend*hallMask);
        }`
    }));
    backdrop.position.set(W/2,H/2,-40);scene.add(backdrop);
    const pivot=new THREE.Group();pivot.position.set(512,H-198,0);scene.add(pivot);
    const building=new THREE.Group();building.position.set(-512,-(H-198),0);pivot.add(building);
    pivot.rotation.y=yaw*Math.PI/180;
    const lightDir=new THREE.Vector3(-.48,.63,.60).normalize();
    const paint=new THREE.ShaderMaterial({
      uniforms:{original:{value:original},lightDir:{value:lightDir},strength:{value:.045}},
      side:THREE.DoubleSide,
      vertexShader:'varying vec2 tex;varying vec3 n;void main(){tex=uv;n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform sampler2D original;uniform vec3 lightDir;uniform float strength;varying vec2 tex;varying vec3 n;void main(){vec4 color=texture2D(original,tex);float lam=max(0.,dot(normalize(n),lightDir));gl_FragColor=vec4(color.rgb*(1.-strength*.6+strength*lam),1.);}'
    });
    // These swatches label proposed future side paints. The current quality
    // pass projects source pixels across every face; it does not render the
    // swatches, which made the earlier first attempt look like blank masonry.
    const stone=new THREE.MeshLambertMaterial({color:0xd4ccb7,side:THREE.DoubleSide});
    const limestone=new THREE.MeshLambertMaterial({color:0xf1e8d2,side:THREE.DoubleSide});
    const blueRoof=new THREE.MeshLambertMaterial({color:0x314e73,side:THREE.DoubleSide});
    const roofEdge=new THREE.MeshLambertMaterial({color:0x92a7bb,side:THREE.DoubleSide});
    const gold=new THREE.MeshLambertMaterial({color:0xd0a94b,side:THREE.DoubleSide});
    const clay=new THREE.MeshNormalMaterial({side:THREE.DoubleSide});
    const sun=new THREE.DirectionalLight(0xffffff,.86);
    sun.position.set(-260,220,400);scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff,.57));
    const batches=new Map();
    const metrics={era:'silver',triangles:0,shells:[],roofNormals:[],
      depthRange:[Infinity,-Infinity],paintedFaces:0,solidSideFaces:0};
    const world=p=>new THREE.Vector3(p[0],H-p[1],p[2]);
    function polygon(name,points,material=paint,uvs){
      const positions=[],uv=[],indices=[];
      points.forEach((p,i)=>{
        positions.push(p[0],H-p[1],p[2]);
        const mapped=uvs?uvs[i]:[p[0]/W,1-p[1]/H];
        uv.push(mapped[0],mapped[1]);
        metrics.depthRange[0]=Math.min(metrics.depthRange[0],p[2]);
        metrics.depthRange[1]=Math.max(metrics.depthRange[1],p[2]);
      });
      for(let i=1;i<points.length-1;i++)indices.push(0,i,i+1);
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      geo.setIndex(indices);geo.computeVertexNormals();
      const key=mode==='clay'?clay:material;
      if(!batches.has(key))batches.set(key,{positions:[],uv:[],normals:[]});
      const batch=batches.get(key),normals=geo.getAttribute('normal');
      for(const index of indices){
        batch.positions.push(...positions.slice(index*3,index*3+3));
        batch.uv.push(...uv.slice(index*2,index*2+2));
        batch.normals.push(normals.getX(index),normals.getY(index),normals.getZ(index));
      }
      geo.dispose();
      metrics.triangles+=indices.length/3;
      if(material===paint)metrics.paintedFaces++;
      return name;
    }
    // Every architecture shell has a face, an independent rear, and one wall
    // across each edge. Decorative canvas banners remain simple cloth meshes.
    function shell(name,front,back,sideMaterial=stone,frontMaterial=paint){
      if(front.length!==back.length)throw Error(name+' ring mismatch');
      polygon(name+' reference face',front,frontMaterial);
      // The reference view also projects its paint onto visible thickness.
      // Individual side/rear polygons remain closed geometry with normals;
      // the yaw range is intentionally restricted until bespoke sides exist.
      polygon(name+' reverse',back,paint);
      metrics.solidSideFaces++;
      for(let i=0;i<front.length;i++){
        const next=(i+1)%front.length;
        polygon(name+' edge '+i,[front[i],front[next],back[next],back[i]],paint);
        metrics.solidSideFaces++;
      }
      metrics.shells.push({name,ringVertices:front.length,closed:true});
    }
    function faceBox(name,x1,y1,x2,y2,zFront,zBack,material=stone){
      const dx=(zFront-zBack)*.12,dy=(zFront-zBack)*.19;
      shell(name,[[x1,y1,zFront],[x2,y1,zFront],[x2,y2,zFront],[x1,y2,zFront]],
        [[x1+dx,y1-dy,zBack],[x2+dx,y1-dy,zBack],
          [x2+dx,y2-dy,zBack],[x1+dx,y2-dy,zBack]],material);
    }
    function roof(name,front,back,color=blueRoof){
      shell(name,front,back,color);
      const a=world(front[1]).sub(world(front[0]));
      const b=world(front[2]).sub(world(front[0]));
      const normal=a.cross(b).normalize();
      metrics.roofNormals.push([normal.x,normal.y,normal.z]);
    }
    function roofStrip(name,points,zDepth=8,color=roofEdge){
      shell(name,points,points.map(p=>[p[0],p[1]+2,p[2]-zDepth]),color);
    }
    // Four-step white stone podium, different from the base-era stockade.
    // It keeps the front staircase and flower beds at their source coordinates.
    faceBox('elevated pale stone podium',402,224,622,246,51,17,stone);
    for(let i=0;i<5;i++){
      const y=239+i*5.4,half=29+i*2,z=91-i*9;
      shell('processional step '+(i+1),
        [[512-half,y,z],[512+half,y,z],[512+half+2,y+4,z],[512-half-2,y+4,z]],
        [[512-half,y+1,z-5],[512+half,y+1,z-5],
          [512+half+2,y+5,z-5],[512-half-2,y+5,z-5]],limestone);
    }
    // Two lateral naves: long low masonry masses with dark blue sloped roofs.
    // Bronze has neither these symmetrical Gothic naves nor slender turrets.
    faceBox('west nave wall',400,180,479,228,62,21,limestone);
    faceBox('east nave wall',547,180,625,228,62,21,limestone);
    roof('west nave near pitch',
      [[404,181,67],[451,153,49],[482,180,70],[470,189,76]],
      [[408,183,60],[454,150,22],[482,174,26],[473,190,67]]);
    roof('west nave far pitch',
      [[403,181,61],[451,153,43],[460,151,24],[415,171,24]],
      [[403,184,55],[451,156,36],[460,154,17],[415,174,17]]);
    roof('east nave near pitch',
      [[545,179,72],[573,151,47],[622,182,67],[555,190,78]],
      [[548,174,27],[575,149,21],[624,185,59],[558,191,68]]);
    roof('east nave far pitch',
      [[570,151,42],[622,182,61],[612,169,23],[582,146,23]],
      [[571,154,35],[622,185,55],[612,172,16],[583,149,16]]);
    // The recessed central hall and its split Gothic roof rise behind the
    // entrance tower. Their left/right pitches have distinct 3D normals.
    faceBox('central hall body',454,151,567,232,78,25,limestone);
    roof('central hall west roof',
      [[455,161,79],[494,120,59],[513,146,102],[479,179,101]],
      [[457,162,71],[494,117,34],[513,142,54],[480,179,93]]);
    roof('central hall east roof',
      [[513,146,103],[529,122,58],[570,161,77],[547,180,100]],
      [[513,142,55],[529,119,32],[570,162,69],[548,180,92]]);
    // Solid palace facade: porch, pilasters, arched entry and stone cornice.
    faceBox('middle palace facade',477,164,548,233,101,48,limestone);
    faceBox('west entrance porch',462,188,483,233,107,85,limestone);
    faceBox('east entrance porch',543,188,562,233,107,85,limestone);
    for(const x of [480,488,537,545]){
      faceBox('arched facade pilaster '+x,x-2,181,x+2,225,110,102,stone);
    }
    roofStrip('palace triangular pediment',
      [[478,170,111],[512,139,111],[546,170,111],[544,175,109],[512,146,109],[480,175,109]],8,stone);
    roofStrip('west roof silver ridge',
      [[454,154,84],[493,116,61],[497,119,59],[459,157,82]],8,roofEdge);
    roofStrip('east roof silver ridge',
      [[527,119,61],[531,116,61],[571,154,83],[566,157,81]],8,roofEdge);
    // West and east arrow towers. Conical faceted blue caps have independent
    // front, side and reverse faces; the square tower walls have full depth.
    function turret(name,cx,tipY,eaveY,baseY,width,z){
      const half=width/2;
      faceBox(name+' square tower',cx-half,eaveY,cx+half,baseY,z,z-35,limestone);
      const tip=[cx,tipY,z+4];
      const left=[cx-half-3,eaveY,z+2],right=[cx+half+3,eaveY,z+2];
      const farLeft=[cx-half+2,eaveY-10,z-26];
      const farRight=[cx+half-2,eaveY-10,z-26];
      roof(name+' blue spire front left',[left,tip,[cx,eaveY+2,z+14]],
        [[left[0],left[1]+3,left[2]-7],[tip[0],tip[1]+3,tip[2]-7],
          [cx,eaveY+4,z+7]],blueRoof);
      roof(name+' blue spire front right',[[cx,eaveY+2,z+14],tip,right],
        [[cx,eaveY+4,z+7],[tip[0],tip[1]+3,tip[2]-7],
          [right[0],right[1]+3,right[2]-7]],blueRoof);
      roof(name+' blue spire side left',[farLeft,tip,left],
        [[farLeft[0],farLeft[1]+2,farLeft[2]-7],
          [tip[0],tip[1]+3,tip[2]-7],[left[0],left[1]+2,left[2]-7]],blueRoof);
      roof(name+' blue spire side right',[right,tip,farRight],
        [[right[0],right[1]+2,right[2]-7],[tip[0],tip[1]+3,tip[2]-7],
          [farRight[0],farRight[1]+2,farRight[2]-7]],blueRoof);
      roofStrip(name+' gold finial',
        [[cx-2,tipY-7,z+8],[cx+2,tipY-7,z+8],
          [cx+2,tipY+3,z+8],[cx-2,tipY+3,z+8]],3,gold);
    }
    turret('west slender turret',451,91,130,197,22,90);
    turret('east slender turret',568,104,140,200,20,89);
    // The central spire is taller and wider than its flank towers. Its front
    // pointed facade carries the existing white-and-gold sun banner art.
    faceBox('main tower shaft',486,129,538,207,124,63,limestone);
    turret('main central spire',512,73,132,153,40,136);
    faceBox('sun-emblem banner stone core',499,151,525,220,139,126,limestone);
    roofStrip('east crenellated wall',
      [[580,173,69],[608,179,69],[609,184,70],[579,178,70]],5,stone);
    roofStrip('west crenellated wall',
      [[416,178,69],[445,171,69],[446,176,70],[417,183,70]],5,stone);
    // Arcaded windows and the narrow entrance posts are raised facade relief.
    for(const x of [426,440,466,555,585,601]){
      faceBox('nave buttress '+x,x-2,192,x+2,226,77,68,stone);
    }
    for(const x of [499,525]){
      faceBox('entrance pillar '+x,x-2,207,x+2,237,145,131,limestone);
    }
    // Gold and white heraldic pennants remain real cloth quads fixed to solid
    // walls. They carry no architecture and are deliberately not called shells.
    for(const [x,y,w,h,z] of [[512,148,27,44,148],[448,162,12,24,99],
      [573,168,11,24,99]]){
      polygon('heraldic cloth',[[x-w/2,y,z],[x+w/2,y,z],
        [x+w/2,y+h,z],[x-w/2,y+h,z]],paint);
    }
    for(const [material,batch] of batches){
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uv,2));
      geo.setAttribute('normal',new THREE.Float32BufferAttribute(batch.normals,3));
      building.add(new THREE.Mesh(geo,material));
    }
    metrics.meshBatches=batches.size;
    const screenshot=()=>{
      const cv=document.createElement('canvas');cv.width=W;cv.height=H;
      const ctx=cv.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(renderer.domElement,0,0);
      return ctx.getImageData(0,0,W,H).data;
    };
    const meanDiff=(a,b,predicate)=>{
      let sum=0,count=0;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        if(!predicate(x,y))continue;
        const n=4*(y*W+x);
        sum+=(Math.abs(a[n]-b[n])+Math.abs(a[n+1]-b[n+1])+
          Math.abs(a[n+2]-b[n+2]))/3;
        count++;
      }
      return sum/count;
    };
    const roi=(x,y)=>x>=375&&x<=650&&y>=63&&y<=275;
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;
    const ctx=cv.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(original.image,0,0);
    const source=ctx.getImageData(0,0,W,H).data;
    renderer.render(scene,camera);
    const referenceRender=screenshot();
    metrics.drawCalls=renderer.info.render.calls;
    const pixelDifference={all:meanDiff(source,referenceRender,()=>true),
      roi:meanDiff(source,referenceRender,roi),
      outside:meanDiff(source,referenceRender,(x,y)=>!roi(x,y))};
    lightDir.set(.48,.63,.60).normalize();sun.position.x=260;
    renderer.render(scene,camera);
    const opposite=screenshot();
    const lightDifference=meanDiff(referenceRender,opposite,roi);
    lightDir.set(-.48,.63,.60).normalize();sun.position.x=-260;
    renderer.render(scene,camera);
    window.setPrototypeLight=side=>{
      const x=Math.max(-1,Math.min(1,Number(side)||0));
      lightDir.set(x*.48,.63,.60).normalize();sun.position.x=x*260;
      renderer.render(scene,camera);
    };
    stage.addEventListener('pointermove',event=>{
      const bounds=stage.getBoundingClientRect();
      window.setPrototypeLight(2*(event.clientX-bounds.left)/bounds.width-1);
    });
    const result={...metrics,yaw,pixelDifference,lightDifference,
      closedShells:metrics.shells.length,roofSlopeCount:metrics.roofNormals.length,
      geometry:'silver stone palace, twin naves, three turrets, sloped roofs'};
    window.prototypeMetrics=result;
    document.documentElement.dataset.metrics=encodeURIComponent(JSON.stringify({
      era:result.era,yaw:result.yaw,triangles:result.triangles,
      closedShells:result.closedShells,roofSlopeCount:result.roofSlopeCount,
      roofNormals:result.roofNormals,meshBatches:result.meshBatches,
      drawCalls:result.drawCalls,depthRange:result.depthRange,
      paintedFaces:result.paintedFaces,solidSideFaces:result.solidSideFaces,
      pixelDifference:result.pixelDifference,lightDifference:result.lightDifference
    }));
    status.textContent=`白银实体 ${yaw}° · ${metrics.triangles} 面 · 中央差 ${pixelDifference.roi.toFixed(1)}`;
    document.documentElement.dataset.ready='1';
  }).catch(error=>{
    console.error(error);status.textContent='样板失败';
    document.documentElement.dataset.error=String(error);
  });
})();
