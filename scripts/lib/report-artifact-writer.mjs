import {join} from 'node:path';
import {reportMeasurementsCsv, reportMeasurementsGeoJson} from './report-export.mjs';

export function createReportArtifactWriter({mkdirSync, writeFileSync, renderReport, buildMetadata, mcRowCI}) {
  return function writeReportArtifacts({dir, id, snap, hash, png, version, verTxt, meta, history}) {
  const out = join(dir, id);
  mkdirSync(out, { recursive: true });
  if (png) writeFileSync(join(out, 'harita.png'), png);
  if(snap.lulc?.review)writeFileSync(join(out,'surface.geojson'),JSON.stringify({type:'FeatureCollection',features:snap.lulc.review.features}));
  const html = renderReport(snap, { id, hash, version, meta: Object.assign({}, meta, { history }) });
  writeFileSync(join(out, 'index.html'), html);
  writeFileSync(join(out, 'data.json'), JSON.stringify(snap)); /* 0012: sıkıştırılmış (arşiv boyutu ~%45 küçük) */
  writeFileSync(join(out, 'olcum.csv'), reportMeasurementsCsv(snap, mcRowCI));
  writeFileSync(join(out, 'park.geojson'), JSON.stringify(reportMeasurementsGeoJson(snap), null, 2));
  writeFileSync(join(out, 'metadata.json'), JSON.stringify(buildMetadata(snap, { id, hash, version: verTxt, meta, history })) + '\n'); /* 0012: sıkıştırılmış */
  return out;
  };
}
