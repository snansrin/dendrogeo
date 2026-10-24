"use strict";
/* Existing theme/font/button classes; this view owns no map or scientific state. */
(function(root){
 function render({escape:esc,baseName,rows,selectedId,ready,editing,status,proposals=[],previewIndex=-1,previewArea=null,draftName="",partCount=2,canSave=false,revision=false}){
  return `<div class="dg-png-title">Etap yönetimi</div><p class="dg-meta">${esc(baseName)}</p>`+
   (!editing?`<label class="lbl" for="dgStageSelect">KAYITLI ETAP / PARK</label><select id="dgStageSelect" class="dg-png-select"><option value="whole">Ana parkın tamamı</option>`+
   rows.map(row=>`<option value="${Number(row.id)}"${Number(row.id)===Number(selectedId)?" selected":""}>${esc(row.geom_json.stage_scope.label)}</option>`).join("")+`</select>`+
   `<div class="dg-stage-actions"><button class="dg-png-btn primary" data-stage-action="apply">Seçili etapta çalış</button><button class="dg-png-btn" data-stage-action="revise"${ready&&selectedId?"":" disabled"}>Etap düzenle</button><button class="dg-png-btn" data-stage-action="edit"${ready?"":" disabled"}>Yeni etap oluştur</button></div>`:"")+
   (editing?`<div class="dg-stage-form">`+(!revision?`<label class="lbl" for="dgStagePartCount">OTOMATİK BÖLÜM SAYISI</label><select id="dgStagePartCount" class="dg-png-select">${[2,3,4].map(n=>`<option value="${n}"${n===partCount?" selected":""}>${n} bölüm</option>`).join("")}</select>`+
   `<div class="dg-stage-actions"><button class="dg-png-btn primary" data-stage-action="suggest">Otomatik bölüm öner</button><button class="dg-png-btn" data-stage-action="pick">Başlangıç ve bitiş çizgilerini ayarla</button></div>`+
   `<p class="dg-meta">Başlangıçta 1.1, 1.2…; bitişte 2.1, 2.2… noktaları ekleyin. Parkın çevresi otomatik alınır.</p>`:`<button class="dg-png-btn" data-stage-action="pick-detail">Başlangıç / bitiş düzenlemesini aç</button>`)+
   (proposals.length?`<label class="lbl" for="dgStageProposal">ÖNERİLEN BÖLÜM</label><select id="dgStageProposal" class="dg-png-select"><option value="" disabled${previewIndex<0?" selected":""}>Çalışacağınız bölümü seçin</option>${proposals.map((p,i)=>`<option value="${i}"${i===previewIndex?" selected":""}>${esc(p.label)} · ${esc(p.areaLabel)}</option>`).join("")}</select>`:"")+
   (previewArea!=null?`<p class="dg-meta">Önizleme: <strong>${esc(previewArea)} ha</strong> · Parkın dış çizgisi ve boşlukları korunur.</p>`:"")+
   `<label class="lbl" for="dgStageName">ETAP ADI</label><input id="dgStageName" class="dg-png-input" maxlength="80" value="${esc(draftName)}" placeholder="Örn. 1. etap">`+
   `<p class="dg-meta">Öneriler parkın şekline göredir; resmî etap sınırı değildir. Onayladığınız alan kullanıcı tanımlı etap olarak kaydedilir.</p>`+
   (revision?`<p class="dg-meta">Düzenleme yeni etap sürümü olarak kaydedilir. Ana park ve önceki ölçümler korunur.</p>`:"")+
   (!revision?`<details class="dg-stage-advanced"><summary>Gelişmiş: serbest sınır çiz</summary><div class="dg-stage-actions"><button class="dg-png-btn" data-stage-action="draw">Sınır çizmeye başla</button><button class="dg-png-btn" data-stage-action="undo">Son köşeyi geri al</button></div></details>`:"")+
   `<div class="dg-stage-actions"><button class="dg-png-btn primary" data-stage-action="save"${canSave?"":" disabled"}>Etap olarak kaydet</button><button class="dg-png-btn" data-stage-action="cancel">Vazgeç</button></div></div>`:"")+
   `<p id="dgStageStatus" class="dg-meta" role="status" aria-live="polite">${esc(status||(!ready?"Etap koruması hazırlanıyor.":"Seçtiğiniz etap ayrı çalışma alanı olur; eski kayıtlar taşınmaz."))}</p>`;
 }
 root.DG_PARK_STAGE_VIEW=Object.freeze({render});
})(window);
