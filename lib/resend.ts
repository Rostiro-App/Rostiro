// T-135: branded transactional email. Real Resend wiring, not Supabase's
// default (unbranded, `rostiro.com`-less) sender that T-130/signup used
// until now. Both call sites (signup confirmation, password reset) now go
// through `supabase.auth.admin.generateLink` — which only *generates* the
// action link, it never sends anything — so Resend is the only thing that
// actually emails the user. This is a deliberate move away from Supabase's
// own auto-send-on-signUp/resetPasswordForEmail behavior, which has no
// per-call template override short of Custom SMTP + dashboard-edited
// templates (a manual, credentials-in-a-dashboard step outside what this
// codebase can own or verify end-to-end).

import { Resend } from 'resend'

// Lazy, not module-top-level — the last three Vercel deployments failed
// build entirely ("Missing API key. Pass it to the constructor") because
// `new Resend(...)` at import time runs during Next's page-data collection
// step, which imports every route module regardless of whether the
// RESEND_API_KEY build-time env var is actually populated in that
// environment. Constructing it only when a send actually happens (same
// posture as lib/supabase.ts's createAdminClient) means a missing key
// only fails the one request that needed it, never the whole build.
function getResendClient(): Resend {
  return new Resend(process.env.RESEND_API_KEY)
}

const FROM = `Rostiro <${process.env.RESEND_FROM_EMAIL ?? 'noreply@rostiro.com'}>`
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rostiro.com'

// Brand kit tokens (rostiro-brand-kit.md sections 1, 6) — email clients
// can't load globals.css, so the same values are inlined here directly
// rather than imported.
const COLOR = {
  page: '#0D1B2A',
  card: '#0F2235',
  border: '#1A3050',
  textPrimary: '#D0E4F5',
  textMuted: '#4A6580',
  signal: '#378ADD',
}

// Escapes user-supplied free text before it goes into an email body —
// emailShell()'s bodyHtml is inserted as raw HTML with no sanitization,
// so anything a user typed (e.g. the founder-feedback message, Task 7)
// must be escaped here first, or it could break the email's markup or
// inject arbitrary HTML into an email sent from rostiro.com.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface EmailShellInput {
  previewText: string
  heading: string
  bodyHtml: string
  ctaLabel: string
  ctaUrl: string
  footerNote: string
  accentColor?: string
}

// Table-based layout, inline styles only — the two things that actually
// hold up across Outlook/Gmail/Apple Mail, unlike <style> blocks or flexbox.
// Brand kit's marketing wordmark treatment (white text, tagline allowed)
// applies here rather than the in-product one: an email is a hero surface
// outside the app shell, not an in-product screen.
function emailShell({ previewText, heading, bodyHtml, ctaLabel, ctaUrl, footerNote, accentColor = COLOR.signal }: EmailShellInput): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background-color:${COLOR.page}; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${previewText}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%; background-color:${COLOR.page};">
    <tr>
      <td align="center" style="text-align:center; padding:40px 16px;">
        <table role="presentation" width="480" align="center" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%;">
          <tr>
            <td align="center" style="text-align:center; padding-bottom:28px;">
              <img src="${APP_URL}/notification-icon.png" width="40" height="40" alt="Rostiro" style="display:block; margin:0 auto; border-radius:9px;" />
              <div style="margin-top:10px; font-size:13px; font-weight:500; letter-spacing:-0.5px; color:#FFFFFF; text-transform:uppercase;">ROSTIRO</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="text-align:center; background-color:${COLOR.card}; border:1px solid ${COLOR.border}; border-radius:12px; padding:32px;">
              <h1 style="margin:0 0 12px; font-size:20px; font-weight:600; color:${COLOR.textPrimary}; text-align:center;">${heading}</h1>
              <div style="font-size:14px; line-height:1.6; color:${COLOR.textMuted}; text-align:center;">${bodyHtml}</div>
              <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:24px auto 0;">
                <tr>
                  <td style="border-radius:10px; background-color:${accentColor};">
                    <a href="${ctaUrl}" style="display:inline-block; padding:12px 24px; font-size:14px; font-weight:600; color:#FFFFFF; text-decoration:none;">${ctaLabel} →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="text-align:center; padding-top:20px;">
              <p style="margin:0; font-size:12px; line-height:1.6; color:${COLOR.textMuted};">${footerNote}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendSignupConfirmationEmail(to: string, confirmUrl: string): Promise<void> {
  const html = emailShell({
    previewText: 'Confirm your email to finish setting up Rostiro.',
    heading: 'Confirm your email',
    bodyHtml: 'One click and your Rostiro OS is live. Your 7-day Starter trial starts the moment you confirm.',
    ctaLabel: 'Confirm email',
    ctaUrl: confirmUrl,
    footerNote: "Didn't create a Rostiro account? You can safely ignore this email.",
  })

  const { error } = await getResendClient().emails.send({
    from: FROM,
    to,
    subject: 'Confirm your Rostiro account',
    html,
    text: `Confirm your Rostiro account: ${confirmUrl}`,
  })
  if (error) throw new Error(error.message)
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const html = emailShell({
    previewText: 'Reset your Rostiro password.',
    heading: 'Reset your password',
    bodyHtml: 'Click below to set a new password. This link expires shortly and can only be used once.',
    ctaLabel: 'Reset password',
    ctaUrl: resetUrl,
    footerNote: "Didn't request this? Your password is unchanged, no action needed.",
  })

  const { error } = await getResendClient().emails.send({
    from: FROM,
    to,
    subject: 'Reset your Rostiro password',
    html,
    text: `Reset your Rostiro password: ${resetUrl}`,
  })
  if (error) throw new Error(error.message)
}

export async function sendWelcomeEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: 'Your Rostiro OS is live.',
    heading: "You're in.",
    bodyHtml: 'Your Rostiro OS is live. Connect a league to get your first Pulse briefing.',
    ctaLabel: 'Go to Rostiro',
    ctaUrl: `${APP_URL}/pulse`,
    footerNote: "You're receiving this because you just confirmed your Rostiro account.",
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: 'Welcome to Rostiro', html,
    text: `Welcome to Rostiro. Go to your dashboard: ${APP_URL}/pulse`,
  })
  if (error) throw new Error(error.message)
}

export async function sendProStartedEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: "You're on Rostiro Pro.",
    heading: 'Welcome to Pro',
    bodyHtml: 'Unlimited leagues, full Pulse depth, and unlimited AI are live on your account now.',
    ctaLabel: 'Open Rostiro',
    ctaUrl: `${APP_URL}/pulse`,
    footerNote: 'Manage your subscription anytime from Profile → Manage billing.',
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: "You're on Rostiro Pro", html,
    text: `You're on Rostiro Pro. Open Rostiro: ${APP_URL}/pulse`,
  })
  if (error) throw new Error(error.message)
}

export async function sendSeasonPassPurchasedEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: 'Your Founder Season Pass is active.',
    heading: 'Season Pass activated',
    bodyHtml: 'Full access is unlocked through the end of the season — no recurring charge.',
    ctaLabel: 'Open Rostiro',
    ctaUrl: `${APP_URL}/pulse`,
    footerNote: "Your pass expires at the end of the season; we'll email you before it does.",
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: 'Your Founder Season Pass is active', html,
    text: `Your Founder Season Pass is active. Open Rostiro: ${APP_URL}/pulse`,
  })
  if (error) throw new Error(error.message)
}

export async function sendFoundingWelcomeEmail(to: string, foundingNumber: number): Promise<void> {
  const html = emailShell({
    previewText: 'Welcome to the Founding 500.',
    heading: `<span style="display:block; font-size:11px; font-weight:700; letter-spacing:1px; color:#F5C842; margin-bottom:6px;">★ FOUNDER</span>You're Founding Member #${foundingNumber}`,
    bodyHtml: 'Lifetime access, locked in for good. Thank you for backing Rostiro from the start.',
    ctaLabel: 'View your Founder badge',
    ctaUrl: `${APP_URL}/profile`,
    footerNote: 'Founding 500 membership is permanent and non-transferable.',
    accentColor: '#F5C842',
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: 'Welcome to the Founding 500', html,
    text: `★ FOUNDER — You're Founding Member #${foundingNumber} of 500. View your badge: ${APP_URL}/profile`,
  })
  if (error) throw new Error(error.message)
}

export async function sendSubscriptionCanceledEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: 'Your Rostiro Pro subscription was canceled.',
    heading: 'Subscription canceled',
    bodyHtml: 'Your account has moved to the Free plan. You can resubscribe anytime.',
    ctaLabel: 'View plans',
    ctaUrl: `${APP_URL}/upgrade`,
    footerNote: "If this wasn't you, contact support right away.",
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: 'Your Rostiro Pro subscription was canceled', html,
    text: `Your Rostiro Pro subscription was canceled. View plans: ${APP_URL}/upgrade`,
  })
  if (error) throw new Error(error.message)
}

export async function sendPaymentFailedEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: 'We couldn\'t process your Rostiro Pro payment.',
    heading: 'Payment failed',
    bodyHtml: "Your card was declined on renewal. Stripe will retry automatically, but you may want to update your payment method to avoid losing Pro access.",
    ctaLabel: 'Update payment method',
    ctaUrl: `${APP_URL}/settings`,
    footerNote: "If you've already updated your card, no action is needed.",
    accentColor: '#D9534F',
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: "We couldn't process your Rostiro Pro payment", html,
    text: `Your card was declined on renewal. Update your payment method: ${APP_URL}/settings`,
  })
  if (error) throw new Error(error.message)
}

export async function sendSeasonPassExpiringEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: 'Your Season Pass expires in about a week.',
    heading: 'Your Season Pass is ending soon',
    bodyHtml: 'Your Founder Season Pass access ends soon. Upgrade to Rostiro Pro or Founding 500 to keep full access without interruption.',
    ctaLabel: 'View plans',
    ctaUrl: `${APP_URL}/upgrade`,
    footerNote: "No action needed if you're fine reverting to Free.",
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: 'Your Season Pass expires in about a week', html,
    text: `Your Season Pass expires soon. View plans: ${APP_URL}/upgrade`,
  })
  if (error) throw new Error(error.message)
}

export async function sendSeasonPassExpiredEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: 'Your Season Pass has ended.',
    heading: 'Your Season Pass has ended',
    bodyHtml: 'Your account is back on the Free plan. Upgrade anytime to unlock full access again.',
    ctaLabel: 'View plans',
    ctaUrl: `${APP_URL}/upgrade`,
    footerNote: 'Thanks for being a Founder Season Pass member this season.',
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: 'Your Season Pass has ended', html,
    text: `Your Season Pass has ended. View plans: ${APP_URL}/upgrade`,
  })
  if (error) throw new Error(error.message)
}

export async function sendAccountDeletedEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: 'Your Rostiro account has been deleted.',
    heading: 'Account deleted',
    bodyHtml: 'Your account and all associated data have been permanently deleted, per your request.',
    ctaLabel: 'Learn more',
    ctaUrl: APP_URL,
    footerNote: "If you didn't request this, contact support immediately.",
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: 'Your Rostiro account has been deleted', html,
    text: 'Your Rostiro account and all associated data have been permanently deleted, per your request.',
  })
  if (error) throw new Error(error.message)
}

export async function sendFeedbackReceivedEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: 'We received your feedback.',
    heading: 'Thanks for the feedback',
    bodyHtml: 'Your message went straight to the founder, flagged as priority. We read every Founding 500 submission.',
    ctaLabel: 'Back to Rostiro',
    ctaUrl: `${APP_URL}/profile`,
    footerNote: 'This is a one-time confirmation — no reply is expected unless the founder follows up directly.',
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: 'We received your feedback', html,
    text: 'We received your feedback. It went straight to the founder, flagged as priority.',
  })
  if (error) throw new Error(error.message)
}

export async function sendFeedbackNotificationEmail(founderEmail: string, memberEmail: string, message: string): Promise<void> {
  const html = emailShell({
    previewText: 'New Founding 500 feedback received.',
    heading: 'New feedback received',
    bodyHtml: `From: ${escapeHtml(memberEmail)}<br/><br/>${escapeHtml(message)}`,
    ctaLabel: 'Open Rostiro',
    ctaUrl: APP_URL,
    footerNote: 'Sent because a Founding 500 member submitted feedback.',
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to: founderEmail, subject: 'New Founding 500 feedback', html,
    text: `New feedback from ${memberEmail}: ${message}`,
  })
  if (error) throw new Error(error.message)
}
