// Hebrew text in 3D, drawn with the browser's own text engine onto canvas textures.
// This gives correct RTL order, final letters and niqqud placement (which most
// SDF text libraries do not handle well for Hebrew).
import * as THREE from 'three';
import { CONFIG } from '../config.js';

export const FONT = 'NAVRFrank';
const INK = '#' + CONFIG.palette.ink.toString(16).padStart(6, '0');
const TEXT = '#' + CONFIG.palette.text.toString(16).padStart(6, '0');   // light text on the black void

export async function loadFont() {
  const f = new FontFace(FONT, 'url(assets/fonts/FrankRuhlLibre.ttf)', { weight: '300 900' });
  await f.load(); document.fonts.add(f);
}

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

/**
 * A flat text panel in world space.
 * @param {object} o  width/height in metres, px = canvas width, size = font px, weight, bg (css color or null)
 */
export function makeTextPanel({ width = 1, height = 0.2, px = 1024, size = 64, weight = 400, color = TEXT, bg = null, overlay = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = px; canvas.height = Math.round(px * height / width);
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
  if (overlay) { mat.depthTest = false; }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.renderOrder = overlay ? 10 : 2;   // text draws after the (opaque) scene
  let current = null;
  mesh.userData.setText = (text) => {
    if (text === current) return; current = text;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!text) { tex.needsUpdate = true; return; }
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = wrap(ctx, text, canvas.width * 0.9);
    const lh = size * 1.45;
    if (bg) {
      const bh = lines.length * lh + size * 0.6;
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.roundRect(canvas.width * 0.02, (canvas.height - bh) / 2, canvas.width * 0.96, bh, size * 0.4); ctx.fill();
    }
    ctx.fillStyle = color;
    lines.forEach((l, i) => ctx.fillText(l, canvas.width / 2, canvas.height / 2 + (i - (lines.length - 1) / 2) * lh));
    tex.needsUpdate = true;
  };
  mesh.userData.text = () => current;
  return mesh;
}

/**
 * A single big Hebrew letter as a "printed block": ink face + offset shadow face,
 * plus an invisible, slightly larger hit plane for grabbing.
 */
export function makeLetter(ch, size = 0.3) {
  const group = new THREE.Group();
  // ink letter with a hand-printed, crayon-like texture (rough edge, paper showing through)
  const mk = (color, rough) => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.font = `700 210px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    x.fillStyle = color;
    if (rough) { x.globalAlpha = 0.35; for (let k = 0; k < 5; k++) x.fillText(ch, 128 + (Math.random() - 0.5) * 4, 140 + (Math.random() - 0.5) * 4); x.globalAlpha = 1; }
    x.fillText(ch, 128, 140);
    if (rough) {                      // paper grain eats into the ink
      const img = x.getImageData(0, 0, 256, 256), d = img.data;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) {
        const px = (i / 4) % 256, py = (i / 4 / 256) | 0;
        const n = Math.sin(px * 0.9 + Math.sin(py * 0.23) * 3) * Math.sin(py * 1.7 + px * 0.05) * 0.5 + 0.5;
        d[i + 3] *= 0.72 + 0.28 * (Math.random() * 0.6 + n * 0.4);
      }
      x.putImageData(img, 0, 0);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide });
  };
  const geo = new THREE.PlaneGeometry(size, size);
  const back = new THREE.Mesh(geo, mk('#5a4636', false)); back.position.set(0.012, -0.012, -0.018);
  const front = new THREE.Mesh(geo, mk(TEXT, true));
  // warm glow behind the letter (word formation)
  const gc = document.createElement('canvas'); gc.width = gc.height = 128; const gx = gc.getContext('2d');
  const gr = gx.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,200,170,0.9)'); gr.addColorStop(0.4, 'rgba(255,170,150,0.35)'); gr.addColorStop(1, 'rgba(255,160,140,0)');
  gx.fillStyle = gr; gx.fillRect(0, 0, 128, 128);
  const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace;
  const glowMat = new THREE.MeshBasicMaterial({ map: gt, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  glowMat.userData.skipFade = true;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), glowMat); glow.position.z = -0.03; glow.renderOrder = 1;
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.05, size * 1.05), new THREE.MeshBasicMaterial({ visible: false }));
  group.add(glow, back, front, hit);
  group.userData = { ch, hit, front, back, glow, slot: -1, held: null, home: new THREE.Vector3() };
  hit.userData.owner = group;
  return group;
}
