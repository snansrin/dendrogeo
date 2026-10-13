"use strict";
(function(root){
 function render(values,fields,examples,ports){
  const input=ports.input,label=ports.label,escape=ports.escape;
  return '<div class="dg-academic-grid">'+
   input('author_name','Yazar adı ve soyadı',values.author_name,true)+
   input('project_name','Proje adı',values.project_name,true)+
   input('title','Rapor başlığı',values.title,true)+
   '<label class="dg-academic-field">'+label('study_type','Çalışma türü')+'<select name="study_type"><option>Araştırma raporu</option><option>Lisans bitirme çalışması</option><option>Yüksek lisans çalışması</option><option>Doktora çalışması</option><option>Kurumsal envanter</option><option>Bağımsız saha çalışması</option></select></label>'+fields.filter(([key])=>key!=='project_name').map(([key,text])=>input(key,text,values[key])).join('')+
   input('start_date','Saha başlangıç tarihi (isteğe bağlı)',values.start_date)+input('end_date','Saha bitiş tarihi (isteğe bağlı)',values.end_date)+input('funding','Destekleyen kurum / proje numarası (isteğe bağlı)','')+
   '</div><label class="dg-academic-check"><input class="dg-switch" type="checkbox" name="independent" '+(values.independent?'checked':'')+'> Üniversite/kuruma bağlı olmayan bağımsız çalışma</label><label class="dg-academic-field">'+label('purpose','Çalışmanın amacı ve kapsamı',true)+'<textarea name="purpose" rows="3" required minlength="20" maxlength="1600" placeholder="'+escape(examples.purpose)+'">'+escape(values.purpose)+'</textarea></label>'+
   [['sampling','Örnekleme tasarımı (isteğe bağlı)',1600],['instruments','Saha yöntemi ve ölçüm cihazları (isteğe bağlı)',1000]].map(([key,text,max])=>'<label class="dg-academic-field">'+label(key,text)+'<textarea name="'+key+'" rows="2" maxlength="'+max+'" placeholder="'+escape(examples[key])+'">'+escape(values[key]||'')+'</textarea></label>').join('');
 }
 root.DG_REPORT_QUESTION_FIELDS=Object.freeze({render});
})(window);
