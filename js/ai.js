// Cérebro dos adversários: leitura de trajetória, deslocamento, escolha de golpe
import * as THREE from '../lib/three.module.min.js';
import { COURT } from './data.js';

const clamp = THREE.MathUtils.clamp;
const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
const rand = Math.random;
const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;

export class AI {
  constructor(char, stats, side, opts = {}) {
    this.char = char;
    this.stats = stats;
    this.side = side;               // -1 = lado do adversário (z<0), +1 = lado do jogador
    this.practice = !!opts.practice;
    this.pos = char.root.position;
    this.vel = new THREE.Vector2();
    this.moveTo = new THREE.Vector3(0, 0, side * 4.6);
    this.plan = null;
    this.trajSeen = -1;
    this.baseYaw = side < 0 ? 0 : Math.PI;
    this.maxSpeed = 3.0 + stats.speed * 3.8;
    this.reaction = 0.5 - stats.reaction * 0.4;
    this.handLocal = new THREE.Vector3(-0.38, 1.4, 0.5);
    this.serveState = null;
    this.left = false;
    this.tmp = new THREE.Vector3();
    this.lookAt = new THREE.Vector3(0, 1.5, 0);
  }

  // --------- utilidades ---------
  handOffsetWorld(yaw, local) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return { x: local.x * c + local.z * s, z: -local.x * s + local.z * c };
  }

  replan(game) {
    const pred = game.pred;
    this.plan = null; this.left = false;
    if (!pred) return;
    const st = this.stats;
    const now = game.rallyTime - game.trajStart; // tempo desde o início da trajetória
    const react = this.practice ? 0.12 : this.reaction * (0.8 + rand() * 0.4);
    const land = pred.landing;
    const landOnMySide = land.z * this.side > 0;
    // vai cair fora? (bom julgamento = deixa passar)
    if (landOnMySide && !pred.netEvent && !this.practice) {
      const outX = Math.abs(land.x) - COURT.halfW, outZ = Math.abs(land.z) - COURT.halfL;
      const out = Math.max(outX, outZ);
      if (out > 0.15) {
        const pLeave = out > 0.9 ? 0.45 + st.judgment * 0.55 : out > 0.4 ? st.judgment * 0.85 : st.judgment * 0.4;
        if (rand() < pLeave) { this.left = true; this.moveTo.set(clamp(land.x * 0.5, -3, 3), 0, this.side * 4.2); return; }
      }
    }
    if (pred.netEvent && pred.netEvent.type === 'net') return; // bateu na rede, nada a fazer
    const speed = this.maxSpeed * (this.practice ? 1.25 : 1);
    const minH = 0.32, maxStand = 2.3, maxJump = 2.95;
    let best = null;
    const wantSmash = rand() < st.aggression * (this.practice ? 0 : 1);
    for (const p of pred.pts) {
      if (p.t < now + react + 0.08) continue;
      if (p.z * this.side < 0.35) continue;
      if (p.y < minH || p.y > (wantSmash ? maxJump : maxStand)) continue;
      const yaw = this.faceYawFor(p, game);
      const off = this.handOffsetWorld(yaw, this.handLocal);
      const sx = p.x - off.x, sz = p.z - off.z;
      const d = Math.hypot(sx - this.pos.x, sz - this.pos.z);
      const avail = p.t - now - react;
      const need = d / speed + 0.08;
      if (need > avail) continue;
      const pref = wantSmash ? 2.6 : 1.45 + st.speed * 0.3;
      const score = -Math.abs(p.y - pref) - p.t * 0.15 + (p.vy < 0 ? 0.25 : 0);
      if (!best || score > best.score) best = { p, sx, sz, yaw, score, stretch: need / Math.max(0.05, avail) };
    }
    if (best) {
      const err = this.practice ? 0 : (1 - st.reaction) * 0.9;
      this.plan = {
        tHit: best.p.t, point: { x: best.p.x, y: best.p.y, z: best.p.z }, sx: best.sx, sz: best.sz, yaw: best.yaw,
        err: { x: gauss() * err, z: gauss() * err }, react: now + react, smash: best.p.y > 2.35, started: false, stretch: best.stretch,
      };
    } else if (landOnMySide) {
      // não alcança: corre e tenta o mergulho
      this.plan = { chase: true, react: now + react, sx: land.x + 0.3 * this.side, sz: land.z, tHit: land.t - 0.12, point: { x: land.x, y: 0.3, z: land.z }, err: { x: 0, z: 0 }, started: false };
    }
  }

  faceYawFor(p, game) {
    // encara mais ou menos a rede, girando um pouco pra peteca
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    const a = Math.atan2(dx, dz);
    let d = a - this.baseYaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    return this.baseYaw + clamp(d, -0.5, 0.5);
  }

  chooseShot(game, contact, stretch = 0) {
    const st = this.stats;
    const s = this.side;
    const opp = game.agentPos(-s);
    const oz = opp.z * -s; // profundidade do oponente no lado dele (0 rede .. 7.5 fundo)
    if (this.practice) {
      // treino: devolve perto do jogador, bem jogável
      const tx = clamp(opp.x + gauss() * 1.4, -3, 3), tz = -s * clamp(oz + gauss() * 1.2, 3, 6.6);
      return { type: rand() < 0.6 ? 'clear' : 'lob', target: { x: tx, z: tz }, quality: 0.6, powerMul: 0.85 };
    }
    const cands = [];
    for (const sx of [-1, 1]) {
      cands.push({ type: 'drive', x: sx * (2.2 + st.accuracy * 0.75), z: -s * 6.3, w: 0.4 + st.power * 0.9 });
      cands.push({ type: 'drive', x: sx * (2.3 + st.accuracy * 0.75), z: -s * 4.2, w: 0.3 + st.power * 0.5 });
      cands.push({ type: 'clear', x: sx * (2.0 + st.accuracy * 0.6), z: -s * 6.6, w: 0.5 + (1 - st.power) * 0.6 });
      cands.push({ type: 'lob', x: sx * (1.9 + st.accuracy * 0.5), z: -s * 6.7, w: 0.25 + (1 - st.power) * 0.5 + (oz < 3.5 ? 1.6 : 0) });
      cands.push({ type: 'drop', x: sx * (1.8 + st.accuracy * 0.5), z: -s * 1.7, w: st.tricky * (1.2 + (oz > 5 ? 0.8 : -1.0)) });
    }
    let best = null;
    for (const c of cands) {
      const dist = Math.hypot(c.x - opp.x, c.z - opp.z);
      const sc = c.w + dist * (0.15 + st.accuracy * 0.35) + rand() * (1.8 - st.accuracy);
      if (!best || sc > best.sc) best = { ...c, sc };
    }
    let type = best.type;
    let tx = best.x, tz = best.z;
    // pressão: correu muito ou golpe forte do oponente => devolução defensiva
    const ls = game.lastShot || {};
    const pressure = clamp(stretch * 1.1 - 0.35, 0, 1) * (1.15 - st.speed * 0.5) + (ls.q > 0.78 ? 0.25 : 0) + (ls.speed > 22 ? 0.2 : 0);
    if (rand() < pressure * 0.8) { type = rand() < 0.6 ? 'lob' : 'clear'; tx = gauss() * 1.6; tz = -s * (4.5 + rand() * 2); }
    if (contact.y > 2.25 && rand() < 0.35 + st.aggression * 0.65) {
      type = 'smash';
      tx = clamp(-Math.sign(opp.x || 1) * (1.5 + rand() * 1.6), -3.2, 3.2);
      tz = -s * (3.6 + rand() * 2.4);
    }
    // erro de mira
    const er = (0.12 + (1 - st.accuracy) * 1.25) * (1 + pressure * 0.6);
    tx += gauss() * er; tz += gauss() * er * 0.8;
    // limita em direção à quadra (erros grandes vêm do 'mistake')
    tx = clamp(tx, -COURT.halfW - 0.3, COURT.halfW + 0.3);
    tz = -s * clamp(Math.abs(tz), 0.9, COURT.halfL + 0.3);
    let netError = false;
    const rally = game.match ? game.match.rally : 0;
    if (rand() < (1 - st.consistency) * 0.2 + rally * 0.0035 + pressure * 0.06) {
      if (rand() < 0.55) { // fora
        if (rand() < 0.5) tx = Math.sign(tx || 1) * (COURT.halfW + 0.4 + rand() * 1.2);
        else tz = -s * (COURT.halfL + 0.4 + rand() * 1.4);
      } else netError = true;
    }
    const q = clamp(0.35 + st.accuracy * 0.45 + gauss() * 0.18 - pressure * 0.25, 0.1, 1);
    return { type, target: { x: tx, z: tz }, quality: q, powerMul: 0.8 + st.power * 0.34, netError };
  }

  // --------- loop ---------
  update(dt, game) {
    const ch = this.char;
    const st = this.stats;
    let face = this.baseYaw;
    let speedMul = 1;
    const ball = game.ball;

    if (game.phase === 'rally' && game.ballMode === 'flight') {
      if (game.trajId !== this.trajSeen) {
        this.trajSeen = game.trajId;
        if (game.lastHitter === -this.side) this.replan(game);
        else { this.plan = null; this.left = false; }
      }
      const now = game.rallyTime - game.trajStart;
      const P = this.plan;
      if (P) {
        if (now >= P.react) {
          const k = clamp((P.tHit - now) / 1.0, 0, 1);
          this.moveTo.set(P.sx + P.err.x * k, 0, P.sz + P.err.z * k);
          speedMul = P.chase ? 1.1 : 1;
        }
        face = P.yaw ?? face;
        const tl = P.tHit - now;
        if (!P.started && tl <= ch.strikeLead + (P.smash ? 0.28 : 0)) {
          P.started = true;
          if (P.chase) ch.lunge(); else {
            const local = ch.worldToLocal(this.tmp.set(P.point.x, P.point.y, P.point.z), new THREE.Vector3());
            const kind = P.smash ? 'smash' : P.point.y > 1.75 ? 'over' : P.point.y < 0.95 ? 'under' : 'side';
            ch.strike(kind, local, 0.45 + (P.smash ? 0.25 : 0));
          }
        }
        if (tl <= 0.0 && !P.done) {
          P.done = true;
          if (P.chase && game.lastHitter === -this.side && ball.z * this.side > 0 && ball.y > 0.08) {
            // mergulho de salvação
            const d = Math.hypot(this.pos.x - ball.x, this.pos.z - ball.z);
            if (d < 1.25 && rand() < 0.25 + st.speed * 0.55 && !this.practice) {
              game.performHit(this.side, { type: 'lob', target: { x: gauss() * 1.5, z: -this.side * (3.5 + rand() * 3) }, quality: 0.2, powerMul: 0.8 });
              game.onSave && game.onSave(this.side);
              this.plan = null;
            }
          }
          if (!P.chase && game.lastHitter === -this.side && ball.z * this.side > 0) {
            const hand = ch.localToWorld(this.handLocal.clone().setY(ball.y - ch.root.position.y), new THREE.Vector3());
            const d = Math.hypot(hand.x - ball.x, hand.z - ball.z);
            if (d < 0.85 + st.speed * 0.25) {
              const shot = this.chooseShot(game, ball, P.stretch || 0);
              game.performHit(this.side, shot);
              this.plan = null;
            }
          }
        }
      } else if (game.lastHitter === this.side) {
        // acabou de bater: volta pra base, de olho no oponente
        const opp = game.agentPos(-this.side);
        this.moveTo.set(clamp(opp.x * 0.3, -2, 2), 0, this.side * (4.4 + (1 - st.speed) * 0.6));
      }
      this.lookAt.set(ball.x, ball.y, ball.z);
      ch.setMood && (ch.mood = 'ready');
    } else if (game.phase === 'rally' && game.ballMode === 'landed') {
      this.lookAt.set(ball.x, ball.y, ball.z);
    }

    // serviço
    if (this.serveState) this.updateServe(dt, game);

    // locomoção
    const dx = this.moveTo.x - this.pos.x, dz = this.moveTo.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const maxS = this.maxSpeed * speedMul;
    let tvx = 0, tvz = 0;
    if (dist > 0.04) {
      const s = Math.min(maxS, dist * 4.5);
      tvx = dx / dist * s; tvz = dz / dist * s;
    }
    const acc = 9 + st.speed * 7;
    this.vel.x = damp(this.vel.x, tvx, acc / Math.max(1, maxS) * 2.2, dt);
    this.vel.y = damp(this.vel.y, tvz, acc / Math.max(1, maxS) * 2.2, dt);
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.y * dt;
    // não invade o lado do outro
    if (this.pos.z * this.side < 0.5) this.pos.z = this.side * 0.5;

    ch.update(dt, { faceYaw: face, look: this.lookAt, faceRate: 9 });
  }

  // --------- saque ---------
  beginServe(game) {
    this.serveState = { t: 0, delay: 0.9 + rand() * 0.8, hit: false, struck: false };
    this.moveTo.set(this.side * -0.6 * (rand() < 0.5 ? 1 : -1), 0, this.side * 6.9);
  }
  updateServe(dt, game) {
    const S = this.serveState;
    S.t += dt;
    const ch = this.char;
    // segura a peteca na mão esquerda
    if (!S.hit) {
      const held = ch.localToWorld(new THREE.Vector3(0.3, 1.05, 0.45), new THREE.Vector3());
      game.holdBall(held);
      ch.mood = 'serve';
    }
    const dist = Math.hypot(this.moveTo.x - this.pos.x, this.moveTo.z - this.pos.z);
    if (!S.struck && S.t > S.delay && dist < 0.15) {
      S.struck = true; S.strikeAt = S.t + 0.2;
      ch.strike('serve', new THREE.Vector3(0.0, 0.85, 0.55), 0.5);
    }
    if (S.struck && !S.hit && S.t >= S.strikeAt) {
      S.hit = true;
      const st = this.stats;
      const opp = game.agentPos(-this.side);
      const short = !this.practice && rand() < st.tricky * 0.35;
      const tx = this.practice ? clamp(opp.x + gauss(), -2.5, 2.5) : clamp(-Math.sign(opp.x || (rand() - 0.5)) * (1 + rand() * 2.2), -3.2, 3.2);
      const tz = -this.side * (short ? 2.2 + rand() * 0.8 : 5.4 + rand() * 1.6);
      let mistake = !this.practice && rand() < (1 - st.consistency) * 0.1;
      game.performHit(this.side, {
        type: short ? 'serve_low' : 'serve', target: { x: mistake ? tx * 1.6 + Math.sign(tx) * 1.2 : tx, z: tz }, quality: 0.6 + st.accuracy * 0.3,
        powerMul: 0.85 + st.power * 0.25, serve: true,
      });
      this.serveState = null;
    }
  }
}
