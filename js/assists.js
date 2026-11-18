// Sistema de assistências (estilo jogos de corrida): presets + ajustes finos + bônus de XP
import { Save } from './save.js';

// campos controlados pelas assistências
// hitHelp 0-3: janela/alcance da batida | autoAim 0-2: mira corrigida pra dentro
// autoMove 0-2: corrida automática | autoHit: bate sozinho | speed: velocidade do jogo
// aiLevel -1/0/1: força dos adversários | outWarn: avisa peteca que vai sair
// landing / aimMarker: anéis | lookAssist: câmera | autoJump: pulo automático
export const PRESETS = {
  nenhuma: { label: 'Nenhuma', icon: '🔥', desc: 'Peteca pura. Sem anéis, sem ajuda. Bônus máximo de XP.',
    hitHelp: 0, autoAim: 0, autoMove: 0, autoHit: false, speed: 1, aiLevel: 0, outWarn: false, landing: false, aimMarker: false, lookAssist: 0, autoJump: false },
  leve: { label: 'Leve', icon: '🎯', desc: 'Só os indicadores visuais. Pra quem já pegou o jeito.',
    hitHelp: 0, autoAim: 0, autoMove: 0, autoHit: false, speed: 1, aiLevel: 0, outWarn: false, landing: true, aimMarker: true, lookAssist: -1, autoJump: true },
  media: { label: 'Média', icon: '🤝', desc: 'Batida mais fácil, mira corrigida e aviso de bola fora.',
    hitHelp: 1, autoAim: 1, autoMove: 0, autoHit: false, speed: 1, aiLevel: 0, outWarn: true, landing: true, aimMarker: true, lookAssist: -1, autoJump: true },
  alta: { label: 'Alta', icon: '🛟', desc: 'Corre junto com você, mira sempre dentro, jogo um pouco mais lento.',
    hitHelp: 2, autoAim: 2, autoMove: 1, autoHit: false, speed: 0.85, aiLevel: 0, outWarn: true, landing: true, aimMarker: true, lookAssist: 0.55, autoJump: true },
  maxima: { label: 'Máxima', icon: '👶', desc: 'O jogo corre e bate por você. Você só mira e curte.',
    hitHelp: 3, autoAim: 2, autoMove: 2, autoHit: true, speed: 0.72, aiLevel: -1, outWarn: true, landing: true, aimMarker: true, lookAssist: 0.7, autoJump: true },
};
export const PRESET_ORDER = ['nenhuma', 'leve', 'media', 'alta', 'maxima'];
const KEYS = ['hitHelp', 'autoAim', 'autoMove', 'autoHit', 'speed', 'aiLevel', 'outWarn', 'landing', 'aimMarker', 'lookAssist', 'autoJump'];

export function applyPreset(id) {
  const p = PRESETS[id]; if (!p) return;
  const s = Save.data.settings;
  for (const k of KEYS) s[k] = p[k];
  s.assistPreset = id;
  Save.persist();
}

// depois de mudar um ajuste fino, descobre se ainda bate com algum preset
export function detectPreset() {
  const s = Save.data.settings;
  for (const id of PRESET_ORDER) {
    const p = PRESETS[id];
    if (KEYS.every(k => String(p[k]) === String(s[k]))) { s.assistPreset = id; return id; }
  }
  s.assistPreset = 'custom';
  return 'custom';
}

export function ensureAssists() {
  const s = Save.data.settings;
  if (!s.assistPreset) applyPreset('nenhuma'); // padrão: tudo desligado
}

export function A() { return Save.data.settings; }

// quanto menos ajuda, mais XP (incentiva evoluir)
export function xpMultiplier() {
  const s = Save.data.settings;
  let m = 1.0;
  m -= s.hitHelp * 0.05;
  m -= s.autoAim * 0.04;
  m -= s.autoMove * 0.06;
  if (s.autoHit) m -= 0.12;
  m -= (1 - s.speed) * 0.6;
  m += s.aiLevel * 0.15;
  if (!s.landing) m += 0.06;
  if (!s.aimMarker) m += 0.04;
  if (!s.outWarn) m += 0.03;
  if (!s.autoJump) m += 0.02;
  return Math.round(Math.min(1.5, Math.max(0.5, m)) * 100) / 100;
}

export function adjustStats(stats) {
  const lvl = Save.data.settings.aiLevel || 0;
  if (!lvl) return { ...stats };
  const out = {};
  for (const k in stats) out[k] = Math.min(1, Math.max(0.03, stats[k] + (lvl < 0 ? -0.2 : 0.1)));
  return out;
}

// parâmetros derivados do nível de ajuda na batida
export function hitParams() {
  const h = Save.data.settings.hitHelp || 0;
  return {
    window: [0.24, 0.3, 0.36, 0.44][h],
    reach: [1, 1.15, 1.3, 1.45][h],
    boost: [0, 0.18, 0.32, 0.45][h],
    netErrors: h === 0,
  };
}
