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
    this.pot = { pan, g, pops, boil: 0.5, level: 0 };
    const pop = () => {
      const P = this.pot; if (!P) return;
      if (P.level > 0.01) {
        const t = c.currentTime, o = c.createOscillator(), og = c.createGain(); o.type = 'sine';
        const f = 260 + Math.random() * 700; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.04);
        og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.05 * P.level, t + 0.005); og.gain.exponentialRampToValueAtTime(0.0003, t + 0.07);
        o.connect(og).connect(P.pops); o.start(t); o.stop(t + 0.09);
      }
      this._potT = setTimeout(pop, 60 + Math.random() * 500 / (0.3 + P.boil * 1.5));
    };
    pop();
  }
  _setPos(pan, p) {
    if (pan.positionX) { pan.positionX.value = p.x; pan.positionY.value = p.y; pan.positionZ.value = p.z; } else pan.setPosition(p.x, p.y, p.z);
  }
  /** level 0..1 (overall loudness: the hint raises it), boil 0..1 (how hard it boils) */
  potSet(level, boil) {
    if (!this.pot) return;
    const target = 0.16 * level * (0.4 + 0.6 * boil);
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

  fadeAll(sec) { if (this.ctx) { this.setBirds(false); this.setWind(false, sec); this.roomTone(0, sec); this.potStop(sec); } }
}
