"use strict";
/* Existing theme/font/button classes; this view owns no map or scientific state. */
(function(root){
 function render({escape:esc,baseName,rows,selectedId,ready,editing,status}){
  return `<div class="dg-png-head"><div><div class="dg-png-kicker">ÇALIŞMA KAPSAMI</div><div class="dg-png-title">Etap seçimi</div></div></div>`+
   `<p class="dg-meta">${esc(baseName)} · Seçilen etap ayrı park alanı olarak kullanılır. Eski projeler ve analizler taşınmaz.</p>`+
   `<label class="lbl" for="dgStageSelect">ETAP / PARK ALANI</label><select id="dgStageSelect" class="dg-png-select"><option value="whole">Ana parkın tamamı</option>`+
   rows.map(row=>`<option value="${Number(row.id)}"${Number(row.id)===Number(selectedId)?" selected":""}>${esc(row.geom_json.stage_scope.label)} · kullanıcı tanımlı</option>`).join("")+`</select>`+
   `<div class="dg-stage-actions"><button class="dg-png-btn primary" data-stage-action="apply">Seçili alanla çalış</button><button class="dg-png-btn" data-stage-action="edit"${ready?"":" disabled"}>Yeni etap tanımla</button></div>`+
   `<p class="dg-meta">Resmî etap sınırları doğrulanmadan otomatik bölünmez. Çizdiğiniz alan kullanıcı tanımlı olarak belirtilir.</p>`+
   (editing?`<div class="dg-stage-form"><label class="lbl" for="dgStageName">ETAP ADI</label><input id="dgStageName" class="dg-png-input" maxlength="80" placeholder="Örn. 1–2. etap çalışma alanı"><p class="dg-meta">Çizimi başlatın, haritada köşelere dokunun. Alan ana park sınırına kırpılır. Kaydetmek bu sınırı kabul eder; analiz kabulü ayrıca yapılır.</p><div class="dg-stage-actions"><button class="dg-png-btn" data-stage-action="draw">Sınır çizmeye başla</button><button class="dg-png-btn" data-stage-action="undo">Son köşeyi geri al</button><button class="dg-png-btn primary" data-stage-action="save">Sınırı kabul et ve kaydet</button><button class="dg-png-btn" data-stage-action="cancel">Vazgeç</button></div></div>`:"")+
   `<p id="dgStageStatus" class="dg-meta" role="status" aria-live="polite">${esc(status||(!ready?"Etap kaydı için sunucu kapsam koruması henüz etkin değil.":"Etap sınırını seçtikten sonra bu etap için yeni proje oluşturun."))}</p>`;
 }
 root.DG_PARK_STAGE_VIEW=Object.freeze({render});
})(window);
