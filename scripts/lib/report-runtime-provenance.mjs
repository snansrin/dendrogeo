/* Read authoritative runtime values independently; absent sources stay null. */
export function readReportRuntimeProvenance({read, readGitCommit}) {
  let engineVersion = null, appVersion = null, gitCommit = null;
  try {
    const match = read('src/services/lc-config.js').match(/DG_LC_ENGINE_VERSION\s*=\s*"([^"]+)"/);
    engineVersion = match ? match[1] : null;
  } catch {}
  try { appVersion = JSON.parse(read('package.json')).version || null; } catch {}
  try { gitCommit = readGitCommit().trim() || null; } catch {}
  return {engineVersion, appVersion, gitCommit};
}
