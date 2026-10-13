"use strict";

/* Preserve the distinct permission/network and missing-migration messages. */
(function(root){
  function create({warn,toast,isAdmin}){
    function notifyTransient(reason){
      warn("DENDROGEO · park kimliği okunamadı (şema değil, yetki/ağ):",reason);
      toast("⚠ Park kimliği geçici olarak okunamadı (yetki/ağ). Şema sorunu değil — sayfayı yenileyin.","warn","🌳");
    }
    function notifyMissing(reason){
      warn("DENDROGEO · park kimliği şeması eksik:",reason);
      toast(isAdmin()
        ?"⚠ Veritabanı şeması eski — park kimliği çalışmıyor. Supabase SQL Editor'da supabase/migrations/0004_parks.sql çalıştır."
        :"⚠ Park kimliği tabloları kurulmamış; yönetici 0004_parks.sql migration'ını uygulamalı.","warn","🌳");
    }
    return Object.freeze({notifyTransient,notifyMissing});
  }
  root.DG_PARK_SCHEMA_MISSING_FEEDBACK=Object.freeze({create});
})(window);
