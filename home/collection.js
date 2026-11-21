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


  /* ── magnifier: a lens that follows the cursor over the detail photograph ──
     2.4x, mapped through the image's contain-fit box so the lens always shows
     exactly what is under the pointer. */
  (function initMagnifier() {
    var ZOOM = 1.9;   /* the plates are 900px wide: stay close to native so the lens stays crisp */
    var media = document.querySelector('.detail-media');
    var img = document.getElementById('detail-img');
    if (!media || !img) return;
    if (window.matchMedia('(hover: none)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var lens = document.createElement('div');
    lens.className = 'detail-lens';
    lens.setAttribute('aria-hidden', 'true');
    media.appendChild(lens);

    function contentBox() {
      var box = img.getBoundingClientRect();
      var nw = img.naturalWidth || 900;
      var nh = img.naturalHeight || 1125;
      if (!nw || !nh) return null;
      var s = Math.min(box.width / nw, box.height / nh);
      var w = nw * s;
      var h = nh * s;
      return { x: box.left + (box.width - w) / 2, y: box.top + (box.height - h) / 2, w: w, h: h };
    }

    media.addEventListener('pointermove', function (e) {
      var c = contentBox();
      if (!c || !c.w) return;
      var nx = (e.clientX - c.x) / c.w;
      var ny = (e.clientY - c.y) / c.h;
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) { media.classList.remove('is-zoom'); return; }
      media.classList.add('is-zoom');
      var lw = lens.offsetWidth || 190;
      var lh = lens.offsetHeight || 190;
      var rect = media.getBoundingClientRect();
      lens.style.transform = 'translate3d(' + (e.clientX - rect.left - lw / 2).toFixed(1) + 'px,' +
        (e.clientY - rect.top - lh / 2).toFixed(1) + 'px,0)';
      lens.style.backgroundImage = 'url("' + img.currentSrc + '")';
      lens.style.backgroundSize = (c.w * ZOOM) + 'px ' + (c.h * ZOOM) + 'px';
      lens.style.backgroundPosition = (-(nx * c.w * ZOOM - lw / 2)).toFixed(1) + 'px ' +
        (-(ny * c.h * ZOOM - lh / 2)).toFixed(1) + 'px';
    }, { passive: true });

    media.addEventListener('pointerleave', function () { media.classList.remove('is-zoom'); });
  })();

})();
