// Efeitos: penas voando, poeira, ondas de impacto, faíscas, confete
import * as THREE from '../lib/three.module.min.js';
import { getBlobTexture } from './peteca.js';

const MAX = 700;
let softTex = null;
function getSoftTex() {
  if (softTex) return softTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  softTex = new THREE.CanvasTexture(c);
  return softTex;
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    // partículas sólidas (penas, confete, faíscas) — encolhem pra sumir
    const geo = new THREE.PlaneGeometry(1, 1);
    this.mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.parts = [];
    this.dummy = new THREE.Object3D();
    this.col = new THREE.Color();
    // brilhos aditivos
    this.glowMat = new THREE.MeshBasicMaterial({ map: getSoftTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.glow = new THREE.InstancedMesh(geo, this.glowMat, 300);
    this.glow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.glow.setColorAt(0, new THREE.Color(1, 1, 1));
    this.glow.frustumCulled = false; this.glow.count = 0;
    scene.add(this.glow);
    this.glows = [];
    // anéis de impacto
    this.rings = [];
    const rg = new THREE.RingGeometry(0.82, 1, 40);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
      m.visible = false; scene.add(m); this.rings.push({ m, t: 1, dur: 0.3, max: 1 });
    }
    // poeira
    this.dust = [];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: getSoftTex(), transparent: true, depthWrite: false, color: '#ddd' }));
      m.visible = false; scene.add(m); this.dust.push({ m, t: 1, dur: 1 });
    }
    // marca na areia/quadra
    this.marks = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: getBlobTexture(), transparent: true, depthWrite: false, opacity: 0 }));
      m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); this.marks.push({ m, t: 99 });
    }
    this.markIdx = 0;
  }

  spawn(o) {
    if (this.parts.length >= MAX) this.parts.shift();
    this.parts.push(Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, t: 0, size: 0.05, rx: 0, ry: 0, rz: 0, vr: 5, drag: 1, grav: 9.8, color: '#fff', flutter: 0, aspect: 1 }, o));
  }
  spawnGlow(o) {
    if (this.glows.length >= 300) this.glows.shift();
    this.glows.push(Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0.4, t: 0, size: 0.3, color: '#fff', grow: 1 }, o));
  }

  hitBurst(p, quality, colors, dir, power = 0.5, scale = 1) {
    const n = Math.floor(6 + quality * 14 + power * 8);
    for (let i = 0; i < n; i++) {
      const sp = 1.5 + Math.random() * 3.5 * (0.5 + quality);
      const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.3) * Math.PI;
      this.spawn({
        x: p.x, y: p.y, z: p.z,
        vx: Math.cos(a) * Math.cos(b) * sp + dir.x * 2, vy: Math.sin(b) * sp + 1.5, vz: Math.sin(a) * Math.cos(b) * sp + dir.z * 2,
        life: 0.8 + Math.random() * 0.9, size: 0.011 + Math.random() * 0.012, aspect: 3.2,
        color: colors[i % colors.length], drag: 3.5, grav: 3, flutter: 6, vr: 8,
      });
    }
    // faíscas
    const ns = Math.floor(quality * 18 + power * 10);
    for (let i = 0; i < ns; i++) {
      const sp = 4 + Math.random() * 9;
      const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI;
      this.spawnGlow({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * Math.cos(b) * sp, vy: Math.sin(b) * sp, vz: Math.sin(a) * Math.cos(b) * sp, life: 0.18 + Math.random() * 0.2, size: 0.03 + Math.random() * 0.03, color: quality > 0.75 ? '#ffd76a' : '#ffffff', grow: 0.3 });
    }
    this.spawnGlow({ x: p.x, y: p.y, z: p.z, life: 0.14, size: (0.22 + quality * 0.3 + power * 0.2) * scale, color: quality > 0.75 ? '#ffd76a' : '#bbbbbb', grow: 1.4 });
  }

  ring(p, camera, color = '#fff', max = 1.2, dur = 0.28) {
    const r = this.rings.find(r => r.t >= 1) || this.rings[0];
    r.m.visible = true; r.t = 0; r.dur = dur; r.max = max;
    r.m.position.copy(p);
    r.m.lookAt(camera.position);
    r.m.material.color.set(color);
  }
  groundRing(x, z, color = '#fff', max = 1.5) {
    const r = this.rings.find(r => r.t >= 1) || this.rings[1];
    r.m.visible = true; r.t = 0; r.dur = 0.5; r.max = max;
    r.m.position.set(x, 0.03, z); r.m.rotation.set(-Math.PI / 2, 0, 0);
    r.m.material.color.set(color);
  }

  dustPuff(x, z, color = '#d9c7a0', n = 6, big = 1) {
    for (let i = 0; i < n; i++) {
      const d = this.dust.find(d => d.t >= 1) || this.dust[i];
      d.m.visible = true; d.t = 0; d.dur = 0.7 + Math.random() * 0.6;
      const a = Math.random() * Math.PI * 2;
      d.x = x; d.z = z; d.y = 0.08;
      d.vx = Math.cos(a) * (0.6 + Math.random()) * big; d.vz = Math.sin(a) * (0.6 + Math.random()) * big; d.vy = 0.4 + Math.random() * 0.6;
      d.size = (0.25 + Math.random() * 0.3) * big;
      d.m.material.color.set(color);
    }
    // grãos
    for (let i = 0; i < 10 * big; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
      this.spawn({ x, y: 0.05, z, vx: Math.cos(a) * sp, vy: 1.5 + Math.random() * 2.5, vz: Math.sin(a) * sp, life: 0.6, size: 0.02, color, drag: 1, grav: 12 });
    }
    const mk = this.marks[this.markIdx++ % this.marks.length];
    mk.m.visible = true; mk.t = 0; mk.m.position.set(x, 0.011, z); mk.m.scale.setScalar(0.35);
  }

  confetti(center, n = 160) {
    const cols = ['#ffdf00', '#009c3b', '#0abde3', '#ff4d6d', '#ffffff', '#ff9f1a', '#a29bfe'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 6;
      this.spawn({
        x: center.x + (Math.random() - 0.5) * 2, y: center.y, z: center.z + (Math.random() - 0.5) * 2,
        vx: Math.cos(a) * sp, vy: 5 + Math.random() * 8, vz: Math.sin(a) * sp,
        life: 3 + Math.random() * 2, size: 0.06 + Math.random() * 0.04, aspect: 0.6,
        color: cols[i % cols.length], drag: 1.6, grav: 4, flutter: 4, vr: 9,
      });
    }
  }

  fireEmbers(p) {
    for (let i = 0; i < 2; i++) {
      this.spawnGlow({ x: p.x + (Math.random() - 0.5) * 0.1, y: p.y, z: p.z + (Math.random() - 0.5) * 0.1, vx: (Math.random() - 0.5), vy: 0.5 + Math.random(), vz: (Math.random() - 0.5), life: 0.35, size: 0.18 + Math.random() * 0.12, color: Math.random() < 0.5 ? '#ff7b00' : '#ffcf40', grow: -0.8 });
    }
  }

  update(dt, camera) {
    const d = this.dummy;
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.grav * dt;
      if (p.flutter) { p.vx += Math.sin(p.t * p.flutter + i) * dt * 2; p.vz += Math.cos(p.t * p.flutter * 0.7 + i) * dt * 2; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.01) { p.y = 0.01; p.vy = 0; p.vx *= 0.8; p.vz *= 0.8; p.vr *= 0.8; }
      p.rx += p.vr * dt; p.ry += p.vr * 0.7 * dt; p.rz += p.vr * 0.4 * dt;
      const k = 1 - p.t / p.life;
      const s = p.size * Math.min(1, k * 3);
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(p.rx, p.ry, p.rz);
      d.scale.set(s, s * p.aspect, s);
      d.updateMatrix();
      this.mesh.setMatrixAt(n, d.matrix);
      this.mesh.setColorAt(n, this.col.set(p.color));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    let g = 0;
    for (let i = this.glows.length - 1; i >= 0; i--) {
      const p = this.glows[i];
      p.t += dt;
      if (p.t >= p.life) { this.glows.splice(i, 1); continue; }
      p.vx *= Math.exp(-4 * dt); p.vy *= Math.exp(-4 * dt); p.vz *= Math.exp(-4 * dt);
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const k = p.t / p.life;
      const s = Math.max(0.001, p.size * (1 + p.grow * k) * (1 - k * 0.7));
      d.position.set(p.x, p.y, p.z);
      d.quaternion.copy(camera.quaternion);
      d.scale.set(s, s, s);
      d.updateMatrix();
      this.glow.setMatrixAt(g, d.matrix);
      this.col.set(p.color).multiplyScalar(1 - k);
      this.glow.setColorAt(g, this.col);
      g++;
    }
    this.glow.count = g;
    this.glow.instanceMatrix.needsUpdate = true;
    if (this.glow.instanceColor) this.glow.instanceColor.needsUpdate = true;

    for (const r of this.rings) {
      if (r.t >= 1) continue;
      r.t = Math.min(1, r.t + dt / r.dur);
      const e = 1 - Math.pow(1 - r.t, 3);
      r.m.scale.setScalar(0.05 + e * r.max);
      r.m.material.opacity = (1 - r.t) * 0.9;
      if (r.t >= 1) r.m.visible = false;
    }
    for (const p of this.dust) {
      if (p.t >= 1) continue;
      p.t = Math.min(1, p.t + dt / p.dur);
      p.vx *= Math.exp(-2.5 * dt); p.vz *= Math.exp(-2.5 * dt); p.vy *= Math.exp(-2 * dt);
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.m.position.set(p.x, p.y, p.z);
      p.m.quaternion.copy(camera.quaternion);
      p.m.scale.setScalar(p.size * (1 + p.t * 2));
      p.m.material.opacity = (1 - p.t) * 0.55;
      if (p.t >= 1) p.m.visible = false;
    }
    for (const mk of this.marks) {
      if (!mk.m.visible) continue;
      mk.t += dt;
      mk.m.material.opacity = Math.max(0, 0.35 - mk.t * 0.08);
      if (mk.m.material.opacity <= 0) mk.m.visible = false;
    }
  }

  clear() {
    this.parts.length = 0; this.glows.length = 0;
    for (const m of this.marks) m.m.visible = false;
  }
}
