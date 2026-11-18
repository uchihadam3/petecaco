// Persistência do perfil (localStorage com fallback em memória)
import { xpForLevel, ACHIEVEMENTS } from './data.js';

const KEY = 'petecaco_save_v1';

function defaults() {
  return {
    name: 'Você',
    xp: 0, level: 1, coins: 0,
    skin: 'classica', ownedSkins: ['classica'],
    band: 'branca', ownedBands: ['branca'],
    stats: { matches: 0, wins: 0, losses: 0, perfects: 0, smashes: 0, longestRally: 0, aces: 0, points: 0, streak: 0, bestStreak: 0, practiceRecord: 0 },
    trophies: { iniciante: 0, amador: 0, profissional: 0 },
    record: {},
    achievements: {},
    settings: {
      sens: 1.0, invertY: false, quality: 'auto', music: 0.6, sfx: 0.9,
      landing: true, aimMarker: true, lookAssist: -1, autoJump: true, format: 'rapida', haptics: true, orientation: 'landscape',
    },
    tutorialSeen: false,
  };
}

function merge(base, data) {
  for (const k in data) {
    if (data[k] && typeof data[k] === 'object' && !Array.isArray(data[k]) && base[k] && typeof base[k] === 'object') merge(base[k], data[k]);
    else base[k] = data[k];
  }
  return base;
}

export const Save = {
  data: defaults(),
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = merge(defaults(), JSON.parse(raw));
    } catch (e) { /* sem storage */ }
    return this.data;
  },
  persist() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  },
  reset() { this.data = defaults(); this.persist(); },
  addXP(amount) {
    const d = this.data; const levels = [];
    d.xp += amount;
    while (d.xp >= xpForLevel(d.level)) { d.xp -= xpForLevel(d.level); d.level++; levels.push(d.level); }
    return levels;
  },
  unlock(id) {
    if (this.data.achievements[id]) return null;
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return null;
    this.data.achievements[id] = Date.now();
    return a;
  },
};
