// Order intake: emails a new-order alert to the business inbox and a confirmation
// to the customer (with a WhatsApp follow-up link). Called by checkout.html on
// "Confirm order". No payment is taken here — payment is finalised on WhatsApp.
//
// Required Vercel env vars:
//   SMTP_USER   Zoho mailbox login        e.g. you@yourdomain.com
//   SMTP_PASS   Zoho app-specific password (NOT the account password)
// Optional env vars (sensible defaults):
//   SMTP_HOST           default smtp.zoho.com   (use smtp.zoho.eu for EU data centre)
//   SMTP_PORT           default 465 (SSL)
//   SMTP_FROM_EMAIL     From address (default = SMTP_USER). Must be verified in Zoho.
//   SMTP_FROM_NAME      From display name (default = SITE_NAME)
//   ORDER_NOTIFY_EMAIL  default = SMTP_USER  (where new orders land)
//   BUSINESS_WHATSAPP   no default (WhatsApp button omitted if unset)
//   SITE_NAME           default FLIXTV4K
import nodemailer from 'nodemailer'

const str = (v, max = 300) => String(v == null ? '' : v).slice(0, max)
const esc = (s) =>
  str(s, 2000).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const money = (n) => '€' + (Math.round((+n || 0) * 100) / 100).toString()
const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) } catch { return {} } }
  const chunks = []
  for await (const c of req) chunks.push(c)
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return {} }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }))
    return
  }

  const SITE = process.env.SITE_NAME || 'FLIXTV4K'
  const NOTIFY = process.env.ORDER_NOTIFY_EMAIL || process.env.SMTP_USER
  const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || process.env.ORDER_FROM || process.env.SMTP_USER
  const FROM_NAME = (process.env.SMTP_FROM_NAME || SITE).replace(/["\r\n]/g, '')
  const FROM = `"${FROM_NAME}" <${FROM_EMAIL}>`
  const WA = (process.env.BUSINESS_WHATSAPP || '').replace(/\D/g, '')

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    res.statusCode = 500
    res.end(JSON.stringify({ ok: false, error: 'Email not configured (missing SMTP_USER / SMTP_PASS).' }))
    return
  }

  const o = await readBody(req)
  const email = str(o.email, 200).trim()
  if (!isEmail(email)) {
    res.statusCode = 400
    res.end(JSON.stringify({ ok: false, error: 'Invalid customer email.' }))
    return
  }

  // Normalise the order fields we trust.
  const order = {
    ref: str(o.ref, 40) || 'IST-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    name: str(o.name, 120),
    detail: str(o.detail, 200),
    billing: str(o.billing, 200),
    subtotal: +o.subtotal || 0,
    fee: +o.fee || 0,
    amount: +o.amount || 0,
    pay: str(o.payLabel || o.pay, 80),
    whatsapp: str(o.whatsapp, 40).replace(/[^\d+\s()-]/g, ''),
    email,
    features: Array.isArray(o.features) ? o.features.slice(0, 40).map((f) => str(f, 120)) : [],
    lang: str(o.lang, 5),
  }

  // WhatsApp follow-up link, pre-filled with the order, that goes in the customer email.
  const waText =
    `Hi! I just placed an order on ${SITE} (ref ${order.ref}) and I'd like to follow up and complete the payment to activate my subscription.\n\n` +
    `Order ref: ${order.ref}\nPlan: ${order.name}${order.detail ? ' (' + order.detail + ')' : ''}\nTotal: ${money(order.amount)}\nPayment: ${order.pay}`
  const waLink = WA ? 'https://wa.me/' + WA + '?text=' + encodeURIComponent(waText) : ''

  const rows = [
    ['Order ref', order.ref],
    ['Plan', order.name + (order.detail ? ' — ' + order.detail : '')],
    ['Subtotal', money(order.subtotal)],
    order.fee ? ['Payment fee', money(order.fee)] : null,
    ['Total', money(order.amount)],
    ['Payment method', order.pay],
    ['Customer email', order.email],
    order.whatsapp ? ['Customer WhatsApp', order.whatsapp] : null,
  ].filter(Boolean)

  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:7px 14px;border-bottom:1px solid #eee;color:#666;font:13px Arial">${esc(k)}</td>` +
        `<td style="padding:7px 14px;border-bottom:1px solid #eee;color:#111;font:600 13px Arial">${esc(v)}</td></tr>`
    )
    .join('')
  const rowsText = rows.map(([k, v]) => `${k}: ${v}`).join('\n')
  const featList = order.features.length
    ? '<ul style="margin:10px 0 0;padding-left:18px;color:#333;font:13px Arial">' +
      order.features.map((f) => `<li>${esc(f)}</li>`).join('') +
      '</ul>'
    : ''

  const shell = (heading, intro, extra) => `<!doctype html><html><body style="margin:0;background:#f4f4f6;padding:24px">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e8">
    <tr><td style="background:#0c0c12;padding:20px 24px">
      <span style="font:700 22px Arial;color:#fff">FLIX<span style="background:#19d3da;color:#0c0c12;padding:2px 7px">TV4K</span></span>
    </td></tr>
    <tr><td style="padding:26px 24px 6px">
      <h1 style="margin:0 0 8px;font:700 20px Arial;color:#111">${heading}</h1>
      <p style="margin:0 0 16px;font:14px/1.5 Arial;color:#444">${intro}</p>
      <table role="presentation" width="100%" style="border-collapse:collapse;border:1px solid #eee">${rowsHtml}</table>
      ${extra || ''}
    </td></tr>
    <tr><td style="padding:18px 24px 26px;border-top:1px solid #eee">
      <p style="margin:0;font:12px Arial;color:#999">© 2026 ${esc(SITE)} · This is an automated message.</p>
    </td></tr>
  </table></body></html>`

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.zoho.com',
    port: +process.env.SMTP_PORT || 465,
    secure: (+process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })

  const businessMail = {
    from: FROM,
    to: NOTIFY,
    replyTo: order.email,
    subject: `🆕 New order ${order.ref} — ${order.name} (${money(order.amount)})`,
    text: `New order received.\n\n${rowsText}` + (waLink ? `\n\nFollow up on WhatsApp: ${waLink}` : ''),
    html: shell(
      'New order received',
      `A new order just came in via the website. Reply to this email to reach the customer directly.`,
      featList +
        (waLink
          ? `<p style="margin:18px 0 0"><a href="${waLink}" style="font:600 13px Arial;color:#0c0c12;background:#19d3da;padding:11px 18px;text-decoration:none;display:inline-block">Message customer on WhatsApp</a></p>`
          : '')
    ),
  }

  const customerMail = {
    from: FROM,
    to: order.email,
    replyTo: NOTIFY,
    subject: `Your ${SITE} order ${order.ref}`,
    text:
      `Thanks for your order with ${SITE}!\n\n${rowsText}\n\n` +
      `No payment has been taken yet — we finalise payment and activate your subscription on WhatsApp, usually within minutes.\n\n` +
      (waLink ? `Follow up on WhatsApp: ${waLink}\n\n` : '') +
      `© 2026 ${SITE}`,
    html: shell(
      'Thanks for your order!',
      `We've received your order. <b>No payment has been taken yet</b> — tap the button below to follow up on WhatsApp, where we finalise payment and activate your subscription (usually within minutes).`,
      featList +
        (waLink
          ? `<p style="margin:20px 0 4px"><a href="${waLink}" style="font:600 14px Arial;color:#0c0c12;background:#19d3da;padding:13px 22px;text-decoration:none;display:inline-block">Follow up on WhatsApp →</a></p>` +
            `<p style="margin:10px 0 0;font:12px Arial;color:#999">Or message us at +${WA}</p>`
          : '')
    ),
  }

  try {
    await Promise.all([transporter.sendMail(businessMail), transporter.sendMail(customerMail)])
    res.statusCode = 200
    res.end(JSON.stringify({ ok: true, ref: order.ref }))
  } catch (err) {
    res.statusCode = 502
    res.end(JSON.stringify({ ok: false, error: String((err && err.message) || err) }))
  }
}
