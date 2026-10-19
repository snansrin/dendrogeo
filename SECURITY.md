# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 3.0.x   | ✅ Current         |
| < 3.0   | ❌ Not supported (dahili 11.x numaralandırması — bkz. CHANGELOG.md) |

## Reporting a Vulnerability

DendroGeo takes security seriously. If you discover a security issue,
please report it responsibly.

### How to Report

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead, please email:
📧 **security@dendrogeo.org** (forwarded to Sinan ŞİRİN)

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to Expect

- **Acknowledgment:** Within 48 hours
- **Status update:** Within 7 days
- **Resolution target:** Within 30 days for critical issues

### Scope

In-scope:
- Authentication bypass (Supabase RLS, Turnstile)
- Data exfiltration via API
- XSS in user-generated content
- Admin privilege escalation
- Photo storage access control

Out-of-scope:
- Supabase platform issues (report to supabase.com)
- Cloudflare Turnstile bypass (report to cloudflare.com)
- Social engineering attacks
- Denial of service

### Recognition

Security researchers who report valid vulnerabilities will be credited
in our SECURITY-HALL.md (with permission) and acknowledged in release notes.

---

## Security Features

DendroGeo implements:

- Supabase RLS enabled on all 13 public tables and Storage tables inspected on 19 October 2026; policy coverage is a separate check (see supabase/audit/RLS-DENETIM.md)
- ✅ Cloudflare Turnstile CAPTCHA on auth endpoints
- ✅ Admin approval workflow for all published data
- Content Security Policy applied through an HTML meta element
- No advertising or tracking cookies; aggregate usage metrics and transient authenticated presence are documented in the privacy policy
- ✅ Photo storage with per-user path isolation
- ✅ UUID-based client_id for offline sync duplicate prevention
- ✅ Rate limiting via Supabase edge functions

## Data Privacy

- **Stored:** email, full name, organization (account only)
- **Aggregate metrics:** daily page/source/device/country totals retained for up to 400 days; no visitor identifiers or IP addresses in these aggregates
- **Presence:** authenticated activity and optional shared location have a separate, transient authorization scope
- **Right to erasure:** Users can request full data deletion at any time
- **Privacy requests:** handled under the published privacy policy and applicable law; this document is not a legal compliance certification.

---

Last updated: 2026-10-19
Contact: security@dendrogeo.org

## Hosting limitations

GitHub Pages does not provide repository-controlled custom HTTP response headers. A read-only GET of the deployed homepage on 19 October 2026 found no HTTP CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS or Permissions-Policy headers. A meta CSP cannot enforce frame-ancestors; the interface currently has no verified anti-framing protection. RLS and CAPTCHA do not prevent clickjacking. An edge/header configuration would be a separate infrastructure change.

Public static responses may use Access-Control-Allow-Origin: *. This does not grant access to private Supabase records; those use separate authorization. See [cache behaviour](docs/CACHING.md).
