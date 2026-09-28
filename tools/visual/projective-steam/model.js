'use strict';
// Isolated Steam Age town hall study. Editable solid geometry; the game does
// not import this file. A fixed reference camera projects the shipped painting
// onto the near faces while the unseen roof and brick sides use local UVs.
(() => {
  const W = 1024, H = 525;
  const stage = document.getElementById('stage');
  const status = document.getElementById('status');
  const query = new URLSearchParams(location.search);
  const yaw = Math.max(-8, Math.min(8, Number(query.get('yaw') || 0)));
  const clayMode = query.get('mode') === 'clay';
  const originalUrl = '../../../assets/art/scene/town-sci_steam_age.png';
  const cleanUrl = '../../../assets/art/scene/candidates/town-sci_steam_age-clean-candidate.png';
  const fit = () => {
    stage.style.transform = `translate(-50%, -50%) scale(${Math.max(innerWidth / W, innerHeight / H)})`;
  };
  addEventListener('resize', fit); fit();
  if (query.get('mode') === 'original') {
    const image = new Image(); image.src = originalUrl; stage.append(image);
    image.onload = () => { status.textContent = '蒸汽时代原画'; document.documentElement.dataset.ready = '1'; };
    image.onerror = () => { document.documentElement.dataset.error = 'original image'; };
    return;
  }
  if (!window.THREE) { document.documentElement.dataset.error = 'Three.js'; return; }

  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.outputEncoding = THREE.LinearEncoding;
  stage.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb4d7d6);
  const camera = new THREE.OrthographicCamera(-W/2, W/2, H/2, -H/2, 1, 2000);
  camera.position.set(W/2, H/2, 1000);
  camera.lookAt(W/2, H/2, 0);
  const load = url => new Promise((resolve, reject) =>
    new THREE.TextureLoader().load(url, resolve, undefined, reject));
  Promise.all([load(originalUrl), load(cleanUrl)]).then(([original, clean]) => {
    for (const texture of [original, clean]) {
      texture.encoding = THREE.LinearEncoding;
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
    }
    // The rest of the map remains the original panorama. At a turned camera,
    // the cleared candidate only replaces the footprint behind the hall.
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(W,H), new THREE.ShaderMaterial({
      uniforms: {original: {value: original}, clean: {value: clean},
        clearance: {value: clayMode ? 1 : .035 + .87 * Math.abs(yaw) / 8}},
      vertexShader: 'varying vec2 u;void main(){u=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform sampler2D original,clean;uniform float clearance;
        varying vec2 u;
        float oval(vec2 p,vec2 c,vec2 r){vec2 d=(p-c)/r;return 1.-smoothstep(.73,1.08,dot(d,d));}
        void main(){vec2 p=vec2(u.x*1024.,(1.-u.y)*525.);
          float base=oval(p,vec2(520.,206.),vec2(128.,81.));
          float tower=oval(p,vec2(515.,108.),vec2(43.,83.));
          float wing=max(oval(p,vec2(431.,191.),vec2(52.,67.)),
                         oval(p,vec2(610.,191.),vec2(52.,67.)));
          float steps=oval(p,vec2(516.,248.),vec2(53.,27.));
          float mask=max(max(base,tower),max(wing,steps));
          gl_FragColor=mix(texture2D(original,u),texture2D(clean,u),clearance*mask);
        }`
    }));
    backdrop.position.set(W/2,H/2,-45); scene.add(backdrop);
    const pivot = new THREE.Group(); pivot.position.set(512,H-211,0); scene.add(pivot);
    const hall = new THREE.Group(); hall.position.set(-512,-(H-211),0); pivot.add(hall);
    pivot.rotation.y = yaw*Math.PI/180;

    const light = new THREE.Vector3(-.51,.67,.55).normalize();
    const vertex = 'varying vec2 vUv;varying vec3 vNormal;void main(){vUv=uv;vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
    const fragment = `uniform sampler2D picture;uniform vec3 lightDir;uniform float shade;
      uniform vec3 tint;uniform float tintWeight;
      varying vec2 vUv;varying vec3 vNormal;
      void main(){vec3 color=mix(texture2D(picture,vUv).rgb,tint,tintWeight);
        float lit=max(0.,dot(normalize(vNormal),lightDir));
        gl_FragColor=vec4(color*(1.-shade*.48+shade*lit),1.);
      }`;
    const picture = (strength,tint=0xffffff,tintWeight=0) => new THREE.ShaderMaterial({
      uniforms: {picture: {value: original}, lightDir: {value: light},
        shade: {value: strength}, tint: {value: new THREE.Color(tint)},
        tintWeight: {value: tintWeight}},
      vertexShader: vertex, fragmentShader: fragment, side: THREE.DoubleSide
    });
    const accentStrength=.20+.75*Math.abs(yaw)/8;
    const frontPaint = picture(0);
    const brickSide = picture(.12);
    const blueSide = picture(.14);
    const paleStone = picture(.08,0xc7bd9d,accentStrength);
    const shadowStone = picture(.10,0x8e806a,accentStrength);
    const copper = picture(.12,0xc28a3e,accentStrength);
    const chimney = picture(.10,0xd7cbb4,accentStrength);
    const clay = new THREE.MeshNormalMaterial({side: THREE.DoubleSide});
    const sun = new THREE.DirectionalLight(0xfff1d5,.88);
    sun.position.set(-280,220,400); scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff,.58));
    const batches = new Map();
    const metrics = {triangles:0,closedShells:0,paintedFaces:0,sideFaces:0,
      roofNormals:[],depthRange:[Infinity,-Infinity],parts:[]};
    const projectedUV = p => [p[0]/W,1-p[1]/H];
    function materialUV(points,material){
      const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),zs=points.map(p=>p[2]);
      const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
      const z0=Math.min(...zs),z1=Math.max(...zs);
      const byX=x1-x0>=z1-z0;
      return points.map(p=>{
        const u=byX?(p[0]-x0)/Math.max(1,x1-x0):(p[2]-z0)/Math.max(1,z1-z0);
        const v=(p[1]-y0)/Math.max(1,y1-y0);
        if(material===blueSide)return [(551+u*55)/W,1-(133+v*38)/H];
        return [(454+u*44)/W,1-(180+v*55)/H];
      });
    }
    function face(name,points,material=frontPaint){
      if(points.length<3)throw Error(name+' has fewer than three vertices');
      const positions=[],uvs=[],indices=[];
      const local=material===brickSide||material===blueSide ? materialUV(points,material):null;
      // The reference camera is an art-directed projection. At that exact
      // view every visible face samples its source pixel; a camera turn fades
      // unseen brick/slate faces toward their own local unwrap.
      const localWeight=Math.pow(Math.abs(yaw)/8,.7);
      points.forEach((p,i)=>{
        positions.push(p[0],H-p[1],p[2]);
        const projected=projectedUV(p);
        uvs.push(...(local?[
          projected[0]*(1-localWeight)+local[i][0]*localWeight,
          projected[1]*(1-localWeight)+local[i][1]*localWeight
        ]:projected));
        metrics.depthRange[0]=Math.min(metrics.depthRange[0],p[2]);
        metrics.depthRange[1]=Math.max(metrics.depthRange[1],p[2]);
      });
      for(let i=1;i<points.length-1;i++)indices.push(0,i,i+1);
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      geometry.setIndex(indices); geometry.computeVertexNormals();
      const key=clayMode?clay:material;
      if(!batches.has(key))batches.set(key,{positions:[],uvs:[],normals:[]});
      const batch=batches.get(key),normals=geometry.getAttribute('normal');
      for(const i of indices){
        batch.positions.push(...positions.slice(i*3,i*3+3));
        batch.uvs.push(...uvs.slice(i*2,i*2+2));
        batch.normals.push(normals.getX(i),normals.getY(i),normals.getZ(i));
      }
      geometry.dispose();
      metrics.triangles+=points.length-2;
      if(material===frontPaint)metrics.paintedFaces++;
      if(material===brickSide||material===blueSide)metrics.sideFaces++;
    }
    function shell(name,front,back,side=brickSide,frontMaterial=frontPaint){
      if(front.length!==back.length)throw Error(name+' shell rings differ');
      face(name+' front',front,frontMaterial);
      face(name+' rear',[...back].reverse(),side);
      for(let i=0;i<front.length;i++){
        const j=(i+1)%front.length;
        face(name+' edge '+i,[front[i],front[j],back[j],back[i]],side);
      }
      metrics.closedShells++;
      metrics.parts.push(name);
    }
    function block(name,x0,y0,x1,y1,zFront,zBack,backRise,side=brickSide,frontMaterial=frontPaint){
      shell(name,[[x0,y0,zFront],[x1,y0,zFront],[x1,y1,zFront],[x0,y1,zFront]],
        [[x0+3,y0-backRise,zBack],[x1-3,y0-backRise,zBack],
         [x1-3,y1-backRise,zBack],[x0+3,y1-backRise,zBack]],side,frontMaterial);
    }
    function roof(name,front,thickness=7){
      const back=front.map(([x,y,z])=>[x,y+2,z-thickness]);
      shell(name,front,back,blueSide);
      const a=new THREE.Vector3(...front[0]);
      const b=new THREE.Vector3(...front[1]);
      const c=new THREE.Vector3(...front[2]);
      metrics.roofNormals.push(b.sub(a).cross(c.sub(a)).normalize().toArray());
    }
    function trim(name,x0,y0,x1,y1,z,depth=5,material=copper){
      shell(name,[[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]],
        [[x0,y0+2,z-depth],[x1,y0+2,z-depth],
         [x1,y1+2,z-depth],[x0,y1+2,z-depth]],material,material);
    }

    // Stepped brick civic hall, not the domed Gold hall or the Iron castle.
    block('left brick wing',420,166,481,230,83,15,25);
    block('right brick wing',552,166,621,230,82,15,25);
    block('central masonry facade',466,156,564,226,94,20,31);
    block('deep entry arcade',487,176,545,226,105,68,7);
    block('left short annex',404,185,444,220,65,16,16);
    block('right short annex',601,181,636,218,64,15,17);

    // Four independent pitched roof groups and a raised center gable.
    roof('left blue roof forward',[[416,164,84],[440,132,36],[474,134,35],[486,171,101]]);
    roof('left blue roof rear',[[440,132,36],[453,124,11],[479,125,11],[474,134,35]]);
    roof('right blue roof forward',[[550,170,102],[558,135,36],[594,132,36],[625,166,83]]);
    roof('right blue roof rear',[[558,135,36],[570,126,12],[597,123,12],[594,132,36]]);
    roof('center gable left',[[466,155,97],[492,119,42],[512,126,40],[512,162,106]]);
    roof('center gable right',[[512,162,106],[512,126,40],[541,120,42],[565,155,96]]);
    for(const [name,x0,y0,x1,y1,z] of [
      ['west copper eave',416,164,483,170,107],
      ['east copper eave',552,164,628,170,107],
      ['central copper eave',466,157,565,163,112]
    ])trim(name,x0,y0,x1,y1,z,4,copper);

    // Eight wall panels and capped upper/lower rings give the clock tower
    // an actual octagonal cross section. Its clock is an embossed closed disk.
    const towerTop=[],towerBottom=[],n=8,cx=516,cz=69,rx=27,rz=27;
    for(let i=0;i<n;i++){
      const angle=2*Math.PI*i/n+Math.PI/8;
      const x=cx+rx*Math.cos(angle),z=cz+rz*Math.sin(angle);
      towerTop.push([x,83,z]);towerBottom.push([x,177,z]);
    }
    for(let i=0;i<n;i++){
      const j=(i+1)%n;
      shell('clock tower brick facet '+i,
        [towerTop[i],towerTop[j],towerBottom[j],towerBottom[i]],
        [[towerTop[i][0],83,towerTop[i][2]-2],
         [towerTop[j][0],83,towerTop[j][2]-2],
         [towerBottom[j][0],177,towerBottom[j][2]-2],
         [towerBottom[i][0],177,towerBottom[i][2]-2]],brickSide);
    }
    face('tower upper cap',towerTop,paleStone);
    face('tower lower cap',[...towerBottom].reverse(),shadowStone);
    trim('clock tower cornice',486,82,546,89,105,7,copper);
    const clockFront=[],clockBack=[];
    for(let i=0;i<16;i++){
      const a=2*Math.PI*i/16;
      clockFront.push([516+15*Math.cos(a),132+15*Math.sin(a),111]);
      clockBack.push([516+15*Math.cos(a),132+15*Math.sin(a),106]);
    }
    shell('projected clock face',clockFront,clockBack,copper);
    const domeTop=[516,43,77],domeMid=[],domeBase=[];
    for(let i=0;i<n;i++){
      const a=2*Math.PI*i/n+Math.PI/8;
      domeMid.push([516+18*Math.cos(a),56,72+18*Math.sin(a)]);
      domeBase.push([516+30*Math.cos(a),83,69+30*Math.sin(a)]);
    }
    for(let i=0;i<n;i++){
      const j=(i+1)%n;
      roof('clock cupola upper facet '+i,[domeTop,domeMid[i],domeMid[j]],5);
      roof('clock cupola lower facet '+i,[domeMid[i],domeBase[i],domeBase[j],domeMid[j]],6);
    }
    trim('clock finial',514,32,518,47,105,4,copper);

    // Shallow exposed copper heating conduits and two pale short chimneys
    // remain legible at the real 320–390px map widths.
    for(const [name,x,y] of [['west',451,113],['east',580,112]]){
      block(name+' limestone chimney',x-4,y,x+4,y+25,71,59,3,chimney,chimney);
      trim(name+' copper chimney cap',x-7,y-3,x+7,y+2,76,7,copper);
      trim(name+' chimney collar',x-5,y+19,x+5,y+23,74,4,copper);
    }
    for(const [name,x0,x1,y] of [
      ['west roof pipe',433,472,173],['east roof pipe',560,611,173],
      ['west facade pipe',437,472,210],['east facade pipe',560,607,210]
    ])trim(name,x0,y,x1,y+3,114,5,copper);
    for(const [name,x,y0,y1] of [
      ['west downpipe',441,174,211],['east downpipe',604,174,211]
    ])trim(name,x,y0,x+3,y1,115,4,copper);

    // Arched entrance piers, stone parapet and stepped approach, all thick.
    for(const x of [472,489,543,561]){
      trim('stone portal pier '+x,x-3,179,x+3,225,116,8,paleStone);
    }
    for(let i=0;i<5;i++){
      const y=224+i*6.2,half=24+i*2,z=111-i*9;
      shell('entry step '+(i+1),
        [[516-half,y,z],[516+half,y,z],[516+half+1,y+6,z],[516-half-1,y+6,z]],
        [[516-half,y+2,z-7],[516+half,y+2,z-7],
         [516+half+1,y+8,z-7],[516-half-1,y+8,z-7]],paleStone);
    }
    for(const [material,batch] of batches){
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uvs,2));
      geometry.setAttribute('normal',new THREE.Float32BufferAttribute(batch.normals,3));
      hall.add(new THREE.Mesh(geometry,material));
    }
    metrics.meshBatches=batches.size;

    const sample=()=>{
      renderer.render(scene,camera);
      const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
      const context=canvas.getContext('2d',{willReadFrequently:true});
      context.drawImage(renderer.domElement,0,0);
      return context.getImageData(0,0,W,H).data;
    };
    const meanDiff=(a,b,predicate)=>{
      let total=0,count=0;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        if(!predicate(x,y))continue;
        const i=4*(y*W+x);
        total+=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;
        count++;
      }
      return total/count;
    };
    const source=document.createElement('canvas');source.width=W;source.height=H;
    const context=source.getContext('2d',{willReadFrequently:true});
    context.drawImage(original.image,0,0,W,H);
    const reference=context.getImageData(0,0,W,H).data;
    const rendered=sample();metrics.drawCalls=renderer.info.render.calls;
    const roi=(x,y)=>x>=379&&x<=651&&y>=24&&y<=282;
    const pixelDifference={all:meanDiff(reference,rendered,()=>true),
      roi:meanDiff(reference,rendered,roi),
      outside:meanDiff(reference,rendered,(x,y)=>!roi(x,y))};
    light.set(.51,.67,.55).normalize();sun.position.x=280;
    const relit=sample();
    const lightDifference=meanDiff(rendered,relit,roi);
    const cupola=(x,y)=>x>=479&&x<=549&&y>=28&&y<=153;
    const clockLightDifference=meanDiff(rendered,relit,cupola);
    light.set(-.51,.67,.55).normalize();sun.position.x=-280;
    renderer.render(scene,camera);
    const result={...metrics,yaw,pixelDifference,lightDifference,clockLightDifference};
    window.prototypeMetrics=result;
    document.documentElement.dataset.metrics=encodeURIComponent(JSON.stringify(result));
    status.textContent=`蒸汽主楼实体 ${yaw}° · ${result.triangles} 面 · 主楼差 ${pixelDifference.roi.toFixed(1)}`;
    document.documentElement.dataset.ready='1';
  }).catch(error=>{
    console.error(error);status.textContent='三维样板加载失败';
    document.documentElement.dataset.error=String(error);
  });
})();
