// Modelo 3D da peteca + rastro + sombra + marcadores
import * as THREE from '../lib/three.module.min.js';

let featherTex = null, blobTex = null, ringTex = null;

function makeFeatherTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 256);
  // vane
  const grad = g.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0.0)');
  grad.addColorStop(0.12, 'rgba(255,255,255,0.95)');
  grad.addColorStop(1, 'rgba(235,235,235,1)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(32, 250);
  g.bezierCurveTo(4, 200, 2, 70, 30, 4);
  g.bezierCurveTo(34, 0, 36, 2, 38, 8);
  g.bezierCurveTo(62, 70, 60, 200, 32, 250);
  g.fill();
  // barbas
  g.strokeStyle = 'rgba(150,150,150,0.35)'; g.lineWidth = 1;
  for (let y = 20; y < 240; y += 6) {
    g.beginPath(); g.moveTo(32, y + 8); g.quadraticCurveTo(18, y + 3, 8, y - 4); g.stroke();
    g.beginPath(); g.moveTo(32, y + 8); g.quadraticCurveTo(46, y + 3, 56, y - 4); g.stroke();
  }
  // ráquis
  g.strokeStyle = 'rgba(200,200,200,1)'; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(32, 256); g.lineTo(33, 6); g.stroke();
  // pontinha mais escura
  const tip = g.createLinearGradient(0, 0, 0, 60);
  tip.addColorStop(0, 'rgba(0,0,0,0.25)'); tip.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = tip; g.fillRect(0, 0, 64, 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function getBlobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

function getRingTexture() {
  if (ringTex) return ringTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.lineWidth = 9;
  g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 4; g.globalAlpha = 0.6;
  g.beginPath(); g.arc(64, 64, 34, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 1; g.fillStyle = '#fff';
  g.beginPath(); g.arc(64, 64, 7, 0, Math.PI * 2); g.fill();
  ringTex = new THREE.CanvasTexture(c);
  return ringTex;
}

export function buildPetecaModel(skin, scale = 1.5) {
  if (!featherTex) featherTex = makeFeatherTexture();
  const g = new THREE.Group();
  const inner = new THREE.Group(); g.add(inner);
  // base de borracha (perfil torneado)
  const prof = [[0, 0], [0.03, 0.002], [0.046, 0.008], [0.05, 0.018], [0.047, 0.028], [0.036, 0.035], [0.016, 0.038], [0, 0.038]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const baseMat = new THREE.MeshStandardMaterial({ color: skin.base, roughness: 0.55, metalness: skin.glow ? 0.5 : 0.05 });
  const base = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), baseMat);
  base.castShadow = true;
  inner.add(base);
  // listras da base
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.049, 0.004, 6, 24), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }));
  stripe.rotation.x = Math.PI / 2; stripe.position.y = 0.018; inner.add(stripe);
  // amarração
  const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.025, 12), new THREE.MeshStandardMaterial({ color: '#f5e6c8', roughness: 0.8 }));
  tie.position.y = 0.05; inner.add(tie);
  // penas
  const fGeo = new THREE.PlaneGeometry(0.07, 0.2);
  fGeo.translate(0, 0.1, 0);
  for (let i = 0; i < 4; i++) {
    const col = new THREE.Color(skin.feathers[i % skin.feathers.length]);
    const m = new THREE.MeshStandardMaterial({
      map: featherTex, color: col, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide,
      roughness: 0.9, emissive: skin.glow ? col : new THREE.Color(0), emissiveIntensity: skin.glow ? 0.55 : 0,
    });
    const piv = new THREE.Group();
    piv.rotation.y = i * Math.PI / 2 + Math.PI / 4;
    piv.position.y = 0.045;
    const f = new THREE.Mesh(fGeo, m);
    f.position.z = 0.012;
    f.rotation.x = 0.2; // abre pra fora
    f.castShadow = true;
    piv.add(f); inner.add(piv);
  }
  g.scale.setScalar(scale);
  g.userData.inner = inner;
  return g;
}

export class Peteca {
  constructor(scene, skin) {
    this.scene = scene;
    this.skin = skin;
    this.model = buildPetecaModel(skin);
    scene.add(this.model);
    this.quat = new THREE.Quaternion();
    this.spin = 0;
    this.spinRate = 0;
    this.tmpV = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    this.landT = -1;
    // rastro
    this.trailN = 30;
    this.trailPts = [];
    const tg = new THREE.BufferGeometry();
    this.trailPos = new Float32Array(this.trailN * 2 * 3);
    this.trailCol = new Float32Array(this.trailN * 2 * 4);
    tg.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    tg.setAttribute('color', new THREE.BufferAttribute(this.trailCol, 4));
    const idx = [];
    for (let i = 0; i < this.trailN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    tg.setIndex(idx);
    this.trail = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.trail.frustumCulled = false;
    this.trail.renderOrder = 5;
    scene.add(this.trail);
    this.trailColor = new THREE.Color(skin.trail);
    this.fire = false;
    // sombra
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: getBlobTexture(), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.renderOrder = 2;
    scene.add(this.shadow);
    // marcador de queda
    this.marker = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: getRingTexture(), transparent: true, depthWrite: false, color: '#fff7c2' }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.renderOrder = 3; this.marker.visible = false;
    scene.add(this.marker);
    // mira
    this.aim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: getRingTexture(), transparent: true, depthWrite: false, color: '#7dff8a' }));
    this.aim.rotation.x = -Math.PI / 2; this.aim.renderOrder = 3; this.aim.visible = false;
    scene.add(this.aim);
  }

  setSkin(skin) {
    this.scene.remove(this.model);
    this.skin = skin;
    this.model = buildPetecaModel(skin);
    this.scene.add(this.model);
    this.trailColor.set(skin.trail);
  }

  resetTrail() { this.trailPts.length = 0; }

  // s = estado físico; mode 'flight' | 'held' | 'landed'
  update(dt, s, mode, camera, opts = {}) {
    const m = this.model;
    m.position.set(s.x, s.y, s.z);
    const inner = m.userData.inner;
    if (mode === 'flight') {
      const sp = Math.hypot(s.vx, s.vy, s.vz);
      if (sp > 0.3) {
        // penas apontam contra o movimento: base vai na frente
        this.tmpV.set(-s.vx, -s.vy, -s.vz).normalize();
        const target = new THREE.Quaternion().setFromUnitVectors(this.up, this.tmpV);
        const rate = 1 - Math.exp(-dt * (4 + sp * 0.9));
        this.quat.slerp(target, rate);
      }
      this.spinRate = THREE.MathUtils.lerp(this.spinRate, 4 + sp * 0.8, 1 - Math.exp(-dt * 3));
      this.spin += this.spinRate * dt;
      this.landT = -1;
    } else if (mode === 'landed') {
      // cai de lado, quica de leve
      if (this.landT < 0) { this.landT = 0; this.landFrom = this.quat.clone(); this.landAxis = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(); }
      this.landT += dt;
      const k = Math.min(1, this.landT / 0.45);
      const ease = 1 - Math.pow(1 - k, 3);
      const upright = new THREE.Quaternion();
      const tilt = new THREE.Quaternion().setFromAxisAngle(this.landAxis, 1.25 * ease + Math.sin(k * Math.PI) * 0.15);
      upright.multiply(tilt);
      this.quat.slerp(upright, Math.min(1, dt * 10));
      m.position.y = 0.01 + Math.abs(Math.sin(k * Math.PI * 1.5)) * (1 - k) * 0.12;
      this.spinRate *= Math.exp(-dt * 6); this.spin += this.spinRate * dt;
    } else {
      this.quat.slerp(new THREE.Quaternion(), Math.min(1, dt * 8));
      this.spinRate *= 0.9; this.spin += this.spinRate * dt;
    }
    m.quaternion.copy(this.quat);
    inner.rotation.y = this.spin;

    // rastro
    if (mode === 'flight') {
      this.trailPts.unshift({ x: s.x, y: s.y + 0.06, z: s.z });
      if (this.trailPts.length > this.trailN) this.trailPts.pop();
    } else { this.trailPts.splice(-3, 3); }
    this._buildTrail(camera, s);

    // sombra
    const h = Math.max(0, s.y);
    this.shadow.position.set(s.x, 0.015, s.z);
    const ss = 0.32 + h * 0.06;
    this.shadow.scale.set(ss, ss, ss);
    this.shadow.material.opacity = Math.max(0.15, 0.8 - h * 0.07);
    this.shadow.visible = mode !== 'hidden';
  }

  _buildTrail(camera, s) {
    const n = this.trailPts.length;
    const pos = this.trailPos, col = this.trailCol;
    const cam = camera.position;
    const c = this.fire ? new THREE.Color('#ff6a00') : this.trailColor;
    const speed = Math.hypot(s.vx, s.vy, s.vz);
    const wBase = (this.fire ? 0.09 : 0.05) + Math.min(speed, 30) * 0.0018;
    for (let i = 0; i < this.trailN; i++) {
      const p = this.trailPts[Math.min(i, Math.max(0, n - 1))] || { x: s.x, y: s.y, z: s.z };
      const q = this.trailPts[Math.min(i + 1, n - 1)] || p;
      let dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
      if (i === n - 1 && n > 1) { const r = this.trailPts[i - 1]; dx = r.x - p.x; dy = r.y - p.y; dz = r.z - p.z; }
      const vx = cam.x - p.x, vy = cam.y - p.y, vz = cam.z - p.z;
      let nx = dy * vz - dz * vy, ny = dz * vx - dx * vz, nz = dx * vy - dy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      const f = i < n ? 1 - i / this.trailN : 0;
      const w = wBase * f;
      nx = nx / l * w; ny = ny / l * w; nz = nz / l * w;
      const o = i * 6;
      pos[o] = p.x + nx; pos[o + 1] = p.y + ny; pos[o + 2] = p.z + nz;
      pos[o + 3] = p.x - nx; pos[o + 4] = p.y - ny; pos[o + 5] = p.z - nz;
      const a = i < n ? Math.pow(f, 1.6) * (this.fire ? 0.95 : 0.6) : 0;
      const k = i * 8;
      const cr = this.fire ? THREE.MathUtils.lerp(1, c.r, i / n) : c.r;
      const cg = this.fire ? THREE.MathUtils.lerp(0.95, c.g, Math.min(1, i / (n * 0.4))) : c.g;
      col[k] = cr; col[k + 1] = cg; col[k + 2] = c.b; col[k + 3] = a;
      col[k + 4] = cr; col[k + 5] = cg; col[k + 6] = c.b; col[k + 7] = a;
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.color.needsUpdate = true;
  }

  showMarker(x, z, timeLeft, t, out = false) {
    const mk = this.marker;
    mk.visible = true;
    mk.material.color.set(out ? '#ff4d4d' : '#fff7c2');
    mk.position.set(x, 0.02, z);
    const s = 0.5 + Math.min(timeLeft, 2) * 0.55 + Math.sin(t * 10) * 0.04;
    mk.scale.set(s, s, s);
    mk.material.opacity = 0.35 + 0.5 * (1 - Math.min(timeLeft, 2) / 2);
  }
  hideMarker() { this.marker.visible = false; }
  showAim(x, z, inside, t) {
    const a = this.aim;
    a.visible = true; a.position.set(x, 0.025, z);
    const s = 0.75 + Math.sin(t * 6) * 0.06; a.scale.set(s, s, s);
    a.material.color.set(inside ? '#7dff8a' : '#ff5c5c');
    a.material.opacity = 0.75;
  }
  hideAim() { this.aim.visible = false; }
}
