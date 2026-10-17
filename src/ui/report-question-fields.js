"use strict";
(function(root){
 function render(values,fields,examples,ports){
  const input=ports.input,label=ports.label,escape=ports.escape;
  return '<div class="dg-report-dialog-body"><p class="dg-meta">Tüm alanlar isteğe bağlıdır. Mevcut bilgilerle doğrudan yayımlayabilirsiniz.</p><div class="dg-academic-grid">'+
   input('title','Rapor başlığı',values.title,false)+input('author_name','Yazar adı ve soyadı',values.author_name,false)+
   '</div><details class="dg-report-extra"><summary>Ek bilgiler</summary><div class="dg-academic-grid">'+
   input('project_name','Proje adı',values.project_name,false)+
   '<label class="dg-academic-field">'+label('study_type','Çalışma türü')+'<select name="study_type"><option value="">Belirtilmedi</option><option>Araştırma raporu</option><option>Lisans bitirme çalışması</option><option>Yüksek lisans çalışması</option><option>Doktora çalışması</option><option>Kurumsal envanter</option><option>Bağımsız saha çalışması</option></select></label>'+fields.filter(([key])=>key!=='project_name').map(([key,text])=>input(key,text,values[key],false)).join('')+
   input('start_date','Saha başlangıç tarihi (isteğe bağlı)',values.start_date,false)+input('end_date','Saha bitiş tarihi (isteğe bağlı)',values.end_date,false)+input('funding','Destekleyen kurum / proje numarası (isteğe bağlı)',values.funding,false)+
   '</div><label class="dg-academic-check"><input class="dg-switch" type="checkbox" name="independent" '+(values.independent?'checked':'')+'> Üniversite/kuruma bağlı olmayan bağımsız çalışma</label>'+
   [['purpose','Çalışmanın amacı ve kapsamı',1600],['sampling','Örnekleme tasarımı',1600],['instruments','Saha yöntemi ve ölçüm cihazları',1000]].map(([key,text,max])=>'<label class="dg-academic-field">'+label(key,text)+'<textarea name="'+key+'" rows="2" maxlength="'+max+'" placeholder="'+escape(examples[key]||'')+'">'+escape(values[key]||'')+'</textarea></label>').join('')+
   '</details><details class="dg-field-protocol"><summary>Saha doğrulama bilgileri (isteğe bağlı)</summary><p class="dg-meta">Yalnız bilinen bilgileri girin. Boş alanlar doğrulanmış kabul edilmez; hesaplama katsayıları değişmez.</p>'+
   '<label class="dg-academic-field">'+label('inventory_scope','Envanter kapsamı')+'<select name="inventory_scope">'+[['','Belirtilmedi'],['census','Tam sayım (araştırmacı beyanı)'],['partial','Kısmi envanter'],['probability_sample','Olasılıklı örnekleme']].map(([key,text])=>'<option value="'+key+'"'+(values.inventory_scope===key?' selected':'')+'>'+text+'</option>').join('')+'</select></label>'+
   input('observers','Ölçümü yapan kişi / ekip',values.observers,false)+
   [['calibration','Cihaz kontrolü ve kalibrasyon',1200],['repeat_measurements','Tekrar ölçüm ve bağımsız kontrol',1200]].map(([key,text,max])=>'<label class="dg-academic-field">'+label(key,text)+'<textarea name="'+key+'" rows="2" maxlength="'+max+'" placeholder="'+escape(key==='calibration'?'Kontrol tarihi, referans ve sapma; yapılmadıysa belirtin.':'Yeniden ölçülen ağaç sayısı, eşleştirme ve kontrol yöntemi; yapılmadıysa belirtin.')+'">'+escape(values[key]||'')+'</textarea></label>').join('')+
   '</details></div>';
 }
 root.DG_REPORT_QUESTION_FIELDS=Object.freeze({render});
})(window);
