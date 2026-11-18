// Jogador em primeira pessoa: movimento, câmera, mãos animadas
import * as THREE from '../lib/three.module.min.js';

const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
const clamp = THREE.MathUtils.clamp;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export const EYE = 1.68;

// mão aberta em espaço local: dedos +y, palma virada pra -z
function buildHand(skinMat, bandMat, sleeveMat, mirror = 1) {
  const g = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), skinMat);
  palm.scale.set(0.95, 1.05, 0.42); palm.position.y = 0.04; g.add(palm);
  const fingers = [];
  const fl = [0.058, 0.066, 0.062, 0.05];
  for (let i = 0; i < 4; i++) {
    const piv = new THREE.Group();
    piv.position.set((-0.033 + i * 0.022) * mirror, 0.09, 0);
    piv.rotation.z = (-0.12 + i * 0.08) * mirror;
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.0105, fl[i], 4, 8), skinMat);
    seg.position.y = fl[i] / 2 + 0.004; piv.add(seg);
    // nó do dedo
    g.add(piv); fingers.push(piv);
  }
  const tpiv = new THREE.Group(); tpiv.position.set(0.045 * mirror, 0.025, -0.005); tpiv.rotation.z = -0.9 * mirror; tpiv.rotation.x = -0.3;
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.045, 4, 8), skinMat); thumb.position.y = 0.028; tpiv.add(thumb); g.add(tpiv);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.05, 16), bandMat); band.position.y = -0.025; band.scale.z = 0.7; g.add(band);
  g.userData = { fingers, thumb: tpiv, band };
  return g;
}

function limb(r, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, 1, 4, 10), mat);
  m.userData.len = 1;
  return m;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function placeLimb(mesh, a, b, r) {
  _d.subVectors(b, a); const len = _d.length();
  mesh.position.copy(a).addScaledVector(_d, 0.5);
  mesh.quaternion.setFromUnitVectors(_up, _d.normalize());
  mesh.scale.set(1, Math.max(0.01, (len - r * 2) / 1), 1);
}

class FPArm {
  constructor(parent, side, mats) {
    this.side = side; // 1 = direita, -1 = esquerda
    this.spread = 1;  // < 1 no celular em pé: mãos mais pro centro
    this.shoulder = v3(0.3 * side, -0.42, 0.18);
    this.hand = buildHand(mats.skin, mats.band, mats.sleeve, side);
    this.upper = limb(0.05, mats.sleeve);
    this.fore = limb(0.036, mats.skin);
    this.cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.08, 14), mats.sleeve);
    parent.add(this.hand, this.upper, this.fore);
    for (const m of [this.hand, this.upper, this.fore]) m.traverse(o => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 10; } });
    this.pos = v3(0.3 * side, -0.45, -0.5);
    this.rot = new THREE.Euler(-0.9, 0, 0.3 * side);
    this.tPos = this.pos.clone(); this.tRot = this.rot.clone();
    this.k = 14;
    this.curl = 0.2; this.tCurl = 0.2;
    this.elbow = new THREE.Vector3();
  }
  update(dt) {
    this.shoulder.x = 0.3 * this.side * this.spread;
    this.pos.x = damp(this.pos.x, this.tPos.x, this.k, dt);
    this.pos.y = damp(this.pos.y, this.tPos.y, this.k, dt);
    this.pos.z = damp(this.pos.z, this.tPos.z, this.k, dt);
    this.rot.x = damp(this.rot.x, this.tRot.x, this.k, dt);
    this.rot.y = damp(this.rot.y, this.tRot.y, this.k, dt);
    this.rot.z = damp(this.rot.z, this.tRot.z, this.k, dt);
    this.curl = damp(this.curl, this.tCurl, 18, dt);
    this.hand.position.copy(this.pos);
    this.hand.rotation.copy(this.rot);
    for (const f of this.hand.userData.fingers) f.rotation.x = -this.curl * 1.1;
    this.hand.userData.thumb.rotation.x = -0.3 - this.curl * 0.6;
    // cotovelo: meio do caminho, empurrado pra baixo/fora
    const s = this.shoulder, w = this.pos;
    const dist = s.distanceTo(w);
    const L = 0.36; // segmento
    const bend = Math.sqrt(Math.max(0, L * L - (dist / 2) * (dist / 2)));
    this.elbow.lerpVectors(s, w, 0.5);
    this.elbow.x += 0.55 * bend * this.side; this.elbow.y -= 0.75 * bend;
    // pulso: ponto um pouco abaixo da mão
    _a.set(0, -0.03, 0).applyEuler(this.rot).add(w);
    placeLimb(this.upper, s, this.elbow, 0.05);
    placeLimb(this.fore, this.elbow, _a, 0.036);
  }
  setPose(p, r, k = 14, curl = 0.15, raw = false) { this.tPos.copy(p); if (!raw) this.tPos.x *= this.spread; this.tRot.set(r[0], r[1], r[2]); this.k = k; this.tCurl = curl; }
}

export class Player {
  constructor(camera, look = {}) {
    this.camera = camera;
    this.pos = v3(0, 0, 6);
    this.vel = v3();
    this.yaw = 0; this.pitch = 0.05;
    this.jumpY = 0; this.jumpV = 0; this.airborne = false;
    this.dashT = 0; this.dashCd = 0; this.dashDir = v3();
    this.bob = 0; this.bobAmt = 0; this.landDip = 0;
    this.shake = 0; this.fovKick = 0; this.roll = 0;
    this.locked = false;
    this.speed = 5.9;
    this.manualLookT = 0;

    const skin = new THREE.MeshStandardMaterial({ color: look.skin || '#d9a273', roughness: 0.55 });
    const band = new THREE.MeshStandardMaterial({ color: look.band || '#ffffff', roughness: 0.8 });
    const sleeve = new THREE.MeshStandardMaterial({ color: look.shirt || '#1e88e5', roughness: 0.75 });
    this.mats = { skin, band, sleeve };
    this.hands = new THREE.Group();
    camera.add(this.hands);
    this.R = new FPArm(this.hands, 1, this.mats);
    this.L = new FPArm(this.hands, -1, this.mats);
    this.swing = null; // {phase:'windup'|'strike', t, contact(cam-local), kind}
    this.holding = false;
    this.tmp = v3();
  }

  setBand(color) { this.mats.band.color.set(color); }

  get eye() { return v3(this.pos.x, EYE + this.jumpY, this.pos.z); }
  forward(out = v3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  right(out = v3()) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }

  look(dx, dy) {
    this.yaw -= dx; this.pitch = clamp(this.pitch - dy, -1.25, 1.4);
    if (Math.abs(dx) + Math.abs(dy) > 0.0005) this.manualLookT = 0.7;
  }

  assistLook(target, strength, dt) {
    if (strength <= 0) return;
    if (this.manualLookT > 0) strength *= 0.15;
    const e = this.eye;
    const dx = target.x - e.x, dy = target.y - e.y, dz = target.z - e.z;
    const tyaw = Math.atan2(-dx, -dz);
    const tpitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.9, 1.3);
    let d = tyaw - this.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    const k = 1 - Math.exp(-dt * strength * 4);
    this.yaw += d * k * 0.8;
    this.pitch += (tpitch - this.pitch) * k;
  }

  jump() { if (this.airborne || this.locked) return false; this.airborne = true; this.jumpV = 4.4; return true; }
  dash(mx, my) {
    if (this.dashCd > 0 || this.locked) return false;
    const f = this.forward(), r = this.right();
    this.dashDir.set(0, 0, 0).addScaledVector(r, mx).addScaledVector(f, my);
    if (this.dashDir.lengthSq() < 0.01) this.dashDir.copy(f);
    this.dashDir.normalize();
    this.dashT = 0.17; this.dashCd = 0.9; this.fovKick += 7;
    return true;
  }

  update(dt, realDt, move) {
    this.manualLookT -= realDt;
    // movimento
    const f = this.forward(this.tmp), r = this.right(new THREE.Vector3());
    let wx = 0, wz = 0;
    if (!this.locked) { wx = r.x * move.x + f.x * move.y; wz = r.z * move.x + f.z * move.y; }
    const l = Math.hypot(wx, wz); if (l > 1) { wx /= l; wz /= l; }
    const accel = this.airborne ? 14 : 42;
    this.vel.x = damp(this.vel.x, wx * this.speed, accel / this.speed, dt);
    this.vel.z = damp(this.vel.z, wz * this.speed, accel / this.speed, dt);
    let vx = this.vel.x, vz = this.vel.z;
    if (this.dashT > 0) { this.dashT -= dt; vx += this.dashDir.x * 9; vz += this.dashDir.z * 9; }
    this.dashCd -= dt;
    this.pos.x = clamp(this.pos.x + vx * dt, -6.8, 6.8);
    this.pos.z = clamp(this.pos.z + vz * dt, 0.45, 10.8);
    // pulo
    if (this.airborne) {
      this.jumpV -= 14 * dt; this.jumpY += this.jumpV * dt;
      if (this.jumpY <= 0) { this.jumpY = 0; this.airborne = false; this.landDip = 1; }
    }
    this.landDip = damp(this.landDip, 0, 8, dt);
    const sp = Math.hypot(vx, vz);
    this.bobAmt = damp(this.bobAmt, this.airborne ? 0 : clamp(sp / this.speed, 0, 1.3), 10, dt);
    this.bob += dt * (6 + sp * 1.4);
    // roll ao andar de lado
    const latV = vx * r.x + vz * r.z;
    this.roll = damp(this.roll, -latV * 0.006, 8, dt);

    // câmera
    const cam = this.camera;
    this.shake = damp(this.shake, 0, 9, realDt);
    this.fovKick = damp(this.fovKick, 0, 7, realDt);
    const sh = this.shake;
    cam.position.set(
      this.pos.x + Math.sin(this.bob * 0.5) * 0.025 * this.bobAmt,
      EYE + this.jumpY + Math.abs(Math.sin(this.bob)) * 0.045 * this.bobAmt - this.landDip * 0.12,
      this.pos.z,
    );
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw + (Math.random() - 0.5) * sh * 0.03;
    cam.rotation.x = this.pitch + (Math.random() - 0.5) * sh * 0.03;
    cam.rotation.z = this.roll + Math.sin(this.bob * 0.5) * 0.004 * this.bobAmt + (Math.random() - 0.5) * sh * 0.02;
    cam.updateMatrixWorld();
    this.animateHands(realDt, sp);
  }

  // zona de alcance; retorna {q, f, l, h} ou null
  reach(p, sc = 1) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    const f = -Math.sin(this.yaw) * dx + -Math.cos(this.yaw) * dz;
    const l = Math.cos(this.yaw) * dx + -Math.sin(this.yaw) * dz;
    const h = p.y;
    const top = 2.55 + (sc - 1) * 0.6 + this.jumpY * 1.05;
    if (f < -0.55 * sc || f > 1.75 * sc || Math.abs(l) > 1.4 * sc || h < 0.12 || h > top) return null;
    const hs = this.jumpY > 0.2 ? 2.2 + this.jumpY : 1.45;
    const df = (f - 0.65) / (1.15 * sc), dl = (l - 0.3) / (1.45 * sc), dh = (h - hs) / (1.35 * sc);
    const q = clamp(1 - Math.sqrt(df * df + dl * dl + dh * dh) * 1.05, 0, 1);
    return { q, f, l, h };
  }

  startWindup(kind = 'normal') {
    if (this.swing && this.swing.phase === 'strike' && this.swing.t < 0.22) return;
    this.swing = { phase: 'windup', t: 0, kind };
  }
  strike(worldPoint, under = false) {
    const cp = this.camera.worldToLocal(worldPoint.clone());
    // limita alcance do braço
    const s = this.R.shoulder;
    _b.subVectors(cp, s); const d = _b.length();
    if (d > 0.78) cp.copy(s).addScaledVector(_b.normalize(), 0.78);
    cp.z = Math.min(cp.z, -0.28);
    cp.x = clamp(cp.x, -0.25, 0.7);
    this.swing = { phase: 'strike', t: 0, contact: cp, under };
  }
  whiff() {
    const under = this.swing && this.swing.kind === 'under';
    this.swing = { phase: 'strike', t: 0, contact: v3(0.15, under ? -0.3 : 0.05, -0.68), under, whiff: true };
  }

  animateHands(dt, sp) {
    const R = this.R, L = this.L;
    const bob = Math.sin(this.bob) * 0.02 * this.bobAmt;
    const bob2 = Math.cos(this.bob) * 0.02 * this.bobAmt;
    const S = this.swing;
    const ready = this.ready ? 1 : 0;
    // mão direita
    if (!S) {
      R.setPose(v3(0.27 + bob2 * 0.5, -0.37 + ready * 0.09 + bob, -0.5 - ready * 0.05), [-1.0 + ready * 0.4, -0.35, 0.45], 10, 0.3 - ready * 0.2);
    } else if (S.phase === 'windup') {
      S.t += dt;
      if (S.kind === 'under') R.setPose(v3(0.38, -0.68, -0.22), [0.9, 0.2, 0.3], 26, 0.05);
      else R.setPose(v3(0.5, -0.08, -0.26), [0.45, -0.35, 0.35], 26, 0.05);
      if (S.t > 0.4) this.swing = null;
    } else if (S.phase === 'strike') {
      S.t += dt;
      const t = S.t;
      if (t < 0.055) {
        R.setPose(S.contact, S.under ? [-1.2, 0, 0.1] : [-0.15, -0.1, 0.05], 70, 0.0, true);
      } else if (t < 0.24) {
        if (S.under) R.setPose(v3(0.05, 0.02, -0.72), [-1.7, 0.2, -0.2], 22, 0.1);
        else R.setPose(v3(-0.05, -0.28, -0.72), [-1.25, 0.3, -0.55], 22, 0.15);
      } else if (t < 0.5) {
        R.setPose(v3(0.27, -0.37, -0.5), [-1.0, -0.35, 0.45], 9, 0.3);
      } else this.swing = null;
    }
    // mão esquerda
    if (this.holding) {
      L.setPose(v3(-0.2, -0.3, -0.5), [-1.45, 0, -0.1], 12, 0.35);
    } else if (S && S.phase === 'windup' && S.kind !== 'under') {
      L.setPose(v3(-0.32, -0.12, -0.6), [-0.3, 0.2, -0.3], 16, 0.1);
    } else {
      L.setPose(v3(-0.28 - bob2 * 0.5, -0.39 + ready * 0.07 - bob, -0.5), [-1.0 + ready * 0.35, 0.35, -0.45], 10, 0.35);
    }
    R.update(dt); L.update(dt);
  }

  leftHandWorld(out = v3()) {
    out.set(0, 0.06, -0.035).applyEuler(this.L.rot).add(this.L.pos);
    return this.camera.localToWorld(out);
  }
}
