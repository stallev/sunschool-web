/* Тетрадь ученика — поведение сайта. Без зависимостей.
   Правила: отклик сразу, движение — только transform/opacity, всё уважает prefers-reduced-motion. */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function safe(fn) { try { return fn(); } catch (e) { return null; } }

  /* ---------- навигация ---------- */
  var nav = document.querySelector('.nav');
  var toggle = document.querySelector('.nav__toggle');
  var menu = document.getElementById('menu');
  if (nav && toggle && menu) {
    var setOpen = function (open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    };
    toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('is-open')); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    });
    window.matchMedia('(min-width: 900px)').addEventListener('change', function () { setOpen(false); });
    var onScroll = function () { nav.classList.toggle('is-scrolled', window.scrollY > 4); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- появление блоков ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    if (reduce || !('IntersectionObserver' in window)) {
      reveals.forEach(function (el) { el.classList.add('is-in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      reveals.forEach(function (el) { io.observe(el); });
    }
  }

  /* ---------- вкладки «Как устроен урок» ---------- */
  document.querySelectorAll('[data-tabs]').forEach(function (box) {
    var tabs = Array.prototype.slice.call(box.querySelectorAll('[role="tab"]'));
    var panels = Array.prototype.slice.call(box.querySelectorAll('[role="tabpanel"]'));
    var select = function (i, focus) {
      tabs.forEach(function (t, k) {
        t.setAttribute('aria-selected', k === i ? 'true' : 'false');
        t.tabIndex = k === i ? 0 : -1;
      });
      panels.forEach(function (p, k) { p.hidden = k !== i; });
      if (focus) tabs[i].focus();
      if (tabs[i].scrollIntoView && !focus) { /* вкладка видна внутри своей полосы */
        var bar = tabs[i].parentNode;
        bar.scrollTo({ left: tabs[i].offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
      }
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i, false); });
      t.addEventListener('keydown', function (e) {
        var n = tabs.length, k = null;
        if (e.key === 'ArrowRight') k = (i + 1) % n;
        else if (e.key === 'ArrowLeft') k = (i - 1 + n) % n;
        else if (e.key === 'Home') k = 0;
        else if (e.key === 'End') k = n - 1;
        if (k !== null) { e.preventDefault(); select(k, true); }
      });
    });
    select(0, false);
  });

  /* ---------- урок: строка страниц и подсветка текущей ---------- */
  var bar = document.querySelector('.pagebar');
  if (bar) {
    root.classList.add('has-bar');
    var links = Array.prototype.slice.call(bar.querySelectorAll('a[href^="#"]'));
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var current = function (id) {
      links.forEach(function (a) { a.removeAttribute('aria-current'); });
      if (map[id]) {
        map[id].setAttribute('aria-current', 'true');
        var wrap = map[id].parentNode;
        var x = map[id].offsetLeft - wrap.clientWidth / 2 + map[id].offsetWidth / 2;
        wrap.scrollTo({ left: x, behavior: reduce ? 'auto' : 'smooth' });
      }
    };
    if ('IntersectionObserver' in window) {
      var sheets = Array.prototype.slice.call(document.querySelectorAll('.sheet[id]'));
      var visible = {};
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting ? en.intersectionRatio : 0; });
        var best = null, bestV = 0;
        sheets.forEach(function (s) { if ((visible[s.id] || 0) > bestV) { best = s.id; bestV = visible[s.id]; } });
        if (best) current(best);
      }, { rootMargin: '-96px 0px -45% 0px', threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
      sheets.forEach(function (s) { spy.observe(s); });
    }
  }

  /* ---------- сохранение ответов в этом браузере ---------- */
  var fields = document.querySelectorAll('[data-save]');
  var page = document.body.getAttribute('data-lesson');
  if (fields.length && page) {
    var key = function (el) { return 'sunsch:' + page + ':' + el.getAttribute('data-save'); };
    fields.forEach(function (el) {
      var v = safe(function () { return localStorage.getItem(key(el)); });
      if (v) el.value = v;
      el.addEventListener('input', function () {
        safe(function () {
          if (el.value) localStorage.setItem(key(el), el.value); else localStorage.removeItem(key(el));
        });
      });
    });
    var reset = document.querySelector('[data-reset]');
    if (reset) {
      reset.addEventListener('click', function () {
        var filled = Array.prototype.some.call(fields, function (el) { return el.value; });
        if (!filled) return;
        if (!window.confirm('Очистить всё, что вы написали на страницах этого урока?')) return;
        fields.forEach(function (el) { el.value = ''; safe(function () { localStorage.removeItem(key(el)); }); });
      });
    }
  }

  /* ---------- кроссворд ---------- */
  document.querySelectorAll('[data-xw]').forEach(function (grid) {
    var cells = {};
    var words = JSON.parse(grid.getAttribute('data-xw'));
    var cur = 0;
    grid.querySelectorAll('input').forEach(function (inp) {
      cells[inp.dataset.r + ',' + inp.dataset.c] = inp;
    });
    var path = function (w) {
      var out = [];
      for (var i = 0; i < w.len; i++) out.push(cells[(w.dir === 'down' ? w.r + i : w.r) + ',' + (w.dir === 'down' ? w.c : w.c + i)]);
      return out;
    };
    var wordsOf = function (inp) { return String(inp.dataset.w).split(',').map(Number); };
    grid.addEventListener('focusin', function (e) {
      var inp = e.target;
      if (inp.tagName !== 'INPUT') return;
      var ws = wordsOf(inp);
      if (ws.indexOf(cur) < 0) cur = ws[0];
      inp.select();
    });
    grid.addEventListener('click', function (e) {
      var inp = e.target;
      if (inp.tagName !== 'INPUT') return;
      var ws = wordsOf(inp);
      if (ws.length > 1 && document.activeElement === inp && ws.indexOf(cur) >= 0) cur = ws[(ws.indexOf(cur) + 1) % ws.length];
    });
    grid.addEventListener('input', function (e) {
      var inp = e.target;
      inp.value = inp.value.replace(/[^А-Яа-яЁё]/g, '').slice(-1);
      if (!inp.value) return;
      var p = path(words[cur]), i = p.indexOf(inp);
      if (i >= 0 && p[i + 1]) p[i + 1].focus();
    });
    grid.addEventListener('keydown', function (e) {
      var inp = e.target;
      var r = +inp.dataset.r, c = +inp.dataset.c, to = null;
      if (e.key === 'Backspace' && !inp.value) {
        var p = path(words[cur]), i = p.indexOf(inp);
        if (i > 0) { e.preventDefault(); p[i - 1].focus(); }
        return;
      }
      if (e.key === 'ArrowRight') to = cells[r + ',' + (c + 1)];
      else if (e.key === 'ArrowLeft') to = cells[r + ',' + (c - 1)];
      else if (e.key === 'ArrowDown') to = cells[(r + 1) + ',' + c];
      else if (e.key === 'ArrowUp') to = cells[(r - 1) + ',' + c];
      if (to) { e.preventDefault(); to.focus(); }
    });
  });
})();
