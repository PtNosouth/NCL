/* NCL 新构思 — the collection
   One family at a time. The left rail switches families with a short cross-fade, and any
   plate opens a detail card instead of a page. */

(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var main = document.getElementById('col-main');
  var railLinks = [].slice.call(document.querySelectorAll('.col-rail-links a'));
  var families = [].slice.call(document.querySelectorAll('.col-family'));
  var note = document.getElementById('col-rail-note');
  var current = null;

  var NOTES = {};
  families.forEach(function (f) {
    var n = f.querySelector('.col-family-note');
    NOTES[f.dataset.family] = n ? n.textContent.trim() : '';
  });

  function cols() {
    return window.innerWidth <= 900 ? 2 : Math.max(2, Math.floor((window.innerWidth - 260) / 220));
  }

  /* ── the reveal: plates rise in column order ─────────────────────── */
  function reveal(family) {
    var plates = [].slice.call(family.querySelectorAll('.plate'));
    if (!plates.length) return;
    var per = cols();
    if (reduce.matches || !('IntersectionObserver' in window)) {
      plates.forEach(function (p) { p.classList.add('in'); });
      return;
    }
    plates.forEach(function (p) { p.classList.remove('in'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var i = parseInt(el.dataset.i, 10) || 0;
        el.style.setProperty('--d', (i % per) * 65 + 'ms');
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.06 });
    plates.forEach(function (p) { io.observe(p); });
  }

  /* ── switching families ─────────────────────────────────────────── */
  function show(name, opts) {
    opts = opts || {};
    if (current === name) return;
    var next = families.filter(function (f) { return f.dataset.family === name; })[0];
    if (!next) return;
    var prev = current;
    current = name;

    railLinks.forEach(function (a) {
      var on = a.dataset.family === name;
      a.classList.toggle('is-on', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    if (note) note.textContent = NOTES[name] || '';

    function swap() {
      families.forEach(function (f) {
        var on = f.dataset.family === name;
        f.hidden = !on;
        f.classList.toggle('is-on', on);
      });
      main.classList.remove('is-swapping');
      reveal(next);
    }

    if (reduce.matches || !prev) { swap(); return; }
    main.classList.add('is-swapping');
    setTimeout(swap, 240);

    if (opts.hash !== false && history.replaceState) history.replaceState(null, '', '#' + name);
    if (opts.scroll !== false) {
      var top = document.querySelector('.col-body').getBoundingClientRect().top + window.scrollY - (document.getElementById('nav').offsetHeight + 10);
      window.scrollTo({ top: Math.max(0, top), behavior: reduce.matches ? 'auto' : 'smooth' });
    }
  }

  railLinks.forEach(function (a) {
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      show(a.dataset.family, {});
    });
  });

  /* ── the detail card ────────────────────────────────────────────── */
  var detail = document.getElementById('detail');
  var dImg = document.getElementById('detail-img');
  var dModel = document.getElementById('detail-model');
  var dSpec = document.getElementById('detail-spec');
  var dFamily = document.getElementById('detail-family');
  var dCta = document.getElementById('detail-cta');
  var lastFocus = null;

  function openDetail(plate) {
    lastFocus = plate;
    dImg.src = plate.dataset.img;
    dImg.alt = plate.getAttribute('aria-label') || '';
    dModel.textContent = plate.dataset.model;
    dSpec.textContent = plate.dataset.spec || '';
    dFamily.textContent = plate.dataset.family;
    dCta.href = 'mailto:studio@ncl.example?subject=' + encodeURIComponent('Enquiry — ' + plate.dataset.model);
    detail.hidden = false;
    document.body.style.overflow = 'hidden';
    var closeBtn = detail.querySelector('.detail-close');
    if (closeBtn) closeBtn.focus();
  }
  function closeDetail() {
    if (detail.hidden) return;
    detail.hidden = true;
    document.body.style.overflow = '';
    dImg.src = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.querySelectorAll('.plate').forEach(function (p) {
    p.addEventListener('click', function () { openDetail(p); });
  });
  detail.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeDetail();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDetail();
  });

  /* ── boot: honour the hash, otherwise open the first family ────── */
  var start = (location.hash || '').replace('#', '');
  var known = families.some(function (f) { return f.dataset.family === start; });
  show(known ? start : families[0].dataset.family, { hash: false, scroll: false });

  window.addEventListener('resize', function () {
    var f = families.filter(function (x) { return x.dataset.family === current; })[0];
    if (f) reveal(f);
  }, { passive: true });

  /* the bar retreats once you are reading, like the other pages */
  var nav = document.getElementById('nav');
  var lastY = window.scrollY;
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    if (nav) {
      if (y > 220 && y > lastY + 6) nav.classList.add('is-away');
      else if (y < lastY - 6 || y <= 220) nav.classList.remove('is-away');
    }
    lastY = y;
  }, { passive: true });
})();
