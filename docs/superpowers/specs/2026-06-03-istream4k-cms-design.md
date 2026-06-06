# FLIXTV4K — CMS Content Management Design

**Date:** 2026-06-03
**Status:** Approved, implementing

## Goal

Let the site owner edit content without touching code: FAQs, movie/sports posters
(images), website identity (name, titles, favicon, WhatsApp number, email), and plan
prices — via a `/admin` panel. Edits commit to GitHub and auto-rebuild on Vercel.

## Approach (chosen)

Git-based CMS (**Sveltia CMS**) on top of the existing Vite multi-page static site.
Content lives as JSON in `src/content/`. Editable sections render from that data.
Saving in `/admin` commits JSON/images to GitHub → Vercel rebuilds (~30–60s) → live.

Rejected: live admin + database (more infra than needed); hand-edited config files
(no UI). Trade-off accepted: edits are not instant (rebuild delay); images committed
to repo.

## Content model (`src/content/`)

- **identity.json** — `siteName`, `landingTagline`, `favicon` (path), `whatsapp`
  (digits only, e.g. `15551234567`), `email`.
- **faqs.json** — `[{ question, answer }]` (answer may contain inline HTML).
- **movies.json** — `[{ title, image }]`.
- **sports.json** — `[{ title, image }]`.
- **plans.json** —
  - `deviceLabel`, `noticeText`
  - `durations`: `[{ months, name, billed, recommended:bool, tier:"normal|save", freeText }]`
    (4 entries: 3/6/12/24)
  - `tiers`: `[{ devices:1..5, prices:{ "3":n,"6":n,"12":n,"24":n } }]` (5 entries → 20 prices)

## Rendering (`src/site.js`, module loaded by every page)

On load, imports the JSON (Vite bundles it at build) and:
1. **Identity** — set `document.title` (per-page base + siteName), favicon `<link>`,
   meta; rewrite every WhatsApp button `href` → `https://wa.me/<whatsapp>`; rewrite
   email `mailto:` links.
2. **FAQ** — build the `#faq` accordion `<details>` items + single-open behavior.
3. **Posters** — build `#movies` and `#sports` grids (replaces the current inline arrays).
4. **Plans** — build the price cards from `plans.json`; device selector (1–5) reads
   `tiers[deviceCount].prices[months]` for monthly price; total = monthly × months.
   Replaces the current auto-formula (`base + (devices-1)*STEP`).

Hardcoded content in those sections is replaced with empty containers + data attributes.
All existing CSS class names and DOM shapes are reproduced exactly → **no visual change**.
Static fallbacks (e.g. `<title>`) remain in HTML so the page degrades gracefully.

## Admin (`public/admin/`)

- `index.html` — loads Sveltia CMS from CDN.
- `config.yml` — GitHub backend; file/list collections mapping to the JSON above;
  media folders: movies → `public/assets/posters`, sports → `public/assets/sports`,
  favicon/uploads → `public/assets`. Placeholders `__GITHUB_REPO__` and `__SITE_URL__`
  filled during setup.

## Auth (Vercel serverless functions)

- `api/auth.js` — redirects to GitHub OAuth authorize (scope `repo`).
- `api/callback.js` — exchanges code → token, posts it back to the CMS popup via the
  Decap `authorization:github:success:<json>` postMessage protocol.
- Env vars: `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`.
- No password to manage; access = GitHub repo collaborators.

## One-time owner setup (documented in SETUP-CMS.md)

1. Create GitHub repo, push project.
2. Import repo on Vercel (auto-deploy on push).
3. Create a GitHub OAuth App (Authorization callback URL = `https://<site>/api/callback`);
   put client id/secret in Vercel env vars.
4. Replace `__GITHUB_REPO__` / `__SITE_URL__` in `config.yml`.

## Out of scope

- Real-time (no-rebuild) editing. - Multi-user roles beyond GitHub collaborators.
- Editing arbitrary page layout/copy (only the 5 collections above).
