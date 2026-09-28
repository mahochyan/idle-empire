'use strict';
// Isolated Nuclear Age study: solid geometry with projective paint from the
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
  const originalUrl = '../../../assets/art/scene/town-sci_nuclear_age.png';
  const cleanUrl = '../../../assets/art/scene/candidates/town-sci_nuclear_age-clean-candidate.png';
  const roofUrl = '../../../assets/art/source/models/projective_nuclear/nuclear-material-atlas-master.png';
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
          float roof=length(vec2((p.x-529.)/112.,(p.y-123.)/121.));
          float yard=length(vec2((p.x-526.)/148.,(p.y-185.)/83.));
          float entry=length(vec2((p.x-526.)/57.,(p.y-226.)/44.));
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
    const energyPaint=surfaceMaterial(atlas);
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
        if(material===roofPaint)return [.54+u*.42,.54+v*.42];
        if(material===energyPaint)return [.54+u*.42,.04+v*.42];
        return [.04+u*.42,.54+v*.42];
      });
    }
    function polygon(name, points, material=paint, uvs) {
      const positions=[], uv=[], indices=[];
      const localUVs=uvs||((material===roofPaint||material===wallPaint||
        material===energyPaint)?
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
      if(material===roofPaint||material===wallPaint||material===energyPaint)
        metrics.generatedFaces++;
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

    // The outer garden and its two fountains stay in the original background.
    // Only the inner limestone ring is given solid raised edging.
    const rim=[[414,178,14],[448,143,14],[481,127,14],[571,127,14],
      [609,144,14],[642,181,14],[627,226,14],[570,249,14],
      [481,249,14],[426,226,14]];
    const inner=rim.map(p=>[526+(p[0]-526)*.74,187+(p[1]-187)*.72,14]);
    for(let i=0;i<rim.length;i++){
      const j=(i+1)%rim.length;
      const wedge=[rim[i],rim[j],inner[j],inner[i]];
      shell('stone courtyard segment '+i,wedge,
        wedge.map(p=>[p[0],p[1]+2,7]),stone);
    }

    // Nuclear-era hall: ivory nave and side wings, cobalt roofs, a slender
    // central energy tower and a real annular halo above it. The ring is made
    // from closed sectors with a hole; a flat disc would hide the skyline.
    shell('ivory nave front',[[449,139,75],[604,139,75],[611,228,70],[443,228,70]],
      [[458,130,22],[596,130,22],[601,218,22],[452,218,22]],wallPaint);
    shell('ivory left wing',[[449,137,71],[469,108,34],[470,199,34],[443,226,71]],
      [[456,133,63],[476,108,27],[477,194,27],[450,221,63]],wallPaint);
    shell('ivory right wing',[[604,137,71],[584,108,34],[582,198,34],[611,226,71]],
      [[597,133,63],[578,108,27],[575,193,27],[604,221,63]],wallPaint);
    shell('central portal',[[484,145,84],[571,145,84],[574,225,84],[481,225,84]],
      [[489,140,67],[566,140,67],[568,219,67],[487,219,67]],wallPaint);
    roof('left cobalt roof',[[446,139,80],[474,108,31],[512,122,31],[487,163,103]],7);
    roof('right cobalt roof',[[565,163,103],[541,121,31],[583,108,31],[608,139,80]],7);
    shell('central tower body',[[511,91,101],[543,91,101],[547,176,96],[507,176,96]],
      [[516,83,40],[538,83,40],[541,166,40],[513,166,40]],wallPaint);
    shell('cyan tower core',[[521,100,107],[534,100,107],[535,154,106],[520,154,106]],
      [[523,99,95],[532,99,95],[533,153,94],[522,153,94]],energyPaint);
    shell('spire cap',[[526,20,88],[532,43,93],[522,43,93]],
      [[526,25,45],[532,48,45],[522,48,45]],roofPaint);
    const haloCenter=[527,53],outer=19,innerRadius=12;
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6,b=(i+1)*Math.PI/6;
      const point=(radius,angle,z)=>[
        haloCenter[0]+radius*Math.cos(angle),
        haloCenter[1]+radius*Math.sin(angle),z];
      const ringDepth=(angle,radius)=>114+
        (radius===outer?8:4)*Math.cos(angle);
      const front=[point(outer,a,ringDepth(a,outer)),
        point(outer,b,ringDepth(b,outer)),
        point(innerRadius,b,ringDepth(b,innerRadius)),
        point(innerRadius,a,ringDepth(a,innerRadius))];
      shell('energy halo sector '+i,front,
        front.map(p=>[p[0],p[1],p[2]-9]),energyPaint);
    }
    for(const [x,topY] of [[485,112],[566,112]]){
      shell('blue side turret '+x,
        [[x,topY,76],[x+12,topY+16,74],[x+12,topY+39,71],
          [x-12,topY+39,71],[x-12,topY+16,74]],
        [[x,topY+4,30],[x+10,topY+18,30],[x+10,topY+38,30],
          [x-10,topY+38,30],[x-10,topY+18,30]],roofPaint);
    }
    shell('inner limestone plinth',[[431,208,75],[622,208,75],[627,242,69],[425,242,69]],
      [[441,201,18],[612,201,18],[618,234,18],[435,234,18]],stone);

    // The broad white stair descends from the tower entrance.
    for(let i=0;i<7;i++){
      const y=226+i*5.0, half=26+i*1.2, z=81-i*5;
      shell('stone stair '+(i+1),
        [[527-half,y,z],[527+half,y,z],[527+half+1,y+4,z],[527-half-1,y+4,z]],
        [[527-half,y+1,z-5],[527+half,y+1,z-5],[527+half+1,y+5,z-5],[527-half-1,y+5,z-5]],stone);
    }
    for(const side of [-1,1]){
      const x=527+side*37;
      shell((side<0?'left':'right')+' stair cheek',
        [[x-3,226,80],[x+3,226,80],[x+4,264,42],[x-4,264,42]],
        [[x-3,229,73],[x+3,229,73],[x+4,267,35],[x-4,267,35]],stone);
    }
    // Thin vertical buttresses and cyan crystal pillars are independent solids.
    for(const x of [462,479,495,560,577,594]){
      shell('ivory buttress '+x,
        [[x-2,148,88],[x+2,148,88],[x+2,222,88],[x-2,222,88]],
        [[x-2,148,75],[x+2,148,75],[x+2,222,75],[x-2,222,75]],wallPaint);
    }
    for(const x of [416,638]){
      shell('cyan court pillar '+x,
        [[x-3,174,45],[x+3,174,45],[x+3,211,43],[x-3,211,43]],
        [[x-3,174,33],[x+3,174,33],[x+3,211,31],[x-3,211,31]],energyPaint);
    }
    // Flags remain fabric, unlike the solid energy halo and towers.
    for(const [x,y,w,h,z] of [[446,150,7,25,82],[605,151,7,25,82]]){
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
    const haloRoi=(x,y)=>x>=503&&x<=551&&y>=28&&y<=78;
    const haloLightDifference=meanDiff(rendered,oppositeLight,haloRoi);
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
      haloLightDifference,
      closedShells:metrics.shells.length,realRoofSlopes:2,
      geometry:'closed 3D shells + roof planes, wall depth, posts and stairs'};
    window.prototypeMetrics=result;
    document.documentElement.dataset.metrics=encodeURIComponent(JSON.stringify({
      triangles:result.triangles,closedShells:result.closedShells,
      texturedFaces:result.texturedFaces,generatedFaces:result.generatedFaces,
      roofNormals:result.roofNormals,
      depthRange:result.depthRange,meshBatches:result.meshBatches,
      drawCalls:result.drawCalls,pixelDifference,lightDifference,
      haloLightDifference,yaw,lightSide
    }));
    status.textContent=`主楼实体 ${yaw}° · ${result.triangles} 面 · 差 ${pixelDifference.all.toFixed(1)}/${pixelDifference.roi.toFixed(1)}`;
    document.documentElement.dataset.ready='1';
  }).catch(error=>{console.error(error);status.textContent='样板失败';document.documentElement.dataset.error=String(error);});
})();
