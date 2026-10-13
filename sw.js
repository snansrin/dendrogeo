// ============================================================ 
// 🌲 DendroGeo Service Worker v2.10 (Cache-Only, Production-Ready)
// Harita tile cache, fotoğraf cache, LRU temizliği
// NOT: Senkronizasyon artık Ana Thread (Supabase JS SDK) tarafından yapılıyor
// ============================================================

const CACHE_VERSION = 'dendrogeo-sw-v2-r330';

/* İKİ AYRI STATİK CACHE — bu ayrım bilinçli ve önemli.
 *
 * PRECACHE: CORE_ASSETS'in sorgusuz kopyaları. Yalnızca install sırasında
 *           yazılır ve ASLA trim edilmez. Çevrimdışı yedeği buna dayanır.
 * RUNTIME : çalışma zamanında eklenen ?v=NNN sürümlü script/style kopyaları.
 *           Sınırlıdır, trim edilir.
 *
 * Neden ayrıldılar: eskiden ikisi de STATIC_CACHE içindeydi ve trimCache
 * FIFO ile keys[0]'ı siliyordu. Cache.keys() ekleme sırasıyla döndüğü için
 * keys[0] HER ZAMAN install'da eklenen bir precache girdisiydi. gridplan.js
 * ?v=139'a ulaşana dek her sürüm yeni bir girdi ekledi; 150 limiti dolunca
 * precache girdileri silinmeye başladı — yani networkFirstWithLimit'in
 * çevrimdışı yedeği (origin+pathname) sessizce yok oluyordu. Uygulama
 * çevrimiçiyken kusursuz çalıştığı için bu ancak sahada, bağlantı
 * kesildiğinde fark edilirdi. */
const PRECACHE = `precache-${CACHE_VERSION}`;
const RUNTIME = `runtime-${CACHE_VERSION}`;
const TILE_CACHE = `tiles-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const IMG_CACHE = `images-${CACHE_VERSION}`;
const OFFLINE_URL = '/';

const MAX_TILES = 2000;
const MAX_IMAGES = 500;
const MAX_API_CACHE = 150;   // Nominatim vb. API yanıtları
const MAX_RUNTIME = 400;     // ?v=NNN sürümlü script/style kopyaları

const CORE_ASSETS = [
    '/', '/index.html', '/manifest.json', '/icon.png', '/apple-touch-icon.png', '/social-preview.jpg', '/css/style.css',
    '/css/landing.css',
    '/src/domain/export/measurement-row.js','/src/domain/export/build-measurement-csv.js','/src/domain/export/build-measurement-geojson.js','/src/adapters/export/measurement-store.js','/src/domain/export/resolve-export-options.js','/src/application/export/serialize-measurement-export.js','/src/adapters/export/file-download.js','/src/application/export/download-user-measurement-export.js','/src/application/export/prepare-user-measurement-preview.js','/src/ui/export-preview.js',
    '/src/domain/offline/create-client-id.js','/src/domain/offline/same-measurement.js','/src/adapters/offline/idb-promises.js','/src/adapters/offline/measurement-queue.js','/src/ui/offline-sync-badge.js',
    '/src/domain/backup/sql-value.js','/src/domain/backup/build-restore-sql.js','/src/ui/restore-backup-prompt.js','/src/adapters/backup/download-restore-sql.js','/src/application/backup/restore-backup.js',
    '/src/domain/auth/resolve-turnstile-form.js','/src/adapters/auth/load-turnstile-script.js','/src/ui/turnstile-widget.js','/src/application/auth/turnstile-controller.js','/src/domain/auth/read-turnstile-token.js',
    '/src/domain/admin/measurement-review-payload.js','/src/adapters/admin/measurement-moderation-store.js','/src/application/admin/review-measurement.js','/src/application/admin/override-measurement-geofence.js','/src/application/admin/delete-measurement.js',
    '/src/config/supabase.js', '/src/config/constants.js', '/src/config/measurement-protocol-lock.js', '/src/config/wood-density-lock.js', '/src/config/species.js', '/src/config/i18n-en.js', '/src/config/i18n.js',
    '/src/adapters/trees/project-selection-memory.js','/src/application/trees/open-project-for-measurement.js','/src/ui/measurement-project-card.js','/src/ui/measurement-project-park-box.js','/src/ui/measurement-project-name-preview.js','/src/adapters/trees/fetch-owned-measurement-projects.js','/src/adapters/trees/fetch-shared-measurement-projects.js','/src/domain/trees/merge-measurement-projects.js','/src/ui/render-measurement-project-directory.js','/src/application/trees/load-measurement-project-directory.js','/src/application/trees/measurement-project-state.js','/src/domain/trees/build-measurement-project-write.js','/src/adapters/trees/persist-measurement-project.js','/src/application/trees/save-measurement-project.js','/src/ui/measurement-project-edit-form.js','/src/adapters/trees/reverse-geocode.js','/src/adapters/trees/load-measurement-photo.js','/src/ui/measurement-photo-summary.js','/src/ui/measurement-gps-button.js','/src/ui/measurement-species-selector.js',
    '/src/application/auth/show-password-recovery.js','/src/ui/show-auth-panel.js','/src/application/auth/select-auth-tab.js','/src/ui/render-auth-message.js','/src/application/auth/start-google-sign-in.js',
    '/src/services/osm-water-backup.js', '/src/utils/geo.js', '/src/utils/truncation.js', '/src/utils/lazylibs.js', '/src/domain/trees/photo-quality.js','/src/domain/trees/allometry.js','/src/application/trees/calculate-tree-carbon.js','/src/application/trees/calculate-tree-carbon-from-circumference.js','/src/application/trees/validate-measurement.js','/src/services/allometry.js','/src/domain/auth/is-oauth-callback.js','/src/domain/auth/read-oauth-error.js','/src/application/auth/login-with-password.js','/src/application/auth/register-account.js','/src/application/auth/send-password-reset-email.js','/src/application/auth/sign-out.js','/src/application/auth/save-new-password.js','/src/application/auth/wait-for-oauth-session.js','/src/application/auth/clean-oauth-url.js','/src/ui/oauth-wait-indicator.js', '/src/services/auth.js','/src/services/export.js', '/src/services/offline.js',
    /* YÖNETİM ZİNCİRİ (Faz 6): ziyaret sayacı, veri talepleri, kullanıcı yönetimi,
     * yedek ve moderasyon çekirdeği ayrı modüller. */
    '/src/domain/visitors/device-label.js','/src/domain/visitors/build-presence-payload.js','/src/domain/visitors/presence-ping-window.js','/src/domain/visitors/summarize-live-visitor-counts.js','/src/domain/visitors/build-live-location-trail.js','/src/domain/visitors/presence-retry-delay.js','/src/adapters/visitors/presence-channel.js','/src/adapters/visitors/remove-presence-channel.js','/src/adapters/visitors/track-presence.js','/src/application/visitors/upgrade-presence-auth.js','/src/application/visitors/render-owner-live-view.js','/src/application/visitors/stop-presence-session.js','/src/application/visitors/fail-presence-session.js','/src/application/visitors/start-presence-session.js','/src/application/visitors/resume-presence-session.js','/src/application/visitors/build-live-activity.js','/src/application/visitors/build-live-roster.js','/src/application/visitors/record-live-session-events.js','/src/application/visitors/record-presence-view.js','/src/application/visitors/record-presence-action.js','/src/application/visitors/build-stored-activity.js','/src/adapters/visitors/stored-activity-store.js','/src/adapters/visitors/live-visit-counts-store.js','/src/adapters/visitors/session-id-store.js','/src/adapters/visitors/track-visit.js','/src/adapters/visitors/admin-visit-counts-store.js','/src/ui/visitor-map-marker.js','/src/ui/visitor-live-panel.js','/src/ui/visitor-live-map.js','/src/ui/visitor-activity-disclosure.js','/src/ui/visitor-connection-status.js','/src/ui/visitor-roster.js','/src/ui/visitor-activity-feed.js','/src/ui/visitor-database-activity.js','/src/ui/visitor-view-labels.js','/src/ui/visitor-action-labels.js','/src/application/visitors/load-owner-activity.js','/src/application/visitors/load-owner-counts.js','/src/application/visitors/refresh-owner-view.js','/src/application/visitors/live-refresh-timer.js','/src/application/visitors/focus-live-location.js','/src/services/visit-stats.js','/src/domain/data-requests/find-pending-duplicate.js','/src/domain/data-requests/summarize-dataset.js','/src/adapters/data-requests/submit-store.js','/src/adapters/data-requests/fulfillment-store.js','/src/adapters/data-requests/options-store.js','/src/adapters/data-requests/my-requests-store.js','/src/adapters/data-requests/status-store.js','/src/domain/data-requests/partition-queue.js','/src/ui/data-request-pending-table.js','/src/adapters/data-requests/reply-window.js','/src/adapters/data-requests/queue-store.js','/src/ui/data-request-closed-table.js','/src/adapters/data-requests/delete-own-request.js','/src/ui/my-data-requests.js','/src/ui/data-request-reply-content.js','/src/application/data-requests/fulfill-request.js','/src/application/data-requests/submit-request.js','/src/application/data-requests/delete-own-request.js','/src/application/data-requests/reject-request.js','/src/application/data-requests/load-options.js','/src/application/data-requests/load-own-requests.js','/src/application/data-requests/load-queue.js','/src/ui/data-request-submission-feedback.js','/src/services/data-requests.js','/src/adapters/users/admin-store.js','/src/domain/users/summarize-admin-users.js','/src/ui/admin-user-table.js','/src/ui/admin-user-filter.js','/src/application/users/load-admin-users.js','/src/services/user-admin.js','/src/adapters/backup/paged-store.js','/src/domain/backup/build-snapshot.js','/src/adapters/backup/json-download.js','/src/application/backup/create-full-backup.js','/src/domain/backup/reminder-state.js','/src/services/backup.js',
    '/src/application/admin/read-photo-storage-usage.js','/src/ui/admin-storage-usage.js','/src/application/admin/clean-orphan-photos.js','/src/application/admin/re-geocode-measurements.js','/src/domain/admin/measurement-geojson.js','/src/ui/admin-measurement-row.js','/src/ui/admin-measurement-table.js','/src/domain/admin/export-filter-options.js','/src/application/admin/build-export-query.js','/src/application/admin/read-export-rows.js','/src/ui/admin-measurement-filter.js','/src/ui/fill-admin-export-select.js','/src/application/admin/load-admin-export-filters.js','/src/application/admin/update-admin-export-filter-options.js','/src/application/admin/download-admin-measurements.js','/src/services/admin.js','/src/adapters/admin/admin-tree-store.js','/src/domain/admin/group-measurement-tree.js','/src/domain/admin/filter-measurement-tree.js','/src/ui/admin-tree-formatters.js','/src/ui/admin-tree-pending-summary.js','/src/ui/admin-tree-measurement-row.js','/src/ui/admin-tree-user.js','/src/ui/admin-tree-project.js','/src/ui/admin-tree-park.js','/src/ui/admin-tree-view.js','/src/application/admin/refresh-tree-pending-badge.js','/src/application/admin/open-pending-tree-nodes.js','/src/application/admin/expand-measurement-tree.js','/src/application/admin/apply-tree-row-status.js','/src/application/admin/remove-tree-row.js','/src/services/admin-tree.js','/src/ui/park-comparison-row.js','/src/ui/park-comparison-pending.js','/src/ui/park-report-options.js','/src/ui/park-comparison-error.js','/src/adapters/world/park-comparison-store.js','/src/domain/parks/resolve-park-comparison-read.js','/src/application/world/load-park-comparison.js','/src/application/world/render-primary-park-comparison.js','/src/application/world/load-legacy-park-comparison.js','/src/application/world/show-park-comparison-denied.js','/src/domain/parks/prepare-park-comparison.js','/src/domain/parks/group-legacy-park-comparison.js','/src/ui/legacy-park-comparison.js','/src/application/world/zoom-to-location.js','/src/application/world/fit-measurement-rows.js','/src/domain/parks/summarize-park-report.js','/src/ui/park-report-summary.js','/src/ui/park-report-species-table.js','/src/domain/parks/build-park-report-csv.js','/src/ui/park-report-preview.js','/src/domain/parks/resolve-park-report-target.js','/src/domain/parks/build-park-report-request.js','/src/domain/parks/build-legacy-park-report-request.js','/src/adapters/parks/park-report-store.js','/src/application/world/load-park-report.js','/src/domain/map/is-valid-coordinate.js','/src/domain/map/select-waypoint-target.js','/src/ui/map-measurement-popup.js','/src/ui/map-measurement-markers.js','/src/ui/waypoint-list.js','/src/application/map/select-waypoint.js','/src/ui/waypoint-map-viewport.js','/src/domain/map/resolve-waypoint-guidance.js','/src/ui/waypoint-map-markers.js','/src/ui/waypoint-gps-overlay.js','/src/services/world.js','/src/adapters/trees/fetch-unvisited-measurement-waypoints.js','/src/adapters/trees/fetch-latest-measurement-point.js','/src/application/trees/suggest-next-measurement-point.js','/src/adapters/trees/fetch-measurement-at-project-point.js','/src/ui/measurement-point-query-result.js','/src/domain/trees/build-measurement-photo-file-name.js','/src/ui/compress-measurement-photo.js','/src/application/trees/prepare-measurement-photo.js','/src/adapters/trees/upload-measurement-photo.js','/src/adapters/trees/remove-measurement-photo.js','/src/services/measure.js','/src/services/map.js','/src/services/field-ux.js',
    '/src/application/admin/load-admin-tree.js','/src/application/admin/update-admin-tree-filter.js','/src/application/admin/set-admin-tree-node-open.js','/src/application/admin/navigate-admin-tree-pending-scan.js','/src/application/admin/delete-admin-tree-project.js',
    '/src/application/visitors/toggle-activity-disclosure.js','/src/application/visitors/restore-activity-disclosure.js','/src/application/visitors/update-live-visitor-filters.js','/src/application/visitors/set-live-visitor-pause.js','/src/application/visitors/fit-live-visitor-map.js',
    '/src/adapters/admin/admin-overview-store.js',
    '/src/domain/admin/summarize-admin-overview.js',
    '/src/ui/admin-overview-metrics.js',
    '/src/ui/admin-overview-measurements.js',
    '/src/application/admin/load-admin-overview.js',
    /* SİTE İÇİNDEN RAPOR YAYINI (2026-09-27): report_requests kuyruğu +
     * rapor/yayin-kuyrugu.json günlüğü → 📄 Yayınla / 🔗 Aç / 📤 Paylaş. */
    '/src/core/surface-display.js',
    '/src/domain/reports/report-context.js',
    '/src/domain/reports/normalize-report-orcid.js',
    '/src/domain/reports/clean-report-context.js',
    '/src/domain/reports/validate-report-context.js',
    '/src/domain/reports/decode-report-context.js',
    '/src/core/report-context.js',
    '/src/application/reports/collect-publication-request.js',
    '/src/domain/reports/publication-link.js',
    '/src/adapters/reports/publication-log-store.js',
    '/src/adapters/reports/publication-request-store.js',
    '/src/adapters/reports/park-comparison-store.js',
    '/src/adapters/reports/retraction-store.js',
    '/src/adapters/reports/publication-cancel-store.js',
    '/src/adapters/reports/user-publication-request-store.js',
    '/src/adapters/reports/own-approved-measurements-store.js',
    '/src/adapters/reports/user-retraction-store.js',
    '/src/application/reports/load-user-publication.js',
    '/src/domain/reports/publication-request-error.js',
    '/src/application/reports/request-publication.js',
    '/src/application/reports/cancel-publication-request.js',
    '/src/adapters/reports/retraction-insert-store.js',
    '/src/domain/reports/retraction-request-error.js',
    '/src/application/reports/open-user-publication-panel.js',
    '/src/application/reports/close-user-publication-panel.js',
    '/src/application/reports/sync-user-publication-panel.js',
    '/src/application/reports/schedule-user-publication-poll.js',
    '/src/application/reports/share-report-link.js',
    '/src/domain/reports/resolve-publication-park-status.js',
    '/src/ui/render-publication-park-row.js',
    '/src/ui/render-publication-history.js',
    '/src/application/reports/summarize-publication-queue.js',
    '/src/ui/render-publication-admin-card.js',
    '/src/application/reports/resolve-user-publication-view.js',
    '/src/ui/render-user-publication-controls.js',
    '/src/ui/render-user-publication-header.js',
    '/src/ui/render-user-publication-notices.js',
    '/src/ui/render-user-publication-card.js',
    '/src/application/reports/load-publication-queue.js',
    '/src/adapters/reports/publication-request-insert-store.js',
    '/src/application/reports/schedule-publication-queue-poll.js',
    '/src/application/reports/request-report-retraction.js',
    '/src/application/reports/refresh-after-report-retraction.js',
    '/src/application/reports/reset-publication-polling.js',
    '/src/application/reports/resolve-report-question-values.js',
    '/src/ui/report-question-fields.js',
    '/src/ui/report-question-confirmations.js',
    '/src/application/reports/validate-report-question-answer.js',
    '/src/application/reports/run-report-question-dialog.js',
    '/src/services/academic-profile.js',
    '/src/application/reports/resolve-academic-profile-defaults.js',
    '/src/ui/academic-profile-fields.js',
    '/src/ui/render-academic-profile.js',
    '/src/application/reports/save-academic-profile.js',
    '/src/application/reports/create-academic-report-collector.js',
    '/css/academic-profile.css',
    '/src/services/report-publish.js',
    /* PARK ÇALIŞMA ARKADAŞI (0025): davet/kabul kartları + ortak proje listesi. */
    '/src/domain/park-invites/access-policy.js',
    '/src/adapters/park-invites/store.js',
    '/src/ui/park-invite-inbox.js',
    '/src/ui/park-collaboration-panel.js',
    '/src/application/park-invites/manage-invites.js',
    '/src/application/park-invites/load-owned-parks.js',
    '/src/application/park-invites/load-recipient-invites.js',
    '/src/application/park-invites/load-owner-collaborations.js',
    '/src/application/park-invites/refresh-collaborations.js',
    '/src/ui/owner-park-options.js',
    '/src/services/park-invites.js',
    /* LULC ZİNCİRİ (Faz 5): eski landcover.js altı modüle bölündü; facade son sırada
     * (window.DG_LANDCOVER'u o kurar, yükleme anında lc-* global'lerini referanslar). */
    '/src/services/lc-config.js','/src/domain/surface/classify-landcover-code.js','/src/domain/surface/compare-source-class-areas.js','/src/domain/surface/geometry-bounds.js','/src/domain/surface/utm-projection.js','/src/domain/surface/clip-polygon-rect.js','/src/domain/surface/clip-polygon-convex.js','/src/domain/surface/projected-geometry-area.js','/src/services/lc-geo.js','/src/domain/surface/stac-fetch-policy.js','/src/adapters/surface/open-raster-range.js','/src/adapters/surface/sign-stac-assets.js','/src/domain/surface/select-stac-tiles.js','/src/domain/surface/resolve-raster-window.js','/src/services/lc-stac.js','/src/domain/surface/merge-tile-results.js','/src/adapters/surface/result-exports.js','/src/application/surface/analyze-source.js','/src/adapters/surface/process-landcover-tile.js','/src/services/lc-engine.js','/src/adapters/surface/load-osm-landcover-evidence.js','/src/domain/surface/extract-osm-water-polygons.js','/src/application/surface/refine-water-by-osm.js','/src/domain/surface/osm-road-policy.js','/src/application/surface/refine-hard-by-osm.js','/src/services/lc-osm.js','/src/domain/surface/patch-geometry.js','/src/domain/surface/group-patch-cells.js','/src/domain/surface/measure-patch-components.js','/src/domain/surface/query-green-patches.js','/src/services/lc-patches.js','/src/domain/surface/validation-sampling.js','/src/domain/surface/validation-accuracy-metrics.js','/src/domain/surface/validation-spectral-rules.js','/src/application/surface/build-validation-agreement.js','/src/application/surface/serialize-validation-campaign.js','/src/services/lc-validate.js','/src/domain/surface/select-sentinel-scenes.js','/src/domain/surface/sentinel-temporal-windows.js','/src/domain/surface/sentinel-raster-grid.js','/src/domain/surface/sentinel-spectral-evidence.js','/src/application/surface/build-sentinel-profile.js','/src/services/lc-s2.js','/src/ui/lc-report.js','/vendor/polygon-clipping-0.15.7.js','/src/workers/surface-worker.js','/src/contracts/surface-review.js','/src/adapters/surface/review-store.js','/src/domain/surface/review-geometry.js','/src/adapters/surface/osm-review-objects.js','/src/adapters/surface/review-worker.js','/src/application/surface/prepare-review.js','/src/application/surface/merge-review-features.js','/src/services/lc-review.js','/src/ui/lc-sens.js','/src/domain/surface/quality-gates.js','/src/contracts/surface-analysis.js','/src/application/surface/run-analysis.js','/src/services/landcover.js',
    /* PARK ZİNCİRİ (Faz 4): eski gridplan.js yedi modüle bölündü — yükleme
     * sırası index.html ile aynı olmalı (state → client → geometry → query →
     * engine → panel → export). */
    /* park-registry.js (2026-09-24): park kimliği + ölçüm kapısı. Sıra
     * index.html ile aynı: query'den sonra, grid-engine'den önce. */
    '/src/services/park-state.js','/src/domain/parks/normalize-overpass-cache-key.js','/src/adapters/parks/coalesce-overpass-requests.js','/src/domain/parks/select-overpass-mirrors.js','/src/domain/parks/overpass-request-budget.js','/src/adapters/parks/overpass-mirror-health.js','/src/services/osm-client.js','/src/domain/parks/road-half-width.js','/src/domain/parks/classify-surface-tags.js','/src/domain/parks/impervious-geometry.js','/src/domain/parks/area.js','/src/domain/parks/resolve-park-area.js','/src/domain/parks/segment-intersection.js','/src/domain/parks/point-in-polygon.js','/src/domain/parks/bounds.js','/src/domain/parks/park-containment.js','/src/domain/parks/line-distance.js','/src/domain/parks/osm-rings.js','/src/domain/parks/rect-intersection.js','/src/domain/parks/cell-in-park.js','/src/domain/parks/cell-validity.js','/src/domain/parks/park-overlap.js','/src/services/park-geometry.js','/src/domain/parks/simplify-ring.js','/src/adapters/parks/park-geometry-store.js','/src/application/parks/persist-park-geometry.js','/src/domain/parks/distance-to-park-boundary.js','/src/domain/parks/decide-park-geofence.js','/src/adapters/parks/read-fresh-gps-fix.js','/src/domain/parks/stamp-geofence-decision.js','/src/application/parks/verify-at-park.js','/src/services/geofence.js','/src/application/parks/find-park-candidates.js','/src/application/parks/fetch-detailed-coverage.js','/src/application/parks/classify-coverage-elements.js','/src/application/parks/find-nominatim-boundary.js','/src/adapters/parks/nominatim-client.js','/src/application/parks/share-detailed-coverage-request.js','/src/application/parks/commit-park-coverage-snapshot.js','/src/application/parks/collect-park-coverage-elements.js','/src/domain/parks/filter-park-coverage-to-boundary.js','/src/ui/park-water-layer-renderer.js','/src/services/park-query.js','/src/domain/parks/identity.js','/src/domain/parks/is-schema-error.js','/src/adapters/parks/park-store.js','/src/application/parks/register-park.js','/src/adapters/parks/project-store.js','/src/application/parks/create-project.js','/src/adapters/parks/project-link-store.js','/src/application/parks/link-project.js','/src/application/parks/detect-park.js','/src/application/parks/create-manual-park.js','/src/adapters/parks/park-search.js','/src/application/parks/search-park-by-name.js','/src/application/parks/build-park-admin-overview.js','/src/ui/park-admin-renderer.js','/src/application/parks/merge-park-identities.js','/src/application/parks/rename-park-identity.js','/src/application/parks/delete-park-identity.js','/src/application/parks/load-admin-park-identities.js','/src/application/parks/plan-park-backfill.js','/src/application/parks/apply-park-backfill.js','/src/application/parks/create-backfill-park.js','/src/application/parks/backfill-park-geometry.js','/src/adapters/parks/fetch-osm-park-ring.js','/src/application/parks/detect-backfill-park.js','/src/adapters/parks/search-osm-park-by-name.js','/src/application/parks/evaluate-measurement-park-gate.js','/src/ui/park-scan-card.js','/src/ui/park-identity.js','/src/ui/park-backfill-plan.js','/src/ui/park-backfill-progress.js','/src/ui/park-measurement-gate.js','/src/ui/park-project-options.js','/src/ui/park-admin-status.js','/src/ui/park-schema-warning.js','/src/application/parks/start-park-scan.js','/src/application/parks/focus-park-scan-target.js','/src/domain/parks/select-park-scan-step.js','/src/ui/preview-park-project-name.js','/src/application/parks/cancel-park-scan.js','/src/services/park-registry.js','/src/application/parks/build-grid-waypoint-rows.js','/src/application/parks/count-grid-cell-measurements.js','/src/application/parks/build-grid-request.js','/src/application/parks/is-grid-waypoint-context-current.js','/src/application/parks/resolve-grid-waypoint-readiness.js','/src/application/parks/select-grid-waypoint-cells.js','/src/application/parks/prepare-grid-surface-parts.js','/src/application/parks/resolve-grid-cell-style.js','/src/application/parks/count-grid-cell-states.js','/src/application/parks/grid-review-signature.js','/src/application/parks/prepare-grid-waypoint-batch.js','/src/adapters/parks/fetch-latest-grid-waypoint.js','/src/adapters/parks/insert-grid-waypoints.js','/src/adapters/parks/fetch-grid-measurement-candidates.js','/src/domain/parks/grid-options.js','/src/domain/parks/grid-bounds.js','/src/domain/parks/grid-cell-shape.js','/src/application/parks/grid-session-state.js','/src/ui/grid-build-completion.js','/src/ui/grid-build-controller.js','/src/application/parks/build-grid.js','/src/application/parks/create-grid-waypoints.js','/src/ui/grid-waypoint-controller.js','/src/ui/grid-waypoint-completion.js','/src/ui/grid-layer.js','/src/ui/grid-reset.js','/src/ui/map-layer-visibility.js','/src/ui/grid-selection.js','/src/ui/grid-summary.js','/src/ui/grid-waypoint-layer.js','/src/services/grid-engine.js','/src/ui/editor-ui.js','/src/ui/park-reference-area.js','/src/ui/park-mode-controller.js','/src/ui/park-click-controller.js','/src/ui/choose-new-park-controller.js','/src/ui/park-reset-controller.js','/src/ui/park-boundary-layer.js','/src/ui/park-candidate-select.js','/src/ui/park-info-panel.js','/src/ui/park-menu-ui.js','/src/ui/park-panel.js','/src/ui/park-image-geometry.js','/src/ui/park-landcover-analysis.js','/src/ui/park-export.js',
    '/src/domain/users/record-status-meta.js','/src/domain/users/group-own-records.js','/src/ui/record-item.js','/src/ui/record-project.js','/src/adapters/users/own-records-store.js',
    '/src/domain/users/summarize-tree-analysis.js','/src/ui/tree-analysis.js','/src/adapters/world/world-stats-store.js','/src/ui/world-stats-tables.js','/src/ui/world-error.js','/src/application/dashboard/load-own-records.js','/src/application/dashboard/delete-own-record.js','/src/application/dashboard/load-owner-dashboard.js','/src/ui/dashboard-chart.js','/src/application/dashboard/load-world-dashboard.js',
    '/src/services/dash.js',
    /* UI katmanı (Faz 1): index.html'in inline <script> bloğu bu dört modüle
     * taşındı — global state, toast, landing beyni ve kabuk önyüklemesi.
     * Yükleme sırası index.html'de de aynıdır: state → toast → landing → shell. */
    '/src/ui/gis-workspace-analysis-layout.js', '/src/ui/gis-workspace-menu-position.js', '/src/ui/gis-workspace-map-tools-view.js', '/src/ui/gis-workspace.js', '/src/ui/gis-project-draft.js', '/src/ui/gis-export-vegetation.js', '/src/ui/gis-export-layout.js', '/src/ui/gis-export-canvas-legend.js', '/src/ui/gis-export-canvas-waypoints.js', '/src/ui/gis-export-canvas-grids.js', '/src/ui/gis-export-canvas-leaflet.js', '/src/ui/gis-export-canvas-patches.js', '/src/ui/park-export-layout.js', '/src/domain/parks/park-export-formats.js', '/src/ui/park-export-canvas.js', '/src/ui/gis-export-canvas.js', '/src/ui/gis-export-events.js', '/src/application/surface/prepare-verified-map-export.js', '/src/ui/gis-export-download.js', '/src/ui/gis-export-verified-frame.js', '/src/ui/gis-export-verified-summary.js', '/src/ui/gis-export-verified-layers.js', '/src/ui/gis-export-verified-canvas.js', '/src/ui/gis-export-standard-layers.js', '/src/ui/gis-export-standard-canvas.js', '/src/ui/gis-export-bootstrap.js', '/src/ui/gis-export-presentation.js', '/src/ui/gis-export-platform.js', '/src/ui/gis-export-sources.js', '/src/ui/gis-export-workflow.js', '/src/ui/gis-export-verified-workflow.js', '/src/bootstrap/gis-export.js', '/src/ui/gis-export.js', '/src/ui/state.js', '/src/ui/toast.js', '/src/ui/landing.js', '/src/ui/shell.js',
    '/css/park-panel.css','/css/ui-standard.css','/css/gis-workspace.css',
    /* Üçüncü taraf kütüphaneler artık depoda (vendor/) — bkz. vendor/VERSIONS.md.
     * Aynı köken oldukları için SRI gerekmiyor ve çevrimdışı davranış
     * deterministik: CDN erişilemezse ya da CDN'de farklı bir sürüm
     * çözülürse uygulama etkilenmiyor. */
    '/vendor/leaflet-1.9.4.css',
    '/vendor/leaflet-1.9.4.js',
    '/vendor/MarkerCluster-1.5.3.css',
    '/vendor/MarkerCluster.Default-1.5.3.css',
    '/vendor/leaflet.markercluster-1.5.3.js',
    '/vendor/supabase-js-2.116.0.js',
    '/vendor/chart.js-4.5.1.js',
    '/vendor/geotiff-2.1.3.js',
    /* Turnstile BİLEREK CDN'de bırakıldı: auth.js tarafından dinamik enjekte
     * ediliyor ve Cloudflare bu betiği kendi sürümlüyor; sabitlemek widget
     * güncellemelerini kırar. Bu yüzden CSP'de challenges.cloudflare.com duruyor. */
    'https://challenges.cloudflare.com/turnstile/v0/api.js',
    'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
];

self.addEventListener('install', event => {
    console.log('[SW] 🌲 Kuruluyor...');
    self.skipWaiting();
    event.waitUntil(
        caches.open(PRECACHE).then(cache => {
            console.log('[SW] Temel varlıklar PRECACHE\'e yazılıyor (' + CORE_ASSETS.length + ' girdi)');
            return Promise.allSettled(
                CORE_ASSETS.map(url => cache.add(url).catch(err => console.warn(`[SW] Cache başarısız: ${url}`, err)))
            );
        })
    );
});

self.addEventListener('activate', event => {
    console.log('[SW] ✨ Aktifleştiriliyor...');
    event.waitUntil(
        caches.keys().then(keys => 
            Promise.all(
                keys
                    .filter(key => key.startsWith('precache-') || key.startsWith('runtime-') || key.startsWith('static-') || key.startsWith('tiles-') || key.startsWith('api-') || key.startsWith('images-'))
                    .filter(key => key !== PRECACHE && key !== RUNTIME && key !== TILE_CACHE && key !== API_CACHE && key !== IMG_CACHE)
                    .map(key => {
                        console.log(`[SW] 🗑️ Eski cache siliniyor: ${key}`);
                        return caches.delete(key);
                    })
            )
        ).then(async () => { await clearCachedWebFonts(); return self.clients.claim(); })
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    if (url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(cacheFirstWithLimit(request, TILE_CACHE, MAX_TILES));
        return;
    }

    // Application JS/CSS must not execute a stale deployment while online.
    // Çalışma zamanı kopyaları RUNTIME'a yazılır (sınırlı, trim edilir);
    // çevrimdışı yedeği PRECACHE'ten okunur (sınırsız ömürlü, trim edilmez).
    if (
        url.origin === self.location.origin &&
        (request.destination === 'script' || request.destination === 'style')
    ) {
        event.respondWith(networkFirstWithLimit(request, RUNTIME, MAX_RUNTIME, PRECACHE));
        return;
    }

    /* NOT: unpkg.com ve cdn.jsdelivr.net dalları buradaydı; kütüphaneler
     * vendor/ altına alınınca (c71f239) bu sitenin artık o origin'lere HİÇ
     * isteği kalmadı, yani dallar ölü koddu ve kaldırıldı. Bir gün yeniden
     * bir CDN kullanılırsa buraya geri eklenmeli ve CSP'ye de yazılmalı —
     * scripts/check-csp.mjs bu tutarlılığı denetliyor. */
    // Binary font files are served from the browser HTTP cache/network. Avoid
    // persisting a truncated WOFF response in CacheStorage and replaying it.
    if (url.hostname.includes('fonts.gstatic.com')) {
        event.respondWith(networkOnly(request));
        return;
    }

    // Turnstile sürümleri CacheStorage'dan tekrar oynatılmamalı.
    if (url.hostname === 'challenges.cloudflare.com') {
        event.respondWith(networkOnly(request));
        return;
    }

    if (url.hostname === 'fonts.googleapis.com') {
        event.respondWith(staleWhileRevalidate(request, RUNTIME));
        return;
    }

    if (
        url.hostname.includes('planetarycomputer.microsoft.com') ||
        url.hostname.endsWith('.blob.core.windows.net') ||
        url.hostname.endsWith('.s3.us-west-2.amazonaws.com')
    ) {
        // STAC and COG reads are scientific inputs; do not persist stale responses.
        event.respondWith(networkOnly(request));
        return;
    }

    if (url.hostname.includes('supabase.co')) {
        // Sadece public fotoğrafları cache'le (popup balonları için)
        if (url.pathname.includes('/storage/v1/object/public/')) {
            event.respondWith(cacheFirstWithLimit(request, IMG_CACHE, MAX_IMAGES));
            return;
        }
        // REST/Auth/RPC istekleri → doğrudan tarayıcı ağına yönlendir (CORS-güvenli passthrough)
        event.respondWith(fetch(request));
        return;
    }

    if (url.hostname.includes('nominatim.openstreetmap.org')) {
        event.respondWith(networkFirst(request, API_CACHE));
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const responseClone = response.clone();
                    caches.open(RUNTIME).then(cache => cache.put(request, responseClone));
                    return response;
                })
                // Çevrimdışı gezinme: PRECACHE'ten oku. caches.match()
                // (cache adı verilmeyen) TÜM cache'leri arar; activate'te eski
                // sürüm silinemediyse bayat bir kopya dönebilirdi.
                .catch(() => caches.open(PRECACHE).then(c =>
                    c.match(OFFLINE_URL).then(res => res || c.match('/index.html'))
                ))
        );
        return;
    }

    event.respondWith(staleWhileRevalidate(request, RUNTIME));
});

// 📨 Sadece SKIP_WAITING için message dinle (sync YOK)
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

async function cacheFirstWithLimit(request, cacheName, limit) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            await cache.put(request, response.clone());
            await trimCache(cacheName, limit);
        }
        return response;
    } catch (err) {
        return new Response('Offline Content', { status: 503, statusText: 'Offline' });
    }
}

/* Ağ öncelikli + sınırlı çalışma zamanı cache'i + PRECACHE yedeği.
 *
 * fallbackCache verilirse, çevrimdışıyken önce RUNTIME'da tam URL aranır,
 * bulunamazsa PRECACHE'te sorgusuz yol (origin + pathname) aranır. Böylece
 * "?v=139" ile istenen gridplan.js, install sırasında PRECACHE'e yazılmış
 * sorgusuz kopyasından yüklenebilir.
 *
 * ÖNEMLİ: yedek ayrı cache'ten okunur. Eskiden tek cache kullanılıyordu ve
 * trimCache FIFO ile precache girdilerini sildiği için bu yedek sessizce
 * yok oluyordu (bkz. dosya başındaki PRECACHE/RUNTIME açıklaması). */
async function networkFirstWithLimit(request, cacheName, limit, fallbackCache) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            await cache.put(request, response.clone());
            await trimCache(cacheName, limit);
        }
        return response;
    } catch (err) {
        const cache = await caches.open(cacheName);
        const cached = await cache.match(request);
        if (cached) return cached;

        // Offline + versioned asset: fall back to the unversioned precache.
        const url = new URL(request.url);
        const unversioned = url.origin + url.pathname;
        const fallbackSource = fallbackCache ? await caches.open(fallbackCache) : cache;
        const fallback = await fallbackSource.match(new Request(unversioned));
        if (fallback) return fallback;

        return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503, headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function networkFirst(request, cacheName) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            if (request.url.startsWith("http")) cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        return cached || new Response('Offline', { status: 503 });
    }
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request)
        .then(response => {
            if (response.ok) cache.put(request, response.clone()).catch(() => {});
            return response;
        })
        .catch(async () => {
            if (cached) return cached;
            // Ağ yok ve RUNTIME'da kopya yok → PRECACHE'teki sorgusuz kopya.
            // Sabit sürümlü CDN dosyaları (leaflet@1.9.4, geotiff@2.1.3)
            // CORE_ASSETS'te tam URL'leriyle durduğu için bu yedek çalışır.
            const url = new URL(request.url);
            const pre = await caches.open(PRECACHE);
            return pre.match(request) || pre.match(new Request(url.origin + url.pathname));
        });
    return cached || fetchPromise;
}

async function networkOnly(request) {
    try {
        // Bozuk HTTP önbelleğindeki font yanıtını tekrar kullanmayın.
        const options = new URL(request.url).hostname === 'fonts.gstatic.com'
            ? { cache: 'reload' } : undefined;
        return await fetch(request, options);
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503, headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function clearCachedWebFonts() {
    const cache = await caches.open(RUNTIME);
    const requests = await cache.keys();
    const fonts = requests.filter(request => {
        try { return new URL(request.url).hostname.includes('fonts.gstatic.com'); }
        catch (_) { return false; }
    });
    await Promise.all(fonts.map(request => cache.delete(request)));
}

/* Cache'i limite indirir.
 *
 * İki düzeltme:
 *  1) while döngüsü — eski hali `if` ile TEK girdi siliyordu; limit bir
 *     seferde birden fazla aşılırsa (ör. toplu yükleme) yetişemiyordu.
 *  2) keys.shift() FIFO'yu açıkça belgeler. Bu fonksiyon ARTIK PRECACHE
 *     ÜZERİNDE ÇAĞRILMAMALI — precache çevrimdışı yedeğidir ve sınırsız
 *     ömürlüdür. Yalnızca RUNTIME/TILE/API/IMG üzerinde çağrılır. */
async function trimCache(cacheName, limit) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    let fazla = keys.length - limit;
    while (fazla-- > 0) {
        const enEski = keys.shift();
        if (!enEski) break;
        await cache.delete(enEski);
    }
}

// 🔔 Push bildirimleri (gelecek kullanım)
self.addEventListener('push', event => {
    if (!event.data) return;
    const data = event.data.json();
    const title = data.title || 'DendroGeo Bildirim';
    const options = {
        body: data.body || 'Yeni bir güncelleme var.',
        icon: '/icon.png', badge: '/icon.png',
        data: data.url || '/', vibrate: [100, 50, 100]
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            for (const client of clientList) {
                if (client.url === event.notification.data && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(event.notification.data);
        })
    );
});

console.log('[SW] 🌲 DendroGeo Service Worker v2.10 r74 — network-first app assets');
