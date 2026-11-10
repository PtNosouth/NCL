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
  /* the sheets live in the stage now, so `children` would only be the stage, the rail
     and the glow -- the list has to be the sheets themselves */
  var cards = deckEl ? [].slice.call(deckEl.querySelectorAll('.sheet')) : [];
  var veilEl = document.getElementById('deck-veil')
  var railName = document.getElementById('rail-name');
  var railLine = document.getElementById('rail-line');
  var lastY = window.scrollY;
  var pxLayers = [].map.call(document.querySelectorAll('img.px[data-px]'), function (img) {
    return { img: img, frame: img.closest('.px-frame'), speed: parseFloat(img.dataset.px) || 0.14 };
  });

  /* the entrance runs on its own clock: veil up, first card through it, rail in */
  function stepEntry() {
    entryP = Math.min(1, entryP + 1 / 90);
    paintScroll();
    if (entryP < 1) window.requestAnimationFrame(stepEntry);
  }
  /* the curtain fills by itself the moment the page starts to move */
  function stepFill() {
    fillP = Math.min(1, fillP + 1 / 30);
    paintScroll();
    if (fillP < 1) window.requestAnimationFrame(stepFill);
  }
  function startFill() {
    if (fillStarted) return;
    fillStarted = true;
    fillP = 1;
    if (veilEl) veilEl.classList.add('is-filled');
  }

  function startEntry() {
    if (entryStarted) return;
    entryStarted = true;
    if (!reduce.matches) window.requestAnimationFrame(stepEntry);
    else entryP = 1;
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
  var activeCard = -1
  var entryP = 0
  var entryStarted = false
  var fillP = 0;
  var fillStarted = false;
  var reachedDeck = false;

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
          /* ── the commission deck ────────────────────────────────────────────
         One card is expanded at a time — the topmost of the ones left. Scrolling
         spends cards from the top: the expanded one leaves upward while the next
         rises out of the rail. The rail holds what is still to come, so it is full
         on the first card and empty on the last. */
      if (bespoke && cards.length) {
        var sheetScroll = (parseFloat(getComputedStyle(bespoke).getPropertyValue('--sheet-scroll')) / 100) * vh || vh * 0.78;
        if (!fillStarted && y > 8) startFill();
        if (!entryStarted && bespoke.offsetTop - y < vh * 0.55) startEntry();

        /* the curtain: it fills from the bottom once, then scroll lifts it away again */
        var ct = (y - bespoke.offsetTop) / sheetScroll;
        if (ct > 0.02) reachedDeck = true;
        var lift = fillP >= 1 ? Math.max(0, Math.min(1, ct / 0.5)) : 0;
        var retract = reachedDeck && y < bespoke.offsetTop
          ? Math.min(1, (bespoke.offsetTop - y) / (vh * 0.6))
          : 0;

        syncCarousel();

        /* the veil: it darkens, holds, then clears as the first card comes through */
        if (veilEl) {
          var park = lift * 100 - retract * 100;    /* -100: lifted away, +100: parked below */
          veilEl.style.setProperty('--veil', park.toFixed(2));
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

  /* ── the carousel: positions live in CSS, a rotation is a DOM move ─────── */
  var carouselActive = -1;

  /* the carousel rotates DOM nodes, so it must own a container that holds nothing
     else: the rail and the glow sit outside it and keep their positions */
  var deckStage = document.getElementById('deck-stage') || deckEl;

  function carouselItems() {
    return deckEl ? deckEl.querySelectorAll('.sheet') : [];
  }

  var glowEl = deckEl ? deckEl.querySelector('.deck-glow') : null;
  function syncGlow() {
    if (!glowEl) return;
    var items = carouselItems();
    var act = items[1];
    var img = act ? act.querySelector('img') : null;
    if (img && glowEl.dataset.src !== img.getAttribute('src')) {
      glowEl.dataset.src = img.getAttribute('src');
      glowEl.style.backgroundImage = 'url("' + img.getAttribute('src') + '")';
    }
  }

  /* the carousel is a sequence, not a loop: everything already shown leaves the list */
  function markPast(active) {
    var items = carouselItems();
    for (var i = 0; i < items.length; i++) {
      var id = parseInt(items[i].getAttribute('data-i') || '0', 10);
      items[i].classList.toggle('is-past', id < active);
    }
    if (deckEl) deckEl.classList.toggle('is-empty', active >= items.length - 1);
  }

  function syncCarousel() {
    if (!deckEl) return;
    var items = carouselItems();
    for (var i = 0; i < items.length; i++) {
      var active = i === 1;                       /* the reference's nth-child(2) */
      if (items[i].classList.contains('is-open') !== active) items[i].classList.toggle('is-open', active);
      if (items[i].classList.contains('is-stage') !== (i <= 1)) items[i].classList.toggle('is-stage', i <= 1);
    }

    /* the copy belongs to the active card and replays on every change */
    var act = items[1];
    var id = act ? parseInt(act.getAttribute('data-i') || '0', 10) : 0;
    markPast(id);
    if (id !== carouselActive) {
      carouselActive = id;
      var d = DECISIONS[id % DECISIONS.length] || DECISIONS[0];
      var tr = window.NCLtext || function (x) { return x; };
      if (railName) railName.textContent = tr(d.name);
      if (railLine) railLine.textContent = tr(d.line);
      var copyEl = document.querySelector('.deck-copy');
      if (copyEl) {
        copyEl.classList.remove('is-swap');
        void copyEl.offsetWidth;                  /* restart the animation */
        copyEl.classList.add('is-swap');
      }
    }

    /* publish the stage box (pinned viewport coordinates) for the cover→deck layer */
    if (bespoke) {
      var r = deckEl.getBoundingClientRect();
      var pinOff = Math.max(0, bespoke.offsetTop - (window.scrollY || window.pageYOffset));
      bespoke.style.setProperty('--card-l', r.left.toFixed(1) + 'px');
      bespoke.style.setProperty('--card-t', (r.top - pinOff).toFixed(1) + 'px');
      bespoke.style.setProperty('--card-w', r.width.toFixed(1) + 'px');
      bespoke.style.setProperty('--card-h', r.height.toFixed(1) + 'px');
    }
  }

  function activeId() {
    var items = carouselItems();
    var act = items[1];
    return act ? parseInt(act.getAttribute('data-i') || '0', 10) : 0;
  }

  /* returns false when the deck is already at that end, so the caller can let the
     page take over instead */
  function rotate(dir) {
    if (!deckEl) return false;
    var items = carouselItems();
    if (items.length < 2) return false;
    var id = activeId();
    if (dir > 0 && id >= items.length - 1) return false;   /* last room: no next */
    if (dir < 0 && id <= 0) return false;                  /* first room: no previous */
    if (dir > 0) deckStage.appendChild(items[0]);
    else deckStage.insertBefore(items[items.length - 1], items[0]);
    syncCarousel();
    syncGlow();
    return true;
  }

  /* the entrance beats are the deck's own: see `ncl:deck-open` in intro.js */
  var openTimer = 0, closeTimer = 0;
  var deckReady = false;
  function deckPrime() {
    if (!deckEl) return;
    deckEl.classList.remove('is-closing');
    deckEl.classList.add('is-primed');
    /* decode every photograph before the curtain lifts: the opening used to play over
       empty cards (black frame, holes in the list) while the lazy images were still on
       their way */
    deckReady = false;
    var imgs = [].slice.call(deckEl.querySelectorAll('.sheet img'));
    Promise.all(imgs.map(function (img) {
      img.loading = 'eager';
      return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
    })).then(function () { deckReady = true; });
  }
  function deckOpen() {
    if (!deckEl) return;
    /* wait (briefly) for the photographs, so the first beat is never an empty frame */
    var waited = 0;
    var go = function () {
      window.clearTimeout(openTimer);
      deckEl.classList.remove('is-closing', 'is-primed');
      deckEl.classList.remove('is-opening');
      void deckEl.offsetWidth;                  /* restart the animation */
      deckEl.classList.add('is-opening');
      openTimer = window.setTimeout(function () { deckEl.classList.remove('is-opening'); }, 620);
    };
    var wait = function () {
      if (deckReady || waited > 900) return go();
      waited += 80;
      window.setTimeout(wait, 80);
    };
    wait();
  }
  function deckClose() {
    if (!deckEl) return;
    window.clearTimeout(closeTimer);
    deckEl.classList.remove('is-opening');
    deckEl.classList.remove('is-closing');
    void deckEl.offsetWidth;
    deckEl.classList.add('is-closing');
    closeTimer = window.setTimeout(function () {
      deckEl.classList.remove('is-closing');
      /* hand over without moving the page: the black comes in first, and only then does
         the cover get revealed -- otherwise the exit happened at whatever scroll
         position the wheel had already reached and the deck slid away, dimmed */
      document.dispatchEvent(new CustomEvent('ncl:deck-leave'));
    }, 400);
  }
  document.addEventListener('ncl:deck-prime', deckPrime);
  document.addEventListener('ncl:deck-open', deckOpen);

  var nextBtn = document.querySelector('.deck-nav .next');
  var prevBtn = document.querySelector('.deck-nav .prev');
  if (nextBtn) nextBtn.addEventListener('click', function () { rotate(1); });
  if (prevBtn) prevBtn.addEventListener('click', function () { rotate(-1); });

  /* open on the first room: the front pair is [last, first], so `nth-child(2)` -- the
     visible card -- is the first room instead of the second */
  if (deckEl) { rotate(-1); syncGlow(); }

  /* wheel and drag turn the carousel one card at a time, like the buttons */
  var wheelLock = 0;
  /* the trap listens on the document, not on the deck: while the visitor is on the
     cover or in the craft section the pointer is not over the deck, so a deck-bound
     listener never fired and a fast scroll sailed straight past this section */
  if (deckEl) {
    document.addEventListener('wheel', function (e) {
      /* only while the section is near the top of the viewport */
      var y = window.scrollY || window.pageYOffset || 0;
      var top = bespoke ? bespoke.offsetTop : 0;
      if (y < top - 240 || y > top + 240) return;

      var vh = window.innerHeight;
      var dir = e.deltaY > 0 ? 1 : -1;
      var atLast = dir > 0 && activeId() >= carouselItems().length - 1;
      var atFirst = dir < 0 && activeId() <= 0;
      var pinned = Math.abs(y - top) <= 4;

      /* An end only pulls the page back while the section is still *below* the pin (or,
         going up, still below it) -- i.e. while the visitor is arriving. Once the page is
         past the pin the gesture belongs to the page; snapping on every notch there is
         what made the last card fight fast scrolling and jitter in place. */
      if (atLast) {
        if (y < top - 4) { e.preventDefault(); window.scrollTo(0, top); return; }
        return;                                   /* already at/past the pin: let it go */
      }
      if (atFirst) {
        if (y > top + 4) { e.preventDefault(); window.scrollTo(0, top); return; }
        /* first card, still going up: close the deck, then hand back to the page */
        if (deckEl && !deckEl.classList.contains('is-closing')) {
          e.preventDefault();
          deckClose();
        }
        return;
      }

      e.preventDefault();
      /* the opening beat owns the stage */
      if (deckEl.classList.contains('is-opening')) return;
      if (!pinned) { window.scrollTo(0, top); return; }

      if (Math.abs(e.deltaY) < 12) return;
      var now = Date.now();
      if (now - wheelLock < 320) return;
      wheelLock = now;
      rotate(dir);
    }, { passive: false });

    var dragY = 0, dragging = false;
    deckEl.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      dragging = true;
      dragY = e.clientY;
    });
    deckEl.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      var dy = dragY - e.clientY;
      if (Math.abs(dy) > 48) rotate(dy > 0 ? 1 : -1);   /* returns false at an end */
    });
    deckEl.addEventListener('pointerleave', function () { dragging = false; });
  }

  /* ── the gate: scrolling past the pin buys carousel turns ──────────────
     A fling (or a trackpad's momentum, which keeps moving the page without any
     wheel events) used to sail through this section. Any travel beyond the pin is
     now absorbed: the page is pushed back to the pin and the distance is exchanged
     for that many card turns, so a fast scroll spins the carousel quickly instead of
     skipping it. The page only leaves once the carousel reaches an end. */
  var OVERSTEP = 220;                 /* px of overshoot per card */
  var gateArmed = false;
  var gateLastY = -1;
  function consumeOvershoot() {
    if (!deckEl || !bespoke) return;
    var top = bespoke.offsetTop;
    var vh = window.innerHeight;
    var y = window.scrollY || window.pageYOffset || 0;
    var over = y - top;

    if (gateLastY < 0) gateLastY = y;
    /* arriving counts as a *crossing*, not as landing inside a narrow band: a fling
       can jump from 600 to 1500 between two frames and never touch deckTop exactly */
    var crossed = gateLastY !== y && (gateLastY - top) * (y - top) <= 0;
    gateLastY = y;
    if (crossed) gateArmed = true;

    if (Math.abs(over) <= 1) { gateArmed = true; return; }
    if (!gateArmed) return;                                       /* still travelling towards it */

    var items = carouselItems();
    var dir = over > 0 ? 1 : -1;
    var id = activeId();
    if (dir > 0 ? id >= items.length - 1 : id <= 0) { gateArmed = false; return; }
    if (Math.abs(over) > vh * 3) { gateArmed = false; return; }   /* genuinely elsewhere */

    window.scrollTo(0, top);
    if (deckEl.classList.contains('is-opening') || deckEl.classList.contains('is-closing')) return;

    var cards = Math.max(1, Math.round(Math.abs(over) / OVERSTEP));
    for (var i = 0; i < cards; i++) { if (!rotate(dir)) break; }
  }

  var scrollTick = false;
  function onScroll() {
    if (reduce.matches) { paintScroll(); return; }
    if (scrollTick) return;
    scrollTick = true;
    window.requestAnimationFrame(function () {
      scrollTick = false;
      consumeOvershoot();
      paintScroll();
    });
    nudgeSpring();
  }

  paintScroll();

  /* the entrance runs on its own clock: veil up, first card through it, rail in */
  function stepEntry() {
    entryP = Math.min(1, entryP + 1 / 90);
    paintScroll();
    if (entryP < 1) window.requestAnimationFrame(stepEntry);
  }
  /* the curtain fills by itself the moment the page starts to move */
  function stepFill() {
    fillP = Math.min(1, fillP + 1 / 30);
    paintScroll();
    if (fillP < 1) window.requestAnimationFrame(stepFill);
  }
  function startFill() {
    if (fillStarted) return;
    fillStarted = true;
    fillP = 1;
    if (veilEl) veilEl.classList.add('is-filled');
  }

  function startEntry() {
    if (entryStarted) return;
    entryStarted = true;
    if (!reduce.matches) window.requestAnimationFrame(stepEntry);
    else entryP = 1;
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
  var activeCard = -1
  var entryP = 0
  var entryStarted = false
  var fillP = 0;
  var fillStarted = false;
  var reachedDeck = false;

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


  /* dragging the deck turns it one card at a time, like the buttons */
  if (deckEl) {
    var dragY = 0, dragging = false;
    deckEl.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      dragging = true;
      dragY = e.clientY;
    });
    deckEl.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      var dy = dragY - e.clientY;
      if (Math.abs(dy) > 48) rotate(dy > 0 ? 1 : -1);
    });
    deckEl.addEventListener('pointerleave', function () { dragging = false; });
  }

  /* clicking a list card jumps straight to it: the nodes are re-ordered in one go, so the
     deck plays a single transition from where it is to where that card belongs */
  function rotateTo(target) {
    var cur = activeId();
    var step = target - cur;
    if (!step) return;
    var dir = step > 0 ? 1 : -1;
    for (var i = 0; i < Math.abs(step); i++) {
      var items = carouselItems();
      if (items.length < 2) return;
      if (dir > 0) deckStage.appendChild(items[0]);
      else deckStage.insertBefore(items[items.length - 1], items[0]);
    }
    syncCarousel();
    syncGlow();
  }

  if (cards && cards.length) {
    cards.forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        if (!deckEl) return;
        if (deckEl.classList.contains('is-opening') || deckEl.classList.contains('is-closing')) return;
        var target = parseInt(el.getAttribute('data-i') || '0', 10);
        rotateTo(target);
      });
    });
  }

  /* a language change re-renders the deck copy too */
  document.addEventListener('ncl:lang', function () {
    carouselActive = -1;
    syncCarousel();
    paintScroll();
  });

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


  /* ── damped scrolling, on every page ──────────────────────────────────────
     Wheel input moves a target, and the page is pulled toward it by a
     critically damped spring: it leans in, glides, and settles without overshoot.
     Any handler that already claimed the event (the deck snap) wins. */
  startIntro();
})();
