/* NCL 新构思 — cover page
   The film plays inside a vitrine that opens when the filament lights, then loops
   on its own. No progress, no transport: the plate is the only interface. */

(function () {
  'use strict';

  var body = document.body;
  var video = document.getElementById('film-video');
  var menuBtn = document.getElementById('menu-btn');
  var menu = document.getElementById('menu');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var started = false;

  /* ── film source: one encode for phones, one for desks ── */
  function pickSource() {
    var small = window.matchMedia('(max-width: 900px)').matches ||
      (navigator.connection && /(^|\W)(2g|3g|slow-2g)$/.test(navigator.connection.effectiveType || ''));
    return small ? 'media/ncl-70086-720.mp4' : 'media/ncl-70086-1080.mp4';
  }

  function mountFilm() {
    if (!video) return;
    var src = pickSource();
    if (video.dataset.src !== src) {
      video.dataset.src = src;
      video.src = src;
      video.load();
    }
    if (reduce.matches) return;     /* motion-sensitive visitors keep the still */
    if (video.readyState >= 2) {
      play();
    } else {
      video.addEventListener('canplay', play, { once: true });
    }
  }

  function play() {
    if (!video || reduce.matches) return;
    var p = video.play();
    if (p && typeof p.catch === 'function') p.catch(function () { /* autoplay withheld */ });
  }

  /* ── intro: light the filament, then open the aperture ── */
  function startIntro() {
    if (started) return;
    started = true;
    if (reduce.matches) {
      body.classList.remove('preload');
      body.classList.add('is-lit', 'no-intro');
      return;
    }
    window.setTimeout(function () {
      body.classList.remove('preload');
      body.classList.add('is-lit');
      window.setTimeout(function () { body.classList.add('intro-done'); }, 3900);
    }, 220);
  }

  function skipIntro() {
    if (!started || body.classList.contains('no-intro')) return;
    body.classList.remove('preload');
    body.classList.add('is-lit', 'no-intro', 'intro-done');
  }

  /* ── menu ────────────────────────────────────────────── */
  function setMenu(open) {
    if (!menu || !menuBtn) return;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.classList.toggle('is-open', open);
    if (open) {
      window.requestAnimationFrame(function () { menu.classList.add('is-open'); });
    } else {
      menu.classList.remove('is-open');
    }
    var word = menuBtn.querySelector('.menu-word');
    if (word) word.textContent = open ? 'Close' : 'Menu';
  }

  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      setMenu(!menu.classList.contains('is-open'));
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false);
    });
  }

  /* ── lifecycle ───────────────────────────────────────── */
  if (video) {
    video.addEventListener('error', function () {
      document.documentElement.classList.add('film-failed');
    });
    mountFilm();
  }

  document.addEventListener('visibilitychange', function () {
    if (!video) return;
    if (document.hidden) {
      video.pause();
    } else {
      play();
    }
  });

  /* the first sign of intent reveals the page immediately */
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (type) {
    window.addEventListener(type, skipIntro, { passive: true, once: true });
  });

  if (reduce.addEventListener) {
    reduce.addEventListener('change', function () {
      if (reduce.matches) {
        skipIntro();
        if (video) video.pause();
      } else {
        play();
      }
    });
  }

  window.addEventListener('resize', function () {
    if (!video) return;
    var src = pickSource();
    if (video.dataset.src !== src) {
      var t = video.currentTime;
      video.dataset.src = src;
      video.src = src;
      video.load();
      video.addEventListener('loadedmetadata', function () {
        video.currentTime = t;
        play();
      }, { once: true });
    }
  });


  /* ── the page below the cover ───────────────────────────
     One scroll driver for everything: the cover recedes, the room rail slides
     sideways, the crystal plates drift. All of it writes transforms only. */

  var stage = document.getElementById('stage');
  var stageEl = document.querySelector('.stage');
  var bespoke = document.getElementById('bespoke');
  var deckEl = document.getElementById('deck');
  var cards = deckEl ? [].slice.call(deckEl.children) : [];
  var railName = document.getElementById('rail-name');
  var railLine = document.getElementById('rail-line');
  var lastY = window.scrollY;
  var pxLayers = [].map.call(document.querySelectorAll('img.px[data-px]'), function (img) {
    return { img: img, frame: img.closest('.px-frame'), speed: parseFloat(img.dataset.px) || 0.14 };
  });

  /* ── hover preview: a parked card leans out of the stack ── */
  var hoverIdx = -1;
  var hoverAmt = cards ? cards.map(function () { return 0; }) : [];
  var hoverTicking = false;

  function hoverTick() {
    var moving = false;
    for (var i = 0; i < cards.length; i++) {
      var target = i === hoverIdx ? 1 : 0;
      var diff = target - hoverAmt[i];
      if (Math.abs(diff) > 0.004) { hoverAmt[i] += diff * 0.18; moving = true; }
      else hoverAmt[i] = target;
    }
    paintScroll();
    hoverTicking = moving;
    if (moving) window.requestAnimationFrame(hoverTick);
  }
  function nudgeHover() {
    if (hoverTicking) return;
    hoverTicking = true;
    window.requestAnimationFrame(hoverTick);
  }

  var DECISIONS = [
    { name: 'Lights', line: 'Twelve arms or thirty-six. The piece is drawn outward from the fixture count, never squeezed into a catalogue size.' },
    { name: 'Scale', line: 'From a small pendant to a whole hall. At the far end the crystal pattern is redrawn, not enlarged.' },
    { name: 'Drop', line: 'Set by the ceiling and by the height people stand under it. We cut the rods \u2014 the drawing does not change.' },
    { name: 'Scale', line: 'The same drawing at three sizes; the crystal is re-pitched, never stretched.' },
    { name: 'Finish', line: 'Brass, antique brass or polished chrome. One finish per piece, decided with a sample in your hand.' },
    { name: 'Lights', line: 'A single drum, or forty arms on three tiers \u2014 the ceiling decides how far it can grow.' },
    { name: 'Scale', line: 'A lantern form needs more height than width; a wide room asks for a wider answer.' },
    { name: 'Finish', line: 'Crystal and brass are the same family in three temperatures; we send samples before drawing.' }
  ];
  var activeCard = -1;

  /* the deck's progress is sprung: scrolling sets a target, the rail chases it with
     a little overshoot, so cards arrive instead of snapping */
  var deckTarget = 0;
  var deckT = 0;
  var deckV = 0;
  var springRaf = 0;
  var deckSettled = false;
  var SPRING_K = 150;
  var SPRING_DAMP = 0.80;

  function stepSpring() {
    springRaf = 0;
    var dt = 1 / 60;
    deckV = (deckV + (deckTarget - deckT) * SPRING_K * dt) * SPRING_DAMP;
    deckT += deckV * dt;
    paintScroll();
    if (Math.abs(deckTarget - deckT) > 0.0008 || Math.abs(deckV) > 0.0008) {
      springRaf = window.requestAnimationFrame(stepSpring);
    } else {
      deckT = deckTarget;
      deckV = 0;
      paintScroll();
    }
  }
  function nudgeSpring() {
    if (reduce.matches) { deckT = deckTarget; deckV = 0; return; }
    if (!springRaf) springRaf = window.requestAnimationFrame(stepSpring);
  }

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function paintScroll() {
    var vh = window.innerHeight;
    var y = window.scrollY || window.pageYOffset;

    /* the cover holds still and blurs while the next screen slides over it.
       One viewport of scroll = the sheet's full travel. */
    if (stageEl) {
      var p = clamp01(y / vh);
      var maxBlur = window.innerWidth < 700 ? 7 : 10;
      /* once the sheet has covered the cover there is nothing to blur: stop paying for it */
      var blur = p >= 0.995 ? 0 : p * maxBlur;
      stageEl.style.setProperty('--cover-blur', blur.toFixed(2) + 'px');
      stageEl.style.setProperty('--cover-dim', (1 - p * 0.42).toFixed(3));
      stageEl.style.setProperty('--cover-push', (1 + p * 0.04).toFixed(4));
      stageEl.style.setProperty('--hero-fade', clamp01(1 - p * 0.85).toFixed(3));
      stageEl.style.setProperty('--veil', (p * 0.5).toFixed(3));
    }

    /* the deck: a rail of small sheets at the right edge. Scrolling pulls one out over
       the whole screen while the rail itself travels, so only the nearby cards show. */
    if (bespoke && cards.length) {
      var sheetScroll = parseFloat(getComputedStyle(bespoke).getPropertyValue('--sheet-scroll')) / 100 * vh || vh * 0.78;
      deckTarget = Math.max(0, (y - bespoke.offsetTop) / sheetScroll);
      if (!deckSettled) { deckT = deckTarget; deckSettled = true; }
      if (reduce.matches) { deckT = deckTarget; deckV = 0; }
      var t = deckT;
      var n = cards.length;
      var idx = Math.max(0, Math.min(n - 1, Math.round(t)));
      var phone = window.innerWidth <= 900;

      // geometry of the rail: one whole step per card, so nothing ever overlaps
            var sheetH = cards[0].offsetHeight || vh * 0.9;
      var sheetW = cards[0].offsetWidth || window.innerWidth * 0.5;
      var restCx = cards[0].offsetLeft;                      // translate:-50% centres the box here
      var band = parseFloat(getComputedStyle(bespoke).getPropertyValue('--band')) || 120;
      var restCy = band + (vh - band) / 2 - 18;

      // the rail: narrow horizontal slivers peeking in from the right edge
      var span = phone ? 1.6 : 2.2;
      var railStep = (vh * 0.86) / (span * 2);
      var railGap = phone ? 8 : 10;
      var stripH = Math.max(56, railStep - railGap);
      var stripW = Math.min(window.innerWidth * (phone ? 0.46 : 0.30), phone ? 200 : 380);
      var stripCx = window.innerWidth - stripW / 2 + (phone ? 12 : 26);

      // the sheet at full open covers the viewport, 4:5 like its source
      var coverH = Math.max(vh + band, window.innerWidth * (5 / 4));
      var coverW = coverH * (4 / 5);

      var railArea = phone ? vh - band - 216 : vh - band - 36;
      var stripHalf = railArea / 2 - stripH / 2;
      var stripShift = phone ? (railArea / 2 - (vh - band) / 2) : -18;
      var slotTop = restCy + stripShift;
      var edge = stripHalf;

      // first pass: how open is each sheet, and which one leads
      var opensArr = [];
      var leadIdx = 0, leadOpen = -1;
      for (var q = 0; q < n; q++) {
        var dq = t - q;
        var holdQ = q === 0 ? 0.45 : 0.2;
        var outQ = q === n - 1 ? 0 : clamp01((dq - holdQ) / (1 - holdQ));
        var oq = clamp01(1 + dq) * (1 - Math.min(1, outQ * 1.8));
        oq = oq * oq * (3 - 2 * oq);
        opensArr[q] = oq;
        if (oq > leadOpen) { leadOpen = oq; leadIdx = q; }
      }
      /* a slot is the card's index minus the opening of everything above it: the rail
         closes up behind the sheet that leaves, and never jumps when the lead changes */
      var slotBase = [];
      var accOpen = 0;
      for (var q2 = 0; q2 < n; q2++) { slotBase[q2] = q2 - accOpen; accOpen += opensArr[q2]; }
      var slotOf = function (i) { return slotBase[i]; };
      var topY = (slotOf(0) - t) * railStep;
      var botY = (slotOf(n - 1) - t) * railStep;
      var hi = -edge - topY;
      var lo = edge - botY;
      var shift = Math.min(Math.max(0, Math.min(lo, hi)), Math.max(lo, hi));

      for (var s2 = 0; s2 < n; s2++) {
        var el = cards[s2];
        var open = opensArr[s2];
        var hv = hoverAmt[s2] || 0;

        var slotY = slotTop + (slotOf(s2) - t) * railStep + shift;
        if (hoverIdx >= 0 && s2 !== hoverIdx) {
          var dh = s2 - hoverIdx;
          slotY += (dh > 0 ? 1 : -1) * 6 * Math.exp(-(dh * dh) / 1.6) * (hoverAmt[hoverIdx] || 0);
        }

        var w = stripW + (coverW - stripW) * open;
        var h = stripH + (coverH - stripH) * open;
        var cx = stripCx + (window.innerWidth / 2 - stripCx) * open;
        var cy = slotY + (vh / 2 - slotY) * open;
        var tx = cx - restCx;
        var ty = cy - restCy;

        el.style.width = w.toFixed(1) + 'px';
        el.style.height = h.toFixed(1) + 'px';
        var lift = 1 + hv * 0.05;
        el.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0) scale(' + lift.toFixed(3) + ')';
        el.style.setProperty('--r', ((1 - open) * 18).toFixed(1) + 'px');
        var isUp = open > 0.5;
        if (el.classList.contains('is-open') !== isUp) el.classList.toggle('is-open', isUp);
        // the parker rail rides above the filling sheet, so the right-hand strip never disappears
        el.style.zIndex = String(Math.round(
          open < 0.25
            ? 900 - Math.abs(s2 - t) * 8 + hv * 40
            : 600 + open * 120
        ));
        el.style.boxShadow = open > 0.5
          ? '0 12px 28px rgba(0,0,0,.32)'
          : '0 7px 16px rgba(0,0,0,.42), 0 2px 4px rgba(0,0,0,.28)';
      }

      if (leadIdx !== activeCard) {
        activeCard = leadIdx;
        idx = leadIdx;
        var d4 = DECISIONS[idx % DECISIONS.length] || DECISIONS[0];
        if (railName) railName.textContent = d4.name;
        if (railLine) railLine.textContent = d4.line;
      }
    }

    /* the crystal plates drift */
    for (var i = 0; i < pxLayers.length; i++) {
      var l = pxLayers[i];
      var r = l.frame.getBoundingClientRect();
      if (r.bottom < -120 || r.top > vh + 120) continue;
      var mid = r.top + r.height / 2;
      var off = ((mid - vh / 2) / vh) * l.speed * 100;
      l.img.style.transform = 'translate3d(0,' + off.toFixed(2) + 'px,0)';
    }

    /* the bar: a ground once we leave the cover, and which passage we are in.
       Going down it retreats; going up, or near the top, it comes back. */
    var here0 = window.scrollY;
    if (here0 > vh * 0.75 && here0 > lastY + 6) document.body.classList.add('nav-away');
    else if (here0 < lastY - 6 || here0 <= vh * 0.75) document.body.classList.remove('nav-away');
    lastY = here0;

    document.body.classList.toggle('scrolled', y > vh * 0.55);
    var spy = [['top', 0], ['bespoke', bespoke ? bespoke.offsetTop : Infinity],
               ['atelier', document.getElementById('atelier') ? document.getElementById('atelier').offsetTop : Infinity]];
    var here = y + vh * 0.4;
    var current = 'top';
    for (var k = 0; k < spy.length; k++) if (here >= spy[k][1]) current = spy[k][0];
    [].forEach.call(document.querySelectorAll('[data-spy]'), function (a) {
      if (a.dataset.spy === current) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  var scrollTick = false;
  function onScroll() {
    if (reduce.matches) { paintScroll(); return; }
    if (scrollTick) return;
    scrollTick = true;
    window.requestAnimationFrame(function () { scrollTick = false; paintScroll(); });
    nudgeSpring();
  }

  if (cards && cards.length) {
    cards.forEach(function (el, i) {
      el.addEventListener('pointerenter', function () { hoverIdx = i; nudgeHover(); });
      el.addEventListener('pointerleave', function () { if (hoverIdx === i) hoverIdx = -1; nudgeHover(); });
      el.addEventListener('focus', function () { hoverIdx = i; nudgeHover(); });
      el.addEventListener('blur', function () { if (hoverIdx === i) hoverIdx = -1; nudgeHover(); });
    });
  }

  paintScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { paintScroll(); });
  if (reduce.addEventListener) reduce.addEventListener('change', onScroll);

  /* ── page transitions ────────────────────────────────────
     A curtain rises over the page, then falls away on the other side. */
  var pageVeil = document.getElementById('page-veil');
  var NAV_KEY = 'ncl:transition';

  if (pageVeil) {
    var arriving = false;
    try { arriving = sessionStorage.getItem(NAV_KEY) === '1'; sessionStorage.removeItem(NAV_KEY); } catch (e) {}
    if (arriving) {
      pageVeil.classList.add('is-arriving');
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          pageVeil.classList.add('is-lifting');
          setTimeout(function () { pageVeil.classList.remove('is-arriving', 'is-lifting'); }, 760);
        });
      });
    }

    if (!reduce.matches) {
      document.addEventListener('click', function (e) {
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!a) return;
        var href = a.getAttribute('href') || '';
        if (!/\.html(?:$|[?#])/.test(href) || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        try { sessionStorage.setItem(NAV_KEY, '1'); } catch (err) {}
        pageVeil.classList.add('is-leaving');
        setTimeout(function () { window.location.href = href; }, 560);
      });
    }
  }

  /* ── snap: a wheel gesture moves the deck exactly one sheet ────────────────
     Crossing into the section from the cover pulls it straight to its top, so the
     first commission lands full screen no matter how hard the wheel was spun. */
  var snapBusy = false;
  var snapTimer = 0;

  function deckMetrics() {
    if (!bespoke || !cards.length) return null;
    var vpe = window.innerHeight;
    var step = (parseFloat(getComputedStyle(bespoke).getPropertyValue('--sheet-scroll')) / 100) * vpe || vpe * 0.78;
    return { top: bespoke.offsetTop, step: step, n: cards.length, vpe: vpe };
  }

  /* short push, long settle: fast enough to feel intentional, slow enough to land */
  function snapTo(target, dur) {
    dur = dur || 620;
    snapBusy = true;
    document.dispatchEvent(new Event('ncl:snap'));
    var from = window.scrollY;
    var dist = target - from;
    var t0 = window.performance.now();
    function step(now) {
      var k = Math.min(1, (now - t0) / dur);
      var e = k < 0.28
        ? (k / 0.28) * (k / 0.28) * 0.22
        : 0.22 + 0.78 * (1 - Math.pow(1 - (k - 0.28) / 0.72, 3));
      window.scrollTo(0, from + dist * e);
      if (k < 1) window.requestAnimationFrame(step);
      else { snapBusy = false; window.clearTimeout(snapTimer); }
    }
    window.requestAnimationFrame(step);
  }

  function onWheelSnap(e) {
    if (reduce.matches) return;
    var m = deckMetrics();
    if (!m) return;
    var y = window.scrollY;
    var lastTop = m.top + (m.n - 1) * m.step;
    var inside = y >= m.top - 2 && y <= lastTop + 2;
    var entering = y < m.top - 2 && e.deltaY > 0 && y > m.top - window.innerHeight;
    if (!inside && !entering) return;
    var dir = e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0);
    if (!dir) return;
    var idx = Math.round((y - m.top) / m.step);
    /* the ends are open: going up from the first sheet hands back to the cover,
       going down from the last one carries on to the rest of the page */
    if (!entering && dir < 0 && idx <= 0) return;
    if (!entering && dir > 0 && idx >= m.n - 1) return;
    e.preventDefault();
    if (snapBusy) return;
    /* coming in from the cover always lands on the first sheet, never one past it */
    var target = entering ? 0 : Math.max(0, Math.min(m.n - 1, idx + dir));
    snapTo(m.top + target * m.step);
    window.clearTimeout(snapTimer);
    snapTimer = window.setTimeout(function () { snapBusy = false; }, 1100);
  }

  window.addEventListener('wheel', onWheelSnap, { passive: false });


  /* ── damped scrolling, on every page ──────────────────────────────────────
     Wheel input moves a target, and the page is pulled toward it by a
     critically damped spring: it leans in, glides, and settles without overshoot.
     Any handler that already claimed the event (the deck snap) wins. */
  function initDampedScroll() {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;
    var OMEGA = 15;              // how fast it chases the target
    var ZETA = 1;                // 1 = critically damped, no overshoot
    var EASE = 0.9;              // a little resistance on the input itself
    var target = window.scrollY;
    var pos = target;
    var vel = 0;
    var raf = 0;
    var running = false;
    var last = 0;

    function maxY() {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }

    function frame(now) {
      var dt = Math.min(0.05, Math.max(0.004, (now - last) / 1000));
      last = now;
      var steps = 4;
      var h = dt / steps;
      for (var i = 0; i < steps; i++) {
        var a = -2 * ZETA * OMEGA * vel - OMEGA * OMEGA * (pos - target);
        vel += a * h;
        pos += vel * h;
      }
      var limit = maxY();
      if (pos < 0) { pos = 0; vel = 0; }
      if (pos > limit) { pos = limit; vel = 0; }
      window.scrollTo(0, pos);
      if (Math.abs(pos - target) < 0.4 && Math.abs(vel) < 2) {
        pos = target;
        window.scrollTo(0, target);
        running = false;
        return;
      }
      raf = window.requestAnimationFrame(frame);
    }

    function stop() {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      running = false;
    }

    function onWheel(e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.target && e.target.closest && e.target.closest('.menu, .detail, [data-native-scroll]')) return;
      var limit = maxY();
      if (limit <= 0) return;
      if (!running) {
        pos = window.scrollY;
        vel = 0;
        target = pos;
      }
      target = Math.min(limit, Math.max(0, target + e.deltaY * EASE));
      if (Math.abs(target - window.scrollY) < 1) return;
      e.preventDefault();
      if (!running) {
        running = true;
        last = window.performance.now();
        raf = window.requestAnimationFrame(frame);
      }
    }

    window.addEventListener('wheel', onWheel, { passive: false });

    /* anything else that moves the page takes it back from us */
    window.addEventListener('scroll', function () {
      if (!running) target = window.scrollY;
    }, { passive: true });
    window.addEventListener('keydown', function (ev) {
      if (/^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(ev.key)) stop();
    });
    window.addEventListener('touchstart', stop, { passive: true });
    mq.addEventListener && mq.addEventListener('change', function () {
      if (mq.matches) stop();
    });

    /* the deck snap drives its own scroll: hand control over while it runs */
    document.addEventListener('ncl:snap', stop);
  }

  startIntro();
  initDampedScroll();
})();
