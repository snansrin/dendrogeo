"use strict";
/* Private account metadata → reusable defaults. A report publishes only confirmed fields. */
const DG_ACADEMIC_FIELDS=[['institution','Üniversite / kurum (isteğe bağlı)'],['department','Fakülte / bölüm (isteğe bağlı)'],['program','Program / çalışma alanı (isteğe bağlı)'],['advisor','Danışman (isteğe bağlı)'],['orcid','ORCID (isteğe bağlı)'],['project_name','Çalıştığınız projenin adı']];
const DG_REPORT_EXAMPLES={
 author_name:'Örnek: Sinan Şirin',
 project_name:'Örnek: Göksu Parkı Kentsel Ağaç Envanteri',
 title:'Örnek: Göksu Parkı Ağaç Envanteri ve Karbon Stoku Analizi',
 institution:'Örnek: Ankara Üniversitesi',
 department:'Örnek: Peyzaj Mimarlığı Bölümü',
 program:'Örnek: Lisans bitirme projesi / Kentsel ormancılık',
 advisor:'Örnek: Prof. Dr. Ad Soyad',
 orcid:'Örnek: 0000-0002-1825-0097',
 start_date:'Örnek: 2026-09-15',
 end_date:'Örnek: 2026-10-06',
 funding:'Örnek: BAP-2026-014 veya Destek yok',
 purpose:'Örnek: Parktaki ağaçların tür, yapısal özellik ve karbon stoklarını saha envanteriyle belirlemek.',
 sampling:'Örnek: Park sınırı içindeki önceden tanımlı waypointlerde erişilebilen ağaçlar bireysel olarak ölçüldü.',
 instruments:'Örnek: Göğüs çevresi esnek mezura ile 1,30 m’den; boy lazer metre ile; konum telefon GNSS ile ölçüldü.'
};
function dgAcademicDefaults(){return window.DG_RESOLVE_ACADEMIC_PROFILE_DEFAULTS.resolve(typeof USER!=="undefined"?USER:null,DG_REPORT_CONTEXT.clean);}
/* The profile field renderer preserves class="dg-field-help" and data-tip=; form contract includes advisor:, purpose:, sampling:, instruments:, Danışman (isteğe bağlı), and Saha başlangıç tarihi (isteğe bağlı). */
function dgFieldLabel(key,label,required=false){return window.DG_ACADEMIC_PROFILE_FIELDS.label(key,label,required,DG_REPORT_EXAMPLES,esc);}
function dgAcademicInput(key,label,value,required=false){return window.DG_ACADEMIC_PROFILE_FIELDS.input(key,label,value,required,{examples:DG_REPORT_EXAMPLES,fields:DG_REPORT_CONTEXT.fields,escape:esc});}
function dgAcademicProfileRender(){
 const box=$("dgAcademicProfile");if(!box||typeof USER==="undefined"||!USER)return;
 const values=dgAcademicDefaults(),name=PROFILE?.full_name||USER.user_metadata?.full_name||'Araştırmacı';
 window.DG_RENDER_ACADEMIC_PROFILE.mount(box,{values,name,fields:DG_ACADEMIC_FIELDS},{escape:esc,orcidValid:DG_REPORT_CONTEXT.orcidValid,input:dgAcademicInput});
}
async function dgAcademicProfileSave(event){
 return window.DG_SAVE_ACADEMIC_PROFILE.execute(event,{
  getStatus:()=>$("dgAcademicProfileStatus"),isAuthenticated:()=>!!USER,clean:DG_REPORT_CONTEXT.clean,
  formData:form=>new FormData(form),orcidValid:DG_REPORT_CONTEXT.orcidValid,
  update:value=>window.DG_AUTH_SESSION_STORE.create(()=>sb).updateProfileMetadata(value),
  acceptUser:user=>{USER=user;},render:dgAcademicProfileRender,
  savedStatus:()=>$("dgAcademicSavedStatus"),toast
 });
}
let DG_REPORT_DIALOG=null;
const DG_REPORT_DRAFTS=new Map();
const DG_REPORT_REQUEST_COLLECTOR=window.DG_CREATE_ACADEMIC_REPORT_COLLECTOR.create(window.DG_REPORT_PUBLICATION_REQUEST_APPLICATION,{
 userId:()=>typeof USER!=="undefined"&&USER?.id?USER.id:null,
 getProjectName:()=>{
  const project=typeof PROJ_LIST!=="undefined"?PROJ_LIST.find(p=>Number(p.id)===Number(typeof DG_USER_PUB!=="undefined"?DG_USER_PUB.projectId:0)):null;
  return project?.name||"";
 },
 collectContext:(parkId,projectName)=>dgReportQuestions(parkId,projectName),
 insertRequest:(parkId,lulc,note)=>dgPubInsertRequest(parkId,lulc,note),
 onSubmitted:key=>DG_REPORT_DRAFTS.delete(key)
});
function dgReportCollectRequest(parkId,lulc){return DG_REPORT_REQUEST_COLLECTOR(parkId,lulc);}
function dgReportQuestions(parkId,projectName){
 if(DG_REPORT_DIALOG)return Promise.resolve(null);if(typeof USER==="undefined"||!USER)return Promise.resolve(null);
  const defaults=dgAcademicDefaults(),name=PROFILE?.full_name||USER.user_metadata?.full_name||'';
  const currentPublication=typeof DG_USER_PUB!=="undefined"?DG_USER_PUB:null;
  const publicationParks=typeof DG_PUB_STATE!=="undefined"?(DG_PUB_STATE.parks||[]):[];
  const question=window.DG_RESOLVE_REPORT_QUESTION_VALUES.resolve({parkId,projectName,userId:USER.id,name,defaults,drafts:DG_REPORT_DRAFTS,currentPublication,publicationParks});
  const fields=window.DG_REPORT_QUESTION_FIELDS.render(question.values,DG_ACADEMIC_FIELDS,DG_REPORT_EXAMPLES,{input:dgAcademicInput,label:dgFieldLabel,escape:esc});
  const confirmations=window.DG_REPORT_QUESTION_CONFIRMATIONS.render();
  const html=`<form id="dgReportQuestionForm"><div class="dg-profile-heading"><div><div class="dg-kicker">YAYIN ÖNCESİ KÜNYE</div><h2 id="dgReportQuestionTitle">Bilimsel rapor bilgileri</h2><p class="dg-meta">${esc(question.parkName)} · Ağaç ölçümleri ve kabul edilen analiz otomatik aktarılır.</p></div><button class="btn sm ghost" type="button" data-close aria-label="Formu kapat">✖</button></div>${fields}${confirmations}</form>`;
  return window.DG_RUN_REPORT_QUESTION_DIALOG.run(html,{document,setCurrent:dialog=>{DG_REPORT_DIALOG=dialog;},studyType:question.values.study_type,submit:(form,modal)=>window.DG_VALIDATE_REPORT_QUESTION_ANSWER.execute(form,{formData:form=>new FormData(form),validate:value=>DG_REPORT_CONTEXT.validate(value),showErrors:text=>window.DG_RUN_REPORT_QUESTION_DIALOG.reportError(modal,text),saveDraft:value=>DG_REPORT_DRAFTS.set(question.key,value),now:()=>new Date().toISOString()})});
}
