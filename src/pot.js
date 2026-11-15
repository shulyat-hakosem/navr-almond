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
  const uBoil = { value: C.boilBase }, uHeat = { value: 0.15 };
  const surf = new THREE.Mesh(new THREE.CircleGeometry(0.168 * C.size, 28), new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uBoil, uHeat, uVis: U.uPotVis, uLight: { value: new THREE.Color(CONFIG.look.rimColor) }, uWater: { value: new THREE.Color(C.water) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float uTime, uBoil, uVis, uHeat; uniform vec3 uLight, uWater; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      // jittered bubbles that swell, ring and burst (no visible grid)
      float bub(vec2 uv, float sc, float sd){
        vec2 q = uv * sc, id = floor(q), f = fract(q);
        float hh = h(id + sd); vec2 c = vec2(h(id + sd + 1.7), h(id + sd + 5.3)) * 0.6 + 0.2;
        float ph = fract(uTime * (0.4 + hh * 0.7) * (0.35 + 1.5 * uBoil) + hh * 7.0);
        float on = step(hh, 0.18 + 0.62 * uBoil), r = ph * 0.3 * (0.55 + hh), d = length(f - c);
        return (smoothstep(0.045, 0.0, abs(d - r)) + smoothstep(r, 0.0, d) * 0.3) * (1.0 - ph) * (1.0 - ph) * on;
      }
      void main(){
        vec2 uv = vUv + 0.03 * vec2(sin(vUv.y * 9.0 + uTime * 1.3), cos(vUv.x * 8.0 - uTime * 1.1)) * (0.5 + uBoil);   // churning
        float b = bub(uv, 7.0, 0.0) + bub(uv + 0.37, 12.0, 3.1) * 0.8 + bub(uv + 0.71, 21.0, 7.7) * 0.6;
        float swirl = 0.5 + 0.5 * sin(uv.x * 21.0 + uTime * (0.6 + uBoil) + sin(uv.y * 17.0 - uTime));
        vec3 ember = vec3(1.0, 0.42, 0.12) * (0.04 + 1.1 * uHeat) * uBoil * (0.6 + 0.4 * sin(uTime * 2.3 + uv.x * 11.0 + uv.y * 7.0)) * (1.0 - swirl * 0.6);
        vec3 c = uWater * (0.7 + 0.3 * swirl) * (1.0 - 0.55 * uHeat) + mix(uLight, vec3(1.3, 0.62, 0.22), uHeat) * b * (0.28 + 0.4 * uBoil + uHeat * 0.15) + ember;
        float edge = smoothstep(0.5, 0.42, length(vUv - 0.5));
        gl_FragColor = vec4(c * uVis * (0.6 + 0.4 * edge), 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  surf.rotation.x = -Math.PI / 2; surf.position.y = 0.262 * C.size; group.add(surf);

  // ── v6 · "סיר נפוח": everything streams ONE way (CONFIG.pot.flowDir, world space) ──
  // uUp / uFlow are the world up + flow directions expressed in the pot's local frame (it is tilted).
  const uUp = { value: new THREE.Vector3(0, 1, 0) }, uFlow = { value: new THREE.Vector3(0, 0, -1) }, uGust = { value: 0.5 };
  const uScale = { value: 900 }, uSteam = { value: 0.5 }, uFire = { value: 1 };
  const S = C.size, lip = 0.28 * S;
  const points = (n, fill) => {
    const pos = [], seed = [], jit = [];
    for (let i = 0; i < n; i++) { fill(pos, i); seed.push(r()); jit.push(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    g.setAttribute('aJit', new THREE.Float32BufferAttribute(jit, 3));
    return g;
  };
  const mouth = (pos) => { const a = r() * 6.283, rr = Math.sqrt(r()) * 0.14 * S; pos.push(Math.cos(a) * rr, lip, Math.sin(a) * rr); };
  const HEAD = 'attribute float aSeed; attribute vec3 aJit; uniform float uTime, uBoil, uScale, uGust; uniform vec3 uUp, uFlow; varying float vA; varying float vAge;';

  // steam: rises, then leans and streams along the flow
  const steamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uSteam, uBoil, uVis: U.uPotVis, uScale, uGust, uUp, uFlow, uLight: { value: new THREE.Color(C.steamColor) } },
    vertexShader: `${HEAD}
      void main(){
        float age = fract(uTime * (0.09 + 0.14 * uBoil) * (0.7 + aSeed * 0.6) + aSeed * 13.0);
        vec3 p = position;
        p += uUp * (age * ${(0.55 * S).toFixed(3)});
        p += uFlow * (pow(age, 1.5) * ${(C.steamPush * S).toFixed(3)} * (0.55 + 0.45 * uBoil) * (0.8 + 0.4 * uGust));
        p += vec3(sin(age * 5.0 + aSeed * 31.0 + uTime * 0.4), cos(age * 3.0 + aSeed * 7.0) * 0.5, cos(age * 4.0 + aSeed * 17.0)) * 0.06 * age;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vA = smoothstep(0.0, 0.12, age) * (1.0 - age); vAge = age;
        gl_PointSize = clamp(uScale * (0.06 + age * 0.26) / -mv.z, 2.0, 420.0);
      }`,
    fragmentShader: `uniform float uSteam, uVis; uniform vec3 uLight; varying float vA; varying float vAge;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a *= a;
        gl_FragColor = vec4(uLight, a * vA * uSteam * uVis * 0.24); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const steam = new THREE.Points(points(C.steam, mouth), steamMat); steam.frustumCulled = false; steam.renderOrder = 4; group.add(steam);

  // sparks: spat from the boiling surface, carried far along the flow (past the learner)
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uBoil, uVis: U.uPotVis, uScale, uGust, uUp, uFlow, uFire, uCol: { value: new THREE.Color(C.sparkColor) } },
    vertexShader: `${HEAD} uniform float uFire;
      void main(){
        float life = 1.6 + aSeed * 1.8;
        float age = fract(uTime / life + aSeed * 7.31);
        vec3 p = position;
        p += uUp * (age * ${(0.5 * S).toFixed(3)} - age * age * ${(0.12 * S).toFixed(3)});
        p += uFlow * (age * age * ${(C.sparkReach * S / 1.25).toFixed(3)} * (0.6 + 0.5 * uBoil) * (0.85 + 0.3 * uGust));
        vec3 side = normalize(cross(uFlow, uUp));
        p += side * aJit.x * age * age * ${(0.7).toFixed(3)} + uUp * aJit.y * age * age * 0.35;
        p += vec3(sin(uTime * 7.0 + aSeed * 40.0), cos(uTime * 5.0 + aSeed * 23.0), sin(uTime * 6.0 + aSeed * 11.0)) * 0.015 * age;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        float on = step(aSeed, 0.25 + 0.75 * uBoil) * uFire;
        float flick = 0.65 + 0.35 * sin(uTime * 30.0 + aSeed * 90.0);
        vA = on * smoothstep(0.0, 0.04, age) * (1.0 - age) * flick; vAge = age;
        gl_PointSize = clamp(uScale * 0.017 * (1.2 - age * 0.6) / -mv.z, 2.0, 18.0);
      }`,
    fragmentShader: `uniform float uVis; uniform vec3 uCol; varying float vA; varying float vAge;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d);
        vec3 c = mix(vec3(1.0, 0.93, 0.75), uCol, smoothstep(0.0, 0.5, vAge)) * (1.0 - 0.4 * vAge);
        gl_FragColor = vec4(c * 1.4, a * vA * uVis); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const sparks = new THREE.Points(points(C.sparks, (pos) => { const a = r() * 6.283, rr = Math.sqrt(r()) * 0.13 * S; pos.push(Math.cos(a) * rr, lip - 0.01, Math.sin(a) * rr); }), sparkMat);
  sparks.frustumCulled = false; sparks.renderOrder = 5; group.add(sparks);

  // the fire beneath: flame tongues fanned along the flow ("נפוח": someone blows on the fire)
  const flameMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uBoil, uVis: U.uPotVis, uScale, uGust, uUp, uFlow, uFire, uCol: { value: new THREE.Color(C.flameColor) } },
    vertexShader: `${HEAD} uniform float uFire;
      void main(){
        float age = fract(uTime * (0.9 + aSeed * 0.9) + aSeed * 5.0);
        vec3 p = position;
        p += uUp * (age * ${(0.24 * S).toFixed(3)} * (0.8 + 0.4 * uBoil));
        p += normalize(vec3(position.x, 0.0, position.z) + 1e-4) * age * ${(0.07 * S).toFixed(3)};   // lick up the outside of the belly
        p += uFlow * (age * age * ${(0.2 * S).toFixed(3)} * (0.5 + 0.9 * uGust));
        p += vec3(sin(uTime * 9.0 + aSeed * 30.0), 0.0, cos(uTime * 8.0 + aSeed * 20.0)) * 0.012;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vA = uFire * smoothstep(0.0, 0.1, age) * (1.0 - age); vAge = age;
        gl_PointSize = clamp(uScale * 0.11 * (1.0 - age * 0.7) / -mv.z, 2.0, 200.0);
      }`,
    fragmentShader: `uniform float uVis; uniform vec3 uCol; varying float vA; varying float vAge;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a *= a;
        vec3 c = mix(vec3(1.0, 0.85, 0.5), uCol, smoothstep(0.0, 0.6, vAge)) * mix(1.0, 0.5, vAge);
        gl_FragColor = vec4(c, a * vA * uVis * 0.8); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const flames = new THREE.Points(points(C.flames, (pos) => { const a = r() * 6.283, rr = (0.15 + r() * 0.07) * S; pos.push(Math.cos(a) * rr, -0.02 * S + r() * 0.03 * S, Math.sin(a) * rr); }), flameMat);
  flames.frustumCulled = false; flames.renderOrder = 3; group.add(flames);

  // swallowed: a cloud of sparks + embers around the head (world space, only in the last stage)
  const uEngulf = { value: 0 };
  const engulfMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uScale, uFlow: { value: new THREE.Vector3(...C.flowDir).normalize() }, uEngulf, uCol: { value: new THREE.Color(C.sparkColor) } },
    vertexShader: `attribute float aSeed; attribute vec3 aJit; uniform float uTime, uScale, uEngulf; uniform vec3 uFlow; varying float vA; varying float vS;
      void main(){
        float life = 1.2 + aSeed * 1.6, age = fract(uTime / life + aSeed * 3.7);
        vec3 p = aJit * (0.35 + 1.9 * aSeed);                       // a shell around the head
        p += uFlow * (age - 0.5) * 3.2 + vec3(0.0, (age - 0.3) * 1.2, 0.0);   // streaming past, rising
        p += vec3(sin(uTime * 3.0 + aSeed * 50.0), cos(uTime * 2.3 + aSeed * 31.0), sin(uTime * 2.7 + aSeed * 17.0)) * 0.08;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vS = step(0.72, fract(aSeed * 13.1));                        // some are steam puffs
        vA = uEngulf * sin(age * 3.1416) * (0.6 + 0.4 * sin(uTime * 25.0 + aSeed * 70.0));
        gl_PointSize = clamp(uScale * mix(0.02, 0.22, vS) / -mv.z, 2.0, mix(22.0, 480.0, vS));
      }`,
    fragmentShader: `uniform vec3 uCol; varying float vA; varying float vS;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, mix(0.1, 0.0, vS), d);
        vec3 c = mix(uCol * 1.2, vec3(1.0, 0.86, 0.72), vS);
        gl_FragColor = vec4(c, a * a * vA * mix(1.0, 0.12, vS)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const engulf = new THREE.Points(points(C.engulf, (pos) => pos.push(0, 0, 0)), engulfMat);
  { const j = engulf.geometry.attributes.aJit; for (let i = 0; i < j.count; i++) { const v = new THREE.Vector3(j.getX(i), j.getY(i), j.getZ(i)).normalize(); j.setXYZ(i, v.x, v.y, v.z); } }
  engulf.frustumCulled = false; engulf.renderOrder = 6; engulf.visible = false; scene.add(engulf);

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
  const flowW = new THREE.Vector3(...C.flowDir).normalize(), qInv = new THREE.Quaternion();
  function update(time, dt, viewH) {
    uScale.value = viewH;
    uBoil.value = boil;
    uSteam.value = 0.4 + 0.6 * boil;
    uGust.value = 0.5 + 0.5 * Math.sin(time * 0.9) * Math.sin(time * 0.31 + 1.0);
    group.visible = U.uPotVis.value > 0.001;
    group.updateMatrixWorld(true);
    group.getWorldQuaternion(qInv).invert();
    uUp.value.set(0, 1, 0).applyQuaternion(qInv);
    uFlow.value.copy(flowW).applyQuaternion(qInv);
    // the pot shivers a little when it boils hard
    mesh.position.y = Math.sin(time * 23.0) * 0.002 * boil * boil;
    surf.position.y = 0.262 * C.size + Math.sin(time * 9.0) * 0.003 * boil;
  }
  return {
    group, place, update, material: mat, engulf,
    setEngulf: (k, head) => { uEngulf.value = k; engulf.visible = k > 0.001; if (head) engulf.position.copy(head); },
    setFire: (k) => (uFire.value = k), setHeat: (k) => (uHeat.value = k),
    mouthLocal: () => new THREE.Vector3(0, 0.262 * C.size, 0),
    center: () => group.localToWorld(new THREE.Vector3(0, 0.15 * C.size, 0)),
    setBoil: (k) => (boil = k), getBoil: () => boil,
  };
}
