// T-05 / T-79 Tier 1: OneSignal send pipeline (PRD 6.6 — the Saturday 11pm
// injury push is the core retention mechanic). Backend send infrastructure
// only; the onboarding permission-prompt UI (Step 5) is a separate, still-
// parked piece per PRD 5/6.8.
//
// STATUS (July 3, 2026): the REST API key currently in .env.local is a
// deprecated v1 "user token" — OneSignal's API rejects it outright ("Auth
// token is a deprecated v1 user token format"). This is an account-side fix,
// not a code fix: generate a new App API key from the OneSignal dashboard
// (Settings -> Keys & IDs -> REST API Key), which will start with
// `os_v2_app_...`, and replace ONESIGNAL_REST_API_KEY with it. This module
// is written against OneSignal's current API (api.onesignal.com, `Key`
// auth scheme) — it's ready the moment the key is regenerated.

const ONESIGNAL_API_BASE = 'https://api.onesignal.com'

interface SendPushInput {
  /** OneSignal subscription IDs (what push_subscriptions.onesignal_player_id
   *  stores — the column name predates OneSignal's own terminology shift to
   *  "subscription id"; same value, kept as-is rather than churning a
   *  migration for a naming difference). */
  subscriptionIds: string[]
  title: string
  message: string
  url?: string
}

interface OneSignalSendResult {
  ok: boolean
  id?: string
  recipients?: number
  error?: string
}

export async function sendPushNotification({
  subscriptionIds,
  title,
  message,
  url,
}: SendPushInput): Promise<OneSignalSendResult> {
  const appId = process.env.ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_REST_API_KEY
  if (!appId) throw new Error('ONESIGNAL_APP_ID is not configured')
  if (!apiKey) throw new Error('ONESIGNAL_REST_API_KEY is not configured')

  if (subscriptionIds.length === 0) return { ok: true, recipients: 0 }

  const res = await fetch(`${ONESIGNAL_API_BASE}/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      // Current API parameter (not the legacy include_player_ids, still
      // supported but not what new integrations should use).
      include_subscription_ids: subscriptionIds,
      headings: { en: title },
      contents: { en: message },
      ...(url ? { url } : {}),
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    return { ok: false, error: data.errors ? JSON.stringify(data.errors) : `HTTP ${res.status}` }
  }
  return { ok: true, id: data.id, recipients: data.recipients }
}

// Read-only credential check — no notification sent, no player IDs needed.
// Used to verify ONESIGNAL_APP_ID/REST_API_KEY are valid before relying on
// the send pipeline (see status note above).
export async function verifyOneSignalCredentials(): Promise<{ valid: boolean; error?: string }> {
  const appId = process.env.ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_REST_API_KEY
  if (!appId || !apiKey) return { valid: false, error: 'ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY not configured' }

  const res = await fetch(`${ONESIGNAL_API_BASE}/apps/${appId}`, {
    headers: { Authorization: `Key ${apiKey}` },
  })
  if (res.ok) return { valid: true }
  const data = await res.json().catch(() => ({}))
  return { valid: false, error: data.errors ? JSON.stringify(data.errors) : `HTTP ${res.status}` }
}
