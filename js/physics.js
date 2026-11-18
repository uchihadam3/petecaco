// Física da peteca: gravidade + arrasto quadrático alto (pena freia muito)
import { COURT } from './data.js';

export const GRAV = 9.81;
export const DRAG = 0.07;
export const DT = 1 / 120;
export const GROUND_Y = 0.03;

// estado: {x,y,z,vx,vy,vz,netHit}
// retorna evento: null | 'net' | 'cord' | 'ground' | 'post'
export function advance(s, dt) {
  const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy + s.vz * s.vz);
  const k = DRAG * sp;
  s.vx -= k * s.vx * dt;
  s.vy += (-GRAV - k * s.vy) * dt;
  s.vz -= k * s.vz * dt;
  const pz = s.z, py = s.y;
  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
  let ev = null;
  // cruzou o plano da rede?
  if ((pz > 0) !== (s.z > 0) && !s.netHit) {
    const f = pz / (pz - s.z);
    const yAt = py + (s.y - py) * f;
    if (Math.abs(s.x) < COURT.postX && yAt < COURT.netH) {
      if (yAt > COURT.netH - 0.06) {
        // fita: perde velocidade e passa raspando
        s.vx *= 0.4; s.vz *= 0.35; s.vy = Math.abs(s.vy) * 0.2 + 0.6;
        s.netHit = true; ev = 'cord';
      } else {
        // bateu na rede, volta pro lado de quem bateu
        const side = pz > 0 ? 1 : -1;
        s.z = side * 0.06;
        s.vz = -s.vz * 0.18; s.vx *= 0.35; s.vy = Math.min(s.vy * 0.2, 0.2);
        s.netHit = true; ev = 'net';
      }
    }
  }
  if (s.y <= GROUND_Y) { s.y = GROUND_Y; ev = 'ground'; }
  return ev;
}

// simula até o chão; retorna caminho amostrado, ponto de queda e eventos
export function simulate(st, maxT = 6, dt = DT, sample = 2) {
  const s = { ...st };
  const pts = [];
  let t = 0, i = 0, netEvent = null;
  pts.push({ x: s.x, y: s.y, z: s.z, t: 0, vy: s.vy });
  while (t < maxT) {
    const ev = advance(s, dt);
    t += dt; i++;
    if (ev === 'net' || ev === 'cord') netEvent = { type: ev, t };
    if (i % sample === 0 || ev) pts.push({ x: s.x, y: s.y, z: s.z, t, vy: s.vy });
    if (ev === 'ground') break;
  }
  return { pts, landing: { x: s.x, z: s.z, t }, netEvent };
}

// voo livre (sem rede) só pra resolver o lançamento
function flight(x, y, z, vx, vy, vz, dt) {
  let t = 0, yNet = null, py = y, pz = z;
  const s = { x, y, z, vx, vy, vz };
  while (t < 6) {
    const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy + s.vz * s.vz);
    const k = DRAG * sp;
    s.vx -= k * s.vx * dt; s.vy += (-GRAV - k * s.vy) * dt; s.vz -= k * s.vz * dt;
    py = s.y; pz = s.z;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    t += dt;
    if (yNet === null && (pz > 0) !== (s.z > 0)) {
      const f = pz / (pz - s.z); yNet = py + (s.y - py) * f;
    }
    if (s.y <= GROUND_Y) break;
  }
  return { x: s.x, z: s.z, t, yNet };
}

// Encontra velocidade inicial que leva a peteca de `from` até `target` (no chão).
// opts: { angles:[...graus em ordem de preferência], clearance, maxSpeed }
export function planShot(from, target, opts = {}) {
  const dx = target.x - from.x, dz = target.z - from.z;
  const dist = Math.hypot(dx, dz);
  const ux = dx / dist, uz = dz / dist;
  const clearance = opts.clearance ?? 0.25;
  const maxSpeed = opts.maxSpeed ?? 42;
  const crosses = (from.z > 0) !== (target.z > 0);
  const angles = opts.angles || [10, 14, 18, 22, 26, 30, 35, 40, 45, 50, 55, 60];
  const dt = 1 / 90;
  let fallback = null;
  for (const deg of angles) {
    const a = deg * Math.PI / 180;
    const ca = Math.cos(a), sa = Math.sin(a);
    let lo = 1, hi = 75, best = null;
    for (let it = 0; it < 22; it++) {
      const sp = (lo + hi) / 2;
      const r = flight(from.x, from.y, from.z, ux * ca * sp, sa * sp, uz * ca * sp, dt);
      const d = (r.x - from.x) * ux + (r.z - from.z) * uz;
      if (d < dist) lo = sp; else hi = sp;
      best = { sp, r };
    }
    const sp = (lo + hi) / 2;
    const r = flight(from.x, from.y, from.z, ux * ca * sp, sa * sp, uz * ca * sp, dt);
    const ok = (!crosses || (r.yNet !== null && r.yNet > COURT.netH + clearance)) && sp <= maxSpeed;
    const sol = { vx: ux * ca * sp, vy: sa * sp, vz: uz * ca * sp, speed: sp, angle: deg, time: r.t, yNet: r.yNet };
    sol.ok = ok;
    if (ok) return sol;
    if (!fallback || (r.yNet ?? 0) > (fallback.yNet ?? 0)) fallback = sol;
  }
  // nada passou: devolve o que mais se aproximou (provavelmente vai na rede = erro honesto)
  if (fallback && fallback.speed > maxSpeed) {
    const f = maxSpeed / fallback.speed;
    fallback.vx *= f; fallback.vy *= f; fallback.vz *= f; fallback.speed = maxSpeed;
  }
  return fallback;
}

export function isInside(x, z, tol = 0.04) {
  return Math.abs(x) <= COURT.halfW + tol && Math.abs(z) <= COURT.halfL + tol;
}
