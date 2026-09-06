# Security Policy

## Reporting a Vulnerability
If you discover a security vulnerability, please email 
sinan@dendrogeo.org instead of opening a public issue.

## Security Architecture
- Row Level Security (RLS) on all tables
- Database triggers for approval enforcement
- Client-side duplicate prevention via client_id
- Cloudflare Turnstile for bot protection
