/* Adds the shared rise-in easing to the blocks that are below the fold.

   Pages opt in with plain CSS selectors rather than per-element attributes: the
   markup stays readable and there is one place that decides what moves. Elements
   already in view at load are revealed immediately, so nothing is ever left
   invisible. */
(function () {
  'use strict'

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (reduce.matches || !('IntersectionObserver' in window)) return

  /* selector, stagger between siblings (ms), cap (ms) */
  var GROUPS = [
    ['#atelier .craft-intro', 0],
    ['#atelier .craft-plate', 130],
    ['#atelier .craft-close-copy > *, #atelier .craft-close-title, #atelier .craft-cta', 90],
    ['.ncl-foot-grid > *', 70],
    ['.ncl-foot-base > *', 60],
    ['.ach-hero > *', 90],
    ['.ach-note > *', 90],
    ['.col-hero > *', 90],
    ['.col-family-head > *', 70]
  ]

  var targets = []
  GROUPS.forEach(function (group) {
    var nodes = document.querySelectorAll(group[0])
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      if (el.classList.contains('rise')) continue
      el.classList.add('rise')
      var delay = Math.min(group[1] * i, 480)
      el.style.setProperty('--rd', delay + 'ms')
      targets.push(el)
    }
  })
  if (!targets.length) return

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-in')
      io.unobserve(entry.target)
    })
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 })

  /* wait for a painted frame first: the browser otherwise applies `.rise` and `.is-in`
     in the same style pass for anything already on screen, so the hero popped in with
     no transition at all */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      targets.forEach(function (el) { io.observe(el) })
    })
  })

  /* anything already on screen when the page settles should not wait */
  window.addEventListener('load', function () {
    targets.forEach(function (el) {
      var r = el.getBoundingClientRect()
      if (r.top < window.innerHeight * 0.92) el.classList.add('is-in')
    })
  })
})()
