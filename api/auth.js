// Step 1 of the GitHub OAuth flow for the CMS.
// The CMS opens this endpoint in a popup; we redirect to GitHub's authorize page.
// Requires env var: GITHUB_OAUTH_CLIENT_ID

import { randomBytes } from 'node:crypto'

export default function handler(req, res) {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
  if (!clientId) {
    res.statusCode = 500
    res.end('Missing GITHUB_OAUTH_CLIENT_ID environment variable.')
    return
  }

  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0]
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const redirectUri = `${proto}://${host}/api/callback`

  // Cryptographically random state to mitigate CSRF (cookie-checked in callback).
  const state = randomBytes(32).toString('base64url')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'repo,user',
    state,
    allow_signup: 'false',
  })

  res.setHeader(
    'Set-Cookie',
    `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600`
  )
  res.statusCode = 302
  res.setHeader('Location', `https://github.com/login/oauth/authorize?${params}`)
  res.end()
}
