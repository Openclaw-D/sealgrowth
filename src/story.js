/* SEAL Growth homepage story. Copyright 2026 SEAL Growth. Licensed under the Apache License, Version 2.0.
 * Scroll-driven canvas: one pup -> grows through six rings -> many seals gather -> landing -> lights around the globe.
 * Decoration only: the seals and the lit points are a picture of an idea. They are not real projects, places or counts.
 * Land mask: Natural Earth 1:110m (public domain), merged and rasterised to 2 degrees by work/build-landmask.cjs.
 * Spec: docs/prd-seal-story.md. No libraries, no network, no storage. */
(function () {
  'use strict';
  var T0 = performance.now(), W = window, D = document, HTML = D.documentElement, Q = location.search || '';
  if (/[?&]story=off(&|$)/.test(Q)) return;
  var cv = D.getElementById('story');
  if (!cv || !cv.getContext) return;
  var g = cv.getContext('2d');
  if (!g || !D.querySelector('.hero .mark')) return;

  /* ---------- config and palette ---------- */
  var DEBUG = /[?&]story=debug(&|$)/.test(Q);
  var mq = W.matchMedia ? W.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduced = !!(mq && mq.matches);
  var touch = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in W;
  var PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos, abs = Math.abs, min = Math.min, max = Math.max,
    sqrt = Math.sqrt, atan2 = Math.atan2, floor = Math.floor, pow = Math.pow, DEG = PI / 180;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sat(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ss(a, b, x) { x = sat((x - a) / (b - a)); return x * x * (3 - 2 * x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function mul(a, k) { return [min(255, a[0] * k), min(255, a[1] * k), min(255, a[2] * k)]; }
  function rgba(c, al) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (al == null ? 1 : +al.toFixed(3)) + ')'; }
  // s = 0..4: sky top, sky bottom, water top, water bottom, sunlight (section 5.0)
  var KF = [['#0a1a33', '#16324f', '#0e3a5a', '#072033', 0], ['#0a1a33', '#16324f', '#0c3352', '#061a2c', 0],
    ['#0a1a33', '#16324f', '#082844', '#04121f', .05], ['#0a1a33', '#16324f', '#072238', '#030d18', .15],
    ['#6ec3f4', '#cfeeff', '#1fa3c9', '#0b5c85', 1]].map(function (k) { return [hex(k[0]), hex(k[1]), hex(k[2]), hex(k[3]), k[4]]; });
  var DAWN_TOP = hex('#2b3a67'), DAWN_LOW = hex('#f08a5d'), DAWN_GOLD = hex('#ffd27d'), SPACE = hex('#050b16');
  var SEAL_PUP = hex('#dfeaf4'), SEAL_ADULT = hex('#a9b7c6'), TRAIL = '#6fe7ff', LIT = hex('#ffd27d'), ARC = '#ffe7b0';
  var RP = [.10, .17, .20, .21, .19, .15, .10, .06, .03], RA = [.06, .11, .14, .15, .14, .11, .08, .045, .02];
  var O_LAT = -10, O_LON = -150, TILT = 23.4 * DEG;
  var LAND = /* LAND:BEGIN */'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/+Af/gAAAAAAAAAAAAAAAAAAAAAAA///////AAHgBgAADgAAAAAAAAAAAAN//////4AB/gAAAAB8AAAAAAAAAAB/Hz4////wAAZAAAcAAfwAAAAAAAAADfmvwA///wAAAAADwAf/4AHYAAAAAAH/3/8AP//gAAAAAODH///+DwAAgH8ADf73/wP//gAAA4AOH///////wAgf////7934H//AAAP/iL//////////+f//////l+H/gAAAf/7///////////c///////n8D+A+AB+/////////////Af/////508D4AIAH//////////////Af/////gHgB4AAAP5////////////4AHoP///wH+AAAAAH4//////////+cAADQB///8H+AAAAGDz/////////8A8AAMAA////v/gAAAPDv/////////4B4AAAABf///v/wAAAbv///////////AwAAAAAP/////wAAAH////////////AgAAAAAH////+8AAAD///////////9AAAAAAAD////8cAAAD///////////9AAAAAAAD/////AAAAB//7/f//////5AAAAAAAD////gAAAAf9vwPP//////zgAAAAAAD////gAAAAfi///v/////+CAAAAAAAD///+AAAAAfCLf/n/////cCAAAAAAAB///8AAAAAfexf///////mOAAAAAAAB///8AAAAAH/Ai///////G8AAAAAAAAf//4AAAAAf/iB///////hgAAAAAAAAP//wAAAAAf//////////gAAAAAAAAAP/owAAAAA/////f/////gAAAAAAAAAH/AwAAAAB///+/v/////AAAAAAAAAAD/AQAAAAD/////3/////gAAAAAAAAAAeA4AAAAD////f/D///+gAAAAAAAAAAfGOAAAAH//////B/z/wAAAAAAAgAAAf8BwAAAD////v+A/h+wAAAAAAAAAAAH8AAAAAD////38A/B/AgAAAAAAAAAAAfgAAAAH/////wAcAfggAAAAAAAAAAAHgAAAAH////+AAcAfgwAAAAAAAAAAABD4AAAD/////wAMAXAQAAAAAAAAAAAA//AAAB/////gAOASAYAAAAAAAAAAAAX/gAAA/////gACAICYAAAAAAAAAAAAH/8AAAfP///AAAAsHAAAAAAAAAAAAAH/+AAAAD///AAAA8OAAAAAAAAAAAAAP/+AAAAD//8AAAAc+0AAAAAAAAAAAAf//wAAAD//4AAAAM/ggAAAAAAAAAAAP//+AAAB//wAAAAGdi/AAAAAAAAAAAf///AAAA//wAAAAGAwPkAAAAAAAAAAP///gAAA//wAAAAB4AHwAAAAAAAAAAP///gAAA//wAAAAAIoDYIAAAAAAAAAH///AAAA//wAAAAAAABAAAAAAAAAAAH//+AAAA//4gAAAAAB5AAAAAAAAAAAD//+AAAA//5gAAAAAPzgAAAAAAAAAAB//+AAAA//zgAAAAAf/gABAAAAAAAAAf/8AAAA//DgAAAAA//wAAAAAAAAAAAf/8AAAA//DAAAAAD//4CAAAAAAAAAAf/4AAAAf/HAAAAAH//8AAAAAAAAAAA//gAAAAf/DAAAAAH//+AAAAAAAAAAA//AAAAAf+AAAAAAH//+AAAAAAAAAAA//AAAAAP8AAAAAAH//+AAAAAAAAAAA/+AAAAAH4AAAAAAH//+AAAAAAAAAAA/8AAAAAHwAAAAAAH4f8AAAAAAAAAAA/4AAAAAEAAAAAAADAH8AIAAAAAAAAB/wAAAAAAAAAAAAAAAD4AEAAAAAAAAB/gAAAAAAAAAAAAAAABQAGAAAAAAAAB+AAAAAAAAAAAAAAAAAwAMAAAAAAAAB8AAAAAAAAAAAAAAAAAQAYAAAAAAAAD4AAAAAAAAAAAAAAAAAABwAAAAAAAAD4AAAAAAAAAAAAAAAAAAAgAAAAAAAAD4AAAAAAAAAACAAAAAAAAAAAAAAAAADwgAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAB/IB/////gAAAAAAAAAAA+AAAAAAADv/+P//////gAAAAAAAAAB+AAAAf/////8////////gAAAABAP/5/AAAD///////////////gAAB//////+AAAP//////////////+AAB///////gAAP///////////////8AAM//////8ADw////////////////+AAA////////Hn////////////////4AAAf//////////////////////////g//////////////////////////////////////////////////////////////////////////////////////////'/* LAND:END */;

  /* ---------- deterministic random (mulberry32, seed 20271111) ---------- */
  var SEED = 20271111;
  function rng(k) { var a = (SEED + k * 7919) | 0; return function () { a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash(i) { var x = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }

  /* ---------- state ---------- */
  var vw = 0, vh = 0, dpr = 1, u = 1, mob = false, narrow = false, cw = 0, ch = 0;
  var heroB = 1, maxY = 1e9, mark = { x: 0, y: 0, w: 0 }, panel = null, stages = {}, labelFont = '13px sans-serif';
  var quality = reduced ? 0 : 3, paused = false, frozen = null, seekTo = null, snapOnce = true;
  var clockBase = performance.now(), pauseAt = 0, clock = 0, lastClock = 0, dt = 0;
  var ptr = null, lastRipple = -1, ripples = [], bubbles = [], lastBubble = 0;
  var work = [], workAvg = 0, workP95 = 0, qWin = [], frames = 0;
  var cur = { A: 1, t: [0, 0, 0, 0, 0, 0], s: 0, sc: 0 }, prevT4 = 0;
  var hero = { x: 0, y: 0, dir: 0, age: 0, a0: 0, a1: 0, at: -9, n: 0, ringT: [] };
  var stat = { seals: 1, litPoints: 0 }, startMs = 0;

  function now() {
    if (frozen != null) return frozen;
    if (paused) return pauseAt;
    return (performance.now() - clockBase) / 1000;
  }
  function staticMode() { return reduced || quality === 0 || frozen != null; } // paused only stops the clock

  /* ---------- layout and scroll mapping (section 4) ---------- */
  function measure() {
    vw = HTML.clientWidth || W.innerWidth; vh = HTML.clientHeight || W.innerHeight;
    u = clamp(min(vw, vh) / 1080, .6, 1.4); mob = vw < 720; narrow = vw < 1100;
    var y = W.scrollY || W.pageYOffset || 0;
    var hr = D.querySelector('.hero').getBoundingClientRect(); heroB = max(1, hr.bottom + y);
    var mr = D.querySelector('.hero .mark').getBoundingClientRect();
    mark = { x: mr.left + mr.width / 2, y: mr.top + y + mr.height / 2, w: mr.width };
    var pr = D.querySelector('.hero .wrap > div'); pr = pr && pr.getBoundingClientRect();
    panel = pr ? { l: pr.left - 12, r: pr.right + 12, t: pr.top + y - 12, b: pr.bottom + y + 12 } : null;
    stages = {}; maxY = max(1, D.documentElement.scrollHeight - vh);
    var list = D.querySelectorAll('.stage');
    for (var i = 0; i < list.length; i++) {
      var el = list[i], r = el.getBoundingClientRect(); if (!r.height) continue;
      stages[+el.getAttribute('data-act')] = { top: r.top + y, h: r.height, el: el, labels: (el.getAttribute('data-labels') || '').split('|') };
    }
    labelFont = '500 ' + 13 + 'px ' + (getComputedStyle(D.body).fontFamily || 'sans-serif');
    var cap = touch || vw * vh > 2.5e6 ? 1.5 : 2; if (quality <= 1) cap = 1;
    var want = min(W.devicePixelRatio || 1, cap);
    if (vw !== cw || abs(vh - ch) > 120 || want !== dpr) {
      dpr = want; cw = vw; ch = vh;
      cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
      setupSwarm(); setupScene();
    }
    if (G && G.mob !== mob) G = null;
  }
  function progress(y) {
    var t = [0, 0, 0, 0, 0, 0], A = 1, k;
    if (seekTo) {
      A = seekTo.act; for (k = 1; k <= 5; k++) t[k] = k < A ? 1 : k === A ? seekTo.t : 0;
    } else {
      t[1] = sat(y / (.9 * heroB));
      for (k = 2; k <= 5; k++) {
        var st = stages[k]; if (!st) continue;
        var e = st.top - vh, x = stageEnd(st); t[k] = sat((y - e) / (x - e)); if (t[k] > 0) A = k;
      }
    }
    var sc = 0; for (k = 1; k <= 5; k++) sc += t[k];
    return { A: A, t: t, s: A - 1 + t[A], sc: min(sc, A - 1 + t[A]) };
  }
  // scroll position that a seek(act, t) stands for, so the waterline and focal points match a real scroll
  function seekY() {
    var a = seekTo.act, t = seekTo.t, st = stages[a];
    if (a === 1 || !st) return t * .9 * heroB;
    var e = st.top - vh, x = stageEnd(st); return e + t * (x - e);
  }
  // an act ends when its stage is half way up the screen, or at the bottom of the page if that comes first
  function stageEnd(st) { return max(st.top - vh + 1, min(st.top + st.h - .5 * vh, maxY - 1)); }
  // focal point: as close to the viewport centre as the stage allows (stage edges +-40px)
  function focal(k, y) {
    var st = stages[k]; if (!st) return { x: vw / 2, y: vh / 2 };
    var top = st.top - y; return { x: vw / 2, y: clamp(vh / 2, top - 40, top + st.h + 40) };
  }

  /* ---------- camera (acts 1-4 share it; act 5 zooms it out) ---------- */
  var cam = { k: 1, x0: 0, y0: 0, x1: 0, y1: 0 };
  function camReset() { cam.k = 1; cam.x0 = cam.y0 = cam.x1 = cam.y1 = 0; }
  function base() { g.setTransform(dpr * cam.k, 0, 0, dpr * cam.k, dpr * (cam.x1 - cam.k * cam.x0), dpr * (cam.y1 - cam.k * cam.y0)); }
  // place a local frame at (x, y) travelling towards dir; mirrored when heading left so the belly stays down
  function frame(x, y, dir, k, flipOK) {
    var c = cos(dir), s = sin(dir), a, b, cc, d;
    if (flipOK !== false && c < 0) { var th = PI - dir; c = cos(th); s = sin(th); a = -c; b = s; cc = s; d = c; }
    else { a = c; b = s; cc = -s; d = c; }
    var K = dpr * cam.k * k;
    g.setTransform(a * K, b * K, cc * K, d * K, dpr * (cam.k * (x - cam.x0) + cam.x1), dpr * (cam.k * (y - cam.y0) + cam.y1));
  }

  /* ---------- sprites (glows are pre-drawn; no shadowBlur) ---------- */
  var glowCache = {};
  function glow(col) {
    var key = col.join(','); if (glowCache[key]) return glowCache[key];
    var c = D.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d');
    var gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(.25, rgba(col, .45)); gr.addColorStop(1, rgba(col, 0));
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return (glowCache[key] = c);
  }
  function blob(img, x, y, r, al) { if (al <= 0.003) return; g.globalAlpha = al; g.drawImage(img, x - r, y - r, 2 * r, 2 * r); g.globalAlpha = 1; }
  var sealSprite = null;

  /* ---------- the seal (section 5.1): spine of 9 nodes, radius table, closed Catmull-Rom outline ---------- */
  var PX = new Float32Array(9), PY = new Float32Array(9), PR = new Float32Array(9), TX = new Float32Array(9), TY = new Float32Array(9);
  var OX = new Float32Array(24), OY = new Float32Array(24);
  var IDX9 = [0, 1, 2, 3, 4, 5, 6, 7, 8], IDX5 = [0, 2, 4, 6, 8];
  function spine(a, ph, amp, bend, tilt) {
    var i;
    for (i = 0; i < 9; i++) {
      var f = i / 8;
      PX[i] = .5 - f;
      PY[i] = amp * .06 * pow(f, 1.5) * sin(ph - .6 * i) - bend * .55 * (f - .45) * (f - .45);
      PR[i] = RP[i] + (RA[i] - RP[i]) * a;
    }
    if (tilt) for (i = 0; i < 3; i++) {
      var w = tilt * (3 - i) / 3, dx = PX[i] - PX[3], dy = PY[i] - PY[3], c = cos(w), s = sin(w);
      PX[i] = PX[3] + dx * c - dy * s; PY[i] = PY[3] + dx * s + dy * c;
    }
    for (i = 0; i < 9; i++) {
      var p = i === 0 ? 0 : i - 1, q = i === 8 ? 8 : i + 1, tx = PX[p] - PX[q], ty = PY[p] - PY[q], l = sqrt(tx * tx + ty * ty) || 1;
      TX[i] = tx / l; TY[i] = ty / l; // towards the nose; "up" normal is (TY, -TX)
    }
  }
  function outline(idx) {
    var n = 0, i, k;
    OX[n] = PX[0] + TX[0] * PR[0] * .95; OY[n++] = PY[0] + TY[0] * PR[0] * .95 + PR[0] * .12;
    for (k = 0; k < idx.length; k++) { i = idx[k]; OX[n] = PX[i] + TY[i] * PR[i]; OY[n++] = PY[i] - TX[i] * PR[i]; }
    OX[n] = PX[8] - TX[8] * PR[8] * 1.2; OY[n++] = PY[8] - TY[8] * PR[8] * 1.2;
    for (k = idx.length - 1; k >= 0; k--) { i = idx[k]; OX[n] = PX[i] - TY[i] * PR[i] * .9; OY[n++] = PY[i] + TX[i] * PR[i] * .9; }
    g.moveTo(OX[0], OY[0]);
    for (i = 0; i < n; i++) {
      var i0 = (i - 1 + n) % n, i2 = (i + 1) % n, i3 = (i + 2) % n;
      g.bezierCurveTo(OX[i] + (OX[i2] - OX[i0]) / 6, OY[i] + (OY[i2] - OY[i0]) / 6, OX[i2] - (OX[i3] - OX[i]) / 6, OY[i2] - (OY[i3] - OY[i]) / 6, OX[i2], OY[i2]);
    }
    g.closePath();
  }
  // o: { a: age 0..1, ph: swim phase, amp, bend (banana pose), tilt (head), lod: 0 hero / 1 crowd, blink, col, alpha, px: on-screen length }
  function seal(x, y, dir, Lb, o) {
    var a = o.a || 0, ph = o.ph || 0;
    spine(a, ph, o.amp == null ? 1 : o.amp, o.bend || 0, o.tilt || 0);
    frame(x, y, dir, Lb, o.flip);
    var col = o.col || mix(SEAL_PUP, SEAL_ADULT, a), al = o.alpha == null ? 1 : o.alpha, hero = o.lod === 0;
    g.globalAlpha = al;
    // rear flippers: two lobes, forked
    var bx = PX[8] - TX[8] * .02, by = PY[8] - TY[8] * .02, back = atan2(-TY[8], -TX[8]), spread = .5 + .12 * sin(ph);
    g.fillStyle = rgba(mul(col, .78));
    g.beginPath();
    g.ellipse(bx + cos(back - spread) * .07, by + sin(back - spread) * .07, .085, .032, back - spread, 0, TAU);
    g.ellipse(bx + cos(back + spread) * .07, by + sin(back + spread) * .07, .085, .032, back + spread, 0, TAU);
    g.fill();
    // body and head
    if (hero) {
      var gr = g.createLinearGradient(0, -.2, 0, .2);
      gr.addColorStop(0, rgba(mul(col, .8))); gr.addColorStop(.55, rgba(col)); gr.addColorStop(1, rgba(mul(col, 1.07)));
      g.fillStyle = gr;
    } else g.fillStyle = rgba(col);
    g.beginPath(); outline(hero ? IDX9 : IDX5);
    var hx = PX[0] + (PX[1] - PX[0]) * .6, hy = PY[0] + (PY[1] - PY[0]) * .6, hr = (PR[0] + (PR[1] - PR[0]) * .6) * 1.1;
    g.fill(); g.beginPath(); g.arc(hx, hy, hr, 0, TAU); g.fill();
    // fore flipper at node 3, swinging with the stroke
    var fl = .22 + (.30 - .22) * a, fa = atan2(TY[3], TX[3]) + PI - 1.05 + .3 * sin(ph + 1.2);
    var fx = PX[3] - TY[3] * -PR[3] * .55, fy = PY[3] + TX[3] * PR[3] * .55;
    g.fillStyle = rgba(mul(col, .84));
    g.beginPath(); g.ellipse(fx + cos(fa) * fl * .45, fy + sin(fa) * fl * .45, fl * .5, .042 + .02 * (1 - a), fa, 0, TAU); g.fill();
    // eye, nose, whiskers
    var px = o.px || Lb * cam.k;
    if (hero || px >= 24) {
      var er = .028 + (.014 - .028) * a, ex = PX[0] + (PX[1] - PX[0]) * .5 - TY[0] * 0, ey = PY[0] + (PY[1] - PY[0]) * .5 - (PR[0] + PR[1]) * .5 * .3;
      if (!hero) er *= 1.2;
      g.fillStyle = '#132029'; g.beginPath(); g.ellipse(ex, ey, er, o.blink ? er * .15 : er, 0, 0, TAU); g.fill();
      if (hero && !o.blink) { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(ex + er * .3, ey - er * .35, er * .38, 0, TAU); g.fill(); }
      var nx = OX[0] - .01, ny = OY[0] - .012;
      g.fillStyle = '#1b2731'; g.beginPath(); g.ellipse(nx, ny, .016, .011, 0, 0, TAU); g.fill();
      if (hero) {
        g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = .006; g.beginPath();
        for (var w = 0; w < 3; w++) { g.moveTo(nx - .035, ny + .02 + w * .008); g.lineTo(nx + .07, ny + .005 + w * .028 - .02); }
        g.stroke();
      }
    }
    g.globalAlpha = 1;
  }
  function makeSprite() {
    var c = D.createElement('canvas'); c.width = 120; c.height = 60; var save = g, saveCam = cam;
    g = c.getContext('2d'); cam = { k: 1, x0: 0, y0: 0, x1: 0, y1: 0 }; var d = dpr; dpr = 1;
    seal(60, 32, 0, 100, { a: .75, ph: 1, lod: 1, col: SEAL_ADULT, px: 10 });
    g = save; cam = saveCam; dpr = d; return c;
  }

  /* ---------- scene data (seeded once per viewport) ---------- */
  var stars = [], dust = [], shafts = [], jellies = [], beach = null;
  function setupScene() {
    var r = rng(1), i;
    stars = []; for (i = 0; i < 60; i++) stars.push({ x: r(), y: r(), s: .6 + r() * 1.3, p: r() * TAU, f: .5 + r() * 1.5 });
    dust = []; var per = mob ? [20, 13, 6] : [40, 25, 12];
    for (var L = 0; L < 3; L++) for (i = 0; i < per[L]; i++) dust.push({ x: r(), y: r(), L: L, p: r() * TAU });
    shafts = []; for (i = 0; i < 4; i++) shafts.push({ x: .15 + i * .23 + r() * .08, w: .05 + r() * .06, p: r() * TAU });
    jellies = []; for (i = 0; i < 5; i++) jellies.push({ x: .08 + r() * .84, y: r(), s: .7 + r() * .6, p: r() * TAU, v: .012 + r() * .01 });
    setupBeach();
  }

  /* ---------- background ---------- */
  function skyColors(t4) {
    if (t4 <= 0) return [KF[0][0], KF[0][1], 0];
    var a = ss(.12, .5, t4), b = ss(.5, .95, t4);
    var top = b > 0 ? mix(DAWN_TOP, KF[4][0], b) : mix(KF[0][0], DAWN_TOP, a);
    var low = b > 0 ? mix(DAWN_LOW, KF[4][1], b) : mix(KF[0][1], DAWN_LOW, a);
    return [top, low, a * (1 - b)];
  }
  function waterColors(sc) {
    var i = clamp(floor(sc), 0, 3), t = ss(0, 1, sc - i), a = KF[i], b = KF[i + 1];
    return [mix(a[2], b[2], t), mix(a[3], b[3], t), lerp(a[4], b[4], t)];
  }
  function background(wl, sky, wat) {
    var gr;
    if (wl > 0) {
      gr = g.createLinearGradient(0, wl - vh * .9, 0, wl);
      gr.addColorStop(0, rgba(sky[0])); gr.addColorStop(1, rgba(sky[1]));
      g.fillStyle = gr; g.fillRect(0, 0, vw, min(vh, wl) + 1);
      if (sky[2] > 0) { // dawn gold band on the horizon
        gr = g.createLinearGradient(0, wl - vh * .18, 0, wl); gr.addColorStop(0, rgba(DAWN_GOLD, 0)); gr.addColorStop(1, rgba(DAWN_GOLD, .55 * sky[2]));
        g.fillStyle = gr; g.fillRect(0, wl - vh * .18, vw, vh * .18);
      }
    }
    if (wl < vh) {
      var y0 = max(0, wl); gr = g.createLinearGradient(0, y0, 0, vh);
      gr.addColorStop(0, rgba(wat[0])); gr.addColorStop(1, rgba(wat[1]));
      g.fillStyle = gr; g.fillRect(0, y0, vw, vh - y0);
    }
  }
  function inPanel(x, y, sy) { return panel && x > panel.l && x < panel.r && y + sy > panel.t && y + sy < panel.b; }
  function drawStars(wl, al, sy) {
    if (wl <= 0 || al <= 0) return;
    g.fillStyle = '#eaf4ff';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i], x = s.x * vw, y = wl - 12 - s.y * vh * .85;
      if (y < -4 || y > wl - 6 || inPanel(x, y, sy)) continue;
      g.globalAlpha = al * (.35 + .4 * (staticMode() ? .6 : .5 + .5 * sin(clock * s.f + s.p)));
      g.fillRect(x, y, s.s * u, s.s * u);
    }
    g.globalAlpha = 1;
  }
  function drawDust(wl, al, y) {
    if (al <= 0 || staticMode()) return;
    var sz = [1, 1.6, 2.4], aa = [.18, .3, .45], par = [.1, .22, .4], H = vh + 40;
    for (var L = 0; L < 3; L++) {
      g.fillStyle = rgba([200, 235, 255], aa[L] * al); g.beginPath();
      for (var i = 0; i < dust.length; i++) {
        var p = dust[i]; if (p.L !== L) continue;
        var py = ((p.y * H - y * par[L] - clock * (4 + 6 * L) * u) % H + H) % H - 20, px = p.x * vw + sin(clock * .3 + p.p) * 12 * u;
        if (py < wl + 4) continue; var r = sz[L] * u;
        g.rect(px, py, r, r);
      }
      g.fill();
    }
  }
  function drawShafts(al) {
    if (al <= 0 || quality < 2) return;
    g.globalCompositeOperation = 'lighter';
    for (var i = 0; i < shafts.length; i++) {
      var s = shafts[i], sw = staticMode() ? 0 : sin(clock * .25 + s.p) * .03, x = (s.x + sw) * vw, w = s.w * vw;
      var gr = g.createLinearGradient(0, 0, 0, vh); gr.addColorStop(0, rgba([150, 220, 255], .10 * al)); gr.addColorStop(1, 'rgba(150,220,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w * 2.6 + vh * .25, vh); g.lineTo(x + w * .6 + vh * .25, vh); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }

  /* ---------- act 1: the pup at the night surface ---------- */
  function heroLb(a) { return lerp(64, 150, a) * u * 1.25; }
  // the dive keeps to the side margin and ends where the first ring of act 2 starts, so the body cards never hide the pup
  function act1Pos(t1, y, tx) {
    var wl = mark.y - y, d = ss(.3, 1, t1), bob = staticMode() ? 0 : sin(clock * TAU / 4) * 6 * u;
    var Lb = heroLb(0), x = lerp(mark.x, tx, ss(0, .6, d));
    var yy = lerp(wl - Lb * .08 + bob, vh * .62, d);
    var dir = d > 0 && d < 1 ? lerp(0, 1.2, sin(PI * min(1, d * 1.4))) : 0;
    return { x: x, y: yy, dir: dir, d: d, wl: wl };
  }
  function drawRipples(wl, sy) {
    if (wl < -20 || wl > vh + 20) return;
    g.strokeStyle = 'rgba(190,225,255,1)'; g.lineWidth = 1.2 * u;
    var i, e, r;
    if (!staticMode()) for (i = 0; i < 3; i++) { // around the pup, endless
      e = ((clock / 2.4 + i / 3) % 1); r = (16 + 110 * e) * u;
      if (cur.t[1] < .35) ring(hero.x, wl, r, (1 - e) * .5 * (1 - cur.t[1] / .35), sy);
    }
    for (i = ripples.length - 1; i >= 0; i--) {
      e = (clock - ripples[i].t) / 1.6; if (e > 1 || e < 0) { if (e > 1) ripples.splice(i, 1); continue; }
      ring(ripples[i].x, wl, (8 + 90 * e) * u, (1 - e) * .45, sy);
    }
    function ring(x, y, r, al, sy) { if (inPanel(x + r, y, sy) || inPanel(x - r, y, sy)) return; g.globalAlpha = al; g.beginPath(); g.ellipse(x, y, r, r * .16, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; }
  }
  function surface(wl, wat) {
    if (wl < -10 || wl > vh + 10) return;
    var gr = g.createLinearGradient(0, wl - 30 * u, 0, wl + 6 * u);
    gr.addColorStop(0, 'rgba(90,150,210,0)'); gr.addColorStop(1, 'rgba(90,150,210,.22)');
    g.fillStyle = gr; g.fillRect(0, wl - 30 * u, vw, 36 * u);
    g.fillStyle = 'rgba(170,215,250,.35)'; g.fillRect(0, wl, vw, 1.2 * u);
  }
  function submerge(x, wl, Lb, wat) { // tint the part of the pup that sits below the surface
    if (wl < -10 || wl > vh + 10) return;
    g.fillStyle = rgba(wat[0], .55); g.fillRect(x - Lb, wl + 1, Lb * 2, Lb * .6);
  }
  function drawBubbles(wl) {
    if (staticMode()) return;
    g.strokeStyle = 'rgba(210,240,255,.7)'; g.lineWidth = 1 * u;
    for (var i = bubbles.length - 1; i >= 0; i--) {
      var b = bubbles[i], e = clock - b.t; if (e > 2.4 || e < 0) { bubbles.splice(i, 1); continue; }
      var x = b.x + sin(e * 5 + b.p) * 4 * u, y = b.y - e * 55 * u; if (y < wl + 3) continue;
      g.globalAlpha = (1 - e / 2.4) * .8; g.beginPath(); g.arc(x, y, b.r * u, 0, TAU); g.stroke();
    }
    g.globalAlpha = 1;
  }
  function emitBubbles(x, y, dir, Lb, rate) {
    if (staticMode() || rate <= 0 || clock - lastBubble < 1 / rate) return;
    lastBubble = clock; var k = bubbles.length;
    bubbles.push({ x: x - cos(dir) * Lb * .45 * (cos(dir) < 0 ? -1 : 1), y: y - Lb * .05, t: clock, p: hash(k + floor(clock * 10)) * TAU, r: 1.5 + hash(k * 3 + 1) * 2.5 });
    if (bubbles.length > 60) bubbles.shift();
  }

  /* ---------- act 2: six rings, the pup grows ---------- */
  function ringPath(q, F) {
    if (mob) return { x: F.x + vw * .26 * sin(TAU * q), y: F.y + vh * .52 * (q - .5) };
    var w = min(vw * .84, 1320 * u); return { x: F.x + w * (q - .5), y: F.y + vh * .14 * sin(TAU * q) };
  }
  function pathDir(q, F) { var a = ringPath(q - .004, F), b = ringPath(q + .004, F); return atan2(b.y - a.y, b.x - a.x); }
  function act2(t2, t3, F) {
    var al = ss(0, .08, t2) * (1 - ss(0, .3, t3)); if (al <= 0) return;
    var labels = (stages[2] && stages[2].labels) || [], ry = (mob ? 34 : 50) * u, rx = ry * .42;
    g.font = labelFont; g.textAlign = 'center'; g.textBaseline = 'top';
    for (var i = 1; i <= 6; i++) {
      var p = ringPath(i / 7, F), lit = hero.n >= i, e = lit && hero.ringT[i] != null ? clock - hero.ringT[i] : 9;
      var dirR = pathDir(i / 7, F) + PI / 2;
      // glow and ring
      blob(glow(lit ? [140, 240, 255] : [90, 160, 220]), p.x, p.y, ry * (lit ? 2.6 : 1.8), al * (lit ? .55 : .25));
      g.save(); base(); g.translate(p.x, p.y); g.rotate(dirR - PI / 2);
      g.lineWidth = (lit ? 3.2 : 1.6) * u; g.strokeStyle = lit ? rgba([170, 250, 255], .95 * al) : rgba([150, 210, 245], .5 * al);
      g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.stroke();
      if (e < .9) { // light wave
        g.lineWidth = 2 * u; g.strokeStyle = rgba([170, 250, 255], (1 - e / .9) * .8 * al);
        g.beginPath(); g.ellipse(0, 0, rx + e * 120 * u, ry + e * 120 * u, 0, 0, TAU); g.stroke();
      }
      g.restore();
      if (labels[i - 1]) {
        g.fillStyle = rgba([234, 244, 255], .8 * al);
        if (mob) { g.textAlign = p.x > F.x ? 'right' : 'left'; g.textBaseline = 'middle'; g.fillText(labels[i - 1], p.x + (p.x > F.x ? -1 : 1) * (ry * .8 + 12 * u), p.y); }
        else { g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(labels[i - 1], p.x, p.y + ry + 12 * u); }
      }
    }
  }
  function updateAge(t2, t3) {
    var n = t3 > 0 ? 6 : min(6, floor(t2 * 7 + 1e-6)), snap = snapOnce || staticMode();
    if (n !== hero.n) {
      for (var i = 1; i <= 6; i++) { if (i <= n && i > hero.n) hero.ringT[i] = snap ? -99 : clock; if (i > n) hero.ringT[i] = null; }
      hero.a0 = hero.age; hero.a1 = n / 6; hero.at = snap ? -99 : clock; hero.n = n;
    }
    var e = sat((clock - hero.at) / .4); e = e * e * (3 - 2 * e);
    hero.age = snap ? hero.a1 : lerp(hero.a0, hero.a1, e);
  }

  /* ---------- act 3: the swarm (boids with a grid hash) ---------- */
  var boids = [], NB = 0, leader = { x: 0, y: 0, vx: 60, vy: 0, init: false }, grid = {};
  function swarmN() { var n = mob ? 80 : narrow ? 140 : 220; return Math.round(n * (quality >= 3 ? 1 : quality === 2 ? .7 : .45)); }
  function setupSwarm() {
    NB = swarmN(); boids = []; var r = rng(2), RS = sqrt(NB) * 15 * u;
    for (var i = 1; i < NB; i++) {
      var th = r() * TAU, layer = r() < .3 ? 0 : r() < .55 ? 1 : 2, rad = sqrt(i / NB) * RS * 1.7, ga = i * 2.39996;
      boids.push({ i: i, tau: i / NB, on: false, live: false, al: 0, x: 0, y: 0, vx: 0, vy: 0, th: th, L: layer,
        size: .5 + r() * .5, age: .3 + r() * .7, sp: (40 + r() * 50), ph: r() * TAU, ox: cos(ga) * rad, oy: sin(ga) * rad * .55,
        tr: new Float32Array(12), tn: 0, tt: 0 });
    }
    leader.init = false;
  }
  function boidLb(b) { return lerp(64, 150, b.age) * u * b.size * [.3, .42, .56][b.L]; }
  function leaderTarget(t3, F) {
    if (staticMode()) return { x: vw / 2, y: F.y - vh * .1 };
    var c = clock;
    if (t3 < 1 || cur.A < 3) return { x: F.x + min(vw, 1200) * .16 * sin(c * .35), y: F.y + vh * .08 * sin(c * .6) };
    if (!narrow) {
      var ww = min(1040, vw - 32), side = (vw - ww) / 2, k = floor(c / 12) % 2;
      return { x: k ? vw - side / 2 : side / 2, y: vh * .5 + vh * .18 * sin(c * .3) };
    }
    return { x: vw / 2 + vw * .3 * sin(c * .2), y: vh * .5 + vh * .2 * sin(c * .27) };
  }
  function updateSwarm(t3, F, step) {
    var T = leaderTarget(t3, F), i, b;
    if (!leader.init || t3 <= 0) { leader.x = hero.x; leader.y = hero.y; leader.vx = cos(hero.dir) * 60; leader.vy = sin(hero.dir) * 60; leader.init = true; }
    var stat0 = staticMode();
    if (stat0) { leader.x = T.x; leader.y = T.y; leader.vx = 60 * u; leader.vy = 0; }
    else {
      var dx = T.x - leader.x, dy = T.y - leader.y, d = sqrt(dx * dx + dy * dy) || 1, sp = min(130 * u, 30 * u + d * .8);
      leader.vx += (dx / d * sp - leader.vx) * min(1, step * 1.6); leader.vy += (dy / d * sp - leader.vy) * min(1, step * 1.6);
      leader.x += leader.vx * step; leader.y += leader.vy * step;
    }
    // enter / retreat by threshold, with hysteresis
    for (i = 0; i < boids.length; i++) {
      b = boids[i];
      if (!b.on && t3 >= b.tau && t3 > 0) {
        b.on = true;
        if (!b.live || stat0) { var R = max(vw, vh) * .62 + 60; b.x = vw / 2 + cos(b.th) * R; b.y = vh / 2 + sin(b.th) * R * .8; b.vx = -cos(b.th) * b.sp * u; b.vy = -sin(b.th) * b.sp * u; b.tn = 0; }
        b.live = true;
      } else if (b.on && (t3 < b.tau - .05 || t3 <= 0)) b.on = false;
      if (stat0) b.on = t3 > 0 && t3 >= b.tau; // no hysteresis in still frames, so a still is the same whatever came before
    }
    if (stat0) { // fixed formation: deterministic for screenshots, reduced motion and pause
      for (i = 0; i < boids.length; i++) { b = boids[i]; b.live = b.on; b.al = b.on ? 1 : 0; b.x = leader.x + b.ox; b.y = leader.y + b.oy; b.vx = 60 * u; b.vy = sin(b.ph) * 8 * u; b.tn = 0; }
      return;
    }
    if (step <= 0) return;
    // grid hash, 70px cells
    var cs = 70 * u; grid = {};
    for (i = 0; i < boids.length; i++) { b = boids[i]; if (!b.live) continue; var key = floor(b.x / cs) + ',' + floor(b.y / cs); (grid[key] || (grid[key] = [])).push(b); }
    var per = 70 * u, sep = 28 * u, avoid = 140 * u;
    for (i = 0; i < boids.length; i++) {
      b = boids[i]; if (!b.live) continue;
      var gx = floor(b.x / cs), gy = floor(b.y / cs), sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, n = 0;
      for (var X = gx - 1; X <= gx + 1; X++) for (var Y = gy - 1; Y <= gy + 1; Y++) {
        var cell = grid[X + ',' + Y]; if (!cell) continue;
        for (var j = 0; j < cell.length; j++) {
          var o = cell[j]; if (o === b) continue; var ex = b.x - o.x, ey = b.y - o.y, dd = ex * ex + ey * ey;
          if (dd > per * per) continue; n++; ax += o.vx; ay += o.vy; cx += o.x; cy += o.y;
          if (dd < sep * sep && dd > .01) { sx += ex / dd; sy += ey / dd; }
        }
      }
      var vx = 0, vy = 0, l;
      function add(x, y, w) { var m = sqrt(x * x + y * y); if (m > 1e-6) { vx += x / m * w; vy += y / m * w; } }
      if (b.on) {
        add(sx, sy, 1.6);
        if (n) { add(ax / n, ay / n, 1.0); add(cx / n - b.x, cy / n - b.y, .8); }
        var fx = leader.x + b.ox - b.x, fy = leader.y + b.oy - b.y; add(fx, fy, .6 * min(1, sqrt(fx * fx + fy * fy) / (60 * u)) + .15);
        if (ptr) { var px = b.x - ptr.x, py = b.y - ptr.y, pd = sqrt(px * px + py * py); if (pd < avoid) add(px, py, 3 * (1 - pd / avoid)); }
        var m = 60 * u; if (b.x < -m) vx += 1; if (b.x > vw + m) vx -= 1; if (b.y < -m) vy += 1; if (b.y > vh + m) vy -= 1;
      } else { add(b.x - vw / 2, b.y - vh / 2, 2); }
      l = sqrt(vx * vx + vy * vy) || 1; var want = b.on ? b.sp * u : 380 * u;
      b.vx += (vx / l * want - b.vx) * min(1, step * (b.on ? 2.2 : 4)); b.vy += (vy / l * want - b.vy) * min(1, step * (b.on ? 2.2 : 4));
      var s = sqrt(b.vx * b.vx + b.vy * b.vy) || 1, lo = (b.on ? 40 : 120) * u, hi = (b.on ? 90 : 420) * u;
      if (s < lo) { b.vx *= lo / s; b.vy *= lo / s; } else if (s > hi) { b.vx *= hi / s; b.vy *= hi / s; }
      b.x += b.vx * step; b.y += b.vy * step; b.ph += step * (3 + s / (12 * u));
      b.al = b.on ? min(1, b.al + step * 2) : max(0, b.al - step / 1.2);
      if (!b.on && (b.al <= 0 || b.x < -200 || b.x > vw + 200 || b.y < -200 || b.y > vh + 200)) { b.live = false; b.al = 0; }
      if (clock - b.tt > .07) { b.tt = clock; b.tr.copyWithin(2, 0, 10); b.tr[0] = b.x; b.tr[1] = b.y; if (b.tn < 6) b.tn++; }
    }
  }
  function drawSwarm(fade, L) {
    if (fade <= 0) return;
    var i, b, col = [mix(SEAL_ADULT, [40, 90, 130], .55), mix(SEAL_ADULT, [40, 90, 130], .3), SEAL_ADULT][L];
    var alL = [.5, .75, 1][L] * fade;
    if (quality >= 3 && !staticMode()) { // trails, batched by age, additive
      base(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = TRAIL; g.lineWidth = [1, 1.4, 2][L] * u;
      for (var k = 0; k < 5; k++) {
        g.globalAlpha = (1 - k / 5) * .32 * alL; g.beginPath();
        for (i = 0; i < boids.length; i++) {
          b = boids[i]; if (!b.live || b.L !== L || b.tn <= k + 1) continue;
          var x0 = k ? b.tr[k * 2 - 2] : b.x, y0 = k ? b.tr[k * 2 - 1] : b.y; g.moveTo(x0, y0); g.lineTo(b.tr[k * 2], b.tr[k * 2 + 1]);
        }
        g.stroke();
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    for (i = 0; i < boids.length; i++) {
      b = boids[i]; if (!b.live || b.L !== L || b.al <= 0) continue;
      var Lb = boidLb(b), dir = atan2(b.vy, b.vx);
      if (b.x < -Lb || b.x > vw + Lb || b.y < -Lb || b.y > vh + Lb) continue;
      if (L === 0 && sealSprite) { frame(b.x, b.y, dir, Lb / 100); g.globalAlpha = alL * b.al * .9; g.drawImage(sealSprite, -60, -32); g.globalAlpha = 1; }
      else seal(b.x, b.y, dir, Lb, { a: b.age, ph: b.ph, lod: 1, col: col, alpha: alL * b.al, px: Lb });
    }
    base();
  }
  function countSeals() { var n = 1; for (var i = 0; i < boids.length; i++) if (boids[i].live && boids[i].al > 0) n++; return n; }
  function drawJellies(al, y) {
    if (al <= 0) return;
    var c = staticMode() ? 2 : clock;
    for (var i = 0; i < jellies.length; i++) {
      var j = jellies[i], pulse = .5 + .5 * sin(c * 1.6 + j.p), x = j.x * vw + sin(c * .2 + j.p) * 20 * u;
      var yy = ((j.y * (vh + 200) - c * j.v * vh) % (vh + 200) + vh + 200) % (vh + 200) - 100, s = 22 * u * j.s;
      g.globalAlpha = al * .5; g.fillStyle = 'rgba(190,170,255,.55)';
      g.beginPath(); g.ellipse(x, yy, s * (1 - .15 * pulse), s * (.7 + .15 * pulse), 0, PI, TAU); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(190,170,255,.45)'; g.lineWidth = 1.2 * u; g.beginPath();
      for (var k = -2; k <= 2; k++) { g.moveTo(x + k * s * .3, yy); g.quadraticCurveTo(x + k * s * .35 + sin(c * 2 + k) * 4 * u, yy + s * 1.2, x + k * s * .25, yy + s * 2.2); }
      g.stroke(); g.globalAlpha = 1;
    }
  }
  function drawTurtle(al) {
    if (al <= 0) return;
    var c = staticMode() ? 6 : clock, e = (c % 40) / 15; if (e > 1) return;
    var x = lerp(-80 * u, vw + 80 * u, e), y = vh * .3 + sin(e * 5) * 20 * u, s = 26 * u, f = sin(c * 3) * .5;
    g.globalAlpha = al * .6; g.fillStyle = '#2e6b5c';
    g.beginPath(); g.ellipse(x, y, s, s * .62, 0, 0, TAU); g.ellipse(x + s * 1.15, y - s * .05, s * .32, s * .24, 0, 0, TAU);
    g.ellipse(x + s * .45, y - s * .6, s * .45, s * .14, -.6 + f, 0, TAU); g.ellipse(x + s * .45, y + s * .6, s * .45, s * .14, .6 - f, 0, TAU);
    g.ellipse(x - s * .7, y - s * .45, s * .25, s * .1, .5, 0, TAU); g.ellipse(x - s * .7, y + s * .45, s * .25, s * .1, -.5, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }

  /* ---------- act 4: landing (beach, splashes, palms, coconuts, sunrise) ---------- */
  var spots = [], swimmers = [], palms = [], crabs = [], birds = [], grass = [], corals = [], splashes = [], nuts = [], lastNut = -9, autoNut = null;
  function setupBeach() {
    var r = rng(4), i, S = mob ? 6 : 14;
    spots = [];
    for (i = 0; i < S; i++) {
      var row = i === 0 ? 2 : i % 3, col = i === 0 ? .5 : (i / S + r() * .08) % 1;
      spots.push({ fy: [.30, .55, .80][row] + (r() - .5) * .06, fx: col, age: .75 + r() * .25, dir: r() < .5 ? 0 : PI, ph: r() * TAU, w: r() * TAU });
    }
    spots[0].fy = .78; spots[0].fx = .42; spots[0].dir = PI;
    swimmers = []; var K = mob ? 10 : 20;
    for (i = 0; i < K; i++) swimmers.push({ fy: r(), fx: r(), A: .05 + r() * .12, w: .15 + r() * .2, p: r() * TAU, age: .4 + r() * .6, surf: i < K * .4, P: 7 + r() * 6, q: r() * 13 });
    palms = []; var pf = mob ? [[.62, .30, -.18], [.86, .36, .12]] : [[.62, .34, -.2], [.76, .42, .1], [.9, .30, .22]];
    for (i = 0; i < pf.length; i++) palms.push({ fx: pf[i][0], h: pf[i][1], lean: pf[i][2], p: r() * TAU, n: 3 + (r() < .5 ? 1 : 0), dropped: 0 });
    crabs = [{ fx: .2, fy: .7, p: 0 }, { fx: .7, fy: .45, p: 2 }];
    birds = []; var B = mob ? 3 : 5; for (i = 0; i < B; i++) birds.push({ x: r(), y: .06 + r() * .22, v: .02 + r() * .025, p: r() * TAU, s: .7 + r() * .5 });
    grass = []; for (i = 0; i < 22; i++) grass.push({ x: r() * .5, h: .06 + r() * .1, p: r() * TAU });
    corals = []; for (i = 0; i < 5; i++) corals.push({ x: .03 + r() * .4, s: .6 + r() * .6, seed: i });
    splashes = []; nuts = []; autoNut = null;
  }
  function beachGeom(t4) {
    var rise = (1 - ss(.08, .45, t4)) * vh * .5, wl = lerp(-.1 * vh, .45 * vh, ss(0, .35, t4));
    var sx0 = mob ? vw * .38 : vw * .5, sx1 = mob ? vw * .08 : vw * .3;
    return { wl: wl, rise: rise, top: function (x) { return wl + rise - (x - sx0) / (vw - sx0) * vh * .07 + 2 * u; },
      shore: function (y) { return lerp(sx0, sx1, sat((y - wl) / (vh - wl))); }, sx0: sx0, sx1: sx1 };
  }
  function spotPos(sp, B) {
    var y = lerp(B.wl + vh * .04, vh * .95, sp.fy) + B.rise, x0 = B.shore(y - B.rise) + 50 * u, x1 = vw - 40 * u;
    return { x: lerp(x0, x1, sp.fx), y: y, k: .55 + .45 * sat((y - B.wl) / (vh - B.wl)) };
  }
  function drawSun(B, t4, sky) {
    var e = ss(.3, 1, t4); if (t4 < .25) return null;
    var R = 34 * u, x = vw * (mob ? .22 : .26), y = B.wl + R * 1.2 - (vh * .3 + R) * e;
    g.save(); g.beginPath(); g.rect(0, 0, vw, B.wl); g.clip();
    blob(glow([255, 214, 140]), x, y, R * 7, .55 * ss(.25, .5, t4));
    g.fillStyle = rgba(mix(hex('#ff9d5c'), hex('#fff1c4'), e)); g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
    g.restore();
    return { x: x, y: y, R: R, e: e };
  }
  function sunTrail(sun, B, al) {
    if (!sun || al <= 0) return;
    g.fillStyle = 'rgba(255,225,170,1)';
    for (var i = 0; i < 14; i++) {
      var yy = B.wl + 4 * u + i * i * 1.6 * u, w = (30 + i * 9) * u * (.6 + .4 * sin((staticMode() ? 1 : clock) * 2 + i * 1.7));
      g.globalAlpha = al * (1 - i / 14) * .5 * sun.e; g.fillRect(sun.x - w / 2, yy, w, 2 * u);
    }
    g.globalAlpha = 1;
  }
  function drawBeach(B, light) {
    var y0 = B.wl + B.rise;
    if (y0 > vh + 10) return;
    var gr = g.createLinearGradient(0, y0 - vh * .07, 0, vh);
    gr.addColorStop(0, rgba(mul(hex('#f1d9a0'), light))); gr.addColorStop(1, rgba(mul(hex('#e2c07f'), light)));
    g.fillStyle = gr; g.beginPath(); g.moveTo(B.sx0, y0);
    for (var x = B.sx0; x <= vw + 1; x += vw / 24) g.lineTo(x, B.top(x) + sin(x * .01) * 4 * u);
    g.lineTo(vw, vh + 2);
    var c = staticMode() ? 0 : clock;
    for (var y = vh; y >= B.wl; y -= vh / 30) g.lineTo(B.shore(y) + sin(c * 1.1 + y * .02) * 5 * u, y + B.rise);
    g.closePath(); g.fill();
    // wet sand and foam along the shoreline
    g.lineCap = 'round';
    for (var k = 0; k < 2; k++) {
      g.strokeStyle = k ? rgba([255, 255, 255], .8 * light) : rgba(mul(hex('#c9a46a'), light), .6);
      g.lineWidth = (k ? 3 : 10) * u; g.beginPath();
      for (y = B.wl; y <= vh + 10; y += vh / 30) {
        var off = (k ? -6 : 2) * u + sin(c * 1.2 + y * .015 + k) * 8 * u, xx = B.shore(y) + off;
        if (y === B.wl) g.moveTo(xx, y + B.rise); else g.lineTo(xx, y + B.rise);
      }
      g.stroke();
    }
    g.lineCap = 'butt';
  }
  function drawPalm(p, B, light) {
    var bx = p.fx * vw, by = B.top(bx) + vh * .1, H = p.h * vh, c = staticMode() ? 0 : clock, sway = sin(c * .8 + p.p) * 4 * DEG;
    if (by > vh + H) return null;
    var tx = bx + p.lean * H * .55 + sin(c * .8 + p.p) * H * .02, ty = by - H, cx = bx + p.lean * H * .05, cy = by - H * .55;
    var trunk = mul(hex('#8a6a48'), light), dark = mul(hex('#5e4630'), light);
    g.lineCap = 'round';
    for (var i = 0; i < 10; i++) { // tapered trunk with rings
      var a = i / 10, b = (i + 1) / 10;
      function P(t) { var m = 1 - t; return [m * m * bx + 2 * m * t * cx + t * t * tx, m * m * by + 2 * m * t * cy + t * t * ty]; }
      var p0 = P(a), p1 = P(b);
      g.strokeStyle = rgba(i % 2 ? trunk : mix(trunk, dark, .35)); g.lineWidth = lerp(H * .05, H * .022, a);
      g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
    }
    // nine pinnate fronds
    var leaf = mul(hex('#2f8a4a'), light * .95), leafD = mul(hex('#1d5e33'), light);
    var Lf = H * .42;
    for (var f = 0; f < 9; f++) {
      var th = -PI + (f + .5) / 9 * PI + sway + (f % 2 ? .08 : -.05), droop = .55 + .25 * abs(cos(th));
      g.strokeStyle = rgba(f % 2 ? leaf : leafD); g.lineWidth = 2.2 * u; g.beginPath();
      var px = tx, py = ty, segs = 9;
      for (var s = 1; s <= segs; s++) {
        var q = s / segs, x = tx + cos(th) * q * Lf, y = ty + sin(th) * q * Lf + droop * q * q * Lf;
        g.moveTo(px, py); g.lineTo(x, y);
        var ang = atan2(y - py, x - px), ll = Lf * .2 * (1 - q * .7);
        g.moveTo(x, y); g.lineTo(x + cos(ang + 2.2) * ll, y + sin(ang + 2.2) * ll + ll * .3);
        g.moveTo(x, y); g.lineTo(x + cos(ang - 2.2) * ll, y + sin(ang - 2.2) * ll + ll * .3);
        px = x; py = y;
      }
      g.stroke();
    }
    g.lineCap = 'butt';
    // coconuts still on the tree
    var left = p.n - p.dropped, cr = H * .028;
    for (var k = 0; k < left; k++) {
      var nx = tx + (k - (left - 1) / 2) * cr * 1.7, ny = ty + cr * (1.1 + (k % 2) * .5);
      g.fillStyle = rgba(mul(hex('#5b3a1e'), light)); g.beginPath(); g.arc(nx, ny, cr, 0, TAU); g.fill();
      g.fillStyle = rgba([255, 230, 190], .25 * light); g.beginPath(); g.arc(nx - cr * .35, ny - cr * .35, cr * .3, 0, TAU); g.fill();
    }
    return { x: tx, y: ty, cr: cr, by: by };
  }
  function nutPos(n, B, crowns) {
    var c = crowns[n.palm]; if (!c) return null;
    var e = clock - n.t, gY = c.by + 10 * u, h = gY - c.y, G2 = 1400 * u, tf = sqrt(2 * h / G2), x = c.x, y;
    var b1 = 2 * sqrt(2 * h * .22 / G2), b2 = 2 * sqrt(2 * h * .07 / G2), tr = 2.6;
    if (e < tf) { y = c.y + .5 * G2 * e * e; }
    else if (e < tf + b1) { var q = e - tf; y = gY - (sqrt(2 * G2 * h * .22) * q - .5 * G2 * q * q); x -= q * 70 * u; }
    else if (e < tf + b1 + b2) { var q2 = e - tf - b1; y = gY - (sqrt(2 * G2 * h * .07) * q2 - .5 * G2 * q2 * q2); x -= (b1 + q2) * 70 * u; }
    else {
      var x0 = c.x - (b1 + b2) * 70 * u, yW = min(vh * .9, gY + vh * .16), xW = B.shore(yW - B.rise) - 26 * u, q3 = ss(0, 1, (e - tf - b1 - b2) / tr);
      x = lerp(x0, xW, q3); y = lerp(gY, yW, q3);
      if (q3 >= 1) { var f = e - tf - b1 - b2 - tr; x = xW - min(f, 30) * 3 * u; y = yW + sin(f * 2) * 3 * u; }
    }
    return { x: x, y: y, r: c.cr };
  }
  function splash(x, y, e, seed, k) {
    if (e < 0 || e > 1.2) return;
    g.fillStyle = 'rgba(235,250,255,1)';
    for (var i = 0; i < 20; i++) {
      var h1 = hash(seed * 31 + i), h2 = hash(seed * 57 + i * 3), vx = (h1 - .5) * 170 * u * k, vy = -(110 + h2 * 230) * u * k;
      var px = x + vx * e, py = y + vy * e + 330 * u * k * e * e; if (py > y + 4 * u) continue;
      g.globalAlpha = (1 - e / 1.2) * .9; g.beginPath(); g.arc(px, py, (1.4 + h2 * 1.8) * u * k, 0, TAU); g.fill();
    }
    g.globalAlpha = sat(1 - e / .9) * .7; g.strokeStyle = '#ffffff'; g.lineWidth = 2 * u;
    g.beginPath(); g.ellipse(x, y, (8 + 70 * e) * u * k, (2 + 14 * e) * u * k, 0, 0, TAU); g.stroke(); g.globalAlpha = 1;
  }
  function act4(t4, t5, y, sky, wat) {
    var B = beachGeom(t4), light = .45 + .55 * ss(.3, .9, t4), c = staticMode() ? 4 : clock, i;
    var sun = drawSun(B, t4, sky);
    if (sun) sunTrail(sun, B, ss(.35, .7, t4));
    // birds
    var bal = ss(.4, .8, t4);
    if (bal > 0) {
      g.strokeStyle = rgba(mix([30, 40, 60], [40, 55, 80], light), .8 * bal); g.lineWidth = 1.6 * u; g.beginPath();
      for (i = 0; i < birds.length; i++) {
        var bd = birds[i], bx = ((bd.x + c * bd.v) % 1.2 - .1) * vw, by = bd.y * B.wl, w = 12 * u * bd.s, fl = sin(c * 6 + bd.p) * .5;
        if (by > B.wl - 10) continue;
        g.moveTo(bx - w, by - w * fl * .6); g.quadraticCurveTo(bx - w * .4, by - w * .45 - w * fl * .3, bx, by); g.quadraticCurveTo(bx + w * .4, by - w * .45 - w * fl * .3, bx + w, by - w * fl * .6);
      }
      g.stroke();
    }
    // underwater life near the shore
    var ua = ss(.1, .5, t4);
    if (ua > 0) {
      g.strokeStyle = rgba([20, 90, 80], .6 * ua); g.lineWidth = 3 * u; g.lineCap = 'round'; g.beginPath();
      for (i = 0; i < grass.length; i++) { var gx = grass[i].x * vw, gh = grass[i].h * vh, sw = sin(c * 1.1 + grass[i].p) * 12 * u; g.moveTo(gx, vh + 4); g.quadraticCurveTo(gx + sw * .3, vh - gh * .5, gx + sw, vh - gh); }
      g.stroke(); g.lineCap = 'butt';
      for (i = 0; i < corals.length; i++) coral(corals[i].x * vw, vh + 2, 46 * u * corals[i].s, corals[i].seed, ua);
    }
    drawBeach(B, light);
    var crowns = []; for (i = 0; i < palms.length; i++) crowns.push(drawPalm(palms[i], B, light));
    // starfish and crabs
    var sa = ss(.3, .6, t4);
    if (sa > 0) {
      var sfx = vw * (mob ? .55 : .64), sfy = B.wl + B.rise + vh * .42; star5(sfx, sfy, 11 * u, rgba(mul(hex('#f08a5d'), light), sa));
      for (i = 0; i < crabs.length; i++) {
        var cy = B.wl + B.rise + (vh - B.wl) * crabs[i].fy, cx = B.shore(cy - B.rise) + 70 * u + crabs[i].fx * (vw - B.shore(cy - B.rise)) * .5 + sin(c * .6 + crabs[i].p) * 40 * u;
        crab(cx, cy, 9 * u, light, sa, c + crabs[i].p);
      }
    }
    // swimmers in the shallows, with leaps
    var swA = ss(.05, .35, t4) * (1 - ss(.05, .3, t5));
    for (i = 0; i < swimmers.length; i++) {
      var s = swimmers[i], sy0 = s.surf ? B.wl + 16 * u : lerp(B.wl + vh * .08, vh * .95, s.fy);
      var xr = B.shore(sy0) - 60 * u, sx = lerp(20 * u, xr, s.fx) + sin(c * s.w + s.p) * s.A * vw;
      sx = clamp(sx, 10 * u, xr); var dir = cos(c * s.w + s.p) >= 0 ? 0 : PI, yy = sy0, ang = dir, Lb = lerp(64, 150, s.age) * u * .55;
      if (s.surf && !staticMode()) {
        var e = ((c + s.q) % s.P) / 1.2;
        if (e < 1) { yy = sy0 - (vh * .1 + 16 * u) * 4 * e * (1 - e); ang = dir === 0 ? -1.1 + 2.2 * e : PI + 1.1 - 2.2 * e; }
        var t0 = c - ((c + s.q) % s.P); splash(sx - (dir ? -1 : 1) * Lb * .2, B.wl, c - t0 - .14, i * 7 + floor((c + s.q) / s.P), .8); splash(sx + (dir ? -1 : 1) * Lb * .2, B.wl, c - t0 - 1.06, i * 7 + 3 + floor((c + s.q) / s.P), .8);
      }
      seal(sx, yy, ang, Lb, { a: s.age, ph: c * 6 + s.p, lod: 1, col: mix(SEAL_ADULT, wat[0], yy > B.wl ? .35 : 0), alpha: swA, px: Lb });
    }
    // seals hauling out onto the sand (spot 0 is the protagonist)
    for (i = spots.length - 1; i >= 0; i--) {
      var sp = spots[i], P = spotPos(sp, B), st = i === 0 ? .3 : .34 + .38 * (i / spots.length), q = ss(st, st + .2, t4);
      if (q <= 0 && i !== 0) continue;
      var start = { x: B.shore(P.y - B.rise) - vw * .22, y: min(vh * .98, P.y + vh * .05) }, x, yy2, d2, bend = 0, Lb2 = lerp(64, 150, sp.age) * u * .8 * P.k;
      if (i === 0) Lb2 = heroLb(1) * P.k;
      x = lerp(start.x, P.x, q); yy2 = lerp(start.y, P.y, q) - sin(PI * q) * 20 * u;
      d2 = q < 1 ? atan2(P.y - start.y, P.x - start.x) : sp.dir;
      if (q >= 1) { bend = 1; }
      var crossQ = sat((B.shore(P.y - B.rise) - start.x) / (P.x - start.x));
      if (prevQ[i] != null && prevQ[i] < crossQ && q >= crossQ && abs(t4 - prevT4) < .08 && !snapOnce && !staticMode()) splashes.push({ x: B.shore(P.y - B.rise), y: P.y, t: clock, s: 500 + i * 13 + splashes.length, k: P.k });
      prevQ[i] = q;
      var wig = q >= 1 ? .22 * pow(max(0, sin(c * .7 + sp.w)), 12) : 0, wet = x < B.shore(yy2 - B.rise);
      if (i === 0) {
        blob(glow([180, 240, 255]), x, yy2, Lb2 * .9, .3);
        hero.land = { x: x, y: yy2 };
        if (q > 0 || t4 > .2) seal(x, yy2, d2, Lb2, { a: 1, ph: c * 5, amp: q >= 1 ? 0 : 1, bend: bend, tilt: -wig, lod: 0, blink: (c % 5) < .15, col: mix(SEAL_ADULT, wat[0], wet ? .3 : 0) });
      } else seal(x, yy2, d2, Lb2, { a: sp.age, ph: c * 5 + sp.ph, amp: q >= 1 ? 0 : 1, bend: bend, tilt: -wig, lod: 1, col: mix(SEAL_ADULT, wat[0], wet ? .3 : 0), px: Lb2 });
    }
    base();
    for (i = splashes.length - 1; i >= 0; i--) { var sp2 = splashes[i], e2 = clock - sp2.t; if (e2 > 1.2) { splashes.splice(i, 1); continue; } splash(sp2.x, sp2.y, e2, sp2.s, sp2.k); }
    // coconuts: one falls when t4 passes 0.6; clicks drop more
    if (t4 > .6 && !autoNut) autoNut = { palm: 0, t: snapOnce || staticMode() ? -999 : clock };
    if (t4 < .58) autoNut = null;
    var all = autoNut ? [autoNut].concat(nuts) : nuts;
    for (i = 0; i < palms.length; i++) palms[i].dropped = 0;
    for (i = 0; i < all.length; i++) {
      if (palms[all[i].palm]) palms[all[i].palm].dropped++;
      var np = nutPos(all[i], B, crowns); if (!np) continue;
      g.fillStyle = rgba(mul(hex('#5b3a1e'), light)); g.beginPath(); g.arc(np.x, np.y, np.r, 0, TAU); g.fill();
    }
    return B;
  }
  var prevQ = [];
  function coral(x, y, s, seed, al) {
    g.strokeStyle = rgba([194, 87, 122], .5 * al); g.lineCap = 'round';
    function br(x, y, a, l, d) { if (d > 3 || l < 4) return; var x2 = x + cos(a) * l, y2 = y + sin(a) * l; g.lineWidth = max(1.5, (4 - d) * 2.2) * u; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); br(x2, y2, a - .45 - hash(seed + d) * .2, l * .72, d + 1); br(x2, y2, a + .4 + hash(seed * 3 + d) * .2, l * .7, d + 1); }
    br(x, y, -PI / 2, s * .5, 0); g.lineCap = 'butt';
  }
  function star5(x, y, r, col) {
    g.fillStyle = col; g.beginPath();
    for (var i = 0; i < 10; i++) { var a = -PI / 2 + i * PI / 5, rr = i % 2 ? r * .42 : r; g.lineTo(x + cos(a) * rr, y + sin(a) * rr * .7); }
    g.closePath(); g.fill();
  }
  function crab(x, y, s, light, al, c) {
    var col = rgba(mul(hex('#e0663a'), light), al);
    g.strokeStyle = col; g.lineWidth = 1.4 * u; g.beginPath();
    for (var k = -1; k <= 1; k += 2) for (var j = 0; j < 3; j++) { var w = sin(c * 8 + j) * 2 * u; g.moveTo(x + k * s * .6, y + j * 2 * u - 2 * u); g.lineTo(x + k * (s * 1.4 + w), y + j * 3 * u + 3 * u); }
    g.stroke(); g.fillStyle = col; g.beginPath(); g.ellipse(x, y, s, s * .62, 0, 0, TAU);
    g.ellipse(x - s * 1.3, y - s * .7, s * .36, s * .26, 0, 0, TAU); g.ellipse(x + s * 1.3, y - s * .7, s * .36, s * .26, 0, 0, TAU); g.fill();
  }

  /* ---------- act 5: the dot globe ---------- */
  var G = null, spin = 0, dragV = 0, drag = null;
  function buildGlobe() {
    if (G || !LAND) return G;
    var bits = atob(LAND), i, j;
    function land(i, j) { i = (i + 180) % 180; if (j < 0 || j > 89) return 0; var k = j * 180 + i; return (bits.charCodeAt(k >> 3) >> (7 - (k & 7))) & 1; }
    var r = rng(5), sum = 0, cells = [];
    for (j = 0; j < 90; j++) for (i = 0; i < 180; i++) if (land(i, j)) { var la = 89 - 2 * j; cells.push(la, -179 + 2 * i); sum += cos(la * DEG); }
    var f = 1500 / sum, dl = [], cand = [];
    for (i = 0; i < cells.length; i += 2) if (r() < f * cos(cells[i] * DEG)) dl.push(cells[i] + (r() - .5) * 1.6, cells[i + 1] + (r() - .5) * 1.6);
    for (j = 0; j < 90; j++) for (i = 0; i < 180; i++) {
      if (land(i, j)) continue; var near = 0;
      for (var a = -1; a <= 1 && !near; a++) for (var b = -1; b <= 1; b++) if (land(i + a, j + b)) { near = 1; break; }
      if (near) cand.push(89 - 2 * j, -179 + 2 * i);
    }
    function vec(la, lo) { la *= DEG; lo *= DEG; return [cos(la) * cos(lo), cos(la) * sin(lo), sin(la)]; }
    var dots = new Float32Array(dl.length / 2 * 3);
    for (i = 0; i < dl.length / 2; i++) { var v = vec(dl[i * 2], dl[i * 2 + 1]); dots[i * 3] = v[0]; dots[i * 3 + 1] = v[1]; dots[i * 3 + 2] = v[2]; }
    var O = vec(O_LAT, O_LON), cv3 = [], nC = cand.length / 2;
    for (i = 0; i < nC; i++) cv3.push(vec(cand[i * 2], cand[i * 2 + 1]));
    function dot3(p, q) { return p[0] * q[0] + p[1] * q[1] + p[2] * q[2]; }
    // farthest-point sampling from the candidate nearest to O
    var M = min(mob ? 90 : 180, nC), pick = [], md = new Float32Array(nC).fill(9), best = 0, bd = -2;
    for (i = 0; i < nC; i++) { var dd = dot3(cv3[i], O); if (dd > bd) { bd = dd; best = i; } }
    for (var m = 0; m < M; m++) {
      pick.push(best); var nb = -1, nv = -1;
      for (i = 0; i < nC; i++) { var ang = Math.acos(clamp(dot3(cv3[i], cv3[best]), -1, 1)); if (ang < md[i]) md[i] = ang; if (md[i] > nv) { nv = md[i]; nb = i; } }
      best = nb;
    }
    var pts = pick.map(function (k) { return { v: cv3[k], d: Math.acos(clamp(dot3(cv3[k], O), -1, 1)) }; }).sort(function (p, q) { return p.d - q.d; });
    for (i = 0; i < pts.length; i++) { // parent: nearest point that lights earlier (O for the first)
      pts[i].tl = .3 + .6 * (pts.length > 1 ? i / (pts.length - 1) : 0); pts[i].lt = null; var pv = O, pd = 9;
      for (j = 0; j < i; j++) { var q2 = Math.acos(clamp(dot3(pts[j].v, pts[i].v), -1, 1)); if (q2 < pd) { pd = q2; pv = pts[j].v; } }
      if (pv === O) pd = pts[i].d; pts[i].par = pv; pts[i].hop = min(1, pd / .6);
    }
    G = { dots: dots, n: dl.length / 2, pts: pts, O: O, mob: mob };
    return G;
  }
  function view(t5) {
    var e = ss(.3, 1, t5), pre = 1 - ss(0, .3, t5);
    return { lon: (O_LON + 170 * e - 40 * pre) * DEG + spin, lat: (O_LAT + 30 * e) * DEG };
  }
  function proj(v, V, C, R, out) {
    var cl = cos(V.lon), sl = sin(V.lon), x1 = v[0] * cl + v[1] * sl, y1 = -v[0] * sl + v[1] * cl, z1 = v[2];
    var cp = cos(V.lat), sp = sin(V.lat), d = x1 * cp + z1 * sp, up = -x1 * sp + z1 * cp;
    var X = y1 * R, Y = -up * R, ct = cos(TILT), st = sin(TILT);
    out[0] = C.x + X * ct - Y * st; out[1] = C.y + X * st + Y * ct; out[2] = d; return out;
  }
  function act5(t5, C) {
    var gl = buildGlobe(); if (!gl) return;
    var z = ss(0, .3, t5), R = .36 * min(vw, vh) * lerp(2.2, 1, z), al = z, V = view(t5), i, o = [0, 0, 0], c = staticMode() ? 8 : clock;
    // space stars
    g.fillStyle = '#dfe9ff';
    for (i = 0; i < stars.length; i++) { var s = stars[i]; g.globalAlpha = al * (.3 + .35 * (staticMode() ? .5 : .5 + .5 * sin(c * 1.3 + s.p))); g.fillRect(s.x * vw, (s.y * 1.7 % 1) * vh, s.s * u, s.s * u); }
    g.globalAlpha = 1;
    // atmosphere and ocean
    var gr = g.createRadialGradient(C.x, C.y, R * .96, C.x, C.y, R * 1.08);
    gr.addColorStop(0, rgba([92, 200, 255], .55 * al)); gr.addColorStop(1, 'rgba(92,200,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(C.x, C.y, R * 1.08, 0, TAU); g.fill();
    gr = g.createRadialGradient(C.x - R * .3, C.y - R * .35, R * .1, C.x, C.y, R);
    gr.addColorStop(0, rgba(hex('#0d4f7a'), al)); gr.addColorStop(1, rgba(hex('#062a47'), al));
    g.fillStyle = gr; g.beginPath(); g.arc(C.x, C.y, R, 0, TAU); g.fill();
    // land dots in 4 depth buckets
    var D3 = gl.dots, du = R / (.36 * min(vw, vh));
    for (var bkt = 0; bkt < 4; bkt++) {
      g.fillStyle = rgba([159, 232, 200], (.3 + .23 * bkt) * al); g.beginPath();
      var rr = (.8 + .35 * bkt) * u * du * (mob ? .9 : 1.15);
      for (i = 0; i < gl.n; i++) {
        var v = [D3[i * 3], D3[i * 3 + 1], D3[i * 3 + 2]]; proj(v, V, C, R, o); if (o[2] <= 0) continue;
        if (min(3, floor(o[2] * 4)) !== bkt) continue; g.rect(o[0] - rr, o[1] - rr, rr * 2, rr * 2);
      }
      g.fill();
    }
    // arcs, lit points, origin
    var lit = 0, flash = sin(PI * sat((t5 - .9) / .1)), snap = snapOnce || staticMode(), P = gl.pts, a = [0, 0, 0], b = [0, 0, 0];
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = ARC; g.lineWidth = 1.1 * u;
    for (i = 0; i < P.length; i++) {
      var p = P[i];
      if (t5 >= p.tl && t5 > 0) { lit++; if (p.lt == null) p.lt = snap ? -99 : clock; } else { p.lt = null; continue; }
      var pr = sat((clock - p.lt) / .6); if (staticMode() || snap) pr = 1;
      g.globalAlpha = al * (pr < 1 ? .9 : .32); g.beginPath();
      var segs = 14, started = false, hop = p.hop;
      for (var k = 0; k <= segs * pr; k++) {
        var tt = k / segs, w = slerp(p.par, p.v, tt), lift = 1 + .12 * hop * sin(PI * tt);
        proj([w[0] * lift, w[1] * lift, w[2] * lift], V, C, R, a);
        if (a[2] > .05) { if (started) g.lineTo(a[0], a[1]); else { g.moveTo(a[0], a[1]); started = true; } } else started = false;
      }
      g.stroke();
    }
    g.globalAlpha = 1;
    var tw = floor(c), twI = floor(hash(tw * 13 + 7) * max(1, lit)), twE = c - tw;
    for (i = 0; i < P.length; i++) {
      p = P[i]; if (p.lt == null) continue; proj(p.v, V, C, R, b); if (b[2] <= 0) continue;
      var e = snap ? 9 : clock - p.lt, pulse = e < .8 ? 1 - e / .8 : 0, extra = (i === twI && !staticMode() && t5 >= .9) ? (1 - twE) : 0;
      var sz = (2.4 + 2.5 * flash + 2 * extra) * u * (.6 + .4 * b[2]);
      blob(glow(LIT), b[0], b[1], sz * 3.6, al * (.7 + .3 * flash + .4 * extra) * (.5 + .5 * b[2]));
      g.fillStyle = rgba(LIT, al * (.6 + .4 * b[2])); g.beginPath(); g.arc(b[0], b[1], sz * .55, 0, TAU); g.fill();
      if (pulse > 0) { g.strokeStyle = rgba(LIT, pulse * al); g.lineWidth = 1.4 * u; g.beginPath(); g.arc(b[0], b[1], (3 + (1 - pulse) * 16) * u, 0, TAU); g.stroke(); }
    }
    proj(gl.O, V, C, R, b);
    if (b[2] > 0) { blob(glow([255, 245, 220]), b[0], b[1], 16 * u, al); g.fillStyle = rgba([255, 250, 235], al); g.beginPath(); g.arc(b[0], b[1], 2.6 * u, 0, TAU); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    stat.litPoints = lit;
    return proj(gl.O, view(.3), C, R, [0, 0, 0]);
  }
  function slerp(p, q, t) {
    var d = clamp(p[0] * q[0] + p[1] * q[1] + p[2] * q[2], -1, 1), om = Math.acos(d);
    if (om < 1e-4) return q;
    var s = sin(om), a = sin((1 - t) * om) / s, b = sin(t * om) / s;
    return [p[0] * a + q[0] * b, p[1] * a + q[1] * b, p[2] * a + q[2] * b];
  }

  /* ---------- render ---------- */
  function render() {
    var t0 = performance.now();
    clock = reduced ? 3 : now(); dt = clamp(clock - lastClock, 0, 1 / 30); lastClock = clock;
    var y = seekTo ? seekY() : W.scrollY || W.pageYOffset || 0, P = progress(y);
    if (reduced && !seekTo) { // one still per act, at t = 0.8
      for (var k = 1; k <= 5; k++) P.t[k] = k < P.A ? 1 : k === P.A ? .8 : 0;
      P.s = P.A - 1 + .8; P.sc = P.s;
    }
    cur = P; var t = P.t, t1 = t[1], t2 = t[2], t3 = t[3], t4 = t[4], t5 = t[5];
    // globe: slow ambient spin after the full reveal, drag inertia, and a return to the start when scrolled back
    if (!staticMode() && t5 >= .9) spin += dt * TAU / 90;
    if (!drag && dragV) { spin += dragV * dt; dragV *= Math.exp(-dt * 2.2); if (abs(dragV) < .01) dragV = 0; }
    if (t5 < .3 && !drag) spin *= .9;
    camReset(); base();
    g.clearRect(0, 0, vw, vh);
    updateAge(t2, t3);
    // hero position: act-1 pose, then the ring path, then the swarm leader, then the beach
    var F2 = focal(2, y), F3 = focal(3, y), F5 = focal(5, y), p1 = act1Pos(t1, y, ringPath(0, F2).x);
    var hx = p1.x, hy = p1.y, hd = p1.dir;
    if (t2 > 0) { var q = ringPath(t2, F2), bl = ss(0, .14, t2); hx = lerp(hx, q.x, bl); hy = lerp(hy, q.y, bl); hd = bl < 1 ? lerp(hd, pathDir(t2, F2), bl) : pathDir(min(t2, .995), F2); }
    hero.x = hx; hero.y = hy; hero.dir = hd;
    var swarmOn = t3 > 0 || boids.some(function (b) { return b.live; });
    if (swarmOn && t4 < .35) { updateSwarm(t3, F3, dt); if (t3 > 0) { hero.x = leader.x; hero.y = leader.y; hero.dir = atan2(leader.vy, leader.vx); } }
    stat.seals = t4 >= .35 ? 1 + spots.length : countSeals();
    // act-5 zoom: shrink the act 1-4 picture into the origin point on the globe
    var z = ss(0, .3, t5), sceneAl = 1 - ss(.08, .3, t5);
    var wl = t4 > 0 ? beachGeom(t4).wl : p1.wl;
    var sky = skyColors(t4), wat = waterColors(P.sc);
    if (t5 > 0) { g.fillStyle = rgba(SPACE); g.fillRect(0, 0, vw, vh); }
    if (sceneAl > 0) {
      if (t5 > 0) {
        var L = hero.land || { x: vw / 2, y: vh / 2 }, k5 = pow(.02, z), Opt = G ? proj(G.O, view(.3), F5, .36 * min(vw, vh), [0, 0, 0]) : [F5.x, F5.y];
        cam.k = k5; cam.x0 = L.x; cam.y0 = L.y; cam.x1 = lerp(L.x, Opt[0], z); cam.y1 = lerp(L.y, Opt[1], z); base();
        g.globalAlpha = sceneAl;
      }
      g.save(); if (t5 > 0) g.globalAlpha = sceneAl;
      background(wl, sky, wat);
      drawStars(wl, 1 - ss(.3, .6, t4), y);
      var under = 1 - ss(.2, .5, t4);
      drawShafts((ss(1.2, 2, P.sc) * (1 - ss(2.6, 3.2, P.sc)) + ss(3.6, 4, P.sc) * .25) * (t5 > 0 ? 0 : 1));
      drawDust(wl, (1 - z) * (t4 > 0 ? .6 : 1), y);
      if (t4 > 0) act4(t4, t5, y, sky, wat);
      var ja = ss(1.9, 2.3, P.sc) * (1 - ss(3, 3.3, P.sc));
      drawJellies(ja, y); drawTurtle(ja);
      var sw = 1 - ss(0, .3, t4);
      if (swarmOn) { drawSwarm(sw, 0); drawSwarm(sw, 1); }
      act2(t2, t3, F2);
      drawBubbles(wl);
      // the protagonist (until it lands in act 4)
      if (t4 < .3) {
        var Lb = heroLb(hero.age), hal = t4 > 0 ? 1 - ss(.15, .3, t4) : 1;
        if (t3 > 0 || hero.age > .5) blob(glow([170, 235, 255]), hero.x, hero.y, Lb * .9, (t3 > 0 ? .35 : .2) * hal);
        var tilt = 0;
        if (ptr && t1 < .3 && t2 === 0) tilt = clamp(atan2(ptr.y - hero.y, abs(ptr.x - hero.x)), -20 * DEG, 20 * DEG);
        var amp = p1.d > 0 || t2 > 0 ? 1 : .25;
        seal(hero.x, hero.y, hero.dir, Lb, { a: hero.age, ph: (staticMode() ? 1 : clock * 5), amp: amp, tilt: tilt, lod: 0, blink: !staticMode() && (clock % 5) < .15, alpha: hal });
        base();
        if (t2 === 0 && p1.d < .4) submerge(hero.x, p1.wl, Lb, wat);
        emitBubbles(hero.x, hero.y, hero.dir, Lb, p1.d > .02 && t3 === 0 ? 7 : t2 > 0 && t3 === 0 ? 4 : 0);
      }
      if (swarmOn) drawSwarm(sw, 2);
      if (t4 === 0) { surface(p1.wl, wat); drawRipples(p1.wl, y); }
      g.restore();
      camReset(); base(); g.globalAlpha = 1;
    }
    if (t5 > 0) act5(t5, F5);
    // bookkeeping
    snapOnce = false; prevT4 = t4;
    var ms = performance.now() - t0; work.push(ms); if (work.length > 180) work.shift();
    if (++frames % 30 === 0) { var srt = work.slice().sort(function (a, b) { return a - b; }); workAvg = srt.reduce(function (a, b) { return a + b; }, 0) / srt.length; workP95 = srt[floor(srt.length * .95)] || 0; }
    if (!staticMode() && !seekTo) { qWin.push(ms); if (qWin.length >= 90) { var s2 = qWin.sort(function (a, b) { return a - b; }); if (s2[floor(90 * .95)] > 14 && quality > 0) setQuality(quality - 1); qWin = []; } }
    if (DEBUG) debug();
  }
  function setQuality(q) {
    quality = q; var n = swarmN(); if (n !== NB) setupSwarm();
    if (q <= 1) { cw = 0; measure(); }
    if (q === 0) kick();
  }

  /* ---------- loop, visibility, fallbacks ---------- */
  var raf = 0, rafCount = 0, visible = true, still = 0;
  function animate() { return !reduced && !paused && quality > 0 && frozen == null && !D.hidden && (visible || vw >= 720); }
  function kick() {
    if (animate()) { if (!raf) raf = requestAnimationFrame(tick); }
    else { clearTimeout(still); still = setTimeout(render, reduced ? 140 : 0); }
  }
  function tick() { raf = 0; rafCount++; if (!animate()) return; render(); raf = requestAnimationFrame(tick); }
  function relayout() { measure(); kick(); if (!animate()) render(); }

  /* ---------- debug API (used by work/verify-story.cjs) ---------- */
  var dbg = null;
  function debug() {
    if (!dbg) { dbg = D.createElement('div'); dbg.setAttribute('aria-hidden', 'true'); dbg.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:40;font:12px monospace;color:#fff;background:#000a;padding:4px;pointer-events:none'; D.body.appendChild(dbg); }
    dbg.textContent = 'act ' + cur.A + ' t ' + cur.t[cur.A].toFixed(2) + ' seals ' + stat.seals + ' Q' + quality + ' ' + workAvg.toFixed(1) + '/' + workP95.toFixed(1) + 'ms';
  }
  W.SEAL_STORY = {
    state: function () {
      return { on: HTML.classList.contains('has-story'), act: cur.A, t: +cur.t[cur.A].toFixed(4), s: +cur.s.toFixed(4), seals: stat.seals, age: +hero.age.toFixed(3), rings: hero.n,
        quality: quality, reduced: reduced, paused: paused, workAvg: +workAvg.toFixed(2), workP95: +workP95.toFixed(2),
        landDots: G ? G.n : (buildGlobe() ? G.n : 0), litPoints: stat.litPoints, M: G ? G.pts.length : 0, N: NB, rafCount: rafCount,
        startMs: +startMs.toFixed(2), labels: stages[2] ? stages[2].labels.join('|') : '', stage2: stages[2] ? Math.round(stages[2].top) : -1 };
    },
    seek: function (act, t) { seekTo = { act: clamp(act | 0, 1, 5), t: sat(+t) }; snapOnce = true; render(); kick(); },
    release: function () { seekTo = null; kick(); },
    freeze: function (ms) { frozen = (+ms || 0) / 1000; snapOnce = true; render(); },
    unfreeze: function () { frozen = null; lastClock = now(); kick(); },
    resetStats: function () { work = []; workAvg = workP95 = 0; frames = 0; },
    _hero: function () { return cur.t[4] >= .3 && hero.land ? hero.land : { x: hero.x, y: hero.y }; }
  };

  /* ---------- start ---------- */
  HTML.classList.add('has-story');
  measure(); sealSprite = makeSprite();
  var toggle = D.getElementById('story-toggle');
  if (toggle && !reduced) {
    toggle.hidden = false;
    toggle.addEventListener('click', function () {
      if (!paused) pauseAt = now(); else clockBase = performance.now() - pauseAt * 1000;
      paused = !paused;
      toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
      toggle.setAttribute('aria-label', toggle.getAttribute(paused ? 'data-label-play' : 'data-label-pause'));
      lastClock = now(); kick();
    });
  }
  W.addEventListener('scroll', function () { if (!animate()) kick(); }, { passive: true });
  W.addEventListener('resize', relayout, { passive: true });
  W.addEventListener('load', relayout, { passive: true });
  D.addEventListener('visibilitychange', function () { lastClock = now(); kick(); }, { passive: true });
  if (mq && mq.addEventListener) mq.addEventListener('change', function (e) { reduced = e.matches; if (reduced) quality = 0; relayout(); });
  if (W.MutationObserver) new MutationObserver(relayout).observe(HTML, { attributes: true, attributeFilter: ['data-mode'] });
  if (D.fonts && D.fonts.ready) D.fonts.ready.then(relayout);
  if (W.IntersectionObserver) {
    var seen = new Set(), io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); });
      visible = seen.size > 0; kick();
    });
    io.observe(D.querySelector('.hero')); D.querySelectorAll('.stage').forEach(function (s) { io.observe(s); });
  }
  W.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch' && !drag) { ptr = null; return; }
    ptr = { x: e.clientX, y: e.clientY };
    if (cur.t[1] < .5 && cur.t[2] === 0 && !staticMode() && clock - lastRipple > .12) {
      var wl = mark.y - (W.scrollY || 0); if (abs(e.clientY - wl) < vh * .3) { lastRipple = clock; ripples.push({ x: e.clientX, t: clock }); if (ripples.length > 12) ripples.shift(); }
    }
    if (drag) { var dx = e.clientX - drag.x; drag.x = e.clientX; var R = .36 * min(vw, vh), dl = dx / R; spin += dl; drag.v = dl / max(.008, (performance.now() - drag.t) / 1000); drag.t = performance.now(); kick(); }
  }, { passive: true });
  D.addEventListener('pointerleave', function () { ptr = null; }, { passive: true });
  W.addEventListener('blur', function () { ptr = null; }, { passive: true });
  D.querySelectorAll('.stage[data-act="5"]').forEach(function (s) {
    s.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, t: performance.now(), v: 0 }; }, { passive: true });
  });
  ['pointerup', 'pointercancel'].forEach(function (n) { W.addEventListener(n, function () { if (drag) { dragV = clamp(drag.v || 0, -6, 6); drag = null; } }, { passive: true }); });
  D.querySelectorAll('.stage[data-act="4"]').forEach(function (s) {
    s.addEventListener('click', function (e) {
      if (cur.t[4] < .5 || clock - lastNut < 2 || staticMode()) return;
      var live = nuts.length + (autoNut ? 1 : 0); if (live >= 6) return;
      var best = -1, bd = 1e9; for (var i = 0; i < palms.length; i++) { var d = abs(palms[i].fx * vw - e.clientX); if (palms[i].n - palms[i].dropped > 0 && d < bd) { bd = d; best = i; } }
      if (best < 0) return; lastNut = clock; nuts.push({ palm: best, t: clock }); kick();
    }, { passive: true });
  });
  render(); startMs = performance.now() - T0; kick();
  setTimeout(buildGlobe, 1500);
})();
