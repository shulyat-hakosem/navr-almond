// Sound: pre-generated Hebrew voice lines (mp3) + procedurally generated ambience.
// Everything is synthesised with WebAudio – no external/copyrighted sound files.
import { CONFIG } from '../config.js';

export class Sound {
  constructor() { this.ctx = null; this.buffers = {}; this.voiceSrc = null; }

  /** MUST be called inside a user gesture (the Enter button click). */
  unlock() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
      this.voiceGain = c.createGain(); this.voiceGain.gain.value = 1.0; this.voiceGain.connect(this.master);
      this.ambGain = c.createGain(); this.ambGain.gain.value = 1.0; this.ambGain.connect(this.master);
      this._setupAmbience();
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
  }

  async loadVoices() {
    await Promise.all(Object.keys(CONFIG.lines).map(async (id) => {
      try {
        const r = await fetch(`assets/audio/${id}.mp3`); if (!r.ok) throw new Error(r.status);
        this.buffers[id] = await this.ctx.decodeAudioData(await r.arrayBuffer());
      } catch (e) { console.warn('voice line missing, subtitles only:', id); }
    }));
  }

  /** Plays a voice line; resolves when it ends. Returns duration (s) or null if no audio. */
  playVoice(id) {
    const buf = this.buffers[id]; if (!buf || !this.ctx) return null;
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.connect(this.voiceGain);
    src.start(); this.voiceSrc = src;
    return { duration: buf.duration, ended: new Promise((res) => (src.onended = res)) };
  }

  _noise(seconds, brown = false) {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    const s = c.createBufferSource(); s.buffer = b; s.loop = true; return s;
  }

  _setupAmbience() {
    const c = this.ctx;
    // room tone: low brown noise (the "noise" that fades during the entry)
    this.tone = c.createGain(); this.tone.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    const bn = this._noise(4, true); bn.connect(lp).connect(this.tone).connect(this.ambGain); bn.start();
    // wind: white noise through a slowly wandering band-pass, panned toward the window (right)
    this.wind = c.createGain(); this.wind.gain.value = 0;
    this.windBP = c.createBiquadFilter(); this.windBP.type = 'bandpass'; this.windBP.frequency.value = 500; this.windBP.Q.value = 0.8;
    const pan = c.createStereoPanner(); pan.pan.value = 0.55;
    const wn = this._noise(3); wn.connect(this.windBP).connect(this.wind).connect(pan).connect(this.ambGain); wn.start();
    this.birdPan = c.createStereoPanner(); this.birdPan.pan.value = 0.7; this.birdPan.connect(this.ambGain);
  }

  _ramp(param, to, sec) {
    const t = this.ctx.currentTime; param.cancelScheduledValues(t); param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(to, t + Math.max(0.05, sec));
  }
  roomTone(level, sec) { if (this.ctx) this._ramp(this.tone.gain, level, sec); }

  setWind(on, sec = 4) {
    if (!this.ctx) return;
    this._ramp(this.wind.gain, on ? 0.11 : 0.0, sec);
    clearInterval(this._windT);
    if (on) this._windT = setInterval(() => {              // gusts
      const t = this.ctx.currentTime;
      this.windBP.frequency.linearRampToValueAtTime(300 + Math.random() * 700, t + 2.5);
    }, 2500);
  }

  /** A small songbird: random short phrases of frequency-swept chirps. */
  setBirds(on) {
    clearTimeout(this._birdT); if (!on || !this.ctx) return;
    const phrase = () => {
      const c = this.ctx; let t = c.currentTime + 0.05;
      const n = 2 + ((Math.random() * 4) | 0), f0 = 2600 + Math.random() * 900;
      this.birdPan.pan.value = 0.3 + Math.random() * 0.6;
      for (let i = 0; i < n; i++) {
        const o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
        const f = f0 * (0.9 + Math.random() * 0.3), d = 0.07 + Math.random() * 0.08;
        o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + d * 0.5);
        o.frequency.exponentialRampToValueAtTime(f * 0.85, t + d);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + d);
        o.connect(g).connect(this.birdPan); o.start(t); o.stop(t + d + 0.02);
        t += d + 0.04 + Math.random() * 0.08;
      }
      this._birdT = setTimeout(phrase, 1800 + Math.random() * 3500);
    };
    this._birdT = setTimeout(phrase, 1200);
  }

  /** A very soft, low swell when the branch blossoms (two sine partials). */
  swell(sec = 8) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const g = c.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + sec * 0.6); g.gain.linearRampToValueAtTime(0, t + sec * 1.4);
    g.connect(this.ambGain);
    [220, 329.6, 440.0 * 1.0005].forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const og = c.createGain(); og.gain.value = [1, 0.6, 0.25][i];
      o.connect(og).connect(g); o.start(t); o.stop(t + sec * 1.5);
    });
  }

  /** Soft wooden "tock" when a letter settles in a slot. */
  tock() {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle';
    o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.08);
    g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
    o.connect(g).connect(this.ambGain); o.start(t); o.stop(t + 0.2);
  }

  // ── the pot: a positional boiling sound (HRTF) so the learner can find it by ear ──
  potStart(pos) {
    if (!this.ctx || this.pot) return; const c = this.ctx;
    const pan = c.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 0.8; pan.rolloffFactor = 1.2;
    this._setPos(pan, pos);
    const g = c.createGain(); g.gain.value = 0; g.connect(pan).connect(this.ambGain);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.9;
    const n = this._noise(3, true); n.connect(bp).connect(g); n.start();
    const pops = c.createGain(); pops.gain.value = 1; pops.connect(pan);
    this.pot = { pan, g, pops, boil: 0, level: 0, heat: 0 };
    const pop = () => {
      const P = this.pot; if (!P) return;
      if (P.heat > 0.04 && P.boil < 0.7 && Math.random() < 0.4 * (1 - P.boil)) {   // the cold iron ticks as it heats
        const t = c.currentTime + Math.random() * 0.1; this._burst(P.pops, t, 0.025, 3200 + Math.random() * 2500, 0.05 + 0.08 * P.heat, 'bandpass', 6);
        if (Math.random() < 0.3) this._burst(P.pops, t, 0.12, 180, 0.12 * P.heat, 'lowpass');                      // a low knock
      }
      if (P.level > 0.01 && P.boil > 0.03) {
        const t = c.currentTime, o = c.createOscillator(), og = c.createGain(); o.type = 'sine';
        const f = 260 + Math.random() * 700; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.04);
        og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.05 * P.level, t + 0.005); og.gain.exponentialRampToValueAtTime(0.0003, t + 0.07);
        o.connect(og).connect(P.pops); o.start(t); o.stop(t + 0.09);
        if (Math.random() < 0.08) this._burst(P.pops, t + Math.random() * 0.05, 0.012, 2500 + Math.random() * 3000, 0.07 * P.level, 'highpass');  // fire crackle
      }
      this._potT = setTimeout(pop, 60 + Math.random() * 500 / (0.3 + P.boil * 1.5));
    };
    pop();
  }
  _setPos(pan, p) {
    if (pan.positionX) { pan.positionX.value = p.x; pan.positionY.value = p.y; pan.positionZ.value = p.z; } else pan.setPosition(p.x, p.y, p.z);
  }
  /** level 0..1 (overall loudness: the hint raises it), boil 0..1 (how hard it boils) */
  potSet(level, boil, heat = 0) {
    if (!this.pot) return; this.pot.heat = heat;
    const target = 0.16 * level * boil;
    if (Math.abs(target - (this.pot.target ?? -1)) > 0.004) { this.pot.target = target; this._ramp(this.pot.g.gain, target, 0.3); }
    this.pot.level = level; this.pot.boil = boil;
  }
  potStop(sec = 4) { if (this.pot) { this._ramp(this.pot.g.gain, 0, sec); this.pot.level = 0; this.pot.target = 0; } }
  /** the listener follows the head (positional audio) */
  setListener(pos, fwd, up) {
    if (!this.ctx) return; const L = this.ctx.listener;
    if (L.positionX) {
      L.positionX.value = pos.x; L.positionY.value = pos.y; L.positionZ.value = pos.z;
      L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z; L.upX.value = up.x; L.upY.value = up.y; L.upZ.value = up.z;
    } else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
  }
  /** a very low, short drone when the light finds something (no melody) */
  breath(sec = 5, f = 110) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.04, t + sec * 0.4); g.gain.linearRampToValueAtTime(0, t + sec);
    g.connect(this.ambGain);
    [f, f * 1.5].forEach((fr, i) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = fr; const og = c.createGain(); og.gain.value = i ? 0.35 : 1; o.connect(og).connect(g); o.start(t); o.stop(t + sec + 0.1); });
  }

  /** a short filtered noise burst (shared buffer) */
  _burst(dest, t, dur, freq, gain, type = 'bandpass', q = 1) {
    const c = this.ctx;
    if (!this._nb) { const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this._nb = b; }
    const s = c.createBufferSource(); s.buffer = this._nb;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + Math.min(0.004, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0002, t + dur);
    s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.02);
  }

  // ── v7 · Babylon's army, INSIDE the pot: loud and present (synthesised: no sound files) ──
  // war drums, marching feet, galloping hooves, whinnying horses, chariot wheels, clashing iron, shouts, horns.
  // Not distance-attenuated: it surrounds the learner, its centre slowly circling (stereo pan), arriving from the north.
  armyStart(sec = 6) {
    if (!this.ctx || this.army) return; const c = this.ctx, t0 = c.currentTime;
    const bus = c.createGain(); bus.gain.setValueAtTime(0, t0); bus.gain.linearRampToValueAtTime(1, t0 + sec);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.25;
    const duck = c.createGain(); duck.gain.value = 1;
    const pan = c.createStereoPanner(); pan.pan.value = 0;
    const lfoP = c.createOscillator(); lfoP.frequency.value = 0.045; const lpg = c.createGain(); lpg.gain.value = 0.55; lfoP.connect(lpg).connect(pan.pan); lfoP.start();
    const g = c.createGain(); g.gain.value = 1.0;
    g.connect(pan).connect(bus).connect(comp).connect(duck).connect(this.master);
    // the ground: a low rumble
    const rum = c.createGain(); rum.gain.value = 0.55; const rlp = c.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 120;
    const bn = this._noise(4, true); bn.connect(rlp).connect(rum).connect(bus); bn.start();
    // chariot wheels: rattling band-passed noise
    const wh = c.createGain(); wh.gain.value = 0.0; const wbp = c.createBiquadFilter(); wbp.type = 'bandpass'; wbp.frequency.value = 300; wbp.Q.value = 1.2;
    const lfo = c.createOscillator(); lfo.frequency.value = 8.5; const lg = c.createGain(); lg.gain.value = 0.35; lfo.connect(lg).connect(wh.gain); lfo.start();
    const wn = this._noise(3); wn.connect(wbp).connect(wh).connect(g); wn.start();
    this.army = { g, bus, duck, nodes: [bn, wn, lfo, lfoP], next: t0 + 0.2, step: 0 };
    [0.8, sec + 1.5, sec + 14].forEach((dt) => this._horn(g, t0 + dt));
    const tick = () => {
      const A = this.army; if (!A || A.stopped) return;
      while (A.next < c.currentTime + 0.6) {
        const t = A.next, beat = A.step;
        // war drum on 1 and 3, a heavier one on 1
        if (beat % 2 === 0) this._drum(g, t, beat % 4 === 0 ? 1 : 0.7);
        // marching: many feet, a little ragged
        for (let k = 0; k < 9; k++) this._burst(g, t + (Math.random() - 0.5) * 0.09, 0.1, 130 + Math.random() * 140, 0.45, 'lowpass');
        this._burst(g, t + 0.01, 0.06, 1900, 0.12, 'bandpass', 2);                       // gravel, sandals
        // hooves: gallop triplets from several horses, out of phase
        for (let hh = 0; hh < 4; hh++) { const ht = t + hh * 0.13 + Math.random() * 0.03; [0, 0.07, 0.14].forEach((o, i) => { this._burst(g, ht + o, 0.05, 800 + i * 260, 0.22, 'bandpass', 3); this._burst(g, ht + o, 0.08, 110, 0.4, 'lowpass'); }); }
        // iron: weapons, armour, bridles
        if (Math.random() < 0.75) this._clang(g, t + Math.random() * 0.5, Math.random() < 0.3 ? 1 : 0.5);
        if (Math.random() < 0.16) this._neigh(g, t + Math.random() * 0.4);
        if (Math.random() < 0.12) this._shout(g, t + Math.random() * 0.4);
        A.step++; A.next += 0.5;
      }
      A.timer = setTimeout(tick, 200);
    };
    tick();
  }
  _drum(dest, t, k) {
    const c = this.ctx, o = c.createOscillator(), og = c.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.35);
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.9 * k, t + 0.008); og.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(og).connect(dest); o.start(t); o.stop(t + 0.65);
    this._burst(dest, t, 0.08, 700, 0.25 * k, 'bandpass', 0.8);
  }
  _clang(dest, t, k) {
    const c = this.ctx, f0 = 1300 + Math.random() * 1600;
    [1, 1.51, 2.27, 2.98, 4.1].forEach((m, i) => { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f0 * m * (1 + (Math.random() - 0.5) * 0.01);
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.06 * k / (i + 1), t + 0.002); og.gain.exponentialRampToValueAtTime(0.0002, t + 0.35 + Math.random() * 0.5);
      o.connect(og).connect(dest); o.start(t); o.stop(t + 0.9); });
    this._burst(dest, t, 0.03, 4000, 0.15 * k, 'highpass');
  }
  /** a horse's whinny: a bright, shaking voice that rises then falls */
  _neigh(dest, t) {
    const c = this.ctx, d = 1.0 + Math.random() * 0.5, f = 520 + Math.random() * 220;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 0.9, t); o.frequency.linearRampToValueAtTime(f * 1.5, t + d * 0.25); o.frequency.linearRampToValueAtTime(f * 1.2, t + d * 0.6); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + d);
    const vib = c.createOscillator(); vib.frequency.value = 16 + Math.random() * 6; const vg = c.createGain(); vg.gain.value = f * 0.07; vib.connect(vg).connect(o.frequency);
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 1150; f1.Q.value = 3;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2500; f2.Q.value = 4;
    const og = c.createGain(); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.5, t + 0.06); og.gain.setValueAtTime(0.45, t + d * 0.7); og.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(f1).connect(og); o.connect(f2).connect(og); og.connect(dest);
    o.start(t); vib.start(t); o.stop(t + d + 0.05); vib.stop(t + d + 0.05);
    this._burst(dest, t + d * 0.9, 0.35, 900, 0.15, 'bandpass', 0.7);   // the snort at the end
  }
  /** men shouting (a few voices at once) */
  _shout(dest, t) {
    const c = this.ctx;
    for (let v = 0; v < 3; v++) {
      const tt = t + v * 0.07, d = 0.45 + Math.random() * 0.4, o = c.createOscillator(); o.type = 'sawtooth';
      const f = 140 + Math.random() * 70; o.frequency.setValueAtTime(f, tt); o.frequency.linearRampToValueAtTime(f * 1.25, tt + d * 0.3); o.frequency.linearRampToValueAtTime(f * 0.9, tt + d);
      const og = c.createGain(); og.gain.setValueAtTime(0, tt); og.gain.linearRampToValueAtTime(0.16, tt + 0.05); og.gain.exponentialRampToValueAtTime(0.001, tt + d);
      [[700, 6], [1150, 7], [2600, 8]].forEach(([fr, q]) => { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr * (0.9 + Math.random() * 0.2); bp.Q.value = q; o.connect(bp).connect(og); });
      og.connect(dest); o.start(tt); o.stop(tt + d + 0.05);
    }
  }
  _horn(dest, t) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), og = c.createGain(), hf = c.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.setValueAtTime(98, t); o.frequency.linearRampToValueAtTime(110, t + 0.5); o2.frequency.setValueAtTime(147.5, t);
    hf.type = 'lowpass'; hf.frequency.value = 900;
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.22, t + 0.6); og.gain.setValueAtTime(0.22, t + 2.2); og.gain.linearRampToValueAtTime(0, t + 3.4);
    const o2g = c.createGain(); o2g.gain.value = 0.5; o2.connect(o2g).connect(hf); o.connect(hf).connect(og).connect(dest);
    o.start(t); o2.start(t); o.stop(t + 3.5); o2.stop(t + 3.5);
  }
  /** duck the army under the narrator (0..1) */
  armyDuck(k, sec = 0.8) { if (this.army) this._ramp(this.army.duck.gain, k, sec); }
  armyStop(sec = 6) {
    const A = this.army; if (!A) return;
    this._ramp(A.duck.gain, 0, sec);
    setTimeout(() => { A.stopped = true; clearTimeout(A.timer); A.nodes.forEach((n) => { try { n.stop(); } catch (e) {} }); }, sec * 1000 + 300);
    this.army = null;
  }
  /** a deep "whoosh" as the steam swallows us */
  swallow(sec = 4) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const n = this._noise(2), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(90, t + sec);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + sec * 0.35); g.gain.linearRampToValueAtTime(0, t + sec);
    n.connect(f).connect(g).connect(this.ambGain); n.start(t); n.stop(t + sec + 0.1);
  }

  fadeAll(sec) { if (this.ctx) { this.setBirds(false); this.setWind(false, sec); this.roomTone(0, sec); this.potStop(sec); } }
}
