// v7 · inside the pot: a huge iron vessel around the learner. Firelight from below; on the iron walls
// Babylon's army passes as shadow-play (horses, chariots, spearmen — assets/army.png, alpha silhouettes).
// The walls never move; only the shadows slowly circle (comfort: no motion toward the viewer).
import * as THREE from 'three';
import { U } from './look.js';

export function buildInside(scene) {
  const R = 5.5, H = 9;
  let loaded = false;
  const tex = new THREE.TextureLoader().load('assets/army.png', () => (loaded = true));
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping; tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  const uIn = { value: 0 }, uArmy = { value: 0 }, uScroll = { value: 0 }, uHeadY = { value: 1.6 };
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uIn, uArmy, uScroll, uHeadY, uTex: { value: tex } },
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uIn, uArmy, uScroll, uHeadY; uniform sampler2D uTex; varying vec3 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + 1.0), f.x), f.y); }
      void main(){
        float a = atan(vP.x, -vP.z);                 // 0 = start direction, + = to the right
        float u = a / 6.2831853 + 0.5, y = vP.y;     // y relative to the head
        // hammered iron: dents + streaks
        float dent = n(vec2(u * 90.0, y * 9.0)) * 0.6 + n(vec2(u * 260.0, y * 26.0)) * 0.4;
        vec3 iron = vec3(0.018, 0.014, 0.012) * (0.6 + 0.8 * dent);
        // firelight from below (the wall glows warmer toward the bottom), flickering
        float fl = 0.8 + 0.12 * sin(uTime * 7.3) + 0.08 * sin(uTime * 13.1 + 1.3);
        float band = exp(-pow((y + 0.1) / 1.5, 2.0)) * (0.75 + 0.25 * n(vec2(u * 14.0 + uTime * 0.2, uTime * 0.4)));                     // the lit "screen" at eye height
        float low = smoothstep(2.5, -3.0, y);
        vec3 light = vec3(1.0, 0.45, 0.16) * (0.55 * band + 0.6 * low) * fl;
        vec3 c = iron + iron * light * 9.0 + vec3(0.07, 0.015, 0.004) * low * low * fl;
        // shadow-play: the army, two columns circling the walls, figures ~2.6 m tall
        float bh = 2.6, by = -1.55;                                   // band bottom (rel. head) and height
        float v = (y - by) / bh;
        if (v > 0.0 && v < 1.0) {
          float s = texture2D(uTex, vec2(u * ${(2 * Math.PI * R / (2.6 * 5.414)).toFixed(4)} - uScroll, v)).a;   // ≈ undistorted aspect
          c *= 1.0 - 0.93 * s * uArmy;
        }
        // the far mouth above: a faint disc of light (where we fell in)
        float top = smoothstep(0.75, 1.0, vP.y / ${(H / 2).toFixed(2)});
        c += vec3(0.5, 0.35, 0.25) * top * 0.03;
        // fade to black at the bottom (the boiling depth)
        c *= smoothstep(-4.5, -2.6, y);
        gl_FragColor = vec4(c * uIn, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const group = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.92, H, 96, 1, true), mat);
  wall.renderOrder = 8; group.add(wall);
  // embers / steam drifting up in the firelight (sparse)
  const N = 220, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = Math.random() * 6.283, r = 1.2 + Math.random() * (R - 1.6); pos.set([Math.cos(a) * r, -4 + Math.random() * 8, Math.sin(a) * r], i * 3); seed[i] = Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const em = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uIn },
    vertexShader: `attribute float aSeed; uniform float uTime; varying float vA;
      void main(){ vec3 p = position; float t = fract(uTime * (0.03 + 0.04 * aSeed) + aSeed);
        p.y = -4.0 + t * 8.0; p.x += sin(uTime * 0.5 + aSeed * 30.0) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vA = sin(t * 3.14159) * (0.4 + 0.6 * step(0.8, aSeed)); gl_PointSize = clamp(900.0 * 0.025 / -mv.z, 1.5, 9.0); }`,
    fragmentShader: `uniform float uIn; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.55, 0.22), smoothstep(0.5, 0.0, d) * vA * uIn * 0.8); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  em.frustumCulled = false; em.renderOrder = 8; group.add(em);
  group.visible = false; scene.add(group);
  let speed = 0;
  return {
    group, loaded: () => loaded,
    /** k 0..1 = how present the inside is; army 0..1 = the shadows on the walls */
    set(k, army) { uIn.value = k; uArmy.value = army; group.visible = k > 0.001; },
    setSpeed: (s) => (speed = s),
    /** centre the vessel on the learner once (it does not follow the head afterwards) */
    center(head) { group.position.copy(head); uHeadY.value = head.y; },
    update(dt) { uScroll.value += dt * speed; },
    rep: 2 * Math.PI * R / (2.6 * 5.414),
  };
}
