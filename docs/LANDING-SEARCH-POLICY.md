# Google search entry points — 29 October 2026

The user explicitly selected: only the Turkish and English landing pages should appear in Google; supporting documents must remain accessible by link. This is a search indexing preference, not an access-control rule and not a promise of ranking gains.

## Public behavior

- `/` and `/en/` retain self-canonicals, reciprocal TR/EN/x-default hreflang and `index, follow`.
- Supporting information, methods, legal pages and the report gallery retain their content, public URLs, navigation and self-canonicals, with `noindex, follow`.
- The report reader and withdrawn notices remain noindex. Future report HTML includes the same robots policy at document creation. Existing immutable report HTML, manifests, snapshots, hashes and DOI identities are not rewritten.
- `sitemap.xml` contains exactly the two landings. Publication and withdrawal can still rebuild the report gallery; they cannot reinsert report URLs into the search sitemap.
- Public-document theme/metadata maintenance uses its own registry rather than the sitemap, so removing a document from search discovery does not stop its maintenance.
- robots.txt continues to allow supporting documents to be crawled, so Google can see their noindex directives. No domain-wide Search Console removal or broad robots blocking is used.

The landing pages explain field tree inventory, biomass/carbon-stock estimation and urban park GIS. Carbon stock is distinguished from annual uptake and personal carbon footprint. Existing formulas, coefficients and model restrictions remain in force. No ranking, traffic, carbon-credit or scientific-adoption claim is added.

## Scientific protection

The before/after snapshot checked all 1,069 protected paths. Only six explicitly scoped presentation/release/test paths changed: `partials/head.html`, `partials/landing.html`, generated `index.html`, the service-worker cache revision, and two obsolete SEO discovery assertions. The remaining 1,063 protected paths are byte-identical. The authorized SHA chain retains the original hashes and prior history; it does not refresh scientific core hashes.

There are no edits to `src/domain/`, `src/application/`, `src/adapters/`, `src/services/`, shell/boot markup, database migrations, archived DGR artifacts or measurement/analysis modules. Runtime bundle regeneration follows the normal build; runtime source edits are limited to three English landing translations. Report code changes are restricted to robots metadata and sitemap discovery, with no numerical/report-data changes.

## Validation

Run `npm run check`, `node scripts/seo-audit.mjs`, public-page phone/theme checks and landing scene checks. The policy regression tests ensure supporting URLs remain available, noindex pages stay crawlable, publishing does not grow the sitemap, report files are immutable across gallery rebuilds, and new report heads keep canonical/structured identity alongside noindex.

Search results will change after Google recrawls each URL. Existing index counts and previously queued indexing requests can remain visible while Google processes the new policy. Search Console property access and the successful sitemap submission are preserved.
