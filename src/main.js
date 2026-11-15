// NA.V.R. · lesson 1 · מקל השקד — main: renderer, session, lesson timeline.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildWorld } from './world.js';
import { loadFont, makeTextPanel, makeLetter, makeTitleCard } from './text.js';
import { Sound } from './audio.js';
import { createInput } from './input.js';
import { buildPot } from './pot.js';
import { createListener } from './listen.js';

const url = new URLSearchParams(location.search);
const FAST = url.has('fast') ? 0.1 : 1;                       // ?fast=1  → everything 10× faster (testing)
const START = +(url.get('stage') ?? CONFIG.debug.startStage);  // ?stage=3 → begin at stage 3
const T = Object.fromEntries(Object.entries(CONFIG.timing).map(([k, v]) => [k, v * FAST]));
const P = CONFIG.palette;

// ── renderer / scene ──────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);
if (CONFIG.look.sun.shadowMap > 0) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; }
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.look.showRoom ? CONFIG.look.hazeCool : CONFIG.look.voidColor);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 50);
camera.position.set(0, 1.6, 0);
camera.rotation.set(-0.14, 0.2, 0, 'YXZ');     // desktop: glance a little toward the branch
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const sound = new Sound();
const listener = createListener();
const state = { stage: -1, mode: 'desktop', words: new Set(), started: false };
window.NAVR = { state, CONFIG };                // small debug handle (console / tests)

// ── tiny tween + wait helpers (all time in seconds, scaled by FAST) ───────────
const tweens = new Set();
let clockT = 0;
function tween(dur, fn, ease = (x) => x * x * (3 - 2 * x)) {
  return new Promise((res) => { const tw = { t0: clockT, dur: Math.max(dur, 1e-3), fn, ease, res }; tweens.add(tw); fn(0); });
}
let advanceWaiters = [];
function advance() { const w = advanceWaiters; advanceWaiters = []; w.forEach((f) => f()); }
/** wait N seconds; if skippable, trigger / pinch / Space / click on empty space ends it early */
function wait(sec, skippable = false) {
  return new Promise((res) => {
    let done = false; const fin = () => { if (!done) { done = true; res(); } };
    const tw = { t0: clockT, dur: sec, fn() {}, ease: (x) => x, res: fin }; tweens.add(tw);
    if (skippable) advanceWaiters.push(() => { tweens.delete(tw); fin(); });
  });
}

// ── subtitles + voice ─────────────────────────────────────────────────────────
let subs, speaking = false;
async function speak(id, { subtitles = CONFIG.subtitles } = {}) {
  const line = CONFIG.lines[id];
  speaking = true; state.spoken = (state.spoken || []).concat(id);
  if (subtitles) { subs.userData.setText(line.text); fade(subs, 1, 0.6); }
  const v = FAST < 1 ? null : sound.playVoice(id);
  if (v) await v.ended; else await wait(Math.max(1.2, line.text.length * 0.085) * (FAST < 1 ? 0.15 : 1));
  speaking = false;
  await wait(0.5 * FAST);
  if (subtitles) fade(subs, 0, 1.2);
}
function fade(obj, to, sec) {
  const mats = []; obj.traverse((o) => o.material && !o.material.userData.skipFade && mats.push(o.material));
  const from = mats.map((m) => m.opacity);
  return tween(sec * FAST, (k) => mats.forEach((m, i) => (m.opacity = from[i] + (to - from[i]) * k)));
}

// ── world ─────────────────────────────────────────────────────────────────────
let world, flowers, pot, title, veil, listenRing, potVerse, lessonFrame, anchorW = new THREE.Vector3(), letters = [], slots, slotLines, wordLabel, verse, cont, endCard;
const SLOT_GAP = 0.42;
let layoutY = 1.6;

function buildLessonObjects() {
  world = buildWorld(scene);
  flowers = world.branch.flowers;
  pot = buildPot(scene);
  // nothing exists yet: darkness. The branch is drawn later; the pot is found later.
  world.setReveal(0); flowers.setProgress(0); world.setLight(1); world.setDust(0);
  potVerse = makeTextPanel({ width: 1.6, height: 0.26, px: 1600, size: 104, weight: 500 }); scene.add(potVerse); potVerse.visible = false;

  // subtitles: a panel that lazily follows the head, low in the field of view
  subs = makeTextPanel({ width: 1.3, height: 0.24, px: 1300, size: 58, overlay: true, bg: 'rgba(12,11,10,0.72)' });
  scene.add(subs);
  // listening guide: a small breathing ring under the subtitles while the learner may answer aloud
  listenRing = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.024, 40), new THREE.MeshBasicMaterial({ color: P.text, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
  listenRing.material.userData.skipFade = true; listenRing.renderOrder = 11; listenRing.position.set(0, -0.15, 0); subs.add(listenRing);

  // v6 · title cards (prophet · chapter · verses, then the verse) in darkness
  title = makeTitleCard(); title.group.visible = false; scene.add(title.group);
  // v6 · the veil: a head-locked black sphere (swallowed by the pot → total darkness, also in passthrough)
  veil = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
  veil.renderOrder = 9; veil.visible = false; scene.add(veil);

  // `frame` holds the lesson objects; it is turned to wherever the user looks when stage 3 starts
  lessonFrame = new THREE.Group(); scene.add(lessonFrame);

  // the three letters
  letters = CONFIG.letters.map((ch) => { const l = makeLetter(ch, 0.3); l.visible = false; scene.add(l); return l; });

  // the three slots (drawn with thin ink rectangles) – slot 0 is the RIGHTMOST (Hebrew reading order)
  slots = new THREE.Group(); lessonFrame.add(slots); slots.visible = false;
  const pts = [];
  for (let i = 0; i < 3; i++) {
    const x = SLOT_GAP * (1 - i), s = 0.19;
    const c = [[x - s, -s], [x + s, -s], [x + s, s], [x - s, s]];
    for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4]; pts.push(new THREE.Vector3(a[0], a[1], 0), new THREE.Vector3(b[0], b[1], 0)); }
    const u = 0.15; pts.push(new THREE.Vector3(x - u, -s - 0.03, 0), new THREE.Vector3(x + u, -s - 0.03, 0)); // underline
  }
  slotLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: P.text, transparent: true, opacity: 0 }));
  slots.add(slotLines);
  slots.userData.filled = [null, null, null];

  wordLabel = makeTextPanel({ width: 1.2, height: 0.2, px: 1200, size: 92, weight: 500 }); slots.add(wordLabel);
  wordLabel.position.set(0, -0.36, 0.01);

  verse = makeTextPanel({ width: 1.8, height: 0.3, px: 1800, size: 120, weight: 500 }); lessonFrame.add(verse); verse.visible = false;

  // the subtle "continue" mark: a small ink ring + word
  cont = new THREE.Group(); cont.visible = false; lessonFrame.add(cont);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.045, 0.055, 32), new THREE.MeshBasicMaterial({ color: P.text, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  const hitDisc = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), new THREE.MeshBasicMaterial({ visible: false }));
  hitDisc.userData.enabled = true; hitDisc.userData.isContinue = true;
  const contTxt = makeTextPanel({ width: 0.4, height: 0.1, px: 400, size: 46 }); contTxt.userData.setText('המשך'); contTxt.position.y = -0.11;
  cont.add(ring, hitDisc, contTxt); cont.userData.hit = hitDisc; cont.userData.ring = ring;

  endCard = makeTextPanel({ width: 1.4, height: 0.3, px: 1400, size: 70, overlay: true }); endCard.userData.setText('NA.V.R.\u200E · שיעור ראשון · מקל השקד'); scene.add(endCard); endCard.visible = false;
}

/** place lesson objects in front of where the user is and looks (seated or standing) */
function layout() {
  const p = camera.getWorldPosition(new THREE.Vector3()), d = camera.getWorldDirection(new THREE.Vector3());
  layoutY = THREE.MathUtils.clamp(p.y, 1.0, 1.9);
  lessonFrame.position.set(p.x, 0, p.z);
  const B = CONFIG.branch;
  const yawToBranch = Math.atan2(-(B.x - p.x), -(B.z - p.z));
  lessonFrame.rotation.set(0, yawToBranch - THREE.MathUtils.degToRad(CONFIG.slotsOffsetDeg), 0);
  slots.position.set(0, layoutY - CONFIG.slotsBelowEye, -1.1);
  cont.position.set(0, layoutY - CONFIG.slotsBelowEye - 0.52, -1.08);
  verse.position.set(0, layoutY + 0.6, -1.5);
  lessonFrame.updateMatrixWorld(true);
  const homes = [[-0.3, -0.2, -0.95], [0.5, -0.28, -0.9], [0.1, -0.14, -1.0]]; // relative to eye height // ש left, ק right, ד middle-high: not already in order
  letters.forEach((l, i) => l.userData.home.copy(lessonFrame.localToWorld(new THREE.Vector3(homes[i][0], layoutY + homes[i][1], homes[i][2]))));
}
/** put an object where the head looks (pitch clamped to ±25°), facing the head, upright */
function placeGaze(obj, dist) {
  const p = camera.getWorldPosition(new THREE.Vector3()), d = camera.getWorldDirection(new THREE.Vector3());
  const pitch = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)), -0.44, 0.44);
  const h = new THREE.Vector3(d.x, 0, d.z).normalize();
  obj.position.copy(p).addScaledVector(h, dist * Math.cos(pitch)); obj.position.y += dist * Math.sin(pitch);
  obj.lookAt(p);
}
/** put an object straight ahead of the head */
function placeAhead(obj, dist, dy = 0) {
  const p = camera.getWorldPosition(new THREE.Vector3()), d = camera.getWorldDirection(new THREE.Vector3()); d.y = 0; d.normalize();
  obj.position.copy(p).addScaledVector(d, dist); obj.position.y += dy;
}

// ── letters logic ─────────────────────────────────────────────────────────────
const slotWorld = (i) => slots.localToWorld(new THREE.Vector3(SLOT_GAP * (1 - i), 0, 0.02));
function onGrab(l) {
  if (l.userData.slot >= 0) { slots.userData.filled[l.userData.slot] = null; l.userData.prevSlot = l.userData.slot; l.userData.slot = -1; }
  else l.userData.prevSlot = -1;
  l.userData.moving = null;
  checkWord();
}
function onRelease(l) {
  const p = l.getWorldPosition(new THREE.Vector3());
  let best = -1, bd = 0.26;
  for (let i = 0; i < 3; i++) { const d = slotWorld(i).distanceTo(p); if (d < bd) { bd = d; best = i; } }
  if (best < 0) { l.userData.home.copy(p); return; }      // leave it floating where it was left
  const other = slots.userData.filled[best];
  if (other) {                                           // swap with the letter already there
    const ps = l.userData.prevSlot;
    if (ps >= 0) seat(other, ps); else { unseat(other); other.userData.home.copy(p).add(new THREE.Vector3(0, 0.25, 0.05)); moveTo(other, other.userData.home); }
  }
  seat(l, best); sound.tock(); checkWord();
}
function unseat(l) { if (l.userData.slot >= 0) slots.userData.filled[l.userData.slot] = null; l.userData.slot = -1; }
function seat(l, i) { unseat(l); slots.userData.filled[i] = l; l.userData.slot = i; const w = slotWorld(i); l.userData.home.copy(w); moveTo(l, w); }
function moveTo(l, target) { l.userData.moving = { from: l.position.clone(), to: target.clone(), t: 0 }; }

let wordShownAt = 0;
function checkWord() {
  const f = slots.userData.filled;
  const word = f.every(Boolean) ? f.map((l) => l.userData.ch).join('') : null;   // slot0 (right) first = reading order
  const label = word && CONFIG.words[word];
  letters.forEach((l) => (l.userData.glowTarget = label && l.userData.slot >= 0 ? 1 : 0));
  if (label) {
    wordLabel.userData.setText(label); fade(wordLabel, 1, 1.5);
    f.forEach((l) => (l.userData.glowPulse = 1));
    if (!state.words.has(word)) {
      state.words.add(word); wordShownAt = clockT;
      if (!speaking && state.stage === 3) speak('alsoThis');
    }
  } else fade(wordLabel, 0, 0.6);
  state.word = word;
}
/** test helper: put letters into the slots to spell a word (reading order) */
window.NAVR.placeWord = (w) => { [...w].forEach((ch, i) => { const l = letters.find((x) => x.userData.ch === ch); l.visible = true; l.userData.grabbable = true; seat(l, i); l.position.copy(slotWorld(i)); l.userData.moving = null; }); checkWord(); };

// ── stages ────────────────────────────────────────────────────────────────────
let motion = 0, boil = CONFIG.pot.boilBase;
function setStageInstant(s) {               // used when starting from a later stage (?stage=N)
  if (s >= 2) { world.setReveal(1); flowers.setProgress(1); flowers.setPetals(true); world.setBloom(1); world.setDust(1); state.alive = true; sound.setWind(true, 3); }
  if (s >= 4) revealPotInstant();
  if (s >= 5) world.setFocus(1);
}
function placePot() {
  pot.place(camera.getWorldPosition(new THREE.Vector3()).y);
  world.setPotPos(pot.center());
}
function revealPotInstant() {
  world.setBranchVis(0); world.setSink(0.8); flowers.setPetals(false); state.alive = false;
  placePot(); world.setFocus(1); world.setPotVis(1); sound.potStart(pot.center()); state.potShown = true; state.potFound = true;
}
/** is the learner looking toward the pot? (yaw only, so it works seated) */
function lookingAtPot() {
  const d = pot.center().sub(camera.getWorldPosition(new THREE.Vector3())); d.y = 0; d.normalize();
  const f = camera.getWorldDirection(new THREE.Vector3()); f.y = 0; f.normalize();
  return f.dot(d) > Math.cos(THREE.MathUtils.degToRad(CONFIG.pot.foundDeg));
}

/** v6 · a title card in darkness: prophet + chapter · verses, then the verse (niqqud) read aloud */
async function titleCard(key) {
  const c = CONFIG.titles[key];
  const lineId = ((url.get('titles') || CONFIG.titleVerse) === 'full' && c.full) ? c.full : c.line;
  title.set(c.prophet, c.ref, CONFIG.lines[lineId].text);
  placeGaze(title.group, 1.75);
  title.group.visible = true; state.titleShown = key; state.titles = (state.titles || []).concat(key);
  fade(title.head, 1, T.titleIn); await wait(T.titleIn);
  fade(title.verse, 1, 2); await wait(0.8 * FAST);
  await speak(lineId, { subtitles: false });
  await wait(T.titleHold);
  fade(title.verse, 0, 2); await fade(title.head, 0, 2);
  title.group.visible = false; state.titleShown = null;
}

/** v6 · "מה אתה רואה?" — the learner may answer aloud (where the browser can listen), else the old pause */
async function askSee(kind, pause) {
  await speak('see');
  const canListen = listener.available && (state.mode === 'desktop' || state.micOK);
  if (!canListen) { await wait(pause, true); return; }
  const t0 = clockT; state.listening = true;
  const h = listener.hear(pause, (t) => { subs.userData.setText('« ' + t + ' »'); fade(subs, 0.75, 0.3); });
  advanceWaiters.push(h.cancel);
  const text = await h.done;
  state.listening = false; state.heard = text;
  const k = listener.classify(text, CONFIG.listen[kind]);
  if (!k) { fade(subs, 0, 0.6); const rest = pause - (clockT - t0); if (rest > 0.2) await wait(rest, true); return; }   // silence
  const id = kind === 'almond' ? (k === 'yes' ? 'seeYes' : 'seeOther') : (k === 'dir' ? 'potDir' : k === 'yes' ? 'potYes' : 'potOther');
  state.response = id;
  await wait(0.6 * FAST);
  await speak(id);
  await wait(0.8 * FAST);
}

/** v6 · the pot's pose while the gaze descends into it (k 0..1) */
let intoFrom = null;
function intoPose(k, head, fwd) {
  const g = pot.group;
  if (!intoFrom) intoFrom = { p: g.position.clone(), q: g.quaternion.clone(), s: g.scale.x };
  const S1 = 3.4, mouthY = pot.mouthLocal().y * S1;
  const p1 = head.clone().addScaledVector(fwd, 0.3); p1.y = head.y - 0.5 - mouthY;
  const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, Math.atan2(-fwd.x, -fwd.z), 0, 'YXZ'));
  const e = k * k * (3 - 2 * k);
  g.position.lerpVectors(intoFrom.p, p1, e); g.quaternion.slerpQuaternions(intoFrom.q, q1, e); g.scale.setScalar(intoFrom.s + (S1 - intoFrom.s) * e);
  g.updateMatrixWorld(true); world.setPotPos(pot.center());
  return p1;
}

const STAGES = [
  // 0 · Darkness — silence, then the faceless voice; eyes closed; eyes open
  async function dark() {
    sound.roomTone(0.03, 3);
    await wait(T.darkSilence);
    await speak('intro1');
    await wait(T.betweenIntro);
    await speak('intro2');
    await wait(1.5 * FAST);
    await titleCard('almond');
    await wait(1.5 * FAST);
    await speak('closeEyes');
    await wait(T.eyesClosed);
    await speak('openEyes');
  },
  // 1 · The branch draws itself in the air — wood first (ink strokes, then color), then the blossoms open
  async function draw() {
    sound.swell(T.drawBark + T.drawBlossom);
    tween(T.drawBark * 0.6, (k) => world.setDust(k));
    state.drawing = true;
    await tween(T.drawBark, (k) => world.setReveal(k), (x) => 1 - Math.pow(1 - x, 1.6));
    world.setReveal(1);
    sound.setWind(true, 6);
    await tween(T.drawBlossom, (k) => { flowers.setProgress(k); world.setBloom(THREE.MathUtils.smoothstep(k, 0.05, 0.9)); if (k > 0.6) flowers.setPetals(true); }, (x) => x);
    state.drawing = false; state.alive = true;                 // alive: wind, touch → tremble + petals
    await wait(T.aliveHold, true);
  },
  // 2 · Test one — "מה אתה רואה?", the verbal link, and the three letters (compact)
  async function almond() {
    state.alive = true;
    await askSee('almond', T.answerPause);
    await speak('almond1');
    layout();
    verse.userData.setText(CONFIG.verse); verse.visible = true; state.verseShown = true;
    wait(1.0 * FAST).then(() => fade(verse, 1, 3));
    await speak('almond2');
    await wait(T.verseHold);
    await speak('almond3');
    anchorW = world.branch.group.localToWorld(flowers.anchor.clone());
    letters.forEach((l, i) => {
      l.visible = true; l.position.copy(anchorW); l.scale.setScalar(0.2);
      const from = anchorW.clone(), to = l.userData.home.clone();
      const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 0.25, 0));
      wait(i * 0.6 * FAST).then(() => tween(T.lettersFloatOut, (k) => {
        const a = from.clone().lerp(mid, k), b = mid.clone().lerp(to, k); l.position.copy(a.lerp(b, k)); l.scale.setScalar(0.2 + 0.8 * k);
      }).then(() => (l.userData.grabbable = true)));
    });
    slots.visible = true; fade(slotLines, 0.85, 3);
    await wait(1.5 * FAST);
    await speak('letters');
    letters.forEach((l) => (l.userData.grabbable = true));
    state.lettersReady = true;
    const t0 = clockT;
    await new Promise((res) => {
      const tick = setInterval(() => {
        const el = clockT - t0, allFound = Object.keys(CONFIG.words).every((w) => state.words.has(w));
        if (!cont.visible && (el > T.lettersMinTime || (allFound && clockT - wordShownAt > 5 * FAST))) { cont.visible = true; fade(cont, 0.8, 2); }
        if (el > T.lettersMaxTime || state.continuePressed) { clearInterval(tick); res(); }
      }, 100);
    });
    state.continuePressed = false;
    fade(cont, 0, 1).then(() => (cont.visible = false));
  },
  // 3 · Transition — the branch sinks into darkness; the same unseen light finds something behind you
  async function turn() {
    state.alive = false; flowers.setPetals(false); sound.setWind(false, T.sink);
    letters.forEach((l) => { l.userData.grabbable = false; fade(l, 0, 3); }); fade(slots, 0, 3); if (verse.visible) fade(verse, 0, 3);
    await tween(T.sink, (k) => { world.setSink(k * 0.8); world.setBranchVis(1 - k); world.setDust(1 - k); }, (x) => x * x);
    letters.forEach((l) => (l.visible = false)); slots.visible = false; verse.visible = false;
    await wait(T.darkHold);
    await titleCard('pot');
    await wait(1.2 * FAST);
    placePot(); world.setFocus(1);
    sound.potStart(pot.center()); sound.potSet(0.55, boil); state.potShown = true;
    sound.breath(T.potReveal * 1.4);
    tween(T.potReveal, (k) => { world.setPotVis(k); world.setDust(k * 0.6); });
    await wait(T.potReveal * 0.4);
    await speak('lookAround');
    const t0 = clockT; let hinted = false, autoTurn = null;
    await new Promise((res) => {
      const tick = setInterval(() => {
        const el = clockT - t0;
        if (lookingAtPot()) { clearInterval(tick); state.potFound = true; res(); return; }
        if (!hinted && el > T.potHintAfter) {
          hinted = true; state.potHint = true; speak('hint');
          if (!renderer.xr.isPresenting) autoTurn = clockT;          // desktop preview: turn for the viewer
        }
        if (autoTurn !== null && clockT - autoTurn > 2 * FAST) turnCameraToPot();
        if (el > T.potFindMax) { clearInterval(tick); res(); }
      }, 100);
    });
  },
  // 4 · Test two — the pot boils, fanned by fire; steam, sparks and flames stream one way. Form, direction, motion.
  async function potTest() {
    state.potStage = true;
    await wait(1.5 * FAST);
    await askSee('pot', T.potAnswerPause);
    const c = pot.center();
    potVerse.position.copy(c).add(new THREE.Vector3(0, 0.62, 0));
    potVerse.userData.setText(CONFIG.potVerse); potVerse.visible = true; fade(potVerse, 1, 3); state.potVerseShown = true;
    await speak('potVerse1');
    await wait(T.potVersePause);
    await speak('potVerse2');
    await wait(T.potThink);
    fade(potVerse, 0.35, 4);
    await speak('potNoWord');
    await wait(T.potThink);
    await speak('potAbstract');
    await wait(T.potThink);
    await speak('potBlown');
    await wait(1.5 * FAST);
    await speak('potBreath');
    await wait(T.potThink);
    await speak('potVessel');
    await wait(2 * FAST);
    await speak('potReads');
    await wait(T.potThink);
    await speak('potStay');
    await wait(T.potStay, true);
  },
  // 5 · Into the pot (mirror of lesson 2's walk to the light): the gaze descends, we are swallowed by
  //     sparks and steam, darkness — then Babylon's army comes from the north, and the voice tells how it came true.
  async function exit() {
    state.into = true; state.boilLock = 1;
    if (potVerse.visible) fade(potVerse, 0, 3);
    await speak('intoPot');
    const head = camera.getWorldPosition(new THREE.Vector3()), fwd = camera.getWorldDirection(new THREE.Vector3()); fwd.y = 0; fwd.normalize();
    intoFrom = null; state.engulfHead = true;
    const desk = !renderer.xr.isPresenting, q0 = camera.quaternion.clone();
    sound.potSet(1, 1);
    await tween(T.intoDescend, (k) => {
      const p1 = intoPose(k, head, fwd);
      pot.setEngulf(k * k * 0.35, headPos); pot.setHeat(0.15 + 0.85 * k);
      if (desk) {                                                    // desktop preview: the gaze goes down into the mouth
        const m = new THREE.Matrix4().lookAt(camera.position, new THREE.Vector3(p1.x, p1.y + pot.mouthLocal().y * 3.4, p1.z).lerp(camera.position.clone().addScaledVector(fwd, 0.6), 0.15), new THREE.Vector3(0, 1, 0));
        camera.quaternion.slerpQuaternions(q0, new THREE.Quaternion().setFromRotationMatrix(m), k);
      }
    }, (x) => x);
    state.intoDescended = true;
    sound.swallow(T.intoSwallow * 1.3);
    veil.visible = true;
    const y0 = pot.group.position.y;
    await tween(T.intoSwallow, (k) => {
      pot.group.position.y = y0 + k * 1.1;                           // the mouth rises over the eyes
      pot.setEngulf(0.35 + 0.65 * Math.min(1, k * 1.6), headPos);
      veil.material.opacity = THREE.MathUtils.smoothstep(k, 0.35, 1);
    }, (x) => x);
    state.swallowed = true;
    if (desk) { const qd = camera.quaternion.clone(), e = new THREE.Euler().setFromQuaternion(qd, 'YXZ'); const ql = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, e.y, 0, 'YXZ')); tween(3 * FAST, (k) => camera.quaternion.slerpQuaternions(qd, ql, k)); }
    world.setPotVis(0); world.setDust(0); sound.potStop(1.5); state.potShown = false;
    tween(2.5 * FAST, (k) => pot.setEngulf(1 - k, headPos)).then(() => { pot.setEngulf(0); state.engulfHead = false; });
    // darkness: the army approaches from the north (+Z)
    const hp = camera.getWorldPosition(new THREE.Vector3());
    sound.armyStart(new THREE.Vector3(hp.x, 1.4, hp.z + 30), new THREE.Vector3(hp.x + 0.5, 1.4, hp.z + 3.5), T.armyApproach * 2.2);
    state.army = true;
    await wait(T.armyApproach);
    sound.armyDuck(0.45);
    await titleCard('fulfil');
    await wait(1 * FAST);
    await speak('fulfil1');
    await wait(T.armyBetween);
    await speak('fulfil2');
    await wait(T.armyBetween);
    await speak('fulfil3');
    sound.armyStop(T.exitFade);
    await wait(T.armyBetween);
    await speak('fulfil4');
    await wait(T.armyBetween);
    sound.fadeAll(T.exitFade);
    await speak('exit');
    await wait(T.endHold);
    fade(veil, 0, 4).then(() => (veil.visible = false));               // passthrough: the real room returns
    placeGaze(endCard, 1.15); endCard.visible = true; fade(endCard, 0.7, 4);
  },
];
let turnAnim = null;
function turnCameraToPot() {
  if (turnAnim) return;
  const c = pot.center(), from = camera.quaternion.clone();
  const m = new THREE.Matrix4().lookAt(camera.position, c, new THREE.Vector3(0, 1, 0));
  const to = new THREE.Quaternion().setFromRotationMatrix(m);
  turnAnim = tween(4 * FAST, (k) => camera.quaternion.slerpQuaternions(from, to, k));
}

async function runLesson() {
  if (CONFIG.branch.followEyeHeight) {
    const y = camera.getWorldPosition(new THREE.Vector3()).y;
    world.setBaseY(THREE.MathUtils.clamp(y + CONFIG.branch.eyeOffset, 0.9, 1.8));
  }
  layout();
  setStageInstant(START);
  for (let s = START; s < STAGES.length; s++) { state.stage = s; console.log('[NAVR] stage', s); await STAGES[s](); }
  state.stage = STAGES.length; state.done = true; console.log('[NAVR] done');
}

// ── per-frame ─────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let input;
const headPos = new THREE.Vector3(), headDir = new THREE.Vector3(), tmp = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
let prevHead = null; const prevDir = new THREE.Vector3(0, 0, -1), prevHands = [];
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  clockT += dt;
  const time = clock.elapsedTime;
  for (const tw of [...tweens]) {
    const k = Math.min(1, (clockT - tw.t0) / tw.dur); tw.fn(tw.ease(k));
    if (k >= 1) { tweens.delete(tw); tw.res(); }
  }
  camera.getWorldPosition(headPos);
  const viewH = renderer.xr.isPresenting ? 1800 : renderer.domElement.height;
  world.update(time, viewH);
  // alive branch: touch (hands / controllers / mouse) → tremble + petals; petals may rest on a hand
  const tp = input.touchPoints();
  if (state.alive && world.interact(time, dt, tp.touch, input.mouseRay())) state.touches = (state.touches || 0) + 1;
  world.petalsTick(dt, time, tp.palms);
  // the pot: boils more when the learner is still, calms when they move a lot (CONFIG.pot.interaction)
  {
    camera.getWorldDirection(headDir);
    let sp = prevHead ? headPos.distanceTo(prevHead) / Math.max(dt, 1e-3) + prevDir.angleTo(headDir) / Math.max(dt, 1e-3) * 0.4 : 0;
    tp.touch.forEach((p, k) => { if (p && prevHands[k]) sp += p.distanceTo(prevHands[k]) / Math.max(dt, 1e-3) * 0.5; prevHands[k] = p ? (prevHands[k] || new THREE.Vector3()).copy(p) : null; });
    prevHead = (prevHead || new THREE.Vector3()).copy(headPos); prevDir.copy(headDir);
    motion += (Math.min(sp, 3) - motion) * Math.min(1, dt * 2.5);
    const PC = CONFIG.pot;
    let target = PC.interaction === 'stillness' ? THREE.MathUtils.clamp(1 - motion / PC.motionCalm, PC.boilMin ?? 0.1, 1) : PC.boilBase;
    if (state.boilLock) target = state.boilLock;
    boil = target > boil ? Math.min(target, boil + PC.boilRise * dt) : Math.max(target, boil - PC.boilFall * dt);
    pot.setBoil(boil); pot.update(time, dt, viewH);
    if (state.potShown && !state.done) sound.potSet(state.potHint && !state.potFound ? 1 : 0.6, boil);
    sound.setListener(headPos, headDir, tmp.set(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(tmpQ)));
  }

  // letters: drift, bob, face the user
  letters.forEach((l, i) => {
    if (!l.visible) return;
    const u = l.userData;
    if (u.moving) { u.moving.t = Math.min(1, u.moving.t + dt * 4); l.position.lerpVectors(u.moving.from, u.moving.to, 1 - Math.pow(1 - u.moving.t, 3)); if (u.moving.t >= 1) u.moving = null; }
    else if (!u.held && u.grabbable && u.slot < 0) l.position.y = u.home.y + Math.sin(time * 0.8 + i * 2) * 0.012;
    l.lookAt(headPos);
    // warm glow when the letters form a word: a soft swell, then a quiet afterglow
    u.glowPulse = Math.max(0, (u.glowPulse || 0) - dt * 0.5);
    const gTarget = (u.glowTarget || 0) * (0.4 + 0.08 * Math.sin(time * 1.3 + i)) + u.glowPulse * 0.6;
    u.glow.material.opacity += (gTarget * u.front.material.opacity - u.glow.material.opacity) * Math.min(1, dt * 3);
    const s = (u.hover ? 1.1 : 1) * (u.held ? 1.05 : 1);
    if (u.grabbable) l.scale.lerp(tmp.setScalar(s), 0.2);
  });
  if (cont.visible) { cont.lookAt(headPos); cont.userData.ring.scale.setScalar(cont.userData.hit.userData.hover ? 1.35 : 1 + Math.sin(time * 1.5) * 0.04); }
  
  if (endCard.visible) endCard.lookAt(headPos);
  if (veil.visible) veil.position.copy(headPos);
  if (state.engulfHead) pot.engulf.position.copy(headPos);
  listenRing.material.opacity += ((state.listening ? 0.45 + 0.25 * Math.sin(time * 3) : 0) - listenRing.material.opacity) * Math.min(1, dt * 4);
  if (potVerse.visible) potVerse.lookAt(headPos.x, potVerse.position.y, headPos.z);

  // subtitles lazily follow the head's yaw
  camera.getWorldDirection(headDir); headDir.y = 0; headDir.normalize();
  const target = headPos.clone().addScaledVector(headDir, 1.25); target.y = headPos.y + CONFIG.subtitleHeight;
  subs.position.lerp(target, renderer.xr.isPresenting ? 0.04 : 1);
  subs.lookAt(headPos);

  input.update();
  renderer.render(scene, camera);
}

// ── start-up / sessions ───────────────────────────────────────────────────────
const ui = { mic: document.getElementById('enable-mic'), overlay: document.getElementById('overlay'), vr: document.getElementById('enter-vr'), ar: document.getElementById('enter-ar'), desk: document.getElementById('enter-desktop'), note: document.getElementById('note') };

async function begin(mode) {
  if (state.started) return;
  state.started = true; state.mode = mode;
  sound.unlock();                                     // inside the click = audio allowed
  ui.overlay.classList.add('hidden');
  const voices = sound.loadVoices();
  // listening guide in VR: only if the microphone was already allowed (no prompt inside the headset)
  if (listener.available && mode !== 'desktop' && !state.micOK && navigator.permissions) {
    navigator.permissions.query({ name: 'microphone' }).then((p) => (state.micOK = p.state === 'granted')).catch(() => {});
  }
  if (mode === 'vr' || mode === 'ar') {
    const session = await navigator.xr.requestSession(mode === 'ar' ? 'immersive-ar' : 'immersive-vr',
      { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    if (mode === 'ar') {                              // passthrough: virtual room is opaque until the exit fades it
      scene.background = null;
      world.fadeables.forEach((m) => { m.transparent = true; m.needsUpdate = true; });
    }
    await renderer.xr.setSession(session);
    session.addEventListener('end', () => location.reload());
    await wait(0.3);                                  // let the first poses arrive before layout
  }
  await voices;
  runLesson();
}

async function init() {
  await loadFont();
  buildLessonObjects();
  input = createInput({
    renderer, camera, scene, dom: renderer.domElement,
    targets: () => ({ letters, buttons: cont.visible ? [cont.userData.hit] : [] }),
    onGrab, onRelease, onAdvance: advance,
    onActivate: (b) => { if (b.userData.isContinue) state.continuePressed = true; },
  });
  renderer.setAnimationLoop(frame);

  const xr = navigator.xr;
  const vrOK = xr && await xr.isSessionSupported('immersive-vr').catch(() => false);
  const arOK = xr && await xr.isSessionSupported('immersive-ar').catch(() => false);
  ui.vr.disabled = !vrOK; ui.ar.hidden = !arOK;
  if (!vrOK) ui.note.textContent = 'WebXR לא זמין בדפדפן הזה — אפשר לצפות בתצוגה המקדימה במחשב. במשקפי Quest: פתחו את הקישור בדפדפן Meta Quest.';
  ui.vr.onclick = () => begin('vr');
  ui.ar.onclick = () => begin('ar');
  ui.desk.onclick = () => begin('desktop');
  // optional: allow the microphone before entering VR (listening guide); hidden where the browser can't listen
  if (ui.mic) {
    ui.mic.hidden = !listener.available;
    ui.mic.onclick = async () => {
      try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); st.getTracks().forEach((t) => t.stop()); state.micOK = true; ui.mic.textContent = 'הַקְשָׁבָה קוֹלִית פְּעִילָה ✓'; ui.mic.disabled = true; }
      catch (e) { listener.disable(); ui.mic.hidden = true; }
    };
  }
  document.body.classList.add('ready');
  window.NAVR.ready = true;
  if (url.get('autostart') === 'desktop') begin('desktop');
  if (url.has('hero') || url.has('shot')) heroFrame();
}
init().catch((e) => { console.error(e); ui.note.textContent = 'שגיאה בטעינה: ' + e.message; });

// ── debug / test helpers (harmless in production) ──
Object.assign(window.NAVR, {
  presenting: () => renderer.xr.isPresenting,
  sessionMode: () => state.mode,
  letterPos: (ch) => letters.find((l) => l.userData.ch === ch).getWorldPosition(new THREE.Vector3()).toArray(),
  letterSlot: (ch) => letters.find((l) => l.userData.ch === ch).userData.slot,
  letterHeld: (ch) => !!letters.find((l) => l.userData.ch === ch).userData.held,
  slotPos: (i) => slotWorld(i).toArray(),
  headPos: () => camera.getWorldPosition(new THREE.Vector3()).toArray(),
  inputs: () => input.sources.map((s) => ({ connected: s.connected, hand: s.isHand })),
});
Object.assign(window.NAVR, {
  voicesLoaded: () => Object.keys(sound.buffers).length,
  audioState: () => sound.ctx && sound.ctx.state,
  drawCalls: () => renderer.info.render.calls,
  triangles: () => renderer.info.render.triangles,
  branchStats: () => world.stats(),
  potBoil: () => boil,
  potCenter: () => pot.center().toArray(),
  lookingAtPot: () => lookingAtPot(),
  branchPoint: (i = 12) => world.branch.group.localToWorld(world.branch.touchPts[i].clone()).toArray(),
  stageName: () => STAGES[state.stage]?.name,
});

// ── ?hero=1 / ?shot=dark|drawing|branch|pot : composed stills (posters / review) ──
function heroFrame(shot = url.get('shot') || 'branch') {
  ui.overlay.classList.add('hidden');
  renderer.setAnimationLoop(null);
  renderer.setPixelRatio(+(url.get('pr') || 2));            // supersampling
  renderer.setSize(innerWidth, innerHeight);
  subs.visible = false;
  camera.fov = +(url.get('fov') || 44); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  const B = CONFIG.branch, H = CONFIG.hero || {};
  const time = 4.2;
  world.setLight(1);
  if (shot === 'title') {
    camera.position.set(0, 1.6, 0); camera.rotation.set(0, 0, 0, 'YXZ'); camera.updateMatrixWorld();
    camera.getWorldPosition(headPos);
    const key = url.get('card') || 'almond', c = CONFIG.titles[key];
    const lineId = ((url.get('titles') || CONFIG.titleVerse) === 'full' && c.full) ? c.full : c.line;
    title.set(c.prophet, c.ref, CONFIG.lines[lineId].text);
    placeAhead(title.group, 1.75, 0.02); title.group.lookAt(0, title.group.position.y, 0); title.group.visible = true;
    title.head.material.opacity = 1; title.verse.material.opacity = 1;
    camera.fov = 62; camera.updateProjectionMatrix();
  } else if (shot === 'into') {
    camera.position.set(0, 1.6, 0); camera.updateMatrixWorld();
    revealPotInstant(); boil = 1; pot.setBoil(1);
    const c = pot.center(), fwd = c.clone().sub(camera.position); fwd.y = 0; fwd.normalize();
    camera.position.copy(c).addScaledVector(fwd, -1.3); camera.position.y = 1.6; camera.updateMatrixWorld();
    const head = camera.position.clone();
    intoFrom = null; const p1 = intoPose(+(url.get('k') || 0.8), head, fwd);
    camera.lookAt(p1.x + fwd.x * 0.05, p1.y + pot.mouthLocal().y * 3.4 * 0.8, p1.z + fwd.z * 0.05);
    pot.setEngulf(+(url.get('engulf') || 0.6), head);
    camera.fov = 70; camera.updateProjectionMatrix();
    world.setDust(0.6);
  } else if (shot === 'pot') {
    camera.position.set(0, 1.6, 0); camera.updateMatrixWorld();
    revealPotInstant(); boil = 0.9; pot.setBoil(boil);
    const c = pot.center(), dir = c.clone().sub(camera.position); dir.y = 0; dir.normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(+(url.get('side') || 0.9));   // from the side: the stream reads left→right
    camera.position.copy(c).addScaledVector(dir, -(+(url.get('dist') || 1.1))).add(side); camera.position.y = c.y + 0.3;
    camera.lookAt(c.x - dir.x * 0.35, c.y + 0.1, c.z - dir.z * 0.35);
    world.setDust(0.6);
  } else if (shot === 'dark') {
    camera.position.set(0, 1.6, 0); camera.rotation.set(-0.05, 0.2, 0, 'YXZ'); camera.updateMatrixWorld();
    subs.visible = true; subs.userData.setText(CONFIG.lines.intro1.text);
    subs.traverse((o) => o.material && !o.material.userData.skipFade && (o.material.opacity = 1));
    camera.getWorldDirection(headDir); headDir.y = 0; headDir.normalize();
    subs.position.copy(camera.position).addScaledVector(headDir, 1.25); subs.position.y = 1.6 - 0.05; subs.lookAt(camera.position);
  } else {
    const drawing = shot === 'drawing';
    world.setReveal(drawing ? +(url.get('reveal') || 0.62) : 1);
    flowers.setProgress(drawing ? 0.0 : 1); flowers.setPetals(!drawing); world.setBloom(drawing ? 0 : 1); world.setDust(drawing ? 0.5 : 1);
    const target = new THREE.Vector3(B.x + (H.tx ?? 0.3), B.y + (H.ty ?? -0.04), B.z + (H.tz ?? 0));
    camera.position.set(B.x + (H.cx ?? 0.35), B.y + (H.cy ?? 0.05), B.z + (H.cz ?? 1.2));
    camera.lookAt(target);
    world.setYaw(Math.atan2(camera.position.x - B.x, camera.position.z - B.z) + 0.1);
    if (!drawing) { let t = 0; for (let i = 0; i < 900; i++) { t += 1 / 30; world.update(t, 1440); world.petalsTick(1 / 30, t, []); } }
  }
  world.update(time, renderer.domElement.height);
  pot.update(time, 0, renderer.domElement.height);
  renderer.render(scene, camera);
  window.NAVR.heroPNG = renderer.domElement.toDataURL('image/png');   // read right after drawing
  window.NAVR.heroReady = true;
}
