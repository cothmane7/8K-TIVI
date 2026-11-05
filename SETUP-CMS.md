# 8KPRIME — CMS setup (one-time)

Your site now has a content admin at **`/admin`**. You log in with GitHub, edit
content, hit save — your changes commit to GitHub and Vercel automatically rebuilds
the site (live in ~30–60 seconds).

You only do the setup below **once**. After that, editing is just: go to
`yoursite.com/admin` → log in → edit → Save.

---

## What you can edit in `/admin`

| Section | What it controls |
|---|---|
| **Site identity** | Website name, landing tagline, favicon, WhatsApp number, support email |
| **FAQs** | The questions/answers on the landing + support pages |
| **Movie posters** | The movie images + titles/ratings |
| **Sports posters** | The sports images + titles |
| **Plans & pricing** | The full price table — 5 device counts × 4 durations (3/6/12/24 mo) |

> The WhatsApp number wires up every "Choose plan" button and the support
> WhatsApp button to `wa.me/<number>`. Leave it blank and those buttons stay inert.

---

## Step 1 — Put the project on GitHub

1. Create a new repository at <https://github.com/new> (private is fine). Name it e.g. `flix4ktv`. **Do not** add a README/license (the project already has files).
2. From this project folder, push it:

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/flix4ktv.git
   git branch -M main
   git push -u origin main
   ```

   (Or use GitHub Desktop: "Add existing repository" → Publish.)

## Step 2 — Deploy on Vercel

1. Go to <https://vercel.com/new> and **import** the GitHub repo.
2. Vercel auto-detects **Vite** — keep defaults, click **Deploy**.
3. Note your live URL, e.g. `https://flix4ktv.vercel.app`. Every future push
   (including CMS edits) auto-deploys.

## Step 3 — Create a GitHub OAuth App (lets you log in to `/admin`)

1. Go to <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**.
2. Fill in:
   - **Application name:** `8KPRIME CMS`
   - **Homepage URL:** your site URL (e.g. `https://flix4ktv.vercel.app`)
   - **Authorization callback URL:** your site URL + `/api/callback`
     (e.g. `https://flix4ktv.vercel.app/api/callback`)
3. Click **Register application**. Copy the **Client ID**.
4. Click **Generate a new client secret**. Copy the secret (shown once).

## Step 4 — Add the secrets to Vercel

In your Vercel project → **Settings** → **Environment Variables**, add:

| Name | Value |
|---|---|
| `GITHUB_OAUTH_CLIENT_ID` | the Client ID from step 3 |
| `GITHUB_OAUTH_CLIENT_SECRET` | the client secret from step 3 |

Then **redeploy** (Deployments → ⋯ → Redeploy) so the variables take effect.

## Step 5 — Point the CMS at your repo

Edit **`public/admin/config.yml`** and replace the two placeholders:

```yaml
backend:
  name: github
  repo: YOUR_USERNAME/flix4ktv      # <- was __GITHUB_REPO__
  branch: main
  base_url: https://flix4ktv.vercel.app   # <- was __SITE_URL__ (your live URL, no trailing slash)
```

Commit and push that change (or edit it directly on GitHub and commit).

## Step 6 — Use it

Open **`https://yoursite.com/admin`**, click **Login with GitHub**, authorize, and
start editing. Save = commit = auto-rebuild.

---

## Notes & tips

- **Who can edit:** anyone you add as a collaborator on the GitHub repo. There's no
  separate password to manage.
- **Images:** uploading a movie poster saves it to `assets/posters`, a sports poster
  to `assets/sports`, and the favicon to `assets/uploads` — all committed to the repo.
- **Edits not instant:** each save triggers a rebuild; allow ~30–60s, then refresh.
- **Local preview:** `npm run dev` then visit `http://localhost:5173`. (The `/admin`
  GitHub login only works on the deployed site, not locally.)
- **Public vs private repo:** both work. The OAuth scope requested covers private repos.
