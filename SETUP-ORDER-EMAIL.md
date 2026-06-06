# Order Emails (Zoho SMTP)

When a customer taps **Confirm order** on `checkout.html`, the site calls the
serverless function `api/order.js`, which sends **two emails**:

1. **New-order alert** → your inbox (`contact@istream4ktv.com`), with full order
   details + a one-tap "Message customer on WhatsApp" button. `Reply-To` is the
   customer, so you can just hit reply.
2. **Customer confirmation** → the buyer, with their order summary and a
   **"Follow up on WhatsApp →"** button pre-filled with the order, asking them to
   come to WhatsApp to finalise payment and activate.

No payment is processed on the site — this only sends emails.

## 1. Get a Zoho app password

1. Sign in to Zoho Mail for **contact@istream4ktv.com**.
2. Go to **My Account → Security → App Passwords** (enable 2FA first if needed).
3. Generate an app password named e.g. `flix4ktv-site`. Copy it.
   - Use the **app password**, not your normal login password.

## 2. Set environment variables in Vercel

Project → **Settings → Environment Variables** (Production + Preview):

| Variable | Required | Value |
|----------|----------|-------|
| `SMTP_USER` | ✅ | `contact@istream4ktv.com` |
| `SMTP_PASS` | ✅ | the Zoho **app password** from step 1 |
| `SMTP_HOST` | optional | `smtp.zoho.com` (default). Use `smtp.zoho.eu` if your Zoho account is on the EU data centre |
| `SMTP_PORT` | optional | `465` (default, SSL) |
| `SMTP_FROM_EMAIL` | optional | From address (default = `SMTP_USER`) |
| `SMTP_FROM_NAME` | optional | From display name shown to recipients (default = `SITE_NAME`, e.g. `FLIX4KTV`) |
| `ORDER_NOTIFY_EMAIL` | optional | inbox for new-order alerts (default = `SMTP_USER`) |
| `BUSINESS_WHATSAPP` | optional | WhatsApp number, digits only (no default — WhatsApp button is omitted if unset) |
| `SITE_NAME` | optional | default `FLIX4KTV` |

> ⚠️ Zoho requires the **From** address to be a verified address on your account,
> so keep `SMTP_FROM_EMAIL` / `SMTP_USER` as `contact@istream4ktv.com`.
> The recipient sees: **`SMTP_FROM_NAME <SMTP_FROM_EMAIL>`**.

After saving env vars, **redeploy** for them to take effect.

## 3. Test

1. Place a test order on the live site with a real email you can check.
2. You should receive the new-order alert; the test email should receive the
   confirmation. Check spam on first send.
3. If nothing arrives, open Vercel → the deployment → **Functions → /api/order**
   logs. Common causes: wrong app password, wrong `SMTP_HOST` region (try
   `smtp.zoho.eu`), or From address not verified in Zoho.

## Notes

- Emails are **English only** by design. The WhatsApp follow-up link stays
  localized to the customer's site language elsewhere on the thank-you page.
- The customer is **never blocked**: if email fails, checkout still proceeds to
  the thank-you page (which has its own WhatsApp follow-up).
