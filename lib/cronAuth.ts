// Launch security hardening (Codex Implementation Packet 01): shared,
// fail-closed cron authentication. The inline pattern every cron route used
// before this (`authHeader !== \`Bearer ${process.env.CRON_SECRET}\``) fails
// OPEN when CRON_SECRET is unset — the template literal becomes the literal
// string "Bearer undefined", which a request with the header
// `Authorization: Bearer undefined` would satisfy. Missing security
// configuration must deny every request, never default to an accidentally
// guessable value.

export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // fail closed on missing/empty config, not open

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  // Never log `secret` or `authHeader` here or at any call site — both are
  // the credential itself.
  return authHeader === `Bearer ${secret}`
}
