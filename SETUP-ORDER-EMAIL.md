# Order Emails (Gmail SMTP)

When a customer taps **Confirm order** on `checkout.html`, the site calls the
serverless function `api/order.js`, which sends **two emails**:

1. **New-order alert** → your inbox (`infos8kprime@gmail.com`), with full order
   details + a one-tap "Message customer on WhatsApp" button. `Reply-To` is the
   customer, so you can just hit reply.
2. **Customer confirmation** → the buyer (sent from `infos8kprime@gmail.com`), with their order summary and a
   **"Follow up on WhatsApp →"** button pre-filled with the order, asking them to
   come to WhatsApp to finalise payment and activate.

No payment is processed on the site — this only sends emails.

## 1. Get a Google App Password (16 characters)

Since your email is `@gmail.com`:
1. Go to your Google Account security settings: **https://myaccount.google.com/security**
2. Ensure **2-Step Verification** is turned **ON**.
3. Search for **App passwords** (or go to **https://myaccount.google.com/apppasswords**).
4. Create an app password named e.g. `8KPRIME-Website`.
5. Google will give you a 16-character code (e.g. `abcd efgh ijkl mnop`). Copy it (without spaces).

## 2. Set environment variables in Vercel

Project → **Settings → Environment Variables** (select Production + Preview):

| Variable | Required | Value |
|----------|----------|-------|
| `SMTP_USER` | ✅ | `infos8kprime@gmail.com` |
| `SMTP_PASS` | ✅ | your 16-character Google **App Password** from step 1 |
| `SMTP_HOST` | optional | `smtp.gmail.com` (default) |
| `SMTP_PORT` | optional | `465` (default) |
| `SMTP_FROM_EMAIL` | optional | `infos8kprime@gmail.com` |
| `SMTP_FROM_NAME` | optional | `8KPRIME` |
| `ORDER_NOTIFY_EMAIL` | optional | `infos8kprime@gmail.com` |
| `BUSINESS_WHATSAPP` | optional | `18185656691` |
| `SITE_NAME` | optional | `8KPRIME` |

After saving env vars, **redeploy** for them to take effect.

## 3. Test

1. Place a test order on the live site with a real email you can check.
2. You should receive the new-order alert; the test email should receive the
   confirmation. Check spam on first send.
3. If nothing arrives, open Vercel → the deployment → **Functions → /api/order**
   logs. Common causes: wrong app password, wrong `SMTP_HOST` region (try
   `smtp.gmail.com`), or From address not verified in Zoho.

## Notes

- Emails are **English only** by design. The WhatsApp follow-up link stays
  localized to the customer's site language elsewhere on the thank-you page.
- The customer is **never blocked**: if email fails, checkout still proceeds to
  the thank-you page (which has its own WhatsApp follow-up).
