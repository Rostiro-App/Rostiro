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

interface EmailShellInput {
  previewText: string
  heading: string
  bodyHtml: string
  ctaLabel: string
  ctaUrl: string
  footerNote: string
}

// Table-based layout, inline styles only — the two things that actually
// hold up across Outlook/Gmail/Apple Mail, unlike <style> blocks or flexbox.
// Brand kit's marketing wordmark treatment (white text, tagline allowed)
// applies here rather than the in-product one: an email is a hero surface
// outside the app shell, not an in-product screen.
function emailShell({ previewText, heading, bodyHtml, ctaLabel, ctaUrl, footerNote }: EmailShellInput): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background-color:${COLOR.page}; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${previewText}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR.page};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="${APP_URL}/notification-icon.png" width="40" height="40" alt="Rostiro" style="display:block; border-radius:9px;" />
              <div style="margin-top:10px; font-size:13px; font-weight:500; letter-spacing:-0.5px; color:#FFFFFF; text-transform:uppercase;">ROSTIRO</div>
            </td>
          </tr>
          <tr>
            <td style="background-color:${COLOR.card}; border:1px solid ${COLOR.border}; border-radius:12px; padding:32px;">
              <h1 style="margin:0 0 12px; font-size:20px; font-weight:600; color:${COLOR.textPrimary};">${heading}</h1>
              <div style="font-size:14px; line-height:1.6; color:${COLOR.textMuted};">${bodyHtml}</div>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td style="border-radius:10px; background-color:${COLOR.signal};">
                    <a href="${ctaUrl}" style="display:inline-block; padding:12px 24px; font-size:14px; font-weight:600; color:#FFFFFF; text-decoration:none;">${ctaLabel} →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;">
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
