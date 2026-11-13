/* SEAL Growth homepage story. Copyright 2026 SEAL Growth. Licensed under the Apache License, Version 2.0.
 * Scroll-driven canvas: one pup -> grows through six rings -> many seals gather -> landing -> lights around the globe.
 * Decoration only: the seals and the lit points are a picture of an idea. They are not real projects, places or counts.
 * Land mask: Natural Earth 1:110m (public domain), geographic continents rasterised to 1 degree by work/build-landmask.cjs.
 * Spec: docs/prd-seal-story-v2.md. No libraries or storage; optional same-origin generated material detail only. */
(function () {
  'use strict';
  var T0 = performance.now(), W = window, D = document, HTML = D.documentElement, Q = location.search || '';
  if (/[?&]story=off(&|$)/.test(Q)) { HTML.classList.add('story-off'); return; }
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
    ['#0a1a33', '#16324f', '#082844', '#0b2c3c', .05], ['#0a1a33', '#16324f', '#17485a', '#103945', .15],
    ['#6ec3f4', '#cfeeff', '#1fa3c9', '#0b5c85', 1]].map(function (k) { return [hex(k[0]), hex(k[1]), hex(k[2]), hex(k[3]), k[4]]; });
  var DAWN_TOP = hex('#2b3a67'), DAWN_LOW = hex('#f08a5d'), DAWN_GOLD = hex('#ffd27d'), SPACE = hex('#050b16');
  var SEAL_PUP = hex('#dfeaf4'), SEAL_ADULT = hex('#a9b7c6'), AI = [183,224,230], TRAIL = '#b7e0e6', LIT = AI, ARC = '#b7e0e6';
  
  var O_LAT = -10, O_LON = -150, TILT = 23.4 * DEG;
  var LAND = /* LAND:BEGIN */'+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+PjYc/j4+Pj4+Pj4+EDLSBMIy/j4+Pj4+Pj4+AMAwxD7k/j4+Pj4+Pj4kPv7i/gARJAk+EA1+Pj4+NgDOLsg+4PgfPj4CDUADfj4+PiACyAjABMIixD7q+hc+PhYLfj4+PgwGxATYBMoSyj7o/gAHBAU+PhoHfj4+PgQSxALKBsAKwBbMPuT+PiAPOB1+Pj4+ABbECMICwBjmPtD+PhQRLDNsD0AFfj4qCMoG2gTAFuo+yv4+FAkyM3IDTgN+PigSzgLGBsAIwgTADug+xP4+EgkqP01GCVYFfj40KMQQxBroPsD+PhIHGAdCAUA/Z1ITfANoAPwIwBzGDMQi3j7C/j4QCRQ/fUIndAFiGuYA0B7ICMQo2D7A/hgPLAUSC0A/f2t+BjLCIMIewBLGCMQU1j7+ECEwCUI/f39LQBFAA1Q++sAAxgTADMIIxhLaMv4ULQgDCBE/f395Uj7+5sYCwhDSKP4cNQQFABcZQD9/f2dGPv7mzhbOJtIDCAU0Px0/f39/Q0I+/ubKFMAE0hzaEzAXAhMIJz9/f29IBUo+/ubGGNgW4BEuFQIZAC0/f39tUAVKPv7QxATABM4M2BTmBzAXAj8LP39/bVw+/tLOAsIAwAjCCtwO/hwZBD8NP39/b1o+/tDcDOgO/hwZBD8NP39/TUAVYiTAPujeEOwE/h4bAj8NP39/RgFAE3IQwATOPtzeEMQC/j4IGwY/CT9/fUgJfgAAwAzcPtjcHP4yAxAFAgsKPwk/f2NgB34MCuI+0sAA2Bz+LgcUDwYDAD8HP39fXg1+CATuPtjUHv4sBxIFAAcIPw0/f1tiDX4CBvQ+4Mgk/igJEAMABQw/DT9/WWINfgAC/j7gwiz+HgUACQ4FAAECPxk/f1liDX4+AADCPt7ELP4aBwAJCD8tP39lWAd+Pgw+3sIu/hgHAA0CPy8/f2dWBX4+ED7+0P4aAQQNAD8dBU0/f2FAA1YDfj4SPv7IwAL+IgkCPx8/f3dAA34+MD72xALGBv4mPyE/f3tABX4+Mj74yAr+Hj8nP395QgF+PjY+9soM/h4/Jz9/dUQBfj44PvrAAMoA/iQ/DQAVAUQ/f2tEA34+Nj7+/jI/BB0EP39tfj4+Aj7wwAT+OB0CGwYDAhMEP39rSAV+PjQ+7MYA/i4hAgcCGRIRBD9/Z0gLfj4wPur+OhcIAwAHBBMYB0UGP39dUAd+PjY+6v44FwoBAgkCDQVCC0YLQQFIP39XUgN+Pjg+5v4+EwwDBhUAL0Q/f1dUA34+Oj7i/j4TDgMIAwQFBC9EP39FQA1WA34+Oj7g/j4AExwDBgUCLUg/f0wHUgV+Pjw+3P4+BA8SAEIHCAUELUY/f0lEBVAFfj4+AD7a/j4ICQIUVAEIP397RgdKCX4+PgI+2P4+CgRAGFgDDAFCP39nSgdCEX4+PgI+1v4+CiJqAUI/f2dKA0QPfj4+DD7M/j4KJm4/f2tQC34+PhQ+yP4+CjBIBFY/f21OA34+Phw+xv4+DDREDkICQj9/b04Dfj4+HgLAPv4+DD5Yf39tfj4+MgLALsgE/j4MPlhZQj9/T34+PjQCwB7YBP4+Bj5cW0I/f01+Pj40BMAa2gT+PgI+XkAbRD9/SX4+PjgEwBjcAsAC/jw+XkIbRgFCP31+Pj4+AMIW3AL+PgA+YkIdRD9/QX4+Pj4CwhTkAP44PmZAHUIFUj9nQAN+Pj48AsIS/j4gPmZCKVA/Y0IDfj4+PgYO2Az+OD5qQilQP11GAX4+Pj4IEMwEzAb+ND5qQilQJ0Qnfj4+PhoQygbQBv4wPmpCJ1obSB1EAX4+OAD+IhDIBtoG/iY+bEQhXBlMGUQDfj4+PiAe0gDECsAA/iI+akQfXhVSF0QBVAF+Pj4+Dhr+Pgw+bkQbYBNUGVgFfj4+PhAW/j4MPm5EF2QRVhtWBX4+Pj4WAMIU/j4CPnBCE2oLYBdUA34+Pj4gEv4+AD50Qg1uC2IVVAV+Pj4+JAz+PgI+dEAJcg1gF1IHfj4+PiYI1AC+Kj54QXoJYgNAEVQBQgN+Pj4+JAbQCL4oPnZGBG4JYgNEC1gBQAN+Pj4+JgTMHL4aPn5CcAdiA0QJVAFCA34+Pj4sAsCCAoIcvhw+fkBwBUABYANIA1QBRANAAX4+Pj4qAMSAJr4aPn5yAUAFXgNsB34+Pj4uAIImvhg+fHoDYANoCX4+Pj40KL4YPnp6A2IDWgNKA34+Pj42ML4UFEY+Vn4aA0QFVgd+Pj4+PgQ0vhIEVD5UfhwFQgdSCX4+Pj4+BDS+Nj5KfiIFQAVQCX4+Pj4+BDi+ND5KfiINTA1+Pj4+PgQ4vjQ+Rn4oC0gTSAFCA34+Pj4sOr40PkR+LAlIEUIJQgN+Pj4+Kj6Cvi4+Qn4wB0gRQANAAU4Fvj4+PiA+hr4qPkB+MglIDUIHTgWEA74+Pj4WPoy+JD5+NglGDUIFUgWACb4+Pj4SPpS+Hjp+OgdKCUIHRAFABUAXjgG+Pj44Ppi+Hjh+PAVYB1YViAO+Pj46Ppq+HDR+PgADWANAAVwRgAeCAb4+PjY+mr4cNH4+AgdAA2oBhBOAAYgBvj4+Nj6Yvh40fj4CD24TkgG+Pj4yPpa+HjR+PgwHQgNABUIDVAGAB4IFvj4+PgY+lr4eNH4+HANEA14BhgWSA74+Pi4+kr4gNn4+PhQFkgG+Pj4uPpC+IjZ+PjQDjgG+Pj4+Fj6MviQ2TgB+Ph4NhgW+Pj4+FD6KviQ4TAJ+Ph4LiAW+Pj4+Fj6IviQ4SgR+PhQViAe+Pj4+Fj6GviQ4SAh+PhAZhgmmAb4+Piw+hL4iOEYKfj4QHYQJqAGUAb4+PhY+gL4iNEoKfj4OL7wDvj4+Gj6+JDBMCn4+Di++Pj4+Hjy+JC5OCH4+DDe+Pj4+Gjq+KCpQCH4+Bj+cAb4+Pjg4viosTAp+PgI/hZwDvj4+Mjq+LCpMCH4+Aj+JnAG+Pj4yNL4yKkwIfj4AP4u+Pj4+Ei6+OChQBn4+AD+Nvj4+PhAsvjwiVgB+PgY/jb4+Pj4OLL48In4+Hj+Pvj4+Pg4svjwifj4gP4++Pj4+Ciy+PgAgfj4gP4++Pj4+Ciy+PgIcfj4kP42+Pj4+Ciq+PgQafj4mP4u+Pj4+DCi+PggWfj4oP4u+Pj4+DCa+PgoUfj4qF4onvj4+Pgwkvj4MEH4+LhGUIb4+Pj4OIr4+EAR+PjgJnAGAG74+Pj4OHr4+Pj4+PgQZqgO+Pj4eHr4+Pj4+PgYVrgG+Pj4cIL4+Pj4+PggTrgW+Pj4YHr4+Pj4+PgwFgAO0Cb4+PhQWvj4+Pj4+PhYFvj4+GBa+Pj4+Pj4+EgGCA74+PhgQvj4+Pj4+IgesB74+PhoUvj4+Pj4+HgWsBb4+PiAOvj4+Pj4+JAGqB74+Ph4Svj4+Pj4+Pg4Jvj4+IA6+Pj4+Pj4+EAm+Pj4iDr4+Pj4+Pj4SBb4+PiQQvj4+Pj4+Pj4+PjoSvj4+Pj4+Pj4+PjoQvj4+PgwF/j4+Pj4+KAy+Pj4+Pj4+Pj4+PgIKjgS+Pj4+Pj4+Pj4+LAy+Pj4+Pj4+Pj4+PgIKvj4+Pj4+Pj4+Pj4EDr4+Pj4+Pj4+Pj4+BAS+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4OA/4+Pj4+Pj4+Pj4+Agf+Pj4+Pj4+Pj4+PgIF/j4+Pj4GA/wB/j4+PjgJ/j4+IA34A9YJxg3IHf4+Pj40Bf4+PhwdwgXcP//D/j4+PiAH/j4+AAPKOc4//9PCAf4+Pj4IEf4+Oj/NyD//5/4+Pj4AE/4+Aj//wcY///f+PjgB8hv+Ij//38I////H/j4sC8oB2gvADf4cP//////x/joDwgfcNcIb/hg///////P+JjfQP83+GD//////7/4aP//l/hQ///////P+HD//2/4QP///////wf4KP//n/hA////////J/gfCP//h9AvOP///////1foHzD//1d4B0A/MP///////y/4iP//ZyAvKE9Y////////B/hQ///nYB8Y////////X/hg///vCP////////f4OP////////////8fSHdw////////////////////////////////////////////////////////////////////////////////////////jw=='/* LAND:END */;

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
  var stat = { seals: 1, litPoints: 0 }, startMs = 0, booted = false, labelBoxes = [], ringBoxes = [], sealBoxes = [];

  function now() {
    if (frozen != null) return frozen;
    if (paused) return pauseAt;
    return (performance.now() - clockBase) / 1000;
  }
  function staticMode() { return reduced || paused || quality === 0 || frozen != null; } // paused only stops the clock

  /* ---------- layout and scroll mapping (section 4) ---------- */
  function measure() {
    vw = HTML.clientWidth || W.innerWidth; vh = HTML.clientHeight || W.innerHeight;
    u = clamp(min(vw, vh) / 1080, .6, 1.4); mob = vw < 720; narrow = vw < 1100;
    var y = W.scrollY || W.pageYOffset || 0;
    var hr = D.querySelector('.hero').getBoundingClientRect(); heroB = max(1, hr.bottom + y + (mob ? vh * .35 : 0));
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
    var cap = quality === 2 && touch ? 1.5 : vw * vh > 2.5e6 ? 1.5 : 2; if (quality <= 1) cap = 1;
    var want = min(W.devicePixelRatio || 1, cap);
    if (vw !== cw || abs(vh - ch) > 120 || want !== dpr) {
      dpr = want; cw = vw; ch = vh;
      cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
      setupSwarm(); setupScene();
    }
    if(G&&G.mob!==mob){G=null;globeWork=null;queueJob(globeSlice,5);materialReady=false;setTimeout(taskSlice,0);}
  }
  function progress(y) {
    var t = [0, 0, 0, 0, 0, 0], A = 1, k;
    if (seekTo) {
      A = seekTo.act; for (k = 1; k <= 5; k++) t[k] = k < A ? 1 : k === A ? seekTo.t : 0;
    } else {
      t[1] = sat(y / act1End());
      for (k = 2; k <= 5; k++) {
        var st = stages[k]; if (!st) continue;
        var e = stageStart(st), x = stageEnd(st); t[k] = sat((y - e) / (x - e)); if (t[k] > 0) A = k;
      }
    }
    var sc = 0; for (k = 1; k <= 5; k++) sc += t[k];
    return { A: A, t: t, s: A - 1 + t[A], sc: min(sc, A - 1 + t[A]) };
  }
  // scroll position that a seek(act, t) stands for, so the waterline and focal points match a real scroll
  function seekY() {
    var a = seekTo.act, t = seekTo.t, st = stages[a];
    if (a === 1 || !st) return t * act1End();
    var e = stageStart(st), x = stageEnd(st); return e + t * (x - e);
  }
  function stageStart(st) { return st.top - vh * .8; }
  function stageEnd(st) { return max(stageStart(st) + 1, min(st.top + st.h - vh * .75, maxY)); }
  function act1End(){return min(.9*heroB,stages[2]?stageStart(stages[2]):.9*heroB);}
  function scrollFor(a, t) { var st = stages[a]; return a === 1 || !st ? t * act1End() : lerp(stageStart(st), stageEnd(st), t); }
  // Continuous world pre-roll: the camera is already travelling before a new stage
  // enters the screen. Semantic progress still belongs to the unobscured stage.
  function worldPhase(k,y,t) {
    if(reduced)return t;
    var st=stages[k];if(!st)return 0;
    var e=stageStart(st),end=stageEnd(st),pre=k===5?(end-e)/24:vh*.20;
    return sat((y-e+pre)/(end-e+pre));
  }
  function focal(k, y) {
    var st = stages[k]; if (!st) return { x: vw / 2, y: vh / 2, h: vh * .7 };
    var top = clamp(st.top - y, 70, vh - 90), bottom = clamp(st.top + st.h - y, top + 50, vh - 28);
    return { x: vw / 2, y: (top + bottom) / 2, h: max(60, bottom - top - 30) };
  }
  var smoothY = null;
  function sceneY() {
    var target = seekTo ? seekY() : W.scrollY || W.pageYOffset || 0;
    if (seekTo || frozen != null || reduced || paused || smoothY == null) smoothY = target;
    else { smoothY += (target - smoothY) * (1 - Math.exp(-max(.001, dt) / .15)); if (abs(target - smoothY) < .15) smoothY = target; }
    return smoothY;
  }
  function windAt(x, c) { return sin(c * .62 - x * .004) * .55 + sin(c * 1.13 - x * .009) * .24; }
  function currentAt(x, c) { return sin(c * .23 - x * .003) * .7 + sin(c * .41 + x * .005) * .3; }

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
  var glowCache = {}, buildingGlow = false;
  function glow(col) {
    var key = col.join(','); if (glowCache[key]) return glowCache[key];
    if(!buildingGlow)return null;
    var c = D.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d');
    var gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(.25, rgba(col, .45)); gr.addColorStop(1, rgba(col, 0));
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return (glowCache[key] = c);
  }
  function blob(img, x, y, r, al) { if (!img || al <= 0.003) return; g.globalAlpha = al; g.drawImage(img, x - r, y - r, 2 * r, 2 * r); g.globalAlpha = 1; }
  var sealSprite = null;

  /* Logo landmarks are in the original 512px asset coordinate system.
     The skull is rigid; only the two neck Beziers bend between it and the chest. */
  var PX=new Float32Array(9),PY=new Float32Array(9),PR=new Float32Array(9),TX=new Float32Array(9),TY=new Float32Array(9);
  var joint={pose:0,age:1,ph:0,amp:0,bend:0,hx:0,hy:0,angle:0,scale:1};
  function spine(a,ph,amp,bend,tilt){
    var pose=sat(-tilt/.8);joint.pose=pose;joint.age=a;joint.ph=ph;joint.amp=amp;joint.bend=bend;
    var headPose=sat(pose+amp*.035*(sin(ph*.2-.22)-sin(ph*.2)));joint.hx=lerp(422,392,headPose);joint.hy=lerp(244,146,headPose);joint.angle=lerp(.32,0,headPose);joint.scale=1+.2*(1-a);
    for(var i=0;i<9;i++){var f=i/8;PX[i]=.48-f;PY[i]=-.055+amp*.025*f*f*sin(ph-i*.6)-bend*.11*f*f;PR[i]=[.10,.11,.13,.15,.135,.108,.073,.042,.022][i];TX[i]=1;TY[i]=0;}
  }
  function bodyY(x,y){return(y-300)/386+joint.amp*.025*pow(sat((300-x)/240),2)*sin(joint.ph-(512-x)*.012)-joint.bend*.11*pow(sat((280-x)/220),2);}
  function headX(x,y){return(joint.hx+((x-392)*cos(joint.angle)-(y-146)*sin(joint.angle))*joint.scale-256)/386;}
  function headY(x,y){return(joint.hy+((x-392)*sin(joint.angle)+(y-146)*cos(joint.angle))*joint.scale-300)/386;}
  function outline(){
    g.moveTo((63-256)/386,bodyY(63,341));
    g.bezierCurveTo((72-256)/386,bodyY(72,322),(90-256)/386,bodyY(90,313),(112-256)/386,bodyY(112,313));
    g.bezierCurveTo((141-256)/386,bodyY(141,316),(153-256)/386,bodyY(153,312),(172-256)/386,bodyY(172,294));
    g.bezierCurveTo((200-256)/386,bodyY(200,264),(216-256)/386,bodyY(216,246),(249-256)/386,bodyY(249,232));
    g.bezierCurveTo((290-256)/386,bodyY(290,216),headX(330,162),headY(330,162),headX(349,135),headY(349,135));
    g.bezierCurveTo(headX(369,111),headY(369,111),headX(392,107),headY(392,107),headX(411,114),headY(411,114));
    g.bezierCurveTo(headX(423,120),headY(423,120),headX(431,108),headY(431,108),headX(440,109),headY(440,109));
    g.bezierCurveTo(headX(450,110),headY(450,110),headX(451,124),headY(451,124),headX(446,137),headY(446,137));
    g.bezierCurveTo(headX(441,149),headY(441,149),headX(430,162),headY(430,162),headX(423,173),headY(423,173));
    g.bezierCurveTo(headX(402,201),headY(402,201),(lerp(407,410,joint.pose)-256)/386,(lerp(305,231,joint.pose)-300)/386,(383-256)/386,(lerp(303,276,joint.pose)-300)/386);
    g.bezierCurveTo((372-256)/386,(lerp(311,291,joint.pose)-300)/386,(361-256)/386,(lerp(310,298,joint.pose)-300)/386,(349-256)/386,(307-300)/386);
    g.bezierCurveTo((310-256)/386,bodyY(310,341),(277-256)/386,bodyY(277,348),(238-256)/386,bodyY(238,347));
    g.bezierCurveTo((210-256)/386,bodyY(210,346),(189-256)/386,bodyY(189,341),(171-256)/386,bodyY(171,351));
    g.bezierCurveTo((155-256)/386,bodyY(155,363),(144-256)/386,bodyY(144,384),(124-256)/386,bodyY(124,394));
    g.bezierCurveTo((108-256)/386,bodyY(108,400),(91-256)/386,bodyY(91,405),(84-256)/386,bodyY(84,401));
    g.bezierCurveTo((77-256)/386,bodyY(77,398),(86-256)/386,bodyY(86,381),(96-256)/386,bodyY(96,367));
    g.bezierCurveTo((105-256)/386,bodyY(105,355),(128-256)/386,bodyY(128,353),(141-256)/386,bodyY(141,339));
    g.bezierCurveTo((114-256)/386,bodyY(114,353),(92-256)/386,bodyY(92,347),(72-256)/386,bodyY(72,348));
    g.bezierCurveTo((64-256)/386,bodyY(64,348),(62-256)/386,bodyY(62,347),(63-256)/386,bodyY(63,341));g.closePath();
  }
  /* Material coordinates run from tail to nose. Every strip follows the same spine;
     neither age, clock, nor world position changes a spot's material coordinate. */
  var materials = {}, skinMaps = [], sealAtlas = null, atlasBuilt = 0, materialReady = false, materialFade = 0;
  var offscreens = [], taskQueue = [], texMode = 'proc', imageBlend = 0, sliceMax = 0, sliceCount = 0;
  var detailJobs = {}, skinJobs = {}, generated = {}, imagePending = false, texWanted = /[?&]tex=on(&|$)/.test(Q);
  var sourceURL = D.currentScript && D.currentScript.src;
  var lightSource = { x: .22, y: .14, height: .45, warm: 0, depth: 0 };
  function smallCanvas(w, h) { var c = D.createElement('canvas'); c.width = w; c.height = h; offscreens.push(c); return c; }
  function pixelCount() { var n = 0; for (var i = 0; i < offscreens.length; i++) n += offscreens[i].width * offscreens[i].height; for (var k in glowCache) n += 4096; return n; }
  function makeDetail(kind) {
    var job = detailJobs[kind];
    if (!job) { var c = smallCanvas(256, 256); job = detailJobs[kind] = { c:c, x:c.getContext('2d'), r:rng(100+kind), n:0 }; job.x.fillStyle='#808080'; job.x.fillRect(0,0,256,256); }
    var x=job.x,r=job.r,end=min(job.n+160,kind===0?3600:2200);
    for(;job.n<end;job.n++) { var xx=r()*256,yy=r()*256,v=80+floor(r()*96);x.strokeStyle='rgba('+v+','+v+','+v+',.48)';x.lineWidth=.5+r()*.65;x.beginPath();
      if(kind===0){x.moveTo(xx,yy);x.quadraticCurveTo(xx-3,yy+.7,xx-4-r()*5,yy+1+r());}
      else if(kind===2){x.moveTo(xx,yy);x.lineTo(xx+sin(yy*.03),yy+5+r()*12);}
      else if(kind===3){x.moveTo(xx,yy);x.lineTo(xx+7,yy-5);}else{x.moveTo(xx,yy);x.lineTo(xx+.7,yy);}x.stroke(); }
    if(job.n<(kind===0?3600:2200))return false;
    materials[['fur','sand','bark','leaf'][kind]]=job.c;return true;
  }
  function detailLayer(kind,x,y,w,h,opacity) {
    if (!materials[kind]) return;
    g.save();g.globalCompositeOperation='soft-light';g.globalAlpha=opacity;g.drawImage(materials[kind],x,y,w,h);
    if(generated[kind]&&imageBlend>0){g.globalAlpha=opacity*imageBlend;g.drawImage(generated[kind],x,y,w,h);}g.restore();
  }
  function imageDetails() {
    if(!texWanted||!sourceURL)return;
    imagePending=true;var remain=4,loaded=0;
    ['fur','sand','bark','leaf'].forEach(function(kind){var img=new Image(),done=false;
      function finish(ok){if(done)return;done=true;if(ok){generated[kind]=img;loaded++;}if(--remain===0){imagePending=false;texMode=loaded===4?'img':'proc';if(loaded!==4)generated={};kick();}}
      img.onload=function(){finish(true);};img.onerror=function(){finish(false);};img.src=new URL('tex/'+kind+'.webp',sourceURL).href;
      setTimeout(function(){finish(false);},5000);
    });
  }
  function coatColor(a, tone, back) {
    var adult = back ? [[72, 88, 94], [49, 62, 68], [108, 98, 83]][tone] : [[204, 210, 201], [177, 192, 189], [221, 209, 180]][tone];
    return mix(back ? [211, 211, 192] : [250, 246, 225], adult, a);
  }
  function makeSkin(tone, ageIndex) {
    var id=tone*3+ageIndex,job=skinJobs[id],a=ageIndex/2,i;
    if(!job){var c=smallCanvas(512,192);job=skinJobs[id]={c:c,x:c.getContext('2d'),r:rng(630+tone*17),n:0,spots:false};}
    var x=job.x,r=job.r;
    if(!job.spots){
      if(a>0)for(i=0;i<158;i++){var xx=24+r()*440,yy=r()<.85?10+r()*105:116+r()*55,rx=1.4+pow(r(),2)*6.8,ry=rx*(.55+r()*.45),th=r()*.8;
        x.fillStyle=rgba([24,35,39],a*(.24+r()*.35));x.beginPath();x.ellipse(xx,yy,rx,ry,th,0,TAU);x.fill();
        if(i%4===0){x.strokeStyle=rgba([223,224,201],.37*a);x.lineWidth=.8;x.stroke();}}
      job.spots=true;return false;
    }
    var end=min(6800,job.n+180);
    for(;job.n<end;job.n++){var fx=r()*512,fy=r()*192,ln=1+r()*5;
      x.strokeStyle=r()>.5?'rgba(245,246,229,.13)':'rgba(22,37,42,.13)';x.lineWidth=.42+r()*.38;x.beginPath();x.moveTo(fx,fy);x.lineTo(fx-ln,fy+sin(fy*.03)*.7);x.stroke();}
    if(job.n<6800)return false;skinMaps[id]=job.c;return true;
  }
  function taskSlice() {
    var start=performance.now();
    if(taskQueue.length){var pick=0,best=99;for(var j=0;j<taskQueue.length;j++){var scene=taskQueue[j].scene||0,score=scene===0?-1:scene===cur.A?0:abs(scene-cur.A)+1;if(score<best){best=score;pick=j;}}var done=taskQueue[pick]();if(done!==false)taskQueue.splice(pick,1);}
    sliceMax=max(sliceMax,performance.now()-start);sliceCount++;
    if(taskQueue.length)setTimeout(taskSlice,0);else{materialReady=true;kick();}
  }
  function queueJob(fn,scene){fn.scene=scene;taskQueue.push(fn);}
  function initMaterials() {
    var i, j;
    [[170,209,230],[205,226,223],[163,206,207],[255,210,139],[255,245,220],[255,242,205],[127,221,226],LIT].forEach(function(col){taskQueue.push(function(){buildingGlow=true;glow(col);buildingGlow=false;});});
    for (i = 0; i < 4; i++) (function (k) { queueJob(function () { return makeDetail(k); },k?4:0); })(i);
    for (i = 0; i < 17; i++) (function (k) { queueJob(function () { makeFrond(k); },4); })(i);
    for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) (function (t, a) { taskQueue.push(function () { return makeSkin(t, a); }); })(i, j);
    queueJob(makeCloud,1);
    queueJob(function(){trackSprite=smallCanvas(64,256);var x=trackSprite.getContext('2d'),gr=x.createLinearGradient(0,0,0,256);gr.addColorStop(0,'rgba(114,112,88,0)');gr.addColorStop(.65,'rgba(115,118,94,.14)');gr.addColorStop(1,'rgba(99,108,88,.23)');x.fillStyle=gr;x.beginPath();x.moveTo(10,0);x.bezierCurveTo(0,90,0,210,0,256);x.lineTo(64,256);x.bezierCurveTo(62,210,62,80,54,0);x.closePath();x.fill();},4);
    queueJob(makeChip,0);
    for(i=0;i<36;i++)(function(n){queueJob(function(){makeBoard(n);},4);})(i);
    taskQueue.push(function(){sealAtlas = smallCanvas(1728, 576);});
    for (i = 0; i < 54; i++) (function (n) { taskQueue.push(function () {
      var save = g, saveCam = cam, d = dpr; g = sealAtlas.getContext('2d'); cam = { k: 1, x0: 0, y0: 0, x1: 0, y1: 0 }; dpr = 1;
      seal((n % 9) * 192 + 96, floor(n / 9) * 96 + 49, 0, 142, { a: (floor(n / 6) % 3) / 2, tone: floor(n / 18), ph: n % 6 * TAU / 6, lod: 0, bake: true, wet: .65 });
      g = save; cam = saveCam; dpr = d; atlasBuilt++;
    }); })(i);
    queueJob(function(){liftCanvas=smallCanvas(cv.width,cv.height);},5);
    queueJob(globeSlice,5);
    setTimeout(taskSlice, 0);
  }
  function skinStrip(a, tone, al) {
    if (!skinMaps[tone * 3]) return;
    var stage = min(1, floor(a * 2)), blend = a * 2 - stage, i;
    if(!skinMaps[tone*3+stage]||(blend>0&&!skinMaps[tone*3+stage+1]))return;
    for (i = 0; i < 12; i++) {
      var f = (i + .5) / 12, node = min(7, floor(f * 8)), t = f * 8 - node;
      var sx = lerp(PX[node], PX[node + 1], t), sy = lerp(PY[node], PY[node + 1], t), rad = lerp(PR[node], PR[node + 1], t), angle = atan2(lerp(TY[node], TY[node + 1], t), lerp(TX[node], TX[node + 1], t));
      g.save(); g.translate(sx, sy); g.rotate(angle); g.globalAlpha = al;
      g.drawImage(skinMaps[tone * 3 + stage], (1 - f) * 512 - 22, 0, 44, 192, -.045, -rad * 1.08, .09, rad * 2.08);
      if (blend > 0) { g.globalAlpha = al * blend; g.drawImage(skinMaps[tone * 3 + stage + 1], (1 - f) * 512 - 22, 0, 44, 192, -.045, -rad * 1.08, .09, rad * 2.08); }
      g.restore();
    }
  }
  var liftCanvas=null,chipSprite=null,chipState=null,boardStates=[],netSegments=0,firstPoint=null;
  function makeChip(){
    chipSprite=smallCanvas(96,96);var x=chipSprite.getContext('2d');
    x.fillStyle='#b7a270';for(var i=0;i<6;i++){var p=20+i*10;x.fillRect(p,9,4,11);x.fillRect(p,76,4,11);x.fillRect(9,p,11,4);x.fillRect(76,p,11,4);}
    var gr=x.createLinearGradient(20,20,75,77);gr.addColorStop(0,'#526363');gr.addColorStop(.4,'#18262c');gr.addColorStop(1,'#354448');x.fillStyle=gr;x.fillRect(18,18,60,60);
    x.strokeStyle='#8a988d';x.lineWidth=2;x.strokeRect(18,18,60,60);x.fillStyle='#102229';x.fillRect(30,30,36,36);
    x.strokeStyle='#819e9b';x.strokeRect(33,33,30,30);x.fillStyle='#abcdd1';x.fillRect(41,41,14,14);
  }
  function pulse(c){return .42+.22*pow(.5+.5*sin(c*TAU/3.6),3);}
  function chipLocal(){return{x:lerp(380,373,joint.pose)/386-256/386,y:lerp(260,252,joint.pose)/386-300/386};}
  function screenPoint(x,y,dir,L,p){var cc=cos(dir),sn=sin(dir),flip=cc<0?-1:1;return{x:cam.x1+cam.k*(x-cam.x0+L*(cc*p.x-sn*flip*p.y)),y:cam.y1+cam.k*(y-cam.y0+L*(sn*p.x+cc*flip*p.y))};}
  function drawChip(x,y,size,lit,light,alpha){
    if(!chipSprite)return;g.save();g.translate(x,y);g.globalAlpha=alpha;g.drawImage(chipSprite,-size/2,-size/2,size,size);
    g.globalCompositeOperation='screen';if(light>0){var img=glow(AI);if(img){g.globalAlpha=alpha*light*.5;g.drawImage(img,-size,-size,size*2,size*2);}g.fillStyle=rgba(AI,alpha*light);g.fillRect(-size*.075,-size*.075,size*.15,size*.15);}
    if(lit){g.globalAlpha=alpha;g.strokeStyle=rgba(AI,.42+light*.25);g.lineWidth=size*.055;g.beginPath();for(var i=0;i<lit;i++){var th=-PI*.82+i*PI*.32,dx=cos(th),dy=sin(th);g.moveTo(dx*size*.42,dy*size*.42);g.quadraticCurveTo(dx*size*.8,dy*size*.75,dx*size*1.35,dy*size*1.1);}g.stroke();}g.restore();
  }
  function seal(x,y,dir,Lb,o){
    var a=sat(o.a||0),ph=o.ph||0,tone=o.tone||0,wet=o.wet==null?1:sat(o.wet),depth=o.depth==null?lightSource.depth:o.depth,al=o.alpha==null?1:o.alpha;
    var tilt=o.tilt||0,amp=o.amp==null?1:o.amp,bend=o.bend||0,lightOnly=o.lod===2;
    spine(a,ph,amp,bend,tilt);var cp=chipLocal(),wp=screenPoint(x,y,dir,Lb,cp),cs={x:wp.x,y:wp.y,size:Lb*.08*cam.k,lit:o.lit||0,expanded:false,brightness:pulse(clock)};
    if(o.hero)chipState=cs;
    if(o.lod===1&&atlasBuilt===54){var n=tone*18+Math.round(a*2)*6+((floor(ph/TAU*6)%6+6)%6);frame(x,y,dir,Lb/142);g.globalAlpha=al;g.drawImage(sealAtlas,n%9*192,floor(n/9)*96,192,96,-96,-49,192,96);g.globalAlpha=1;return cs;}
    frame(x,y,dir,Lb,o.flip);g.globalAlpha=al;
    var back=mul(coatColor(a,tone,true),1-.18*wet*a),belly=mul(coatColor(a,tone,false),1-.07*wet*a),gr=g.createLinearGradient(0,-.35,0,.14);
    gr.addColorStop(0,rgba(back));gr.addColorStop(.43,rgba(mix(back,belly,.16)));gr.addColorStop(.85,rgba(mix(back,belly,.85)));gr.addColorStop(1,rgba(belly));g.fillStyle=gr;g.beginPath();outline();g.fill();
    g.save();g.beginPath();outline();g.clip();skinStrip(a,tone,al*(o.bake?1:materialFade));detailLayer('fur',-.6,-.55,1.3,.85,al*.16);if(skinMaps[tone*3+Math.round(a*2)]){g.save();g.translate((joint.hx-256)/386,(joint.hy-300)/386);g.rotate(joint.angle);g.globalAlpha=al*.45*materialFade;g.drawImage(skinMaps[tone*3+Math.round(a*2)],330,20,150,140,-.16,-.13,.32,.34);g.restore();}
    if(!lightOnly){gr=g.createLinearGradient(0,-.45,0,.17);gr.addColorStop(0,'rgba(228,239,225,.10)');gr.addColorStop(.52,'rgba(16,29,32,.02)');gr.addColorStop(.8,'rgba(13,24,28,.18)');gr.addColorStop(1,'rgba(7,20,25,.35)');g.fillStyle=gr;g.fillRect(-.7,-.65,1.5,1.1);}
    if(wet<1){g.fillStyle=rgba([244,236,213],.15*(1-wet));g.fillRect(-.7,-.65,1.5,1.1);}if(depth>0){g.fillStyle=rgba([8,88,114],.22*depth);g.fillRect(-.7,-.65,1.5,1.1);}
    g.strokeStyle=rgba(depth>.2?[173,235,236]:[255,248,222],(.12+.20*wet)*al);g.lineWidth=clamp(1.7/Lb,.004,.012);g.beginPath();outline();g.stroke();
    if(depth>.2&&quality>=2&&glowCache['163,206,207']){g.save();g.globalCompositeOperation='screen';g.globalAlpha=.14*al;for(var i=0;i<4;i++){var xx=-.4+i*.23+.025*sin(clock*.72+i*2);g.drawImage(glowCache['163,206,207'],xx-.09,-.18+.025*sin(clock*.6+i),.22,.18);}g.restore();}
    if(o.chip!==false){drawChip(cp.x,cp.y,.08,o.lit||0,pulse((o.bake?0:clock)+(o.phase||0))*(o.hero?1: .7),al*(o.chipAlpha==null?1:o.chipAlpha));
      // A few hairs cross the inset's edge; its light remains clipped to the coat.
      g.strokeStyle=rgba(belly,.5);g.lineWidth=.0016;g.beginPath();for(i=0;i<9;i++){var xx=cp.x-.034+i*.008;g.moveTo(xx,cp.y-.041);g.lineTo(xx-.008,cp.y-.033);}g.stroke();}
    g.restore();
    // Teardrop fore flipper. It hangs from the chest and trails the body by half a beat.
    var finX=(365-256)/386,finY=(275-300)/386,finAngle=(1-joint.pose)*.70+sin(ph-.9)*.065*amp-(o.scratch||0)*1.3;
    g.save();g.translate(finX,finY);g.rotate(finAngle);if(!lightOnly){gr=g.createLinearGradient(-.025,0,.085,.19);gr.addColorStop(0,rgba(mix(back,belly,.27)));gr.addColorStop(1,rgba(mul(back,.82)));g.fillStyle=gr;}else g.fillStyle=rgba(mix(back,belly,.17));
    g.beginPath();g.moveTo(.024,-.020);g.bezierCurveTo(.078,.025,.109,.084,.098,.150);g.bezierCurveTo(.091,.182,.080,.208,.057,.212);g.bezierCurveTo(.038,.215,.036,.195,.028,.177);g.bezierCurveTo(0,.140,-.025,.120,-.039,.083);g.bezierCurveTo(-.055,.042,-.033,.002,.024,-.020);g.closePath();g.fill();
    g.strokeStyle=rgba(belly,.26);g.lineWidth=.002;g.beginPath();for(i=0;i<3;i++){g.moveTo(.022+i*.012,.11);g.quadraticCurveTo(.04+i*.01,.15,.047+i*.008,.18);}g.stroke();g.restore();
    // Facial detail lives in the skull's rigid coordinate system, in every pose and age.
    g.save();g.translate((joint.hx-256)/386,(joint.hy-300)/386);g.rotate(joint.angle);g.scale(joint.scale/386,joint.scale/386);g.translate(-392,-146);
    var er=4.6+1.2*(1-a);g.fillStyle=rgba(back,.4);g.beginPath();g.ellipse(404,129,er*1.4,er*1.3,-.1,0,TAU);g.fill();g.fillStyle='#081418';g.beginPath();g.ellipse(404,129,er,o.blink?er*.15:er,-.1,0,TAU);g.fill();
    if(!o.blink){g.fillStyle='#ecf6f2';g.beginPath();g.ellipse(402.8,127.5,er*.29,er*.22,-.2,0,TAU);g.fill();}
    g.fillStyle='#273237';g.beginPath();g.ellipse(444,119,1.6,2,-.4,0,TAU);g.fill();g.strokeStyle='rgba(34,48,49,.6)';g.lineWidth=.9;g.beginPath();g.moveTo(443,136);g.quadraticCurveTo(434,143,424,142);g.stroke();
    if(o.yawn){g.fillStyle='#263436';g.beginPath();g.ellipse(431,141,8,5*o.yawn,.1,0,TAU);g.fill();}
    g.strokeStyle='rgba(224,232,219,.43)';g.lineWidth=.65;g.beginPath();for(i=0;i<4;i++){g.moveTo(433,136+i*2);g.quadraticCurveTo(442,137+i,449+i%2*4,134+i*4);}g.stroke();g.restore();
    if(a<.85||wet<.4){g.save();g.beginPath();outline();g.clip();g.strokeStyle=rgba(belly,.27);g.lineWidth=.0013;g.beginPath();for(i=0;i<36;i++){var fx=-.42+i*.025,fy=-.06+sin(i*.36)*.04;g.moveTo(fx,fy);g.lineTo(fx-.009,fy-.005);}g.stroke();g.restore();}
    g.globalAlpha=1;return cs;
  }
  function makeSprite() { return null; }

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
    var a = ss(.12, .6, t4), b = ss(.72, 1, t4);
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
    if (al <= 0) return;
    var sz = [1, 1.6, 2.4], aa = [.18, .3, .45], par = [.1, .22, .4], H = vh + 40;
    for (var L = 0; L < (quality >= 3 ? 3 : 2); L++) {
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
      var s = shafts[i], sw = sin(clock * .25 + s.p) * .03, x = (s.x + sw) * vw, w = s.w * vw;
      var gr=g.createLinearGradient(x,0,x+w*2.6+vh*.25,0);gr.addColorStop(0,'rgba(150,220,255,0)');gr.addColorStop(.30,rgba([150,220,255],.025*al));gr.addColorStop(.57,rgba([113,207,222],.018*al));gr.addColorStop(1,'rgba(150,220,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w * 2.6 + vh * .25, vh); g.lineTo(x + w * .6 + vh * .25, vh); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }

  /* ---------- act 1: the pup at the night surface ---------- */
  function heroLb(a) { return lerp(mob ? 98 : 130, mob ? 166 : 238, a); }
  // the dive keeps to the side margin and ends where the first ring of act 2 starts, so the body cards never hide the pup
  function act1Pos(t1, y, tx) {
    var d = ss(.05, .72, t1), bob = sin(clock * TAU / 3.6) * 3;
    var yy = lerp(mark.y - y, vh * .58, ss(0, .30, t1));
    if (mob && panel && t1 >= .23 && t1 <= .8) yy = max(yy, min(vh - 80, panel.b - y + 68));
    return { x: lerp(mark.x, vw * .49, d), y: clamp(yy + (bob+15) * (1 - d), 85, vh - 70), dir: sin(PI * d) * .8, d: d, wl: lerp(mark.y, -vh * .7, ss(.02, .75, t1)) };
  }
  function drawRipples(wl, sy) {
    if (wl < -20 || wl > vh + 20) return;
    g.strokeStyle = 'rgba(190,225,255,1)'; g.lineWidth = 1.2 * u;
    var i, e, r;
    for (i = 0; i < 3; i++) { // around the pup, endless
      e = ((clock / 2.4 + i / 3) % 1); r = (16 + 110 * e) * u;
      if (cur.t[1] < .35) ring(hero.x, wl, r, (1 - e) * .5 * (1 - cur.t[1] / .35), sy);
    }
    for (i = ripples.length - 1; i >= 0; i--) {
      e = (clock - ripples[i].t) / 1.6; if (e > 1 || e < 0) { if (e > 1) ripples.splice(i, 1); continue; }
      ring(ripples[i].x, wl, (8 + 90 * e) * u, (1 - e) * .45, sy);
    }
    function ring(x, y, r, al, sy) { if (inPanel(x + r, y, sy) || inPanel(x - r, y, sy)) return; g.globalAlpha = al; g.beginPath(); g.ellipse(x, y, r, r * .16, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; }
  }
  function nightSurface(wl,t1) {
    if(wl < -vh*.2)return;
    var mx=vw*.74,my=wl-vh*.16,moonR=mob?18:27;
    g.save();g.beginPath();g.rect(0,0,vw,max(0,wl));g.clip();blob(glow([170,209,230]),mx,my,moonR*5,.34);
    g.fillStyle='#d9e8e9';g.beginPath();g.arc(mx,my,moonR,0,TAU);g.fill();g.fillStyle='rgba(105,140,157,.18)';g.beginPath();g.arc(mx+moonR*.28,my-moonR*.22,moonR*.27,0,TAU);g.arc(mx-moonR*.18,my+moonR*.24,moonR*.18,0,TAU);g.fill();drawClouds({wl:wl},0);g.restore();
    g.fillStyle='rgba(173,211,223,.24)';g.beginPath();for(var i=0;i<42;i++){var q=i/42,xx=mx+sin(i*1.9+clock*.6)*q*20,yy=wl+q*q*vh*.32,ww=(4+q*55)*(.5+hash(i)*.5);g.rect(xx-ww/2,yy,ww,.8+q);}g.fill();
    if(t1<.12){var breath=(clock%5)/5;if(breath<.14)blob(glow([205,226,223]),hero.x+28,hero.y-13-breath*60,10+breath*45,(1-breath/.14)*.15);}
  }
  function surface(wl,wat) {
    if(wl < -10 || wl > vh+10)return;
    var gr=g.createLinearGradient(0,wl-22,0,wl+7);gr.addColorStop(0,'rgba(90,150,210,0)');gr.addColorStop(1,'rgba(134,199,220,.18)');g.fillStyle=gr;g.fillRect(0,wl-22,vw,29);
    g.strokeStyle='rgba(180,221,235,.48)';g.lineWidth=1.4;g.beginPath();for(var i=0;i<=80;i++){var x=i/80*vw,y=wl+sin(x*.022+clock*.7)*2+windAt(x,clock)*2;if(!i)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();
  }
  function submerge(x, wl, Lb, wat) { // tint the part of the pup that sits below the surface
    if (wl < -10 || wl > vh + 10) return;
    g.fillStyle = rgba(wat[0], .55); g.fillRect(x - Lb, wl + 1, Lb * 2, Lb * .6);
  }
  function drawBubbles(wl) {
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
    if (mob) return { x: vw*.5 + vw * .28 * sin(TAU * q), y: clamp(F.y,vh*.48,vh*.54) + vh*.64 * (.5-q) };
    var w = min(vw * .84, 1320 * u); return { x: F.x + w * (q - .5), y: F.y + vh * .14 * sin(TAU * q) };
  }
  function pathDir(q, F) { var a = ringPath(q - .004, F), b = ringPath(q + .004, F); return atan2(b.y - a.y, b.x - a.x); }
  function act2(t2, t3, F) {
    var al = ss(0, .09, t2) * (1 - ss(0, .22, t3)); if (al <= 0) return;
    ringBoxes=[];var labels = (stages[2] && stages[2].labels) || [], radius = mob ? 30 : 46;
    g.font = labelFont; g.textBaseline = 'middle';
    for (var i = 1; i <= 6; i++) {
      var p = ringPath(i / 7, F), passed = ss(i / 7, i / 7 + .055, t2), breathe = 1 + .055 * sin(clock * .7 + i), rr = radius * breathe;
      var wobble = sin(clock * .52 + i) * .10, yy = p.y - sin(clock * .3 + i) * 4;
      g.save(); g.translate(p.x, yy); g.rotate(wobble); g.globalAlpha = al * (1 - passed);
      // Silver vortex: a dark refractive edge, irregular thickness, broken travelling highlights.
      g.strokeStyle = 'rgba(7,34,46,.75)'; g.lineWidth = 6; g.beginPath(); g.ellipse(0, 0, rr * .63, rr, 0, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(143,199,205,.78)'; g.lineWidth = 3.8; g.stroke();
      g.globalCompositeOperation='screen';
      for (var k = 0; k < 12; k++) {
        var th = k * TAU / 12 + clock * .22, width = 1.1 + .9 * sin(th * 3 + i); g.lineWidth = width;
        g.strokeStyle = rgba(AI,k%3?.83:.62); g.beginPath(); g.ellipse(0, 0, rr * .63, rr, 0, th, th + .35); g.stroke();
      }
      g.restore();
      g.strokeStyle = rgba([201,237,237], al * .65); g.lineWidth = 1; g.beginPath();
      for (k = 0; k < 9; k++) { var angle = k * 2.399 + i, phase = (clock * .15 + k * .13) % 1, dist = rr * (1.1 + passed * phase); var bx = p.x + cos(angle) * dist * .7 + currentAt(p.x, clock) * 6, by = yy + sin(angle) * dist - passed * phase * 68; var br = 1.2 + hash(i * 90 + k) * 2.2; g.moveTo(bx + br, by); g.arc(bx, by, br, 0, TAU); } g.stroke();
      ringBoxes.push({x:p.x,y:yy,w:rr*1.5+8,h:rr*2+10,visible:passed<.95});

    }
  }
  function bounds(x,y,w,h){return{x:x,y:y,w:w,h:h,left:x-w/2,right:x+w/2,top:y-h/2,bottom:y+h/2};}
  function overlap(a,b,pad){return abs(a.x-b.x)<(a.w+b.w)/2+pad&&abs(a.y-b.y)<(a.h+b.h)/2+pad;}
  function heroBounds(){if(hero.screen)return hero.screen;var l=hero.length||heroLb(hero.age),a=hero.dir||0;return bounds(hero.x,hero.y,l*(abs(cos(a))*1.34+abs(sin(a))*.58),l*(abs(sin(a))*1.34+abs(cos(a))*.58));}
  function drawLabels(t2,t3){
    labelBoxes=[];var al=ss(0,.09,t2)*(1-ss(0,.22,t3));if(al<=0||ringBoxes.length!==6)return;
    var labels=stages[2].labels,H=heroBounds(),i,j,k;g.font=labelFont;g.textBaseline='middle';g.textAlign='center';
    for(i=0;i<6;i++){
      var r=ringBoxes[i],txt=labels[i],w=g.measureText(txt).width+8,best=null,cost=1e9;
      // Nearby candidates first; both ring clearance and protagonist clearance are geometric.
      for(j=0;j<31;j++)for(k=0;k<4;k++){
        var dy=(j?Math.ceil(j/2)*(j%2?1:-1):0)*23;
        var xx=k===0?r.x-r.w/2-w/2-9:k===1?r.x+r.w/2+w/2+9:r.x;
        var yy=r.y+dy+(k===2?-r.h/2-17:k===3?r.h/2+17:0);
        var box=bounds(clamp(xx,8+w/2,vw-8-w/2),yy,w,20),valid=box.top>=78&&box.bottom<=vh-12&&!overlap(box,H,8);
        for(var z=0;z<ringBoxes.length&&valid;z++)if(ringBoxes[z].visible&&overlap(box,ringBoxes[z],5))valid=false;
        for(z=0;z<labelBoxes.length&&valid;z++)if(overlap(box,labelBoxes[z],4))valid=false;
        var score=abs(box.x-r.x)*.65+abs(box.y-r.y)+(mob?0:abs(box.x-r.x)*.8);
        if(valid&&score<cost){cost=score;best=box;}
      }
      if(best){best.text=txt;best.ring=i;labelBoxes.push(best);g.fillStyle=rgba([227,245,240],al*(.78+.22*ss((i+1)/7,(i+1)/7+.055,t2)));g.fillText(txt,best.x,best.y);}
    }
  }
  function ringEnergy(t,F){if(!chipState||quality<=1)return;g.save();g.globalCompositeOperation='screen';g.lineWidth=1.2;for(var i=1;i<=6;i++){var e=(t-i/7)/.055;if(e<=0||e>=1)continue;var p=ringPath(i/7,F);g.strokeStyle=rgba(AI,.65*sin(PI*e));g.beginPath();g.moveTo(p.x,p.y);g.quadraticCurveTo((p.x+chipState.x)/2,p.y-18,chipState.x,chipState.y);g.stroke();blob(glow(AI),lerp(p.x,chipState.x,e),lerp(p.y,chipState.y,e),6,.45*sin(PI*e));}g.restore();}
  function updateAge(t2, t3) {
    var q = min(6, floor(t2 * 7 + 1e-6)), x = t2 * 7 - q;
    hero.n = t3 > 0 ? 6 : q;
    var growth=0;for(var i=1;i<=6;i++){growth+=ss(i/7-.018,i/7+.040,t2)/6;var elapsed=sat((t2-i/7)/.09);growth+=.012*sin(PI*elapsed)*(1-elapsed);}
    hero.age=t3>0?1:sat(growth);
  }

  function underwater(wl, sc, y) {
    var underwaterAlpha = 1 - ss(3.02, 3.45, sc); if (underwaterAlpha <= 0) return;
    g.save(); g.beginPath(); g.rect(0, max(0, wl), vw, vh - max(0, wl)); g.clip();
    var i, k, px, py, wave = currentAt(vw * .5, clock), floorY = vh * (1.24 - ss(1.65, 2.65, sc) * .42 - ss(2.7, 3.15, sc) * .08);
    // Four distances: remote ridge, silver fish, rooted kelp/jellies, near marine snow.
    for (k = 0; k < 3; k++) {
      g.fillStyle = rgba([9 + k * 3, 43 + k * 4, 54 + k * 3], (.35 - k * .05) * underwaterAlpha); g.beginPath(); g.moveTo(-20, vh);
      for (i = 0; i <= 32; i++) { px = i / 32 * vw; py = floorY - vh * (.10 + k * .07) + sin(i * .72 + k) * vh * .025 + sin(i * .22 + k) * vh * .06 - y * .008 * k % 20; g.lineTo(px, py); } g.lineTo(vw + 20, vh); g.closePath(); g.fill();
    }
    for (k = 0; k < 3; k++) { g.fillStyle = rgba([158,207,210], (.22 + .13 * sin(clock * .5 + k)) * underwaterAlpha); g.beginPath(); for (i = 0; i < (mob ? 28 : 45); i++) {
      var seed = i + k * 101, phase = clock * .08 + k * 2, fx = (hash(seed) + clock * .009 + k * .3) % 1;
      px = fx * vw + sin(phase) * 25; py = vh * (.16 + k * .24) + sin(fx * 8 + phase) * vh * .055 + (hash(seed + 61) - .5) * vh * .12;
      var size = 1.2 + hash(seed + 14) * 3; g.moveTo(px + size, py); g.lineTo(px - size, py - size * .35); g.lineTo(px - size * 1.8, py + size * .55); g.lineTo(px - size, py + size * .18); g.closePath(); } g.fill(); }
    if (floorY < vh + 15) {
      var sand = g.createLinearGradient(0, floorY - 70, 0, vh); sand.addColorStop(0, rgba([57,101,107], .85 * underwaterAlpha)); sand.addColorStop(1, rgba([88,125,120], underwaterAlpha));
      g.fillStyle = sand; g.beginPath(); g.moveTo(0,floorY);for(i=1;i<=48;i++){var sx=i*vw/48;g.lineTo(sx,floorY+sin(i*.23)*vh*.026+sin(i*.71)*vh*.008-i/48*vh*.10*ss(2.5,3,sc));} g.lineTo(vw, vh); g.lineTo(0, vh); g.closePath(); g.fill();
      g.save(); g.clip(); if (materials.sand) { g.globalAlpha = .13 * underwaterAlpha; g.globalCompositeOperation = 'soft-light'; g.fillStyle = g.createPattern(materials.sand, 'repeat'); g.fillRect(0, floorY - vh * .2, vw, vh); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
      g.strokeStyle=rgba([167,204,178],.07*underwaterAlpha);g.lineWidth=1.5;g.beginPath();for(i=0;i<12;i++){var sy=floorY+i*i*.8;g.moveTo(0,sy);for(k=0;k<=18;k++)g.lineTo(k*vw/18,sy+sin(k*.7+i)*4);}g.stroke();
      if(quality>=2){for(var band=0;band<3;band++){g.strokeStyle=rgba([177,229,208],(.035+band*.025)*underwaterAlpha);g.lineWidth=1.6+band*.9;g.beginPath();for(i=0;i<(mob?22:42);i++){var seed=i+band*90,xx=hash(seed+301)*vw+wave*12,yy=floorY+hash(seed+441)*(vh-floorY),rx=12+hash(seed+80)*33,ry=4+hash(seed+10)*12;for(k=0;k<=9;k++){var th=k/9*TAU,px=xx+cos(th)*rx*(.8+.25*sin(k*2+seed+clock*.2)),py=yy+sin(th)*ry*(.8+.2*cos(k*2.7+clock*.3));if(!k)g.moveTo(px,py);else g.lineTo(px,py);}}g.stroke();}}g.restore();
      for (i = 0; i < 7; i++) { px = hash(i + 909) * vw; py = floorY + hash(i + 30) * (vh - floorY); g.fillStyle = rgba([36,65,75], .8 * underwaterAlpha); g.beginPath(); g.ellipse(px, py, 12 + hash(i) * 16, 5 + hash(i) * 9, -.2, 0, TAU); g.fill(); }
      star5(vw * .28, min(vh - 25, floorY + 48), 8, rgba([174,141,106], underwaterAlpha));
      coral(vw * .78, min(vh, floorY + 65), 28, 3, underwaterAlpha * .55);
    }
    for(k=0;k<2;k++){
      var count=mob?9:18;g.strokeStyle=rgba(k?[48,103,82]:[19,66,75],.7*underwaterAlpha);g.lineWidth=k?1.7:1.2;g.beginPath();
      for(i=0;i<count;i++){px=hash(i+k*100)*vw;var root=max(floorY,vh*.94)+12,h=(65+hash(i+80)*160)*(k?1:.65),sway=currentAt(px,clock-k)*h*.23;g.moveTo(px,root);g.bezierCurveTo(px,root-h*.35,px+sway*.6,root-h*.76,px+sway,root-h);}g.stroke();
      g.fillStyle=rgba(k?[47,103,76]:[17,64,73],.70*underwaterAlpha);g.beginPath();
      for(i=0;i<count;i++){px=hash(i+k*100)*vw;root=max(floorY,vh*.94)+12;h=(65+hash(i+80)*160)*(k?1:.65);sway=currentAt(px,clock-k)*h*.23;
        for(var leaf=1;leaf<10;leaf++){var q=leaf/11,side=leaf%2?1:-1,lx=px+sway*q*q,ly=root-h*q,len=(12+17*sin(q*PI))*(k?1:.7),ripple=sin(clock*.9-leaf*.8+i)*5*q;
          g.moveTo(lx,ly);g.bezierCurveTo(lx+side*len*.3,ly-len*.4,lx+side*len*.7,ly+len*.1,lx+side*len,ly-len*.3+ripple);g.bezierCurveTo(lx+side*len*.6,ly+len*.33,lx+side*len*.3,ly+len*.15,lx,ly);g.closePath();g.moveTo(lx+2,ly);g.ellipse(lx,ly,2,3,side*.3,0,TAU);
        }
      }g.fill();
    }
    g.fillStyle=rgba([20,74,69],.65*underwaterAlpha);g.beginPath();for(i=0;i<24;i++){px=hash(i+971)*vw;var rootY=vh+4,gh=25+hash(i+77)*45,bend=currentAt(px,clock)*gh*.3;g.moveTo(px-2,rootY);g.quadraticCurveTo(px-5,rootY-gh*.6,px+bend,rootY-gh);g.quadraticCurveTo(px+5,rootY-gh*.4,px+2,rootY);g.closePath();}g.fill();
    g.strokeStyle = rgba([189,228,229], .26 * underwaterAlpha); g.lineWidth = .9; g.beginPath(); for (i = 0; i < 25; i++) { px = (i % 4 + 1) / 5 * vw + sin(i * 4 + clock) * 9 + wave * 14; py = vh - (clock * 18 + i * 91) % vh; var rr = 1 + hash(i + 200) * 2.5; g.moveTo(px + rr, py); g.arc(px, py, rr, 0, TAU); } g.stroke();
    if (quality >= 3) for (i = 0; i < 9; i++) { px = (hash(i + 14) * vw + currentAt(i * 50, clock) * 28 + vw) % vw; py = (hash(i + 111) * vh - clock * 14 - y * .11) % vh; if (py < 0) py += vh; blob(glow([163,206,207]), px, py, 2 + hash(i + 40) * 4, .16 * underwaterAlpha); }
    g.restore();
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
  function leaderTarget(t3, F) { return { x: F.x + vw * .10 * sin(clock * .35) * sin(PI * t3), y: F.y - F.h * .08 }; }
  function updateSwarm(t3, F, step) {
    var T = leaderTarget(t3, F), origin = ringPath(1, focal(2, smoothY || 0)), blend = ss(0, .2, t3);
    leader.x = lerp(origin.x, T.x, blend); leader.y = lerp(origin.y, T.y, blend); leader.vx = 60; leader.vy = sin(clock * .4) * 12;
    for (var i = 0; i < boids.length; i++) {
      var b = boids[i], pair = floor(i / 2), q = ss(b.tau * .65, min(1, b.tau * .65 + .25), t3);
      b.on=cur.t[3]>=b.tau&&cur.t[3]>0;b.live=b.on;b.al=ss(b.tau,min(1,b.tau+.035),cur.t[3]);
      var phase = pair * 2.39996 + clock * .12, xx = F.x + sin(phase) * vw * (.15 + .27 * hash(pair)), yy = F.y + ((pair * .618 % 1) - .5) * F.h * .95;
      if (i % 2) { xx += 17 * u; yy += 20 * u; }
      b.x = lerp(vw / 2 + cos(b.th) * vw * 1.2, xx, q); b.y = lerp(F.y + sin(b.th) * vh, yy, q);
      if (ptr) { var dx = b.x - ptr.x, dy = b.y - ptr.y, pd = sqrt(dx * dx + dy * dy) || 1; if (pd < 95) { b.x += dx / pd * (95 - pd) * .5; b.y += dy / pd * (95 - pd) * .5; } }
      b.vx = cos(phase) * 35; b.vy = -10 + sin(phase) * 12; b.ph = clock * (3.5 + b.size) + b.th; b.tn = 0;
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
      else b.chip=seal(b.x,b.y,dir,Lb,{a:b.age,ph:b.ph,tone:b.i%3,lod:1,col:col,alpha:alL*b.al,px:Lb});
    }
    base();
  }
  function drawNetwork(t){
    netSegments=0;var strength=ss(.28,.72,t)*(1-ss(.80,.94,t));if(quality<=1||strength<=0||!chipState)return;
    g.save();g.globalCompositeOperation='screen';g.strokeStyle=rgba(AI,.19*strength);g.lineWidth=.7;g.beginPath();
    var limit=mob?150:260,reach=mob?100:170;
    for(var i=-1;i<boids.length&&netSegments<limit;i++){var p=i<0?chipState:boids[i].chip;if(!p||(i>=0&&(!boids[i].live||boids[i].al<.2))||p.x<0||p.x>vw||p.y<0||p.y>vh)continue;
      var one=-1,two=-1,d1=reach*reach,d2=d1;
      for(var j=0;j<boids.length;j++){if(j===i||!boids[j].live||boids[j].al<.2||!boids[j].chip)continue;var q=boids[j].chip,d=(p.x-q.x)*(p.x-q.x)+(p.y-q.y)*(p.y-q.y);if(d<d1){two=one;d2=d1;one=j;d1=d;}else if(d<d2){two=j;d2=d;}}
      for(var k=0;k<2&&netSegments<limit;k++){var n=k?two:one;if(n<0||n<i)continue;var end=boids[n].chip;g.moveTo(p.x,p.y);g.lineTo(end.x,end.y);netSegments++;}
    }g.stroke();g.restore();
  }
  function countSeals() { var n = 1; for (var i = 0; i < boids.length; i++) if (boids[i].live && boids[i].al > 0) n++; return n; }
  function drawJellies(al, y) {
    if (al <= 0) return;
    var c = clock;
    for (var i = 0; i < jellies.length; i++) {
      var j = jellies[i], pulse = .5 + .5 * sin(c * 1.6 + j.p), x = j.x * vw + sin(c * .2 + j.p) * 20 * u;
      var yy = ((j.y * (vh + 200) - c * j.v * vh) % (vh + 200) + vh + 200) % (vh + 200) - 100, s = 22 * u * j.s;
      g.globalAlpha = al * .5; g.fillStyle = 'rgba(190,170,255,.55)';
      g.beginPath(); g.ellipse(x, yy, s * (1 - .15 * pulse), s * (.7 + .15 * pulse), 0, PI, TAU); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(190,170,255,.45)'; g.lineWidth = 1.2 * u; g.beginPath();
      for (var k = -2; k <= 2; k++) { g.moveTo(x + k * s * .3, yy); g.quadraticCurveTo(x + k * s * .35 + sin(c * 2 + k) * 4 * u, yy + s * 1.2, x + k * s * .25, yy + s * 2.2); }
      g.stroke(); g.strokeStyle = 'rgba(219,220,255,.44)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, yy, s * (1 - .15 * pulse), s * .14, 0, 0, TAU);
      for (var rib = -1; rib <= 1; rib++) { g.moveTo(x, yy - s * .72); g.quadraticCurveTo(x + rib * s * .7, yy - s * .4, x + rib * s * .65, yy); } g.stroke(); g.fillStyle = 'rgba(233,183,225,.22)'; g.beginPath(); g.ellipse(x, yy - s * .22, s * .25, s * .3, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
    }
  }
  function drawTurtle(al) {
    if (al <= 0) return;
    var c = clock, e = (c % 40) / 15; if (e > 1) return;
    var x = lerp(-80 * u, vw + 80 * u, e), y = vh * .3 + sin(e * 5) * 20 * u, s = 26 * u, f = sin(c * 3) * .5;
    g.globalAlpha = al * .6; g.fillStyle = '#2e6b5c';
    g.beginPath(); g.ellipse(x, y, s, s * .62, 0, 0, TAU); g.ellipse(x + s * 1.15, y - s * .05, s * .32, s * .24, 0, 0, TAU);
    g.ellipse(x + s * .45, y - s * .6, s * .45, s * .14, -.6 + f, 0, TAU); g.ellipse(x + s * .45, y + s * .6, s * .45, s * .14, .6 - f, 0, TAU);
    g.ellipse(x - s * .7, y - s * .45, s * .25, s * .1, .5, 0, TAU); g.ellipse(x - s * .7, y + s * .45, s * .25, s * .1, -.5, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }

  /* ---------- act 4: landing (beach, splashes, palms, coconuts, sunrise) ---------- */
  var fronds = [], frondShadows = [], cloudSprite = null, spots = [], swimmers = [], palms = [], crabs = [], birds = [], grass = [], corals = [], splashes = [], nuts = [], lastNut = -9, autoNut = null;
  function setupBeach() {
    var r = rng(4), i, S = mob ? 6 : 14;
    spots = [];
    var positions=mob?[[.48,.79,1],[.24,.78,.8],[.125,.785,.25],[.735,.78,.9],[.84,.785,.55],[.94,.78,.7]]:[[.46,.78,1],[.32,.77,.8],[.23,.775,.25],[.61,.77,.9],[.15,.775,.55],[.71,.77,.7],[.81,.775,.8],[.10,.77,.4]];
    for (i = 0; i < positions.length; i++) spots.push({ fx:positions[i][0], fy:positions[i][1], age:positions[i][2], dir:i%2?0:PI, ph:r()*TAU, w:r()*TAU });
    if(mob){var order=[2,1,0,3,4,5],cursor=(vw-(136+37+30+40+32+35)*1.18-20)/2;for(var cell=0;cell<order.length;cell++){var id=order[cell],width=actorLength(id)*1.18;spots[id].fx=(cursor+width/2)/vw;spots[id].fy=.79+(id===0?.005:(id%2)*.003);cursor+=width+4;}}
    swimmers = []; for (i = 0; i < (mob ? 6 : 12); i++) swimmers.push({ fx:r(), fy:r(), p:r()*TAU, age:r()*.5+.4 });
    palms = []; var pf = mob ? [[.94,.46,-.30],[.80,.27,.16],[1.10,.37,-.25]] : [[.77,.39,.10],[.9,.49,-.13],[.69,.53,.23]];
    for (i = 0; i < pf.length; i++) palms.push({ fx:pf[i][0], h:pf[i][1], lean:pf[i][2], p:r()*TAU, n:4, dropped:0 });
    crabs = [{ fx: .2, fy: .7, p: 0 }, { fx: .7, fy: .45, p: 2 }];
    birds = []; var B = mob ? 3 : 5; for (i = 0; i < B; i++) birds.push({ x: r(), y: .06 + r() * .22, v: .02 + r() * .025, p: r() * TAU, s: .7 + r() * .5 });
    grass = []; for (i = 0; i < 22; i++) grass.push({ x: r() * .5, h: .06 + r() * .1, p: r() * TAU });
    corals = []; for (i = 0; i < 5; i++) corals.push({ x: .03 + r() * .4, s: .6 + r() * .6, seed: i });
    splashes = []; nuts = []; autoNut = null;
  }
  function makeFrond(index) {
    var c=smallCanvas(512,384),x=c.getContext('2d'),i,sign;
    var layout=[[-240,15,55],[-200,-45,68],[-145,-92,48],[-85,-132,28],[-25,-142,8],[50,-138,30],[110,-102,42],[180,-55,54],[230,10,68],[205,70,55],[-200,80,45],[-140,128,28],[135,145,48],[65,151,16],[-85,175,14],[30,195,15],[145,175,28]];
    var F=layout[index],colors=index>13?['#796744','#ac9657']:[['#163e38','#315b43'],['#245237','#4e733d'],['#345e31','#78954d']][index%3];
    for(var shade=0;shade<2;shade++){x.fillStyle=colors[shade];x.beginPath();for(i=1;i<=36;i++)for(sign=-1;sign<=1;sign+=2){
      var q=i/38,ax=256+q*F[0],ay=150-sin(q*PI)*F[2]+q*q*F[1],dx=F[0],dy=-cos(q*PI)*PI*F[2]+q*2*F[1],norm=sqrt(dx*dx+dy*dy),tx=dx/norm,ty=dy/norm;
      var len=(8+25*sin(pow(q,.7)*PI))*(1-q*.4)*( .76+.32*hash(index*70+i+sign)),tipx=ax+tx*len*.55-ty*sign*len,tipy=ay+ty*len*.55+tx*sign*len+7*q,width=1.5*sin(q*PI)+.35;
      x.moveTo(ax-tx*width,ay-ty*width);x.quadraticCurveTo(ax+tx*len*.2-ty*sign*len*.7,ay+ty*len*.2+tx*sign*len*.7,tipx,tipy);x.quadraticCurveTo(ax+tx*(shade?width:0)-ty*sign*len*.15,ay+ty*(shade?width:0)+tx*sign*len*.15,ax+tx*width,ay+ty*width);x.closePath();}x.fill();}
    x.strokeStyle=index>13?'#b19c66':'#82915a';x.lineWidth=1.25;x.beginPath();x.moveTo(256,150);for(i=1;i<=60;i++){var t=i/60;x.lineTo(256+t*F[0],150-sin(t*PI)*F[2]+t*t*F[1]);}x.stroke();
    if(materials.leaf){x.globalCompositeOperation='source-atop';x.globalAlpha=.14;x.drawImage(materials.leaf,0,0,512,384);if(generated.leaf)x.drawImage(generated.leaf,0,0,512,384);}fronds[index]=c; var sh=smallCanvas(256,192),sg=sh.getContext('2d');sg.drawImage(c,0,0,256,192);sg.globalCompositeOperation='source-atop';sg.fillStyle='#253932';sg.fillRect(0,0,256,192);frondShadows[index]=sh;
  }
  var boardAtlas=[],boardBuilt=0,trackSprite=null,boardSizes=[36,60,100,172],boardCells=[96,160,256,448];
  function boardShape(x){x.beginPath();x.moveTo(.60,-.025);x.bezierCurveTo(.50,-.13,.16,-.17,-.40,-.12);x.bezierCurveTo(-.62,-.10,-.62,.09,-.43,.12);x.bezierCurveTo(.08,.17,.47,.10,.60,-.025);x.closePath();}
  function makeBoard(n){
    var size=floor(n/9),angle=floor(n/3)%3,lit=n%3,L=boardSizes[size],cell=boardCells[size],i;if(!boardAtlas[size])boardAtlas[size]=smallCanvas(cell*3,cell*1.5);var x=boardAtlas[size].getContext('2d');
    x.save();x.translate(lit*cell+cell/2,angle*cell/2+cell/4);x.scale(2*L,2*L);x.rotate((angle-1)*.16);
    var gr=x.createLinearGradient(0,-.15,0,.15);gr.addColorStop(0,'#647574');gr.addColorStop(.25,'#1a292e');gr.addColorStop(.72,'#142027');gr.addColorStop(1,'#4b6266');
    boardShape(x);x.fillStyle=gr;x.fill();x.strokeStyle='#999f86';x.lineWidth=.8/L;x.stroke();x.save();x.clip();
    var lines=size<2?3:6;x.strokeStyle=lit?rgba(AI,.15+lit*.20):'#536b6a';x.lineWidth=(size<2?1.1:.9)/L;x.beginPath();
    for(i=0;i<lines;i++){var side=i%2?1:-1,yy=(floor(i/2)-1)*.034,ex=side*(.27+.075*floor(i/2));x.moveTo(side*.04,yy);x.lineTo(side*.13,yy);x.lineTo(side*.19,yy+side*.035);x.lineTo(ex,yy+side*.035);x.lineTo(ex+side*.05,side*.095);}x.stroke();
    x.fillStyle='#b4a16b';for(i=0;i<(size<2?8:16);i++){var xx=-.39+i*(size<2?.11:.053);x.fillRect(xx,.095,.012,.022);x.fillRect(xx,-.115,.012,.022);}
    gr=x.createLinearGradient(-.4,-.15,.4,.15);gr.addColorStop(0,'rgba(215,237,232,0)');gr.addColorStop(.45,'rgba(215,237,232,.12)');gr.addColorStop(.53,'rgba(215,237,232,.02)');gr.addColorStop(1,'rgba(215,237,232,0)');x.fillStyle=gr;x.fillRect(-.65,-.18,1.3,.36);x.restore();x.restore();boardBuilt++;
  }
  function drawBoard(x,y,L,dir,light,bank,unfold,core){
    if(boardBuilt<36)return;var size=0;while(size<3&&L>boardSizes[size]*1.35)size++;var angle=clamp(Math.round(bank/.16)+1,0,2),level=clamp(Math.round(light*2),0,2),n=size*9+angle*3+level;
    unfold=unfold==null?1:unfold;var open=ss(0,1,unfold),unit=boardSizes[size];frame(x,y,dir,L/unit);
    g.save();g.scale(lerp(.07,1,open),lerp(.12,1,open));g.globalAlpha=ss(.15,.85,open);g.drawImage(boardAtlas[size],level*boardCells[size],angle*boardCells[size]/2,boardCells[size],boardCells[size]/2,-boardCells[size]/4,-boardCells[size]/8,boardCells[size]/2,boardCells[size]/4);g.restore();
    if(open<1){frame(x,y,dir,L);g.save();g.globalCompositeOperation='screen';g.scale(lerp(.07,1,open),lerp(.12,1,open));g.strokeStyle=rgba(AI,.45*sin(PI*open));g.lineWidth=1/L;boardShape(g);g.stroke();g.restore();}
    frame(x,y,dir,1);drawChip(0,0,L*.08,0,core||0,1);base();
    if(light>0&&quality>=2){g.save();g.globalCompositeOperation='screen';var f=(clock*.7)%1;blob(glow(AI),x+cos(dir)*L*.45*f,y+sin(dir)*L*.45*f,L*.09,light*.22*sin(PI*f));g.restore();}
  }
  function surfWave(B,t){
    var swell=sin(PI*ss(.16,.47,t)),yy=vh*lerp(.64,.68,ss(.16,.42,t)),height=vh*.17*swell;
    if(swell<.001)return;var gr=g.createLinearGradient(0,yy-height,0,yy+28);gr.addColorStop(0,'rgba(151,211,203,.87)');gr.addColorStop(.18,'rgba(27,124,143,.95)');gr.addColorStop(.72,'rgba(27,92,118,.85)');gr.addColorStop(1,'rgba(35,100,118,0)');
    g.fillStyle=gr;g.beginPath();g.moveTo(0,yy+28);for(var i=0;i<=50;i++){var x=i/50*vw;g.lineTo(x,yy-height+sin(x*.010+clock*.6)*height*.08);}g.lineTo(vw,yy+28);g.closePath();g.fill();
    var breaking=ss(.35,.44,t)*(1-ss(.46,.55,t));g.strokeStyle=rgba([226,245,234],.22*swell+.65*breaking);g.lineWidth=2+vh*.028*breaking;g.beginPath();for(i=0;i<=50;i++){var xx=i/50*vw,wy=yy-height+sin(xx*.010+clock*.6)*height*.08;if(!i)g.moveTo(xx,wy);else g.lineTo(xx,wy);}g.stroke();
  }
  function dragTrack(x,y,endX,endY,L,al){
    var length=Math.hypot(endX-x,endY-y);if(!trackSprite||length<3||al<=0)return;var width=max(8,L*.30);g.save();g.translate(x,y);g.rotate(atan2(endY-y,endX-x)-PI/2);g.globalAlpha=al;g.drawImage(trackSprite,-width/2,0,width,length);g.restore();
  }
  function seaSeal(x,y,L,age,tone,al){
    var waterY=y+sin(clock*.8+x*.03)*2;g.save();base();g.beginPath();g.rect(x-L,waterY-L,L*2,L);g.clip();
    seal(x,waterY+L*.04,0,L,{a:age,ph:clock*3,tone:tone,lod:1,alpha:al,depth:1});g.restore();base();
    g.fillStyle=rgba([34,100,119],.26);g.beginPath();g.ellipse(x,waterY-1,L*.52,L*.045,0,0,TAU);g.fill();
    g.strokeStyle=rgba([194,223,220],al*.38);g.lineWidth=1.2;g.beginPath();g.ellipse(x,waterY+2,L*.65,L*.07,0,0,TAU);g.stroke();
  }
  function drawGull(x,y,s,phase){
    var flap=sin(phase)*ss(.45,.65,sin(phase*.19)),up=s*(.2+flap*.55);g.fillStyle='#d6dfdb';g.beginPath();
    g.moveTo(x-s*1.4,y-up);g.lineTo(x-s*.55,y-s*.30);g.quadraticCurveTo(x,y-s*.05,x+s*.48,y-s*.28);g.lineTo(x+s*1.5,y-up*.8);g.lineTo(x+s*.48,y+s*.06);g.quadraticCurveTo(x,y+s*.34,x-s*.5,y+s*.08);g.closePath();g.fill();
    g.strokeStyle='#657b80';g.lineWidth=max(1,s*.16);g.beginPath();g.moveTo(x-s*1.35,y-up);g.lineTo(x-s*.55,y-s*.30);g.lineTo(x,y);g.lineTo(x+s*.48,y-s*.28);g.lineTo(x+s*1.45,y-up*.8);g.stroke();g.fillStyle='#e8e7d5';g.beginPath();g.ellipse(x+s*.14,y+s*.04,s*.28,s*.19,-.2,0,TAU);g.fill();
  }
  function beachGeom(t4){var near=ss(.30,.48,t4),wl=vh*.38;return{wl:wl,rise:0,near:near,top:function(x){return lerp(vh*.405,vh*.61,near)+sin(x/vw*PI)*vh*.022*near-x/vw*vh*.025*near;},shore:function(){return vw*.5;},sx0:0,sx1:vw};}
  function spotPos(sp,B) { return {x:vw*sp.fx,y:vh*sp.fy+B.rise,k:.55+.45*sp.fy}; }
  function updateLight(t4) { var e=ss(.2,1,t4); lightSource.x=lerp(.74,.22,ss(0,.25,t4)); lightSource.y=lerp(.36,.12,e); lightSource.height=lerp(.09,1.05,e); lightSource.warm=1-e; }
  function drawSun(B,t4) {
    var e=ss(.60,1,cur.t[4]), R=(mob?22:35), x=vw*lightSource.x, y=B.wl+R*1.15-vh*.30*e;
    g.save();g.beginPath();g.rect(0,0,vw,max(0,B.wl));g.clip();blob(glow([255,210,139]),x,y,R*6,.55);
    g.fillStyle=rgba(mix([255,175,101],[255,245,204],e));g.beginPath();g.arc(x,y,R,0,TAU);g.fill();g.restore();return{x:x,y:y,R:R,e:e};
  }
  function sunTrail(sun,B,al) {
    if(sun.y>B.wl+sun.R*.5)return;
    g.strokeStyle='rgba(255,237,182,.55)';g.lineCap='round';
    for(var i=0;i<43;i++){var q=i/43,yy=lerp(B.wl+3,B.top(sun.x),q),ww=(4+q*q*75)*(1-lightSource.height*.46)*(1+.25*sin(clock*2+i*2.1)),sx=sun.x+sin(i*1.9+clock)*8;
      g.lineWidth=.6+q*1.2;g.beginPath();g.moveTo(sx-ww*.5,yy);g.quadraticCurveTo(sx-ww*.15,yy-1.2,sx+ww*(.1+hash(i)*.4),yy+.3);g.stroke();}g.lineCap='butt';
  }
  function makeCloud() {
    cloudSprite=smallCanvas(512,160);var x=cloudSprite.getContext('2d');
    for(var i=0;i<22;i++){var xx=30+i*20,yy=85+sin(i*2.4)*14,r=30+hash(i+80)*23,gr=x.createRadialGradient(xx,yy,2,xx,yy,r);gr.addColorStop(0,'rgba(255,246,229,.26)');gr.addColorStop(.5,'rgba(255,246,229,.12)');gr.addColorStop(1,'rgba(255,246,229,0)');x.fillStyle=gr;x.fillRect(xx-r,yy-r,r*2,r*2);}
  }
  function drawClouds(B,day) {
    if(!cloudSprite)return;
    for(var i=0;i<4;i++){var x=((hash(i+20)*vw+clock*(1+day)*2+windAt(i*100,clock)*5)%(vw+250))-125,y=B.wl-vh*(.12+i*.075);g.globalAlpha=day?.47:.20;g.drawImage(cloudSprite,x,y-25,180+i*25,56+i*8);}g.globalAlpha=1;
  }
  function drawOcean(B,t4) {
    var i,k;g.save();g.beginPath();g.rect(0,B.wl,vw,vh-B.wl);g.clip();
    var gr=g.createLinearGradient(0,B.wl,0,B.top(vw/2));var emerge=ss(0,.4,t4),deep=waterColors(3);gr.addColorStop(0,rgba(mix(deep[0],mix([60,83,97],[35,89,109],lightSource.height),emerge)));gr.addColorStop(.5,rgba(mix(deep[0],[51,127,137],emerge)));gr.addColorStop(1,rgba(mix(deep[1],[120,182,164],emerge)));g.fillStyle=gr;g.fillRect(0,B.wl,vw,vh-B.wl);
    // A distant headland and mist anchor the horizon.
    g.fillStyle='rgba(46,86,98,.5)';g.beginPath();g.moveTo(vw*.66,B.wl+2);g.bezierCurveTo(vw*.77,B.wl-36,vw*.82,B.wl-13,vw,B.wl-21);g.lineTo(vw,B.wl+4);g.closePath();g.fill();
    g.strokeStyle='rgba(213,232,218,.3)';g.lineWidth=3;g.beginPath();g.moveTo(0,B.wl);g.lineTo(vw,B.wl);g.stroke();
    for(i=0;i<14;i++){var q=((i/14+clock*.012)%1),yy=lerp(B.wl,B.top(vw/2)+8,q*q),amp=1+q*q*5,alpha=.12+q*.25;
      g.strokeStyle=rgba([201,230,219],alpha);g.lineWidth=.6+q*q*2.5;g.beginPath();for(k=0;k<=48;k++){var x=k/48*vw,y=yy+sin(x*.019+clock*1.1+i)*amp+windAt(x,clock)*2;if(k===0||hash(i*60+k)>.85)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();}
    g.restore();
  }
  function drawBeach(B,light) {
    var i,k;g.save();g.beginPath();g.moveTo(-vw*4,B.top(-vw*4));for(i=1;i<=90;i++){var coastX=(-4+i/10)*vw;g.lineTo(coastX,B.top(coastX));}g.bezierCurveTo(vw*6,vh*4,-vw*4,vh*5,-vw*4,B.top(-vw*4));g.closePath();
    var gr=g.createLinearGradient(0,B.top(0),0,vh+B.rise);gr.addColorStop(0,rgba(mix([182,151,109],[207,185,140],light)));gr.addColorStop(.3,rgba(mix([206,163,106],[234,214,166],light)));gr.addColorStop(1,rgba(mix([180,134,89],[219,196,148],light)));g.fillStyle=gr;g.fill();g.clip();
    if(materials.sand){g.globalCompositeOperation='soft-light';g.globalAlpha=.28;g.fillStyle=g.createPattern(materials.sand,'repeat');g.fillRect(0,0,vw,vh*2);if(generated.sand&&imageBlend>0){g.globalAlpha=.28*imageBlend;g.fillStyle=g.createPattern(generated.sand,'repeat');g.fillRect(0,0,vw,vh*2);}g.globalAlpha=1;g.globalCompositeOperation='source-over';}
    // Wind ripples grow towards the camera.
    g.strokeStyle='rgba(129,105,74,.11)';g.lineWidth=.8;g.beginPath();for(i=0;i<20;i++){var yy=B.top(0)+30+i*i*.65;for(k=0;k<=40;k++){var x=k/40*vw,y=yy+sin(x*.011+i*.7)*7;if(!k)g.moveTo(x,y);else g.lineTo(x,y);}}g.stroke();g.restore();
    // Wet sand keeps the previous wash; a travelling front breaks into foam.
    var tide=sin(clock*.6)*8;g.strokeStyle='rgba(107,133,127,.32)';g.lineWidth=30;g.beginPath();for(i=0;i<=50;i++){var x2=i/50*vw,y2=B.top(x2)+8+tide+sin(x2*.02+clock*.7)*3;if(!i)g.moveTo(x2,y2);else g.lineTo(x2,y2);}g.stroke();
    for(k=0;k<2;k++){g.strokeStyle=k?'rgba(249,251,229,.75)':'rgba(219,240,222,.36)';g.lineWidth=k?2:9;g.beginPath();for(i=0;i<=70;i++){var x3=i/70*vw,y3=B.top(x3)+tide+sin(x3*.027+clock)*4+(k?-2:0);if(!i)g.moveTo(x3,y3);else g.lineTo(x3,y3);}g.stroke();}
    g.fillStyle='rgba(247,249,230,.6)';g.beginPath();for(i=0;i<110;i++){var fx=hash(i+731)*vw,fy=B.top(fx)+tide+(hash(i+70)-.5)*14;g.moveTo(fx+3,fy);g.ellipse(fx,fy,.6+hash(i)*2,.45+hash(i+2)*1.2,0,0,TAU);}g.fill();
    // Driftwood, shells and a starfish, all on the same ground plane.
    g.strokeStyle='rgba(111,85,58,.7)';g.lineWidth=5*u;g.beginPath();g.moveTo(vw*.64,vh*.93+B.rise);g.quadraticCurveTo(vw*.7,vh*.925+B.rise,vw*.74,vh*.94+B.rise);g.stroke();
    for(i=0;i<9;i++){var sx=hash(i+42)*vw,sy=vh*(.67+hash(i+18)*.28)+B.rise;g.fillStyle='rgba(252,237,196,.8)';g.beginPath();g.ellipse(sx,sy,2+hash(i+5)*3,1.5,hash(i)*PI,0,TAU);g.fill();}
    star5(vw*.57,vh*.85+B.rise,9*u,'#b77451');
  }
  function palmCrown(p,B){var near=B.near==null?1:B.near,zoom=lerp(.10,1,near),H=p.h*vh*zoom,bx=vw*.5+(p.fx-.5)*vw*zoom,by=B.wl+8+(vh*.77-B.wl-8)*near+B.rise,wind=windAt(bx,clock-p.p*.3);return{x:bx+p.lean*H*.55+wind*H*.025,y:by-H,bx:bx,by:by,H:H,cr:H*.023};}
  function drawPalm(p,B,light,shadow) {
    var C=palmCrown(p,B),H=C.H,bx=C.bx,by=C.by,tx=C.x,ty=C.y,cx=bx+p.lean*H*.05,cy=by-H*.55,i;
    if(by-H>vh+100)return C;
    if(shadow){
      var len=H*(1.15-lightSource.height*.8),dx=(bx-lightSource.x*vw)/vw*len,dy=len*.32;
      g.save();g.translate(bx,by);g.transform(1,0,-dx/H,-dy/H,0,0);g.translate(-bx,-by);
      g.strokeStyle='rgba(51,61,46,.14)';g.lineWidth=H*.055;g.beginPath();g.moveTo(bx,by);g.quadraticCurveTo(cx,cy,tx,ty);g.stroke();
      for(i=0;i<17;i++){g.save();g.translate(tx,ty);g.rotate(windAt(bx,clock-i*.05)*.025);g.globalAlpha=.14;g.drawImage(frondShadows[i],-H*.55,-H*.322,H*1.1,H*.825);g.restore();}g.restore();return C;
    }
    var gr=g.createLinearGradient(bx-H*.05,0,bx+H*.035,0);gr.addColorStop(0,rgba(mix([165,130,77],[193,168,115],light)));gr.addColorStop(.4,'#927549');gr.addColorStop(1,'#4b4a32');
    g.fillStyle=gr;g.beginPath();g.moveTo(bx-H*.047,by);g.quadraticCurveTo(cx-H*.029,cy,tx-H*.012,ty);g.lineTo(tx+H*.012,ty);g.quadraticCurveTo(cx+H*.026,cy,bx+H*.047,by);g.closePath();g.fill();
    g.save();g.clip();detailLayer('bark',bx-H*.12,ty,H*.3,H,.26);
    g.strokeStyle='rgba(41,46,32,.34)';g.lineWidth=1.3*u;g.beginPath();for(i=0;i<42;i++){var t=i/42,m=1-t,x=m*m*bx+2*m*t*cx+t*t*tx,y=m*m*by+2*m*t*cy+t*t*ty,ww=H*lerp(.047,.013,t);g.moveTo(x-ww,y);g.quadraticCurveTo(x,y+3*u,x+ww,y-1);}g.stroke();
    gr=g.createLinearGradient(0,ty,0,ty+H*.22);gr.addColorStop(0,'rgba(16,39,30,.6)');gr.addColorStop(1,'rgba(16,39,30,0)');g.fillStyle=gr;g.fillRect(tx-H*.1,ty,H*.2,H*.3);g.restore();
    if(fronds.length===17){for(var layer=0;layer<3;layer++)for(i=0;i<17;i++){if(i%3!==layer)continue;var wind=windAt(bx,clock-p.p*.3-i*.035);
      g.save();g.translate(tx,ty);g.rotate(wind*.025+(hash(i+31)-.5)*.08);g.globalAlpha=materialFade;for(var strip=0;strip<4;strip++){var distance=abs(strip-1.5)/1.5,delay=clock-p.p*.3-i*.045-distance*.13,shift=windAt(bx,delay)*H*.018*distance+sin(delay*3.4-i)*H*.0015*distance;g.drawImage(fronds[i],strip*128,0,128,384,-H*.47+strip*H*.235,-H*.275+shift,H*.235+.3,H*.705);}g.restore();}
    } if(materialFade<1) {g.globalAlpha=1-materialFade;g.strokeStyle='#4a7951';g.lineWidth=H*.025;g.beginPath();for(i=0;i<12;i++){var ang2=i*TAU/12;g.moveTo(tx,ty);g.quadraticCurveTo(tx+cos(ang2)*H*.25,ty+sin(ang2)*H*.25,tx+cos(ang2)*H*.42,ty+sin(ang2)*H*.3);}g.stroke();g.globalAlpha=1;}
    g.strokeStyle='#a6b46d';g.lineWidth=H*.009;g.beginPath();g.moveTo(tx,ty);g.quadraticCurveTo(tx+H*.02,ty-H*.1,tx-H*.015,ty-H*.18);g.stroke();
    for(i=0;i<max(0,p.n-p.dropped);i++){var nx=tx+(i-1.5)*C.cr*1.4,ny=ty+C.cr*(1.1+i%2*.6);gr=g.createRadialGradient(nx-C.cr*.3,ny-C.cr*.4,1,nx,ny,C.cr);gr.addColorStop(0,'#9d9b54');gr.addColorStop(1,'#434b2c');g.fillStyle=gr;g.beginPath();g.ellipse(nx,ny,C.cr,C.cr*1.15,.2,0,TAU);g.fill();}return C;
  }
  function groundShadow(x,y,len,opacity) {
    var dx=(x-lightSource.x*vw)/vw*len*(1.6-lightSource.height),dy=len*(.25-lightSource.height*.16);
    g.fillStyle=rgba([39,55,49],opacity*.6);g.beginPath();g.ellipse(x+dx*.45,y+dy*.45,len*.58+abs(dx)*.22,len*.045+dy*.2,atan2(dy,dx)*.12,0,TAU);g.fill();g.fillStyle=rgba([29,45,37],opacity);g.beginPath();g.ellipse(x,y+len*.09,len*.46,len*.055,0,0,TAU);g.fill();
  }
  function idleBeat(c,a,b){return c>a&&c<b?sin(PI*(c-a)/(b-a)):0;}
  function actorLength(i){return i===0?(mob?136:238):mob?[0,37,30,40,32,35][i]:lerp(36,65,spots[i].age)*1.5;}
  function boardRest(i){var L=actorLength(i);return{x:spots[i].fx*vw,y:vh*(.685+(i%2)*.006),L:L,dir:PI-.42+(hash(i+6)-.5)*.13};}
  function act4(t4,t5,y,sky,wat){
    var action=cur.t[4],B=beachGeom(action),light=.55+.45*ss(.2,.9,action),i,c=clock;updateLight(action);
    if(t5===0){drawClouds(B,1);var sun=drawSun(B,action);sunTrail(sun,B,ss(.1,.4,action));}
    // At first the shoreline is a thin strip at the horizon, not a full beach collage.
    if(B.near<1){g.save();g.beginPath();g.rect(0,B.wl,vw,vh*.10);g.clip();g.fillStyle='#99886a';g.beginPath();g.moveTo(0,B.wl+5);g.quadraticCurveTo(vw*.5,B.wl-3,vw,B.wl+7);g.lineTo(vw,B.wl+12);g.lineTo(0,B.wl+10);g.fill();g.restore();}
    if(B.near>.001){g.save();g.globalAlpha=B.near;drawBeach(B,light);g.restore();}
    surfWave(B,action);
    // Sea and foam are complete before the trees, so they cannot cross a trunk.
    if(fronds.length===17&&B.near>.05)for(i=0;i<palms.length;i++)drawPalm(palms[i],B,light,true);
    for(i=0;i<palms.length;i++)drawPalm(palms[i],B,light,false);
    var surfaceY=vh*ss(0,.24,t4);
    if(surfaceY<vh){g.save();g.beginPath();g.rect(0,surfaceY,vw,vh-surfaceY);g.clip();g.translate(0,surfaceY);background(-vh,sky,waterColors(3));underwater(-vh,2.95,y);g.restore();base();g.strokeStyle='rgba(197,235,230,.6)';g.lineWidth=4;g.beginPath();g.moveTo(0,surfaceY);for(i=1;i<=40;i++)g.lineTo(i*vw/40,surfaceY+sin(i*.7+c)*3);g.stroke();}
    if(action<.10){updateSwarm(1,focal(3,y),0);g.save();base();g.beginPath();g.rect(0,surfaceY,vw,vh-surfaceY);g.clip();cam.y1+=surfaceY;drawSwarm(1-ss(0,.10,action),0);drawSwarm(1-ss(0,.10,action),1);drawSwarm(1-ss(0,.10,action),2);cam.y1-=surfaceY;g.restore();base();}
    var actors=[],enter=ss(0,.24,t4),landing=ss(.40,.70,action),rest=ss(.69,.77,action),unfold=ss(.08,.20,action),swell=sin(PI*ss(.16,.47,action));
    for(i=0;i<spots.length;i++){
      var sp=spots[i],arm=Math.ceil(i/2),side=i%2?-1:1,L=actorLength(i),target=spotPos(sp,B),sx=vw*(.5+side*arm*(mob?.135:.10)),sy=vh*.70-86-arm*vh*.035-vh*.09*swell;
      if(i===0){sx=vw*.5;sy=vh*.70-vh*.13*swell;}
      var old=leaderTarget(1,focal(3,y)),xx=lerp(sx,target.x,landing),yy=lerp(sy,target.y,landing)+(old.y-vh*.70)*(1-enter),dir=PI;
      if(i===0){xx=lerp(old.x,xx,enter);dir=lerp(atan2(leader.vy,leader.vx),PI,enter);L=lerp(heroLb(1),L,enter);}
      actors.push({i:i,sp:sp,x:xx,y:yy,L:L,dir:dir});
    }
    actors.sort(function(a,b){return a.y-b.y;});
    // Keep the swimming lanes distinct; the landing targets form one shallow row.
    for(var lane=0;lane<actors.length;lane++){var a=actors[lane],side=cos(a.dir)<0?-1:1;a.cx=a.x+sin(a.dir)*side*a.L*.1;a.dy=-cos(a.dir)*side*a.L*.1;a.w=a.L*(abs(cos(a.dir))*1.18+abs(sin(a.dir))*.77);a.h=a.L*(abs(sin(a.dir))*1.18+abs(cos(a.dir))*.77);for(var j=0;j<lane;j++){var prev=actors[j],gap=abs(a.cx-prev.cx)-(a.w+prev.w)/2,need=prev.y+prev.dy+(a.h+prev.h)/2+3-a.dy;a.y+=max(0,need-a.y)*(1-ss(0,4,gap));}}
    for(i=0;i<actors.length;i++){
      a=actors[i];sp=a.sp;var R=boardRest(a.i),pose=lerp(.12,.8,rest),tilt=-pose,bob=sin(c*TAU/3.6+sp.w)*.6,yy=a.y+bob*(1-landing);
      var cp;spine(sp.age,c*3+sp.ph,.12,0,tilt);cp=screenPoint(a.x,yy,a.dir,a.L,chipLocal());
      var transfer=ss(.08,.20,action),move=ss(.12,.22,action),shore=ss(.40,.52,action);
      var bx=lerp(cp.x,a.x,move),by=lerp(cp.y,yy+a.L*.15,move);bx=lerp(bx,R.x,shore);by=lerp(by,R.y,shore);var bd=lerp(a.dir,R.dir,shore),power=ss(.18,.30,action)*(1-ss(.55,.70,action)),core=a.i===0?pulse(c):power*.45;
      if(action>=.08){
        if(shore>0){groundShadow(bx,by,a.L*.8,.22*shore);dragTrack(bx+a.L*.18,by-a.L*.04,bx,by,a.L,.45*shore);}
        g.save();if(shore>0){g.beginPath();g.rect(-vw*2,-vh*2,vw*5,by+vh*2+a.L*.06+a.L*.105*(1-shore));g.clip();}
        drawBoard(bx,by,a.L,bd,power,.16,unfold,core);g.restore();base();
        if(shore>.05){g.strokeStyle=rgba([194,167,118],shore*.8);g.lineWidth=max(3,a.L*.045);g.beginPath();g.ellipse(bx-a.L*.18,by+a.L*.06,a.L*.13,a.L*.028,-.1,0,PI);g.stroke();}
        boardStates.push({id:a.i,x:bx,y:by,size:a.L*.08,brightness:core,expanded:unfold>=1});
      }
      var crawl=(1-rest)*landing*sin(c*3.2+sp.ph),neckBeat=.035*sin(c*1.1+sp.w),idle=(c+sp.w*3)%19;
      groundShadow(a.x,yy+a.L*.1,a.L,.23*landing);
      if(landing>.4)dragTrack(R.x,R.y+a.L*.02,a.x,yy+a.L*.10,a.L,.32*rest);
      var surfClip=a.i!==0&&action<.10;if(surfClip){g.save();g.beginPath();g.rect(0,B.wl,vw,vh);g.clip();}
      var cs=seal(a.x,yy-crawl*2,a.dir,a.L,{a:sp.age,ph:c*3+sp.ph,amp:rest?.03:.18,bend:crawl*.08,tilt:tilt-neckBeat*rest,tone:a.i%3,lod:a.i===0?0:2,ground:landing>.4,wet:1-rest*sat(c/20),depth:(1-enter)*.8,blink:(c+sp.w)%7<.12,lit:6,chip:action<.08,chipAlpha:1,hero:a.i===0,scratch:rest*idleBeat(idle,9,10.3),yawn:rest*idleBeat(idle,14,16)});if(surfClip)g.restore();base();
      var bc=screenPoint(a.x,yy,a.dir,a.L,{x:0,y:-.1}),bodyBox=bounds(bc.x,bc.y,a.L*(abs(cos(a.dir))*1.18+abs(sin(a.dir))*.77),a.L*(abs(sin(a.dir))*1.18+abs(cos(a.dir))*.77));
      if(a.i===0){hero.x=a.x;hero.y=yy;hero.dir=a.dir;hero.length=a.L;hero.land={x:a.x,y:yy};hero.screen=bodyBox;chipState=action>.08?{x:bx,y:by,size:a.L*.08,lit:6,expanded:unfold>=1,brightness:core}:cs;}
      sealBoxes.push(bodyBox);
    }
    for(i=0;i<crabs.length&&action>.5&&t5===0;i++){var cx=(.08+i*.52)*vw+sin(c*.6+i)*20,cy=vh*(.91+i*.04);crab(cx,cy,6*u,light,ss(.5,.65,action),c+i);}
    for(i=0;i<birds.length&&t5===0;i++){var bird=birds[i],birdX=((bird.x+c*.012+windAt(i*100,c)*.003)%1.2-.1)*vw;drawGull(birdX,vh*(.12+i*.055),5+bird.s*3,c*3.5+bird.p);}
    // Click-triggered fruit has a bounded ballistic path, two bounces, dust, then a roll.
    for(i=0;i<nuts.length;i++){var n=nuts[i],C=palmCrown(palms[n.palm],B),e=c-n.t,fall=sqrt(2*(C.by-C.y)/800),tt=e-fall,nx=C.x,ny;
      if(tt<0)ny=C.y+400*e*e;else{var bounce=tt<.7?sin(tt/.7*PI)*28:tt<1.12?sin((tt-.7)/.42*PI)*9:0;ny=C.by-bounce;nx+=min(2.5,tt)*19/(1+tt*.2);if(tt<.25){g.fillStyle=rgba([218,197,150],.35*(1-tt/.25));g.beginPath();for(var dustI=0;dustI<10;dustI++)g.ellipse(nx+(hash(dustI)-.5)*tt*100,ny-hash(dustI+2)*tt*60,2,1,0,0,TAU);g.fill();}}
      groundShadow(nx,ny,C.cr*2,.18);g.fillStyle='#62613b';g.beginPath();g.arc(nx,ny,C.cr,0,TAU);g.fill();}
    return B;
  }
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
  var emptyGlobe={dots:[],colors:[],projected:[],n:0,pts:[],O:[cos(O_LAT*DEG)*cos(O_LON*DEG),cos(O_LAT*DEG)*sin(O_LON*DEG),sin(O_LAT*DEG)]};
  var globeWork = null;
  function buildGlobe() { return G; }
  // Abstract flag-derived hues, shuffled per dot; the grid contains continent IDs only.
  var continentColors=[[],['#559b79','#b4a45e','#b76c65','#58666c'],['#5c997e','#c1b76e','#668eb0','#d0ddd3'],['#648daa','#d2dfde','#b56e71','#8a9d80'],['#6a8fae','#d1dfe0','#ad727a','#b0a377'],['#b8797c','#bcaa70','#d0dcd7','#60977d','#6c94b0'],['#618ca8','#ccdcd9','#ac7779','#729889'],['#c9e1e6']];
  var dotPalette=[];for(var cpId=1;cpId<8;cpId++)for(var cpTone=0;cpTone<continentColors[cpId].length;cpTone++)dotPalette.push(continentColors[cpId][cpTone]);
  function globeSlice() {
    if(G)return true;
    if(!globeWork)globeWork={bits:atob(LAND),grid:new Uint8Array(64800),decoded:0,offset:0,phase:0,row:0,cells:[],sum:0,r:rng(5),dl:[],ids:[],keys:[],cv:[],pick:[],best:0,pts:[]};
    var w=globeWork,i,j,end;
    function land(i,j){i=(i+360)%360;return j<0||j>179?0:w.grid[j*360+i];}
    function vec(la,lo){la*=DEG;lo*=DEG;return [cos(la)*cos(lo),cos(la)*sin(lo),sin(la)];}
    function dot(p,q){return p[0]*q[0]+p[1]*q[1]+p[2]*q[2];}
    function addCell(k){w.dl.push(89.5-floor(k/360)+(hash(k+6)-.5)*.5,-179.5+k%360+(hash(k+8)-.5)*.5);w.ids.push(w.grid[k]);w.keys.push(k);w.chosen[k]=1;}
    if(w.phase===0){end=min(w.bits.length,w.offset+250);for(i=w.offset;i<end;i++){var code=w.bits.charCodeAt(i),len=(code>>3)+1;w.grid.fill(code&7,w.decoded,w.decoded+len);w.decoded+=len;}w.offset=end;if(end<w.bits.length)return false;w.phase=1;return false;}
    if(w.phase===1){end=min(180,w.row+3);for(j=w.row;j<end;j++)for(i=0;i<360;i++)if(land(i,j)){w.cells.push(j*360+i);w.sum+=cos((89.5-j)*DEG);}w.row=end;if(end<180)return false;w.row=0;w.phase=2;w.O=vec(O_LAT,O_LON);w.chosen=new Uint8Array(64800);return false;}
    if(w.phase===2){var f=1710/w.sum;end=min(w.cells.length,w.row+240);for(i=w.row;i<end;i++){var key=w.cells[i];if(hash(key+53)<f*cos((89.5-floor(key/360))*DEG))addCell(key);}w.row=end;if(end<w.cells.length)return false;w.row=0;w.phase=3;w.visited=new Uint8Array(64800);w.queue=new Uint32Array(64800);w.head=w.tail=0;w.scan=0;w.any=false;return false;}
    if(w.phase===3){
      // Preserve all connected islands with the same rule, including disputed regions.
      var budget=450;
      while(budget-->0){
        if(w.head===w.tail){if(w.tail&&!w.any)addCell(w.representative);w.head=w.tail=0;w.any=false;
          while(w.scan<64800&&(!w.grid[w.scan]||w.visited[w.scan])){w.scan++;if(--budget<0)return false;}
          if(w.scan>=64800){w.phase=4;w.row=0;return false;}w.queue[w.tail++]=w.scan;w.visited[w.scan]=1;w.representative=w.scan;
        }
        var k0=w.queue[w.head++];if(w.chosen[k0])w.any=true;if(hash(k0)<hash(w.representative))w.representative=k0;
        for(var nn=0;nn<4;nn++){var next=k0+(nn===0?1:nn===1?-1:nn===2?360:-360);if(next<0||next>=64800||abs(next%360-k0%360)>1||!w.grid[next]||w.visited[next])continue;w.visited[next]=1;w.queue[w.tail++]=next;}
      }return false;
    }
    if(w.phase===4){
      w.dots=new Float32Array(w.ids.length*3);w.colors=new Uint8Array(w.ids.length);
      for(i=0;i<w.ids.length;i++){var v=vec(w.dl[i*2],w.dl[i*2+1]),id=w.ids[i],off=0;for(j=1;j<id;j++)off+=continentColors[j].length;w.dots[i*3]=v[0];w.dots[i*3+1]=v[1];w.dots[i*3+2]=v[2];w.colors[i]=off+floor(hash(w.keys[i]+73)*continentColors[id].length);}
      var interiors=[[5,21],[-15,-59],[47,-106],[53,25],[44,91],[-25,135],[-80,35]];
      w.pts=interiors.map(function(p){var v=vec(p[0],p[1]);return{v:v,d:Math.acos(clamp(dot(v,w.O),-1,1))};}).sort(function(p,q){return p.d-q.d;});
      for(i=0;i<w.pts.length;i++){var p=w.pts[i];p.tl=.49+.35*i/(w.pts.length-1);p.lt=null;p.par=i?w.pts[i-1].v:w.O;p.hop=Math.acos(clamp(dot(p.par,p.v),-1,1));}
      G={dots:w.dots,colors:w.colors,projected:new Float32Array(w.ids.length*3),n:w.ids.length,pts:w.pts,O:w.O,mob:mob};globeWork=null;return true;
    }
  }
  function view(t5) {
    var e = ss(.48, 1, t5), pre = 0;
    return { lon: (O_LON + 170 * e - 40 * pre) * DEG + spin, lat: (O_LAT + 30 * e) * DEG };
  }
  function proj(v, V, C, R, out) {
    var cl = cos(V.lon), sl = sin(V.lon), x1 = v[0] * cl + v[1] * sl, y1 = -v[0] * sl + v[1] * cl, z1 = v[2];
    var cp = cos(V.lat), sp = sin(V.lat), d = x1 * cp + z1 * sp, up = -x1 * sp + z1 * cp;
    var X = y1 * R, Y = -up * R, ct = cos(TILT), st = sin(TILT);
    out[0] = C.x + X * ct - Y * st; out[1] = C.y + X * st + Y * ct; out[2] = d; return out;
  }
  var planetFrame = null;
  function act5(t5, F) {
    var gl = buildGlobe()||emptyGlobe;
    var z = ss(0,.46,t5), finalR=(mob?.43:.36)*min(vw,vh), R=Math.exp(lerp(Math.log(vh*8),Math.log(finalR),z)), C={x:vw/2,y:lerp(vh*.38,F.y-finalR,z)+R}, al=1,V=view(t5),i,o=[0,0,0],c=clock; planetFrame={x:C.x,y:C.y,r:R,z:z};
    // space stars
    g.fillStyle = '#dfe9ff';
    for (i = 0; i < stars.length; i++) { var s = stars[i]; g.globalAlpha = z*z * (.3 + .35 * (.5 + .5 * sin(c * 1.3 + s.p))); g.fillRect(s.x * vw, (s.y * 1.7 % 1) * vh, s.s * u, s.s * u);if(i%3===0){g.globalAlpha=z*z*.16;g.fillRect(((s.x+.37+spin*.04)%1)*vw,((s.y*2.3+.16)%1)*vh,1.8*u,1.8*u);} }
    g.globalAlpha = 1;
    // atmosphere and ocean
    var gr = g.createRadialGradient(C.x, C.y, R * .96, C.x, C.y, R * 1.08);
    gr.addColorStop(0, rgba([92, 200, 255], .55 * al)); gr.addColorStop(1, 'rgba(92,200,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(C.x, C.y, R * 1.08, 0, TAU); g.fill();
    gr = g.createLinearGradient(0,C.y-R,0,C.y-R+vh*.23*(1-z)+R*2*z);
    gr.addColorStop(0,rgba(mix([35,89,109],[8,35,57],z)));gr.addColorStop(.5,rgba(mix([51,127,137],[15,77,112],z)));gr.addColorStop(1,rgba(mix([120,182,164],[4,24,44],z)));
    g.fillStyle = gr; g.beginPath(); g.arc(C.x, C.y, R, 0, TAU); g.fill();
    g.save();g.beginPath();g.arc(C.x,C.y,R,0,TAU);g.clip();
    var shade=g.createLinearGradient(C.x-R,C.y-R*.2,C.x+R,C.y+R*.4);shade.addColorStop(0,'rgba(0,9,21,0)');shade.addColorStop(.48,'rgba(0,9,21,.02)');shade.addColorStop(1,rgba([0,5,13],.68*z));g.fillStyle=shade;g.fillRect(C.x-R,C.y-R,R*2,R*2);
    if(z>.4)blob(glow([255,242,205]),C.x-R*.35,C.y-R*.35,R*.19,.19*z);g.restore();
    // Project once, then batch by abstract hue and depth. No per-dot gradients.
    var D3=gl.dots,du=R/(.36*min(vw,vh)),screen=gl.projected,v3=[0,0,0];
    for(i=0;i<gl.n;i++){v3[0]=D3[i*3];v3[1]=D3[i*3+1];v3[2]=D3[i*3+2];proj(v3,V,C,R,o);screen[i*3]=o[0];screen[i*3+1]=o[1];screen[i*3+2]=o[2];}
    g.save();g.beginPath();g.arc(C.x,C.y,R,0,TAU);g.clip();
    for(var col=0;col<dotPalette.length;col++)for(var bkt=0;bkt<3;bkt++){
      g.fillStyle=dotPalette[col];g.globalAlpha=(.35+bkt*.27)*ss(.18,.46,t5)*materialFade;g.beginPath();var rr=min(2.6,(1.65+.50*bkt)*u*min(du,1.5)*(mob?1:1.12));
      for(i=0;i<gl.n;i++){var dep=screen[i*3+2];if(gl.colors[i]!==col||dep<=0||min(2,floor(dep*3))!==bkt)continue;g.rect(screen[i*3]-rr,screen[i*3+1]-rr,rr*2,rr*2);}g.fill();
    }g.restore();g.globalAlpha=1;
    // arcs, lit points, origin
    var lit = 0, flash = sin(PI * sat((t5 - .9) / .1)), snap = snapOnce || staticMode(), P = gl.pts, a = [0, 0, 0], b = [0, 0, 0];
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = ARC; g.lineWidth = 1.1 * u;
    for (i = 0; i < P.length; i++) {
      var p = P[i];
      if (t5 >= p.tl && t5 > 0) { lit++; if (p.lt == null) p.lt = snap ? -99 : clock; } else { p.lt = null; continue; }
      var pr=ss(p.tl,p.tl+.09,t5);
      g.globalAlpha=al*(pr<1?.60:.30);g.lineWidth=(1.25-.6*ss(p.tl+.1,1,t5))*u;g.beginPath();
      var segs=32,started=false,hop=p.hop;
      for (var k = 0; k <= segs * pr; k++) {
        var tt = k / segs, w = slerp(p.par, p.v, tt), lift=1+clamp(hop*.10,.10,.20)*sin(PI*tt);
        proj([w[0] * lift, w[1] * lift, w[2] * lift], V, C, R, a);
        if (a[2] > .05) { if (started) g.lineTo(a[0], a[1]); else { g.moveTo(a[0], a[1]); started = true; } } else started = false;
      }
      g.stroke();
    }
    g.globalAlpha = 1;
    var tw = floor(c), twI = floor(hash(tw * 13 + 7) * max(1, lit)), twE = c - tw;
    for (i = 0; i < P.length; i++) {
      p = P[i]; if (p.lt == null) continue; proj(p.v, V, C, R, b); if (b[2] <= 0) continue;
      var e=(t5-p.tl)/.09,pulse=e<1?sin(PI*e):0, extra = (i === twI && !staticMode() && t5 >= .9) ? (1 - twE) : 0;
      var sz = (2.4 + 2.5 * flash + 2 * extra) * u * (.6 + .4 * b[2]);
      blob(glow(LIT), b[0], b[1], sz * 3.6, al * (.7 + .3 * flash + .4 * extra) * (.5 + .5 * b[2]));
      g.fillStyle = rgba(LIT, al * (.6 + .4 * b[2])); g.beginPath(); g.arc(b[0], b[1], sz * .55, 0, TAU); g.fill();
      if (pulse > 0) { g.strokeStyle = rgba(LIT, pulse * al); g.lineWidth = 1.4 * u; g.beginPath(); g.arc(b[0], b[1], (3 + (1 - pulse) * 16) * u, 0, TAU); g.stroke(); }
    }
    proj(gl.O, V, C, R, b);
    if (b[2] > 0 && t5>=.48) { blob(glow(AI), b[0], b[1], 16 * u, al); g.fillStyle = rgba(AI, al); g.beginPath(); g.arc(b[0], b[1], 2.6 * u, 0, TAU); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    stat.litPoints = lit;
    planetFrame.origin=proj(gl.O,V,C,R,[0,0,0]);return planetFrame.origin;
  }
  function slerp(p, q, t) {
    var d = clamp(p[0] * q[0] + p[1] * q[1] + p[2] * q[2], -1, 1), om = Math.acos(d);
    if (om < 1e-4) return q;
    var s = sin(om), a = sin((1 - t) * om) / s, b = sin(t * om) / s;
    return [p[0] * a + q[0] * b, p[1] * a + q[1] * b, p[2] * a + q[2] * b];
  }

  function liftCoast(z,t5,ox,oy,k5){
    var P=boardRest(0),down=ss(0,.22,t5),points=[[-4,1.0],[-2.7,.78],[-1.8,.56],[-.8,.65],[0,.61],[.25,.632],[.55,.616],[1,.585],[1.7,.50],[2.15,.67],[2.5,1.02],[2.35,1.38],[2.95,1.85],[2.08,2.3],[1.3,2.1],[.8,2.5],[.1,2.2],[-.6,2.5],[-1.4,2.22],[-2,2.65],[-3.6,1.7]],i;
    // Low-altitude water and sky detail vanish through distance, while the same
    // land plane and board keep their camera transform and attachment point.
    g.save();g.beginPath();g.arc(planetFrame.x,planetFrame.y,planetFrame.r,0,TAU);g.clip();
    g.translate(ox,oy);g.scale(k5,k5*lerp(1,.72,down));g.translate(-P.x,-P.y);
    g.beginPath();g.moveTo(points[0][0]*vw,points[0][1]*vh);for(i=1;i<=points.length;i++){var prev=points[(i-1)%points.length],q=points[i%points.length];g.quadraticCurveTo(prev[0]*vw,prev[1]*vh,(prev[0]+q[0])*.5*vw,(prev[1]+q[1])*.5*vh);}g.closePath();
    g.fillStyle=rgba(mix([219,196,148],[76,119,103],down),down);g.fill();g.strokeStyle=rgba([138,197,190],.55*down);g.lineWidth=max(10,7*down/max(.002,k5));g.stroke();g.strokeStyle=rgba([210,195,150],down);g.lineWidth=max(5,3.2*down/max(.002,k5));g.stroke();g.restore();
    if(k5>.025&&down<1&&liftCanvas){
      var main=g;g=liftCanvas.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,liftCanvas.width,liftCanvas.height);camReset();base();drawClouds(beachGeom(1),1);drawSun(beachGeom(1),1);g.save();g.beginPath();g.arc(planetFrame.x,planetFrame.y,planetFrame.r,0,TAU);g.clip();drawOcean(beachGeom(1),1);
      cam.k=k5;cam.x0=P.x;cam.y0=P.y;cam.x1=ox;cam.y1=oy;base();act4(1,t5,smoothY||0,skyColors(1),waterColors(4));g.restore();g=main;camReset();base();g.save();g.globalAlpha=1-down;g.drawImage(liftCanvas,0,0,cv.width,cv.height,0,0,vw,vh);g.restore();
    }

  }
  /* ---------- render ---------- */
  function render() {
    if(!booted)return;
    var t0 = performance.now();
    clock = reduced ? 3 : now(); dt = clamp(clock - lastClock, 0, 1 / 30); lastClock = clock; if (materialReady) materialFade = staticMode() ? 1 : min(1, materialFade + dt * 2.2);
    if(texMode==='img')imageBlend=staticMode()?1:min(1,imageBlend+dt*1.5);
    labelBoxes=[];ringBoxes=[];sealBoxes=[];hero.length=0;chipState=null;boardStates=[];netSegments=0;firstPoint=null;
    var y = sceneY(), P = progress(y);
    if (reduced && !seekTo) { // one still per act, at t = 0.8
      for (var k = 1; k <= 5; k++) P.t[k] = k < P.A ? 1 : k === P.A ? .8 : 0;
      P.s = P.A - 1 + .8; P.sc = P.s;
    }
    cur=P;var t=P.t,t1=t[1],t2=worldPhase(2,y,t[2]),t3=worldPhase(3,y,t[3]),t4=worldPhase(4,y,t[4]),t5=worldPhase(5,y,t[5]);P.sc=t1+t2+t3+t4+t5;updateLight(t4);lightSource.depth=ss(.3,.9,P.sc)*(1-ss(3.05,3.55,P.sc));
    // globe: slow ambient spin after the full reveal, drag inertia, and a return to the start when scrolled back
    if (!staticMode() && !drag && t5 >= .9) spin += dt * TAU / 90;
    if (!drag && dragV) { spin += dragV * dt; dragV *= Math.exp(-dt * 2.2); if (abs(dragV) < .01) dragV = 0; }
    if (t5 < .3 && !drag) spin *= .9;
    camReset(); base();
    g.clearRect(0, 0, vw, vh);
    updateAge(t[2], t[3]);
    // hero position: act-1 pose, then the ring path, then the swarm leader, then the beach
    var F2 = focal(2, y), F3 = focal(3, y), F5 = focal(5, y), p1 = act1Pos(t1, y, ringPath(0, F2).x);
    var hx = p1.x, hy = p1.y, hd = p1.dir;
    if (t2 > 0) { var q = ringPath(t2, F2), bl = ss(0, .14, t2);hx = lerp(hx, q.x, bl); hy = lerp(hy, q.y, bl); hd = bl < 1 ? lerp(hd, pathDir(t2, F2), bl) : pathDir(min(t2, .995), F2); }
    hero.x = hx; hero.y = hy; hero.dir = hd;
    var swarmOn = t3 > 0 || boids.some(function (b) { return b.live; });
    if (swarmOn && t4 < .35) { updateSwarm(t3, F3, dt); if (t3 > 0) { hero.x = leader.x; hero.y = leader.y; hero.dir = atan2(leader.vy, leader.vx); } }
    stat.seals = t4 > 0 ? 3 + spots.length : countSeals();
    // One continuous camera: a huge curved ocean becomes a globe as altitude increases.
    var z=ss(0,.46,t5),wl=t4>0?beachGeom(t4).wl:p1.wl,sky=skyColors(t4),wat=waterColors(P.sc);
    if(t5>0){
      var atmo=g.createLinearGradient(0,-vh*.52*(1-z),0,lerp(vh*.38,vh,z));atmo.addColorStop(0,rgba(mix(sky[0],SPACE,z)));atmo.addColorStop(1,rgba(mix(sky[1],SPACE,z)));g.fillStyle=atmo;g.fillRect(0,0,vw,vh);
      act5(t5,F5);
      var landPoint=boardRest(0),k5=pow(.002,z),attach=ss(.40,.48,t5),ox=lerp(landPoint.x,lerp(F5.x,planetFrame.origin[0],attach),ss(.04,.46,t5)),oy=lerp(landPoint.y,lerp(F5.y,planetFrame.origin[1],attach),ss(.04,.46,t5));
      liftCoast(z,t5,ox,oy,k5);firstPoint={x:ox,y:oy};boardStates=[{id:0,x:ox,y:oy,size:actorLength(0)*.08*k5,brightness:pulse(clock),expanded:true}];chipState={x:ox,y:oy,size:actorLength(0)*.08*k5,lit:6,expanded:true};hero.screen={x:ox,y:oy+k5*(spots[0].fy*vh-landPoint.y-actorLength(0)*.1),w:actorLength(0)*1.18*k5,h:actorLength(0)*.77*k5};
      if(z>.05){g.save();g.globalCompositeOperation='screen';blob(glow(AI),ox,oy,10*z,.8*z);g.fillStyle=rgba(AI,z);g.beginPath();g.arc(ox,oy,2.1*z,0,TAU);g.fill();g.restore();}

    } else {
      hero.screen=null; background(wl,sky,wat);if(t4>0)drawOcean(beachGeom(t4),t4);drawStars(wl,1-ss(.2,.55,t4),y);
      if(t4===0)nightSurface(wl,t1);
      if(t4===0)drawShafts(ss(.7,1.8,P.sc)*(1-ss(3,3.4,P.sc)));
      if(t4===0){underwater(wl,P.sc,y);drawDust(wl,1,y);}
      var ja=ss(1.4,2.2,P.sc)*(1-ss(3,3.3,P.sc));if(t4===0){drawJellies(ja,y);drawTurtle(ja);}
      if(t1>.35&&t4===0){var radius=lerp(vw*.4,vw*.11,ss(.35,1,t1));blob(glow([127,221,226]),vw*.54,20,radius,.22);}
      var sw=1-ss(0,.28,t4);if(swarmOn&&t4===0){drawSwarm(sw,0);drawSwarm(sw,1);}
      act2(t[2],t3,F2);drawBubbles(wl);
      if(t4>0){act4(t4,0,y,sky,wat);}
      else{
        var Lb=heroLb(hero.age),tilt=0;if(ptr)tilt=clamp(atan2(ptr.y-hero.y,abs(ptr.x-hero.x)),-20*DEG,20*DEG);
        var stroke=.4+.6*pow(max(0,sin(clock*.8)),2);if(t2===0)tilt-=.8*(1-ss(.02,.35,t1))*(.94+.06*sin(clock*TAU/3.6-.3));seal(hero.x,hero.y,hero.dir,Lb,{a:hero.age,ph:clock*(3+stroke*2),amp:p1.d>0||t2>0?stroke:.15,tilt:tilt,lod:0,blink:clock%5<.12,wet:1,hero:true,lit:hero.n});base();
        if(t2===0&&p1.d<.4)submerge(hero.x,p1.wl,Lb,wat);emitBubbles(hero.x,hero.y,hero.dir,Lb,p1.d>.02&&t3===0?7:0);
      }
      if(swarmOn&&t4===0)drawSwarm(sw,2);base();if(t4===0){ringEnergy(t[2],F2);drawNetwork(t[3]);}drawLabels(t2,t3);if(t4===0){surface(p1.wl,wat);drawRipples(p1.wl,y);}
    }
    if(P.A===5&&!firstPoint&&boardStates.length){for(var bi=0;bi<boardStates.length;bi++)if(boardStates[bi].id===0)firstPoint={x:boardStates[bi].x,y:boardStates[bi].y};}
    // bookkeeping
    snapOnce = false; prevT4 = t4;
    var ms = performance.now() - t0; work.push(ms); if (work.length > 180) work.shift();
    if (++frames % 30 === 0) { var srt = work.slice().sort(function (a, b) { return a - b; }); workAvg = srt.reduce(function (a, b) { return a + b; }, 0) / srt.length; workP95 = srt[floor(srt.length * .95)] || 0; }
    if (!staticMode() && !seekTo) { qWin.push(ms); if (qWin.length >= 90) { var s2 = qWin.sort(function (a, b) { return a - b; }); if (s2[floor(90 * .95)] > 14 && quality > 0) setQuality(quality - 1); qWin = []; } }
    if (DEBUG) debug();
  }
  function setQuality(q) {
    quality = q; var n = swarmN(); if (n !== NB) setupSwarm();
    if (q <= 2) { cw = 0; measure(); }
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
  function relayout() { if(!booted)return; measure(); kick(); if (!animate()) render(); }

  /* ---------- debug API (used by work/verify-story.cjs) ---------- */
  var dbg = null;
  function debug() {
    if (!dbg) { dbg = D.createElement('div'); dbg.setAttribute('aria-hidden', 'true'); dbg.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:40;font:12px monospace;color:#fff;background:#000a;padding:4px;pointer-events:none'; D.body.appendChild(dbg); }
    dbg.textContent = 'act ' + cur.A + ' t ' + cur.t[cur.A].toFixed(2) + ' seals ' + stat.seals + ' Q' + quality + ' ' + workAvg.toFixed(1) + '/' + workP95.toFixed(1) + 'ms';
  }
  W.SEAL_STORY = {
    state: function () {
      return { on: HTML.classList.contains('has-story'), act: cur.A, t: +cur.t[cur.A].toFixed(4), s: +cur.s.toFixed(4), seals: stat.seals, age: +hero.age.toFixed(3), rings: hero.n,
        ready: materialReady && !imagePending, tex: texMode, px: pixelCount(), sliceMax: +sliceMax.toFixed(2), slices: sliceCount, quality: quality, reduced: reduced, paused: paused, workAvg: +workAvg.toFixed(2), workP95: +workP95.toFixed(2),
        landDots: G ? G.n : 0, litPoints: stat.litPoints, M: G ? G.pts.length : 0, N: NB, rafCount: rafCount,
        startMs: +startMs.toFixed(2), chip:chipState,boards:boardStates,net:netSegments,firstPoint:firstPoint,labelBoxes:labelBoxes, ringBoxes:ringBoxes, sealBoxes:sealBoxes, heroBox:heroBounds(), labels: stages[2] ? stages[2].labels.join('|') : '', stage2: stages[2] ? Math.round(stages[2].top) : -1 };
    },
    seek: function (act, t) { seekTo = { act: clamp(act | 0, 1, 5), t: sat(+t) }; snapOnce = true; render(); kick(); },
    release: function () { seekTo = null; kick(); },
    freeze: function (ms) { spin=0; dragV=0; frozen = (+ms || 0) / 1000; snapOnce = true; render(); },
    unfreeze: function () { frozen = null; lastClock = now(); kick(); },
    resetStats: function () { work = []; workAvg = workP95 = 0; frames = 0; },
    _scrollFor: scrollFor,
    _quality: setQuality,
    _seal: function (o) { camReset(); base(); g.clearRect(0, 0, vw, vh); if(!o.transparent){g.fillStyle=o.bg||'#315564';g.fillRect(0,0,vw,vh);} lightSource.depth = o.depth || 0; clock = (o.clock || 3200) / 1000; seal(o.x || vw / 2, o.y || vh / 2, 0, o.length || 260, o); base(); },
    _board:function(o){camReset();base();g.fillStyle='#193a49';g.fillRect(0,0,vw,vh);clock=3.2;drawBoard(vw/2,vh/2,o.length||160,0,o.light==null?1:o.light,0);base();},
    _hero: heroBounds
  };

  /* ---------- start ---------- */
  // The first draw has no document geometry reads or offscreen allocation.
  vw=W.innerWidth;vh=W.innerHeight;mob=vw<720;dpr=min(W.devicePixelRatio||1,2);u=clamp(min(vw,vh)/1080,.6,1.4);
  HTML.classList.add('has-story');
  cv.width=Math.round(vw*dpr);cv.height=Math.round(vh*dpr);camReset();base();
  background(vh*.35,[KF[0][0],KF[0][1],0],[KF[0][2],KF[0][3]]);
  seal(vw*(mob?.5:.25),vh*.28,0,mob?98:130,{a:0,amp:0,wet:0,lod:2,depth:0});base();
  startMs=performance.now()-T0;
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
    if (e.pointerType === 'touch' && !e.buttons && !drag) { ptr = null; return; }
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
      var live = nuts.length; if (live >= 6) return;
      var best = -1, bd = 1e9; for (var i = 0; i < palms.length; i++) { var d = abs(palms[i].fx * vw - e.clientX); if (palms[i].n - palms[i].dropped > 0 && d < bd) { bd = d; best = i; } }
      if (best < 0) return; lastNut = clock; nuts.push({ palm: best, t: clock }); palms[best].dropped++; kick();
    }, { passive: true });
  });
  function finishBoot(){booted=true;measure();sealSprite=makeSprite();render();kick();initMaterials();setTimeout(imageDetails,50);}
  // Two animation turns allow style/layout to settle before the read-only measurement.
  if(/[?&]renderer=1/.test(Q))finishBoot();else requestAnimationFrame(function(){setTimeout(finishBoot,0);});
})();
