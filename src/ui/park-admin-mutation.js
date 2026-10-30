"use strict";

/* Preserve the existing administrator prompts and mutation-result messages. */
window.DG_PARK_ADMIN_MUTATION_UI={
  promptRename(park,ports){return ports.prompt.call(window,ports.translate("Park adı (örn. Göksu Parkı):"),park.name);},
  confirmMerge(source,destination,ports){
    return ports.confirm.call(window,ports.translateFormat(
      '"{src}" (#{sid}) → "{dst}" (#{did}) birleştirilsin mi?\n\n· Projeler ve ölçümler hedef parka taşınır\n· Proje adları hedef park adına göre yeniden kurulur\n· Kaynak kimlik (#{sid}) SİLİNİR — geri alınamaz\n\nKarşılaştırma artık TEK "{dst}" satırı gösterir.',
      {src:source.name,sid:source.id,dst:destination.name,did:destination.id}));
  },
  confirmDelete(park,ports){
    return window.DG_TYPED_DELETE_CONFIRM.ask({kind:"park",id:park.id,name:park.name,warning:
      `"${park.name}" (#${park.id}) silinsin mi?\n\n`+
      `· Bağlı projeler park bağını KAYBEDER ("park yok" durumuna düşer, adları değişmez)\n`+
      `· Ölçümlerin park_id'si null olur — ÖLÇÜM SİLİNMEZ\n`+
      `· Yanlış/çift kimlikse silmek yerine 🔀 birleştirmeyi kullan`});
  },
  renameResult(result,ports){
    const {translate:t,translateCommon:tc,escape:esc,toast}=ports;
    if(result.status==="forbidden")toast("🔐 Bu işlem yalnız yöneticiye açık.","err");
    else if(result.status==="park-missing")toast("Park bulunamadı","err");
    else if(result.status==="empty-name")toast("Ad boş olamaz","err");
    else if(result.status==="write-failed")toast(tc("Ad güncellenemedi: ")+esc(result.error.message),"err");
    else if(result.status==="renamed"){
      toast(tc("✓ Park adı güncellendi: ")+esc(result.name)+(result.projectSyncError?"":" "+t("— proje adları yeniden kuruldu")),result.projectSyncError?"warn":"ok","🌳");
      if(result.projectSyncError)toast(tc("Proje adları eşitlenemedi: ")+esc(result.projectSyncError.message||String(result.projectSyncError)),"warn");
    }
    return result.status==="renamed";
  },
  mergeResult(result,ports){
    const {translate:t,translateCommon:tc,translateFormat:tf,escape:esc,toast}=ports;
    if(result.status==="forbidden")toast("🔐 Bu işlem yalnız yöneticiye açık.","err");
    else if(result.status==="invalid")toast("Geçersiz birleştirme","err");
    else if(result.status==="park-missing")toast("Park bulunamadı — 🔄 ile yenile","err");
    else if(result.status==="projects-failed")toast(tc("Projeler taşınamadı: ")+esc(result.error.message),"err");
    else if(result.status==="delete-failed")toast(t("Kaynak kimlik silinemedi: ")+esc(result.error.message),"err");
    else if(result.status==="merged"){
      if(result.measurementError)toast(tc("Ölçümler taşınırken hata: ")+esc(result.measurementError.message),"warn");
      toast(tf("✓ #{a} → #{b} birleştirildi",{a:result.sourceId,b:result.destinationId}),"ok","🔀");
    }
    return result.status==="merged";
  },
  deleteResult(result,ports){
    const {escape:esc,toast}=ports;
    if(result.status==="forbidden")toast("🔐 Bu işlem yalnız yöneticiye açık.","err");
    else if(result.status==="park-missing")toast("Park bulunamadı","err");
    else if(result.status==="write-failed")toast("Silinemedi: "+esc(result.error.message),"err");
    else if(result.status==="deleted")toast("✓ Park kimliği silindi","ok","🗑️");
    return result.status==="deleted";
  }
};
