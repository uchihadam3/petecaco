// Construção dos cenários: Praça, Praia e Arena (ginásio)
import * as THREE from '../lib/three.module.min.js';
import { COURT } from './data.js';
import { Character } from './character.js';

let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rr = (a, b) => a + rnd() * (b - a);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

function canvasTex(w, h, draw, repeat = null, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 8;
  return t;
}

function noiseFill(g, w, h, base, vary, n = 6000, size = 2) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const c = vary[Math.floor(Math.random() * vary.length)];
    g.fillStyle = c; g.globalAlpha = 0.15 + Math.random() * 0.35;
    const s = size * (0.5 + Math.random());
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  g.globalAlpha = 1;
}

// ------------------------------------------------------------
// textura da quadra (área 9.5 x 17 m)
function courtTexture(opt) {
  const M = 1; // margem em metros
  const W = COURT.halfW * 2 + M * 2, L = COURT.halfL * 2 + M * 2;
  const ppm = 120;
  return canvasTex(Math.round(W * ppm), Math.round(L * ppm), (g, w, h) => {
    const X = (m) => (m + W / 2) * ppm, Y = (m) => (m + L / 2) * ppm;
    if (opt.surroundTex) opt.surroundTex(g, w, h); else { g.fillStyle = opt.surround; g.fillRect(0, 0, w, h); }
    if (opt.court) {
      g.fillStyle = opt.court; g.fillRect(X(-COURT.halfW), Y(-COURT.halfL), COURT.halfW * 2 * ppm, COURT.halfL * 2 * ppm);
      if (opt.courtNoise) {
        for (let i = 0; i < 9000; i++) { g.fillStyle = opt.courtNoise[i % opt.courtNoise.length]; g.globalAlpha = 0.08 + Math.random() * 0.1; g.fillRect(X(-COURT.halfW) + Math.random() * COURT.halfW * 2 * ppm, Y(-COURT.halfL) + Math.random() * COURT.halfL * 2 * ppm, 3, 3); }
        g.globalAlpha = 1;
      }
      if (opt.zone) { g.fillStyle = opt.zone; g.fillRect(X(-COURT.halfW), Y(-2), COURT.halfW * 2 * ppm, 4 * ppm); }
    }
    const lw = 0.05 * ppm;
    g.strokeStyle = opt.line; g.lineWidth = lw;
    if (opt.rope) { g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 6; g.lineWidth = lw * 1.2; }
    g.strokeRect(X(-COURT.halfW) + lw / 2, Y(-COURT.halfL) + lw / 2, COURT.halfW * 2 * ppm - lw, COURT.halfL * 2 * ppm - lw);
    g.beginPath(); g.moveTo(X(-COURT.halfW), Y(0)); g.lineTo(X(COURT.halfW), Y(0)); g.stroke();
    if (!opt.rope) {
      g.lineWidth = lw * 0.8;
      for (const z of [-2, 2]) { g.beginPath(); g.moveTo(X(-COURT.halfW), Y(z)); g.lineTo(X(COURT.halfW), Y(z)); g.stroke(); }
    }
    g.shadowBlur = 0;
    if (opt.logo) {
      g.save(); g.globalAlpha = 0.22; g.fillStyle = opt.line; g.font = `900 ${0.9 * ppm}px "Lilita One", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const s of [-1, 1]) { g.save(); g.translate(X(0), Y(s * 4.8)); if (s > 0) g.rotate(Math.PI); g.fillText(opt.logo, 0, 0); g.restore(); }
      g.restore();
    }
  });
}

// ------------------------------------------------------------
function makeSky(top, mid, bottom, sunDir, sunColor, sunSize = 900) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bottom: { value: new THREE.Color(bottom) }, sunDir: { value: sunDir.clone().normalize() }, sunColor: { value: new THREE.Color(sunColor) }, sunSize: { value: sunSize } },
    vertexShader: 'varying vec3 vW; void main(){ vW = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vW,1.0); }',
    fragmentShader: `uniform vec3 top, mid, bottom, sunDir, sunColor; uniform float sunSize; varying vec3 vW;
      void main(){ vec3 d = normalize(vW); float h = d.y;
        vec3 c = h > 0.0 ? mix(mid, top, pow(smoothstep(0.0, 0.6, h), 0.7)) : mix(mid, bottom, smoothstep(0.0, -0.15, h));
        float s = max(dot(d, sunDir), 0.0);
        c += sunColor * (pow(s, sunSize) * 2.5 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.12);
        gl_FragColor = vec4(c, 1.0); }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), mat);
  m.renderOrder = -10;
  return m;
}

// ------------------------------------------------------------
function buildNet(group, postColor = '#e8e8e8') {
  const postMat = new THREE.MeshStandardMaterial({ color: postColor, roughness: 0.4, metalness: 0.6 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, COURT.netH + 0.15, 12), postMat);
    p.position.set(s * COURT.postX, (COURT.netH + 0.15) / 2, 0); p.castShadow = true; group.add(p);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 16), postMat); base.position.set(s * COURT.postX, 0.04, 0); group.add(base);
  }
  const netTex = canvasTex(512, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(20,20,20,0.9)'; g.lineWidth = 1.6;
    const cell = 8;
    for (let x = 0; x <= w; x += cell) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += cell) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
  netTex.wrapS = THREE.RepeatWrapping; netTex.repeat.set(4, 1);
  const W = COURT.postX * 2, H = COURT.netDepth;
  const geo = new THREE.PlaneGeometry(W, H, 48, 8);
  const net = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, roughness: 0.9 }));
  net.position.set(0, COURT.netH - H / 2, 0);
  group.add(net);
  const tapeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
  const tape = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, 0.012), tapeMat); tape.position.set(0, COURT.netH - 0.03, 0); group.add(tape);
  const btape = new THREE.Mesh(new THREE.BoxGeometry(W, 0.025, 0.01), tapeMat); btape.position.set(0, COURT.netH - H, 0); group.add(btape);
  // cabo
  const base = geo.attributes.position.array.slice();
  const ripples = [];
  return {
    mesh: net,
    hit(x, y, strength = 1) { ripples.push({ x, y: y - net.position.y, t: 0, s: strength }); if (ripples.length > 4) ripples.shift(); },
    update(dt) {
      const pos = geo.attributes.position.array;
      let active = false;
      for (const r of ripples) r.t += dt;
      for (let i = 0; i < pos.length; i += 3) {
        const x = base[i], y = base[i + 1];
        let z = 0;
        for (const r of ripples) {
          if (r.t > 1.6) continue; active = true;
          const d = Math.hypot(x - r.x, (y - r.y) * 1.5);
          z += Math.exp(-d * 1.6) * Math.exp(-r.t * 3) * Math.sin(r.t * 22 - d * 4) * 0.12 * r.s;
        }
        pos[i + 2] = z;
      }
      if (active) geo.attributes.position.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------
// Torcida instanciada
function makeCrowd(spots, opts = {}) {
  const n = spots.length;
  const shirtCols = opts.colors || ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#ffffff', '#9b59b6', '#e67e22', '#1abc9c', '#009c3b', '#ffdf00', '#002776', '#ff7675', '#2d3436'];
  const skinCols = ['#f3d1b0', '#e0ac7e', '#c68642', '#8d5524', '#5d3a1a', '#a8714a'];
  const bodyG = new THREE.CapsuleGeometry(0.2, 0.35, 2, 7);
  const headG = new THREE.SphereGeometry(0.12, 7, 5);
  const armG = new THREE.CapsuleGeometry(0.05, 0.4, 1, 4);
  const bodies = new THREE.InstancedMesh(bodyG, new THREE.MeshStandardMaterial({ roughness: 0.85 }), n);
  const heads = new THREE.InstancedMesh(headG, new THREE.MeshStandardMaterial({ roughness: 0.7 }), n);
  const arms = new THREE.InstancedMesh(armG, new THREE.MeshStandardMaterial({ roughness: 0.7 }), n * 2);
  const c = new THREE.Color();
  const data = spots.map((s, i) => {
    bodies.setColorAt(i, c.set(pick(shirtCols)));
    const sk = pick(skinCols);
    heads.setColorAt(i, c.set(sk));
    arms.setColorAt(i * 2, c.set(sk)); arms.setColorAt(i * 2 + 1, c.set(sk));
    return { ...s, ph: rnd() * Math.PI * 2, f: rr(5, 9), cheerTh: rnd(), scale: rr(0.88, 1.12) };
  });
  bodies.castShadow = false; heads.castShadow = false;
  const d = new THREE.Object3D();
  const grp = new THREE.Group(); grp.add(bodies, heads, arms);
  let cheer = 0, cheerSide = 0;
  function update(t, excite, dt) {
    cheer = Math.max(0, cheer - dt * 0.45);
    for (let i = 0; i < n; i++) {
      const s = data[i];
      const lvl = Math.min(1, excite * 0.5 + cheer * (s.side === undefined || cheerSide === 0 || s.side === cheerSide ? 1 : 0.4));
      const jumping = lvl > 0.35 + s.cheerTh * 0.5;
      const bob = jumping ? Math.max(0, Math.sin(t * s.f + s.ph)) * 0.25 * lvl : Math.sin(t * 2 + s.ph) * 0.015;
      const sc = s.scale;
      const by = s.y + (s.seated ? 0.35 : 0.62) * sc + bob + (jumping && s.seated ? 0.25 : 0);
      d.position.set(s.x, by, s.z); d.rotation.set(0, s.rot, 0); d.scale.set(sc, sc, sc * 0.8); d.updateMatrix();
      bodies.setMatrixAt(i, d.matrix);
      d.position.set(s.x, by + 0.42 * sc, s.z); d.scale.setScalar(sc); d.updateMatrix();
      heads.setMatrixAt(i, d.matrix);
      const up = jumping ? 1 : 0;
      for (let a = 0; a < 2; a++) {
        const sx = a ? 1 : -1;
        const lx = Math.cos(s.rot) * 0.24 * sx, lz = -Math.sin(s.rot) * 0.24 * sx;
        if (up) {
          d.position.set(s.x + lx * 1.05, by + 0.52 * sc + Math.sin(t * s.f * 1.3 + s.ph + a) * 0.04, s.z + lz * 1.05);
          d.rotation.set(0, s.rot, sx * (0.25 + Math.sin(t * s.f + a * 2) * 0.15));
        } else {
          d.position.set(s.x + lx, by - 0.05, s.z + lz);
          d.rotation.set(0, s.rot, sx * 0.12);
        }
        d.scale.setScalar(sc); d.updateMatrix();
        arms.setMatrixAt(i * 2 + a, d.matrix);
      }
    }
    bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; arms.instanceMatrix.needsUpdate = true;
  }
  update(0, 0, 0);
  return { group: grp, update, cheer(v = 1, side = 0) { cheer = Math.min(1.4, cheer + v); cheerSide = side; } };
}

// ------------------------------------------------------------
function scoreboardCanvas() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (info = {}) => {
    const g = c.getContext('2d');
    g.fillStyle = '#05070d'; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#1e90ff'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 244);
    g.fillStyle = '#ffdf00'; g.font = '900 34px "Lilita One", Impact, sans-serif'; g.textAlign = 'center';
    g.fillText(info.title || 'PETECAÇO', 256, 50);
    g.font = '700 30px "Nunito", Arial, sans-serif'; g.fillStyle = '#fff';
    g.fillText((info.a || 'VOCÊ').toUpperCase().slice(0, 12), 128, 100);
    g.fillText((info.b || 'ADVERSÁRIO').toUpperCase().slice(0, 12), 384, 100);
    g.font = '900 96px "Lilita One", Impact, sans-serif';
    g.fillStyle = '#39ff88'; g.fillText(String(info.pa ?? 0), 128, 205);
    g.fillStyle = '#ff5c7a'; g.fillText(String(info.pb ?? 0), 384, 205);
    g.fillStyle = '#ffffff'; g.font = '700 26px "Nunito", Arial'; g.fillText(`SETS ${info.sa ?? 0} - ${info.sb ?? 0}`, 256, 238);
    g.fillStyle = '#ffdf00'; g.font = '900 60px Impact'; g.fillText('×', 256, 190);
    tex.needsUpdate = true;
  };
  draw();
  return { tex, draw };
}

function scrollingBoard(texts, bg, fg) {
  const t = canvasTex(1024, 64, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.font = '900 40px "Lilita One", Impact, sans-serif'; g.textBaseline = 'middle';
    let x = 10; let i = 0;
    while (x < w) { const s = texts[i++ % texts.length]; g.fillStyle = i % 2 ? fg : '#ffffff'; g.fillText(s, x, h / 2 + 2); x += g.measureText(s).width + 50; g.fillStyle = '#ffdf00'; g.fillText('★', x - 38, h / 2); }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// ------------------------------------------------------------
function tree(x, z, s = 1, cols = ['#2e8b3e', '#3aa24c', '#277a36']) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.22 * s, 3 * s, 7), new THREE.MeshStandardMaterial({ color: '#6b4a2f', roughness: 0.9 }));
  trunk.position.y = 1.5 * s; trunk.castShadow = true; g.add(trunk);
  const n = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(rr(1.0, 1.6) * s, 1), new THREE.MeshStandardMaterial({ color: pick(cols), roughness: 0.85, flatShading: true }));
    b.position.set(rr(-1, 1) * s, (3 + rr(0, 1.6)) * s, rr(-1, 1) * s); b.castShadow = true; g.add(b);
  }
  g.position.set(x, 0, z);
  return g;
}

function palm(x, z, s = 1) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#8a6a45', roughness: 0.9 });
  let px = 0, py = 0, pz = 0;
  const lean = rr(-0.25, 0.25), leanZ = rr(-0.2, 0.2);
  const segs = 9;
  for (let i = 0; i < segs; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s - i * 0.008, 0.19 * s - i * 0.008, 0.9 * s, 8), trunkMat);
    const bend = i / segs;
    px += lean * bend * 0.6 * s; pz += leanZ * bend * 0.6 * s; py += 0.88 * s;
    seg.position.set(px, py - 0.45 * s, pz); seg.rotation.z = -lean * bend * 0.8; seg.rotation.x = leanZ * bend * 0.8; seg.castShadow = true; g.add(seg);
  }
  const leafTex = canvasTex(64, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(w / 2, 0); c.quadraticCurveTo(w, h * 0.3, w / 2, h); c.quadraticCurveTo(0, h * 0.3, w / 2, 0); c.fill();
    c.globalCompositeOperation = 'destination-out';
    for (let y = 20; y < h; y += 9) { c.beginPath(); c.moveTo(0, y); c.lineTo(w * 0.42, y + 6); c.lineTo(0, y + 4); c.fill(); c.beginPath(); c.moveTo(w, y); c.lineTo(w * 0.58, y + 6); c.lineTo(w, y + 4); c.fill(); }
  });
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, color: '#3f9b3a', side: THREE.DoubleSide, alphaTest: 0.4, roughness: 0.8 });
  const lg = new THREE.PlaneGeometry(0.9 * s, 3.2 * s, 1, 8);
  const p = lg.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / (3.2 * s) + 0.5; p.setZ(i, -y * y * 1.6 * s); p.setY(i, y * 3.0 * s); }
  lg.computeVertexNormals();
  const crown = new THREE.Group(); crown.position.set(px, py, pz); g.add(crown);
  for (let i = 0; i < 9; i++) {
    const l = new THREE.Mesh(lg, leafMat); l.rotation.order = 'YXZ';
    l.rotation.y = (i / 9) * Math.PI * 2 + rr(-0.2, 0.2); l.rotation.x = -1.0 + rr(-0.25, 0.2); l.castShadow = true;
    crown.add(l);
  }
  const coco = new THREE.MeshStandardMaterial({ color: '#5a3d1e', roughness: 0.8 });
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 8, 6), coco); c.position.set(px + Math.cos(i * 2) * 0.18, py - 0.15, pz + Math.sin(i * 2) * 0.18); g.add(c); }
  g.userData.crown = crown;
  g.position.set(x, 0, z);
  return g;
}

let winTex = null;
const bldMats = new Map();
function building(x, z, w, h, d, color, rotY = 0) {
  if (!winTex) {
    winTex = canvasTex(128, 128, (g, W, H) => {
      g.fillStyle = '#f2efe8'; g.fillRect(0, 0, W, H);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
        const lit = (r + c) % 3 === 0;
        g.fillStyle = lit ? '#ffe9a8' : '#2a3550';
        g.fillRect(c * 64 + 14, r * 64 + 16, 36, 28);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(c * 64 + 10, r * 64 + 46, 44, 4);
      }
    }, [1, 1]);
  }
  if (!bldMats.has(color)) bldMats.set(color, new THREE.MeshStandardMaterial({ map: winTex, color, roughness: 0.9 }));
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const su = f < 2 ? d / 5 : w / 5, sv = f === 2 || f === 3 ? d / 5 : h / 6;
    for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * Math.max(1, Math.round(su)), uv.getY(k) * Math.max(1, Math.round(sv))); }
  }
  const m = new THREE.Mesh(geo, bldMats.get(color));
  m.position.set(x, h / 2, z); m.rotation.y = rotY;
  return m;
}

function umbrella(x, z, cols) {
  const g = new THREE.Group();
  const tex = canvasTex(256, 32, (c, w, h) => { const n = 8; for (let i = 0; i < n; i++) { c.fillStyle = cols[i % cols.length]; c.fillRect(i * w / n, 0, w / n, h); } });
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.55, 16, 1, true), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
  top.position.y = 2.25; top.castShadow = true; g.add(top);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6), new THREE.MeshStandardMaterial({ color: '#eee' })); pole.position.y = 1.15; g.add(pole);
  g.position.set(x, 0, z); g.rotation.z = rr(-0.08, 0.08);
  return g;
}

function addCourtFloor(group, opt, quality) {
  const tex = courtTexture(opt);
  const M = 1;
  const geo = new THREE.PlaneGeometry(COURT.halfW * 2 + M * 2, COURT.halfL * 2 + M * 2);
  const court = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: opt.rough ?? 0.7, metalness: 0 }));
  court.rotation.x = -Math.PI / 2; court.position.y = 0.005; court.receiveShadow = true;
  group.add(court);
  return court;
}

function referee(group, x, z, look) {
  const chairMat = new THREE.MeshStandardMaterial({ color: '#c8a06a', roughness: 0.7 });
  const chair = new THREE.Group();
  for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), chairMat); l.position.set(dx, 0.8, dz); chair.add(l); }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.7), chairMat); seat.position.y = 1.6; chair.add(seat);
  const backr = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.05), chairMat); backr.position.set(-0.33, 1.9, 0); backr.rotation.y = Math.PI / 2; chair.add(backr);
  chair.position.set(x, 0, z); group.add(chair);
  const ref = new Character(look);
  ref.root.position.set(x, 0.75, z);
  ref.yaw = Math.PI / 2 * Math.sign(-x);
  ref.mood = 'sit';
  ref.root.userData.noMerge = true;
  group.add(ref.root);
  return ref;
}


// junta malhas estáticas com o mesmo material (menos draw calls = roda liso no celular)
function autoMerge(group) {
  group.updateMatrixWorld(true);
  const skip = new Set();
  group.traverse(o => { if (o.userData.noMerge) o.traverse(c => skip.add(c)); });
  const buckets = new Map();
  group.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || skip.has(o) || Array.isArray(o.material)) return;
    const m = o.material;
    if (!(m.isMeshStandardMaterial || m.isMeshBasicMaterial)) return;
    const g = o.geometry;
    if (!g.attributes.uv || !g.attributes.normal || g.morphAttributes.position) return;
    const key = [m.type, m.color.getHexString(), m.roughness, m.metalness, m.emissive ? m.emissive.getHexString() : '', m.emissiveIntensity, m.flatShading, m.transparent, m.opacity, m.side, m.alphaTest, m.map ? m.map.uuid : '', m.vertexColors, m.toneMapped, m.fog, o.castShadow, o.receiveShadow, o.renderOrder].join('|');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  let merged = 0;
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const parts = []; let count = 0;
    for (const o of list) {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      parts.push(g); count += g.attributes.position.count;
    }
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2);
    let off = 0;
    for (const g of parts) {
      pos.set(g.attributes.position.array, off * 3); nor.set(g.attributes.normal.array, off * 3); uv.set(g.attributes.uv.array, off * 2);
      off += g.attributes.position.count; g.dispose();
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    mg.computeBoundingSphere(); mg.computeBoundingBox();
    const mesh = new THREE.Mesh(mg, list[0].material);
    mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow; mesh.renderOrder = list[0].renderOrder;
    for (const o of list) { o.parent.remove(o); }
    group.add(mesh);
    merged += list.length;
  }
  return merged;
}

// ------------------------------------------------------------
export function buildArena(id, quality = 'high') {
  winTex = null; bldMats.clear();
  seed = id === 'praia' ? 77 : id === 'ginasio' ? 1234 : 9;
  const group = new THREE.Group();
  const hq = quality === 'high', lq = quality === 'low';
  const res = { group, id, surface: 'hard', updaters: [], crowd: null, net: null, score: null, ref: null, sun: null, fog: null, bg: null };
  let sunDir;

  if (id === 'praca') {
    res.surface = 'hard';
    sunDir = new THREE.Vector3(-0.6, 0.55, -0.45);
    group.add(makeSky('#3d8fe0', '#bfe2ff', '#9ab27a', sunDir, '#fff1c9', 1200));
    res.fog = new THREE.Fog('#bfdcf5', 40, 160);
    const hemi = new THREE.HemisphereLight('#cfe8ff', '#5f7a45', 0.9); group.add(hemi);
    // chão (grama) e piso de cimento
    const grass = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#5c9b45', ['#4a8a38', '#6fb054', '#3e7a2e', '#7cbc5c'], 5000, 3), [60, 60]);
    const g0 = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
    g0.rotation.x = -Math.PI / 2; g0.receiveShadow = true; group.add(g0);
    const conc = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#9aa0a6', ['#8a9096', '#b0b5ba', '#7d8389'], 6000, 2), [6, 8]);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(18, 26), new THREE.MeshStandardMaterial({ map: conc, roughness: 0.95 }));
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.003; pad.receiveShadow = true; group.add(pad);
    addCourtFloor(group, { surround: '#2f7d5b', court: '#2f6fb5', zone: '#3a7cc2', line: '#ffffff', courtNoise: ['#245a96', '#3b82cf'], logo: 'PETECAÇO', rough: 0.8 }, quality);
    // alambrado
    const fenceTex = canvasTex(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(200,205,210,0.95)'; g.lineWidth = 3;
      for (let i = -w; i < w * 2; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); }
    }, [1, 1]);
    const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6 });
    const postMat = new THREE.MeshStandardMaterial({ color: '#5a6168', metalness: 0.6, roughness: 0.4 });
    const fx = 9, fz = 13, fh = 3.2;
    const fences = [[0, -fz, fx * 2, 0], [0, fz, fx * 2, 0], [-fx, 0, fz * 2, Math.PI / 2], [fx, 0, fz * 2, Math.PI / 2]];
    for (const [x, z, len, r] of fences) {
      const t = fenceTex.clone(); t.needsUpdate = true; t.repeat.set(len / 1.2, fh / 1.2);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, fh), fenceMat.clone()); m.material.map = t;
      m.position.set(x, fh / 2, z); m.rotation.y = r; group.add(m);
      const n = Math.round(len / 3);
      for (let i = 0; i <= n; i++) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, fh, 6), postMat);
        const a = -len / 2 + i * len / n;
        p.position.set(x + (r ? 0 : a), fh / 2, z + (r ? a : 0)); group.add(p);
      }
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), postMat); rail.rotation.z = Math.PI / 2; if (r) rail.rotation.set(Math.PI / 2, 0, 0); rail.position.set(x, fh, z); group.add(rail);
    }
    // árvores
    const tn = lq ? 10 : 22;
    for (let i = 0; i < tn; i++) {
      const a = rnd() * Math.PI * 2, d = rr(17, 38);
      group.add(tree(Math.cos(a) * d, Math.sin(a) * d * 1.2, rr(0.9, 1.5)));
    }
    // prédios coloridos
    const bcols = ['#f6d365', '#fda085', '#84fab0', '#a1c4fd', '#ffb3c1', '#f4a261', '#e9c46a', '#e76f51', '#90be6d'];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rr(-0.1, 0.1), d = rr(55, 75);
      const b = building(Math.cos(a) * d, Math.sin(a) * d, rr(8, 16), rr(8, 30), rr(8, 14), pick(bcols), -a + Math.PI / 2);
      group.add(b);
    }
    // bancos + postes
    const benchMat = new THREE.MeshStandardMaterial({ color: '#a0522d', roughness: 0.8 });
    const spots = [];
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const z = -9 + i * 6;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 2.4), benchMat); b.position.set(s * 10.5, 0.48, z); b.castShadow = true; group.add(b);
      const bb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 2.4), benchMat); bb.position.set(s * 10.75, 0.8, z); group.add(bb);
      for (let k = 0; k < 3; k++) if (rnd() < 0.8) spots.push({ x: s * 10.5, y: 0.1, z: z - 0.8 + k * 0.8, rot: s > 0 ? -Math.PI / 2 : Math.PI / 2, seated: true, side: 0 });
      const lamp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5, 8), postMat); pole.position.y = 2.5; lamp.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff7d6', emissive: '#fff2b0', emissiveIntensity: 0.6 })); head.position.y = 5.1; lamp.add(head);
      lamp.position.set(s * 11.5, 0, z + 3); group.add(lamp);
    }
    // gente em pé fora do alambrado (fundo)
    for (let i = 0; i < (lq ? 14 : 30); i++) spots.push({ x: rr(-8, 8), y: 0, z: -14 - rr(0, 3), rot: 0, seated: false });
    for (let i = 0; i < (lq ? 6 : 14); i++) spots.push({ x: rr(-8, 8), y: 0, z: 14 + rr(0, 2), rot: Math.PI, seated: false });
    res.crowd = makeCrowd(spots);
    group.add(res.crowd.group);
    // placar no poste
    res.score = scoreboardCanvas();
    const sb = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: res.score.tex, toneMapped: false }));
    sb.position.set(-7.2, 3.2, -3); sb.rotation.y = 0.6; group.add(sb);
    const sbp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), postMat); sbp.position.set(-7.2, 1.3, -3); group.add(sbp);
    // carrinho de pipoca
    const cart = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 0.8), new THREE.MeshStandardMaterial({ color: '#e63946' })); box.position.y = 0.9; cart.add(box);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.7), new THREE.MeshStandardMaterial({ color: '#fff3b0', transparent: true, opacity: 0.6, emissive: '#ffd166', emissiveIntensity: 0.3 })); glass.position.y = 1.75; cart.add(glass);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.5, 4), new THREE.MeshStandardMaterial({ color: '#ffffff' })); roof.position.y = 2.35; roof.rotation.y = Math.PI / 4; cart.add(roof);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 12), new THREE.MeshStandardMaterial({ color: '#333' })); w.position.set(s * 0.5, 0.25, 0.42); cart.add(w); }
    cart.position.set(7.5, 0, -15.5); group.add(cart);
    res.ref = referee(group, -5.6, 0.0, { skin: '#c68642', hair: 'short', hairColor: '#222', shirt: '#111111', shorts: '#111111', shoes: '#111', height: 0.98 });
  }

  else if (id === 'praia') {
    res.surface = 'sand';
    sunDir = new THREE.Vector3(-0.42, 0.075, -1);
    group.add(makeSky('#3b2a6b', '#ff9a5a', '#2a4a6b', sunDir, '#ffcf80', 600));
    res.fog = new THREE.Fog('#f0a070', 50, 260);
    group.add(new THREE.HemisphereLight('#ffb98a', '#c8956a', 0.85));
    const sandTex = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#e3c08a', ['#d4ad74', '#f1d3a0', '#c99c62', '#fbe6c0'], 9000, 2), [80, 80]);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(400, 120), new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2; sand.position.z = 25; sand.receiveShadow = true; group.add(sand);
    // quadra com linhas de fita azul
    addCourtFloor(group, {
      surroundTex: (g, w, h) => noiseFill(g, w, h, '#e3c08a', ['#d4ad74', '#f1d3a0', '#c99c62', '#fbe6c0'], 40000, 4),
      court: null, line: '#1565c0', rope: true, rough: 1,
    }, quality);
    // mar
    const oceanMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, sunDir: { value: sunDir.clone().normalize() }, deep: { value: new THREE.Color('#123a6b') }, shallow: { value: new THREE.Color('#2a8fb0') }, horizon: { value: new THREE.Color('#ff9a6a') }, sunC: { value: new THREE.Color('#ffd28a') } },
      vertexShader: `uniform float time; varying vec3 vW; varying vec3 vN;
        void main(){ vec3 p = position; vec4 w = modelMatrix*vec4(p,1.0);
          float h = sin(w.x*0.15 + time*0.9)*0.25 + sin(w.z*0.22 - time*1.3)*0.2 + sin((w.x+w.z)*0.5 + time*2.0)*0.06;
          w.y += h;
          float dx = cos(w.x*0.15+time*0.9)*0.0375 + cos((w.x+w.z)*0.5+time*2.0)*0.03;
          float dz = cos(w.z*0.22-time*1.3)*0.044 + cos((w.x+w.z)*0.5+time*2.0)*0.03;
          vN = normalize(vec3(-dx, 1.0, -dz)); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform vec3 sunDir, deep, shallow, horizon, sunC; uniform float time; varying vec3 vW; varying vec3 vN;
        void main(){ vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vN + vec3(sin(vW.x*3.0+time*3.0)*0.04, 0.0, cos(vW.z*2.5-time*2.0)*0.04));
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          float dist = length(vW.xz - cameraPosition.xz);
          vec3 c = mix(shallow, deep, smoothstep(10.0, 80.0, dist));
          c = mix(c, horizon, clamp(fres*1.2 + smoothstep(80.0, 300.0, dist), 0.0, 1.0));
          vec3 R = reflect(-V, N); float s = max(dot(R, normalize(sunDir)), 0.0);
          c += sunC * (pow(s, 120.0)*3.0 + pow(s, 12.0)*0.25);
          float shore = smoothstep(2.5, 0.0, abs(vW.z + 30.0 + sin(vW.x*0.3 + time)*0.8));
          c = mix(c, vec3(1.0,0.97,0.92), shore*0.7*(0.6+0.4*sin(vW.x*0.8+time*2.0)));
          gl_FragColor = vec4(c, 1.0); }`,
    });
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, 420, lq ? 60 : 140, lq ? 30 : 60), oceanMat);
    ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, -0.25, -240); group.add(ocean);
    res.updaters.push((dt, t) => { oceanMat.uniforms.time.value = t; });
    // sol
    // coqueiros
    const pn = lq ? 8 : 16;
    for (let i = 0; i < pn; i++) {
      const s = i % 2 ? 1 : -1;
      const p = palm(s * rr(11, 22), rr(-24, 20), rr(0.9, 1.25)); group.add(p);
    }
    // guarda-sóis e cangas
    const ucols = [['#ff6b6b', '#ffffff'], ['#ffd93d', '#6bcB77'], ['#4d96ff', '#ffffff'], ['#ff8fab', '#ffe5ec']];
    const spots = [];
    for (let i = 0; i < (lq ? 6 : 12); i++) {
      const s = i % 2 ? 1 : -1; const x = s * rr(9, 14), z = rr(-14, 12);
      group.add(umbrella(x, z, pick(ucols)));
      const towel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.9), new THREE.MeshStandardMaterial({ color: pick(['#ff6b6b', '#4d96ff', '#ffd93d', '#c77dff']), roughness: 1 }));
      towel.rotation.x = -Math.PI / 2; towel.rotation.z = rr(-0.4, 0.4); towel.position.set(x + s * 0.6, 0.012, z + 0.4); group.add(towel);
    }
    // torcida sentada na areia (laterais) e em pé atrás
    for (const s of [-1, 1]) for (let r = 0; r < 3; r++) for (let i = 0; i < (lq ? 10 : 18); i++) {
      if (rnd() < 0.25) continue;
      spots.push({ x: s * (6.8 + r * 1.1 + rr(-0.2, 0.2)), y: 0, z: -10 + i * 1.15 + rr(-0.3, 0.3), rot: s > 0 ? -Math.PI / 2 : Math.PI / 2, seated: r === 0, side: 0 });
    }
    for (let i = 0; i < (lq ? 12 : 26); i++) spots.push({ x: rr(-9, 9), y: 0, z: -11 - rr(0, 4), rot: 0, seated: false });
    res.crowd = makeCrowd(spots, { colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ffffff', '#ff8fab', '#c77dff', '#ff9f1c', '#2ec4b6'] });
    group.add(res.crowd.group);
    // quiosque
    const k = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#a0703c', roughness: 0.9 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 1.6), wood); counter.position.y = 0.55; k.add(counter);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.6, 8), new THREE.MeshStandardMaterial({ color: '#d9b26a', roughness: 1 })); roof.position.y = 3.2; k.add(roof);
    for (const [dx, dz] of [[-1.8, -0.7], [1.8, -0.7], [-1.8, 0.7], [1.8, 0.7]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 6), wood); p.position.set(dx, 1.25, dz); k.add(p); }
    const signT = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#1b7a3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffdf00'; g.font = '900 64px "Lilita One", Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ÁGUA DE COCO', w / 2, h / 2 + 4); });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshStandardMaterial({ map: signT })); sign.position.set(0, 2.15, 0.85); k.add(sign);
    k.position.set(12, 0, -18); k.rotation.y = -0.5; group.add(k);
    res.score = scoreboardCanvas();
    const sb = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: res.score.tex, toneMapped: false }));
    sb.position.set(-7.5, 3, -4); sb.rotation.y = 0.55; group.add(sb);
    const sbp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), wood); sbp.position.set(-7.5, 1.2, -4); group.add(sbp);
    res.ref = referee(group, -5.6, 0, { skin: '#8d5524', hair: 'cap', capColor: '#ffdf00', hairColor: '#111', shirt: '#ff9f1c', shorts: '#1565c0', shoes: '#fff', height: 1 });
  }

  else { // ginásio
    res.surface = 'wood';
    sunDir = new THREE.Vector3(0.15, 1, 0.25);
    res.fog = new THREE.Fog('#141a2a', 30, 90);
    res.bg = new THREE.Color('#0b0f1a');
    group.add(new THREE.HemisphereLight('#dfe8ff', '#5a3a20', 0.75));
    group.add(new THREE.AmbientLight('#ffffff', 0.15));
    const wood = canvasTex(512, 512, (g, w, h) => {
      const ph = 32;
      for (let y = 0; y < h; y += ph) {
        let x = -Math.random() * 200;
        while (x < w) {
          const len = 120 + Math.random() * 200;
          const l = 0.5 + Math.random() * 0.12;
          g.fillStyle = `hsl(${30 + Math.random() * 6}, ${48 + Math.random() * 10}%, ${l * 100 - 8}%)`;
          g.fillRect(x, y, len, ph);
          g.strokeStyle = 'rgba(80,40,10,0.15)';
          for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x, y + 4 + Math.random() * (ph - 8)); g.bezierCurveTo(x + len / 3, y + Math.random() * ph, x + len * 0.66, y + Math.random() * ph, x + len, y + 4 + Math.random() * (ph - 8)); g.stroke(); }
          g.fillStyle = 'rgba(40,20,5,0.4)'; g.fillRect(x, y, 2, ph);
          x += len;
        }
        g.fillStyle = 'rgba(40,20,5,0.35)'; g.fillRect(0, y, w, 1.5);
      }
    }, [10, 10]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 60), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.35, metalness: 0.05 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);
    addCourtFloor(group, {
      surroundTex: (g, w, h) => { g.fillStyle = '#b8743c'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 30) { g.fillStyle = `rgba(${90 + Math.random() * 40},${40 + Math.random() * 20},10,0.18)`; g.fillRect(0, y, w, 30); } },
      court: '#1b4fa0', zone: '#2363c2', line: '#ffffff', courtNoise: ['#16428a', '#2a5fb5'], logo: 'PETECAÇO', rough: 0.4,
    }, quality);
    // paredes
    const wallTex = canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#1a2233'; g.fillRect(0, 0, w, h); g.fillStyle = '#009c3b'; g.fillRect(0, h * 0.62, w, h * 0.06); g.fillStyle = '#ffdf00'; g.fillRect(0, h * 0.68, w, h * 0.03); }, [4, 1]);
    const room = new THREE.Mesh(new THREE.BoxGeometry(46, 18, 62), new THREE.MeshStandardMaterial({ map: wallTex, side: THREE.BackSide, roughness: 0.9 }));
    room.position.y = 9; group.add(room);
    // arquibancadas
    const standMat = new THREE.MeshStandardMaterial({ color: '#2b3448', roughness: 0.8 });
    const seatCols = ['#0a7d3b', '#e0b800'];
    const spots = [];
    const rows = lq ? 5 : hq ? 9 : 7;
    const addStand = (axis, sgn, from, to, startD) => {
      for (let r = 0; r < rows; r++) {
        const d = startD + r * 0.95, y = 0.5 + r * 0.55;
        const len = to - from;
        const step = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 0.95 : len, y, axis === 'x' ? len : 0.95), standMat);
        if (axis === 'x') step.position.set(sgn * d, y / 2, (from + to) / 2); else step.position.set((from + to) / 2, y / 2, sgn * d);
        step.receiveShadow = true; group.add(step);
        const seatStrip = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 0.4 : len, 0.08, axis === 'x' ? len : 0.4), new THREE.MeshStandardMaterial({ color: seatCols[r % 2], roughness: 0.6 }));
        if (axis === 'x') seatStrip.position.set(sgn * d, y + 0.04, (from + to) / 2); else seatStrip.position.set((from + to) / 2, y + 0.04, sgn * d);
        group.add(seatStrip);
        const per = Math.floor(len / (lq ? 1.3 : hq ? 0.75 : 0.95));
        for (let i = 0; i < per; i++) {
          if (rnd() < 0.08) continue;
          const a = from + (i + 0.5) * (len / per) + rr(-0.1, 0.1);
          const rot = axis === 'x' ? (sgn > 0 ? -Math.PI / 2 : Math.PI / 2) : (sgn > 0 ? Math.PI : 0);
          if (axis === 'x') spots.push({ x: sgn * d, y: y, z: a, rot, seated: true, side: 0 }); else spots.push({ x: a, y: y, z: sgn * d, rot, seated: true, side: 0 });
        }
      }
    };
    addStand('x', 1, -13, 13, 8.6); addStand('x', -1, -13, 13, 8.6);
    addStand('z', -1, -8, 8, 13.5); addStand('z', 1, -8, 8, 13.5);
    res.crowd = makeCrowd(spots, { colors: ['#ffdf00', '#009c3b', '#002776', '#ffffff', '#ffdf00', '#009c3b', '#e74c3c', '#ffffff', '#2d3436'] });
    group.add(res.crowd.group);
    // placas de LED
    const ledTex = scrollingBoard(['PETECAÇO', 'LIGA PROFISSIONAL', 'VAI PETECA!', 'MÃO DE OURO', 'SUCO DO SEU ZÉ', 'PASTEL DA FEIRA'], '#05070d', '#39ff88');
    const ledMat = new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false });
    const leds = [[0, -10.5, 14, 0], [0, 10.5, 14, Math.PI], [-7, 0, 20, Math.PI / 2], [7, 0, 20, -Math.PI / 2]];
    for (const [x, z, len, r] of leds) {
      const t = ledTex.clone(); t.needsUpdate = true; t.repeat.set(len / 12, 1);
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.15), [new THREE.MeshStandardMaterial({ color: '#111' }), new THREE.MeshStandardMaterial({ color: '#111' }), new THREE.MeshStandardMaterial({ color: '#111' }), new THREE.MeshStandardMaterial({ color: '#111' }), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }), new THREE.MeshStandardMaterial({ color: '#111' })]);
      m.position.set(x, 0.45, z); m.rotation.y = r; group.add(m);
      res.updaters.push((dt) => { t.offset.x = (t.offset.x + dt * 0.08) % 1; });
    }
    void ledMat;
    // teto, treliças e luminárias
    const lightMat = new THREE.MeshBasicMaterial({ color: '#fffbe8', toneMapped: false });
    for (let x = -12; x <= 12; x += 6) for (let z = -18; z <= 18; z += 6) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 1.6), lightMat); l.position.set(x, 16.5, z); group.add(l);
    }
    const truss = new THREE.MeshStandardMaterial({ color: '#3a4256', metalness: 0.7, roughness: 0.4 });
    for (let z = -24; z <= 24; z += 6) { const b = new THREE.Mesh(new THREE.BoxGeometry(44, 0.3, 0.3), truss); b.position.set(0, 16.9, z); group.add(b); }
    // bandeirolas
    const flagCols = ['#009c3b', '#ffdf00', '#002776', '#ffffff', '#e74c3c'];
    const flags = [];
    for (let i = 0; i < 40; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), new THREE.MeshStandardMaterial({ color: flagCols[i % flagCols.length], side: THREE.DoubleSide, roughness: 0.8 }));
      const z = -20 + (i % 20) * 2.1, x = i < 20 ? -6 : 6;
      f.position.set(x, 14.5, z); f.rotation.y = Math.PI / 2; group.add(f); flags.push(f);
    }
    // telão
    res.score = scoreboardCanvas();
    const jm = new THREE.MeshBasicMaterial({ map: res.score.tex, toneMapped: false });
    const big = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), jm); big.position.set(0, 10.5, -30.8); group.add(big);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(12.6, 6.6, 0.3), new THREE.MeshStandardMaterial({ color: '#111' })); frame.position.set(0, 10.5, -31); group.add(frame);
    const cube = new THREE.Group();
    for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), jm); const a = i * Math.PI / 2; p.position.set(Math.sin(a) * 2, 0, Math.cos(a) * 2); p.rotation.y = a; cube.add(p); }
    const cubeBox = new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.2, 3.9), new THREE.MeshStandardMaterial({ color: '#0c0c0c' })); cube.add(cubeBox);
    cube.position.set(0, 12.5, 0); group.add(cube);
    res.ref = referee(group, -5.6, 0, { skin: '#f3d1b0', hair: 'short', hairColor: '#333', shirt: '#222', shorts: '#222', shoes: '#111', glasses: true, height: 1 });
    // spots coloridos rodando (show)
    res.spots = [];
    if (!lq) {
      for (const c of ['#4fc3ff', '#ff4fd8']) {
        const sp = new THREE.SpotLight(c, 0, 50, 0.22, 0.5, 1.2);
        sp.position.set(c === '#4fc3ff' ? -14 : 14, 15, 0); group.add(sp); group.add(sp.target);
        res.spots.push(sp);
      }
      res.updaters.push((dt, t) => { res.spots.forEach((s, i) => { s.target.position.set(Math.sin(t * 0.7 + i * 2) * 6, 0, Math.cos(t * 0.5 + i) * 8); s.intensity = Math.max(0, s.intensity - dt * 120); }); });
    }
  }

  // luz principal (sol / refletores) com sombra
  const sun = new THREE.DirectionalLight(id === 'praia' ? '#ffc080' : id === 'ginasio' ? '#ffffff' : '#fff4dd', id === 'ginasio' ? 2.2 : id === 'praia' ? 2.4 : 2.6);
  sun.position.copy(sunDir.clone().normalize().multiplyScalar(30));
  if (id === 'praia') sun.position.set(-12, 10, -30);
  sun.target.position.set(0, 0, 0);
  if (!lq) {
    sun.castShadow = true;
    const sz = hq ? 2048 : 1024;
    sun.shadow.mapSize.set(sz, sz);
    const sc = sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 80;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
  }
  group.add(sun); group.add(sun.target);
  res.sun = sun;
  if (id === 'praia') { const rim = new THREE.DirectionalLight('#9ec5ff', 0.5); rim.position.set(10, 8, 20); group.add(rim); }
  if (id === 'praca') { const fill = new THREE.DirectionalLight('#ffe8c0', 0.35); fill.position.set(10, 6, 15); group.add(fill); }

  autoMerge(group);
  res.net = buildNet(group, id === 'ginasio' ? '#d8d8d8' : '#cfcfcf');
  res.net.mesh.userData.noMerge = true;

  res.update = (dt, t, excite) => {
    for (const u of res.updaters) u(dt, t);
    if (res.crowd) res.crowd.update(t, excite, dt);
    res.net.update(dt);
  };
  res.flash = () => { if (res.spots) res.spots.forEach(s => s.intensity = 160); };
  return res;
}
