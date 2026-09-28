'use strict';
// Isolated Bronze Age study: solid geometry with projective paint from the
// existing panorama. The game does not import this candidate.
(() => {
  const W = 1024, H = 525;
  const stage = document.getElementById('stage');
  const status = document.getElementById('status');
  const query = new URLSearchParams(location.search);
  const yaw = Math.max(-8, Math.min(8, Number(query.get('yaw') || 0)));
  const refine = true;
  const edgeMask = false;
  const clayMode = query.get('mode') === 'clay';
  const lightSide = query.get('light') === 'right' ? 1 : -1;
  const originalUrl = '../../../assets/art/scene/town-sci_bronze_age.png';
  const cleanUrl = '../../../assets/art/scene/candidates/town-sci_bronze_age-clean-candidate.png';
  const roofUrl = '../../../assets/art/source/models/era_town_bronze/bronze-material-atlas-runtime.png';
  function fit() {
    const scale = Math.max(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
  addEventListener('resize', fit);
  fit();
  if (query.get('mode') === 'original') {
    const image = new Image(); image.src = originalUrl; stage.append(image);
    image.onload = () => { status.textContent = '当前原画'; document.documentElement.dataset.ready = '1'; };
    image.onerror = () => { document.documentElement.dataset.error = 'original'; };
    return;
  }
  if (!window.THREE) { document.documentElement.dataset.error = 'three'; return; }

  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.outputEncoding = THREE.LinearEncoding;
  stage.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b4d8cf');
  const camera = new THREE.OrthographicCamera(-W/2, W/2, H/2, -H/2, 1, 2000);
  camera.position.set(W/2, H/2, 1000);
  camera.lookAt(W/2, H/2, 0);
  const loader = new THREE.TextureLoader();
  const getTexture = url => new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
  Promise.all([getTexture(originalUrl), getTexture(cleanUrl),
    getTexture(roofUrl)]).then(([original, clean, atlas]) => {
    for (const t of [original, clean, atlas]) {
      t.encoding = THREE.LinearEncoding;
      t.minFilter = t.magFilter = THREE.LinearFilter;
    }

    // Only the hall footprint uses the alternate cleared art. Outside the
    // feathered ellipse the actual shipped panorama is copied without drift.
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.ShaderMaterial({
      uniforms: {original: {value: original}, clean: {value: clean},
        clearStrength: {value: refine ? .04 + .66*Math.abs(yaw)/8 : 1},
        edgeMask: {value: edgeMask ? 1 : 0},
        yawTurn: {value: Math.abs(yaw)/8}},
      vertexShader: `varying vec2 uv0; void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform sampler2D original,clean;
        uniform float clearStrength,edgeMask,yawTurn;varying vec2 uv0;
        void main(){vec2 p=vec2(uv0.x*1024.,(1.-uv0.y)*525.);
          float roof=length(vec2((p.x-521.)/89.,(p.y-157.)/83.));
          float yard=length(vec2((p.x-519.)/136.,(p.y-220.)/80.));
          float entry=length(vec2((p.x-519.)/49.,(p.y-253.)/45.));
          float w=max(max(1.-smoothstep(.83,1.,roof),
            1.-smoothstep(.87,1.,yard)),1.-smoothstep(.77,1.,entry));
          float core=max(1.-smoothstep(.60,.84,roof),
            .75*(1.-smoothstep(.63,.86,yard)));
          float selectiveStrength=.04+yawTurn*(.34+.54*core);
          float strength=mix(clearStrength,selectiveStrength,edgeMask);
          gl_FragColor=mix(texture2D(original,uv0),texture2D(clean,uv0),w*strength);
        }`
    }));
    backdrop.position.set(W/2, H/2, -20);
    scene.add(backdrop);

    const pivot = new THREE.Group();
    pivot.position.set(512, H-216, 0);
    scene.add(pivot);
    const hall = new THREE.Group();
    hall.position.set(-512, -(H-216), 0);
    pivot.add(hall);
    pivot.rotation.y = yaw * Math.PI / 180;

    const uniforms = {
      original: {value: original},
      lightDir: {value: new THREE.Vector3(lightSide*.46, .63, .62).normalize()},
      lightStrength: {value: .13}
    };
    const surfaceVertex = `varying vec2 uv0;varying vec3 n0;
        void main(){uv0=uv;n0=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      surfaceFragment = `uniform sampler2D original;uniform vec3 lightDir;uniform float lightStrength;
        varying vec2 uv0;varying vec3 n0;
        void main(){vec3 c=texture2D(original,uv0).rgb;
          float lam=max(0.,dot(normalize(n0),lightDir));
          float shade=1.-lightStrength*.55+lightStrength*lam;
          gl_FragColor=vec4(c*shade,1.);
        }`;
    const surfaceMaterial = texture => new THREE.ShaderMaterial({
      uniforms:{original:{value:texture},lightDir:uniforms.lightDir,
        lightStrength:uniforms.lightStrength},
      side:THREE.DoubleSide,vertexShader:surfaceVertex,fragmentShader:surfaceFragment
    });
    const paint=surfaceMaterial(original);
    const roofPaint=surfaceMaterial(atlas);
    const wallPaint=surfaceMaterial(atlas);
    const warmWood = new THREE.MeshLambertMaterial({color: 0x9e652e, side: THREE.DoubleSide});
    const darkWood = new THREE.MeshLambertMaterial({color: 0x684421, side: THREE.DoubleSide});
    const roofEdge = new THREE.MeshLambertMaterial({color: 0xae8748, side: THREE.DoubleSide});
    const stone = new THREE.MeshLambertMaterial({color: 0xb6b09a, side: THREE.DoubleSide});
    const clay = new THREE.MeshNormalMaterial({side: THREE.DoubleSide});
    const sun = new THREE.DirectionalLight(0xffffff, .8);
    sun.position.set(lightSide*250, 190, 400); scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, .55));
    const metrics = {triangles: 0, shells: [], texturedFaces: 0, generatedFaces: 0,
      roofNormals: [], depthRange: [Infinity, -Infinity]};
    const batches = new Map();
    function vector(p) {return new THREE.Vector3(p[0], H-p[1], p[2]);}
    function projectedUV(p) {return [p[0]/W, 1-p[1]/H];}
    function surfaceUV(points,material) {
      // Stable local unwrap: vertical wood planks stay upright on side walls;
      // roof shingles follow the local slope. A small central portion of each
      // generated master keeps pattern scale legible in the 360px map.
      const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]), zs=points.map(p=>p[2]);
      const minX=Math.min(...xs), maxX=Math.max(...xs);
      const minY=Math.min(...ys), maxY=Math.max(...ys);
      const minZ=Math.min(...zs), maxZ=Math.max(...zs);
      const useX=maxX-minX>=maxZ-minZ;
      return points.map(p=>{
        const u=useX?(p[0]-minX)/Math.max(1,maxX-minX):
          (p[2]-minZ)/Math.max(1,maxZ-minZ);
        const v=(p[1]-minY)/Math.max(1,maxY-minY);
        return material===roofPaint?[.54+u*.42,.54+v*.42]:
          [.04+u*.42,.54+v*.42];
      });
    }
    function polygon(name, points, material=paint, uvs) {
      const positions=[], uv=[], indices=[];
      const localUVs=uvs||((material===roofPaint||material===wallPaint)?
        surfaceUV(points,material):null);
      points.forEach((p,i)=>{
        positions.push(p[0],H-p[1],p[2]);
        const coord=localUVs?localUVs[i]:projectedUV(p);
        uv.push(coord[0],coord[1]);
        metrics.depthRange[0]=Math.min(metrics.depthRange[0],p[2]);
        metrics.depthRange[1]=Math.max(metrics.depthRange[1],p[2]);
      });
      for(let i=1;i<points.length-1;i++)indices.push(0,i,i+1);
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      geo.setIndex(indices);geo.computeVertexNormals();
      const key=clayMode?clay:material;
      if(!batches.has(key))batches.set(key,{positions:[],uvs:[],normals:[]});
      const batch=batches.get(key),normal=geo.getAttribute('normal');
      for(const index of indices){
        batch.positions.push(...positions.slice(index*3,index*3+3));
        batch.uvs.push(...uv.slice(index*2,index*2+2));
        batch.normals.push(normal.getX(index),normal.getY(index),normal.getZ(index));
      }
      geo.dispose();
      metrics.triangles+=points.length-2;
      if(material===paint)metrics.texturedFaces++;
      if(material===roofPaint||material===wallPaint)metrics.generatedFaces++;
      return name;
    }
    // Closed extruded polygon shell. Image coordinates describe the true
    // reference-view outline. Side and reverse faces are separate solid faces.
    function shell(name, front, back, sideMaterial, faceMaterial=paint) {
      if(front.length!==back.length)throw Error(name+' has mismatched shell rings');
      polygon(name+' visible paint',front,faceMaterial);
      polygon(name+' reverse',back,sideMaterial);
      for(let i=0;i<front.length;i++){
        const j=(i+1)%front.length;
        polygon(name+' thickness '+i,[front[i],front[j],back[j],back[i]],sideMaterial);
      }
      metrics.shells.push({name,vertices:front.length,closed:true,
        depthFront:front.map(p=>p[2]),depthBack:back.map(p=>p[2])});
    }
    function roof(name,front,thickness=7){
      const back=front.map(p=>[p[0],p[1]+3,p[2]-thickness]);
      shell(name,front,back,roofPaint);
      const normal=vector(front[1]).sub(vector(front[0])).cross(
        vector(front[2]).sub(vector(front[0]))).normalize();
      metrics.roofNormals.push([normal.x,normal.y,normal.z]);
    }

    // The stone forecourt has an open centre, raised edges and real side walls.
    const rim=[[416,230,16],[443,194,16],[467,182,16],[573,182,16],
      [605,195,16],[625,225,16],[611,259,16],[561,278,16],
      [476,278,16],[426,259,16]];
    const inner=rim.map(p=>[519+(p[0]-519)*.63,229+(p[1]-229)*.60,16]);
    for(let i=0;i<rim.length;i++){
      const j=(i+1)%rim.length;
      const wedge=[rim[i],rim[j],inner[j],inner[i]];
      shell('stone courtyard segment '+i,wedge,
        wedge.map(p=>[p[0],p[1]+2,7]),stone);
    }

    // Main temple: projected front paint is backed by solid masonry, two
    // separate roof pitches and independently textured rear/side faces.
    shell('bronze front gable',[[521,145,80],[578,190,71],[462,190,71]],
      [[521,137,26],[567,181,26],[473,181,26]],wallPaint);
    shell('bronze front wall',[[462,189,73],[578,189,73],[579,232,70],[460,232,70]],
      [[470,182,24],[570,182,24],[570,223,24],[470,223,24]],wallPaint);
    shell('bronze left wall',[[460,186,69],[461,126,30],[466,125,30],[462,232,69]],
      [[467,181,61],[468,127,23],[473,126,23],[469,228,61]],wallPaint);
    shell('bronze right wall',[[579,186,69],[581,127,30],[576,126,30],[579,232,69]],
      [[572,181,61],[574,127,23],[569,126,23],[572,228,61]],wallPaint);
    roof('teal left roof pitch',[[520,104,35],[459,124,30],[459,184,69],[521,145,92]],8);
    roof('copper right roof pitch',[[521,145,92],[584,186,69],[583,126,30],[520,104,35]],8);
    for(const [name,a,b] of [
      ['left eave',[459,184,72],[521,144,96]],
      ['right eave',[521,144,96],[584,185,72]],
      ['left back eave',[459,124,33],[520,103,38]],
      ['right back eave',[520,103,38],[583,126,33]]
    ]){
      const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      const nx=-dy/length*2.4,ny=dx/length*2.4;
      const front=[[a[0]-nx,a[1]-ny,a[2]],[b[0]-nx,b[1]-ny,b[2]],
        [b[0]+nx,b[1]+ny,b[2]],[a[0]+nx,a[1]+ny,a[2]]];
      shell(name+' copper fascia',front,front.map(p=>[p[0],p[1]+1,p[2]-7]),roofEdge);
    }
    shell('bronze ridge cap',[[518,103,40],[522,103,40],[523,145,97],[519,145,97]],
      [[518,105,33],[522,105,33],[523,147,90],[519,147,90]],roofEdge);
    shell('masonry plinth',[[448,222,73],[591,222,73],[597,251,67],[442,251,67]],
      [[456,217,18],[583,217,18],[587,245,18],[452,245,18]],stone);

    // Eight real steps descend from the Bronze hall into the forecourt.
    for(let i=0;i<8;i++){
      const y=229+i*5.6, half=23+i*1.0, z=77-i*5;
      shell('stone stair '+(i+1),
        [[520-half,y,z],[520+half,y,z],[520+half+1,y+5,z],[520-half-1,y+5,z]],
        [[520-half,y+1,z-5],[520+half,y+1,z-5],[520+half+1,y+6,z-5],[520-half-1,y+6,z-5]],stone);
    }
    for(const side of [-1,1]){
      const x=520+side*34;
      shell((side<0?'left':'right')+' stair cheek',
        [[x-3,229,76],[x+3,229,76],[x+4,274,33],[x-4,274,33]],
        [[x-3,232,69],[x+3,232,69],[x+4,277,26],[x-4,277,26]],stone);
    }
    // Four portico columns and the circular bronze seal have depth. The
    // original front paint is kept, while the exposed sides use solid metal.
    for(const x of [477,490,551,564]){
      shell('stone portico column '+x,
        [[x-3,189,82],[x+3,189,82],[x+3,229,82],[x-3,229,82]],
        [[x-3,189,70],[x+3,189,70],[x+3,229,70],[x-3,229,70]],stone);
    }
    const bronzeSeal=[];
    for(let i=0;i<12;i++){
      const a=i*Math.PI*2/12;
      bronzeSeal.push([524+16*Math.cos(a),181+16*Math.sin(a),88]);
    }
    shell('bronze seal',bronzeSeal,bronzeSeal.map(p=>[p[0],p[1],p[2]-7]),roofEdge);
    // Banners are thin cloth decoration on the solid walls.
    for(const [x,y,w,h,z] of [[486,190,11,35,90],[564,190,11,35,90],
      [455,250,9,29,39],[584,249,9,29,39]]){
      polygon('cloth flag',[[x-w/2,y,z],[x+w/2,y,z],[x+w/2,y+h,z],[x-w/2,y+h,z]],paint);
    }
    for(const [material,batch] of batches){
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uvs,2));
      geometry.setAttribute('normal',new THREE.Float32BufferAttribute(batch.normals,3));
      hall.add(new THREE.Mesh(geometry,material));
    }
    metrics.meshBatches=batches.size;

    const sample = () => {
      const source=document.createElement('canvas');source.width=W;source.height=H;
      const context=source.getContext('2d',{willReadFrequently:true});
      context.drawImage(renderer.domElement,0,0);
      return context.getImageData(0,0,W,H).data;
    };
    const meanDiff = (a,b,accept) => {
      let sum=0,count=0;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        if(!accept(x,y))continue;
        const i=4*(y*W+x);
        sum+=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;
        count++;
      }
      return sum/count;
    };
    const roi=(x,y)=>x>=350&&x<=675&&y>=90&&y<=360;
    const source=document.createElement('canvas');source.width=W;source.height=H;
    const sourceContext=source.getContext('2d',{willReadFrequently:true});
    sourceContext.drawImage(original.image,0,0);
    const reference=sourceContext.getImageData(0,0,W,H).data;
    renderer.render(scene,camera);
    const rendered=sample();
    metrics.drawCalls=renderer.info.render.calls;
    const pixelDifference={
      all:meanDiff(reference,rendered,()=>true),
      roi:meanDiff(reference,rendered,roi),
      outside:meanDiff(reference,rendered,(x,y)=>!roi(x,y))
    };
    uniforms.lightDir.value.set(-lightSide*.46,.63,.62).normalize();
    sun.position.x=-sun.position.x;
    renderer.render(scene,camera);
    const oppositeLight=sample();
    const lightDifference=meanDiff(rendered,oppositeLight,roi);
    uniforms.lightDir.value.set(lightSide*.46,.63,.62).normalize();
    sun.position.x=-sun.position.x;
    renderer.render(scene,camera);
    const setLight=x=>{
      const side=Math.max(-1,Math.min(1,x));
      uniforms.lightDir.value.set(side*.46,.63,.62).normalize();
      sun.position.x=side*250;
      renderer.render(scene,camera);
    };
    stage.addEventListener('pointermove',event=>{
      const bounds=stage.getBoundingClientRect();
      setLight(2*(event.clientX-bounds.left)/bounds.width-1);
    });
    window.setPrototypeLight=setLight;
    const result={...metrics,yaw,lightSide,refine,pixelDifference,lightDifference,
      closedShells:metrics.shells.length,realRoofSlopes:2,
      geometry:'closed 3D shells + roof planes, wall depth, posts and stairs'};
    window.prototypeMetrics=result;
    document.documentElement.dataset.metrics=encodeURIComponent(JSON.stringify({
      triangles:result.triangles,closedShells:result.closedShells,
      texturedFaces:result.texturedFaces,generatedFaces:result.generatedFaces,
      roofNormals:result.roofNormals,
      depthRange:result.depthRange,meshBatches:result.meshBatches,
      drawCalls:result.drawCalls,pixelDifference,lightDifference,yaw,lightSide
    }));
    status.textContent=`主楼实体 ${yaw}° · ${result.triangles} 面 · 差 ${pixelDifference.all.toFixed(1)}/${pixelDifference.roi.toFixed(1)}`;
    document.documentElement.dataset.ready='1';
  }).catch(error=>{console.error(error);status.textContent='样板失败';document.documentElement.dataset.error=String(error);});
})();
