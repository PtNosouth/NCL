/* the static achievements wall: plates sharpen in, columns stop on hover, meter fills */
(function () {
  'use strict'

  var wall = document.querySelector('.ach-wall')
  if (!wall) return

  /* ── loading: each plate sharpens in, and the meter counts how many have arrived ── */
  var imgs = [].slice.call(document.querySelectorAll('.ach-item img'))
  var total = imgs.length
  var seen = Object.create(null)
  var meter = document.querySelector('.ach-meter i')
  var loaded = 0

  function count(img) {
    if (seen[img.getAttribute('src')]) return
    seen[img.getAttribute('src')] = true
    loaded++
    if (meter) meter.style.transform = 'scaleX(' + (loaded / total).toFixed(3) + ')'
  }

  imgs.forEach(function (img) {
    function done() {
      img.classList.add('is-in')
      count(img)
    }
    if (img.complete && img.naturalWidth) done()
    else img.addEventListener('load', done, { once: true })
    img.addEventListener('error', done, { once: true })
  })

  /* ── pause and lift ── */
  wall.addEventListener('pointerover', function (e) {
    var fig = e.target.closest('.ach-item')
    if (!fig) return
    wall.classList.add('is-paused')
    ;[].forEach.call(wall.querySelectorAll('.ach-item.is-up'), function (n) {
      if (n !== fig) n.classList.remove('is-up')
    })
    fig.classList.add('is-up')
  })

  wall.addEventListener('pointerout', function (e) {
    var fig = e.target.closest('.ach-item')
    if (!fig) return
    fig.classList.remove('is-up')
    if (!wall.querySelector('.ach-item:hover')) wall.classList.remove('is-paused')
  })
})()
