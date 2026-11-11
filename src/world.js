// World: a faceted, hand-made paper room at the edge of dawn, and the floating almond branch
// (bare → blossoming). The texture/atmosphere shader lives in look.js; parameters in config.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { applyLook, U } from './look.js';

const P = CONFIG.palette, L = CONFIG.look;

/** Small seeded random generator – the branch is the same every time. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
/** deterministic hash of a position (same point → same jitter, so facets never crack apart) */
function phash(x, y, z, k = 0) {
  let h = Math.sin(Math.round(x * 997) * 12.9898 + Math.round(y * 997) * 78.233 + Math.round(z * 997) * 37.719 + k * 11.13) * 43758.5453;
  return h - Math.floor(h);
}

/** soft 4-step gradient for toon shading (painted, not cel-hard) */
function toonGradient() {
  const tex = new THREE.DataTexture(new Uint8Array([45, 120, 205, 255]), 4, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
  return tex;
}
export const GRADIENT = toonGradient();
/** walls: more, gentler steps (a painted wash rather than hard cel bands) */
const WALL_GRADIENT = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([95, 125, 155, 185, 215, 240, 255]), 7, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true; return tex;
})();

/** Ink outline ("inverted hull"): back faces pushed out along the normal. */
function outlineMaterial(thickness) {
  const m = new THREE.MeshBasicMaterial({ color: P.ink, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed += normal * ${thickness.toFixed(4)};`);
  };
  return m;
}

/** Collects wobbly, slightly over-shooting strokes into ONE LineSegments draw call. */
export class Sketch {
  constructor(seed = 1) { this.pos = []; this.r = rng(seed); }
  line(a, b, { jitter = 0.006, strokes = 2, overshoot = 0.03 } = {}) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const dir = B.clone().sub(A); const len = dir.length(); dir.normalize();
    const n = Math.max(2, Math.ceil(len / 0.3));
    for (let s = 0; s < strokes; s++) {
      const p0 = A.clone().addScaledVector(dir, -overshoot * this.r()), p1 = B.clone().addScaledVector(dir, overshoot * this.r());
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const p = p0.clone().lerp(p1, i / n);
        p.x += (this.r() - 0.5) * jitter * 2; p.y += (this.r() - 0.5) * jitter * 2; p.z += (this.r() - 0.5) * jitter * 2;
        if (prev) this.pos.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
        prev = p;
      }
    }
  }
  poly(pts, opts) { for (let i = 0; i < pts.length - 1; i++) this.line(pts[i], pts[i + 1], opts); }
  rect(c, opts) { for (let i = 0; i < 4; i++) this.line(c[i], c[(i + 1) % 4], opts); }
  build(color, opacity = 1) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    const m = applyLook(new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }), { normals: false, grain: 0 });
    return new THREE.LineSegments(g, m);
  }
}

/** saturation control for the blossom (the color recedes at the exit) */
function withSaturation(mat) {
  mat.userData.uSat = { value: 1 };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => {
    prev && prev(s, r);
    s.uniforms.uSat = mat.userData.uSat;
    s.fragmentShader = 'uniform float uSat;\n' + s.fragmentShader.replace('#include <dithering_fragment>',
      `#include <dithering_fragment>
       float lsat = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
       gl_FragColor.rgb = mix(vec3(lsat) * vec3(0.93, 0.92, 0.9), gl_FragColor.rgb, uSat);`);
  };
  return mat;
}

/** radial-gradient canvas texture (glows, motes, shadow) */
function radialTex(stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** a faceted, slightly irregular plane (for the room), vertex-colored in gouache patches */
function facetPlane(w, h, sx, sy, place, jit, normalJit, tint, seed) {
  const g = new THREE.PlaneGeometry(w, h, sx, sy);
  place(g);
  const pos = g.attributes.position, v = new THREE.Vector3();
  g.computeVertexNormals();
  const nrm = new THREE.Vector3().fromBufferAttribute(g.attributes.normal, 0);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = phash(v.x, v.y, v.z, 1) - 0.5, b = phash(v.x, v.y, v.z, 2) - 0.5, c = phash(v.x, v.y, v.z, 3) - 0.5;
    // keep the outer border in place along the normal less, so the room stays closed
    v.x += a * jit; v.y += b * jit * 0.6; v.z += c * jit;
    v.addScaledVector(nrm, (phash(v.x, v.y, v.z, 4) - 0.5) * normalJit);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const ng = g.toNonIndexed(); g.dispose();
  ng.computeVertexNormals();
  const col = [], base = new THREE.Color(tint), cc = new THREE.Color(), r = rng(seed);
  for (let t = 0; t < ng.attributes.position.count / 3; t++) {
    const k = 0.95 + r() * 0.08, warm = (r() - 0.5) * 0.03;
    cc.copy(base).multiplyScalar(k); cc.r += warm; cc.b -= warm;
    for (let j = 0; j < 3; j++) col.push(cc.r, cc.g, cc.b);
  }
  ng.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return ng;
}

// ─────────────────────────────────────────────────────────────────────────────
export function buildWorld(scene) {
  const W = CONFIG.room.width, D = CONFIG.room.depth, H = CONFIG.room.height;
  const hw = W / 2, hd = D / 2, J = L.jitter;
  const fadeables = [];
  const room = new THREE.Group(); scene.add(room);

  // ── Faceted room: walls + ceiling (1 draw call), floor (1 draw call) ──
  const wallGeo = mergeGeometries([
    facetPlane(W, H, 10, 5, (g) => g.translate(0, H / 2, -hd), J, J * 0.4, P.paper, 1),                                       // back
    facetPlane(W, H, 10, 5, (g) => { g.rotateY(Math.PI); g.translate(0, H / 2, hd); }, J, J * 0.4, P.paper, 2),               // front
    facetPlane(D, H, 10, 5, (g) => { g.rotateY(Math.PI / 2); g.translate(-hw, H / 2, 0); }, J, J * 0.4, P.paper, 3),          // left
    facetPlane(D, H, 10, 5, (g) => { g.rotateY(-Math.PI / 2); g.translate(hw, H / 2, 0); }, J, J * 0.4, P.paper, 4),          // right
    facetPlane(W, D, 8, 8, (g) => { g.rotateX(Math.PI / 2); g.translate(0, H, 0); }, J, J * 0.6, 0xd8d1c6, 5),            // ceiling
  ]);
  const wallMat = applyLook(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: WALL_GRADIENT }), { hatch: true, wall: true });
  if (L.showRoom) { room.add(new THREE.Mesh(wallGeo, wallMat)); fadeables.push(wallMat); }

  const floorGeo = facetPlane(W, D, 8, 8, (g) => g.rotateX(-Math.PI / 2), J * 0.5, 0.004, L.showRoom ? P.floor : L.floorColor, 6);
  const floorMat = applyLook(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: L.showRoom ? WALL_GRADIENT : GRADIENT }), { hatch: true, floor: true });
  const floor = new THREE.Mesh(floorGeo, floorMat); floor.receiveShadow = true;
  if (L.showFloor || L.showRoom) { room.add(floor); fadeables.push(floorMat); }

  // ── ink lines: corners, baseboard, window frame, door, and a quiet crack ──
  const sk = new Sketch(3);
  const c = [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd]];
  for (let i = 0; i < 4; i++) {
    const [x, , z] = c[i], [x2, , z2] = c[(i + 1) % 4];
    sk.line([x, 0.012, z], [x2, 0.012, z2]); sk.line([x, H, z], [x2, H, z2], { strokes: 1 });
    sk.line([x, 0, z], [x, H, z]); sk.line([x, 0.1, z], [x2, 0.1, z2], { strokes: 1 });
  }
  const wx = hw - 0.025, wy0 = 0.95, wy1 = 2.15, wz0 = -1.3, wz1 = 0.1;
  sk.rect([[wx, wy0, wz0], [wx, wy0, wz1], [wx, wy1, wz1], [wx, wy1, wz0]]);
  sk.rect([[wx, wy0 + 0.06, wz0 + 0.06], [wx, wy0 + 0.06, wz1 - 0.06], [wx, wy1 - 0.06, wz1 - 0.06], [wx, wy1 - 0.06, wz0 + 0.06]], { strokes: 1 });
  sk.line([wx - 0.005, (wy0 + wy1) / 2, wz0], [wx - 0.005, (wy0 + wy1) / 2, wz1]);
  sk.line([wx - 0.005, wy0, (wz0 + wz1) / 2], [wx - 0.005, wy1, (wz0 + wz1) / 2]);
  sk.line([wx - 0.02, wy0 - 0.04, wz0 - 0.1], [wx - 0.02, wy0 - 0.04, wz1 + 0.1]);
  const dx = -hw + 0.03;
  sk.line([dx, 0, 0.6], [dx, 2.05, 0.6]); sk.line([dx, 0, 1.5], [dx, 2.05, 1.5]); sk.line([dx, 2.05, 0.6], [dx, 2.05, 1.5]);
  sk.line([dx, 1.0, 1.38], [dx, 1.0, 1.43], { strokes: 1 });
  // the crack, high on the back wall, branching like the almond twig
  const cz = -hd + 0.03, cr = rng(31);
  let cp = [1.55, H - 0.02, cz]; const crack = [cp];
  for (let i = 0; i < 7; i++) { cp = [cp[0] + (cr() - 0.6) * 0.08, cp[1] - 0.07 - cr() * 0.06, cz]; crack.push(cp); }
  sk.poly(crack, { strokes: 1, jitter: 0.002, overshoot: 0 });
  sk.poly([crack[3], [crack[3][0] + 0.09, crack[3][1] - 0.05, cz], [crack[3][0] + 0.13, crack[3][1] - 0.12, cz]], { strokes: 1, jitter: 0.002, overshoot: 0 });
  const roomLines = sk.build(P.ink, 0.85); if (L.showRoom) { room.add(roomLines); fadeables.push(roomLines.material); }

  // ── the window: a dusk / pre-dawn sky (gradient, a pale low sun) ──
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(L.skyTop) }, uMid: { value: new THREE.Color(L.skyMid) }, uLow: { value: new THREE.Color(L.skyLow) }, uWarm: U.uWarm, uNeutral: U.uNeutral, uTime: U.uTime, uOpacity: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform vec3 uTop, uMid, uLow; uniform float uWarm, uNeutral, uTime, uOpacity; varying vec2 vUv;
      void main(){
        float y = vUv.y;
        vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.45, y)); c = mix(c, uTop, smoothstep(0.4, 1.0, y));
        c = mix(c * vec3(0.72, 0.76, 0.92), c, uWarm);                         // before the light: bluer
        float sun = exp(-pow(length((vUv - vec2(0.62, 0.16)) * vec2(1.6, 1.0)) * 4.5, 2.0));
        c += vec3(1.0, 0.82, 0.6) * sun * (0.25 + 0.55 * uWarm) * (1.0 + 0.05 * sin(uTime * 0.35));
        c = mix(c, vec3(dot(c, vec3(0.299, 0.587, 0.114))), uNeutral);
        gl_FragColor = vec4(c, uOpacity);
        #include <colorspace_fragment>
      }`,
    transparent: true,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(wz1 - wz0 - 0.1, wy1 - wy0 - 0.1), skyMat);
  sky.rotation.y = -Math.PI / 2; sky.position.set(hw - 0.02, (wy0 + wy1) / 2, (wz0 + wz1) / 2); sky.visible = L.showRoom; room.add(sky);
  fadeables.push(skyMat);

  // ── window light: shaft (4 soft quads) + the window's shape on the floor ──
  const win = [[wx, wy1 - 0.06, wz0 + 0.06], [wx, wy1 - 0.06, wz1 - 0.06], [wx, wy0 + 0.06, wz1 - 0.06], [wx, wy0 + 0.06, wz0 + 0.06]];
  const off = [-1.55, 0, 0.25];
  const flo = win.map(([x, y, z]) => [x + off[0] - (y - wy0) * 0.55, 0.012, z + off[2]]);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xffe2c4) }, uTime: U.uTime },
    vertexShader: 'attribute float a; attribute float e; varying float vA; varying float vE; varying vec3 vP; void main(){ vA = a; vE = e; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float uOpacity, uTime; uniform vec3 uColor; varying float vA; varying float vE; varying vec3 vP;
      void main(){ float streak = 0.75 + 0.25 * sin(vP.z * 9.0 + vP.y * 3.0 + uTime * 0.08);
        float edge = sin(3.14159 * clamp(vE, 0.0, 1.0));            // soft sides, no hard triangles
        gl_FragColor = vec4(uColor, uOpacity * pow(vA, 1.5) * streak * edge * edge); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  {
    const pos = [], al = [], ed = [];
    for (let i = 0; i < 4; i++) { const a = win[i], b = win[(i + 1) % 4], cc = flo[(i + 1) % 4], d = flo[i]; pos.push(...a, ...b, ...cc, ...a, ...cc, ...d); al.push(1, 1, 0, 1, 0, 0); ed.push(0, 1, 1, 0, 1, 0); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('a', new THREE.Float32BufferAttribute(al, 1)); g.setAttribute('e', new THREE.Float32BufferAttribute(ed, 1));
    const m = new THREE.Mesh(g, beamMat); m.renderOrder = 1; m.visible = L.showRoom; room.add(m);
  }
  // floor patch: the window panes, softly blurred, projected exactly where the shaft lands
  const poolTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const x = cv.getContext('2d');
    x.filter = 'blur(7px)'; x.fillStyle = '#fff';
    const m = 26, gap = 12, half = (256 - 2 * m - gap) / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) x.fillRect(m + i * (half + gap), m + j * (half + gap), half, half);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffd9b5, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...flo[0], ...flo[1], ...flo[2], ...flo[0], ...flo[2], ...flo[3]], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0], 2));
    const m = new THREE.Mesh(g, poolMat); m.renderOrder = 1; m.visible = L.showRoom; room.add(m);
  }
  fadeables.push(poolMat);

  // ── dust motes: one Points draw call, drifting in the shader; most live in the light shaft ──
  const dustMat = (() => {
    const n = L.dust, pos = [], seed = [], bright = [], r = rng(77), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      if (!L.showRoom) {     // void: a loose cloud around the branch, catching the sun
        const B0 = CONFIG.branch; v.set(B0.x + (r() - 0.5) * 2.6, 0.5 + r() * 1.9, B0.z + (r() - 0.5) * 2.2); bright.push(0.5 + r() * 0.5);
      } else if (i < n * 0.7) {   // inside the shaft: lerp between a window point and its floor point
        const u = r(), w = r(), t = r();
        const a = new THREE.Vector3(...win[0]).lerp(new THREE.Vector3(...win[1]), u), b = new THREE.Vector3(...win[3]).lerp(new THREE.Vector3(...win[2]), u);
        const top = a.lerp(b, w);
        const fa = new THREE.Vector3(...flo[0]).lerp(new THREE.Vector3(...flo[1]), u), fb = new THREE.Vector3(...flo[3]).lerp(new THREE.Vector3(...flo[2]), u);
        v.copy(top).lerp(fa.lerp(fb, w), t); bright.push(1);
      } else { v.set((r() - 0.5) * W * 0.8, 0.3 + r() * 2.0, (r() - 0.5) * D * 0.8); bright.push(0.3); }
      pos.push(v.x, v.y, v.z); seed.push(r());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    g.setAttribute('aBright', new THREE.Float32BufferAttribute(bright, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uOpacity: { value: 0 }, uScale: { value: 800 } },
      vertexShader: `attribute float aSeed, aBright; uniform float uTime, uScale; varying float vB;
        void main(){
          vec3 p = position + vec3(sin(uTime * 0.07 + aSeed * 40.0) * 0.06, sin(uTime * 0.05 + aSeed * 17.0) * 0.09, cos(uTime * 0.06 + aSeed * 29.0) * 0.06);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          vB = aBright * (0.6 + 0.4 * sin(uTime * 0.5 + aSeed * 60.0));
          gl_PointSize = clamp(uScale * (0.004 + aSeed * 0.004) / -mv.z, 1.0, 6.0);
        }`,
      fragmentShader: `uniform float uOpacity; varying float vB;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(1.0, 0.93, 0.82, a * vB * uOpacity); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; room.add(pts);
    return m;
  })();

  // ── Light: the invisible sun (directional key, hard shadows) + a cool fill (breathing) ──
  const SUN = L.sun, sunDir = new THREE.Vector3(...SUN.dir).normalize();
  const hemi = new THREE.HemisphereLight(L.showRoom ? P.lightFrom : L.fill, 0x0a0908, L.showRoom ? 1.0 : L.fillIntensity); scene.add(hemi);
  const sun = new THREE.DirectionalLight(SUN.colorFrom, 1.0); scene.add(sun); scene.add(sun.target);
  if (SUN.shadowMap > 0) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(SUN.shadowMap, SUN.shadowMap);
    const sc = sun.shadow.camera; sc.left = sc.bottom = -SUN.shadowSize; sc.right = sc.top = SUN.shadowSize; sc.near = 0.5; sc.far = 12;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.01;
  }
  const potSunDir = new THREE.Vector3(...CONFIG.pot.sunDir).normalize(), potPos = new THREE.Vector3(CONFIG.pot.x, 1.2, CONFIG.pot.z);
  let focus = 0;
  const cFrom = new THREE.Color(SUN.colorFrom), cTo = new THREE.Color(SUN.colorTo), hemiTo = new THREE.Color(L.showRoom ? 0xe9ddd3 : L.fill);
  let lightT = 0, beamLevel = 1, dustLevel = 1;
  function setLight(t) { lightT = t; U.uWarm.value = t; }
  function applyLight(breath) {
    const t = lightT;
    hemi.color.copy(L.showRoom ? new THREE.Color(P.lightFrom) : new THREE.Color(L.fill)).lerp(hemiTo, t);
    sun.color.copy(cFrom).lerp(cTo, t);
    sun.intensity = THREE.MathUtils.lerp(SUN.intensityFrom, SUN.intensityTo, t) * breath;
    // the sun rises a little during the entry; parallel rays aimed at the branch
    // focus 0 = on the branch, 1 = on the pot (light finds it from the learner's side)
    const d = sunDir.clone().lerp(potSunDir, focus).normalize(); d.y = d.y * (0.55 + 0.45 * t); d.normalize();
    U.uSunDir.value.copy(d);
    U.uRimAmt.value = L.rim * (0.35 + 0.65 * t) * breath;
    const B0 = CONFIG.branch;
    sun.target.position.set(B0.x + 0.4, baseY - 0.4, B0.z + 0.3).lerp(potPos, focus);
    sun.position.copy(sun.target.position).addScaledVector(d, 5);
    beamMat.uniforms.uOpacity.value = L.beam * (0.25 + 0.75 * t) * breath * beamLevel;
    poolMat.opacity = 0.5 * (0.2 + 0.8 * t) * breath * Math.min(beamLevel, 1.3);
    dustMat.uniforms.uOpacity.value = (0.25 + 0.75 * t) * 0.9 * Math.min(beamLevel, 1.3) * Math.max(U.uBranchVis.value, U.uPotVis.value * 0.6) * dustLevel;
  }

  // ── The floating branch + its soft shadow ──
  const branch = buildBranch();
  scene.add(branch.group);
  fadeables.push(...branch.materials);

  const shadowMat = new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(43,41,37,0.7)'], [1, 'rgba(43,41,37,0)']]), transparent: true, opacity: 0.5, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.014; scene.add(shadow);
  shadow.visible = !(L.sun.shadowMap > 0);   // real shadows replace the soft blob
  fadeables.push(shadowMat);

  const B = CONFIG.branch;
  let baseY = B.y, shadowOpacity = 1, yawOverride = null, bloom = 0, sink = 0;
  const tmpV = new THREE.Vector3();
  // wind (slow gusts, -1..1) and the tremble when the branch is touched
  const WD = CONFIG.wind, TC = CONFIG.touch;
  let wind = 0, tremble = 0, trembles = 0, lastTouch = -9, lastT = 0;
  const windAt = (t) => WD.strength * (0.6 * Math.sin(t * 0.13) + 0.3 * Math.sin(t * 0.37 + 1.7) + 0.1 * Math.sin(t * 1.1 + 0.4));
  function update(time, viewH = 1600) {
    U.uTime.value = time;
    const breath = 1 + L.breatheAmp * Math.sin(time * L.breatheSpeed) + L.breatheAmp * 0.4 * Math.sin(time * L.breatheSpeed * 2.7 + 1.3);
    applyLight(breath);
    dustMat.uniforms.uScale.value = viewH;
    const g = branch.group;
    g.scale.setScalar(B.scale);
    const dt = Math.min(0.1, Math.max(0, time - lastT)); lastT = time;
    wind = windAt(time); tremble *= Math.exp(-dt * TC.trembleDecay);
    const tr = tremble * TC.trembleAmp, tf = time * TC.trembleFreq;
    g.position.set(B.x, baseY + Math.sin(time * B.hoverSpeed) * B.hoverAmp - sink, B.z);
    g.rotation.set(B.tilt + Math.sin(time * B.turnSpeed * 0.7) * 0.05 + Math.sin(tf) * tr + wind * WD.sway * 0.3,
      (yawOverride ?? B.yaw) + Math.sin(time * B.turnSpeed) * B.turnAmp + Math.sin(tf * 1.3 + 1) * tr * 0.5,
      Math.sin(time * B.turnSpeed * 0.5) * 0.04 + wind * WD.sway + Math.sin(tf * 0.9 + 2) * tr);
    shadow.position.x = B.x; shadow.position.z = B.z; shadow.rotation.z = -g.rotation.y;
    const h = g.position.y; shadow.scale.setScalar(0.8 + h * 0.15); shadowMat.opacity = (0.5 - h * 0.12) * shadowOpacity;
    g.updateMatrixWorld();
    U.uBloomPos.value.copy(g.localToWorld(tmpV.copy(branch.flowers.anchor)));
    branch.glow.material.opacity = bloom * L.glow * (0.85 + 0.15 * breath) * U.uBranchVis.value;
  }
  /** touch: world-space points (hands / controllers) and/or a desktop ray. Returns true on a new touch. */
  const touchW = branch.touchPts.map((p) => p.clone()), prevPts = [];
  function interact(time, dt, points = [], ray = null) {
    if (U.uBranchVis.value < 0.5 || U.uReveal.value < 1) return false;
    const g = branch.group;
    touchW.forEach((w, i) => w.copy(branch.touchPts[i]).applyMatrix4(g.matrixWorld));
    let hit = null, speed = 0;
    points.forEach((p, k) => {
      if (!p) return;
      const prev = prevPts[k]; const v = prev ? p.distanceTo(prev) / Math.max(dt, 1e-3) : 0; prevPts[k] = p.clone();
      for (const w of touchW) if (w.distanceTo(p) < TC.radius) { hit = w; speed = Math.max(speed, v); break; }
    });
    if (!hit && ray) for (const w of touchW) if (ray.distanceToPoint(w) < TC.radius * 0.6) { hit = w; speed = TC.minSpeed * 2; break; }
    if (hit && time - lastTouch > TC.cooldown && speed >= TC.minSpeed) {
      lastTouch = time; trembles++;
      tremble = Math.min(1, tremble + 0.5 + Math.min(0.5, speed * 0.4));
      branch.flowers.shed(TC.shed, g.worldToLocal(hit.clone()));
      return true;
    }
    return false;
  }
  /** hand points → branch space, for petals that come to rest on a hand */
  const handsLocal = [];
  function petalsTick(dt, time, points = []) {
    const g = branch.group;
    points.forEach((p, k) => (handsLocal[k] = p ? g.worldToLocal((handsLocal[k] || new THREE.Vector3()).copy(p)) : null));
    handsLocal.length = points.length;
    branch.flowers.updatePetals(dt, time, wind, handsLocal);
  }
  setLight(0); update(0);

  return {
    room, setLight, branch, fadeables, update,
    setBaseY: (y) => (baseY = y),
    setShadowOpacity: (o) => (shadowOpacity = o),
    setYaw: (y) => (yawOverride = y),
    setBeamLevel: (k) => (beamLevel = k),
    setBloom: (k) => { bloom = k; U.uBloom.value = k; },
    setNeutral: (k) => (U.uNeutral.value = k),
    setReveal: (k) => { U.uReveal.value = k; branch.barkMesh.castShadow = k >= 1; },
    setBranchVis: (k) => { U.uBranchVis.value = k; branch.group.visible = k > 0.001; },   // hidden = no draw calls
    setSink: (m) => (sink = m),
    setFocus: (k) => (focus = k),
    setPotVis: (k) => (U.uPotVis.value = k),
    setPotPos: (v) => potPos.copy(v),
    setDust: (k) => (dustLevel = k),
    interact, petalsTick,
    stats: () => ({ trembles, wind, tremble, landed: branch.flowers.landedCount() }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
/** A cut almond twig: faceted bark with knots, sleeping buds, forks and twigs. */
function buildBranch() {
  const r = rng(CONFIG.branch.seed);
  const segs = [];
  const UP = new THREE.Vector3(0, 1, 0);
  const seg = (a, b, r0, r1, depth) => segs.push({ start: a.clone(), end: b.clone(), r0, r1, depth });
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const Jt = () => (r() - 0.5) * 0.03;
  const main = [V(0, 0), V(0.2, 0.05 + Jt(), Jt()), V(0.38, 0.03 + Jt(), Jt()), V(0.56, 0.09 + Jt(), Jt()), V(0.74, 0.08 + Jt(), Jt())];
  for (let i = 0; i < main.length - 1; i++) {
    const t0 = 1 - i / main.length, t1 = 1 - (i + 1) / main.length;
    seg(main[i], main[i + 1], 0.019 * t0 + 0.004, 0.019 * t1 + 0.004, i < 2 ? 0 : 2);
  }
  const tips = [main[main.length - 1]];
  [[1, 0.75, 0.24], [2, -0.6, 0.2], [3, 0.65, 0.17]].forEach(([n, ang, len], k) => {
    const d = main[n + 1].clone().sub(main[n]).normalize().applyAxisAngle(V(0, 0, 1), ang + Jt() * 4);
    d.z = (r() - 0.5) * 0.5; d.normalize();
    const e = main[n].clone().addScaledVector(d, len);
    seg(main[n], e, 0.011 - k * 0.002, 0.005, 3); tips.push(e);
    if (k !== 1) {
      const d2 = d.clone().applyAxisAngle(V(0, 0, 1), -Math.sign(ang) * 0.6);
      const m = main[n].clone().lerp(e, 0.55), e2 = m.clone().addScaledVector(d2, len * 0.45);
      seg(m, e2, 0.006, 0.003, 4); tips.push(e2);
    }
  });
  const box = new THREE.Box3(); segs.forEach((s) => box.expandByPoint(s.start).expandByPoint(s.end));
  const ctr = box.getCenter(new THREE.Vector3());
  segs.forEach((s) => { s.start.sub(ctr); s.end.sub(ctr); }); tips.forEach((t) => t.sub(ctr));

  const bark = new THREE.Color(P.bark), knotC = new THREE.Color(P.barkKnot), budC = new THREE.Color(P.barkBud), cutC = new THREE.Color(P.barkCut);
  const parts = [];
  const colorize = (g, fn) => {               // per-triangle (faceted, gouache) color
    const n = g.attributes.position.count, col = new Float32Array(n * 3), cc = new THREE.Color();
    for (let t = 0; t < n / 3; t++) { fn(cc, t); for (let j = 0; j < 3; j++) cc.toArray(col, (t * 3 + j) * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
  };
  const place = (g, a, dir) => { g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir)); g.translate(a.x, a.y, a.z); return g; };

  segs.forEach((s, si) => {
    const dir = s.end.clone().sub(s.start); const len = dir.length(); dir.normalize();
    let g = new THREE.CylinderGeometry(s.r1, s.r0, len + s.r0 * 0.8, 7, 4, false);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {            // knobbly, faceted bark
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + (phash(x, y, z, si) - 0.5) * 0.45;
      p.setXYZ(i, x * k, y + (phash(x, y, z, si + 9) - 0.5) * 0.006, z * k);
    }
    g = g.toNonIndexed(); g.computeVertexNormals();
    colorize(g, (cc) => cc.copy(bark).multiplyScalar(0.82 + r() * 0.3));
    parts.push(place(g, s.start.clone().lerp(s.end, 0.5), dir));
    // knots: small dark swellings on the thicker parts
    if (s.r0 > 0.009) for (let k = 0; k < 2; k++) {
      const kn = new THREE.IcosahedronGeometry(s.r0 * 0.75, 0); kn.scale(1, 0.7, 1);
      const a = r() * Math.PI * 2, along = (r() - 0.5) * len * 0.7;
      kn.translate(Math.cos(a) * s.r0 * 0.75, along, Math.sin(a) * s.r0 * 0.75);
      colorize(kn, (cc) => cc.copy(knotC).multiplyScalar(0.85 + r() * 0.3));
      parts.push(place(kn, s.start.clone().lerp(s.end, 0.5), dir));
    }
    // sleeping buds along the twig (grey-brown, pointed)
    for (let k = 0; k < (s.depth >= 2 ? 2 : 1); k++) {
      const bd = new THREE.ConeGeometry(s.r1 * 0.55 + 0.002, 0.016, 5); bd.translate(0, 0.008, 0);
      const a = r() * Math.PI * 2, t = 0.3 + r() * 0.6;
      const out = new THREE.Vector3(Math.cos(a), 0.6, Math.sin(a)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
      bd.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, out.applyQuaternion(q).normalize()));
      const at = s.start.clone().lerp(s.end, t).add(new THREE.Vector3(Math.cos(a) * s.r1, 0, Math.sin(a) * s.r1).applyQuaternion(q));
      bd.translate(at.x, at.y, at.z);
      const bdn = bd.toNonIndexed(); colorize(bdn, (cc) => cc.copy(budC).multiplyScalar(0.85 + r() * 0.3));
      parts.push(bdn);
    }
  });
  // terminal buds on the tips
  tips.forEach((t) => { const b = new THREE.ConeGeometry(0.004, 0.02, 5).toNonIndexed(); b.rotateZ(-Math.PI / 2 + (r() - 0.5) * 0.6); b.translate(t.x + 0.008, t.y, t.z); colorize(b, (cc) => cc.copy(budC)); parts.push(b); });
  // the pale cut end
  const cut = new THREE.CircleGeometry(segs[0].r0 * 1.05, 7).toNonIndexed(); cut.rotateY(-Math.PI / 2); cut.translate(segs[0].start.x - segs[0].r0 * 0.35, segs[0].start.y, segs[0].start.z);
  colorize(cut, (cc) => cc.copy(cutC)); parts.push(cut);

  const clean = (g) => {                      // same attribute set for every part: position, normal, color
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    g.computeVertexNormals(); return g;
  };
  const geo = mergeGeometries(parts.map(clean));
  // draw order for the "branch draws itself" reveal: arc length from the cut end along the wood (0..1)
  segs.forEach((sg, i) => {
    sg.len = sg.start.distanceTo(sg.end);
    if (i === 0) { sg.arc0 = 0; return; }
    let best = Infinity, arc = 0;
    for (let j = 0; j < i; j++) {
      const o = segs[j], d = o.end.clone().sub(o.start), t = THREE.MathUtils.clamp(sg.start.clone().sub(o.start).dot(d) / d.lengthSq(), 0, 1);
      const dist = o.start.clone().addScaledVector(d, t).distanceTo(sg.start); if (dist < best) { best = dist; arc = o.arc0 + t * o.len; }
    }
    sg.arc0 = arc;
  });
  const arcMax = Math.max(...segs.map((sg) => sg.arc0 + sg.len));
  const drawAt = (pt) => {                    // nearest segment → normalised arc length
    let best = Infinity, arc = 0;
    for (const o of segs) {
      const d = o.end.clone().sub(o.start), t = THREE.MathUtils.clamp(pt.clone().sub(o.start).dot(d) / d.lengthSq(), 0, 1);
      const dist = o.start.clone().addScaledVector(d, t).distanceTo(pt); if (dist < best) { best = dist; arc = o.arc0 + t * o.len; }
    }
    return arc / arcMax;
  };
  { const pa = geo.attributes.position, dr = new Float32Array(pa.count), tv = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) dr[i] = drawAt(tv.fromBufferAttribute(pa, i));
    geo.setAttribute('aDraw', new THREE.BufferAttribute(dr, 1)); }
  const barkMat = applyLook(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT }), { hatch: true, rim: true, rimEdge: L.barkRimEdge, reveal: true, vis: 'branch', grain: 1.4 });
  const group = new THREE.Group();
  const barkMesh = new THREE.Mesh(geo, barkMat); barkMesh.castShadow = barkMesh.receiveShadow = true;
  group.add(barkMesh);

  const flowers = buildFlowers(segs, drawAt);
  group.add(flowers.group);
  // warm glow around the blossom (additive sprite, fades in with the bloom)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(255,232,215,0.5)'], [0.35, 'rgba(255,220,200,0.2)'], [1, 'rgba(255,215,195,0)']]), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(1.1); glow.position.copy(flowers.anchor); glow.renderOrder = 3; group.add(glow);
  // points along the wood (branch space) for touch detection
  const touchPts = []; segs.forEach((sg) => { for (let k = 0; k <= 4; k++) touchPts.push(sg.start.clone().lerp(sg.end, k / 4)); });
  return { group, glow, barkMesh, touchPts, materials: [barkMat, flowers.material, flowers.petalMat, glow.material], flowers };
}

// ─────────────────────────────────────────────────────────────────────────────
/** Almond blossoms in three stages (buds, half-open, open with stamens) + drifting petals. */
function buildFlowers(segs, drawAt) {
  const r = rng(23);
  const rim = new THREE.Color(P.blossomEdge), mid = new THREE.Color(P.blossom), core = new THREE.Color(P.blossomCore), budC = new THREE.Color(P.blossomBud);
  const cArr = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, 0);
  petalShape.bezierCurveTo(-0.38, 0.22, -0.36, 0.86, -0.09, 1.0);
  petalShape.quadraticCurveTo(0, 0.92, 0.09, 1.0);                     // the little notch of an almond petal
  petalShape.bezierCurveTo(0.36, 0.86, 0.38, 0.22, 0, 0);
  const petal = (cup, scale, pink) => {
    const g = new THREE.ShapeGeometry(petalShape, 5).toNonIndexed();
    const p = g.attributes.position, col = [];
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), x = p.getX(i);
      p.setZ(i, y * y * 0.35 + x * x * 0.5);                             // cupped petal
      // deep heart at the base, a quick blush, then near-white; buds (pink≈1) stay pink
      const body = mid.clone().lerp(budC, pink), tipC = rim.clone().lerp(budC, pink * 0.8);
      const cc = y < 0.3 ? core.clone().lerp(body, Math.pow(y / 0.3, 1.4)) : body.clone().lerp(tipC, Math.min(1, (y - 0.2) / 0.6));
      col.push(cc.r, cc.g, cc.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    g.scale(scale, scale, scale); g.rotateX(-cup);
    return g;
  };
  const tri = (pts, cols) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols.flat(), 3));
    return g;
  };
  const flower = (kind) => {
    const parts = [];
    const cup = kind === 'bud' ? 1.3 : kind === 'half' ? 0.85 : 0.32, sc = kind === 'bud' ? 0.55 : kind === 'half' ? 0.8 : 1;
    const pink = kind === 'bud' ? 1.0 : kind === 'half' ? 0.3 : 0;
    for (let i = 0; i < 5; i++) { const g = petal(cup + (r() - 0.5) * 0.15, sc, pink); g.rotateZ((i / 5) * Math.PI * 2 + (r() - 0.5) * 0.2); parts.push(g); }
    // calyx: little red-brown sepals behind the petals
    for (let i = 0; i < 5; i++) {
      const a = (i / 5 + 0.1) * Math.PI * 2, b = a + 0.35, s = 0.32 * sc;
      parts.push(tri([[0, 0, -0.02], [Math.cos(a) * 0.1, Math.sin(a) * 0.1, -0.04], [Math.cos((a + b) / 2) * s, Math.sin((a + b) / 2) * s, -0.12 * sc]], [cArr(P.sepal), cArr(P.sepal), cArr(P.blossomCore)]));
    }
    if (kind === 'full') {   // stamens with tiny anthers + a rosy centre
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + r() * 0.2, len = 0.26 + r() * 0.1, w = 0.012;
        const tip = [Math.cos(a) * len, Math.sin(a) * len, 0.16 + r() * 0.06];
        parts.push(tri([[Math.cos(a + 1.57) * w, Math.sin(a + 1.57) * w, 0.02], [Math.cos(a - 1.57) * w, Math.sin(a - 1.57) * w, 0.02], tip], [cArr(P.stamen), cArr(P.stamen), cArr(P.anther)]));
        const s = 0.025;
        parts.push(tri([[tip[0] - s, tip[1], tip[2]], [tip[0] + s, tip[1], tip[2]], [tip[0], tip[1] + s * 1.6, tip[2] + 0.01]], [cArr(P.anther), cArr(P.anther), cArr(P.anther)]));
      }
      const c = new THREE.CircleGeometry(0.13, 7).toNonIndexed(); c.translate(0, 0, 0.03); c.deleteAttribute('uv'); c.deleteAttribute('normal');
      c.setAttribute('color', new THREE.Float32BufferAttribute(new Array(c.attributes.position.count).fill(0).flatMap(() => cArr(P.blossomCore)), 3)); parts.push(c);
    }
    const mg = mergeGeometries(parts.map((g) => { if (g.attributes.normal) g.deleteAttribute('normal'); if (g.attributes.uv) g.deleteAttribute('uv'); return g; }));
    mg.computeVertexNormals(); return mg;
  };

  const material = withSaturation(applyLook(new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide, gradientMap: GRADIENT, emissive: P.blossomEmissive }), { space: 'world', rim: true, petal: true, vis: 'branch', grain: 0.6 }));
  const kinds = ['bud', 'half', 'full'];
  const items = { bud: [], half: [], full: [] };
  const root = segs[0].start;
  for (const s of segs) {
    const count = s.depth >= 3 ? 4 : 6;
    for (let k = 0; k < count; k++) {
      const t = 0.3 + r() * 0.7;
      // flowers sit on the wood and face OUTWARD from it (a little toward the tip, like real almond)
      const dirS = s.end.clone().sub(s.start).normalize();
      const perp0 = new THREE.Vector3().crossVectors(dirS, Math.abs(dirS.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
      const ang = r() * Math.PI * 2;
      const mkFlower = (a, tt, kindF, size, extraDelay) => {
        const out = perp0.clone().applyAxisAngle(dirS, a);
        const rad = THREE.MathUtils.lerp(s.r0, s.r1, tt);
        const pp = s.start.clone().lerp(s.end, tt).addScaledVector(out, rad * 0.9);
        const face = out.clone().addScaledVector(dirS, L.blossomForward).normalize();
        const qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), face).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), r() * 6.28));
        items[kindF].push({ p: pp, q: qq, out, size, delay: (drawAt ? drawAt(pp) : pp.distanceTo(root)) + extraDelay, tint: 0.92 + r() * 0.08 });
      };
      const x = r(), kind = s.depth >= 3 && x < 0.3 ? 'bud' : x < 0.18 ? 'bud' : x < 0.42 ? 'half' : 'full';
      mkFlower(ang, t, kind, 0.034 + r() * 0.012, 0);
      if (kind === 'full' && r() < (P.blossomPairs ?? 0))      // almond flowers often sit in pairs, close to the wood
        mkFlower(ang + (r() < 0.5 ? -1 : 1) * (0.8 + r() * 0.5), Math.min(1, t + (r() - 0.5) * 0.08), r() < 0.7 ? 'full' : 'half', 0.03 + r() * 0.01, 0.05);
    }
  }
  const all = [...items.bud, ...items.half, ...items.full];
  const maxDelay = Math.max(...all.map((i) => i.delay));
  all.forEach((i) => (i.delay = (i.delay / maxDelay) * 0.6 + r() * 0.1));
  const group = new THREE.Group(); const meshes = {};
  const cc = new THREE.Color();
  for (const k of kinds) {
    const m = new THREE.InstancedMesh(flower(k), material, Math.max(1, items[k].length)); m.frustumCulled = false; m.castShadow = m.receiveShadow = true;
    items[k].forEach((it, i) => m.setColorAt(i, cc.setRGB(1, it.tint, it.tint)));
    meshes[k] = m; group.add(m);
  }
  const m4 = new THREE.Matrix4(), sc = new THREE.Vector3();
  function setProgress(prog) {
    for (const k of kinds) {
      items[k].forEach((it, i) => {
        const lp = THREE.MathUtils.clamp((prog - it.delay) / 0.3, 0, 1);
        const e = lp === 0 ? 0 : 1 + 2.2 * Math.pow(lp - 1, 3) + 1.2 * Math.pow(lp - 1, 2);
        sc.setScalar(Math.max(1e-4, it.size * e)); m4.compose(it.p, it.q, sc); meshes[k].setMatrixAt(i, m4);
      });
      meshes[k].instanceMatrix.needsUpdate = true;
    }
  }
  setProgress(0);
  const anchor = all.reduce((a, it) => a.add(it.p), new THREE.Vector3()).multiplyScalar(1 / all.length);

  // drifting petals (fall in branch space, sway, tumble, ride the wind; one may rest on a hand)
  const pg = petal(0.2, 1, 0.1); pg.translate(0, -0.5, 0); pg.computeVertexNormals();
  const petalMat = withSaturation(applyLook(new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide, gradientMap: GRADIENT, emissive: P.blossomEmissive }), { space: 'world', rim: true, petal: true, vis: 'branch', grain: 0.6 }));
  petalMat.userData.uSat = material.userData.uSat;
  const NP = L.petals;
  const petals = new THREE.InstancedMesh(pg, petalMat, NP); petals.frustumCulled = false; group.add(petals);
  const pst = Array.from({ length: NP }, () => ({ alive: false, p: new THREE.Vector3(), vel: new THREE.Vector3(), v: 0, ph: 0, t: 0, life: 10, land: null, tried: false }));
  let petalsOn = false, landed = 0;
  const q = new THREE.Quaternion(), eu = new THREE.Euler(), tv = new THREE.Vector3();
  const T = CONFIG.touch, Wd = CONFIG.wind;
  function spawn(s, at, kick) {
    s.alive = true; s.p.copy(at); s.v = 0.04 + Math.random() * 0.04; s.ph = Math.random() * 6; s.t = 0; s.life = 10; s.land = null; s.tried = false;
    s.vel.set((Math.random() - 0.5), Math.random() * 0.5, (Math.random() - 0.5)).multiplyScalar(kick);
  }
  /** shed n petals from the flowers nearest to a point (branch space) — when the branch is touched */
  function shed(n, near) {
    const open = [...items.full, ...items.half].sort((a, b) => a.p.distanceToSquared(near) - b.p.distanceToSquared(near)).slice(0, 6);
    for (let k = 0; k < n; k++) { const s = pst.find((x) => !x.alive); if (!s || !open.length) return; const it = open[(Math.random() * open.length) | 0]; spawn(s, tv.copy(it.p).addScaledVector(it.out, 0.02), 0.08); }
  }
  /** wind: -1..1, hands: hand/controller points in branch space (a petal may come to rest on one) */
  function updatePetals(dt, time, wind = 0, hands = []) {
    pst.forEach((s, i) => {
      if (!s.alive && petalsOn && Math.random() < dt * 0.18) { const it = all[(Math.random() * all.length) | 0]; spawn(s, it.p, 0.0); }
      if (s.alive) {
        s.t += dt;
        if (s.land) {                                              // resting on a hand: follow it, then slip off
          const h = hands[s.land.k];
          if (h && s.t < s.land.until) s.p.copy(h).add(s.land.off); else { s.land = null; s.v = 0.05; }
        } else {
          s.vel.multiplyScalar(Math.max(0, 1 - dt * 1.5));
          s.p.y -= s.v * dt; s.p.addScaledVector(s.vel, dt);
          s.p.x += (Math.sin(time * 0.9 + s.ph) * 0.06 + wind * Wd.drift) * dt; s.p.z += (Math.cos(time * 0.7 + s.ph) * 0.06 + wind * Wd.drift * 0.4) * dt;
          if (!s.tried) for (let k = 0; k < hands.length; k++) {
            const h = hands[k]; if (!h) continue;
            const dx = s.p.x - h.x, dz = s.p.z - h.z, dy = s.p.y - h.y;
            if (dx * dx + dz * dz < T.landRadius * T.landRadius && dy > -0.01 && dy < 0.06) {
              s.tried = true;
              if (Math.random() < T.landChance) { s.land = { k, off: new THREE.Vector3(dx * 0.5, 0.012, dz * 0.5), until: s.t + T.landHold }; s.life = s.t + T.landHold + 5; landed++; }
              break;
            }
          }
        }
        if (s.t > s.life) s.alive = false;
      }
      q.setFromEuler(eu.set(s.land ? 1.4 : time * 0.8 + s.ph, s.ph, s.land ? 0 : time * 0.5));
      const fade = s.alive ? Math.min(1, s.t * 2, (s.life - s.t) * 0.5) : 0;
      sc.setScalar(Math.max(1e-4, 0.022 * fade)); m4.compose(s.p, q, sc); petals.setMatrixAt(i, m4);
    });
    petals.instanceMatrix.needsUpdate = true;
  }

  return {
    group, petals, material, petalMat, anchor, setProgress, updatePetals, shed, landedCount: () => landed,
    setPetals: (on) => (petalsOn = on),
    setSaturation: (s) => (material.userData.uSat.value = s),
    setOpacity: (o) => { material.transparent = petalMat.transparent = true; material.opacity = o; petalMat.opacity = o; },
  };
}
