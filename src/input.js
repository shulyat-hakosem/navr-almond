// Input for three cases:
//   • Quest controllers – trigger (select) or grip (squeeze): grab letters by touching
//     them or by pointing the ray; trigger on empty space = "continue / I answered".
//   • Quest hand tracking – pinch = select; pinch near a letter grabs it directly,
//     pinch while pointing grabs it from afar. Joints are drawn as small ink dots.
//   • Desktop preview – drag letters with the mouse, drag empty space to look around,
//     click / Space = continue.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const NEAR_GRAB = 0.14;   // metres
const JOINTS = ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'];

export function createInput({ renderer, camera, scene, dom, targets, onGrab, onRelease, onActivate, onAdvance }) {
  const ray = new THREE.Raycaster();
  const tmpM = new THREE.Matrix4(), v = new THREE.Vector3(), v2 = new THREE.Vector3();
  const ink = CONFIG.palette.text;   // pointer / hand dots: light on the black void

  /** returns {kind:'letter'|'button', obj, dist} for the first thing the ray hits */
  function pick() {
    const { letters, buttons } = targets();
    const meshes = [...letters.filter((l) => l.visible && l.userData.grabbable).map((l) => l.userData.hit), ...buttons.filter((b) => b.visible && b.userData.enabled)];
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    const owner = hit.object.userData.owner;
    return owner ? { kind: 'letter', obj: owner, dist: hit.distance } : { kind: 'button', obj: hit.object, dist: hit.distance };
  }
  function nearestLetter(p) {
    let best = null, bd = NEAR_GRAB;
    for (const l of targets().letters) {
      if (!l.visible || !l.userData.grabbable || l.userData.held) continue;
      const d = l.getWorldPosition(v2).distanceTo(p); if (d < bd) { bd = d; best = l; }
    }
    return best;
  }
  function setHover(src, obj) {
    if (src.hover === obj) return;
    if (src.hover) src.hover.userData.hover = Math.max(0, (src.hover.userData.hover || 1) - 1);
    src.hover = obj; if (obj) obj.userData.hover = (obj.userData.hover || 0) + 1;
  }

  // ── XR controllers / hands ──
  const sources = [];
  const jointGeo = new THREE.SphereGeometry(1, 6, 4);
  const jointMat = new THREE.MeshBasicMaterial({ color: ink });
  for (let i = 0; i < 2; i++) {
    const ctrl = renderer.xr.getController(i);
    const grip = renderer.xr.getControllerGrip(i);
    const hand = renderer.xr.getHand(i);
    scene.add(ctrl, grip, hand);
    // pointer line (ink) + small grip shape — no models are downloaded
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.55 }));
    line.scale.z = 1.5; ctrl.add(line);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.1, 6), new THREE.MeshBasicMaterial({ color: 0x55514a }));
    body.rotation.x = Math.PI / 2; body.position.z = 0.03; grip.add(body);
    const joints = new THREE.InstancedMesh(jointGeo, jointMat, JOINTS.length); joints.frustumCulled = false; joints.visible = false;
    scene.add(joints);
    // for hands we carry grabbed letters on our own "pinch point" anchor (between thumb and index
    // tips), so it works even where the browser gives no grip pose for hands
    const pinchAnchor = new THREE.Object3D(); scene.add(pinchAnchor);
    const src = { i, ctrl, grip, hand, line, body, joints, pinchAnchor, isHand: false, held: null, hover: null, connected: false };
    sources.push(src);

    ctrl.addEventListener('connected', (e) => {
      src.connected = true; src.isHand = !!e.data.hand;
      body.visible = !src.isHand; joints.visible = src.isHand;
    });
    ctrl.addEventListener('disconnected', () => { src.connected = false; joints.visible = false; release(src); });

    const start = (allowAdvance) => () => {
      if (src.held) return;
      // 1) direct touch (controller grip or pinch point)
      const p = grabPoint(src, v);
      let l = nearestLetter(p);
      if (l) { grab(src, l, src.isHand ? src.pinchAnchor : grip); return; }
      // 2) ray
      tmpM.identity().extractRotation(ctrl.matrixWorld);
      ray.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
      ray.ray.direction.set(0, 0, -1).applyMatrix4(tmpM);
      const h = pick();
      if (h && h.kind === 'letter') grab(src, h.obj, ctrl);
      else if (h && h.kind === 'button') onActivate(h.obj);
      else if (allowAdvance) onAdvance();
    };
    ctrl.addEventListener('selectstart', start(true));
    ctrl.addEventListener('squeezestart', start(false));
    ctrl.addEventListener('selectend', () => release(src));
    ctrl.addEventListener('squeezeend', () => release(src));
  }

  function grabPoint(src, out) {
    if (src.isHand) {
      const a = src.hand.joints['index-finger-tip'], b = src.hand.joints['thumb-tip'];
      if (a && b) return a.getWorldPosition(out).add(b.getWorldPosition(v2)).multiplyScalar(0.5);
    }
    return src.grip.getWorldPosition(out);
  }
  function grab(src, letter, parent) {
    if (letter.userData.held) return;
    letter.userData.held = src; src.held = letter;
    parent.attach(letter); onGrab(letter);
    const gp = renderer.xr.getSession?.()?.inputSources?.[src.i]?.gamepad;
    gp?.hapticActuators?.[0]?.pulse?.(0.3, 30);
  }
  function release(src) {
    const l = src.held; if (!l) return;
    src.held = null; l.userData.held = null; scene.attach(l); onRelease(l);
  }

  // ── Desktop mouse ──
  const mouse = new THREE.Vector2();
  let drag = null, look = null;
  const plane = new THREE.Plane(), hitP = new THREE.Vector3(), offset = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const setMouse = (e) => {
    const r = dom.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
  };
  const desk = { held: null, hover: null };
  dom.addEventListener('pointerdown', (e) => {
    if (renderer.xr.isPresenting) return;
    setMouse(e); dom.setPointerCapture(e.pointerId);
    const h = pick();
    if (h && h.kind === 'letter') {
      const l = h.obj; camera.getWorldDirection(v);
      plane.setFromNormalAndCoplanarPoint(v.negate(), l.position);
      ray.ray.intersectPlane(plane, hitP); offset.copy(l.position).sub(hitP);
      drag = l; l.userData.held = desk; desk.held = l; onGrab(l);
    } else if (h && h.kind === 'button') onActivate(h.obj);
    else look = { x: e.clientX, y: e.clientY, moved: 0 };
  });
  dom.addEventListener('pointermove', (e) => {
    if (renderer.xr.isPresenting) return;
    setMouse(e);
    if (drag) { if (ray.ray.intersectPlane(plane, hitP)) drag.position.copy(hitP).add(offset); }
    else if (look) {
      const dx = e.clientX - look.x, dy = e.clientY - look.y; look.x = e.clientX; look.y = e.clientY;
      look.moved += Math.abs(dx) + Math.abs(dy);
      euler.setFromQuaternion(camera.quaternion);
      euler.y += dx * 0.004; euler.x = THREE.MathUtils.clamp(euler.x + dy * 0.004, -1.2, 1.2);
      camera.quaternion.setFromEuler(euler);
    } else { const h = pick(); setHover(desk, h ? h.obj : null); }
  });
  dom.addEventListener('pointerup', () => {
    if (drag) { const l = drag; drag = null; desk.held = null; l.userData.held = null; onRelease(l); }
    if (look && look.moved < 6) onAdvance();
    look = null;
  });
  window.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); onAdvance(); } });

  /** per-frame: hover highlight along rays, ray length, hand joint dots */
  function update() {
    if (!renderer.xr.isPresenting) return;
    for (const s of sources) {
      if (!s.connected) { s.line.visible = false; continue; }
      s.line.visible = !s.held;
      tmpM.identity().extractRotation(s.ctrl.matrixWorld);
      ray.ray.origin.setFromMatrixPosition(s.ctrl.matrixWorld);
      ray.ray.direction.set(0, 0, -1).applyMatrix4(tmpM);
      const h = s.held ? null : pick();
      const near = s.held ? null : nearestLetter(grabPoint(s, v));
      setHover(s, near || (h ? h.obj : null));
      s.line.scale.z = h ? h.dist : 1.5;
      if (s.isHand) {
        grabPoint(s, s.pinchAnchor.position);
        const w = s.hand.joints['wrist']; if (w) w.getWorldQuaternion(s.pinchAnchor.quaternion);
        s.pinchAnchor.updateMatrixWorld();
        JOINTS.forEach((n, k) => {
          const j = s.hand.joints[n];
          if (j) { tmpM.copy(j.matrixWorld); tmpM.scale(v.setScalar((j.jointRadius || 0.008) * 0.9)); s.joints.setMatrixAt(k, tmpM); }
        });
        s.joints.instanceMatrix.needsUpdate = true;
      }
    }
  }
  /** touch points for the branch: index tip (hands) or grip (controllers); palms: where a petal may rest */
  const tp = [new THREE.Vector3(), new THREE.Vector3()], pp = [new THREE.Vector3(), new THREE.Vector3()];
  function touchPoints() {
    const touch = [], palms = [];
    if (!renderer.xr.isPresenting) return { touch, palms };
    sources.forEach((s, k) => {
      if (!s.connected) { touch.push(null); palms.push(null); return; }
      if (s.isHand) {
        const tip = s.hand.joints['index-finger-tip'], palm = s.hand.joints['middle-finger-metacarpal'];
        touch.push(tip ? tip.getWorldPosition(tp[k]) : null); palms.push(palm ? palm.getWorldPosition(pp[k]) : null);
      } else { touch.push(s.grip.getWorldPosition(tp[k])); palms.push(pp[k].copy(tp[k])); }
    });
    return { touch, palms };
  }
  /** desktop: the mouse ray, only while the mouse moves without dragging (brushing the branch) */
  let lastMove = -1;
  dom.addEventListener('pointermove', () => (lastMove = performance.now()));
  const mouseRay = () => (!renderer.xr.isPresenting && !drag && !look && performance.now() - lastMove < 120 ? ray.ray : null);
  return { update, sources, touchPoints, mouseRay };
}
