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
 box.innerHTML=window.DG_RENDER_ACADEMIC_PROFILE.render({values,name,fields:DG_ACADEMIC_FIELDS},{escape:esc,orcidValid:DG_REPORT_CONTEXT.orcidValid,input:dgAcademicInput});
}
async function dgAcademicProfileSave(event){
 return window.DG_SAVE_ACADEMIC_PROFILE.execute(event,{
  getStatus:()=>$("dgAcademicProfileStatus"),isAuthenticated:()=>!!USER,clean:DG_REPORT_CONTEXT.clean,
  formData:form=>new FormData(form),orcidValid:DG_REPORT_CONTEXT.orcidValid,
  update:value=>sb.auth.updateUser({data:{dendrogeo_profile:value}}),
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
 if(window.DG_RESOLVE_REPORT_QUESTION_VALUES&&window.DG_REPORT_QUESTION_FIELDS&&window.DG_REPORT_QUESTION_CONFIRMATIONS&&window.DG_VALIDATE_REPORT_QUESTION_ANSWER&&window.DG_RUN_REPORT_QUESTION_DIALOG){
  const defaults=dgAcademicDefaults(),name=PROFILE?.full_name||USER.user_metadata?.full_name||'';
  const currentPublication=typeof DG_USER_PUB!=="undefined"?DG_USER_PUB:null;
  const publicationParks=typeof DG_PUB_STATE!=="undefined"?(DG_PUB_STATE.parks||[]):[];
  const question=window.DG_RESOLVE_REPORT_QUESTION_VALUES.resolve({parkId,projectName,userId:USER.id,name,defaults,drafts:DG_REPORT_DRAFTS,currentPublication,publicationParks});
  const fields=window.DG_REPORT_QUESTION_FIELDS.render(question.values,DG_ACADEMIC_FIELDS,DG_REPORT_EXAMPLES,{input:dgAcademicInput,label:dgFieldLabel,escape:esc});
  const confirmations=window.DG_REPORT_QUESTION_CONFIRMATIONS.render();
  const html=`<form id="dgReportQuestionForm"><div class="dg-profile-heading"><div><div class="dg-kicker">YAYIN ÖNCESİ KÜNYE</div><h2 id="dgReportQuestionTitle">Bilimsel rapor bilgileri</h2><p class="dg-meta">${esc(question.parkName)} · Ağaç ölçümleri ve kabul edilen analiz otomatik aktarılır.</p></div><button class="btn sm ghost" type="button" data-close aria-label="Formu kapat">✖</button></div>${fields}${confirmations}</form>`;
  return window.DG_RUN_REPORT_QUESTION_DIALOG.run(html,{document,setCurrent:dialog=>{DG_REPORT_DIALOG=dialog;},studyType:question.values.study_type,submit:(form,modal)=>window.DG_VALIDATE_REPORT_QUESTION_ANSWER.execute(form,{formData:form=>new FormData(form),validate:value=>DG_REPORT_CONTEXT.validate(value),showErrors:text=>{modal.querySelector('#dgReportQuestionErrors').textContent=text;},saveDraft:value=>DG_REPORT_DRAFTS.set(question.key,value),now:()=>new Date().toISOString()})});
 }
 const defaults=dgAcademicDefaults(),name=PROFILE?.full_name||USER.user_metadata?.full_name||'';let parkName='Park #'+parkId;
 if(typeof DG_USER_PUB!=="undefined"&&Number(DG_USER_PUB.parkId)===Number(parkId))parkName=DG_USER_PUB.parkName||parkName;
 if(typeof DG_PUB_STATE!=="undefined")parkName=DG_PUB_STATE.parks?.find(p=>Number(p.park_id)===Number(parkId))?.park_name||parkName;
 const draft=DG_REPORT_DRAFTS.get(USER.id+':'+parkId)||{};
 const values={...defaults,...draft,author_name:draft.author_name||defaults.author_name||name,project_name:draft.project_name||projectName||defaults.project_name,title:draft.title||parkName+' ağaç envanteri ve karbon stoku analizi',purpose:draft.purpose||'',study_type:draft.study_type||'Araştırma raporu'};
 const modal=document.createElement('dialog');modal.className='dg-academic-dialog';modal.setAttribute('aria-labelledby','dgReportQuestionTitle');modal.innerHTML=`<form id="dgReportQuestionForm"><div class="dg-profile-heading"><div><div class="dg-kicker">YAYIN ÖNCESİ KÜNYE</div><h2 id="dgReportQuestionTitle">Bilimsel rapor bilgileri</h2><p class="dg-meta">${esc(parkName)} · Ağaç ölçümleri ve kabul edilen analiz otomatik aktarılır.</p></div><button class="btn sm ghost" type="button" data-close aria-label="Formu kapat">✖</button></div><div class="dg-academic-grid">${dgAcademicInput('author_name','Yazar adı ve soyadı',values.author_name,true)}${dgAcademicInput('project_name','Proje adı',values.project_name,true)}${dgAcademicInput('title','Rapor başlığı',values.title,true)}<label class="dg-academic-field">${dgFieldLabel("study_type","Çalışma türü")}<select name="study_type"><option>Araştırma raporu</option><option>Lisans bitirme çalışması</option><option>Yüksek lisans çalışması</option><option>Doktora çalışması</option><option>Kurumsal envanter</option><option>Bağımsız saha çalışması</option></select></label>${DG_ACADEMIC_FIELDS.filter(([k])=>k!=='project_name').map(([k,l])=>dgAcademicInput(k,l,values[k])).join('')}${dgAcademicInput('start_date','Saha başlangıç tarihi (isteğe bağlı)',values.start_date)}${dgAcademicInput('end_date','Saha bitiş tarihi (isteğe bağlı)',values.end_date)}${dgAcademicInput('funding','Destekleyen kurum / proje numarası (isteğe bağlı)','')}</div><label class="dg-academic-check"><input class="dg-switch" type="checkbox" name="independent" ${values.independent?'checked':''}> Üniversite/kuruma bağlı olmayan bağımsız çalışma</label><label class="dg-academic-field">${dgFieldLabel('purpose','Çalışmanın amacı ve kapsamı',true)}<textarea name="purpose" rows="3" required minlength="20" maxlength="1600" placeholder="${esc(DG_REPORT_EXAMPLES.purpose)}">${esc(values.purpose)}</textarea></label>${[['sampling','Örnekleme tasarımı (isteğe bağlı)',1600],['instruments','Saha yöntemi ve ölçüm cihazları (isteğe bağlı)',1000]].map(([k,l,max])=>`<label class="dg-academic-field">${dgFieldLabel(k,l)}<textarea name="${k}" rows="2" maxlength="${max}" placeholder="${esc(DG_REPORT_EXAMPLES[k])}">${esc(values[k]||'')}</textarea></label>`).join('')}<details><summary>Rapor kapsamı ve DOI</summary><p class="dg-meta">Rapor; yöntem, birimler, nicel sonuçlar, harita, belirsizlikler, kalite kontrol, sınırlılıklar ve kaynakça içerir. Karbon hesabı yalnız ölçülen ağaçları kapsar. DOI, dış kayıt hizmetinde tescil edilmeden atanmış olarak gösterilmez.</p></details><label class="dg-academic-check"><input class="dg-switch" type="checkbox" name="publication_consent" required> Formda verdiğim bibliyografik bilgilerin raporda açık yayımlanmasını onaylıyorum.</label><label class="dg-academic-check"><input class="dg-switch" type="checkbox" name="review_confirmed" required> Girdiğim künyeyi ve raporun veri kapsamını kontrol ettim.</label><p id="dgReportQuestionErrors" role="alert" class="dg-meta"></p><div class="dg-profile-actions"><button class="btn sm ghost" type="button" data-close>Vazgeç</button><button class="btn" type="submit">📄 Raporu yayımla</button></div></form>`;
 document.body.appendChild(modal);DG_REPORT_DIALOG=modal;const previous=document.activeElement;
 return new Promise(resolve=>{let done=false;const finish=v=>{if(done)return;done=true;modal.close();modal.remove();DG_REPORT_DIALOG=null;previous?.focus?.();resolve(v);};modal.addEventListener('cancel',e=>{e.preventDefault();finish(null);});modal.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>finish(null)));modal.addEventListener('close',()=>finish(null));modal.querySelector('form').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;const obj=Object.fromEntries(new FormData(f));obj.independent=f.elements.independent.checked;const result=DG_REPORT_CONTEXT.validate(obj);if(!result.valid){modal.querySelector('#dgReportQuestionErrors').textContent=Object.values(result.errors).join(' ');f.elements[Object.keys(result.errors)[0]]?.focus();return;}DG_REPORT_DRAFTS.set(USER.id+':'+parkId,result.value);finish({schema:'dendrogeo-report-context/1',study:result.value,publication_consent:true,confirmed_at:new Date().toISOString()});});modal.querySelector('[name=study_type]').value=values.study_type;modal.showModal();modal.querySelector('input')?.focus();});
}
