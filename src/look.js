// The hand-made look, injected into three.js materials:
//   • paper grain + gouache/crayon streaks  (procedural, in object/world space → stable, no swimming)
//   • ink hatching in the shadows           (anti-aliased with fwidth and faded when too fine → no VR shimmer)
//   • haze / atmospheric depth, warm near the window, cool in the far corners
//   • walls dissolving into haze toward the ceiling
//   • blossom color bleeding into the surroundings, and the exit's return to neutral
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const L = CONFIG.look;

/** Uniforms shared by every "look" material (update once per frame). */
export const U = {
  uTime: { value: 0 },
  uWarm: { value: 0 },                       // 0 pre-dawn → 1 first warm light
  uBloom: { value: 0 },                      // blossom amount (color bleed)
  uBloomPos: { value: new THREE.Vector3() },
  uBloomR: { value: L.bleedRadius },
  uBleed: { value: new THREE.Color(L.bleedColor) },
  uBleedAmt: { value: L.bleed },
  uFog: { value: L.fogDensity },
  uHazeCool: { value: new THREE.Color(L.hazeCool) },
  uHazeWarm: { value: new THREE.Color(L.hazeWarm) },
  uGrain: { value: L.grain },
  uCrayon: { value: L.crayon },
  uHatch: { value: L.hatch },
  uHatchFreq: { value: L.hatchFreq },
  uHatchStart: { value: L.hatchStart },
  uHatchCross: { value: L.hatchCross },
  uDissolve: { value: L.dissolve },
  uRoomH: { value: CONFIG.room.height },
  uRoomW: { value: CONFIG.room.width },
  uRoomD: { value: CONFIG.room.depth },
  uNeutral: { value: 0 },
  uSunDir: { value: new THREE.Vector3(...L.sun.dir).normalize() },
  uRimColor: { value: new THREE.Color(L.rimColor) },
  uRimAmt: { value: L.rim },
  uSpeck: { value: L.speck },
  uTransl: { value: L.translucency },
  uSunColor: { value: new THREE.Color(L.translucencyTint) },
  uPetalMax: { value: L.petalMax },
  uFloorFade: { value: L.floorFade },
  uShadowTint: { value: new THREE.Color(L.shadowTint) },
  uShadowAmt: { value: L.shadowAmt },
  uInk: { value: new THREE.Color(CONFIG.palette.ink) },
  uReveal: { value: 1 },                     // the branch drawing itself: 0 nothing → 1 fully drawn
  uBranchVis: { value: 1 },                  // branch sinks into darkness (1 → 0)
  uPotVis: { value: 0 },                     // the pot is found by the light (0 → 1)
};

const NOISE = /* glsl */`
float lk_hash(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float lk_noise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(lk_hash(i), lk_hash(i + vec3(1,0,0)), f.x), mix(lk_hash(i + vec3(0,1,0)), lk_hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(lk_hash(i + vec3(0,0,1)), lk_hash(i + vec3(1,0,1)), f.x), mix(lk_hash(i + vec3(0,1,1)), lk_hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
// one anti-aliased hatch line family; fades out when lines get finer than ~3 px
float lk_lines(float u, float thick){
  float aa = fwidth(u);
  float d = abs(fract(u + 0.5) - 0.5);
  return (1.0 - smoothstep(thick, thick + aa * 1.5, d)) * clamp(1.4 - aa * 3.0, 0.0, 1.0);
}`;

/**
 * Inject the look into a material.
 * o.space  'local' (texture sticks to the object: room, branch) | 'world'
 * o.hatch  ink hatching on, o.wall  dissolve into haze, o.floor  floorboards, o.lit  material has lighting
 */
export function applyLook(mat, o = {}) {
  const opt = { space: 'local', hatch: false, wall: false, floor: false, rim: false, rimEdge: [0.32, 0.5], petal: false, reveal: false, vis: null, lit: true, normals: true, grain: 1, ...o };
  const VIS = opt.vis === 'branch' ? 'uBranchVis' : opt.vis === 'pot' ? 'uPotVis' : null;
  const hi = L.quality !== 'low';
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vLkW; varying vec3 vLkP; varying vec3 vLkN; varying vec3 vLkNW;${opt.reveal ? ' attribute float aDraw; varying float vDraw;' : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 lkw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          lkw = instanceMatrix * lkw;
        #endif
        lkw = modelMatrix * lkw;
        vLkW = lkw.xyz;
        vLkP = ${opt.space === 'world' ? 'lkw.xyz' : 'transformed'};
        vLkN = ${opt.normals ? 'normal' : 'vec3(0.0, 1.0, 0.0)'};
        vLkNW = normalize(mat3(modelMatrix) * vLkN);${opt.reveal ? ' vDraw = aDraw;' : ''}`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLkW; varying vec3 vLkP; varying vec3 vLkN; varying vec3 vLkNW;
        uniform float uRoomW, uRoomD, uTime, uWarm, uBloom, uBloomR, uBleedAmt, uFog, uGrain, uCrayon, uHatch, uHatchFreq, uHatchStart, uHatchCross, uDissolve, uRoomH, uNeutral;
        ${opt.reveal ? 'varying float vDraw; uniform float uReveal;' : ''} ${VIS ? 'uniform float ' + VIS + ';' : ''}
        uniform float uShadowAmt, uRimAmt, uSpeck, uFloorFade, uTransl, uPetalMax; uniform vec3 uSunDir, uRimColor, uSunColor; uniform vec3 uShadowTint, uBloomPos, uBleed, uHazeCool, uHazeWarm, uInk;
        ${NOISE}`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 P = vLkP;
          vec3 col = outgoingLight;
          ${opt.reveal ? `
          // the branch draws itself: a moving front, first as light ink strokes, then filled with color
          float rv = uReveal * 1.2 - vDraw - 0.04 + (lk_noise(P * 70.0) - 0.5) * 0.05;
          if (rv < 0.0) discard;
          float skL = lk_lines(dot(P, vec3(0.62, 0.78, 0.1)) * 110.0, 0.12);
          float fillK = smoothstep(0.03, 0.3, rv);
          if (fillK < 0.35 && skL < 0.5 && rv > 0.012) discard;          // only the strokes exist at the front
          float sketchMix = 1.0 - fillK;` : ''}
          float base = max(dot(diffuseColor.rgb, vec3(0.3333)), 0.02);
          float lit = dot(col, vec3(0.3333)) / base;          // ~how much light this point receives
          float ao = 1.0;
          ${opt.wall || opt.floor ? `
          {
            float hw = uRoomW * 0.5, hd = uRoomD * 0.5;
            float ex = hw - abs(vLkW.x), ez = hd - abs(vLkW.z);
            float eCorner = ${opt.floor ? 'min(ex, ez)' : 'max(min(ex, ez), 0.0)'};
            ${opt.wall ? 'float eWall = min(eCorner + max(ex, ez) * 0.0, 9.0); eCorner = (abs(abs(vLkW.x) - hw) < 0.08) ? ez : ex;' : ''}
            float eV = ${opt.wall ? 'min(vLkW.y, uRoomH - vLkW.y)' : '9.0'};
            float e = min(eCorner, eV * 1.3);
            ao = mix(0.55, 1.0, 1.0 - exp(-e / 0.55));
          }` : ''}
          col *= mix(1.0, ao, 0.65);
          // painterly temperature: warm where the light falls, cool blue-violet in the shade
          float shade = 1.0 - smoothstep(0.45, 1.45, lit * ao);
          col = mix(col, col * uShadowTint, shade * uShadowAmt);
          // paper grain: soft blotches + fine fibre (the fine one fades with distance → no shimmer)
          float g1 = lk_noise(P * 23.0);
          float g = (g1 - 0.5) * 0.35;
          ${hi ? `float fw = length(fwidth(P)) * 90.0; g += (lk_noise(P * 90.0 + 7.0) - 0.5) * 0.45 * clamp(1.0 - fw, 0.0, 1.0);` : ''}
          col *= 1.0 + g * uGrain * ${opt.grain.toFixed(2)};
          ${hi ? `{ float fws = length(fwidth(P)) * 140.0;
            float sp = smoothstep(0.78, 0.84, lk_noise(P * 140.0 + 3.0)) * clamp(1.0 - fws, 0.0, 1.0);
            col *= 1.0 - sp * uSpeck; }` : ''}
          // gouache / crayon: long vertical-ish strokes
          float cr = lk_noise(vec3(P.x * 7.0 + P.z * 3.0, P.y * 48.0, P.z * 7.0));
          col *= 1.0 + (cr - 0.5) * uCrayon * 2.0;
          ${opt.floor ? `
          // floorboards: seams, per-board tone, grain along the boards, a worn path around the user
          float bw = 0.45; float bx = (P.x + 2.5) / bw; float id = floor(bx);
          float seam = lk_lines(bx, 0.012);
          float zz = (P.z + lk_hash(vec3(id, 3.0, 1.0)) * 3.0) / 1.7;
          seam = max(seam, lk_lines(zz, 0.003) * 0.5);
          float tone = 0.93 + lk_hash(vec3(id, 1.0, 7.0)) * 0.12;
          float wood = lk_noise(vec3(P.x * 55.0, P.z * 2.2, id * 3.1));
          float worn = smoothstep(1.7, 0.2, length(P.xz));
          col *= tone * (1.0 + (wood - 0.5) * 0.14 * (1.0 - worn * 0.6)) * (1.0 + worn * 0.07);
          col = mix(col, col * 0.62, seam * 0.6);
          col *= smoothstep(uFloorFade, uFloorFade * 0.25, length(vLkW.xz - vec2(-0.3, -0.8)));` : ''}
          ${opt.hatch ? `
          // ink hatching in the shadows (projected on the dominant plane, wobbling like a hand-drawn line)
          vec3 an = abs(normalize(vLkN));
          vec2 hp = (an.x > an.y && an.x > an.z) ? P.zy : ((an.y > an.z) ? P.xz : P.xy);
          float wob = ${hi ? 'lk_noise(P * 4.0) * 0.9' : '0.0'};
          // strokes: lines broken into short hand-drawn dashes of varying weight
          float u1 = dot(hp, vec2(0.7071, 0.7071)) * uHatchFreq + wob;
          float v1 = dot(hp, vec2(-0.7071, 0.7071)) * 2.2;
          float s1 = smoothstep(0.5, 0.66, lk_noise(vec3(floor(u1 + 0.5) * 1.7, v1 * 2.8, 0.0)));
          float h1 = lk_lines(u1, 0.05 + 0.07 * lk_noise(vec3(u1 * 0.3, v1 * 2.0, 5.0))) * s1;
          float u2 = dot(hp, vec2(0.8, -0.6)) * uHatchFreq * 1.2 + wob * 1.3;
          float v2 = dot(hp, vec2(0.6, 0.8)) * 2.6;
          float s2 = smoothstep(0.52, 0.68, lk_noise(vec3(floor(u2 + 0.5) * 2.3, v2 * 2.8, 9.0)));
          float h2 = lk_lines(u2, 0.05 + 0.05 * lk_noise(vec3(u2 * 0.3, v2 * 2.0, 2.0))) * s2;
          float sh = lit * ao + (g1 - 0.5) * 0.2;
          float k1 = smoothstep(uHatchStart, uHatchStart - 0.12, sh);
          float k2 = smoothstep(uHatchCross, uHatchCross - 0.12, sh);
          float hatch = max(h1 * k1, h2 * k2) * uHatch;
          // scratchboard ink: darkens mid-tones, scratches faint warm lines into deep black
          col = mix(col, col * 0.25 + uRimColor * 0.075, clamp(hatch, 0.0, 1.0));` : ''}
          ${opt.rim ? `
          // the invisible sun's rim: a crisp bright edge on the side facing the light
          vec3 rN = normalize(vLkNW); if (!gl_FrontFacing) rN = -rN;
          vec3 rV = normalize(cameraPosition - vLkW);
          float fres = 1.0 - abs(dot(rN, rV));
          float toSun = clamp(dot(rN, uSunDir) * 1.1 + 0.4, 0.0, 1.0);
          float back = 0.6 + 0.8 * clamp(dot(-rV, uSunDir), 0.0, 1.0);   // sun behind the subject → brighter rims
          col += uRimColor * smoothstep(${opt.rimEdge[0].toFixed(2)}, ${opt.rimEdge[1].toFixed(2)}, fres + (g1 - 0.5) * 0.12) * toSun * back * uRimAmt;` : ''}
          ${opt.petal ? `
          // thin petals: light passes through (backlit glow), on either side of the petal
          float tr = abs(dot(normalize(vLkNW), uSunDir));
          col += diffuseColor.rgb * uSunColor * (0.25 + 0.75 * tr) * uTransl * (0.3 + 0.7 * uWarm);
          // soft shoulder, hue-preserving: whites roll off to warm cream instead of clipping
          float pk = max(col.r, max(col.g, col.b)), kn = uPetalMax * 0.78;
          if (pk > kn) col *= (kn + (uPetalMax - kn) * (1.0 - exp(-(pk - kn) * 2.5 / (uPetalMax - kn)))) / pk;` : ''}
          // blossom color bleeding into the room (warm, soft, grows with the blossom)
          float bd = length(vLkW - uBloomPos);
          float bl = uBloom * uBleedAmt * exp(-(bd * bd) / (uBloomR * uBloomR));
          col = mix(col, col * uBleed * 1.25 + uBleed * 0.06, bl);
          // haze: warm toward the window (+x), cool in depth / far corners
          float d = length(vLkW - cameraPosition);
          float warmF = clamp((vLkW.x + 0.5) / 3.0, 0.0, 1.0) * (0.35 + 0.65 * uWarm);
          vec3 haze = mix(uHazeCool, uHazeWarm, warmF);
          float f = 1.0 - exp(-d * uFog);
          ${opt.wall ? `
          // walls dissolve into haze toward the ceiling, in an irregular, painted edge
          float hn = lk_noise(P * vec3(2.5, 1.2, 2.5) + 3.0);
          float dz = smoothstep(0.7, 1.05, vLkW.y / uRoomH + (hn - 0.5) * 0.45) * uDissolve;
          f = max(f, dz);` : ''}
          col = mix(col, haze, f);
          // the exit: palette returns toward neutral
          col = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))), uNeutral);
          ${opt.reveal ? 'col = mix(col, uRimColor * (0.55 + 0.6 * skL), sketchMix); col += uRimColor * smoothstep(0.03, 0.0, rv) * 0.9;   // the glowing pen tip' : ''}
          ${VIS ? 'col *= ' + VIS + ';                     // sink into / rise out of the dark' : ''}
          outgoingLight = col;
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => JSON.stringify(opt) + L.quality;
  return mat;
}
