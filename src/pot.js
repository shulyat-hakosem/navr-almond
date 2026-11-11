// Test two: the boiling pot (סיר נפוח), placed at virtual NORTH, its face tilted toward the learner.
// Same look as the branch: faceted, toon-lit by the invisible sun, paper grain + ink hatching.
// Draw calls: body+handles (1) · boiling surface (1) · steam (1).
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { applyLook, U } from './look.js';
import { GRADIENT, rng } from './world.js';

export function buildPot(scene) {
  const C = CONFIG.pot, r = rng(11);
  const group = new THREE.Group(); scene.add(group);

  // ── body: a hand-made lathe profile, faceted, with a thick lip and two loop handles ──
  const prof = [[0.0, 0.0], [0.1, 0.004], [0.17, 0.035], [0.215, 0.1], [0.222, 0.16], [0.205, 0.225], [0.178, 0.268],
    [0.172, 0.285], [0.188, 0.296], [0.19, 0.307], [0.172, 0.31], [0.16, 0.28], [0.17, 0.2], [0.15, 0.08], [0.0, 0.05]]
    .map(([x, y]) => new THREE.Vector2(x * C.size, y * C.size));
  let body = new THREE.LatheGeometry(prof, 15);
  const pa = body.attributes.position;
  for (let i = 0; i < pa.count; i++) {        // irregular, hammered
    const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), k = 1 + (Math.sin(x * 91 + y * 57) * Math.cos(z * 73 + y * 31)) * 0.035;
    pa.setXYZ(i, x * k, y, z * k);
  }
  body = body.toNonIndexed();
  const handles = [-1, 1].map((sgn) => {
    const h = new THREE.TorusGeometry(0.045 * C.size, 0.011 * C.size, 4, 9, Math.PI * 1.25).toNonIndexed();
    h.rotateY(Math.PI / 2); h.rotateX(-Math.PI * 0.12); h.translate(sgn * 0.225 * C.size, 0.235 * C.size, 0);
    return h;
  });
  const parts = [body, ...handles].map((g) => {
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    const n = g.attributes.position.count, col = new Float32Array(n * 3), base = new THREE.Color(C.color), cc = new THREE.Color();
    for (let t = 0; t < n / 3; t++) { cc.copy(base).multiplyScalar(0.8 + r() * 0.35); for (let j = 0; j < 3; j++) cc.toArray(col, (t * 3 + j) * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
  });
  const geo = mergeGeometries(parts); geo.computeVertexNormals();
  const mat = applyLook(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT, side: THREE.DoubleSide }), { hatch: true, rim: true, rimEdge: CONFIG.look.barkRimEdge, vis: 'pot', grain: 1.3 });
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = mesh.receiveShadow = C.shadows; group.add(mesh);

  // ── the boiling surface: dark water with rings of bubbles that open and vanish ──
  const uBoil = { value: C.boilBase };
  const surf = new THREE.Mesh(new THREE.CircleGeometry(0.168 * C.size, 18), new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uBoil, uVis: U.uPotVis, uLight: { value: new THREE.Color(CONFIG.look.rimColor) }, uWater: { value: new THREE.Color(C.water) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float uTime, uBoil, uVis; uniform vec3 uLight, uWater; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 q = vUv * 9.0; vec2 id = floor(q), f = fract(q) - 0.5;
        float hh = h(id), ph = fract(uTime * (0.35 + hh * 0.5) * (0.35 + 1.3 * uBoil) + hh * 7.0);
        float on = step(hh, 0.08 + 0.5 * uBoil);
        float ring = smoothstep(0.035, 0.0, abs(length(f + (hh - 0.5) * 0.3) - ph * 0.42)) * (1.0 - ph) * (1.0 - ph) * on;
        float swirl = 0.5 + 0.5 * sin(vUv.x * 21.0 + uTime * (0.6 + uBoil) + sin(vUv.y * 17.0 - uTime));
        vec3 c = uWater * (0.7 + 0.3 * swirl) + uLight * ring * (0.15 + 0.3 * uBoil);
        float edge = smoothstep(0.5, 0.42, length(vUv - 0.5));
        gl_FragColor = vec4(c * uVis * (0.6 + 0.4 * edge), 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  surf.rotation.x = -Math.PI / 2; surf.position.y = 0.262 * C.size; group.add(surf);

  // ── steam: soft particles rising from the mouth, lit warm by the unseen sun ──
  const N = C.steam, sp = [], sd = [];
  for (let i = 0; i < N; i++) { const a = r() * 6.283, rr = Math.sqrt(r()) * 0.14 * C.size; sp.push(Math.cos(a) * rr, 0.28 * C.size, Math.sin(a) * rr); sd.push(r()); }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd, 1));
  const uSteam = { value: 0.5 }, uScale = { value: 900 };
  const steamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uSteam, uBoil, uVis: U.uPotVis, uScale, uLight: { value: new THREE.Color(C.steamColor) } },
    vertexShader: `attribute float aSeed; uniform float uTime, uBoil, uScale; varying float vA;
      void main(){
        float age = fract(uTime * (0.08 + 0.12 * uBoil) * (0.7 + aSeed * 0.6) + aSeed * 13.0);
        vec3 p = position;
        p.y += age * ${(0.75 * C.size).toFixed(3)};
        p.x += sin(age * 5.0 + aSeed * 31.0 + uTime * 0.4) * 0.05 * age + age * 0.06;
        p.z += cos(age * 4.0 + aSeed * 17.0) * 0.05 * age;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vA = smoothstep(0.0, 0.15, age) * (1.0 - age);
        gl_PointSize = clamp(uScale * (0.06 + age * 0.22) / -mv.z, 2.0, 420.0);
      }`,
    fragmentShader: `uniform float uSteam, uVis; uniform vec3 uLight; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a *= a;
        gl_FragColor = vec4(uLight, a * vA * uSteam * uVis * 0.16); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const steam = new THREE.Points(sg, steamMat); steam.frustumCulled = false; steam.renderOrder = 4; group.add(steam);

  // place at virtual north, its face (mouth) tilted toward the learner
  let eyeY = 1.6;
  function place(eye = eyeY) {
    eyeY = eye;
    group.position.set(C.x, eye - C.belowEye, C.z);
    group.rotation.set(C.tilt, Math.atan2(-C.x, -C.z), 0, 'YXZ');
    group.scale.setScalar(1);
    group.updateMatrixWorld(true);
  }
  place();
  let boil = C.boilBase;
  function update(time, dt, viewH) {
    uScale.value = viewH;
    uBoil.value = boil;
    uSteam.value = 0.35 + 0.65 * boil;
    group.visible = U.uPotVis.value > 0.001;
    // the pot shivers a little when it boils hard
    mesh.position.y = Math.sin(time * 23.0) * 0.0015 * boil * boil;
  }
  return {
    group, place, update, material: mat,
    center: () => group.localToWorld(new THREE.Vector3(0, 0.15 * C.size, 0)),
    setBoil: (k) => (boil = k), getBoil: () => boil,
  };
}
