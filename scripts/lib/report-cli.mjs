export function createReportCli({arg, has, rebuildIndex, readFileSync, decodeReportContext, publishPark, log, error, exit}) {
return async function main() {
  if (has('reindex')) {
    const l = rebuildIndex();
    log(`✅ rapor/index.html yeniden kuruldu (${l.length} geçerli yayın).`);
    return;
  }
  const parkId = arg('park');
  if (!parkId) { error('Kullanım: node scripts/make-report.mjs --park <id> [--skip-lulc] | --reindex'); exit(2); return; }
  const publicationFile=arg('publication-file');if(!publicationFile)throw Error('Yayın künyesi gerekli: --publication-file künye.json');const study=decodeReportContext(readFileSync(publicationFile,'utf8'));if(!study)throw Error('Geçerli yayın künyesi gerekli.');
  const r = await publishPark(parkId, { skipLulc: has('skip-lulc'), study });
  log(`✅ Rapor yayınlandı: ${r.path}`);
  log(`   park   : ${r.park_name} (${r.city}) · n=${r.n}`);
  log(`   karbon : ${r.carbon_txt}`);
  log(`   hash   : sha256:${r.hash}`);
  log(`   sürüm  : ${r.report_version}${r.supersedes.length ? ' · yeniler: ' + r.supersedes.join(', ') : ''}`);
  log(`   LULC   : ${r.lulc}`);
  log(`   üst v. : ${r.metadata_path}`);
  log(`   bağlantı: ${r.url}`);
  log(`   atıf   : ${r.citation}`);
};
}
