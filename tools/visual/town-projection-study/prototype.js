'use strict';
// Isolated art study. No game state or runtime references this file.
(() => {
  const root = document.getElementById('stage');
  const status = document.getElementById('state');
  const query = new URLSearchParams(location.search);
  const mode = query.get('mode') || 'projection';
  const yaw = Number(query.get('yaw') || 0);
  const imageUrl = '../../../assets/art/scene/town-base.png';
  const cleanUrl = '../../../assets/art/scene/candidates/town-base-clean-candidate.png';
  const W = 1024, H = 525;
  function fit() {
    const scale = Math.max(innerWidth / W, innerHeight / H);
    root.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
  addEventListener('resize', fit);
  fit();
  if (mode === 'original') {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => { status.textContent = '原画基线'; document.documentElement.dataset.ready = '1'; };
    img.onerror = () => { status.textContent = '原画加载失败'; document.documentElement.dataset.error = 'image'; };
    root.append(img);
    return;
  }
  if (!window.THREE) { status.textContent = 'Three.js 不可用'; document.documentElement.dataset.error = 'three'; return; }

  const renderer = new THREE.WebGLRenderer({alpha: false, antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  // ShaderMaterial below copies authored RGB bytes without light/tone conversion.
  renderer.outputEncoding = THREE.LinearEncoding;
  root.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9dd6df');
  const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 1, 2000);
  camera.position.set(512, H / 2, 1000);
  camera.lookAt(512, H / 2, 0);
  const loader = new THREE.TextureLoader();
  Promise.all([
    new Promise((resolve, reject) => loader.load(imageUrl, resolve, undefined, reject)),
    new Promise((resolve, reject) => loader.load(cleanUrl, resolve, undefined, reject))
  ]).then(([original, clean]) => {
    original.encoding = clean.encoding = THREE.LinearEncoding;
    original.minFilter = clean.minFilter = THREE.LinearFilter;
    original.magFilter = clean.magFilter = THREE.LinearFilter;

    // The whole map remains the original picture outside one elliptical clearing.
    // This combines supplied images in the renderer; it does not write a new bitmap asset.
    const background = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.ShaderMaterial({
      uniforms: { original: {value: original}, clean: {value: clean} },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D original; uniform sampler2D clean; varying vec2 vUv;
        void main() {
          vec2 px = vec2(vUv.x * 1024.0, (1.0 - vUv.y) * 525.0);
          float radius = length(vec2((px.x - 512.0) / 175.0, (px.y - 218.0) / 140.0));
          float clearWeight = 1.0 - smoothstep(0.76, 1.0, radius);
          gl_FragColor = mix(texture2D(original, vUv), texture2D(clean, vUv), clearWeight);
        }`
    }));
    background.position.set(W / 2, H / 2, -5);
    scene.add(background);

    // A camera-projected 3D heightfield makes the illustrated hall and its ground
    // one continuous geometric surface. Pixels map to their exact original screen
    // coordinates in the reference camera, while Z gives roof/walls/steps depth.
    const x0 = 310, x1 = 714, y0 = 60, y1 = 380, nx = 100, ny = 80;
    const smooth = (a, b, v) => {
      const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    const box = (v, start, end, feather) => smooth(start - feather, start + feather, v) * (1 - smooth(end - feather, end + feather, v));
    function height(x, y) {
      const mound = 7 * Math.max(0, 1 - Math.hypot((x - 510) / 160, (y - 219) / 118));
      const palisade = 10 * box(x, 391, 632, 10) * box(y, 164, 272, 14);
      const wall = 24 * box(x, 438, 584, 8) * box(y, 164, 227, 12);
      const roofWidth = Math.max(18, Math.min(92, 18 + (y - 114) * 1.18));
      const roof = 58 * box(y, 114, 202, 7) *
        (1 - smooth(roofWidth - 13, roofWidth + 4, Math.abs(x - 512))) *
        (0.45 + 0.55 * Math.max(0, 1 - Math.abs(x - 512) / roofWidth));
      const steps = 9 * box(x, 480, 543, 7) * box(y, 215, 301, 9);
      return mound + palisade + wall + roof + steps;
    }
    const verts = [], uvs = [], indices = [];
    for (let j = 0; j <= ny; j++) {
      const iy = y0 + (y1 - y0) * j / ny;
      for (let i = 0; i <= nx; i++) {
        const ix = x0 + (x1 - x0) * i / nx;
        verts.push(ix, H - iy, height(ix, iy));
        uvs.push(ix / W, 1 - iy / H);
      }
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    const material = new THREE.ShaderMaterial({
      uniforms: { original: {value: original} }, transparent: true, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; varying vec2 vPixel;
        void main() { vUv = uv; vPixel = vec2(uv.x * 1024.0, (1.0 - uv.y) * 525.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D original; varying vec2 vUv; varying vec2 vPixel;
        void main() {
          float edge = min(min(vPixel.x - 310.0, 714.0 - vPixel.x), min(vPixel.y - 60.0, 380.0 - vPixel.y));
          gl_FragColor = vec4(texture2D(original, vUv).rgb, smoothstep(0.0, 22.0, edge));
        }`
    });
    const relief = new THREE.Mesh(geom, material);
    const pivot = new THREE.Group();
    pivot.position.set(W / 2, H / 2, 0);
    relief.position.set(-W / 2, -H / 2, 0);
    pivot.add(relief);
    pivot.rotation.y = Math.max(-12, Math.min(12, yaw)) * Math.PI / 180;
    scene.add(pivot);
    renderer.render(scene, camera);
    const referenceCanvas = document.createElement('canvas');
    referenceCanvas.width = W; referenceCanvas.height = H;
    const referenceContext = referenceCanvas.getContext('2d', {willReadFrequently: true});
    referenceContext.drawImage(original.image, 0, 0);
    const renderedCanvas = document.createElement('canvas');
    renderedCanvas.width = W; renderedCanvas.height = H;
    const renderedContext = renderedCanvas.getContext('2d', {willReadFrequently: true});
    renderedContext.drawImage(renderer.domElement, 0, 0);
    const referenceData = referenceContext.getImageData(0, 0, W, H).data;
    const renderedData = renderedContext.getImageData(0, 0, W, H).data;
    let total = 0, roi = 0, outside = 0, roiPixels = 0, outsidePixels = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const offset = 4 * (y * W + x);
      const difference = (Math.abs(referenceData[offset] - renderedData[offset]) +
        Math.abs(referenceData[offset + 1] - renderedData[offset + 1]) +
        Math.abs(referenceData[offset + 2] - renderedData[offset + 2])) / 3;
      total += difference;
      if (x >= 350 && x <= 675 && y >= 90 && y <= 360) { roi += difference; roiPixels++; }
      else { outside += difference; outsidePixels++; }
    }
    const pixelDifference = {all: total / (W * H), roi: roi / roiPixels, outside: outside / outsidePixels};
    status.textContent = `投影浮雕 ${yaw.toFixed(0)}° · ${nx * ny * 2} 面 · 差 ${pixelDifference.all.toFixed(1)} 中 ${pixelDifference.roi.toFixed(1)} 外 ${pixelDifference.outside.toFixed(1)}`;
    document.documentElement.dataset.ready = '1';
    window.prototypeMetrics = { triangles: nx * ny * 2, maxDepth: 109, yaw, pixelDifference };
  }).catch(err => { status.textContent = '资源加载失败'; document.documentElement.dataset.error = String(err); });
})();
