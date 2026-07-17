// Packet 02 correction pass: the Yahoo OAuth callback must return the user
// to whichever real flow initiated authorization (onboarding vs. Add
// League) rather than hardcoding one destination — but a return
// destination that comes from client-controlled input (a query param) is
// exactly the shape of an open-redirect vulnerability if not validated.
// This allowlist is the single source of truth on both ends of the OAuth
// round trip (the kickoff route validates before storing it in a cookie;
// the callback re-validates the cookie's value before using it, never
// trusting stored state blindly).

export const YAHOO_RETURN_TO_ALLOWLIST = ['/onboarding', '/leagues/add'] as const

export type YahooReturnTo = (typeof YAHOO_RETURN_TO_ALLOWLIST)[number]

const DEFAULT_RETURN_TO: YahooReturnTo = '/onboarding'

export function validateYahooReturnTo(candidate: string | null | undefined): YahooReturnTo {
  if (candidate && (YAHOO_RETURN_TO_ALLOWLIST as readonly string[]).includes(candidate)) {
    return candidate as YahooReturnTo
  }
  return DEFAULT_RETURN_TO
}
