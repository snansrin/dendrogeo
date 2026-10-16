# Shared park access, accepted maps and imagery

User-authorized modular feature work. Runtime scientific calculations and published reports are unchanged.

- Shared project cards offer departure from the park collaboration. Confirmation explains that all shared projects in the park are affected, existing measurements remain and rejoining requires an invitation.
- A self-only authenticated RPC deletes only the caller's membership. It accepts no target user ID. Owner projects and measurements are not deleted.
- A read-only RPC exposes the latest admin/owner accepted surface cartography, including the existing Göksu snapshot. It returns no account payload, corrections or user identifiers; feature properties are whitelisted.
- Selected parks show this saved layer only when the accepted outer boundary and holes match. Late responses are rejected. New analysis clears the saved layer and starts a neutral editable preview while retaining the previous accepted snapshot and optimistic account revision.
- Initial park lookup tries one Overpass mirror then uses the existing independent boundary fallback. 504 and failed gateway CORS responses are external provider errors, not proof of a failed complete geometry recovery.
- Imagery supports provider levels up to 23, falling back to lower native levels on missing tiles. Provider HEAD checks for Göksu returned 200 at level 19 and 404 at levels 20–23: finer pixels cannot be invented. Scientific raster resolution is unchanged.

Database migration was applied after connection renewal. Supabase migration history version is 20261016145733 and the local filename matches. Public departure is denied to anon; authenticated departure is granted; accepted map read is public. Production read returned Göksu's accepted snapshot from 16 October 2026. Local PostgreSQL tests prove self-only deletion, measurement retention, repeat safety, public field minimization and rejection of untrusted snapshots. Browser fixtures verify saved-map lifecycle and actual departure confirmation/RPC/refresh on Chromium and WebKit at 360/390/430 px. No production memberships or measurements were changed during verification.

Security advisors report only the previously documented guarded invitation RPCs, closed archival table and plan-dependent leaked-password protection setting; the new public RPC wrappers use security invoker with private guarded implementations.

References: https://dev.overpass-api.de/overpass-doc/en/preface/commons.html and https://developers.arcgis.com/rest/services-reference/enterprise/map-tile/
