# Project invitation scope and browser policy — 25 October 2026

Private project reads require ownership, administrator access, or current
collaboration backed by an accepted invitation from that project's current
owner or an active administrator. Creating a separate project in the same
geographic park does not grant access to another team's unpublished work.
Normal owners can revoke only their own invitation scope. Leaving and later
rejoining starts a fresh membership epoch; older grants do not revive.
Memberships without a corresponding accepted invitation are not silently
backfilled into permissions. An authorized owner can send a fresh invitation.

The migration changes policies and guarded functions only. It does not update
existing measurement, park, stage, analysis or membership rows during rollout.
Public approved measurements, owner/admin access and authorized collaboration
remain supported. The public RPC argument signatures are unchanged.

The application CSP authorizes exact packaged script bodies using generated
SHA-256 hashes, while keeping native classic-script ordering and lexical scope.
Image/API providers are not script providers. Turnstile, existing map imagery,
Realtime WebSockets and blob workers retain their scoped permissions. Source
modules and scientific calculations are unchanged. Relative sourceURL comments
make the authorized body independent of the deployment hostname.

Validation uses isolated PostgreSQL fixtures and browser accounts, never live
user mutations or log-query APIs. Regression coverage includes two independent
owners at one park, verified invitation identity, revocation, leave/rejoin,
inactive/stale inviters, administrators, public reads, stage persistence, and
browser execution/blocking at 360/390/430/1280 px.

## Hosting follow-up

GitHub Pages does not apply arbitrary response headers from a repository file.
The current domain nameservers are Squarespace; possession of a Cloudflare
Turnstile account does not establish a proxied Cloudflare zone. Do not change
nameservers or enable proxying without checking the complete DNS/mail records
and GitHub Pages certificate setup first.

After confirming an active proxy, a narrow response-header rule can add
`X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`,
`X-Frame-Options: SAMEORIGIN`, and
`Content-Security-Policy: frame-ancestors 'self'` to HTML responses.
That last policy supplements, rather than replaces, the application's CSP.
Preserve required geolocation/camera permissions; avoid a blanket Permissions
Policy denial. Enable HSTS only after HTTPS and affected subdomains have been
verified; do not enable preload or includeSubDomains by assumption.

These headers are not deployed by this repository change. A meta tag cannot
provide frame-ancestors, HSTS or nosniff protection. Leaked-password protection
also remains a hosting/Auth follow-up: Supabase documents it as a Pro-plan
feature; no paid upgrade is authorized or performed.

The remaining authenticated SECURITY DEFINER warnings refer to intentional
guarded invitation/membership RPCs with an empty search_path and no anonymous
execution. Do not change them to INVOKER solely to silence the advisor: that
would alter the invitation workflow. The archive table with RLS and no policies
does not permit reads by default.
