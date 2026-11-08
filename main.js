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

  startIntro();
})();
