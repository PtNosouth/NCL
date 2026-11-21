/* Drives the page shutter on the sub-pages (index.html has its own copy in main.js).

   Leaving: the leaves close over the page, then the browser navigates.
   Arriving: the page loads behind closed leaves, which then open.

   Same-origin `.html` links only; anything else is left to the browser. */
(function () {
  'use strict'

  if (window.__nclVeil) return          /* main.js already owns the veil here */
  var veil = document.getElementById('page-veil')
  if (!veil) return
  window.__nclVeil = true

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  var KEY = 'ncl:transition'

  if (!reduce.matches) {
    var arriving = false
    try {
      arriving = sessionStorage.getItem(KEY) === '1'
      sessionStorage.removeItem(KEY)
    } catch (e) {}
    if (arriving) {
      veil.classList.add('is-arriving')
      /* one frame with the leaves closed, then open them */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          veil.classList.add('is-lifting')
          window.setTimeout(function () {
            veil.classList.remove('is-arriving', 'is-lifting')
          }, 760)
        })
      })
    }
  }

  function isLocal(link) {
    if (!link || link.target || link.hasAttribute('download')) return false
    if (link.origin !== window.location.origin) return false
    if (!/\.html?($|[?#])/.test(link.getAttribute('href') || '')) return false
    return (link.getAttribute('href') || '').indexOf('#') !== 0
  }

  document.addEventListener('click', function (e) {
    var link = e.target && e.target.closest ? e.target.closest('a[href]') : null
    if (!isLocal(link) || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    if (reduce.matches) return

    e.preventDefault()
    try { sessionStorage.setItem(KEY, '1') } catch (err) {}
    veil.classList.add('is-leaving')
    var href = link.href
    window.setTimeout(function () { window.location.href = href }, 540)
  })
})()
