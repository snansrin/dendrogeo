/* Report snapshot provenance contract.
 *
 * Pure assembly only: callers remain responsible for reading the authoritative
 * engine/app/git, measurement-protocol, and land-cover values. Keeping this
 * shape in one module makes the immutable report contract independently
 * reviewable and testable without changing how those values are sourced.
 */
export function buildReportProvenance({
  engineVersion,
  appVersion,
  gitCommit,
  fallbackGitCommit,
  reportId,
  measurementProtocol,
  measurementProtocolFingerprint,
  lulc,
  savedSurface,
  datasetDefault,
}) {
  return {
    engine: 'DendroGeo LC Engine',
    engine_version: engineVersion,
    app_version: appVersion,
    git_commit: gitCommit || fallbackGitCommit || null,
    report_id: reportId || null,
    report_standard: 'DendroGeo Academic Report 3.0',
    publication_stage: 'production',
    measurement_protocol: measurementProtocol,
    measurement_protocol_fingerprint: measurementProtocolFingerprint,
    epsg: (lulc && lulc.epsg) || null,
    resolution_m: savedSurface ? null : 10,
    resolution_note: savedSurface ? 'Uydu 10/20 m; OSM ve çizim vektör sınırları' : '10 m',
    dataset: (lulc && lulc.source) || datasetDefault,
  };
}
