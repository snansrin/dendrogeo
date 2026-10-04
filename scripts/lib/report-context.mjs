import '../../src/core/report-context.js';
import {parsePublication} from './publication.mjs';
export const reportContext=globalThis.DG_REPORT_CONTEXT;
export function decodeReportContext(note){
 let x;try{x=typeof note==='string'?JSON.parse(note):note;}catch{return null;}
 if(x?.schema==='dendrogeo-publication/1'){const p=parsePublication(x);return reportContext.clean({...p,author_name:p.researcher,project_name:p.project,advisor:p.supervisor,study_type:p.study_type==='thesis'?'Lisans bitirme çalışması':p.study_type==='inventory'?'Kurumsal envanter':'Araştırma raporu'});}
 return reportContext.decode(x);
}
