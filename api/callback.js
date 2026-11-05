// Step 2 of the GitHub OAuth flow for the CMS.
// GitHub redirects here with ?code=...; we exchange it for an access token and
// hand it back to the CMS popup via the Decap/Sveltia postMessage handshake.
// Requires env vars: GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET

function parseCookies(header) {
  const out = {}
  ;(header || '').split(';').forEach((c) => {
    const i = c.indexOf('=')
    if (i > -1) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim())
  })
  return out
}

function renderResult(status, payload, selfOrigin) {
  const provider = 'github'
  const message = `authorization:${provider}:${status}:${JSON.stringify(payload)}`
  // Canonical Decap/Sveltia OAuth handshake. The CMS popup and this callback are on
  // the SAME origin, so we only ever exchange messages with `selfOrigin` — never the
  // '*' wildcard, which would leak the access token to any window that messages us.
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script>
  (function () {
    var SELF_ORIGIN = ${JSON.stringify(selfOrigin)};
    var message = ${JSON.stringify(message)};
    function receive(e) {
      if (e.origin !== SELF_ORIGIN) return;
      if (!e.data || e.data !== 'authorizing:github') return;
      window.removeEventListener('message', receive, false);
      (e.source || window.opener).postMessage(message, SELF_ORIGIN);
    }
    window.addEventListener('message', receive, false);
    if (window.opener) window.opener.postMessage('authorizing:github', SELF_ORIGIN);
  })();
</script>
<p>Completing sign-in… you can close this window.</p>
</body></html>`
}

export default async function handler(req, res) {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET
  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  // This callback and the CMS admin live on the same deployment, so the popup's
  // opener origin equals our own origin. We post the token only to this origin.
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0]
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const selfOrigin = `${proto}://${host}`

  if (!clientId || !clientSecret) {
    res.statusCode = 500
    res.end('Missing GitHub OAuth env vars (GITHUB_OAUTH_CLIENT_ID / GITHUB_OAUTH_CLIENT_SECRET).')
    return
  }

  const url = new URL(req.url, 'http://localhost')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookies = parseCookies(req.headers.cookie)

  if (!code) {
    res.statusCode = 400
    res.end(renderResult('error', { message: 'No code returned from GitHub.' }, selfOrigin))
    return
  }
  if (!state || !cookies.oauth_state || state !== cookies.oauth_state) {
    res.statusCode = 400
    res.end(renderResult('error', { message: 'Invalid OAuth state.' }, selfOrigin))
    return
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    })
    const data = await tokenRes.json()

    if (data.error || !data.access_token) {
      res.statusCode = 401
      res.end(renderResult('error', { message: data.error_description || 'Token exchange failed.' }, selfOrigin))
      return
    }

    // Hard allowlist: only specific GitHub accounts may sign in.
    // Set GITHUB_ALLOWED_USERS in Vercel (comma-separated logins) to enable.
    // If unset, anyone can sign in but only repo collaborators can actually save.
    const allow = (process.env.GITHUB_ALLOWED_USERS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    if (allow.length) {
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${data.access_token}`,
          'User-Agent': '8kprime-cms',
          Accept: 'application/vnd.github+json',
        },
      })
      const user = await userRes.json()
      const login = user && user.login ? String(user.login).toLowerCase() : ''
      if (!login || !allow.includes(login)) {
        res.statusCode = 403
        res.end(
          renderResult('error', { message: 'This GitHub account is not allowed to edit this site.' }, selfOrigin)
        )
        return
      }
    }

    // Clear the state cookie and return the token to the CMS.
    res.setHeader('Set-Cookie', 'oauth_state=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0')
    res.statusCode = 200
    res.end(renderResult('success', { token: data.access_token, provider: 'github' }, selfOrigin))
  } catch (err) {
    res.statusCode = 500
    res.end(renderResult('error', { message: String((err && err.message) || err) }, selfOrigin))
  }
}
