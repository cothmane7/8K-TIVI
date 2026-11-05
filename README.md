# 8KPRIME

Static streaming landing site, wrapped in [Vite](https://vitejs.dev) as a multi-page
build so it deploys cleanly on Vercel.

## Structure

```
index.html          Landing page (hi-fi)
channels.html       Channels page
resellers.html      Resellers page
support.html        Support page
src/content/        CMS-managed content (identity, faqs, movies, sports, plans) as JSON
public/admin/       Content admin UI (Sveltia CMS) — served at /admin
api/                GitHub OAuth functions for the CMS login (auth, callback)
public/assets/      All media + site.css (served from the site root, e.g. /assets/...)
vite.config.js      Multi-page build + content-injection plugin
vercel.json         Vercel framework + output settings
design-source/      Original wireframes, uploads, dev tweaks panel (NOT deployed)
```

## Editing content (no code)

FAQs, posters, site identity (name/favicon/WhatsApp/email), and the plan price
table are editable from a `/admin` panel. Edits commit to GitHub and auto-rebuild
on Vercel. **One-time setup is in [SETUP-CMS.md](SETUP-CMS.md).**

The editable content lives as JSON in `src/content/`. A Vite plugin
(`vite.config.js`) bakes it into every page at build time, so the pages stay fast
static HTML with no runtime data fetching.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build

```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build locally
```

## Deploy to Vercel

### Option A — Vercel CLI (fastest)

```bash
npx vercel login   # one-time: authenticate in your browser
npx vercel --prod  # build + deploy to production
```

When prompted, accept the detected settings (Framework: **Vite**, Build: `vite build`,
Output: `dist`).

### Option B — Git + Vercel dashboard

1. Push this repo to GitHub/GitLab/Bitbucket.
2. Go to https://vercel.com/new and import the repo.
3. Vercel auto-detects Vite — keep the defaults and click **Deploy**.

No environment variables are required.
