import {canonicalHash} from './canonical-hash.mjs';

export const MAP_PRESENTATION_CORRECTION='map-path-resolution-v1';
export const MAP_CORRECTION_NOTE='Harita sunumu düzeltmesi: ince yol sınırları korunmuş, PNG çözünürlüğü artırılmıştır. Ölçümler, kabul edilmiş yüzey geometrileri ve bilimsel sonuçlar değiştirilmemiştir.';

/* A correction derives only from a verified frozen snapshot, never live analysis. */
export function correctReportPresentation({source,metadata,id,generatedAt,gitCommit}){
 if(metadata.identifier!==source.provenance?.report_id||metadata.resultHash!=='sha256:'+canonicalHash(source))throw Error('Kaynak rapor bütünlüğü doğrulanamadı.');
 if(!/^DGR-\d{4}-\d{4}$/.test(id)||id===metadata.identifier)throw Error('Düzeltme için yeni rapor kimliği gerekir.');
 if(!source.lulc?.review?.features?.length)throw Error('Kabul edilmiş yüzey geometrisi bulunamadı.');
 const snap=structuredClone(source);
 snap.generated_at=generatedAt;
 snap.provenance.report_id=id;
 snap.presentation_correction={
  kind:MAP_PRESENTATION_CORRECTION,source_report:metadata.identifier,
  source_result_hash:metadata.resultHash,source_doi:metadata.doi||null,
  source_generated_at:source.generated_at,render_git_commit:gitCommit,
  pixel_ratio:3,note:MAP_CORRECTION_NOTE
 };
 return{snap,hash:canonicalHash(snap)};
}
