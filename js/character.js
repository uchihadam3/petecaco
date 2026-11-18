// Personagem humanoide com animação procedural (corrida, passada lateral, golpe, cortada, comemoração)
import * as THREE from '../lib/three.module.min.js';

const tmpV = new THREE.Vector3();
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const clamp = THREE.MathUtils.clamp;

function mat(color, rough = 0.7, extra = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: 0 }, extra));
}

function capsule(r, len, m, seg = 8) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, seg);
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  return mesh;
}

export class Character {
  constructor(look, opts = {}) {
    this.look = look;
    const H = look.height || 1;
    const W = look.width || 1;
    const belly = look.belly || 1;
    const golden = !!look.golden;
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.body.scale.set(H * (0.92 + W * 0.08), H, H * (0.92 + W * 0.08));

    const skin = mat(look.skin, 0.6);
    const shirt = mat(look.shirt, 0.75, golden ? { metalness: 0.6, roughness: 0.35 } : {});
    const shorts = mat(look.shorts, 0.8);
    const shoe = mat(look.shoes, 0.5);
    const sole = mat('#f0f0f0', 0.6);
    const hairM = mat(look.hairColor, 0.85);
    this.mats = { skin, shirt, shorts };

    // pelve
    this.pelvis = new THREE.Group(); this.pelvis.position.y = 0.95; this.body.add(this.pelvis);
    const hipMesh = capsule(0.15 * W, 0.12 * W, shorts); hipMesh.rotation.z = Math.PI / 2; hipMesh.scale.set(1, 1, 0.75); this.pelvis.add(hipMesh);
    // coluna
    this.spine = new THREE.Group(); this.spine.position.y = 0.05; this.pelvis.add(this.spine);
    const torso = capsule(0.16 * W, 0.3, shirt, 10); torso.position.y = 0.24; torso.scale.set(1, 1, 0.72 * belly); this.spine.add(torso);
    if (belly > 1.05) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), shirt); b.position.set(0, 0.12, 0.05 * belly); b.scale.set(1.05, 0.95, 0.8 * belly); b.castShadow = true; this.spine.add(b); }
    // faixa no peito (detalhe da camisa)
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.163 * W, 0.163 * W, 0.04, 16, 1, true), mat(new THREE.Color(look.shirt).offsetHSL(0, 0, -0.18), 0.7));
    stripe.position.y = 0.33; stripe.scale.z = 0.73 * belly; this.spine.add(stripe);
    // número nas costas/frente
    this.chest = new THREE.Group(); this.chest.position.y = 0.44; this.spine.add(this.chest);
    // pescoço e cabeça
    const neck = capsule(0.05, 0.05, skin); neck.position.y = 0.04; this.chest.add(neck);
    this.head = new THREE.Group(); this.head.position.y = 0.12; this.chest.add(this.head);
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 16), skin); headM.scale.set(0.95, 1.08, 1); headM.position.y = 0.09; headM.castShadow = true; this.head.add(headM);
    // orelhas
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), skin); e.position.set(sx * 0.108, 0.08, 0); e.scale.set(0.5, 1, 0.8); this.head.add(e); }
    // nariz
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), skin); nose.position.set(0, 0.07, 0.11); nose.scale.set(0.8, 1, 1); this.head.add(nose);
    // olhos
    const eyeW = mat('#ffffff', 0.3), eyeP = mat('#1b1b1b', 0.2);
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), eyeW); e.position.set(sx * 0.042, 0.105, 0.097); e.scale.set(1, 1, 0.6); this.head.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), eyeP); p.position.set(sx * 0.042, 0.105, 0.11); this.head.add(p);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.009, 0.01), hairM); brow.position.set(sx * 0.044, 0.135, 0.104); brow.rotation.z = sx * -0.12; this.head.add(brow);
      this.eyes.push(e);
    }
    // boca
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0045, 6, 12, Math.PI), mat('#7a2e2e', 0.5)); mouth.position.set(0, 0.04, 0.104); mouth.rotation.z = Math.PI; this.head.add(mouth);
    this.mouth = mouth;
    this._buildHair(look, hairM);
    if (look.mustache) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.05, 4, 8), hairM); m.rotation.z = Math.PI / 2; m.position.set(0, 0.055, 0.112); this.head.add(m); }
    if (look.beard) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), hairM); b.position.set(0, 0.07, 0.025); b.scale.set(1.05, 1.0, 1.05); this.head.add(b); }
    if (look.glasses) {
      const gm = mat('#111', 0.3);
      for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.004, 6, 16), gm); r.position.set(sx * 0.043, 0.105, 0.112); this.head.add(r); }
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.005), gm); br.position.set(0, 0.108, 0.115); this.head.add(br);
    }
    if (look.headband) {
      const hb = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.014, 6, 24), mat(look.headband, 0.7)); hb.rotation.x = Math.PI / 2 - 0.15; hb.position.y = 0.14; hb.scale.set(0.97, 1, 1); this.head.add(hb);
    }

    // braços
    this.arm = {};
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1; // personagem olha pra +z: direita = -x
      const sh = new THREE.Group(); sh.position.set(sx * 0.2 * W, -0.02, 0); this.chest.add(sh);
      const sleeve = capsule(0.062 * W, 0.08, shirt); sleeve.position.y = -0.05; sh.add(sleeve);
      const ua = capsule(0.047 * W, 0.2, skin); ua.position.y = -0.13; sh.add(ua);
      const el = new THREE.Group(); el.position.y = -0.27; sh.add(el);
      const fa = capsule(0.042, 0.19, skin); fa.position.y = -0.11; el.add(fa);
      const wr = new THREE.Group(); wr.position.y = -0.24; el.add(wr);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin); hand.scale.set(0.75, 1.15, 0.45); hand.position.y = -0.04; hand.castShadow = true; wr.add(hand);
      const thumb = capsule(0.013, 0.03, skin); thumb.position.set(sx * -0.03, -0.02, 0.02); thumb.rotation.z = sx * 0.6; wr.add(thumb);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.035, 10), mat(look.headband || '#ffffff', 0.8)); band.position.y = 0.0; wr.add(band);
      this.arm[side] = { sh, el, wr, sx };
    }
    // pernas
    this.leg = {};
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1;
      const hip = new THREE.Group(); hip.position.set(sx * 0.095 * W, -0.04, 0); this.pelvis.add(hip);
      const sh = capsule(0.085 * W, 0.12, shorts); sh.position.y = -0.1; hip.add(sh);
      const th = capsule(0.07 * W, 0.3, skin); th.position.y = -0.2; hip.add(th);
      const kn = new THREE.Group(); kn.position.y = -0.42; hip.add(kn);
      const shin = capsule(0.055, 0.32, skin); shin.position.y = -0.2; kn.add(shin);
      const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.05, 0.08, 10), mat('#ffffff', 0.9)); sock.position.y = -0.37; kn.add(sock);
      const an = new THREE.Group(); an.position.y = -0.43; kn.add(an);
      const sm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.22), shoe); sm.position.set(0, -0.03, 0.045); sm.castShadow = true; an.add(sm);
      const so = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.022, 0.226), sole); so.position.set(0, -0.065, 0.045); an.add(so);
      this.leg[side] = { hip, kn, an, sx };
    }
    // sombra blob
    this.blob = null;

    // estado de animação
    this.t = Math.random() * 10;
    this.phase = 0;
    this.yaw = 0;
    this.pose = {}; // ângulos atuais suavizados
    this.action = null; // {type, t, dur, ...}
    this.mood = 'idle'; // idle | ready | celebrate | sad | wave | serve
    this.jumpY = 0; this.jumpV = 0; this.airborne = false;
    this.lookTarget = new THREE.Vector3(0, 1.5, 5);
    this.vel = new THREE.Vector2();
    this.lastPos = new THREE.Vector3();
    this.lean = 0; this.sideLean = 0;
    this.excite = 0;
  }

  _buildHair(look, hairM) {
    const h = this.head;
    const style = look.hair;
    if (style === 'bald') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 20, Math.PI * 1.3), hairM);
      ring.rotation.set(Math.PI / 2, 0, Math.PI * -0.15 + Math.PI); ring.position.set(0, 0.07, -0.01); h.add(ring);
      return;
    }
    if (style === 'cap') {
      const cm = mat(look.capColor || '#e74c3c', 0.7);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.122, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), cm); top.position.y = 0.11; h.add(top);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 16, 1, false, -Math.PI / 2, Math.PI), cm); brim.position.set(0, 0.115, 0.09); brim.scale.set(1, 1, 1.1); h.add(brim);
      return;
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.123, 16, 12, 0, Math.PI * 2, 0, Math.PI * (style === 'buzz' ? 0.42 : 0.55)), hairM);
    cap.position.y = 0.1; cap.rotation.x = -0.25; h.add(cap);
    if (style === 'mohawk') {
      cap.scale.set(0.98, 0.9, 0.98);
      for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.09, 6), hairM); const a = -0.9 + i * 0.36; s.position.set(0, 0.1 + Math.cos(a) * 0.12, Math.sin(a) * 0.12); s.rotation.x = a; h.add(s); }
    }
    if (style === 'long') {
      const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.18, 4, 10), hairM); back.position.set(0, -0.02, -0.06); back.scale.set(1.1, 1, 0.55); h.add(back);
    }
    if (style === 'ponytail') {
      const tie = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), hairM); tie.position.set(0, 0.16, -0.11); h.add(tie);
      this.pony = new THREE.Group(); this.pony.position.set(0, 0.16, -0.12); h.add(this.pony);
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.16, 4, 8), hairM); tail.position.y = -0.1; this.pony.add(tail);
    }
    if (style === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), hairM); bun.position.set(0, 0.2, -0.06); h.add(bun);
    }
  }

  // inicia uma ação de golpe
  // kind: 'over' (alto), 'side' (meio), 'under' (baixo), 'smash', 'serve', 'lunge'
  strike(kind, contactLocal, dur = 0.42) {
    this.action = { type: 'strike', kind, t: 0, dur, contact: contactLocal ? contactLocal.clone() : new THREE.Vector3(-0.35, 1.4, 0.5) };
    if (kind === 'smash' && !this.airborne) this.jump(4.6);
  }
  lunge(dir) { this.action = { type: 'lunge', t: 0, dur: 0.9, dir }; }
  jump(v = 3.8) { if (this.airborne) return; this.airborne = true; this.jumpV = v; }
  setMood(m) { this.mood = m; this.moodT = 0; }

  // contato previsto (para sincronizar o golpe): tempo de antecipação até o impacto
  get strikeLead() { return 0.16; }

  update(dt, ctx = {}) {
    this.t += dt;
    const P = this.pose;
    const set = (k, v, sp = 14) => { P[k] = damp(P[k] ?? v, v, sp, dt); return P[k]; };

    // velocidade local
    const pos = this.root.position;
    const vx = (pos.x - this.lastPos.x) / Math.max(dt, 1e-4), vz = (pos.z - this.lastPos.z) / Math.max(dt, 1e-4);
    this.lastPos.copy(pos);
    this.vel.x = damp(this.vel.x, vx, 12, dt); this.vel.y = damp(this.vel.y, vz, 12, dt);
    const speed = Math.hypot(this.vel.x, this.vel.y);

    // rotação do corpo (yaw) — olha pro alvo
    if (ctx.faceYaw !== undefined) {
      let d = ctx.faceYaw - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * (1 - Math.exp(-dt * (ctx.faceRate || 8)));
    }
    this.root.rotation.y = this.yaw;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const fwd = this.vel.x * sy + this.vel.y * cy;   // velocidade pra frente
    const lat = this.vel.x * cy - this.vel.y * sy;   // lateral (+ = esquerda do personagem)

    // pulo
    if (this.airborne) {
      this.jumpV -= 13 * dt; this.jumpY += this.jumpV * dt;
      if (this.jumpY <= 0) { this.jumpY = 0; this.airborne = false; this.landT = 0.22; this.onLand && this.onLand(); }
    }
    if (this.landT > 0) this.landT -= dt;
    const landSquash = this.landT > 0 ? Math.sin((this.landT / 0.22) * Math.PI) : 0;

    // fase de corrida
    const runAmt = clamp(speed / 5.5, 0, 1);
    const sideAmt = clamp(Math.abs(lat) / Math.max(speed, 0.01), 0, 1) * runAmt;
    const fwdAmt = runAmt * (1 - sideAmt * 0.85);
    this.phase += dt * (5 + speed * 1.9);
    const ph = this.phase;
    const back = fwd < -0.3 ? 0.6 : 1;

    // base: postura atlética (pronto)
    const ready = this.mood === 'ready' || this.mood === 'serve' ? 1 : (this.mood === 'idle' ? 0.35 : 0);
    let crouch = 0.12 + ready * 0.18 + landSquash * 0.35;
    let pelvisY = 0.95 - crouch * 0.18 + Math.abs(Math.sin(ph)) * 0.05 * runAmt + Math.sin(this.t * 7) * 0.008 * ready;
    let spineX = 0.12 + ready * 0.15 + fwdAmt * 0.22 * back - (fwd < 0 ? 0.15 * runAmt : 0);
    let spineY = 0, spineZ = -lat * 0.025;
    let headX = -0.1, headY = 0;
    let shLx = -0.35 - ready * 0.35, shRx = -0.35 - ready * 0.35;
    let shLz = 0.18 + ready * 0.12, shRz = -0.18 - ready * 0.12;
    let elL = -0.9 - ready * 0.3, elR = -0.9 - ready * 0.3;
    let hipL = -crouch * 0.9, hipR = -crouch * 0.9, knL = crouch * 1.6, knR = crouch * 1.6;
    let hipLz = 0.04, hipRz = -0.04;
    let anL = -crouch * 0.6, anR = -crouch * 0.6;

    // corrida pra frente/trás
    if (fwdAmt > 0.01) {
      const a = fwdAmt * back;
      hipL += -Math.sin(ph) * 0.75 * a; hipR += Math.sin(ph) * 0.75 * a;
      knL += Math.max(0, Math.sin(ph + 1.3)) * 1.3 * a + 0.2 * a; knR += Math.max(0, Math.sin(ph + 1.3 + Math.PI)) * 1.3 * a + 0.2 * a;
      shLx += Math.sin(ph) * 0.8 * a; shRx += -Math.sin(ph) * 0.8 * a;
      elL += -0.4 * a; elR += -0.4 * a;
      spineY += Math.sin(ph) * 0.12 * a;
    }
    // passada lateral (shuffle)
    if (sideAmt > 0.01) {
      const a = sideAmt;
      const s = Math.sin(ph * 0.9);
      hipLz += (0.15 + s * 0.22) * a; hipRz += (-0.15 + s * 0.22) * a;
      knL += 0.25 * a + Math.max(0, s) * 0.4 * a; knR += 0.25 * a + Math.max(0, -s) * 0.4 * a;
      pelvisY += Math.abs(s) * 0.03 * a - 0.03 * a;
      spineZ += -Math.sign(lat) * 0.08 * a;
    }

    // humores
    this.moodT = (this.moodT || 0) + dt;
    if (this.mood === 'celebrate') {
      const b = Math.sin(this.moodT * 9);
      shLx = -2.8 + b * 0.25; shRx = -2.8 - b * 0.25; shLz = 0.35; shRz = -0.35; elL = -0.3; elR = -0.3;
      headX = -0.35; spineX = -0.1;
      if (!this.airborne && this.moodT % 0.7 < dt * 1.5 && this.moodT < 2.2) this.jump(3.2);
    } else if (this.mood === 'fist') {
      const b = Math.sin(this.moodT * 12);
      shRx = -1.2 + b * 0.35; elR = -2.2; shRz = -0.3; headX = 0.1; spineX = 0.35;
      knL += 0.3; knR += 0.3; hipL -= 0.2; hipR -= 0.2;
    } else if (this.mood === 'sad') {
      spineX = 0.7; headX = 0.55; shLx = -0.5; shRx = -0.5; elL = -0.3; elR = -0.3;
      hipL = -0.5; hipR = -0.5; knL = 0.7; knR = 0.7; anL = -0.2; anR = -0.2; pelvisY = 0.86;
      shLz = 0.05; shRz = -0.05;
    } else if (this.mood === 'sit') {
      hipL = -1.45; hipR = -1.45; knL = 1.4; knR = 1.4; anL = 0; anR = 0; spineX = 0.05; pelvisY = 0.95;
      shLx = -0.6; shRx = -0.6; elL = -0.9; elR = -0.9; shLz = 0.1; shRz = -0.1;
      if (this.whistleT > 0) { this.whistleT -= dt; shRx = -1.9; elR = -2.2; shRz = -0.2; }
    } else if (this.mood === 'shrug') {
      shLx = -0.4; shRx = -0.4; elL = -1.6; elR = -1.6; shLz = 0.5; shRz = -0.5; headX = 0.1; headY = Math.sin(this.moodT * 5) * 0.2;
    } else if (this.mood === 'wave') {
      shRx = -2.7; shRz = -0.45; elR = -0.6 + Math.sin(this.moodT * 10) * 0.45; headX = -0.05;
    } else if (this.mood === 'flex') {
      shLx = -1.5; shRx = -1.5; shLz = 1.4; shRz = -1.4; elL = -2.2 - Math.sin(this.moodT * 6) * 0.2; elR = -2.2 + Math.sin(this.moodT * 6) * 0.2; spineX = -0.05;
    }

    // ação: golpe
    let jumpTuck = 0;
    const A = this.action;
    let fast = 14;
    if (A) {
      A.t += dt;
      const k = clamp(A.t / A.dur, 0, 1);
      if (A.type === 'strike') {
        fast = 30;
        const c = A.contact; // local: x(+esq), y altura, z frente
        const shoulderH = 1.42;
        const elev = Math.atan2(c.y - shoulderH, Math.max(0.2, Math.hypot(c.z, c.x + 0.2)));
        const reachRx = -(Math.PI / 2 + elev);
        const over = A.kind === 'over' || A.kind === 'smash';
        const under = A.kind === 'under' || A.kind === 'serve';
        const side = clamp(-(c.x + 0.2) * 1.2, -0.6, 0.9); // abertura lateral do braço
        // tempos: preparação 0-0.38, impacto 0.38, finalização até 1
        const kc = 0.38;
        let rx, el, twist, bodyX;
        if (k < kc) {
          const e = ease(k / kc);
          const wind = over ? reachRx - 1.3 : under ? reachRx + 1.2 : reachRx - 0.3;
          rx = THREE.MathUtils.lerp(shRx, wind, Math.min(1, e * 1.6));
          rx = THREE.MathUtils.lerp(rx, reachRx, Math.max(0, (e - 0.6) / 0.4));
          el = THREE.MathUtils.lerp(-1.9, -0.25, Math.max(0, (e - 0.55) / 0.45));
          twist = THREE.MathUtils.lerp(0, -0.55, Math.min(1, e * 1.5)) * (1 - Math.max(0, (e - 0.7) / 0.3));
          bodyX = over ? -0.25 * Math.min(1, e * 1.4) : 0.15;
        } else {
          const e = ease((k - kc) / (1 - kc));
          const fin = over ? reachRx + 1.7 : under ? reachRx - 1.3 : reachRx + 0.9;
          rx = THREE.MathUtils.lerp(reachRx, fin, Math.min(1, e * 1.4));
          el = THREE.MathUtils.lerp(-0.2, -0.9, e);
          twist = THREE.MathUtils.lerp(0.05, 0.5, Math.min(1, e * 1.5)) * (1 - e * 0.6);
          bodyX = over ? THREE.MathUtils.lerp(-0.2, 0.45, Math.min(1, e * 1.6)) : 0.2;
        }
        shRx = rx; elR = el; shRz = -0.25 - side * 0.6; spineY += twist; spineX = (spineX + bodyX) * 0.6 + bodyX * 0.4;
        // braço esquerdo aponta pro alvo (equilíbrio)
        shLx = over ? -2.0 + k * 1.2 : -0.9; shLz = 0.45; elL = -0.6;
        if (A.kind === 'lunge' || c.y < 0.6) { crouch += 0.35; hipL -= 0.5; knL += 0.6; knR += 0.9; spineX += 0.35; }
        if (A.kind === 'smash') jumpTuck = 1;
        headX = -elev * 0.6;
        if (k >= 1) this.action = null;
      } else if (A.type === 'lunge') {
        const e = Math.sin(k * Math.PI);
        spineX += 0.7 * e; hipL += -0.9 * e; knL += 0.6 * e; knR += 1.2 * e; hipR += 0.5 * e;
        shRx = -1.4; elR = -0.2; shLx = -0.8; pelvisY -= 0.2 * e;
        if (k >= 1) this.action = null;
      }
    }
    if (this.airborne) {
      const up = clamp(this.jumpV / 4, -1, 1);
      knL += 0.5 + jumpTuck * 0.5; knR += 0.7 + jumpTuck * 0.6; hipL -= 0.3 + jumpTuck * 0.4; hipR -= 0.2; anL += 0.4; anR += 0.4;
      if (!A) { shLx -= 0.4 * up; shRx -= 0.4 * up; }
    }

    // olhar para o alvo
    if (ctx.look) {
      tmpV.copy(ctx.look).sub(pos);
      const lyaw = Math.atan2(tmpV.x, tmpV.z) - this.yaw;
      let ly = lyaw; while (ly > Math.PI) ly -= Math.PI * 2; while (ly < -Math.PI) ly += Math.PI * 2;
      const lp = Math.atan2(tmpV.y - 1.6 * (this.look.height || 1), Math.hypot(tmpV.x, tmpV.z));
      if (this.mood !== 'sad') { headY += clamp(ly, -1.1, 1.1) * 0.7; headX += clamp(-lp, -0.9, 0.6) * 0.7; }
    }

    // inclinação na direção do movimento
    this.lean = damp(this.lean, clamp(fwd * 0.04, -0.15, 0.25), 6, dt);
    this.sideLean = damp(this.sideLean, clamp(-lat * 0.03, -0.18, 0.18), 6, dt);

    // aplica
    this.pelvis.position.y = set('py', pelvisY, 16) + this.jumpY / (this.body.scale.y || 1);
    this.pelvis.rotation.x = this.lean * 0.5;
    this.pelvis.rotation.z = this.sideLean;
    this.spine.rotation.x = set('spx', spineX, fast * 0.7);
    this.spine.rotation.y = set('spy', spineY, fast * 0.7);
    this.spine.rotation.z = set('spz', spineZ, 10);
    this.head.rotation.x = set('hx', headX, 10);
    this.head.rotation.y = set('hy', headY, 10);
    this.arm.L.sh.rotation.x = set('shLx', shLx, fast); this.arm.L.sh.rotation.z = set('shLz', shLz, fast);
    this.arm.R.sh.rotation.x = set('shRx', shRx, fast); this.arm.R.sh.rotation.z = set('shRz', shRz, fast);
    this.arm.L.el.rotation.x = set('elL', elL, fast); this.arm.R.el.rotation.x = set('elR', elR, fast);
    this.arm.R.wr.rotation.x = set('wrR', A ? -0.3 : 0.1, fast);
    this.leg.L.hip.rotation.x = set('hipL', hipL, 18); this.leg.R.hip.rotation.x = set('hipR', hipR, 18);
    this.leg.L.hip.rotation.z = set('hipLz', hipLz, 14); this.leg.R.hip.rotation.z = set('hipRz', hipRz, 14);
    this.leg.L.kn.rotation.x = set('knL', knL, 18); this.leg.R.kn.rotation.x = set('knR', knR, 18);
    this.leg.L.an.rotation.x = set('anL', anL, 14); this.leg.R.an.rotation.x = set('anR', anR, 14);
    if (this.pony) this.pony.rotation.x = 0.4 + Math.sin(this.t * 6) * 0.1 * (0.3 + runAmt) + (this.airborne ? -0.4 : 0) + this.lean;
    // piscar
    const blink = (this.t % 3.7) < 0.12 ? 0.1 : 1;
    for (const e of this.eyes) e.scale.y = blink;
  }

  // posição do mundo da mão direita (aprox.) dado contato local
  localToWorld(local, out) {
    out.set(local.x, local.y, local.z);
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const x = out.x * c + out.z * s, z = -out.x * s + out.z * c;
    out.x = x + this.root.position.x; out.z = z + this.root.position.z; out.y += this.root.position.y;
    return out;
  }
  worldToLocal(world, out) {
    const dx = world.x - this.root.position.x, dz = world.z - this.root.position.z;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    out.set(dx * c - dz * s, world.y - this.root.position.y, dx * s + dz * c);
    return out;
  }
}
