/* 8KPRIME i18n engine
   - Translations baked into window.__I18N__ (see vite.config.js) keyed by the
     ENGLISH source text, so the HTML needs no per-string markup.
   - Detects language: saved choice -> browser language -> English.
   - Builds a CUSTOM language dropdown (matches the site design) inside every
     [data-lang-switch]. Sets <html lang> + dir="rtl" for Arabic.
*/
(function () {
  var LANGS = ['en', 'de', 'fr', 'es', 'ar']
  var NAMES = { en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', ar: 'العربية' }
  var I18N = window.__I18N__ || {}

  // ── Text translation ───────────────────────────────────────────────────
  var EXCLUDE_TAG = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1 }
  var EXCLUDE_CLASS = ['film-name', 'amt', 'amt-val', 'billed', 'sglow', 'stars', 'lang-switch', 'lang-btn', 'lang-menu']

  function excluded(node) {
    var el = node.parentElement
    while (el) {
      if (EXCLUDE_TAG[el.tagName]) return true
      if (el.getAttribute && el.getAttribute('data-no-i18n') != null) return true
      if (el.classList) {
        for (var i = 0; i < EXCLUDE_CLASS.length; i++) {
          if (el.classList.contains(EXCLUDE_CLASS[i])) return true
        }
      }
      el = el.parentElement
    }
    return false
  }

  var nodes = []
  function collect() {
    nodes = []
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)
    var n
    while ((n = w.nextNode())) {
      var raw = n.nodeValue || ''
      var key = raw.replace(/\s+/g, ' ').trim()
      if (key.length < 2) continue
      if (!/[A-Za-zÀ-ɏ]/.test(key)) continue
      if (excluded(n)) continue
      nodes.push({ node: n, raw: raw, key: key })
    }
  }

  function translate(lang) {
    var dict = lang !== 'en' && I18N[lang] ? I18N[lang] : null
    for (var i = 0; i < nodes.length; i++) {
      var e = nodes[i]
      var t = dict && Object.prototype.hasOwnProperty.call(dict, e.key) ? dict[e.key] : null
      e.node.nodeValue = t != null ? t : e.raw
      // Keep the glitch effect's duplicated layers (content: attr(data-t)) in sync.
      var p = e.node.parentElement
      if (p && p.hasAttribute('data-t')) p.setAttribute('data-t', t != null ? t : e.key)
    }
  }

  // Rebuild every [data-wa] WhatsApp link with the message translated to the
  // current language (re-runs on language switch so the prefilled text updates).
  function wireWhatsapp(lang) {
    var dict = lang !== 'en' && I18N[lang] ? I18N[lang] : null
    var idn = (window.__CONTENT__ && window.__CONTENT__.identity) || {}
    var num = String(idn.whatsapp || '').replace(/\D/g, '')
    if (!num) return
    var els = document.querySelectorAll('[data-wa]')
    for (var i = 0; i < els.length; i++) {
      var el = els[i]
      var key = el.getAttribute('data-wa-text') || ''
      var msg = dict && Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key
      el.setAttribute('href', 'https://wa.me/' + num + (msg ? '?text=' + encodeURIComponent(msg) : ''))
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noopener')
    }
  }

  // ── Custom dropdown ────────────────────────────────────────────────────
  var switches = []

  function closeAll() {
    for (var i = 0; i < switches.length; i++) {
      switches[i].host.classList.remove('open')
      switches[i].btn.setAttribute('aria-expanded', 'false')
    }
  }

  function toggle(host) {
    var wasOpen = host.classList.contains('open')
    closeAll()
    if (!wasOpen) {
      var r = host.getBoundingClientRect()
      host.classList.toggle('up', window.innerHeight - r.bottom < 260)
      host.classList.add('open')
      host.querySelector('.lang-btn').setAttribute('aria-expanded', 'true')
    }
  }

  function buildSwitches() {
    var hosts = document.querySelectorAll('[data-lang-switch]')
    for (var h = 0; h < hosts.length; h++) {
      var host = hosts[h]
      if (host.getAttribute('data-built')) continue
      host.setAttribute('data-built', '1')
      host.classList.add('lang-switch')

      var btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'lang-btn'
      btn.setAttribute('aria-haspopup', 'listbox')
      btn.setAttribute('aria-expanded', 'false')
      var cur = document.createElement('span')
      cur.className = 'lang-cur'
      cur.textContent = 'EN'
      var car = document.createElement('span')
      car.className = 'lang-caret'
      car.textContent = '▾'
      btn.appendChild(cur)
      btn.appendChild(car)

      var menu = document.createElement('ul')
      menu.className = 'lang-menu'
      menu.setAttribute('role', 'listbox')
      for (var i = 0; i < LANGS.length; i++) {
        ;(function (code) {
          var li = document.createElement('li')
          li.setAttribute('role', 'option')
          li.setAttribute('data-lang', code)
          var name = document.createElement('span')
          name.textContent = NAMES[code]
          var c = document.createElement('span')
          c.className = 'code'
          c.textContent = code.toUpperCase()
          li.appendChild(name)
          li.appendChild(c)
          li.addEventListener('click', function (ev) {
            ev.stopPropagation()
            setLang(code)
            closeAll()
          })
          menu.appendChild(li)
        })(LANGS[i])
      }

      btn.addEventListener('click', function (ev) {
        ev.stopPropagation()
        toggle(this.parentNode)
      })

      host.appendChild(btn)
      host.appendChild(menu)
      switches.push({ host: host, btn: btn, cur: cur, menu: menu })
    }
    document.addEventListener('click', closeAll)
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll()
    })
  }

  function updateSwitches(lang) {
    for (var i = 0; i < switches.length; i++) {
      switches[i].cur.textContent = lang.toUpperCase()
      var lis = switches[i].menu.querySelectorAll('li')
      for (var j = 0; j < lis.length; j++) {
        lis[j].classList.toggle('active', lis[j].getAttribute('data-lang') === lang)
      }
    }
  }

  // ── Apply / detect ─────────────────────────────────────────────────────
  function apply(lang) {
    translate(lang)
    wireWhatsapp(lang)
    document.documentElement.setAttribute('lang', lang)
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
    updateSwitches(lang)
  }

  function setLang(lang) {
    try { localStorage.setItem('lang', lang) } catch (e) {}
    apply(lang)
  }

  function detect() {
    try {
      var saved = localStorage.getItem('lang')
      if (saved && LANGS.indexOf(saved) >= 0) return saved
    } catch (e) {}
    var navs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']
    for (var i = 0; i < navs.length; i++) {
      var code = String(navs[i] || '').toLowerCase().slice(0, 2)
      if (LANGS.indexOf(code) >= 0) return code
    }
    return 'en'
  }

  function init() {
    collect()
    buildSwitches()
    apply(detect())
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
