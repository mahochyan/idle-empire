'use strict';
// Isolated prototype: true shell geometry, projective texture from the existing
// town panorama, and a central clean-patch composited only in the browser.
// This source is the editable mesh source; the game does not import this file.
(() => {
  const W = 1024, H = 525;
  const stage = document.getElementById('stage');
  const status = document.getElementById('status');
  const query = new URLSearchParams(location.search);
  const yaw = Math.max(-8, Math.min(8, Number(query.get('yaw') || 0)));
  const refine = query.get('refine') === '1';
  const edgeMask = refine && query.get('edgeMask') === '1';
  const clayMode = query.get('mode') === 'clay';
  const lightSide = query.get('light') === 'right' ? 1 : -1;
  const originalUrl = '../../../assets/art/scene/town-base.png';
  const cleanUrl = '../../../assets/art/scene/candidates/town-base-clean-candidate.png';
  const roofUrl = '../../../assets/art/scene/candidates/town-base-projective-roof-candidate.png';
  const wallUrl = '../../../assets/art/scene/candidates/town-base-projective-wall-candidate.png';
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
    getTexture(roofUrl), getTexture(wallUrl)]).then(([original, clean, roofTexture, wallTexture]) => {
    for (const t of [original, clean, roofTexture, wallTexture]) {
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
          float roof=length(vec2((p.x-512.)/105.,(p.y-172.)/78.));
          float yard=length(vec2((p.x-512.)/137.,(p.y-219.)/67.));
          float entry=length(vec2((p.x-512.)/39.,(p.y-266.)/39.));
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
    const roofPaint=surfaceMaterial(roofTexture);
    const wallPaint=surfaceMaterial(wallTexture);
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
        return material===roofPaint?[.20+u*.60,.18+v*.60]:
          [.14+u*.72,.10+v*.80];
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

    // A ring of raised courtyard stones surrounds an empty center. Avoid a
    // single painted hall image on a flat slab beneath the 3D building.
    const rim=[[385,231,22],[409,181,22],[459,164,22],[565,164,22],
      [615,183,22],[642,230,22],[614,270,22],[552,284,22],
      [470,284,22],[409,268,22]];
    const inner=rim.map(p=>[512+(p[0]-512)*.52,223+(p[1]-223)*.47,22]);
    for(let i=0;i<rim.length;i++){
      const j=(i+1)%rim.length;
      const wedge=[rim[i],rim[j],inner[j],inner[i]];
      shell('stone courtyard segment '+i,wedge,
        wedge.map(p=>[p[0],p[1]+2,7]),stone);
    }

    // Main longhouse: front painted gable and walls are real closed wall
    // volumes. At reference yaw, each painted vertex projects to the exact
    // source panorama coordinate. The rear and sides have their own faces.
    shell('front gable',[[513,138,74],[575,189,68],[451,189,68]],
      [[513,132,25],[564,180,25],[462,180,25]],wallPaint);
    shell('front wall',[[451,187,69],[575,187,69],[576,241,68],[449,241,68]],
      [[461,177,23],[565,177,23],[565,228,23],[461,228,23]],wallPaint);
    shell('left side wall',[[451,187,65],[463,155,32],[464,216,31],[449,241,65]],
      [[456,183,58],[468,153,25],[469,215,24],[454,239,58]],wallPaint);
    shell('right side wall',[[575,187,65],[563,155,32],[563,218,31],[576,241,65]],
      [[570,184,58],[558,153,25],[558,217,24],[571,239,58]],wallPaint);
    // Pitched roof comprises two independent four-sided slope solids, each
    // with an 8px fascia and physically different normals.
    roof('left pitched roof',[[512,119,47],[468,130,33],[428,188,65],[513,146,90]],8);
    roof('right pitched roof',[[513,146,90],[596,188,65],[556,130,33],[512,119,47]],8);
    if(refine){
      // The real roof has raised wooden fascia around both front eaves. Each
      // strip follows the painted outline at the reference camera and has
      // side/reverse faces, so its thickness remains visible during panning.
      for(const [name,a,b] of [
        ['left eave',[429,186,69],[513,145,94]],
        ['right eave',[513,145,94],[596,186,69]],
        ['left rear eave',[468,130,36],[512,118,50]],
        ['right rear eave',[512,118,50],[556,130,36]]
      ]){
        const dx=b[0]-a[0], dy=b[1]-a[1];
        const length=Math.hypot(dx,dy), nx=-dy/length*3, ny=dx/length*3;
        const front=[[a[0]-nx,a[1]-ny,a[2]],
          [b[0]-nx,b[1]-ny,b[2]],
          [b[0]+nx,b[1]+ny,b[2]],
          [a[0]+nx,a[1]+ny,a[2]]];
        shell(name+' timber fascia',front,front.map(p=>[p[0],p[1]+1,p[2]-7]),darkWood);
      }
      // Separate rounded ridge cap: the two roof pitches now meet under a
      // small solid timber beam instead of a visibly flat texture seam.
      shell('roof ridge cap',
        [[510,117,53],[514,117,53],[515,145,96],[511,145,96]],
        [[510,119,47],[514,119,47],[515,147,89],[511,147,89]],darkWood);
    }
    shell('lower stone plinth',[[442,229,72],[581,229,72],[588,259,67],[434,259,67]],
      [[454,220,18],[570,220,18],[575,252,18],[447,252,18]],stone);

    // The entry steps are separate closed wedges with depth and individually
    // projected paint; they descend toward the viewer.
    for(let i=0;i<7;i++){
      const y=247+i*6.6, half=20+i*1.2, z=76-i*6;
      shell('stone stair '+(i+1),
        [[512-half,y,z],[512+half,y,z],[512+half+1,y+5,z],[512-half-1,y+5,z]],
        [[512-half,y+1,z-5],[512+half,y+1,z-5],[512+half+1,y+6,z-5],[512-half-1,y+6,z-5]],stone);
    }
    if(refine){
      // Two low stone cheeks frame the stair. Their painted front remains
      // registered to the source image, while the sides show actual volume.
      for(const side of [-1,1]){
        const x=512+side*31;
        shell((side<0?'left':'right')+' stair cheek',
          [[x-3,247,76],[x+3,247,76],[x+4,286,37],[x-4,286,37]],
          [[x-3,250,69],[x+3,250,69],[x+4,289,30],[x-4,289,30]],stone);
      }
    }

    // Each stockade picket is a separate solid box with a painted front.
    // Side faces use warm timber, so turning the scene exposes actual depth.
    // The path opening in front is retained for the staircase.
    for(let i=0;i<52;i++){
      const a=2*Math.PI*i/52;
      const x=512+123*Math.cos(a), y=222+41*Math.sin(a);
      if(y>243&&Math.abs(x-512)<27)continue;
      const p=4.4, ht=18+(Math.sin(i*29.19)+1)*2.2;
      const z=31+15*Math.sin(a);
      shell('oak stockade '+i,
        [[x-p/2,y-ht,z+5],[x,y-ht-4,z+5],[x+p/2,y-ht,z+5],
          [x+p/2,y,z+5],[x-p/2,y,z+5]],
        [[x-p/2,y-ht,z-3],[x,y-ht-4,z-3],[x+p/2,y-ht,z-3],
          [x+p/2,y,z-3],[x-p/2,y,z-3]],darkWood);
    }

    // Narrow structural beams and facade details use painted surface strips.
    // These are mesh faces on the wall, not a cutout image of the whole hall.
    for(const x of [461,476,491,534,550,566]){
      shell('gable timber '+x,
        [[x-2,190,75],[x+2,190,75],[x+2,234,75],[x-2,234,75]],
        [[x-2,190,71],[x+2,190,71],[x+2,234,71],[x-2,234,71]],darkWood);
    }
    // Blue banners are intentionally 2D cloth fixed to solid buildings.
    // The architecture itself has closed geometry and cannot be a billboard.
    for(const [x,y,w,h,z] of [[511,182,20,35,80],[480,246,14,26,80],
      [555,247,14,26,80],[433,170,10,21,48],[598,170,10,21,48]]){
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
