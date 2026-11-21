/* Content from the API, painted into the pages that were built for it.
 *
 * The mark-up keeps its original class names, so every behaviour script
 * (collection.js / main.js / achievements.js) still finds exactly the DOM it expects --
 * they simply run *after* this file has replaced the dynamic regions. If the request
 * fails the page keeps the static content it shipped with, so the site never blanks.
 *
 * `data-page` on <body> picks what to hydrate.
 */
(function () {
  'use strict'

  var page = document.body.getAttribute('data-page') || 'index'
  var PAGES = { index: 'main.js', collection: 'collection.js', achievements: 'achievements.js' }

  var el = function (tag, attrs) {
    var node = document.createElement(tag)
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, attrs[k])
    return node
  }
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    })
  }


  /* A hash link only works on the page that carries the target. The footer is shared, so
     "#atelier" and "#bespoke" were dead clicks on the products and patents pages: point
     them at the home page instead. "#top" gets a local target so it scrolls, not jumps. */
  function fixAnchors(root) {
    if (!document.body.id) document.body.id = 'top'
    ;[].forEach.call((root || document).querySelectorAll('a[href^="#"]'), function (a) {
      var href = a.getAttribute('href') || ''
      if (href.length < 2) return
      var id = href.slice(1)
      if (document.getElementById(id)) return
      a.setAttribute('href', 'index.html' + href)
    })
  }

  /* ── the cover ───────────────────────────────────────────────────────── */
  function renderCover(data) {
    var c = data.cover
    if (!c) return
    window.NCL_COVER = c

    var title = document.querySelector('.hero-title')
    if (title && c.titleLines && c.titleLines.length) {
      /* titleLines are authored by the site owner and may carry <em> for the brass word */
      title.innerHTML = c.titleLines.map(function (line) {
        return '<span class="line"><span>' + line + '</span></span>'
      }).join('')
    }
    var sub = document.querySelector('.hero-sub')
    if (sub && c.sub) sub.textContent = c.sub
    var kicker = document.querySelector('.hero-kicker')
    if (kicker && c.eyebrow) {
      var span = kicker.querySelector('span') || kicker
      span.textContent = c.eyebrow
    }
    var cta = document.querySelector('.cta')
    if (cta && c.cta) {
      var label = cta.querySelector('span')
      if (label) label.textContent = c.cta; else cta.firstChild.nodeValue = c.cta + ' '
    }
  }

  /* ── the commission cards ────────────────────────────────────────────── */
  function renderProjects(data) {
    if (!data.projects || !data.projects.length) return
    window.NCL_PROJECTS = data.projects
    var stage = document.getElementById('deck-stage')
    if (!stage) return
    for (var i = stage.children.length - 1; i >= 0; i--) {
      if (stage.children[i].classList && stage.children[i].classList.contains('sheet')) stage.removeChild(stage.children[i])
    }
    data.projects.forEach(function (p, i) {
      var fig = el('figure', { class: 'sheet', 'data-i': String(i) })
      var img = el('img', {
        src: p.image, alt: p.alt || '', width: '1400', height: '1750',
        /* only the card that is on screen at first paint is eager */
        loading: i === 0 ? 'eager' : 'lazy', decoding: 'async',
      })
      fig.appendChild(img)
      stage.appendChild(fig)
    })
  }

  /* ── the product families ────────────────────────────────────────────── */
  function renderProducts(data) {
    if (!data.groups || !data.groups.length) return
    var rail = document.querySelector('.col-rail-links')
    var main = document.getElementById('col-main')
    if (!main) return

    /* a product can carry several group tags: it is listed under each of them */
    var byGroup = {}
    data.products.forEach(function (p) {
      var ids = (p.groupIds && p.groupIds.length) ? p.groupIds : (p.groupId ? [p.groupId] : [])
      ids.forEach(function (id) { (byGroup[id] = byGroup[id] || []).push(p) })
    })

    if (rail) {
      rail.innerHTML = ''
      data.groups.forEach(function (g, i) {
        var a = el('a', { href: '#' + g.anchor, 'data-family': g.id })
        if (i === 0) a.className = 'is-on'
        a.innerHTML = esc(g.title) + '<i>' + (byGroup[g.id] || []).length + '</i>'
        rail.appendChild(a)
      })
    }

    main.innerHTML = ''
    data.groups.forEach(function (g, i) {
      var items = byGroup[g.id] || []
      var sec = el('section', {
        class: 'col-family' + (i === 0 ? ' is-on' : ''),
        id: g.anchor,
        'data-family': g.id,
      })
      if (i > 0) sec.hidden = true

      var head = el('header', { class: 'col-family-head' })
      var h2 = el('h2', { class: 'col-family-title', id: g.anchor + '-title' })
      h2.innerHTML = esc(g.title) + '<span>' + items.length + '</span>'
      head.appendChild(h2)
      if (g.note) {
        var note = el('p', { class: 'col-family-note' })
        note.textContent = g.note
        head.appendChild(note)
      }
      sec.appendChild(head)

      var grid = el('div', { class: 'col-grid' })
      items.forEach(function (p, idx) {
        var btn = el('button', {
          class: 'plate rev', type: 'button', 'data-i': String(idx),
          'data-family': g.title, 'data-model': p.model, 'data-spec': p.spec,
          'data-img': p.image, 'aria-label': p.alt || (g.title + ' ' + p.model + ' ' + p.spec),
        })
        btn.innerHTML =
          '<span class="plate-media"><img src="' + esc(p.image) + '" alt="' + esc(p.alt || '') +
          '" width="900" height="1125" loading="lazy" decoding="async"></span>' +
          '<span class="plate-cap"><span class="plate-model">' + esc(p.model) + '</span>' +
          '<span class="plate-spec">' + esc(p.spec) + '</span></span>'
        grid.appendChild(btn)
      })
      sec.appendChild(grid)
      main.appendChild(sec)
    })
  }


  /* ── the craft section ───────────────────────────────────────────────── */
  var CTA_ARROW = '<svg viewBox="0 0 24 12" aria-hidden="true"><path d="M0 6h21M16 1l5 5-5 5"/></svg>'

  function mediaBlock(src, alt, parallax, wide) {
    var cls = 'craft-media px-frame' + (wide ? ' craft-media-wide' : '')
    var div = el('div', { class: cls })
    div.innerHTML = '<img class="px" data-px="' + (parallax || 0.16).toFixed(2) + '" src="' + esc(src) +
      '" alt="' + esc(alt || '') + '" loading="lazy" decoding="async">'
    return div
  }

  function noteBlock(label, titleLines, body) {
    var div = el('div', { class: 'craft-note' })
    div.innerHTML =
      '<p class="mono">' + esc(label) + '</p>' +
      '<h3>' + (titleLines || []).map(esc).join('<br>') + '</h3>' +
      '<p class="craft-body">' + esc(body) + '</p>'
    return div
  }

  function renderCraft(data) {
    var c = data.craft
    var section = document.getElementById('atelier')
    if (!c || !section || !c.title || !c.title.length) return
    window.NCL_CRAFT = c

    var intro = section.querySelector('.craft-intro')
    if (intro && c.eyebrow) {
      intro.innerHTML =
        '<p class="eyebrow"><span>' + esc(c.eyebrow.lead) + '</span> <i aria-hidden="true"></i> ' +
        '<span>' + esc(c.eyebrow.items) + '</span></p>' +
        '<h2 class="craft-title" id="craft-title">' + c.title.map(esc).join('<br>') + '</h2>'
    }

    ;[].forEach.call(section.querySelectorAll('.craft-plate, .craft-close'), function (n) { n.remove() })

    ;(c.plates || []).forEach(function (p, i) {
      var wrap = el('div', { class: 'craft-plate craft-plate-' + (i === 0 ? 'a' : 'b') })
      var media = mediaBlock(p.image, p.alt, p.parallax, false)
      var note = noteBlock(p.label, p.title, p.body)
      if (p.layout === 'media-right') wrap.append(note, media)
      else wrap.append(media, note)
      section.appendChild(wrap)
    })

    var close = c.close
    if (close) {
      var box = el('div', { class: 'craft-close' })
      box.appendChild(mediaBlock(close.image, close.alt, close.parallax, true))
      var copy = el('div', { class: 'craft-close-copy' })
      copy.innerHTML =
        '<p class="mono">' + esc(close.label) + '</p>' +
        '<h3 class="craft-close-title">' + (close.title || []).map(esc).join('<br>') + '</h3>' +
        '<p class="craft-body">' + esc(close.body) + '</p>' +
        '<p class="craft-cta"><a class="cta" href="' + esc((close.cta || {}).href || '#enquire') + '">' +
        '<span>' + esc((close.cta || {}).label || '') + '</span>' + CTA_ARROW + '</a></p>'
      box.appendChild(copy)
      section.appendChild(box)
    }
  }

  /* ── the footer ──────────────────────────────────────────────────────── */
  /* brand icons for the social links: fixed assets, so they travel with the page */
  var SOCIAL_ICONS = {
    "facebook": "<svg viewBox=\"0 0 24 24\" role=\"img\" aria-hidden=\"true\"><path d=\"M14.2 8.1h2.3V4.9c-.4-.06-1.5-.17-2.8-.17-2.8 0-4.6 1.6-4.6 4.6v2.6H6.5v3.6h2.6V23h3.7v-7.4h2.7l.4-3.6h-3.1V9.4c0-1 .3-1.3 1.4-1.3Z\" fill=\"currentColor\" stroke=\"none\"/></svg>",
    "whatsapp": "<svg viewBox=\"0 0 24 24\" role=\"img\" aria-hidden=\"true\"><path d=\"M20.5 11.6a8.4 8.4 0 0 1-12.4 7.4L3.5 20.4l1.4-4.5A8.4 8.4 0 1 1 20.5 11.6Z\"/><path d=\"M9.2 8.4c.2-.4.4-.4.7-.4h.5c.2 0 .3.1.5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.2-.1.3 0 .5.3.6.9 1.3 1.6 1.7.2.1.4.1.5 0l.6-.6c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.3.3.5 0 .8-.6 1.6-1.3 1.8-.7.2-1.6.1-2.9-.5-1.7-.8-3-2.2-3.6-3.6-.5-1.2-.5-2.3 0-3.1Z\"/></svg>",
    "instagram": "<svg viewBox=\"0 0 24 24\" role=\"img\" aria-hidden=\"true\"><rect x=\"3.5\" y=\"3.5\" width=\"17\" height=\"17\" rx=\"5\"/><circle cx=\"12\" cy=\"12\" r=\"4.2\"/><circle cx=\"17.2\" cy=\"6.9\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/></svg>",
    "douyin": "<svg viewBox=\"0 0 24 24\" role=\"img\" aria-hidden=\"true\"><path d=\"M14.4 3.4c.5 1.9 1.9 3.3 3.9 3.5v3.4c-1.4 0-2.7-.4-3.9-1.2v6.5c0 3.3-2.4 5.2-5.1 5.2-2.9 0-5.1-2-5.1-4.8 0-2.9 2.2-5 5.1-5 .4 0 .8 0 1.2.1v3.5c-.4-.1-.8-.2-1.2-.2-1.1 0-1.9.7-1.9 1.6 0 1 .8 1.7 1.9 1.7 1.2 0 1.9-.8 1.9-2.1V3.4h3.2Z\" fill=\"currentColor\" stroke=\"none\"/></svg>"
  }

  function socialIcon(kind) {
    var map = window.NCL_SOCIAL_ICONS || (window.NCL_SOCIAL_ICONS = {})
    return SOCIAL_ICONS[kind] || map[kind] || ''
  }

  function renderFooter(data) {
    var f = data.footer
    var foot = document.querySelector('.ncl-foot')
    var grid = foot && foot.querySelector('.ncl-foot-grid')
    if (!f || !grid) return

    /* lift the social svgs out of the shipped markup before it is replaced */
    ;[].forEach.call(document.querySelectorAll('.ncl-social li a'), function (a) {
      var aria = (a.getAttribute('aria-label') || '').toLowerCase()
      var href = (a.getAttribute('href') || '').toLowerCase()
      var kind = aria.indexOf('facebook') >= 0 || href.indexOf('facebook.com') >= 0 ? 'facebook'
        : aria.indexOf('whatsapp') >= 0 || href.indexOf('wa.me') >= 0 ? 'whatsapp'
        : aria.indexOf('instagram') >= 0 || href.indexOf('instagram.com') >= 0 ? 'instagram'
        : aria.indexOf('douyin') >= 0 || aria.indexOf('tiktok') >= 0 || href.indexOf('douyin.com') >= 0 ? 'douyin' : null
      if (kind) socialIcon(kind) || (window.NCL_SOCIAL_ICONS[kind] = a.innerHTML)
    })

    grid.innerHTML = ''
    ;(f.columns || []).forEach(function (col, i) {
      var div = el('div', col.lines ? { class: 'ncl-foot-addr' } : {})
      var heading = el('h4', i === 0 ? { class: 'brand-ish' } : {})
      heading.textContent = i === 0 ? (f.brand || col.title || '') : (col.title || '')
      div.appendChild(heading)

      if (col.lines) {
        col.lines.forEach(function (line) {
          var p = el('p'); p.textContent = line; div.appendChild(p)
        })
      } else if (col.socials) {
        var ul = el('ul', { class: 'ncl-social' })
        col.socials.forEach(function (s) {
          var li = el('li')
          var a = el('a', {
            href: s.href || '#',
            'aria-label': s.aria || s.name || s.kind,
            title: s.name || '',
            target: '_blank', rel: 'noopener noreferrer',
          })
          a.innerHTML = socialIcon(s.kind) || esc(s.aria || s.kind)
          li.appendChild(a); ul.appendChild(li)
        })
        div.appendChild(ul)
      } else {
        var list = el('ul')
        ;(col.links || []).forEach(function (l) {
          var li = el('li')
          var a = el('a', { href: l.href || '#' })
          a.textContent = l.label
          li.appendChild(a); list.appendChild(li)
        })
        div.appendChild(list)
      }
      grid.appendChild(div)
    })

    var baseBox = foot.querySelector('.ncl-foot-base')
    if (baseBox && f.base) {
      baseBox.innerHTML = ''
      f.base.forEach(function (b) {
        var p = el('p')
        if (b.href) {
          var a = el('a', { href: b.href }); a.textContent = b.text; p.appendChild(a)
        } else p.textContent = b.text
        baseBox.appendChild(p)
      })
    }
  }
  /* ── the patent wall ─────────────────────────────────────────────────── */
  function renderPatents(data) {
    if (!data.patents || !data.patents.length) return
    var cols = [].slice.call(document.querySelectorAll('.ach-col'))
    if (!cols.length) return
    cols.forEach(function (c) { var run = c.querySelector('.ach-colrun'); if (run) run.innerHTML = '' })

    data.patents.forEach(function (d, i) {
      var col = cols[i % cols.length]
      var run = col.querySelector('.ach-colrun') || col
      var fig = el('figure', { class: 'ach-item ach-item--certificate' })
      fig.innerHTML =
        '<span class="ach-skel" aria-hidden="true"></span>' +
        '<img src="' + esc(d.image) + '" alt="' + esc(d.alt || '') + '" loading="lazy" decoding="async">' +
        '<figcaption><span class="ach-title">' + esc(d.title || '') + '</span>' +
        '<span class="ach-meta">' + esc(d.meta || '') + '</span></figcaption>'
      run.appendChild(fig)
    })
  }

  var RENDER = {
    index: function (data) { renderCover(data); renderProjects(data); renderCraft(data); renderFooter(data) },
    collection: function (data) { renderProducts(data); renderFooter(data) },
    achievements: function (data) { renderPatents(data); renderFooter(data) },
  }

  function loadScript(src, done) {
    var s = document.createElement('script')
    s.src = src
    s.onload = done || function () {}
    s.onerror = function () { console.warn('failed to load', src) }
    document.body.appendChild(s)
  }

  /* The admin's 扉页 preview loads this page as /?preview=1 and leaves the unsaved draft
     in sessionStorage (same origin), so the cover can be seen with real styles and film
     before anything is written. */
  function applyPreview(data) {
    if (!data || !/preview=1/.test(location.search)) return data
    try {
      var raw = sessionStorage.getItem('ncl-cover-draft')
      if (!raw) return data
      var draft = JSON.parse(raw)
      var copy = JSON.parse(JSON.stringify(data))
      copy.cover = Object.assign({}, copy.cover, draft, {
        video: Object.assign({}, copy.cover.video, draft.video || {}),
      })
      return copy
    } catch (e) {
      return data
    }
  }

  function boot() {
    var started = false
    var run = function (data) {
      data = applyPreview(data)
      if (started) return
      started = true
      if (data) {
        try { (RENDER[page] || function () {})(data) } catch (e) { console.warn('render failed', e) }
      }
      /* the translator caches per node: re-run it over the freshly painted content */
      if (typeof window.NCLreapplyLang === 'function') window.NCLreapplyLang()
      fixAnchors(document)
      var next = PAGES[page]
      if (!next) return
      if (page === 'index') loadScript(next, function () { loadScript('intro.js') })
      else loadScript(next)
    }

    /* /api/site.js has already run by now: hydrate straight away, then load the page
       script. The fetch below is only for the case where that script failed. */
    if (window.NCL_SITE_DATA) { run(window.NCL_SITE_DATA); return }

    var timer = setTimeout(function () { run(null) }, 6000)
    fetch('/api/site', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null })
      .then(function (data) { clearTimeout(timer); run(data) })
      .catch(function () { clearTimeout(timer); run(null) })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
