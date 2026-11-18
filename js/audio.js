// Áudio 100% sintetizado com WebAudio — batidas, torcida, apito e um sambinha no menu
let ctx = null, master, sfxBus, musicBus, crowdBus, noiseBuf;
let musicOn = false, musicTimer = null, nextNote = 0, step16 = 0;
let crowdSrc = null, crowdGain = null, crowdFilter = null;
let vol = { sfx: 0.9, music: 0.6 };

function makeNoise() {
  const len = ctx.sampleRate * 2;
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export const Audio = {
  get ready() { return !!ctx; },
  init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    crowdBus = ctx.createGain(); crowdBus.connect(sfxBus);
    noiseBuf = makeNoise();
    this.setVolumes(vol.sfx, vol.music);
    if (musicOn) this._startScheduler();
  },
  setVolumes(sfx, music) {
    vol.sfx = sfx; vol.music = music;
    if (!ctx) return;
    sfxBus.gain.setTargetAtTime(sfx, ctx.currentTime, 0.05);
    musicBus.gain.setTargetAtTime(music * 0.55, ctx.currentTime, 0.1);
  },

  _noise(t, dur, { type = 'bandpass', freq = 2000, q = 1, gain = 0.5, attack = 0.002, bus = sfxBus, freqEnd = null } = {}) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  },
  _tone(t, dur, { freq = 440, freqEnd = null, type = 'sine', gain = 0.3, attack = 0.003, bus = sfxBus } = {}) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  },

  // batida na peteca: tapa de mão + "tum" da base de borracha
  hit(quality = 0.6, power = 0.5, far = false) {
    if (!ctx) return; const t = ctx.currentTime;
    const v = far ? 0.45 : 1;
    this._noise(t, 0.06 + power * 0.04, { freq: 1800 + quality * 1400, q: 0.9, gain: (0.55 + power * 0.4) * v });
    this._noise(t, 0.12, { type: 'lowpass', freq: 900, q: 0.5, gain: 0.35 * v });
    this._tone(t, 0.14, { freq: 190 + power * 60, freqEnd: 70, gain: (0.5 + power * 0.3) * v, type: 'sine' });
    this._tone(t, 0.05, { freq: 620, freqEnd: 300, gain: 0.12 * v, type: 'triangle' });
  },
  perfect(combo = 1) {
    if (!ctx) return; const t = ctx.currentTime;
    const base = 880 * Math.pow(1.122, Math.min(combo - 1, 8));
    this._tone(t, 0.35, { freq: base, gain: 0.16, type: 'sine' });
    this._tone(t + 0.03, 0.35, { freq: base * 1.5, gain: 0.1, type: 'sine' });
    this._tone(t + 0.06, 0.5, { freq: base * 2, gain: 0.06, type: 'triangle' });
  },
  smash() {
    if (!ctx) return; const t = ctx.currentTime;
    this._noise(t, 0.35, { type: 'lowpass', freq: 3000, freqEnd: 200, q: 0.7, gain: 0.7 });
    this._tone(t, 0.4, { freq: 120, freqEnd: 40, gain: 0.7, type: 'sine' });
    this._tone(t, 0.15, { freq: 1400, freqEnd: 500, gain: 0.12, type: 'sawtooth' });
  },
  whoosh(strength = 0.5) {
    if (!ctx) return; const t = ctx.currentTime;
    this._noise(t, 0.22, { freq: 600, freqEnd: 2600, q: 1.4, gain: 0.12 + strength * 0.2, attack: 0.06 });
  },
  land(surface = 'hard', far = false) {
    if (!ctx) return; const t = ctx.currentTime; const v = far ? 0.5 : 1;
    if (surface === 'sand') {
      this._noise(t, 0.25, { type: 'lowpass', freq: 1200, q: 0.4, gain: 0.35 * v, attack: 0.005 });
    } else {
      this._tone(t, 0.12, { freq: 240, freqEnd: 90, gain: 0.45 * v });
      this._noise(t, 0.08, { freq: 1500, q: 1, gain: 0.25 * v });
      this._tone(t + 0.12, 0.08, { freq: 200, freqEnd: 100, gain: 0.15 * v });
    }
  },
  net() {
    if (!ctx) return; const t = ctx.currentTime;
    for (let i = 0; i < 4; i++) this._noise(t + i * 0.045, 0.09, { freq: 700 + i * 120, q: 2, gain: 0.25 / (i + 1) });
    this._tone(t, 0.2, { freq: 160, freqEnd: 90, gain: 0.25 });
  },
  whistle(long = false) {
    if (!ctx) return; const t = ctx.currentTime; const d = long ? 0.9 : 0.35;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 2900;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 28;
    const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(o.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.setValueAtTime(0.18, t + d - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(sfxBus); o.start(t); lfo.start(t); o.stop(t + d + 0.05); lfo.stop(t + d + 0.05);
  },
  beep(high = false) {
    if (!ctx) return; const t = ctx.currentTime;
    this._tone(t, high ? 0.5 : 0.18, { freq: high ? 1320 : 660, gain: 0.22, type: 'square' });
  },
  ui(kind = 'click') {
    if (!ctx) return; const t = ctx.currentTime;
    if (kind === 'click') this._tone(t, 0.07, { freq: 900, freqEnd: 1300, gain: 0.12, type: 'triangle' });
    else if (kind === 'hover') this._tone(t, 0.04, { freq: 1500, gain: 0.04, type: 'sine' });
    else if (kind === 'coin') { this._tone(t, 0.1, { freq: 1568, gain: 0.12, type: 'square' }); this._tone(t + 0.08, 0.25, { freq: 2093, gain: 0.12, type: 'square' }); }
    else if (kind === 'levelup') { [523, 659, 784, 1046].forEach((f, i) => this._tone(t + i * 0.09, 0.3, { freq: f, gain: 0.15, type: 'triangle' })); }
    else if (kind === 'achieve') { [784, 988, 1175, 1568].forEach((f, i) => this._tone(t + i * 0.07, 0.4, { freq: f, gain: 0.12, type: 'sine' })); }
    else if (kind === 'lose') { [392, 349, 311, 262].forEach((f, i) => this._tone(t + i * 0.16, 0.35, { freq: f, gain: 0.13, type: 'triangle' })); }
    else if (kind === 'win') { [523, 659, 784, 659, 784, 1046].forEach((f, i) => this._tone(t + i * 0.1, 0.35, { freq: f, gain: 0.14, type: 'square' })); }
  },

  // ---------- torcida ----------
  crowdStart(level = 0.3) {
    if (!ctx) return;
    if (!crowdSrc) {
      crowdSrc = ctx.createBufferSource(); crowdSrc.buffer = noiseBuf; crowdSrc.loop = true;
      crowdFilter = ctx.createBiquadFilter(); crowdFilter.type = 'bandpass'; crowdFilter.frequency.value = 700; crowdFilter.Q.value = 0.6;
      crowdGain = ctx.createGain(); crowdGain.gain.value = 0;
      crowdSrc.connect(crowdFilter); crowdFilter.connect(crowdGain); crowdGain.connect(crowdBus);
      crowdSrc.start();
    }
    this.crowdLevel(level);
  },
  crowdLevel(level) {
    if (!ctx || !crowdGain) return;
    crowdGain.gain.setTargetAtTime(0.05 + level * 0.12, ctx.currentTime, 0.4);
  },
  crowdStop() {
    if (!ctx || !crowdGain) return;
    crowdGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  },
  cheer(intensity = 1, sad = false) {
    if (!ctx) return; const t = ctx.currentTime;
    if (sad) {
      this._noise(t, 1.4, { freq: 500, freqEnd: 250, q: 0.8, gain: 0.25 * intensity, attack: 0.15 });
      return;
    }
    this._noise(t, 1.8 + intensity, { freq: 900, freqEnd: 600, q: 0.5, gain: 0.35 * intensity, attack: 0.12 });
    this._noise(t + 0.1, 1.5, { freq: 2200, q: 1.5, gain: 0.12 * intensity, attack: 0.2 });
    // palmas
    const n = Math.floor(10 + intensity * 25);
    for (let i = 0; i < n; i++) this._noise(t + 0.15 + Math.random() * (1.2 + intensity), 0.03, { freq: 1500 + Math.random() * 1500, q: 1.2, gain: 0.05 + Math.random() * 0.06 });
  },
  ooh() {
    if (!ctx) return; const t = ctx.currentTime;
    this._noise(t, 1.0, { freq: 400, freqEnd: 650, q: 3, gain: 0.25, attack: 0.2 });
  },

  // ---------- música (samba procedural) ----------
  music(on) {
    musicOn = on;
    if (!ctx) return;
    if (on) this._startScheduler(); else this._stopScheduler();
  },
  _startScheduler() {
    if (musicTimer) return;
    nextNote = ctx.currentTime + 0.1; step16 = 0;
    musicTimer = setInterval(() => this._schedule(), 25);
  },
  _stopScheduler() { clearInterval(musicTimer); musicTimer = null; },
  _schedule() {
    const bpm = 104, s16 = 60 / bpm / 4;
    while (nextNote < ctx.currentTime + 0.12) {
      this._playStep(step16 % 32, nextNote);
      nextNote += s16; step16++;
    }
  },
  _playStep(s, t) {
    const b = musicBus;
    const st = s % 16;
    // surdo: marcação no 2 (grave) e resposta no 1
    if (st === 0) this._tone(t, 0.35, { freq: 95, freqEnd: 55, gain: 0.35, bus: b });
    if (st === 8) this._tone(t, 0.5, { freq: 75, freqEnd: 42, gain: 0.55, bus: b });
    if (st === 14 && s >= 16) this._tone(t, 0.2, { freq: 80, freqEnd: 50, gain: 0.25, bus: b });
    // chocalho em semicolcheias
    this._noise(t, 0.04, { type: 'highpass', freq: 6000, q: 0.5, gain: (st % 4 === 2 ? 0.09 : 0.04), bus: b });
    // tamborim (teleco-teco)
    const tam = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0];
    if (tam[st]) this._tone(t, 0.05, { freq: 1100, freqEnd: 900, type: 'triangle', gain: 0.08, bus: b });
    // agogô
    const ag = { 0: 988, 3: 740, 6: 988, 10: 740, 12: 988 };
    if (s >= 16 && ag[st]) this._tone(t, 0.18, { freq: ag[st], type: 'sine', gain: 0.06, bus: b });
    // cavaquinho/baixo simples
    const chord = Math.floor(s / 8) % 4;
    const roots = [146.8, 196, 164.8, 220];
    if (st % 8 === 0) {
      this._tone(t, 0.3, { freq: roots[chord] / 2, type: 'triangle', gain: 0.12, bus: b });
    }
    if (st % 4 === 2) {
      const r = roots[chord];
      [1, 1.26, 1.5].forEach(m => this._tone(t, 0.09, { freq: r * m * 2, type: 'square', gain: 0.018, bus: b }));
    }
  },
};
