/* ── scroll damping, on every page ────────────────────────────────────────
   The wheel no longer moves the page directly: it moves a target, and the page is
   pulled towards that target every frame by a critically damped spring. It leans in,
   glides, and settles without overshoot.

   Rules that keep it from fighting the rest of the site:
   - anything that already claimed the wheel wins (`e.defaultPrevented`): on the
     commissions section the carousel owns the gesture;
   - any scroll that came from somewhere else (anchor, keyboard, the cover
     transition's own scrollTo) re-syncs the target instead of being dragged back;
   - reduced motion, and any element with `data-native-scroll`, scroll natively. */
(function () {
  'use strict'

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (reduce.matches) return

  var OMEGA = 13                 /* how quickly it chases the target */
  var ZETA = 1                   /* 1 = critically damped: no overshoot */
  var MAX_STEP = 260             /* a single notch can never jump further than this */

  var target = window.scrollY || 0
  var pos = target
  var vel = 0
  var raf = 0
  var last = 0

  function maxY() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  }

  function running() { return raf !== 0 }

  function frame(now) {
    var dt = last ? Math.min(0.05, Math.max(0.004, (now - last) / 1000)) : 0.016
    last = now

    /* somebody else moved the page (anchor, keyboard, the deck's own snap): follow it */
    var sy = window.scrollY || 0
    if (Math.abs(sy - pos) > 1.5) {
      pos = sy
      target = sy
      vel = 0
    }

    var limit = maxY()
    if (target > limit) target = limit
    if (target < 0) target = 0

    var steps = 3
    var h = dt / steps
    for (var i = 0; i < steps; i++) {
      var a = -2 * ZETA * OMEGA * vel - OMEGA * OMEGA * (pos - target)
      vel += a * h
      pos += vel * h
    }
    if (pos < 0) { pos = 0; vel = 0 }
    if (pos > limit) { pos = limit; vel = 0 }

    window.scrollTo(0, pos)

    if (Math.abs(pos - target) < 0.4 && Math.abs(vel) < 1.5) {
      window.scrollTo(0, target)
      pos = target
      vel = 0
      raf = 0
      last = 0
      return
    }
    raf = window.requestAnimationFrame(frame)
  }

  function start() {
    if (running()) return
    last = 0
    raf = window.requestAnimationFrame(frame)
  }

  document.addEventListener('wheel', function (e) {
    /* the carousel already claimed this gesture, or the visitor meant to zoom */
    if (e.defaultPrevented || e.ctrlKey || e.metaKey) return
    if (e.target && e.target.closest && e.target.closest('[data-native-scroll]')) return
    if (Math.abs(e.deltaY) < 0.5) return

    e.preventDefault()

    /* resync first: the page may have been moved without us (e.g. by a link) */
    if (!running()) { pos = window.scrollY || 0; target = pos; vel = 0 }

    var step = Math.max(-MAX_STEP, Math.min(MAX_STEP, e.deltaY))
    target = Math.max(0, Math.min(maxY(), target + step))
    start()
  }, { passive: false })

  /* anchors and in-page links still land where they promise */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null
    if (!a) return
    var id = a.getAttribute('href').slice(1)
    var el = id ? document.getElementById(id) : null
    if (!el) return
    e.preventDefault()
    target = Math.max(0, Math.min(maxY(), el.getBoundingClientRect().top + window.scrollY))
    start()
  })
})()
