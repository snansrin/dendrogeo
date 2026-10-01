"use strict";
/* DendroGeo · ui/state.js — UYGULAMANIN GLOBAL STATE'İ (tek sahip)
 *
 * Bu bildirimler eskiden index.html'in inline <script> bloğundaydı ve
 * measure/map/dash/world/admin servisleri bu isimleri ÇIPLAK GLOBAL olarak
 * okuyup yazıyordu. Klasik <script>'te üst düzey let, global LEXICAL kapsama
 * yazılır — dosya buraya taşınınca semantik birebir aynı kalır; tek fark
 * state'in artık tek bir sahibi olması.
 *
 * YÜKLEME SIRASI KURALI: bu dosya body sonunda, diğer src/ui/* dosyalarından
 * ÖNCE yüklenir. Servisler (head'de) bu isimlere yalnızca ÇAĞRI ANINDA
 * dokunduğu için sıra onları etkilemez. */
let USER=null,PROFILE=null,GPS=null,WP=[],navTarget=null,charts={},map=null,navMap=null,worldMap=null,worldMapL=null,EDIT_ID=null,EDIT_PROJ=null,liveLoaded=false,PROJ_LIST=[],photoOk=false;
/* DG_LIVE_DIRTY (2026-09-26): canlı haritanın işaretçi kümesi bayat mı?
 * Onay/red/silme ve çevrimdışı senkronizasyon bunu true yapar; go("map")
 * true görünce loadLiveMap() ile tazeler. Eskiden yalnız liveLoaded vardı ve
 * sekme bir oturumda BİR KEZ yüklendiği için yeni onaylanan nokta F5'e kadar
 * haritada görünmüyordu. */
let DG_LIVE_DIRTY=false;
/* KLAVYE ETKİNLEŞTİRME (0035 · P1-2): role="button" taşıyan div/tr öğeleri
 * Enter/Space ile de tıklanabilir. ui-audit handler'ı tanımlı sayar. */
function dgKeyActivate(ev,el){
 if(ev.key==="Enter"||ev.key===" "||ev.key==="Spacebar"){ev.preventDefault();if(el&&el.click)el.click();}
}

/* DOSYA ADI GÖSTERİMİ (0035c): .dg-file sarmalındaki seçili dosya adı.
 * Native "Dosya seçilmedi" metni tarayıcı dilinde kaldığı için gerekliydi. */
function dgFileName(ev,id){
 const s=$(id); if(s)s.textContent=(ev.target.files&&ev.target.files[0])?ev.target.files[0].name:"";
}
