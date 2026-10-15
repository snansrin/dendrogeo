"use strict";
(function(root){
 function render(){
  return '<div class="dg-report-dialog-footer"><p id="dgReportPublicationNotice" class="dg-meta">Raporu yayımla düğmesiyle, bu bilgilerin raporda açık yayımlanmasını onaylarsınız. <a href="/rapor/" target="_blank" rel="noopener">Rapor kapsamı ve DOI ↗</a></p>'+
   '<p id="dgReportQuestionErrors" role="alert" class="dg-meta"></p><div class="dg-profile-actions"><button class="btn sm ghost" type="button" data-close>Vazgeç</button><button class="btn" type="submit">📄 Raporu yayımla</button></div></div>';
 }
 root.DG_REPORT_QUESTION_CONFIRMATIONS=Object.freeze({render});
})(window);
