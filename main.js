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
      var t = Math.max(0, (y - bespoke.offsetTop) / sheetScroll);
      var n = cards.length;
      var idx = Math.max(0, Math.min(n - 1, Math.round(t)));
      var phone = window.innerWidth <= 900;

      // geometry of the rail: one whole step per card, so nothing ever overlaps
      var sheetH = cards[0].offsetHeight || vh * 0.9;
      var restCx = cards[0].offsetLeft;            // translate:-50% already centres the sheet here
      var parkCx = window.innerWidth - (phone ? 44 : 116);
      var span = phone ? 1.6 : 2.2;                // slots visible either side of the centre
      var railStep = (vh * 0.86) / (span * 2);
      var railGap = phone ? 10 : 14;
      var parkScale = Math.min(0.44, (railStep - railGap) / sheetH);   // step minus the gap sets the height

      // the rail is an ordinary list: it slides with the scroll but stops at its two ends,
      // so the strip is always full — no empty half at the first or the last card
      var cardH = sheetH * parkScale;
      var band = parseFloat(getComputedStyle(bespoke).getPropertyValue('--band')) || 120;
      // the rail lives inside the same banded area; on a phone it also has to clear the copy
      var railArea = phone ? vh - band - 216 : vh - band - 36;
      var stripHalf = railArea / 2 - 10;
      var stripShift = phone ? (railArea / 2 - (vh - band) / 2) : -18;
      var edge = stripHalf - cardH / 2;                    // card centre when its edge meets the strip
      var firstInRail = idx === 0 ? 1 : 0;                 // the card on screen is not in the rail
      var lastInRail = idx === n - 1 ? n - 2 : n - 1;
      var topY = (firstInRail - t) * railStep;
      var botY = (lastInRail - t) * railStep;
      var hi = -edge - topY;                               // shift range that keeps both ends filled
      var lo = edge - botY;
      var shift = Math.min(Math.max(0, Math.min(lo, hi)), Math.max(lo, hi));

      var leadIdx = 0, leadOpen = -1;
      for (var s2 = 0; s2 < n; s2++) {
        var el = cards[s2];
        var d3 = t - s2;                                 // 0 = this sheet owns the screen
        var inP = clamp01(1 + d3);
        // each card dwells before it starts going back; the first one dwells longest,
        // so landing on the section does not immediately whip the photo away
        var hold = (s2 === 0) ? 0.45 : 0.2;
        var outP = (s2 === n - 1) ? 0 : clamp01((d3 - hold) / (1 - hold));
        var open = inP * (1 - Math.min(1, outP * 1.8));
        open = open * open * (3 - 2 * open);              // ease it

        // hovering a parked card leans it out of the rail without taking the screen
        var hv = hoverAmt[s2] || 0;
        if (hv > 0) open = Math.max(open, hv * 0.34);

        var railY = (s2 - t) * railStep + shift + stripShift;    // where it sits in the strip
        var cx = parkCx * (1 - open) + restCx * open;
        var tx = cx - restCx;
        var ty = (((s2 - t) * railStep + shift) * (1 - open)) + stripShift * (1 - open);
        // a hovered card nudges its direct neighbours aside, inside the rail gap
        if (hoverIdx >= 0 && s2 !== hoverIdx) {
          var dh = s2 - hoverIdx;
          ty += (dh > 0 ? 1 : -1) * 7 * Math.exp(-(dh * dh) / 1.6) * (hoverAmt[hoverIdx] || 0);
        }
        if (open > leadOpen) { leadOpen = open; leadIdx = s2; }
        var sc = (parkScale + (1 - parkScale) * open) * (1 + hv * 0.04);

        el.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0) scale(' + sc.toFixed(3) + ')';
        el.style.setProperty('--r', (4 + (1 - open) * 16).toFixed(1) + 'px');
        var isUp = open > 0.5;
        if (el.classList.contains('is-open') !== isUp) el.classList.toggle('is-open', isUp);
        el.style.zIndex = isUp
          ? String(Math.round(900 + (open - 0.5) * 40))          // opened: on top, the fuller the higher
          : String(Math.round(500 - Math.abs(s2 - t) * 22) + Math.round(hv * 40));
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

  startIntro();
})();
