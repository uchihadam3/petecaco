// Interface: HUD da partida, telas, toasts
import { Audio } from './audio.js';

const $ = (s) => document.querySelector(s);

class HUD {
  constructor(ui) {
    this.ui = ui;
    this.el = $('#hud');
    this.banEl = $('#banner');
    this.popups = $('#popups');
    this.speechT = null; this.banT = null;
  }
  show(v) { this.el.classList.toggle('show', v); if (!v) { this.fire(false); this.serveMeter(false); this.hint(null); $('#introcard').classList.remove('on'); } }
  setNames(me, opp, practice) {
    $('#hud-me').textContent = me || 'VOCÊ';
    $('#hud-op').textContent = opp.name;
    $('#hud-face').src = this.ui.portraits[opp.id] || '';
    this.practice = practice;
    document.querySelector('.scoreboard').style.display = practice ? 'none' : '';
  }
  setScore(m, server) {
    const pm = $('#hud-pts-me'), po = $('#hud-pts-op');
    const bump = (el, v) => { if (el.textContent !== String(v)) { el.textContent = v; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } };
    bump(pm, m.points[0]); bump(po, m.points[1]);
    const sets = (n, won) => Array.from({ length: n }, (_, i) => `<i class="${i < won ? 'on' : ''}"></i>`).join('');
    $('#hud-sets-me').innerHTML = m.fmt.setsToWin > 1 ? sets(m.fmt.setsToWin, m.sets[0]) : '';
    $('#hud-sets-op').innerHTML = m.fmt.setsToWin > 1 ? sets(m.fmt.setsToWin, m.sets[1]) : '';
    $('#hud-serve').textContent = server > 0 ? '● SEU SAQUE' : 'SAQUE DELE ●';
    this.rally(m.rally);
  }
  rally(n) {
    const r = $('#hud-rally');
    if (n >= 4) { r.innerHTML = `RALI <b>${n}</b>`; r.classList.add('on'); } else r.classList.remove('on');
  }
  introCard(opp, round, arena) {
    const c = $('#introcard');
    c.innerHTML = `<img src="${this.ui.portraits[opp.id] || ''}"><div><div class="ic-round">${round} • ${arena}</div><div class="ic-name">${opp.name}</div><div class="ic-nick">"${opp.nick}" ${'★'.repeat(Math.floor(opp.stars))}${opp.stars % 1 ? '½' : ''}</div><div class="ic-q">“${opp.quote}”</div></div>`;
    setTimeout(() => c.classList.add('on'), 300);
    setTimeout(() => c.classList.remove('on'), 3400);
  }
  countdown(cb) {
    const el = $('#countdown');
    const seq = ['3', '2', '1', 'VALENDO!'];
    let i = 0;
    const next = () => {
      if (i >= seq.length) { el.innerHTML = ''; cb(); return; }
      const s = seq[i];
      el.innerHTML = `<span class="n ${i === 3 ? 'go' : ''}">${s}</span>`;
      Audio.beep(i === 3);
      i++;
      setTimeout(next, i === 4 ? 650 : 620);
    };
    next();
  }
  serveMeter(v) { $('#servemeter').classList.toggle('on', v); }
  serveValue(v) { $('#sm-needle').style.left = (v * 100) + '%'; }
  hint(text) {
    const h = $('#hint');
    if (text) { h.textContent = text; h.classList.add('on'); } else h.classList.remove('on');
  }
  popup(text, cls = 'good', combo = 0, big = false) {
    const d = document.createElement('div');
    d.className = 'popup ' + cls + (big ? ' smash' : '');
    d.innerHTML = text + (combo >= 2 ? `<span class="combo">COMBO x${combo}</span>` : '');
    d.style.left = (50 + (Math.random() - 0.5) * 8) + '%';
    this.popups.appendChild(d);
    setTimeout(() => d.remove(), 950);
    if (cls === 'perfect' || big) this.ui.flash();
  }
  banner(main, sub = '', kind = 'win', dur = 1.7) {
    const b = this.banEl;
    b.querySelector('.b-main').textContent = main;
    b.querySelector('.b-sub').textContent = sub;
    b.classList.toggle('lose', kind === 'lose');
    b.classList.add('on');
    clearTimeout(this.banT);
    this.banT = setTimeout(() => b.classList.remove('on'), dur * 1000);
  }
  call(text) { const c = $('#call'); c.textContent = text; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); Audio.ooh(); }
  speech(text) {
    const s = $('#hud-speech'); s.textContent = text; s.classList.add('on');
    clearTimeout(this.speechT); this.speechT = setTimeout(() => s.classList.remove('on'), 2600);
  }
  fire(v) { $('#fire').classList.toggle('on', v); document.body.classList.toggle('fire', v); }
  dash(cd) {
    const d = $('#dashcd');
    d.classList.toggle('on', cd > 0);
    if (cd > 0) d.firstElementChild.style.width = (100 - (cd / 0.9) * 100) + '%';
  }
}

export class UI {
  constructor() {
    this.portraits = {};
    this.hud = new HUD(this);
    this.stack = [];
    this.current = null;
  }
  show(id, push = true) {
    document.querySelectorAll('.screen.show').forEach(s => { if (s.id !== 'pause') s.classList.remove('show'); });
    if (id) { const el = document.getElementById(id); el.classList.add('show'); el.scrollTop = 0; }
    if (push && this.current && this.current !== id) this.stack.push(this.current);
    this.current = id;
  }
  back() {
    const prev = this.stack.pop() || 'menu';
    this.show(prev, false);
    return prev;
  }
  hideAll() { document.querySelectorAll('.screen.show').forEach(s => s.classList.remove('show')); this.current = null; }
  flash() { const f = $('#flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
  toast(a) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="ti">${a.icon}</span><div>${a.name}<small>${a.desc}</small></div>`;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 4100);
  }
  toastText(icon, title, sub = '') { this.toast({ icon, name: title, desc: sub }); }
}
