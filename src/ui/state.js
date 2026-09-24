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