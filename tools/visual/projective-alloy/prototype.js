'use strict';
// Isolated Alloy Age study: solid geometry with projective paint from the
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
  const originalUrl = '../../../assets/art/scene/town-sci_alloy_age.png';
  const cleanUrl = '../../../assets/art/scene/candidates/town-sci_alloy_age-clean-candidate.png';
  const atlasUrl = '../../../assets/art/source/models/projective_alloy/alloy-material-atlas-master.png';
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
    getTexture(atlasUrl)]).then(([original, clean, atlas]) => {
    for (const t of [original, clean, atlas]) {
      t.encoding = THREE.LinearEncoding;
      t.minFilter = t.magFilter = THREE.LinearFilter;
    }

    // Only the hall footprint uses the alternate cleared art. Outside the
    // feathered ellipse the actual shipped panorama is copied without drift.
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.ShaderMaterial({
      uniforms: {original: {value: original}, clean: {value: clean},
        clearStrength: {value: refine ? .04 + .96*Math.abs(yaw)/8 : 1},
        edgeMask: {value: edgeMask ? 1 : 0},
        yawTurn: {value: Math.abs(yaw)/8}},
      vertexShader: `varying vec2 uv0; void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform sampler2D original,clean;
        uniform float clearStrength,edgeMask,yawTurn;varying vec2 uv0;
        void main(){vec2 p=vec2(uv0.x*1024.,(1.-uv0.y)*525.);
          float roof=length(vec2((p.x-528.)/109.,(p.y-114.)/97.));
          float yard=length(vec2((p.x-528.)/124.,(p.y-178.)/86.));
          float entry=length(vec2((p.x-528.)/54.,(p.y-213.)/37.));
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
    pivot.position.set(528, H-226, 0);
    scene.add(pivot);
    const hall = new THREE.Group();
    hall.position.set(-528, -(H-226), 0);
    pivot.add(hall);
    pivot.rotation.y = yaw * Math.PI / 180;

    const uniforms = {
      original: {value: original},
      lightDir: {value: new THREE.Vector3(lightSide*.46, .63, .62).normalize()}
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
    const surfaceMaterial = (texture,strength=.13) => new THREE.ShaderMaterial({
      uniforms:{original:{value:texture},lightDir:uniforms.lightDir,
        lightStrength:{value:strength}},
      side:THREE.DoubleSide,vertexShader:surfaceVertex,fragmentShader:surfaceFragment
    });
    const paint=surfaceMaterial(original);
    const roofPaint=surfaceMaterial(atlas,.26);
    const wallPaint=surfaceMaterial(atlas,.31);
    const patinaPaint=surfaceMaterial(atlas,.25);
    const metalPaint=surfaceMaterial(atlas,.22);
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
      // The original atlas has separate limestone, glazed slate, patinated
      // copper and engraved alloy quadrants. Unwrap the hidden sides locally.
      const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]), zs=points.map(p=>p[2]);
      const minX=Math.min(...xs), maxX=Math.max(...xs);
      const minY=Math.min(...ys), maxY=Math.max(...ys);
      const minZ=Math.min(...zs), maxZ=Math.max(...zs);
      const useX=maxX-minX>=maxZ-minZ;
      return points.map(p=>{
        const u=useX?(p[0]-minX)/Math.max(1,maxX-minX):
          (p[2]-minZ)/Math.max(1,maxZ-minZ);
        const v=(p[1]-minY)/Math.max(1,maxY-minY);
        const quadrant=material===roofPaint?[.52,.52]:
          material===patinaPaint?[.02,.02]:
          material===metalPaint?[.52,.02]:[.02,.52];
        return [quadrant[0]+u*.46,quadrant[1]+v*.46];
      });
    }
    function polygon(name, points, material=paint, uvs) {
      const positions=[], uv=[], indices=[];
      const localUVs=uvs||((material===roofPaint||material===wallPaint||
        material===patinaPaint||material===metalPaint)?
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
      if(material===roofPaint||material===wallPaint||material===patinaPaint||
        material===metalPaint)metrics.generatedFaces++;
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

    // The alloy hall has a three-bay blue roof, two pierced corner towers,
    // a patinated observatory cupola and a freestanding brass astrolabe.
    // Their source-view surfaces retain the alloy panorama's own details.
    shell('alloy rear masonry mass',
      [[442,139,47],[615,139,47],[619,207,45],[439,207,45]],
      [[451,130,8],[606,130,8],[609,197,8],[448,197,8]],wallPaint);
    shell('alloy lower plinth',[[443,175,71],[616,175,71],[622,229,66],[438,229,66]],
      [[451,168,12],[608,168,12],[614,219,12],[446,219,12]],wallPaint);
    shell('alloy central nave',[[472,129,85],[584,129,85],[586,215,82],[470,215,82]],
      [[481,112,24],[576,112,24],[577,202,24],[479,202,24]],wallPaint);
    shell('west alloy wing',[[438,152,69],[477,145,73],[482,210,72],[438,210,69]],
      [[452,139,19],[481,134,19],[485,202,19],[449,201,19]],wallPaint);
    shell('east alloy wing',[[579,145,73],[618,151,69],[618,210,69],[574,210,72]],
      [[575,133,19],[604,139,19],[609,201,19],[571,202,19]],wallPaint);
    roof('west blue alloy roof',[[440,153,71],[470,132,24],[501,141,24],[480,174,99]],8);
    roof('east blue alloy roof',[[574,174,99],[554,141,24],[586,132,24],[616,153,71]],8);
    roof('nave west roof pitch',[[473,132,91],[522,112,38],[529,119,38],[507,147,100]],8);
    roof('nave east roof pitch',[[548,147,100],[528,119,38],[535,112,38],[583,132,91]],8);

    // Central tower is behind the free-standing ring. The front cut is
    // painted from the shipped panorama; newly exposed depth has its own
    // limestone or brass texture from the editable atlas.
    shell('observatory tower',[[492,89,72],[561,89,72],[566,165,70],[487,165,70]],
      [[501,77,20],[551,77,20],[555,152,20],[497,152,20]],wallPaint);
    shell('patina cupola drum',[[499,82,78],[558,82,78],[560,109,75],[497,109,75]],
      [[502,77,27],[555,77,27],[556,103,27],[500,103,27]],metalPaint);
    const dome=[{y:51,half:0,z:94},{y:60,half:20,z:89},
      {y:77,half:31,z:79},{y:89,half:33,z:73}];
    for(let course=0;course<dome.length-1;course++){
      const top=dome[course],bottom=dome[course+1];
      for(const side of [-1,1]){
        const front=[[529,top.y,top.z+7],
          [529+side*top.half,top.y,top.z-4],
          [529+side*bottom.half,bottom.y,bottom.z-4],
          [529,bottom.y,bottom.z+7]];
        if(!top.half)front.splice(1,1);
        shell('copper dome course '+course+' side '+side,front,
          front.map(p=>[p[0],p[1]+3,p[2]-37]),patinaPaint);
      }
    }
    shell('alloy central finial',[[527,38,96],[531,38,96],[532,54,95],[526,54,95]],
      [[527,38,75],[531,38,75],[532,54,75],[526,54,75]],metalPaint);

    // The two asymmetrical observation turrets are stout volumes with
    // distinct steep roofs. The paper banners stay decorative overlays.
    for(const [x,topY,side] of [[461,101,-1],[598,105,1]]){
      shell('alloy corner tower '+x,
        [[x-12,topY+25,83],[x+12,topY+25,83],
          [x+12,topY+66,78],[x-12,topY+66,78]],
        [[x-10,topY+20,28],[x+10,topY+20,28],
          [x+10,topY+59,28],[x-10,topY+59,28]],wallPaint);
      shell('blue turret conical roof '+x,
        [[x,topY,88],[x+side*14,topY+25,82],
          [x-side*14,topY+25,82]],
        [[x,topY+4,32],[x+side*12,topY+28,27],
          [x-side*12,topY+28,27]],roofPaint);
      shell('brass turret cap '+x,
        [[x-2,topY-8,91],[x+2,topY-8,91],
          [x+2,topY+2,89],[x-2,topY+2,89]],
        [[x-2,topY-8,67],[x+2,topY-8,67],
          [x+2,topY+2,67],[x-2,topY+2,67]],metalPaint);
    }

    // Actual radial metal frame: two nested thick rings, four crossed
    // spars and the central hub. Its side faces become visible at ±8°.
    const ringCenter=[529,120];
    function alloyRing(label,radius,width,segments,z){
      for(let i=0;i<segments;i++){
        const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
        const point=(r,angle)=>[ringCenter[0]+r*Math.cos(angle),
          ringCenter[1]+r*Math.sin(angle),z];
        const front=[point(radius+width,a),point(radius+width,b),
          point(radius-width,b),point(radius-width,a)];
        shell(label+' '+i,front,front.map(p=>[p[0],p[1],p[2]-8]),metalPaint);
      }
    }
    alloyRing('outer brass astrolabe',22,1.8,16,113);
    alloyRing('inner brass astrolabe',10,1.7,12,115);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,perp=a+Math.PI/2;
      const point=(r,offset)=>[529+r*Math.cos(a)+offset*Math.cos(perp),
        120+r*Math.sin(a)+offset*Math.sin(perp),116];
      const front=[point(8,-1.5),point(20,-1.5),
        point(20,1.5),point(8,1.5)];
      shell('astrolabe spoke '+i,front,
        front.map(p=>[p[0],p[1],p[2]-7]),metalPaint);
    }
    const hub=[];
    for(let i=0;i<10;i++){
      const a=i*Math.PI*2/10;
      hub.push([529+4.7*Math.cos(a),120+4.7*Math.sin(a),119]);
    }
    shell('astrolabe hub',hub,hub.map(p=>[p[0],p[1],p[2]-10]),metalPaint);

    // Thick portico piers and descending steps match the original reference
    // silhouette; the front statue and the roundabout remain 2D background.
    for(const x of [479,496,559,576]){
      shell('alloy portico pier '+x,
        [[x-3,153,102],[x+3,153,102],[x+3,212,101],[x-3,212,101]],
        [[x-3,150,76],[x+3,150,76],[x+3,209,76],[x-3,209,76]],wallPaint);
    }
    for(let i=0;i<6;i++){
      const y=218+i*4,half=23+i*1.8,z=99-i*7;
      shell('alloy stair '+(i+1),
        [[529-half,y,z],[529+half,y,z],
          [530+half,y+4,z],[528-half,y+4,z]],
        [[529-half,y+1,z-7],[529+half,y+1,z-7],
          [530+half,y+5,z-7],[528-half,y+5,z-7]],wallPaint);
    }
    for(const x of [468,590]){
      shell('brass portal bracket '+x,
        [[x-3,178,104],[x+3,178,104],[x+3,203,104],[x-3,203,104]],
        [[x-3,178,78],[x+3,178,78],[x+3,203,78],[x-3,203,78]],metalPaint);
    }
    for(const [x,y,w,h,z] of [[440,170,7,30,84],[618,167,7,31,84]]){
      polygon('cloth blue civic banner',[[x-w/2,y,z],[x+w/2,y,z],
        [x+w/2,y+h,z],[x-w/2,y+h,z]],paint);
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
    const roi=(x,y)=>x>=420&&x<=637&&y>=35&&y<=265;
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
    const domeRoi=(x,y)=>x>=495&&x<=560&&y>=45&&y<=90;
    const domeLightDifference=meanDiff(rendered,oppositeLight,domeRoi);
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
      domeLightDifference,
      closedShells:metrics.shells.length,realRoofSlopes:4,
      geometry:'alloy hall, faceted copper dome, blue slopes and solid astrolabe'};
    window.prototypeMetrics=result;
    document.documentElement.dataset.metrics=encodeURIComponent(JSON.stringify({
      triangles:result.triangles,closedShells:result.closedShells,
      texturedFaces:result.texturedFaces,generatedFaces:result.generatedFaces,
      roofNormals:result.roofNormals,
      depthRange:result.depthRange,meshBatches:result.meshBatches,
      drawCalls:result.drawCalls,pixelDifference,lightDifference,
      domeLightDifference,yaw,lightSide
    }));
    status.textContent=`合金主楼 ${yaw}° · ${result.triangles} 面 · 中央差 ${pixelDifference.roi.toFixed(1)}`;
    document.documentElement.dataset.ready='1';
  }).catch(error=>{console.error(error);status.textContent='样板失败';document.documentElement.dataset.error=String(error);});
})();
