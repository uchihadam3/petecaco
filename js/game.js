// Núcleo do jogo: partida, regras, golpes, câmera, efeitos
import * as THREE from '../lib/three.module.min.js';
import { COURT, getOpponent, SKINS, FORMATS, WRISTBANDS } from './data.js';
import { advance, simulate, planShot, isInside, DT } from './physics.js';
import { buildArena } from './world.js';
import { Character } from './character.js';
import { Peteca } from './peteca.js';
import { Player, EYE } from './player.js';
import { AI } from './ai.js';
import { FX } from './fx.js';
import { Audio } from './audio.js';
import { Save } from './save.js';
import { hitParams, adjustStats } from './assists.js';

const clamp = THREE.MathUtils.clamp;
const rand = Math.random;
const pickOne = (a) => a[Math.floor(rand() * a.length)];
const smooth = (t) => t * t * (3 - 2 * t);

const PLAYER_LOOK = { skin: '#d9a273', hair: 'short', hairColor: '#2b1a10', shirt: '#1e88e5', shorts: '#0d2b52', shoes: '#ffffff', height: 1 };

export class Game {
  constructor(renderer, ui, input) {
    this.renderer = renderer;
    this.ui = ui;
    this.input = input;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.04, 900);
    this.scene.add(this.camera);
    this.time = 0;
    this.mode = 'none';
    this.timeScale = 1; this.hitstop = 0; this.slowT = 0;
    this.ball = { x: 0, y: 1, z: 5, vx: 0, vy: 0, vz: 0, netHit: false };
    this.ballMode = 'held';
    this.acc = 0;
    this.arena = null;
    this.fx = null;
    this.excite = 0.2;
    this.trajId = 0; this.trajStart = 0; this.rallyTime = 0;
    this.pred = null;
    this.cine = null;
    this.paused = false;
  }

  // ------------------------------------------------------------
  quality() {
    const q = Save.data.settings.quality;
    if (q !== 'auto') return q;
    return this.input.isTouch ? 'medium' : 'high';
  }

  loadArena(id) {
    if (this.arena && this.arena.id === id && this.arenaQ === this.quality()) return;
    if (this.arena) {
      this.scene.remove(this.arena.group);
      this.arena.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } });
    }
    this.arenaQ = this.quality();
    this.arena = buildArena(id, this.arenaQ);
    this.scene.add(this.arena.group);
    this.scene.fog = this.arena.fog;
    this.scene.background = this.arena.bg || null;
    this.renderer.shadowMap.enabled = this.arenaQ !== 'low';
    if (!this.fx) this.fx = new FX(this.scene);
    if (!this.peteca) this.peteca = new Peteca(this.scene, this.currentSkin());
    // reconstrói FX/peteca acima da arena (ordem)
    this.scene.remove(this.fx.mesh); this.scene.add(this.fx.mesh);
  }

  currentSkin() { return SKINS.find(s => s.id === Save.data.skin) || SKINS[0]; }

  clearAgents() {
    for (const c of [this.oppChar, this.demoChar]) if (c) this.scene.remove(c.root);
    this.oppChar = null; this.demoChar = null; this.ai = null; this.ai2 = null;
  }

  // ------------------------------------------------------------
  // MENU: demonstração IA x IA com câmera orbitando
  startDemo(arenaId = 'praia') {
    this.mode = 'demo';
    this.loadArena(arenaId);
    this.clearAgents();
    if (this.player) this.player.hands.visible = false;
    const a = pickOne(OPP_DEMO), b = pickOne(OPP_DEMO.filter(x => x !== a));
    const oa = getOpponent(a), ob = getOpponent(b);
    this.oppChar = new Character(oa.look); this.scene.add(this.oppChar.root);
    this.demoChar = new Character(ob.look); this.scene.add(this.demoChar.root);
    this.oppChar.root.position.set(0, 0, -5); this.demoChar.root.position.set(0, 0, 5);
    this.ai = new AI(this.oppChar, { ...oa.stats, consistency: Math.max(0.85, oa.stats.consistency), speed: Math.max(0.7, oa.stats.speed) }, -1);
    this.ai2 = new AI(this.demoChar, { ...ob.stats, consistency: Math.max(0.85, ob.stats.consistency), speed: Math.max(0.7, ob.stats.speed) }, 1);
    this.ai2.yaw = Math.PI; this.demoChar.yaw = Math.PI;
    this.match = null;
    this.server = -1;
    this.phase = 'serve';
    this.ai.beginServe(this);
    this.camT = 0;
    Audio.crowdStart(0.2);
  }

  agentPos(side) {
    if (side > 0) return this.mode === 'demo' ? this.demoChar.root.position : this.player.pos;
    return this.oppChar.root.position;
  }

  // ------------------------------------------------------------
  // PARTIDA
  startMatch(cfg) {
    // cfg: {opponentId, arena, mode:'friendly'|'tournament'|'practice', format, roundLabel, onEnd}
    this.cfg = cfg;
    this.mode = 'match';
    // limpa qualquer resto da partida anterior (câmera da comemoração, golpes pendentes...)
    this.cine = null; this.lineCam = null; this.hitBuf = null; this.serveFired = null; this.tossing = null;
    this.pendingSet = null; this.setShown = false; this.pendingCall = null; this.countdown = false;
    this.paused = false; this.hitstop = 0; this.slowT = 0; this.lastHitter = 0; this.pred = null;
    const opp = getOpponent(cfg.opponentId);
    this.opp = opp;
    this.loadArena(cfg.arena || opp.arena);
    this.clearAgents();
    this.oppChar = new Character(opp.look);
    this.scene.add(this.oppChar.root);
    this.oppChar.root.position.set(0, 0, -5);
    const practice = cfg.mode === 'practice';
    this.ai = new AI(this.oppChar, practice ? opp.stats : adjustStats(opp.stats), -1, { practice });
    const S = Save.data;
    const band = (WRISTBANDS.find(w => w.id === S.band) || WRISTBANDS[0]).color;
    if (!this.player) this.player = new Player(this.camera, { ...PLAYER_LOOK, band });
    this.player.setBand(band);
    this.player.hands.visible = true;
    this.player.pos.set(0, 0, 5.5); this.player.yaw = 0; this.player.pitch = 0.05;
    this.peteca.setSkin(this.currentSkin());
    const fmt = FORMATS[cfg.format] || FORMATS.rapida;
    this.match = {
      fmt, practice,
      points: [0, 0], sets: [0, 0], setScores: [],
      maxDeficit: [0, 0],
      stats: { perfects: 0, smashes: 0, winners: 0, errors: 0, hits: 0, longestRally: 0, aces: 0, pointsWon: 0, quality: 0 },
      rally: 0, combo: 0, fire: false, practiceRecord: 0,
      over: false, winner: 0,
    };
    this.server = practice ? -1 : (rand() < 0.5 ? 1 : -1);
    this.phase = 'intro';
    this.introT = 0;
    this.ui.hud.show(true);
    this.ui.hud.setNames(Save.data.name, opp, practice);
    this.ui.hud.setScore(this.match, this.server);
    this.updateBoard();
    this.ui.hud.introCard(opp, cfg.roundLabel || (practice ? 'TREINO LIVRE' : 'AMISTOSO'), this.arenaName());
    this.input.enabled = true;
    Audio.music(false);
    Audio.crowdStart(0.3);
    this.fx.clear();
    this.peteca.resetTrail();
    this.holdBall(new THREE.Vector3(0, 1.1, -4.6));
    this.ballMode = 'held';
    this.excite = 0.25;
    this.oppChar.setMood('wave');
    this.camera.fov = 72; this.applyFov();
  }

  arenaName() { return ({ praca: 'Praça do Bairro', praia: 'Praia do Pôr do Sol', ginasio: 'Arena Petecaço' })[this.arena.id]; }

  updateBoard() {
    if (!this.arena || !this.arena.score || !this.match) return;
    const m = this.match;
    this.arena.score.draw({ a: Save.data.name || 'VOCÊ', b: this.opp.name, pa: m.points[0], pb: m.points[1], sa: m.sets[0], sb: m.sets[1], title: m.practice ? 'TREINO' : 'PETECAÇO' });
  }

  holdBall(p) {
    this.ballMode = 'held';
    this.ball.x = p.x; this.ball.y = p.y; this.ball.z = p.z;
    this.ball.vx = this.ball.vy = this.ball.vz = 0; this.ball.netHit = false;
  }

  setupServe() {
    const m = this.match;
    this.phase = 'serve';
    this.lastHitter = 0;
    this.fx && this.peteca.resetTrail();
    this.peteca.hideMarker(); this.peteca.hideAim();
    m.rally = 0;
    this.rallySmash = false; this.rallyServeOnly = true;
    if (this.server > 0) {
      // jogador saca: fica no fundo
      this.player.pos.set(clamp(this.player.pos.x, -2, 2) * 0.3, 0, 6.6);
      this.player.locked = true;
      this.player.holding = true;
      this.serveMeter = 0; this.serveDir = 1;
      this.ui.hud.serveMeter(true);
      this.ui.hud.hint(this.input.isTouch ? 'Mire arrastando a tela e toque BATER quando a barra estiver no AMARELO  •  CURTA = saque curtinho' : 'Mire com o mouse e clique quando a barra estiver no AMARELO  •  E = saque curtinho');
      this.ai.moveTo.set(0, 0, -5.2);
    } else {
      this.player.locked = false;
      this.player.holding = false;
      this.ai.beginServe(this);
      this.ui.hud.hint(null);
      if (!m.practice) this.player.pos.set(this.player.pos.x * 0.5, 0, Math.max(this.player.pos.z, 4.8));
    }
    this.ui.hud.setScore(m, this.server);
  }

  // ------------------------------------------------------------
  // golpe genérico (jogador ou IA)
  performHit(side, shot) {
    const b = this.ball;
    const from = { x: b.x, y: b.y, z: b.z };
    if (this.ballMode === 'held') { from.y = Math.max(from.y, 0.6); }
    let angles, clearance = 0.2, maxSpeed = 36;
    const q = shot.quality ?? 0.6;
    const pm = shot.powerMul ?? 1;
    const fire = side > 0 && this.match && this.match.fire;
    switch (shot.type) {
      case 'drive': angles = [4, 7, 10, 13, 16, 19, 22, 26, 30, 35, 40, 46, 52]; clearance = 0.12 + (1 - q) * 0.45; maxSpeed = 30 * pm * (fire ? 1.12 : 1); break;
      case 'clear': angles = [24, 28, 32, 36, 40, 45, 50, 55]; clearance = 0.5; maxSpeed = 30 * pm; break;
      case 'lob': angles = [56, 60, 52, 64, 48, 68]; clearance = 0.8; maxSpeed = 34; break;
      case 'drop': angles = [32, 38, 44, 50, 56, 62, 68]; clearance = 0.08 + (1 - q) * 0.3; maxSpeed = 22; break;
      case 'smash': angles = [-32, -28, -24, -20, -16, -12, -8, -4, 0, 4, 8, 12, 16]; clearance = 0.08; maxSpeed = 44 * pm * (fire ? 1.12 : 1); break;
      case 'serve': angles = [38, 42, 46, 50, 34, 55]; clearance = 0.5; maxSpeed = 30; break;
      case 'serve_low': angles = [20, 24, 28, 32, 36, 42]; clearance = 0.12; maxSpeed = 24; break;
      default: angles = [20, 30, 40, 50];
    }
    let sol = planShot(from, shot.target, { angles, clearance, maxSpeed });
    if (!sol || !sol.ok) {
      // contato baixo/colado na rede: levanta a peteca
      const alt = planShot(from, shot.target, { angles: [56, 60, 64, 68, 72, 76, 80], clearance: 0.1, maxSpeed: 34 });
      if (alt && (alt.ok || !sol)) sol = alt;
    }
    if (!sol) return;
    let vx = sol.vx, vy = sol.vy, vz = sol.vz;
    if (shot.netError) { vx *= 0.78; vy *= 0.6; vz *= 0.78; }
    b.x = from.x; b.y = from.y; b.z = from.z;
    b.vx = vx; b.vy = vy; b.vz = vz; b.netHit = false;
    this.ballMode = 'flight';
    if (this.phase === 'serve') { this.phase = 'rally'; this.rallyTime = 0; if (this.mode === 'match') { this.player.locked = false; this.player.holding = false; this.ui.hud.serveMeter(false); this.ui.hud.hint(null); } }
    this.lastHitter = side;
    this.lastShot = { side, type: shot.type, speed: sol.speed, q, serve: !!shot.serve };
    if (!shot.serve) this.rallyServeOnly = false;
    this.newTrajectory();
    const m = this.match;
    if (m) { m.rally++; }
    // feedback
    const contact = new THREE.Vector3(from.x, from.y, from.z);
    const power = clamp(sol.speed / 40, 0, 1);
    const near = side > 0 && this.mode === 'match';
    const far = !near;
    const dir = new THREE.Vector3(vx, 0, vz).normalize();
    const skin = this.currentSkin();
    const smashy = shot.type === 'smash' && sol.speed > 24 && sol.angle <= 4;
    if (near) {
      const perfect = q >= 0.78;
      this.hitstop = perfect ? 0.085 : q > 0.45 ? 0.05 : 0.03;
      if (smashy) { this.hitstop = 0.11; this.slowT = 0.35; }
      this.player.shake += 0.4 + power * 0.8 + (perfect ? 0.4 : 0);
      this.player.fovKick += smashy ? -6 : -2.5;
      Audio.hit(q, power);
      if (perfect) Audio.perfect(m ? m.combo + 1 : 1);
      if (smashy) Audio.smash();
      this.fx.hitBurst(contact, q, skin.feathers.concat([skin.base]), dir, power, 0.45);
      this.fx.ring(contact, this.camera, perfect ? '#ffd24a' : '#ffffff', perfect ? 0.3 : 0.2, 0.2);
      if (m) {
        m.stats.hits++;
        m.stats.quality += q;
        if (perfect) { m.stats.perfects++; m.combo++; } else m.combo = 0;
        if (smashy) m.stats.smashes++;
        const wasFire = m.fire;
        m.fire = m.combo >= 3;
        if (m.fire && !wasFire) { this.ui.hud.fire(true); Audio.cheer(0.8); this.arena.crowd && this.arena.crowd.cheer(0.7); this.onFire = true; }
        if (!m.fire && wasFire) this.ui.hud.fire(false);
        this.peteca.fire = m.fire;
        const label = smashy ? 'CORTADA!' : perfect ? 'PERFEITO!' : q > 0.45 ? 'BOM' : 'FRACO';
        this.ui.hud.popup(label, perfect ? 'perfect' : q > 0.45 ? 'good' : 'weak', m.combo, smashy);
        if (navigator.vibrate && Save.data.settings.haptics && this.input.isTouch) navigator.vibrate(perfect ? [15, 20, 25] : 12);
      }
    } else {
      Audio.hit(q, power, this.mode === 'match');
      if (smashy) Audio.smash();
      this.fx.hitBurst(contact, q * 0.6, skin.feathers, dir, power);
      if (smashy) { this.fx.ring(contact, this.camera, '#ff9a6a', 1.6); if (this.mode === 'match') { this.player.shake += 0.25; this.ui.hud.popup('CORTADA DELE!', 'enemy', 0, true); } }
    }
    if (smashy) { this.rallySmash = side; this.arena.flash && this.arena.flash(); }
    this.excite = Math.min(1, this.excite + 0.04 + (smashy ? 0.2 : 0));
    if (m && m.rally > 6) Audio.crowdLevel(Math.min(1, 0.3 + m.rally * 0.04));
  }

  onSave(side) {
    if (this.mode !== 'match') return;
    this.ui.hud.popup(side < 0 ? 'QUE DEFESA!' : 'SALVOU!', 'enemy');
    Audio.ooh(); this.arena.crowd && this.arena.crowd.cheer(0.5);
  }

  newTrajectory() {
    this.trajId++;
    this.trajStart = this.rallyTime;
    this.pred = simulate(this.ball, 6, DT, 2);
  }

  // ------------------------------------------------------------
  update(dt, realDt) {
    this.time += realDt;
    if (this.paused) return;
    // hitstop / slow-motion
    let simDt = dt;
    if (this.mode === 'match') simDt *= Save.data.settings.speed || 1;
    if (this.hitstop > 0) { this.hitstop -= realDt; simDt = 0; }
    else if (this.slowT > 0) { this.slowT -= realDt; simDt = dt * 0.3; }
    const t = this.time;

    if (this.mode === 'demo') this.updateDemo(simDt, realDt);
    else if (this.mode === 'match') this.updateMatch(simDt, realDt);

    // peteca visual
    if (this.peteca) {
      const mode = this.ballMode === 'held' ? 'held' : this.ballMode;
      this.peteca.update(simDt || realDt * 0.0001, this.ball, mode, this.camera);
      if (this.peteca.fire && this.ballMode === 'flight' && this.lastHitter > 0) this.fx.fireEmbers(this.ball);
    }
    if (this.arena) this.arena.update(realDt, t, this.excite);
    if (this.arena && this.arena.ref) {
      const r = this.arena.ref;
      r.update(realDt, { faceYaw: r.yaw, look: new THREE.Vector3(this.ball.x, this.ball.y, this.ball.z) });
    }
    if (this.fx) this.fx.update(simDt > 0 ? simDt : realDt * 0.15, this.camera);
    this.excite = Math.max(0.15, this.excite - realDt * 0.03);
  }

  stepBall(simDt) {
    if (this.ballMode !== 'flight') return null;
    this.acc += simDt;
    let ev = null;
    while (this.acc >= DT) {
      this.acc -= DT;
      this.rallyTime += DT;
      const e = advance(this.ball, DT);
      if (e === 'net' || e === 'cord') {
        this.arena.net.hit(this.ball.x, this.ball.y, e === 'cord' ? 0.6 : 1);
        Audio.net();
        if (e === 'cord' && this.mode === 'match') this.ui.hud.popup('FITA!', 'enemy');
        this.newTrajectory();
      }
      if (e === 'ground') { ev = 'ground'; this.ballMode = 'landed'; break; }
    }
    return ev;
  }

  updateDemo(simDt, realDt) {
    const ev = this.stepBall(simDt);
    if (this.phase === 'serve' || this.phase === 'rally') {
      this.ai.update(simDt, this); this.ai2.update(simDt, this);
    }
    if (ev === 'ground') {
      const b = this.ball;
      Audio.land(this.arena.surface, true);
      this.fx.dustPuff(b.x, b.z, this.arena.surface === 'sand' ? '#e3c08a' : '#cccccc', 5);
      this.phase = 'point'; this.pointT = 0;
      const winner = this.resolveLanding().winner;
      this.server = winner;
      const wc = winner < 0 ? this.ai : this.ai2, lc = winner < 0 ? this.ai2 : this.ai;
      wc.char.setMood(rand() < 0.5 ? 'celebrate' : 'fist'); lc.char.setMood('shrug');
      this.arena.crowd && this.arena.crowd.cheer(0.6);
    }
    if (this.phase === 'point') {
      this.pointT += realDt;
      this.ai.char.update(realDt, { faceYaw: this.ai.baseYaw, look: this.ball });
      this.ai2.char.update(realDt, { faceYaw: this.ai2.baseYaw, look: this.ball });
      if (this.pointT > 2.2) {
        this.phase = 'serve';
        this.ai.char.setMood('ready'); this.ai2.char.setMood('ready');
        (this.server < 0 ? this.ai : this.ai2).beginServe(this);
      }
    }
    // câmera orbitando
    this.camT += realDt;
    const a = this.camT * 0.08 + 0.6;
    const R = 15 + Math.sin(this.camT * 0.13) * 3;
    const cam = this.camera;
    cam.position.set(Math.sin(a) * R, 4.2 + Math.sin(this.camT * 0.2) * 1.5, Math.cos(a) * R * 1.05);
    cam.lookAt(this.ball.x * 0.3, 1.8, this.ball.z * 0.3);
  }

  resolveLanding() {
    const b = this.ball;
    const side = b.z > 0 ? 1 : -1;
    const hitter = this.lastHitter || this.server;
    let winner, reason;
    const inside = isInside(b.x, b.z);
    const lineCall = inside && (Math.abs(Math.abs(b.x) - COURT.halfW) < 0.08 || Math.abs(Math.abs(b.z) - COURT.halfL) < 0.08);
    if (side === hitter) { winner = -hitter; reason = b.netHit ? 'NA REDE!' : 'NÃO PASSOU!'; }
    else if (inside) { winner = hitter; reason = lineCall ? 'NA LINHA!' : (this.lastShot && this.lastShot.type === 'smash' && this.lastShot.speed > 24 ? 'CORTADA FATAL!' : 'NO CHÃO!'); }
    else { winner = -hitter; reason = 'FORA!'; }
    return { winner, reason, inside, lineCall, side };
  }

  // ------------------------------------------------------------
  updateMatch(simDt, realDt) {
    const P = this.player, m = this.match;
    const inp = this.input.poll();
    const sens = 0.0022 * Save.data.settings.sens * (this.input.isTouch ? 0.9 : 1);
    if (this.phase !== 'intro' && this.phase !== 'end') P.look(inp.look.x * sens, inp.look.y * sens * (Save.data.settings.invertY ? -1 : 1));

    // ações
    for (const a of inp.actions) this.handleAction(a, inp.move);


    // saque do jogador: medidor
    if (this.phase === 'serve' && this.server > 0 && !this.serveFired) {
      this.serveMeter += realDt * 1.25 * this.serveDir;
      if (this.serveMeter > 1) { this.serveMeter = 1; this.serveDir = -1; }
      if (this.serveMeter < 0) { this.serveMeter = 0; this.serveDir = 1; }
      this.ui.hud.serveValue(this.serveMeter);
      this.holdBall(P.leftHandWorld());
    }
    if (this.serveFired) {
      this.serveFired.t += realDt;
      if (this.serveFired.t >= 0.2 && !this.serveFired.done) {
        this.serveFired.done = true;
        const sf = this.serveFired;
        P.strike(new THREE.Vector3(this.ball.x, this.ball.y, this.ball.z), true);
        this.performHit(1, { type: sf.type, target: sf.target, quality: sf.q, powerMul: 1, serve: true });
        this.serveFired = null;
      }
    }
    if (this.tossing) {
      // peteca subindo da mão no saque
      this.tossing.t += simDt;
      const tt = this.tossing.t;
      this.ball.x = this.tossing.p.x + 0.1 * tt; this.ball.z = this.tossing.p.z - 0.3 * tt;
      this.ball.y = this.tossing.p.y + 2.2 * tt - 5 * tt * tt;
      if (!this.serveFired) this.tossing = null;
    }

    // física
    const ev = this.stepBall(simDt);

    // buffer de golpe do jogador
    this.updatePlayerHit(realDt);

    P.ready = this.ballMode === 'flight' && this.lastHitter < 0;
    const move = this.autoMove(inp.move);
    this.autoHit();
    if (this.phase !== 'intro' && this.phase !== 'end') P.update(simDt, realDt, move);
    if (this.phase !== 'end') this.ai.update(simDt, this);
    if (this.phase === 'intro') this.updateIntro(realDt);

    // assistência de câmera
    let assist = this.lineCam ? 0 : Save.data.settings.lookAssist;
    if (assist < 0) assist = this.input.isTouch ? 0.55 : 0.18;
    if (this.ballMode === 'flight' && (this.lastHitter < 0 || this.ball.z > 0) && this.phase === 'rally') P.assistLook(this.ball, assist, realDt);
    if (this.phase === 'end' || this.phase === 'intro') {/* câmera cinemática controla */ }

    // marcadores
    this.updateMarkers();

    if (ev === 'ground') this.onLand();
    if (this.phase === 'point') this.updatePoint(realDt);
    if (this.phase === 'end') this.updateEnd(realDt);
    if (this.lineCam) this.applyLineCam(realDt);
    if (this.cine) this.applyCine(realDt);
    this.ui.hud.dash(P.dashCd);
  }

  handleAction(a, move) {
    const P = this.player;
    if (this.phase === 'intro' || this.phase === 'end' || this.phase === 'point') return;
    if (a === 'jump') { if (P.jump()) Audio.whoosh(0.2); return; }
    if (a === 'dash') { if (P.dash(move.x, move.y)) Audio.whoosh(0.6); return; }
    if (a === 'hit' || a === 'lob' || a === 'drop') {
      if (this.phase === 'serve' && this.server > 0 && !this.serveFired) {
        // saque
        const v = this.serveMeter;
        const q = clamp(1 - Math.abs(v - 0.5) * 2.2, 0, 1);
        const target = this.aimTarget(a === 'drop' ? 'serve_low' : 'serve', q);
        const type = a === 'drop' ? 'serve_low' : 'serve';
        this.serveFired = { t: 0, type, target, q };
        this.tossing = { t: 0, p: { x: this.ball.x, y: this.ball.y, z: this.ball.z } };
        P.holding = false;
        P.startWindup('under');
        this.ui.hud.serveMeter(false);
        const label = q > 0.8 ? 'SAQUE PERFEITO!' : q > 0.45 ? 'BOM SAQUE' : 'SAQUE FRACO';
        this.ui.hud.popup(label, q > 0.8 ? 'perfect' : q > 0.45 ? 'good' : 'weak');
        return;
      }
      if (this.phase === 'rally') {
        P.startWindup(this.ball.y < 1.0 ? 'under' : 'normal');
        this.hitBuf = { t: 0, type: a, bestQ: -1, prevQ: -1 };
        Audio.whoosh(0.25);
        // pulo automático pra cortar
        if (Save.data.settings.autoJump && !P.airborne && a === 'hit' && this.ballMode === 'flight' && this.lastHitter < 0) {
          const r = P.reach({ x: this.ball.x, y: Math.min(this.ball.y, 2.4), z: this.ball.z }, hitParams().reach);
          if (r && this.ball.y > 2.35 && this.ball.y < 3.4) P.jump();
        }
      }
    }
  }

  updatePlayerHit(realDt) {
    const buf = this.hitBuf;
    if (!buf) return;
    buf.t += realDt;
    const P = this.player;
    const b = this.ball;
    const can = this.ballMode === 'flight' && this.lastHitter !== 1 && b.z > 0.05 && !(b.netHit && this.lastHitter === -1 && b.z > 0 && false);
    const hp = hitParams();
    let r = can ? P.reach(b, hp.reach) : null;
    const boost = (q) => q + (1 - q) * hp.boost;
    // no buffer: espera o melhor momento (pico de qualidade)
    if (r) {
      const falling = b.y < 0.5 && b.vy < 0;
      if (r.q < buf.prevQ - 0.005 || buf.t > hp.window || falling || r.q > 0.9) { this.doPlayerHit(buf.type, boost(Math.max(r.q, buf.prevQ * 0.98))); this.hitBuf = null; return; }
      buf.prevQ = r.q;
    } else if (buf.prevQ >= 0) {
      // saiu do alcance: bate com o que tinha
      this.doPlayerHit(buf.type, boost(buf.prevQ * 0.85)); this.hitBuf = null; return;
    }
    if (buf.t > hp.window + 0.02) { this.hitBuf = null; P.whiff(); }
  }

  // ponto de mira sem erro (usado também pelo anel verde)
  aimPoint(type) {
    const P = this.player;
    let yawOff = P.yaw; while (yawOff > Math.PI) yawOff -= Math.PI * 2; while (yawOff < -Math.PI) yawOff += Math.PI * 2;
    yawOff = clamp(yawOff, -1.1, 1.1);
    let depth;
    if (type === 'drop' || type === 'serve_low') depth = 1.9;
    else if (type === 'lob') depth = 6.6;
    else if (type === 'smash') depth = 4.2 + (1 - clamp(P.pitch + 0.6, 0, 1)) * 1.4;
    else depth = 5.9;
    const dz = this.ball.z + depth;
    let tx = this.ball.x * 0.25 + Math.tan(-yawOff) * dz * 0.9;
    tx = clamp(tx, -COURT.halfW - 0.9, COURT.halfW + 0.9);
    const aa = Save.data.settings.autoAim || 0;
    if (aa >= 1) tx = clamp(tx, -COURT.halfW + (aa >= 2 ? 0.6 : 0.35), COURT.halfW - (aa >= 2 ? 0.6 : 0.35));
    return { x: tx, z: -depth };
  }

  aimTarget(type, q) {
    const a = this.aimPoint(type);
    const aa = Save.data.settings.autoAim || 0;
    // espalhamento por qualidade (menor com mira assistida)
    const err = (1 - q) * 1.5 * [1, 0.55, 0.3][aa];
    let tx = a.x + (rand() - 0.5) * err * 1.4;
    let tz = a.z + (rand() - 0.5) * err;
    if ((this.match && this.match.fire) || aa >= 1) tx = clamp(tx, -COURT.halfW + 0.2, COURT.halfW - 0.2);
    if (aa >= 1) tz = clamp(tz, -COURT.halfL + 0.35, -1.2);
    return { x: tx, z: Math.min(-0.8, tz) };
  }

  // corrida automática até onde a peteca vai chegar
  autoMove(move) {
    const lvl = Save.data.settings.autoMove || 0;
    const P = this.player, b = this.ball;
    if (!lvl || this.phase !== 'rally' || P.locked) return move;
    let tx = null, tz = null;
    if (this.ballMode === 'flight' && this.lastHitter < 0 && this.pred) {
      const now = this.rallyTime - this.trajStart;
      let pt = null;
      for (const p of this.pred.pts) { if (p.t > now && p.z > 0.4 && p.y < 1.75 && p.vy < 0) { pt = p; break; } }
      if (!pt) return move;
      if (Math.abs(this.pred.landing.x) > COURT.halfW + 0.3 || this.pred.landing.z > COURT.halfL + 0.3) {
        if (Save.data.settings.outWarn) return move; // vai sair: deixa cair
      }
      // posição ideal: peteca à frente e um pouco à direita
      const f = P.forward(new THREE.Vector3()), r = P.right(new THREE.Vector3());
      tx = pt.x - f.x * 0.6 - r.x * 0.3; tz = pt.z - f.z * 0.6 - r.z * 0.3;
    } else if (lvl >= 2 && this.lastHitter > 0) {
      tx = clamp(this.oppChar.root.position.x * -0.2, -1.5, 1.5); tz = 5.2;
    }
    if (tx === null) return move;
    const dx = tx - P.pos.x, dz = tz - P.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.08) return move;
    // converte direção do mundo para o referencial do jogador
    const f = P.forward(new THREE.Vector3()), r = P.right(new THREE.Vector3());
    const k = Math.min(1, d / 0.6);
    const ax = (dx * r.x + dz * r.z) / d * k, ay = (dx * f.x + dz * f.z) / d * k;
    const user = Math.hypot(move.x, move.y);
    if (lvl >= 2) {
      if (user > 0.5) return move; // jogador manda
      return { x: ax, y: ay };
    }
    // leve: ímã que soma com o controle do jogador
    if (d > 3.5 && user > 0.2) return move;
    const w = user > 0.2 ? 0.45 : 0.85;
    return { x: clamp(move.x + ax * w, -1, 1), y: clamp(move.y + ay * w, -1, 1) };
  }

  autoHit() {
    if (!Save.data.settings.autoHit || this.phase !== 'rally' || this.hitBuf) return;
    if (this.ballMode !== 'flight' || this.lastHitter > 0 || this.ball.z < 0.05) return;
    const P = this.player;
    const r = P.reach(this.ball, hitParams().reach);
    if (r && (r.q > 0.55 || (this.ball.y < 0.7 && this.ball.vy < 0))) {
      P.startWindup(this.ball.y < 1.0 ? 'under' : 'normal');
      this.hitBuf = { t: 0, type: 'hit', bestQ: -1, prevQ: -1 };
    }
  }

  doPlayerHit(type, q) {
    const P = this.player, b = this.ball;
    let t = type === 'hit' ? 'drive' : type;
    if (t === 'drive' && b.y > 2.3) t = 'smash';
    if (t === 'drive' && b.y < 0.9) t = 'clear';
    const target = this.aimTarget(t, q);
    let netError = false;
    if (hitParams().netErrors && q < 0.2 && rand() < 0.35) netError = true;
    P.strike(new THREE.Vector3(b.x, b.y, b.z), b.y < 1.0);
    const powerMul = 0.92 + q * 0.18;
    this.performHit(1, { type: t, target, quality: q, powerMul, netError });
  }

  updateMarkers() {
    const pk = this.peteca, s = Save.data.settings, b = this.ball;
    // dicas de primeira partida
    if (!Save.data.tutorialSeen && this.phase === 'rally') {
      const t = this.input.isTouch;
      const where = s.landing ? 'o ANEL AMARELO' : 'a SOMBRA da peteca';
      const aimTip = s.aimMarker ? ' — o anel VERDE mostra onde sua batida vai cair' : ' — a peteca vai pra onde você está olhando';
      const msg = this.lastHitter < 0
        ? (t ? `Corra até ${where} (joystick) e toque BATER quando a peteca chegar!` : `Corra até ${where} (WASD) e CLIQUE quando a peteca chegar!`)
        : (t ? 'Arraste a tela pra mirar' + aimTip : 'Mova o mouse pra mirar' + aimTip);
      const help = ' • Achou difícil? Ligue as Assistências em Ajustes';
      if (this._tipMsg !== msg) { this._tipMsg = msg; this.ui.hud.hint(msg + help); }
      if (this.match && this.match.stats.hits >= 4) { Save.data.tutorialSeen = true; Save.persist(); this.ui.hud.hint(null); this._tipMsg = null; }
    }
    if (this.ballMode === 'flight' && this.pred && this.lastHitter < 0 && s.landing) {
      const L = this.pred.landing;
      const out = L.z > 0 && !isInside(L.x, L.z, 0.02) && !(this.pred.netEvent && this.pred.netEvent.type === 'net');
      if (L.z > 0) pk.showMarker(L.x, L.z, L.t - (this.rallyTime - this.trajStart), this.time, s.outWarn && out); else pk.hideMarker();
      this.ui.hud.outWarn(!!(s.outWarn && out && this.phase === 'rally'));
    } else { pk.hideMarker(); this.ui.hud.outWarn(false); }
    const myTurn = (this.phase === 'serve' && this.server > 0) || (this.ballMode === 'flight' && this.lastHitter < 0 && b.z > -1);
    if (myTurn && s.aimMarker) {
      const type = this.phase === 'serve' ? 'serve' : b.y > 2.3 ? 'smash' : 'drive';
      const a = this.aimPoint(type === 'smash' ? 'smash' : 'drive');
      pk.showAim(a.x, a.z, Math.abs(a.x) <= COURT.halfW, this.time);
    } else pk.hideAim();
  }

  // ------------------------------------------------------------
  onLand() {
    const m = this.match, b = this.ball;
    const res = this.resolveLanding();
    const near = b.z > 0;
    Audio.land(this.arena.surface, !near);
    this.fx.dustPuff(b.x, b.z, this.arena.surface === 'sand' ? '#e3c08a' : this.arena.surface === 'wood' ? '#d9b48a' : '#cfcfcf', 6, near ? 1 : 0.8);
    this.fx.groundRing(b.x, b.z, res.winner > 0 ? '#7dff8a' : '#ff5c5c', 0.8);
    this.hitBuf = null;
    this.peteca.hideMarker(); this.peteca.hideAim(); this.ui.hud.outWarn(false);
    this.phase = 'point'; this.pointT = 0;
    // lance de linha apertado: replay "olho de peteca"
    const dLine = Math.min(Math.abs(Math.abs(b.x) - COURT.halfW), Math.abs(Math.abs(b.z) - COURT.halfL));
    const nearLine = dLine < 0.5 && Math.abs(b.x) < COURT.halfW + 0.5 && Math.abs(b.z) < COURT.halfL + 0.5 && Math.abs(b.z) > 0.3;
    if (nearLine && !m.practice) {
      const inside = isInside(b.x, b.z, 0.04);
      const side = Math.abs(Math.abs(b.x) - COURT.halfW) < Math.abs(Math.abs(b.z) - COURT.halfL) ? 'x' : 'z';
      this.lineCam = { t: 0, x: b.x, z: b.z, inside, cm: Math.max(1, Math.round(dLine * 100)), side, shown: false };
    }
    if (m.practice) {
      const rally = m.rally;
      if (rally > m.practiceRecord) m.practiceRecord = rally;
      if (rally > Save.data.stats.practiceRecord) { Save.data.stats.practiceRecord = rally; Save.persist(); }
      this.ui.hud.banner(res.reason, `Rali de ${rally} • Recorde: ${Save.data.stats.practiceRecord}`, res.winner > 0 ? 'win' : 'lose');
      this.pointWinner = res.winner;
      this.server = -1;
      Audio.whistle();
      this.arena.ref && (this.arena.ref.whistleT = 0.6);
      return;
    }
    const wi = res.winner > 0 ? 0 : 1;
    m.points[wi]++;
    m.stats.longestRally = Math.max(m.stats.longestRally, m.rally);
    if (res.winner > 0) {
      m.stats.pointsWon++;
      if (this.lastHitter > 0) m.stats.winners++;
      if (this.rallyServeOnly && this.server > 0) { m.stats.aces++; this.achieve('ace'); }
    } else if (this.lastHitter > 0) m.stats.errors++;
    // déficit máximo para conquista de virada
    const diff = m.points[1] - m.points[0];
    m.maxDeficit[0] = Math.max(m.maxDeficit[0], diff);
    if (m.rally >= 20) this.achieve('rally20');
    if (m.rally >= 40) this.achieve('rally40');
    this.pointWinner = res.winner;
    this.server = res.winner;
    // reações
    const won = res.winner > 0;
    Audio.whistle();
    this.arena.ref && (this.arena.ref.whistleT = 0.6);
    const big = m.rally >= 10 || res.reason === 'CORTADA FATAL!' || res.lineCall;
    Audio.cheer(won ? (big ? 1.3 : 0.8) : 0.5, !won && rand() < 0.4);
    this.arena.crowd && this.arena.crowd.cheer(won ? (big ? 1.2 : 0.7) : 0.4);
    if (big) Audio.ooh();
    this.excite = Math.min(1, this.excite + (big ? 0.5 : 0.25));
    this.oppChar.setMood(won ? (rand() < 0.5 ? 'sad' : 'shrug') : (rand() < 0.5 ? 'celebrate' : 'fist'));
    const line = won ? pickOne(this.opp.lines.lose) : pickOne(this.opp.lines.win);
    if (rand() < 0.55 || big) this.ui.hud.speech(line);
    if (m.combo && !won) { m.combo = 0; }
    if (!won && m.fire) { m.fire = false; this.peteca.fire = false; this.ui.hud.fire(false); }
    let sub = m.rally > 1 ? `Rali de ${m.rally}` : '';
    if (res.reason === 'FORA!' && this.lastHitter > 0) sub = 'Mire dentro das linhas!';
    if (res.reason === 'NA REDE!' && this.lastHitter > 0) sub = 'Acerte no tempo certo pra passar a rede';
    this.ui.hud.banner(won ? (res.reason === 'FORA!' ? 'FORA! PONTO SEU' : 'PONTO!') : (res.reason === 'FORA!' ? 'FORA!' : res.reason === 'NA REDE!' ? 'NA REDE!' : 'PONTO DELE'), (won ? res.reason !== 'FORA!' ? res.reason + ' ' : '' : '') + sub, won ? 'win' : 'lose');
    this.ui.hud.setScore(m, this.server);
    this.updateBoard();
    // fim de set?
    const fmt = m.fmt;
    const [a, bb] = m.points;
    const cap = fmt.points + 4;
    const setOver = (Math.max(a, bb) >= fmt.points && Math.abs(a - bb) >= 2) || Math.max(a, bb) >= cap;
    if (setOver) {
      const sw = a > bb ? 0 : 1;
      m.sets[sw]++;
      m.setScores.push([a, bb]);
      if (sw === 0 && bb === 0) this.achieve('shutout');
      if (sw === 0 && m.maxDeficit[0] >= 4) this.achieve('comeback');
      m.points = [0, 0]; m.maxDeficit = [0, 0];
      if (m.sets[sw] >= fmt.setsToWin) {
        m.over = true; m.winner = sw === 0 ? 1 : -1;
        this.slowT = 0.9;
      } else {
        this.pendingSet = sw;
      }
    } else {
      // set point / match point
      const fp = fmt.points;
      const isSP = (i) => m.points[i] >= fp - 1 && m.points[i] > m.points[1 - i];
      const mp = (i) => isSP(i) && m.sets[i] === fmt.setsToWin - 1;
      if (mp(0)) this.pendingCall = 'MATCH POINT!'; else if (mp(1)) this.pendingCall = 'MATCH POINT DELE!';
      else if (isSP(0)) this.pendingCall = 'SET POINT!'; else if (isSP(1)) this.pendingCall = 'SET POINT DELE!';
      else this.pendingCall = null;
    }
  }

  applyLineCam(realDt) {
    const L = this.lineCam;
    L.t += realDt;
    if (L.t < 0.45) return; // deixa ver a queda normal primeiro
    if (!L.shown) {
      L.shown = true;
      this.player.hands.visible = false;
      this.ui.hud.lineCall(L.inside, L.cm);
      Audio.ooh();
    }
    const k = Math.min(1, (L.t - 0.45) / 0.35);
    const sx = L.side === 'x' ? Math.sign(L.x) : 0, sz = L.side === 'z' ? Math.sign(L.z) : 0;
    // câmera baixinha, olhando a marca e a linha
    const cx = L.x - sx * 1.1 + (L.side === 'z' ? 0.9 : 0), cz = L.z - sz * 1.1 + (L.side === 'x' ? (L.z > 0 ? 0.9 : -0.9) : 0);
    const cam = this.camera;
    const from = cam.position.clone();
    cam.position.set(from.x + (cx - from.x) * k, from.y + (0.75 - from.y) * k, from.z + (cz - from.z) * k);
    cam.lookAt(L.x, 0, L.z);
    if (L.t > 2.1) { this.lineCam = null; this.player.hands.visible = true; }
  }

  updatePoint(realDt) {
    this.pointT += realDt;
    const m = this.match;
    if (m.over && this.pointT > 1.6) { this.endMatch(); return; }
    if (this.pendingSet !== undefined && this.pendingSet !== null && this.pointT > 1.4 && !this.setShown) {
      this.setShown = true;
      const sw = this.pendingSet;
      this.ui.hud.banner(sw === 0 ? 'SET SEU!' : 'SET DELE!', `Sets: ${m.sets[0]} x ${m.sets[1]}`, sw === 0 ? 'win' : 'lose', 2.2);
      this.ui.hud.setScore(m, this.server);
      this.updateBoard();
      Audio.whistle(true);
      this.arena.crowd && this.arena.crowd.cheer(1);
      Audio.cheer(1.2);
    }
    const wait = this.setShown ? 3.6 : 2.1;
    if (this.pointT > wait) {
      this.pendingSet = null; this.setShown = false;
      this.oppChar.setMood('ready');
      this.setupServe();
      if (this.pendingCall) { this.ui.hud.call(this.pendingCall); this.pendingCall = null; }
    }
  }

  updateIntro(realDt) {
    this.introT += realDt;
    const t = this.introT;
    const P = this.player;
    const T = 3.2;
    const k = smooth(clamp(t / T, 0, 1));
    // da visão aérea até os olhos do jogador
    const a = 1 - k;
    const startPos = new THREE.Vector3(9, 7.5, 13), endPos = new THREE.Vector3(P.pos.x, EYE, P.pos.z);
    const pos = startPos.clone().lerp(endPos, k);
    pos.y += Math.sin(k * Math.PI) * 1.5;
    this.camera.position.copy(pos);
    const look = new THREE.Vector3(0, 1.2, -2).lerp(new THREE.Vector3(0, 1.6, -5), k);
    this.camera.lookAt(look);
    if (k >= 1) { P.yaw = 0; P.pitch = 0.0; }
    this.player.hands.visible = t > T * 0.85;
    if (t > 1.9 && this.oppChar.mood === 'wave') this.oppChar.setMood(this.opp.stats.power > 0.8 ? 'flex' : 'ready');
    if (!this.countdown && t > T) { this.countdown = true; this.ui.hud.countdown(() => { this.countdown = false; this.setupServe(); }); this.phase = 'countdown'; }
    if (this.phase === 'intro' && t > T + 0.2) this.phase = 'countdown';
  }

  // ------------------------------------------------------------
  achieve(id) {
    const a = Save.unlock(id);
    if (a) { this.ui.toast(a); Audio.ui('achieve'); Save.persist(); }
  }

  endMatch() {
    const m = this.match;
    if (this.phase === 'end') return;
    this.phase = 'end';
    this.lineCam = null;
    this.endT = 0;
    this.input.enabled = false;
    this.input.exitLock();
    const won = m.winner > 0;
    this.oppChar.setMood(won ? 'sad' : 'celebrate');
    Audio.whistle(true);
    Audio.cheer(won ? 1.6 : 0.6);
    this.arena.crowd && this.arena.crowd.cheer(1.4);
    if (won) this.fx.confetti(new THREE.Vector3(this.player.pos.x, 3, this.player.pos.z - 2), 220);
    this.ui.hud.speech(won ? pickOne(this.opp.lines.matchLose) : pickOne(this.opp.lines.matchWin));
    // câmera cinemática
    this.cine = { t: 0, from: this.camera.position.clone(), fromQ: this.camera.quaternion.clone(), target: this.oppChar.root.position.clone() };
    this.player.hands.visible = false;
    setTimeout(() => { this.ui.hud.show(false); this.cfg.onEnd && this.cfg.onEnd(this.summary()); }, 2400);
  }

  summary() {
    const m = this.match;
    return {
      won: m.winner > 0, sets: m.sets.slice(), setScores: m.setScores.slice(), stats: { ...m.stats },
      opponent: this.opp, accuracy: m.stats.hits ? Math.round((m.stats.quality / m.stats.hits) * 100) : 0,
    };
  }

  updateEnd(realDt) {
    this.endT += realDt;
  }

  applyCine(realDt) {
    const c = this.cine;
    c.t += realDt;
    const k = smooth(clamp(c.t / 2.5, 0, 1));
    const o = this.oppChar.root.position;
    const ang = c.t * 0.25;
    const target = new THREE.Vector3(o.x + Math.sin(ang) * 3.2, 1.6, o.z + Math.cos(ang) * 3.2);
    this.camera.position.lerpVectors(c.from, target, k);
    const m = new THREE.Matrix4().lookAt(this.camera.position, new THREE.Vector3(o.x, 1.3, o.z), new THREE.Vector3(0, 1, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    this.camera.quaternion.slerpQuaternions(c.fromQ, q, k);
    this.oppChar.update(realDt, { faceYaw: Math.atan2(this.camera.position.x - o.x, this.camera.position.z - o.z), look: this.camera.position });
  }

  exitMatch() {
    this.cine = null; this.hitBuf = null; this.serveFired = null; this.tossing = null;
    this.pendingSet = null; this.setShown = false; this.countdown = false;
    this.input.enabled = false;
    this.input.exitLock();
    this.ui.hud.show(false);
    if (this.player) this.player.hands.visible = false;
  }

  applyFov() {
    const asp = innerWidth / innerHeight;
    let fov = 72;
    if (asp < 1.2) fov = 88; else if (asp < 1.6) fov = 76;
    this.baseFov = fov;
  }

  render() {
    if (this.mode === 'match' && this.player) {
      const target = (this.baseFov || 72) + this.player.fovKick + (this.player.dashT > 0 ? 6 : 0);
      if (Math.abs(this.camera.fov - target) > 0.01) { this.camera.fov += (target - this.camera.fov) * 0.3; this.camera.updateProjectionMatrix(); }
    } else if (this.camera.fov !== 50) { this.camera.fov = 50; this.camera.updateProjectionMatrix(); }
    this.renderer.render(this.scene, this.camera);
  }
}

const OPP_DEMO = ['jessica', 'carla', 'thiago', 'ze', 'marcao', 'bene'];
