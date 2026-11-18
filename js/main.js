// PETECAÇO — bootstrap, menus, torneios, recompensas
import * as THREE from '../lib/three.module.min.js';
import { OPPONENTS, TOURNAMENTS, ROUND_NAMES, FILLER_NAMES, FORMATS, SKINS, WRISTBANDS, ACHIEVEMENTS, ARENAS, getOpponent, xpForLevel } from './data.js';
import { Save } from './save.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { Character } from './character.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const loadbar = $('.loadbar i');
const setLoad = (p) => { loadbar.style.width = (p * 100) + '%'; };

Save.load();
const S = Save.data;
const ui = new UI();
const canvas = $('#c');
const input = new Input(canvas);
if (input.isTouch) document.body.classList.add('touch');
input.haptics = S.settings.haptics;

// ---------- renderer ----------
const lowQ = S.settings.quality === 'low';
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowQ && !input.isTouch ? true : !lowQ && devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
function pixelRatio() {
  const q = S.settings.quality === 'auto' ? (input.isTouch ? 'medium' : 'high') : S.settings.quality;
  const cap = q === 'high' ? 2 : q === 'medium' ? 1.5 : 1;
  return Math.min(devicePixelRatio || 1, cap);
}
function resize() {
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(innerWidth, innerHeight, false);
  game.camera.aspect = innerWidth / innerHeight;
  game.camera.updateProjectionMatrix();
  game.applyFov();
  checkRotate();
}

const game = new Game(renderer, ui, input);
Audio.setVolumes(S.settings.sfx, S.settings.music);

// ---------- retratos 3D dos adversários ----------
function renderPortraits() {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#445577', 1.6));
  const key = new THREE.DirectionalLight('#fff3e0', 2.6); key.position.set(1.5, 2.5, 3); scene.add(key);
  const rim = new THREE.DirectionalLight('#7fb2ff', 1.8); rim.position.set(-2, 2, -2); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
  const size = 256;
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const px = new Uint8Array(size * size * 4);
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const out = {};
  const bgCols = ['#2b6cff', '#1fbf6a', '#ff7a2f', '#a051ff'];
  for (const o of OPPONENTS) {
    const ch = new Character(o.look);
    ch.mood = 'ready';
    for (let i = 0; i < 20; i++) ch.update(1 / 30, { faceYaw: 0.35, look: new THREE.Vector3(0.4, 1.6, 3) });
    scene.add(ch.root);
    const H = o.look.height || 1;
    const headY = 1.55 * H;
    cam.position.set(0.55, headY + 0.08, 1.75);
    cam.lookAt(0, headY - 0.12, 0);
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
    renderer.setRenderTarget(null);
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    const grad = g.createLinearGradient(0, 0, 0, size);
    const c = bgCols[o.tier] || '#ffcc33';
    grad.addColorStop(0, c); grad.addColorStop(1, '#0b1430');
    g.fillStyle = grad; g.fillRect(0, 0, size, size);
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = size;
    tmp.getContext('2d').putImageData(img, 0, 0);
    g.drawImage(tmp, 0, 0);
    out[o.id] = cv.toDataURL('image/png');
    scene.remove(ch.root);
  }
  renderer.setClearColor(0x000000, 1);
  rt.dispose();
  return out;
}

// ---------- utilidades de perfil ----------
function iaraUnlocked() { return S.trophies.profissional > 0; }
function refreshTop() {
  $('#m-level').textContent = S.level;
  $('#m-name').textContent = S.name;
  $('#m-xp').style.width = (S.xp / xpForLevel(S.level) * 100) + '%';
  $('#m-coins').textContent = S.coins;
  $$('.coins-val').forEach(e => e.textContent = S.coins);
  const tro = [];
  if (S.trophies.iniciante) tro.push('🥉'.repeat(Math.min(3, S.trophies.iniciante)));
  if (S.trophies.amador) tro.push('🥈'.repeat(Math.min(3, S.trophies.amador)));
  if (S.trophies.profissional) tro.push('🥇'.repeat(Math.min(3, S.trophies.profissional)));
  $('#m-trophies').textContent = tro.join(' ');
  // próximo objetivo
  let goal;
  if (!S.stats.matches) goal = 'Comece com um <b>amistoso contra o Tio Juca</b> ou faça o <b>Treino</b>.';
  else if (!S.trophies.iniciante) goal = 'Próximo objetivo: <b>vencer a Copa Iniciante 🥉</b>';
  else if (!S.trophies.amador) goal = 'Próximo objetivo: <b>vencer o Circuito Amador 🥈</b>';
  else if (!S.trophies.profissional) goal = 'Próximo objetivo: <b>vencer a Liga Profissional 🥇</b> e desbloquear a lenda secreta';
  else if (!S.achievements.beat_iara) goal = '🌟 Desafio final: <b>derrote Iara, a Mão de Ouro</b>';
  else goal = 'Você é uma lenda! Tente <b>colecionar todas as petecas</b> e conquistas.';
  const cheapest = SKINS.filter(s => !S.ownedSkins.includes(s.id) && !s.unlock).sort((a, b) => a.price - b.price)[0];
  if (cheapest && S.stats.matches) goal += `<br><small class="muted">Faltam <b>${Math.max(0, cheapest.price - S.coins)}</b> moedas pra peteca ${cheapest.name}</small>`;
  if (S.stats.streak >= 2) goal += `<br><small>🔥 Sequência: <b>${S.stats.streak}</b> vitórias</small>`;
  $('#m-goal').innerHTML = goal;
}

function stars(n) { return '★'.repeat(Math.floor(n)) + (n % 1 ? '½' : '') + '☆'.repeat(5 - Math.ceil(n)); }

// ---------- navegação ----------
function goMenu() {
  ui.stack = [];
  ui.show('menu', false);
  refreshTop();
  input.showTouch(false);
  $('#lockhint').classList.remove('on');
  if (game.mode !== 'demo') game.startDemo(pickDemoArena());
  Audio.music(true);
}
function pickDemoArena() { const a = ['praia', 'praca', 'ginasio']; return a[Math.floor(Math.random() * a.length)]; }

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) {
    Audio.init(); Audio.ui('click');
    const id = go.dataset.go;
    if (id === 'practice') { startPractice(); return; }
    if (id === 'opponents') buildOpponents();
    if (id === 'tournaments') buildTournaments();
    if (id === 'profile') buildProfile('skins');
    if (id === 'settings') buildSettings();
    ui.show(id);
    return;
  }
  if (e.target.closest('[data-back]')) {
    Audio.ui('click');
    if (fromPause) { fromPause = false; ui.hideAll(); $('#pause').classList.add('show'); return; }
    const prev = ui.back();
    if (prev === 'menu') refreshTop();
    return;
  }
  if (e.target.closest('[data-back-menu]')) { Audio.ui('click'); tour = null; goMenu(); }
});
document.addEventListener('pointerdown', () => Audio.init(), { once: false });
document.addEventListener('mouseover', (e) => { if (e.target.closest('.btn, .ocard, .item, .chip')) Audio.ui('hover'); });

// ---------- adversários ----------
let selOpp = 'juca', selArena = null, selFormat = S.settings.format || 'rapida';
function buildOpponents() {
  const grid = $('#opp-grid');
  const tiers = ['INICIANTE', 'AMADOR', 'PROFISSIONAL', 'LENDA'];
  let html = '';
  for (let t = 0; t < 4; t++) {
    const list = OPPONENTS.filter(o => o.tier === t);
    html += `<div class="tier-label">${tiers[t]}</div>`;
    for (const o of list) {
      const locked = o.secret && !iaraUnlocked();
      const rec = S.record[o.id];
      html += `<div class="ocard ${o.id === selOpp ? 'sel' : ''} ${locked ? 'locked' : ''}" data-opp="${o.id}">
        <img src="${ui.portraits[o.id]}" alt="">
        ${rec ? `<div class="orec">${rec.w}V ${rec.l}D</div>` : ''}
        <div class="oname">${locked ? '???' : o.name}</div><div class="ostars">${stars(o.stars)}</div></div>`;
    }
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.ocard').forEach(c => c.onclick = () => { selOpp = c.dataset.opp; selArena = null; Audio.ui('click'); buildOpponents(); });
  buildOppDetail();
}
function buildOppDetail() {
  const o = getOpponent(selOpp);
  const locked = o.secret && !iaraUnlocked();
  const d = $('#opp-detail');
  if (locked) {
    d.innerHTML = `<div class="od-head"><img src="${ui.portraits[o.id]}" style="filter:brightness(0)"><div><div class="od-name">???</div><div class="od-nick">Lenda secreta</div></div></div>
      <p class="od-quote">Dizem que existe alguém que nunca perdeu um ponto...</p><p><b>🔒 Vença a Liga Profissional para desbloquear.</b></p>`;
    return;
  }
  const arena = selArena || o.arena;
  const st = o.stats;
  const bar = (label, v) => `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.round(v * 100)}%"></i></div></div>`;
  const rec = S.record[o.id];
  d.innerHTML = `<div class="od-head"><img src="${ui.portraits[o.id]}"><div><div class="od-nick">${o.nick}</div><div class="od-name">${o.name}</div><div style="color:var(--yellow)">${stars(o.stars)}</div></div></div>
    <div class="od-quote">“${o.quote}”</div>
    ${bar('Velocidade', st.speed)}${bar('Reflexo', st.reaction)}${bar('Força', st.power)}${bar('Precisão', st.accuracy)}${bar('Regularidade', st.consistency)}${bar('Malícia', st.tricky)}
    ${rec ? `<div class="od-label">Seu retrospecto: <b style="color:#fff">${rec.w} vitórias • ${rec.l} derrotas</b></div>` : ''}
    <div class="od-label">Cenário</div>
    <div class="chips" id="arena-chips">${Object.values(ARENAS).map(a => `<button class="chip ${a.id === arena ? 'on' : ''}" data-arena="${a.id}">${a.name}</button>`).join('')}</div>
    <div class="od-label">Duração</div>
    <div class="chips" id="fmt-chips">${Object.entries(FORMATS).map(([k, f]) => `<button class="chip ${k === selFormat ? 'on' : ''}" data-fmt="${k}">${f.label}</button>`).join('')}</div>
    <button class="btn primary xl" id="play-opp">🤚 JOGAR</button>`;
  d.querySelectorAll('[data-arena]').forEach(b => b.onclick = () => { selArena = b.dataset.arena; Audio.ui('click'); buildOppDetail(); });
  d.querySelectorAll('[data-fmt]').forEach(b => b.onclick = () => { selFormat = b.dataset.fmt; S.settings.format = selFormat; Save.persist(); Audio.ui('click'); buildOppDetail(); });
  $('#play-opp').onclick = () => { Audio.ui('click'); startFriendly(o.id, arena, selFormat); };
}

// ---------- partidas ----------
let lastMatchCfg = null;
function launch(cfg) {
  lastMatchCfg = cfg;
  ui.hideAll();
  Audio.init();
  Audio.music(false);
  input.showTouch(true);
  game.startMatch(cfg);
  if (!input.isTouch) { input.requestLock(); }
  setTimeout(() => updateLockHint(), 400);
}
function startFriendly(oppId, arena, format) {
  launch({ opponentId: oppId, arena, mode: 'friendly', format, onEnd: (r) => onMatchEnd(r) });
}
function startPractice() {
  launch({ opponentId: 'juca', arena: 'praca', mode: 'practice', format: 'rapida', roundLabel: 'TREINO LIVRE', onEnd: () => goMenu() });
}

// ---------- torneios ----------
let tour = null;
function buildTournaments() {
  const g = $('#tour-grid');
  g.innerHTML = TOURNAMENTS.map(t => {
    const won = S.trophies[t.id] || 0;
    return `<div class="tcard" style="--tc:${t.color}">
      ${won ? `<div class="ttroph">${t.icon} x${won}</div>` : ''}
      <div class="ticon">${t.icon}</div>
      <h3>${t.name}</h3>
      <p>${t.desc}</p>
      <p>📍 ${ARENAS[t.arena].name}</p>
      <div class="tfaces">${t.opponents.map(id => `<img src="${ui.portraits[id]}" title="${getOpponent(id).name}">`).join('')}</div>
      <div class="tprize">Prêmio: <span style="color:var(--green)">+${t.reward.xp} XP</span> • <span class="coin">●</span> ${t.reward.coins}</div>
      <button class="btn ${t.id === 'profissional' ? 'gold' : 'primary'}" data-tour="${t.id}">INSCREVER-SE</button>
    </div>`;
  }).join('');
  g.querySelectorAll('[data-tour]').forEach(b => b.onclick = () => { Audio.ui('click'); startTournament(b.dataset.tour); });
}
function startTournament(id) {
  const t = TOURNAMENTS.find(x => x.id === id);
  const fill = FILLER_NAMES.slice().sort(() => Math.random() - 0.5);
  // chave de 8: [você vs opp0] [opp1 vs f] [opp2 vs f] [f vs f]
  const P = (name, oppId, you) => ({ name, oppId, you: !!you });
  const qf = [[P(S.name, null, true), P(getOpponent(t.opponents[0]).name, t.opponents[0])],
    [P(getOpponent(t.opponents[1]).name, t.opponents[1]), P(fill[0])],
    [P(getOpponent(t.opponents[2]).name, t.opponents[2]), P(fill[1])],
    [P(fill[2]), P(fill[3])]];
  tour = { t, round: 0, rounds: [qf, [], []], results: [[], [], []], done: false, champion: false };
  showBracket();
}
function simulateOthers(round) {
  const R = tour.rounds[round];
  R.forEach((m, i) => {
    if (m[0].you || m[1].you) return;
    // adversário "de verdade" sempre avança contra figurantes
    const w = m[0].oppId && !m[1].oppId ? 0 : m[1].oppId && !m[0].oppId ? 1 : Math.random() < 0.5 ? 0 : 1;
    const a = 11, b = 3 + Math.floor(Math.random() * 7);
    tour.results[round][i] = { w, score: w === 0 ? `${a}-${b}` : `${b}-${a}` };
  });
}
function advanceRound(round) {
  const R = tour.rounds[round];
  const winners = R.map((m, i) => m[tour.results[round][i].w]);
  const next = [];
  for (let i = 0; i < winners.length; i += 2) next.push([winners[i], winners[i + 1]]);
  // garante que o jogador enfrente o adversário da vez
  if (round + 1 < 3) {
    const want = tour.t.opponents[round + 1];
    const mine = next.find(m => m[0].you || m[1].you);
    if (mine) {
      const oppSlot = mine[0].you ? 1 : 0;
      if (mine[oppSlot].oppId !== want) {
        // troca com quem for o adversário esperado
        for (const m of next) for (let k = 0; k < 2; k++) if (m[k].oppId === want) { const tmp = m[k]; m[k] = mine[oppSlot]; mine[oppSlot] = tmp; }
      }
    }
  }
  tour.rounds[round + 1] = next;
}
function showBracket() {
  const t = tour.t;
  $('#br-title').textContent = `${t.icon} ${t.name}`;
  const cols = ROUND_NAMES.map((rn, r) => {
    const R = tour.rounds[r] || [];
    const matches = R.length ? R.map((m, i) => {
      const res = tour.results[r][i];
      const me = m[0].you || m[1].you;
      const next = me && r === tour.round && !res && !tour.done;
      const row = (p, k) => `<div class="bp ${res ? (res.w === k ? 'w' : 'l') : ''} ${p.you ? 'you' : ''}"><span>${p.you ? '⭐ ' : ''}${p.name}</span><span>${res ? res.score.split('-')[k] : ''}</span></div>`;
      return `<div class="bmatch ${me ? 'me' : ''} ${next ? 'next' : ''}">${row(m[0], 0)}${row(m[1], 1)}</div>`;
    }).join('') : `<div class="bmatch"><div class="bp">—</div><div class="bp">—</div></div>`.repeat(r === 1 ? 2 : 1);
    return `<div class="bcol"><h4>${rn}</h4>${matches}</div>`;
  }).join('');
  let extra = '';
  if (tour.done) extra = tour.champion ? `<div class="champion">🏆 CAMPEÃO! ${t.icon}</div>` : `<div class="champion" style="color:var(--muted)">Eliminado na ${ROUND_NAMES[tour.round]}</div>`;
  $('#br-body').innerHTML = cols + extra;
  const act = $('#br-actions');
  if (tour.done) {
    act.innerHTML = `<button class="btn primary" id="br-again">JOGAR DE NOVO</button><button class="btn ghost" id="br-menu">MENU</button>`;
    $('#br-again').onclick = () => { Audio.ui('click'); startTournament(t.id); };
    $('#br-menu').onclick = () => { Audio.ui('click'); tour = null; goMenu(); };
  } else {
    const oppId = t.opponents[tour.round];
    const o = getOpponent(oppId);
    act.innerHTML = `<button class="btn ${tour.round === 2 ? 'gold' : 'primary'} xl" id="br-play">${tour.round === 2 ? '🏆 JOGAR A FINAL' : '🤚 JOGAR'} vs ${o.name}</button>`;
    $('#br-play').onclick = () => { Audio.ui('click'); playTourMatch(); };
  }
  ui.stack = ['menu'];
  ui.show('bracket', false);
}
function playTourMatch() {
  const t = tour.t;
  const oppId = t.opponents[tour.round];
  const format = tour.round === 2 ? 'padrao' : 'rapida';
  launch({ opponentId: oppId, arena: t.arena, mode: 'tournament', format, roundLabel: `${t.short.toUpperCase()} • ${ROUND_NAMES[tour.round].toUpperCase()}`, onEnd: (r) => onMatchEnd(r) });
}

// ---------- fim de partida: recompensas ----------
function onMatchEnd(r) {
  const cfg = lastMatchCfg;
  const o = r.opponent;
  const st = r.stats;
  const tier = o.tier;
  S.stats.matches++;
  S.stats.perfects += st.perfects; S.stats.smashes += st.smashes; S.stats.aces += st.aces; S.stats.points += st.pointsWon;
  S.stats.longestRally = Math.max(S.stats.longestRally, st.longestRally);
  const rec = S.record[o.id] || (S.record[o.id] = { w: 0, l: 0 });
  const newAch = [];
  const ach = (id) => { const a = Save.unlock(id); if (a) newAch.push(a); };
  if (r.won) {
    S.stats.wins++; rec.w++; S.stats.streak++; S.stats.bestStreak = Math.max(S.stats.bestStreak, S.stats.streak);
    ach('first_win');
    if (S.stats.streak >= 3) ach('streak3');
    if (o.id === 'ze') ach('beat_ze');
    if (o.id === 'iara') ach('beat_iara');
  } else { S.stats.losses++; rec.l++; S.stats.streak = 0; }
  if (st.perfects >= 10) ach('perfect10');
  if (S.stats.smashes >= 25) ach('smash25');
  if (st.perfects >= 3 && game.onFire) ach('fire');
  game.onFire = false;
  // XP e moedas
  let xp = 40 + st.pointsWon * 8 + st.perfects * 4 + st.smashes * 6 + st.longestRally * 2 + st.aces * 10;
  let coins = 10 + st.pointsWon * 2 + Math.floor(st.perfects / 2);
  if (r.won) { xp += 120 * (tier + 1); coins += 40 * (tier + 1); }
  let tourMsg = null;
  // torneio
  if (cfg.mode === 'tournament' && tour) {
    const R = tour.rounds[tour.round];
    const mi = R.findIndex(m => m[0].you || m[1].you);
    const youK = R[mi][0].you ? 0 : 1;
    const setStr = r.setScores.length === 1 ? r.setScores[0] : r.sets;
    const a = setStr[0], b = setStr[1];
    tour.results[tour.round][mi] = { w: r.won ? youK : 1 - youK, score: youK === 0 ? `${a}-${b}` : `${b}-${a}` };
    simulateOthers(tour.round);
    if (r.won) {
      if (tour.round === 2) {
        tour.done = true; tour.champion = true;
        S.trophies[tour.t.id] = (S.trophies[tour.t.id] || 0) + 1;
        xp += tour.t.reward.xp; coins += tour.t.reward.coins;
        ach('cup_' + tour.t.id);
        tourMsg = `🏆 CAMPEÃO DO ${tour.t.name.toUpperCase()}!`;
        if (tour.t.id === 'profissional' && S.trophies.profissional === 1) tourMsg += ' Uma lenda secreta foi desbloqueada...';
      } else { advanceRound(tour.round); tour.round++; }
    } else { tour.done = true; }
  }
  const startLevel = S.level, startXP = S.xp;
  S.coins += coins;
  const levels = Save.addXP(xp);
  if (S.level >= 10) ach('level10');
  if (o.id === 'iara' && r.won && !S.ownedSkins.includes('ouro')) { S.ownedSkins.push('ouro'); newAch.push({ icon: '🪶', name: 'Peteca Ouro Lendário', desc: 'Desbloqueada na Coleção!' }); }
  Save.persist();
  showResult(r, { xp, coins, levels, startLevel, startXP, newAch, tourMsg });
}

function showResult(r, rw) {
  const o = r.opponent;
  ui.show('result', false);
  input.showTouch(false);
  const won = r.won;
  const t = $('#res-title');
  t.textContent = won ? (rw.tourMsg && tour && tour.champion ? 'CAMPEÃO!' : 'VITÓRIA!') : 'DERROTA';
  t.className = 'res-title' + (won ? '' : ' lose');
  $('#res-sub').innerHTML = rw.tourMsg || (won ? `Você venceu ${o.name}!` : `${o.name} levou essa. Revanche?`);
  const sets = r.setScores.map(s => `${s[0]}-${s[1]}`).join('  •  ');
  $('#res-vs').innerHTML = `<div style="text-align:center"><div class="sets">${r.sets[0]} × ${r.sets[1]}</div><div class="setlist">${sets}</div></div><img src="${ui.portraits[o.id]}">`;
  const st = r.stats;
  const box = (v, l) => `<div class="sbox"><b>${v}</b><span>${l}</span></div>`;
  $('#res-stats').innerHTML = box(st.perfects, 'Perfeitas') + box(st.smashes, 'Cortadas') + box(st.longestRally, 'Maior rali') + box(st.winners, 'Pontos diretos') + box(r.accuracy + '%', 'Qualidade') + box(st.aces, 'Aces');
  // animação XP
  const lvlEl = $('#res-level'), bar = $('#res-xp'), gain = $('#res-xpgain'), coinEl = $('#res-coins');
  lvlEl.textContent = rw.startLevel;
  bar.style.transition = 'none'; bar.style.width = (rw.startXP / xpForLevel(rw.startLevel) * 100) + '%';
  gain.textContent = '+0 XP'; coinEl.textContent = '+0';
  const achEl = $('#res-ach'); achEl.innerHTML = '';
  let lvl = rw.startLevel, cur = rw.startXP, left = rw.xp, shown = 0, coinShown = 0;
  const step = () => {
    if (ui.current !== 'result') return;
    const need = xpForLevel(lvl);
    const inc = Math.max(4, Math.ceil(rw.xp / 70));
    const d = Math.min(inc, left, need - cur);
    cur += d; left -= d; shown += d;
    if (cur >= need) {
      lvl++; cur = 0; lvlEl.textContent = lvl; Audio.ui('levelup');
      const lu = document.createElement('div'); lu.className = 'lvlup'; lu.textContent = `⬆️ NÍVEL ${lvl}!`; achEl.prepend(lu);
    }
    bar.style.transition = 'width 0.05s linear';
    bar.style.width = (cur / xpForLevel(lvl) * 100) + '%';
    gain.textContent = `+${shown} XP`;
    if (coinShown < rw.coins) { coinShown = Math.min(rw.coins, coinShown + Math.max(1, Math.ceil(rw.coins / 40))); coinEl.textContent = '+' + coinShown; if (coinShown % 5 === 0) Audio.ui('coin'); }
    if (left > 0 || coinShown < rw.coins) setTimeout(step, 28);
    else {
      rw.newAch.forEach((a, i) => setTimeout(() => { const e = document.createElement('div'); e.className = 'ra'; e.innerHTML = `<span style="font-size:24px">${a.icon}</span><div>${a.name}<br><small class="muted">${a.desc}</small></div>`; achEl.appendChild(e); Audio.ui('achieve'); }, i * 350));
    }
  };
  setTimeout(() => { Audio.ui(won ? 'win' : 'lose'); step(); }, 500);
  // ações
  const act = $('#res-actions');
  const cfg = lastMatchCfg;
  if (cfg.mode === 'tournament' && tour) {
    act.innerHTML = `<button class="btn ${won && !tour.done ? 'primary' : 'gold'} xl" id="ra-next">${tour.done ? 'VER CHAVE' : 'PRÓXIMA FASE ›'}</button><button class="btn ghost" id="ra-menu">MENU</button>`;
    $('#ra-next').onclick = () => { Audio.ui('click'); showBracket(); };
  } else {
    const nextOpp = nextOpponent(o);
    act.innerHTML = `<button class="btn primary xl" id="ra-again">${won ? 'JOGAR DE NOVO' : 'REVANCHE!'}</button>` +
      (won && nextOpp ? `<button class="btn gold" id="ra-up">PRÓXIMO: ${nextOpp.name} ›</button>` : '') +
      `<button class="btn ghost" id="ra-menu">MENU</button>`;
    $('#ra-again').onclick = () => { Audio.ui('click'); launch(cfg); };
    if ($('#ra-up')) $('#ra-up').onclick = () => { Audio.ui('click'); selOpp = nextOpp.id; startFriendly(nextOpp.id, nextOpp.arena, cfg.format); };
  }
  $('#ra-menu').onclick = () => { Audio.ui('click'); tour = tour && tour.done ? null : tour; goMenu(); };
  Audio.music(true);
}
function nextOpponent(o) {
  const i = OPPONENTS.findIndex(x => x.id === o.id);
  const n = OPPONENTS[i + 1];
  if (!n || (n.secret && !iaraUnlocked())) return null;
  return n;
}

// ---------- coleção ----------
function petecaHTML(s) {
  const f = s.feathers;
  const rot = [-26, -9, 9, 26];
  return `<div class="pk">${rot.map((r, i) => `<div class="f" style="background:linear-gradient(180deg, ${f[i % f.length]}, ${f[i % f.length]} 70%, rgba(0,0,0,.15));transform:translateX(-50%) rotate(${r}deg);${s.glow ? `box-shadow:0 0 12px ${f[i % f.length]}` : ''}"></div>`).join('')}<div class="b" style="background:${s.base}"></div></div>`;
}
function buildProfile(tab) {
  $$('#prof-tabs .tab').forEach(b => { b.classList.toggle('on', b.dataset.tab === tab); b.onclick = () => { Audio.ui('click'); buildProfile(b.dataset.tab); }; });
  const body = $('#prof-body');
  refreshTop();
  if (tab === 'skins' || tab === 'bands') {
    const list = tab === 'skins' ? SKINS : WRISTBANDS;
    const owned = tab === 'skins' ? S.ownedSkins : S.ownedBands;
    const eq = tab === 'skins' ? S.skin : S.band;
    body.innerHTML = list.map(s => {
      const has = owned.includes(s.id);
      const locked = !has && s.unlock;
      const tag = s.id === eq ? '<span class="itag eq">EQUIPADA</span>' : has ? '<span class="itag">EQUIPAR</span>' : locked ? '<span class="itag">🔒 SECRETA</span>' : `<span class="iprice"><span class="coin">●</span> ${s.price}</span>`;
      const vis = tab === 'skins' ? petecaHTML(s) : `<div class="band" style="background:${s.color}"></div>`;
      return `<div class="item ${s.id === eq ? 'equipped' : ''}" data-item="${s.id}">${vis}<div class="iname">${s.name}</div>${tag}</div>`;
    }).join('');
    body.querySelectorAll('[data-item]').forEach(el => el.onclick = () => {
      const s = list.find(x => x.id === el.dataset.item);
      if (owned.includes(s.id)) { if (tab === 'skins') S.skin = s.id; else S.band = s.id; Audio.ui('click'); }
      else if (s.unlock) { Audio.ui('lose'); ui.toastText('🔒', 'Peteca secreta', 'Derrote a lenda para desbloquear.'); return; }
      else if (S.coins >= s.price) { S.coins -= s.price; owned.push(s.id); if (tab === 'skins') S.skin = s.id; else S.band = s.id; Audio.ui('coin'); ui.toastText('🛍️', `${s.name} comprada!`, 'Já está equipada.'); }
      else { Audio.ui('lose'); ui.toastText('🪙', 'Moedas insuficientes', `Faltam ${s.price - S.coins}. Jogue mais uma!`); return; }
      Save.persist(); buildProfile(tab);
      if (game.peteca) game.peteca.setSkin(game.currentSkin());
    });
  } else if (tab === 'ach') {
    body.innerHTML = ACHIEVEMENTS.map(a => `<div class="item ach ${S.achievements[a.id] ? '' : 'locked'}"><div class="aic">${a.icon}</div><div><div class="iname">${a.name}</div><div class="ad">${a.desc}</div></div></div>`).join('');
  } else {
    const st = S.stats;
    const box = (v, l) => `<div class="sbox"><b>${v}</b><span>${l}</span></div>`;
    const wr = st.matches ? Math.round(st.wins / st.matches * 100) : 0;
    body.innerHTML = `<div class="stats-grid">${box(S.level, 'Nível')}${box(st.matches, 'Partidas')}${box(st.wins, 'Vitórias')}${box(wr + '%', 'Aproveitamento')}${box(st.perfects, 'Perfeitas')}${box(st.smashes, 'Cortadas')}${box(st.aces, 'Aces')}${box(st.longestRally, 'Maior rali')}${box(st.bestStreak, 'Melhor sequência')}${box(st.practiceRecord, 'Recorde no treino')}${box(Object.keys(S.achievements).length + '/' + ACHIEVEMENTS.length, 'Conquistas')}${box((S.trophies.iniciante || 0) + (S.trophies.amador || 0) + (S.trophies.profissional || 0), 'Troféus')}</div>`;
  }
}

// ---------- ajustes ----------
let fromPause = false;
function buildSettings() {
  const st = S.settings;
  const tog = (k, label, sub) => `<div class="srow"><label>${label}<small>${sub}</small></label><button class="toggle ${st[k] ? 'on' : ''}" data-tog="${k}"></button></div>`;
  const seg = (k, label, sub, opts) => `<div class="srow"><label>${label}<small>${sub}</small></label><div class="seg">${opts.map(([v, l]) => `<button class="${String(st[k]) === String(v) ? 'on' : ''}" data-seg="${k}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
  const rng = (k, label, sub, min, max, step) => `<div class="srow"><label>${label}<small>${sub}</small></label><input type="range" min="${min}" max="${max}" step="${step}" value="${st[k]}" data-rng="${k}"></div>`;
  $('#set-body').innerHTML = `
    <div class="srow"><label>Seu nome<small>Aparece no placar</small></label><input type="text" maxlength="12" id="set-name" value="${S.name.replace(/"/g, '')}"></div>
    ${rng('sens', 'Sensibilidade', 'Mouse / arrastar na tela', 0.3, 2.5, 0.05)}
    ${tog('invertY', 'Inverter eixo Y', 'Olhar pra cima/baixo invertido')}
    ${seg('lookAssist', 'Câmera assistida', 'Segue a peteca automaticamente', [[-1, 'Auto'], [0, 'Off'], [0.35, 'Leve'], [0.7, 'Forte']])}
    ${tog('landing', 'Indicador de queda', 'Anel amarelo onde a peteca vai cair')}
    ${tog('aimMarker', 'Indicador de mira', 'Anel verde onde seu golpe vai')}
    ${tog('autoJump', 'Pulo automático', 'Pula sozinho pra cortar petecas altas')}
    ${seg('quality', 'Gráficos', 'Baixe se estiver travando', [['auto', 'Auto'], ['low', 'Baixo'], ['medium', 'Médio'], ['high', 'Alto']])}
    ${rng('music', 'Música', 'Samba do menu', 0, 1, 0.05)}
    ${rng('sfx', 'Efeitos', 'Batidas, torcida, apito', 0, 1, 0.05)}
    ${tog('haptics', 'Vibração', 'No celular, a cada batida')}
    <div class="srow"><label>Apagar progresso<small>Começa do zero (não tem volta!)</small></label><button class="btn small ghost" id="set-reset">APAGAR</button></div>`;
  const body = $('#set-body');
  body.querySelectorAll('[data-tog]').forEach(b => b.onclick = () => { const k = b.dataset.tog; st[k] = !st[k]; Audio.ui('click'); Save.persist(); input.haptics = st.haptics; buildSettings(); });
  body.querySelectorAll('[data-seg]').forEach(b => b.onclick = () => {
    const k = b.dataset.seg; let v = b.dataset.v; if (!isNaN(parseFloat(v)) && k !== 'quality') v = parseFloat(v);
    st[k] = v; Audio.ui('click'); Save.persist(); buildSettings();
    if (k === 'quality') { resize(); if (game.mode === 'demo') { game.arena = null; game.startDemo(pickDemoArena()); } }
  });
  body.querySelectorAll('[data-rng]').forEach(r => r.oninput = () => { st[r.dataset.rng] = parseFloat(r.value); Audio.setVolumes(st.sfx, st.music); Save.persist(); });
  $('#set-name').oninput = (e) => { S.name = e.target.value.trim() || 'Você'; Save.persist(); };
  $('#set-reset').onclick = () => { if (confirm('Apagar todo o progresso?')) { Save.reset(); location.reload(); } };
}

// ---------- pausa / pointer lock ----------
function pause() {
  if (game.mode !== 'match' || game.phase === 'end' || game.paused) return;
  game.paused = true;
  input.enabled = false;
  input.exitLock();
  $('#pause').classList.add('show');
  input.showTouch(false);
}
function resume() {
  $('#pause').classList.remove('show');
  ui.hideAll();
  game.paused = false;
  input.enabled = true;
  input.showTouch(true);
  if (!input.isTouch) input.requestLock();
}
input.onPause = pause;
$('#pausebtn').onclick = () => { Audio.ui('click'); pause(); };
$('#p-resume').onclick = () => { Audio.ui('click'); resume(); };
$('#p-settings').onclick = () => { Audio.ui('click'); fromPause = true; $('#pause').classList.remove('show'); buildSettings(); ui.show('settings', false); };
$('#p-quit').onclick = () => { Audio.ui('click'); $('#pause').classList.remove('show'); game.paused = false; game.exitMatch(); if (tour && lastMatchCfg.mode === 'tournament') { tour = null; } goMenu(); };
function updateLockHint() {
  const need = !input.isTouch && game.mode === 'match' && !game.paused && game.phase !== 'end' && !input.locked;
  $('#lockhint').classList.toggle('on', need && game.phase !== 'intro');
}
input.onLockChange = (locked) => {
  if (!locked && game.mode === 'match' && !game.paused && game.phase !== 'end' && game.phase !== 'intro') pause();
  updateLockHint();
};
canvas.addEventListener('click', () => { if (game.mode === 'match' && !input.locked && !game.paused && !input.isTouch) input.requestLock(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------- rotação no celular ----------
let rotOk = false;
function checkRotate() {
  const portrait = input.isTouch && innerHeight > innerWidth * 1.1;
  $('#rotate').classList.toggle('on', portrait && !rotOk && game.mode === 'match');
}
$('#rot-ok').onclick = () => { rotOk = true; checkRotate(); };
addEventListener('resize', resize);

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const realDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (window.__noRender) return;
  game.update(realDt, realDt);
  game.render();
  $('#speedlines').classList.toggle('on', !!(game.player && game.player.dashT > 0 && game.mode === 'match'));
}

// ---------- inicialização ----------
async function boot() {
  setLoad(0.15);
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) { /* ok */ }
  setLoad(0.35);
  await new Promise(r => setTimeout(r, 30));
  ui.portraits = renderPortraits();
  setLoad(0.7);
  await new Promise(r => setTimeout(r, 30));
  game.startDemo('praia');
  resize();
  setLoad(1);
  requestAnimationFrame(frame);
  setTimeout(() => { goMenu(); }, 250);
}
boot();

// ganchos de depuração/teste
window.__petecaco = {
  game, Save, ui, startFriendly, startPractice, startTournament, goMenu, launch, showBracket: () => showBracket(),
  // avança a simulação sem renderizar (testes automatizados)
  sim(seconds, onStep) { const n = Math.round(seconds * 60); for (let i = 0; i < n; i++) { if (onStep) onStep(game); game.update(1 / 60, 1 / 60); } },
};
