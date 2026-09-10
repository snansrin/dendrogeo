# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 11.0.x  | ✅ Current         |

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

- ✅ Supabase Row Level Security (RLS) on all tables
- ✅ Cloudflare Turnstile CAPTCHA on auth endpoints
- ✅ Admin approval workflow for all published data
- ✅ Content Security Policy (CSP) headers
- ✅ No cookies / no tracking (GDPR/KVKK compliant)
- ✅ Photo storage with per-user path isolation
- ✅ UUID-based client_id for offline sync duplicate prevention
- ✅ Rate limiting via Supabase edge functions

## Data Privacy

- **Stored:** email, full name, organization (account only)
- **NOT stored:** IP addresses, browsing history, cookies
- **Right to erasure:** Users can request full data deletion at any time
- **Compliance:** KVKK (Turkey), GDPR (EU)

---

Last updated: 2026-09-11
Contact: sinan@dendrogeo.org
