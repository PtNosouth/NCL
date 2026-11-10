/* the bridge from the cover to the first project
   ------------------------------------------------------------------
   All this layer does is the black:

   1. scrolling down runs a fixed, time-based fill (the wheel does not scrub it);
   2. the moment the fill lands, the page travels to the section *under the black*,
      so nobody sits on an empty black screen waiting to scroll there;
   3. the layer fades away and the deck plays its own opening beat (list, then the
      card opening out of its thumbnail, then the copy -- see main.js / style.css);

   going back up: the deck closes, the black fades in, the page returns to the top
   under it, and the fill falls away to reveal the cover. */
(function () {
  'use strict'

  var layer = document.getElementById('deck-intro')
  var bespoke = document.getElementById('bespoke')
  if (!layer || !bespoke || !window.gsap) return

  var gsap = window.gsap
  var black = layer.querySelector('.di-black')
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)')

  function scrollTop() { return window.scrollY || window.pageYOffset || 0 }

  gsap.set(layer, { autoAlpha: 0 })
  gsap.set(black, { yPercent: 108 })

  var state = 'cover'                 /* cover → running → deck → leaving */
  var tl = null
  var fillGuard = 0
  var leavingJumped = false

  function deckOpenEvent() {
    document.dispatchEvent(new CustomEvent('ncl:deck-open'))
  }

  function paintOn() { gsap.set(layer, { autoAlpha: 1 }) }
  function paintOff() { gsap.set(layer, { autoAlpha: 0 }) }

  function build() {
    return gsap.timeline({
      paused: true,
      onComplete: function () {
        /* the fill has landed: get to the section while the screen is black */
        if (scrollTop() < bespoke.offsetTop - 2) window.scrollTo(0, bespoke.offsetTop)
        else handOff()
      }
    })
      .set(layer, { autoAlpha: 1 })
      /* ease-out on purpose: with an in-out curve the panel crept for the first third
         of a second and read as "the shadow stopped and waited" */
      .to(black, { yPercent: 0, duration: 0.36, ease: 'power2.out' })
  }

  function forward() {
    state = 'running'
    tl = build()
    if (reduce.matches) {
      window.scrollTo(0, bespoke.offsetTop)
      tl.progress(1).pause()
      handOff()
      return
    }
    paintOn()
    tl.play()
    /* safety net: if the frame clock is throttled (background tab, headless), land the
       fill on wall time so the page is never left on an empty black screen */
    window.clearTimeout(fillGuard)
    fillGuard = window.setTimeout(function () {
      if (tl && tl.progress() < 1) tl.progress(1)
    }, 900)
  }

  function handOff() {
    if (state === 'deck') return
    state = 'deck'
    if (tl) tl.progress(1).pause()
    /* park the card in its slot while the black still covers the deck */
    document.dispatchEvent(new CustomEvent('ncl:deck-prime'))
    if (reduce.matches) { paintOff(); deckOpenEvent(); return }
    gsap.to(layer, {
      autoAlpha: 0, duration: 0.13, ease: 'power1.out',
      onComplete: function () {
        deckOpenEvent()
      }
    })
  }

  function backward() {
    if (!tl || tl.progress() <= 0.001) {
      /* no fill was ever run (the visitor landed straight on the section): still leave
         through a curtain instead of dropping them back with no transition */
      if (tl) tl.pause()
      state = 'leaving'
      leavingJumped = false
      if (reduce.matches) { window.scrollTo(0, 0); paintOff(); state = 'cover'; return }
      gsap.fromTo(layer, { autoAlpha: 0 }, {
        autoAlpha: 1, duration: 0.14, ease: 'power1.out',
        onComplete: function () {
          leavingJumped = true
          window.scrollTo(0, 0)
          gsap.to(layer, {
            autoAlpha: 0, duration: 0.24, delay: 0.08,
            onComplete: function () { state = 'cover' }
          })
        }
      })
      return
    }
    state = 'leaving'
    leavingJumped = false
    if (reduce.matches) {
      tl.progress(0).pause()
      window.scrollTo(0, 0)
      paintOff()
      state = 'cover'
      return
    }
    gsap.fromTo(layer, { autoAlpha: 0 }, {
      autoAlpha: 1, duration: 0.18, ease: 'power1.out',
      onComplete: function () {
        /* the curtain is closed now: cut to the cover, then let it fall away */
        leavingJumped = true
        if (scrollTop() > 2) window.scrollTo(0, 0)
        tl.reverse()
      }
    })
    tl.eventCallback('onReverseComplete', function () {
      paintOff()
      state = 'cover'
    })
  }

  function decide(dir) {
    if (state === 'leaving') {
      /* hold the page on the section while the black is still coming in: the cut to the
         cover must happen under a full curtain, not somewhere mid-scroll */
      var edge = bespoke.offsetTop
      if (!leavingJumped && Math.abs(scrollTop() - edge) > 1) window.scrollTo(0, edge)
      return
    }
    var y = scrollTop()
    var deckEdge = bespoke.offsetTop

    if (deckEdge - y <= 0) {
      if (state === 'running' || state === 'cover') handOff()
      return
    }

    if (state === 'deck') {
      if (y < deckEdge - window.innerHeight * 0.02) backward()
      return
    }

    if (state === 'running') {
      if (dir > 0 && tl && tl.reversed()) tl.play()
      if (dir < 0 && y < 40 && tl && !tl.reversed()) backward()
      return
    }

    if (dir > 0 && y > 8) forward()
  }

  var again = 0
  var lastY = scrollTop()
  var lastDir = 0
  function onScroll() {
    var y = scrollTop()
    if (y !== lastY) lastDir = y > lastY ? 1 : -1
    lastY = y
    decide(lastDir)
    if (again) return
    again = window.requestAnimationFrame(function () { again = 0; decide(lastDir) })
  }

  /* the deck has finished its closing beat: bring the black in */
  document.addEventListener('ncl:deck-leave', function () {
    if (state === 'deck') backward()
  })

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  onScroll()
})()
