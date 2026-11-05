import { defineConfig } from 'vite'
import { readFileSync, existsSync } from 'node:fs'

// Dev-only: mirror Vercel's cleanUrls so extensionless links (e.g. /checkout)
// resolve to the matching .html file during `npm run dev`. Production handles
// this via "cleanUrls": true in vercel.json.
function cleanUrlsDev() {
  return {
    name: 'clean-urls-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const i = req.url.indexOf('?')
        const path = i === -1 ? req.url : req.url.slice(0, i)
        const query = i === -1 ? '' : req.url.slice(i)
        if (path !== '/' && !/\.[a-z0-9]+$/i.test(path)) {
          const file = path.replace(/^\/+/, '').replace(/\/+$/, '') + '.html'
          if (existsSync(file)) req.url = '/' + file + query
        }
        next()
      })
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Content injection
// Reads the CMS-managed JSON in src/content/ and bakes it into every page at
// build time as `window.__CONTENT__`. Also sets per-page <title>, favicon, and
// injects a small runtime that wires WhatsApp/email links + builds the FAQ
// accordion from the data. This is what makes the site editable via /admin:
// the CMS commits these JSON files, Vercel rebuilds, new content goes live.
// ─────────────────────────────────────────────────────────────────────────

function readContent() {
  const read = (f) =>
    JSON.parse(readFileSync(new URL('./src/content/' + f, import.meta.url), 'utf8'))
  return {
    identity: read('identity.json'),
    faqs: read('faqs.json'),
    movies: read('movies.json'),
    sports: read('sports.json'),
    plans: read('plans.json'),
    resellers: read('resellers.json'),
  }
}

// Reads the translation dictionaries (English source text -> translated text).
// Missing files are skipped so the build still works while locales are added.
function readLocales() {
  const out = {}
  for (const l of ['de', 'fr', 'es', 'ar']) {
    try {
      out[l] = JSON.parse(readFileSync(new URL('./src/locales/' + l + '.json', import.meta.url), 'utf8'))
    } catch (e) {
      /* locale not present yet */
    }
  }
  return out
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Runtime that runs on EVERY page (identity links + FAQ accordion).
const RUNTIME = `<script>(function(){
  var C = window.__CONTENT__ || {}, id = C.identity || {};
  if (id.whatsapp) {
    var num = String(id.whatsapp).replace(/\\D/g, '');
    if (num) {
      var wa = 'https://wa.me/' + num;
      document.querySelectorAll('[data-wa]').forEach(function(a){
        var msg = a.getAttribute('data-wa-text');
        a.setAttribute('href', wa + (msg ? '?text=' + encodeURIComponent(msg) : ''));
        a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener');
      });
    }
  }
  if (id.email) {
    document.querySelectorAll('[data-email]').forEach(function(a){ a.setAttribute('href', 'mailto:' + id.email); });
    document.querySelectorAll('[data-email-text]').forEach(function(el){ el.textContent = id.email; });
  }
  var faqs = (C.faqs && C.faqs.items) || [];
  document.querySelectorAll('.faq[data-faq="auto"]').forEach(function(container){
    faqs.forEach(function(item, i){
      var d = document.createElement('details');
      if (i === 0) d.open = true;
      var s = document.createElement('summary'); s.textContent = item.question;
      var ans = document.createElement('div'); ans.className = 'answer'; ans.innerHTML = item.answer;
      d.appendChild(s); d.appendChild(ans); container.appendChild(d);
    });
    container.querySelectorAll('details').forEach(function(d){
      d.addEventListener('toggle', function(){
        if (d.open) container.querySelectorAll('details').forEach(function(o){ if (o !== d) o.open = false; });
      });
    });
  });

  // Reseller credit packages (resellers page) built from CMS content.
  var pkGrid = document.querySelector('[data-packages]');
  if (pkGrid) {
    var pkgs = (C.resellers && C.resellers.packages) || [];
    var pkHtml = '';
    pkgs.forEach(function(p, i){
      var per = (+p.perCredit).toFixed(2);
      var total = Math.round((+p.credits) * (+p.perCredit) * 100) / 100;
      var feats = (p.features || []).map(function(f){ return '<li>' + f + '</li>'; }).join('');
      pkHtml += '<div class="pk brk' + (p.popular ? ' hot' : '') + '">' +
        '<i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i>' +
        ((p.popular && p.tag) ? '<div class="pk-tag">' + p.tag + '</div>' : '') +
        '<div class="pk-name">' + p.name + '</div>' +
        '<div class="pk-credits">' + p.credits + '<small> credits</small></div>' +
        '<div class="pk-per">$' + per + ' / credit</div>' +
        '<div class="pk-total">$' + total + ' total</div>' +
        '<ul class="pk-feat">' + feats + '</ul>' +
        (p.popular ? '<a href="/checkout?type=reseller&pkg=' + i + '" class="cpb w-full">Get started</a>' : '<a href="/checkout?type=reseller&pkg=' + i + '" class="cpb outline w-full"><span style="flex:1;justify-content:center">Get started</span></a>') +
        '</div>';
    });
    pkGrid.innerHTML = pkHtml;
    // The cards just gave #packages real height — if we arrived at that anchor,
    // re-scroll now so it lands correctly in one click (not on a second click).
    if (location.hash === '#packages') {
      var pkSec = document.getElementById('packages');
      if (pkSec) requestAnimationFrame(function(){ pkSec.scrollIntoView(); });
    }
  }

  // Mobile nav: hamburger toggles the slide-down menu.
  function navClose(nav){ nav.classList.remove('open'); var b = nav.querySelector('.nav-toggle'); if (b) b.setAttribute('aria-expanded','false'); }
  document.querySelectorAll('.nav-toggle').forEach(function(btn){
    btn.addEventListener('click', function(ev){
      ev.stopPropagation();
      var nav = btn.closest('.nav'); if (!nav) return;
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  document.querySelectorAll('.nav .links a').forEach(function(a){
    a.addEventListener('click', function(){ var nav = a.closest('.nav'); if (nav) navClose(nav); });
  });
  document.addEventListener('click', function(ev){
    document.querySelectorAll('.nav.open').forEach(function(nav){ if (!nav.contains(ev.target)) navClose(nav); });
  });

  // Centre #movies / #sports in the viewport instead of top-aligning under the fixed nav.
  function centreTarget(id){
    var el = document.getElementById(id);
    if (!el) return;
    var nav = document.querySelector('.nav');
    var navH = nav ? nav.getBoundingClientRect().height : 0;
    var rect = el.getBoundingClientRect();
    var mid = rect.top + window.pageYOffset + rect.height / 2;
    // centre within the area BELOW the fixed nav, not the whole viewport
    window.scrollTo({ top: Math.max(0, mid - (window.innerHeight + navH) / 2), behavior: 'smooth' });
  }
  function isCentreHash(h){ return h === '#movies' || h === '#sports'; }
  document.addEventListener('click', function(ev){
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.charAt(0) === '#' && isCentreHash(href) && document.getElementById(href.slice(1))) {
      ev.preventDefault();
      if (history.replaceState) history.replaceState(null, '', href);
      centreTarget(href.slice(1));
    }
  });
  function centreFromHash(){ if (isCentreHash(location.hash)) { var id = location.hash.slice(1); setTimeout(function(){ centreTarget(id); }, 80); } }
  window.addEventListener('hashchange', centreFromHash);
  centreFromHash();

  // Section 6 "Every device": simple crossfade slider on mobile.
  // Fades through the 3 stacked device mockups one at a time and loops.
  (function(){
    var mq = window.matchMedia('(max-width: 680px)');
    var row = document.querySelector('#devices .row');
    if (!row) return;
    var items = Array.prototype.slice.call(row.children);
    if (items.length < 2) return;
    var on = false, timer = null, idx = 0;
    function show(i){ for (var k = 0; k < items.length; k++) items[k].classList.toggle('is-active', k === i); }
    function go(){ idx = (idx + 1) % items.length; show(idx); }
    function enable(){ if (on) return; on = true; idx = 0; show(0); timer = setInterval(go, 2600); }
    function disable(){
      if (!on) return; on = false;
      if (timer) { clearInterval(timer); timer = null; }
      for (var k = 0; k < items.length; k++) items[k].classList.remove('is-active');
    }
    function apply(){ if (mq.matches) enable(); else disable(); }
    apply();
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);
  })();
})();</script>`

// Google tag (gtag.js). Injected right after <head> on every page.
const GTAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18515121661"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'AW-18515121661');
</script>`

function contentInjection() {
  return {
    name: '8kprime-content-injection',
    transformIndexHtml(html, ctx) {
      const c = readContent()
      const id = c.identity
      const path = (ctx && ctx.path) || ''

      let title
      if (path.includes('plans')) title = id.siteName + ' — Plans'
      else if (path.includes('channels')) title = id.siteName + ' — Channels'
      else if (path.includes('resellers')) title = id.siteName + ' — Resellers'
      else if (path.includes('support')) title = id.siteName + ' — Support'
      else if (path.includes('checkout')) title = id.siteName + ' — Checkout'
      else if (path.includes('thankyou')) title = id.siteName + ' — Thank you'
      else if (path.includes('terms')) title = id.siteName + ' — Terms of Service'
      else if (path.includes('privacy')) title = id.siteName + ' — Privacy Policy'
      else if (path.includes('refund')) title = id.siteName + ' — Refund Policy'
      else title = id.siteName + (id.landingTagline ? ' — ' + id.landingTagline : '')

      // Use function replacements so '$' sequences in the injected content/runtime
      // (e.g. "$' " in built HTML strings) are NOT treated as $-replacement patterns.
      const titleTag = '<title>' + escapeHtml(title) + '</title>'
      html = html.replace(/<title>[\s\S]*?<\/title>/, () => titleTag)

      // Google tag — placed immediately after <head>, as high as possible.
      html = html.replace(/<head>/i, () => '<head>\n' + GTAG)

      let head = ''
      if (id.favicon) head += '<link rel="icon" href="' + id.favicon + '" />\n'
      head += '<link rel="stylesheet" href="/i18n.css" />\n'
      head += '<link rel="stylesheet" href="/responsive.css" />\n'
      const json = JSON.stringify(c).replace(/</g, '\\u003c')
      head += '<script>window.__CONTENT__=' + json + '</script>\n'
      const i18n = JSON.stringify(readLocales()).replace(/</g, '\\u003c')
      head += '<script>window.__I18N__=' + i18n + '</script>\n'

      html = html.replace('</head>', () => head + '</head>')
      html = html.replace('</body>', () => RUNTIME + '\n<script defer src="/i18n.js"></script>\n</body>')
      return html
    },
  }
}

export default defineConfig({
  appType: 'mpa',
  plugins: [cleanUrlsDev(), contentInjection()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        plans: 'plans.html',
        channels: 'channels.html',
        resellers: 'resellers.html',
        support: 'support.html',
        checkout: 'checkout.html',
        thankyou: 'thankyou.html',
        terms: 'terms.html',
        privacy: 'privacy.html',
        refund: 'refund.html',
      },
    },
  },
})
