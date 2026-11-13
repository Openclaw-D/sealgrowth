/* SEAL Growth · homepage mode switch (Startup / Personal) and language links. Apache-2.0.
   Loaded synchronously in <head> so the mode is set before first paint. Without JavaScript the page shows Startup. */
(function () {
  'use strict';
  var root = document.documentElement, KEY = 'seal-mode-v1';
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function put(m) { try { localStorage.setItem(KEY, m); } catch (e) { } }
  var q = /[?&]mode=(startup|personal)\b/.exec(location.search);
  var mode = q ? q[1] : (location.hash === '#personal' ? 'personal' : (get() === 'personal' ? 'personal' : 'startup'));
  if (q) put(mode);
  root.setAttribute('data-mode', mode);

  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  function sync() {
    var lang = root.getAttribute('lang') === 'zh-CN' ? 'zh' : 'en';
    each('[data-set-mode]', function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-set-mode') === mode)); });
    each('a[data-lang-link]', function (a) { a.href = a.getAttribute('data-lang-link') + (mode === 'personal' ? '?mode=personal' : '') + location.hash; });
    each('a[data-tool]', function (a) { a.href = a.getAttribute('data-tool-base') + '?t=' + (a.getAttribute('data-tool') || mode) + '&lang=' + lang; });
  }
  function set(m, keepUrl) {
    mode = m; root.setAttribute('data-mode', m); put(m); sync();
    if (!keepUrl && window.history && history.replaceState) {
      try { history.replaceState(null, '', location.pathname + (m === 'personal' ? '?mode=personal' : '') + location.hash); } catch (e) { }
    }
  }
  /* A link to a block of the other mode switches the mode first. */
  function followHash(scroll) {
    var id = decodeURIComponent(location.hash.slice(1)); if (!id) { sync(); return; }
    var el = document.getElementById(id); if (!el) { sync(); return; }
    var blk = el.closest('[data-show]');
    if (blk && blk.getAttribute('data-show') !== mode) { set(blk.getAttribute('data-show')); if (scroll) el.scrollIntoView(); }
    else sync();
  }
  document.addEventListener('DOMContentLoaded', function () {
    each('[data-set-mode]', function (b) {
      b.addEventListener('click', function () { var m = b.getAttribute('data-set-mode'); if (m !== mode) set(m); });
    });
    followHash(true);
    window.addEventListener('hashchange', function () { followHash(true); });
  });
})();
