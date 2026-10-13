"use strict";
(function(root){
 function render(){
  return '<details><summary>Rapor kapsamı ve DOI</summary><p class="dg-meta">Rapor; yöntem, birimler, nicel sonuçlar, harita, belirsizlikler, kalite kontrol, sınırlılıklar ve kaynakça içerir. Karbon hesabı yalnız ölçülen ağaçları kapsar. DOI, dış kayıt hizmetinde tescil edilmeden atanmış olarak gösterilmez.</p></details>'+ 
   '<label class="dg-academic-check"><input class="dg-switch" type="checkbox" name="publication_consent" required> Formda verdiğim bibliyografik bilgilerin raporda açık yayımlanmasını onaylıyorum.</label>'+ 
   '<label class="dg-academic-check"><input class="dg-switch" type="checkbox" name="review_confirmed" required> Girdiğim künyeyi ve raporun veri kapsamını kontrol ettim.</label>'+ 
   '<p id="dgReportQuestionErrors" role="alert" class="dg-meta"></p><div class="dg-profile-actions"><button class="btn sm ghost" type="button" data-close>Vazgeç</button><button class="btn" type="submit">📄 Raporu yayımla</button></div>';
 }
 root.DG_REPORT_QUESTION_CONFIRMATIONS=Object.freeze({render});
})(window);
