"use strict";
/* 0037: i18n güvenlikli yerel yardımcılar (harness'ler constants yüklemeyebilir). */
const _tms=(s)=>(typeof dgCf==="function"?dgCf(s):s);
const _tmsf=(t,v)=>(typeof dgTfs==="function"?dgTfs(t,v):String(t).replace(/\{(\w+)\}/g,(m,k)=>(v&&v[k]!=null?v[k]:m)));
/* ============ KONUMDAN İL/ÜLKE ALGILAMA ============ */
/* TÜRKİYE'de il adı "state" alanındadır (admin_level=4); ilçe "city/town"a düşer.
   TR için KESİN çözüm: önce state oku → ilçe asla gelmez. */
async function reverseGeocode(lat,lon){
 return window.DG_MEASUREMENT_REVERSE_GEOCODE.resolve(fetch,lat,lon);
}
/* --- 2. FOTOĞRAF DENETİMİ (0044 · ÇOK SINIFLI BİTKİ/DAL SEZGİSİ) ---
 * KULLANICI (0044): "%25'i kırmızı yapraklı ağaçlar sağlamıyor ve önümüz kış,
 * fotoğrafta sadece dal olacağı için yeşil çok az — o yüzden fotoğraf
 * yükleyemez kullanıcılar. Ben bugün 1 fotoğraf için sahada 30 dk harcadım."
 *
 * KÖK NEDEN (kanıtla): eski kapı YALNIZ yeşili sayıyordu (2G-R-B>20 && G>50).
 *   · mor/kırmızı yaprak (Prunus pissardii vb.) → %12 yeşil  → KAYIT ENGELLİ
 *   · kış çıplak dal                            → %0.4 yeşil → KAYIT ENGELLİ
 *   · sonbahar sarı/kızıl                       → %4-6 yeşil → KAYIT ENGELLİ
 *   · gövde+şerit metre (DBH) kadrajı           → %18 yeşil  → KAYIT ENGELLİ
 *   ÜSTELİK saf gökyüzü %52 "yeşil" sayılıp GEÇİYORDU: ExG indeksinde G>B
 *   koruması yoktu, mavi-gökkuşağı bandı yeşile düşüyordu.
 *
 * ÇÖZÜM: piksel başına ÇOK SINIFLI sınıflandırma + parlaklık-modu sapmasıyla
 * ince yapı (dal silüeti). Eşiklerin tamamı 22 karelik gerçek fotoğraf
 * korpusuyla kalibre edildi (test/photo-qa.test.mjs + calib/): yeşil ·
 * kızıl/mor (antosiyanin) · sonbahar (sarı/turuncu) · gövde/dal kahvesi ·
 * kış kadrajı (mavi gök fonu + dal silueti). Karar YİNE insanda: bu kapı
 * yalnızca BARİZ yanlış kareyi (gök/duvar/kapak/patlak) sahada erken
 * yakalar; ölçüm bilimine (QA_LIMITS, karbon motoru) DOKUNMAZ.
 *
 * dgPhotoScan SAF fonksiyondur (canvas verisi alır) → node'da testsiz
 * tarayıcı olmadan doğrulanabilir. */
function loadImg(file){return window.DG_MEASUREMENT_PHOTO_IMAGE.load(file);}
function dgPhotoScan(d,S){return window.DG_TREE_PHOTO_QUALITY.scan(d,S);}
/* KAPI (0044 · kalibre): pozlama teknik eşikleri + en az BİR bitki/dal kanıtı.
 *   foliage ≥ %5  VEYA  gövde/dal ≥ %5  VEYA  kış kadrajı
 *   (kış kadrajı = karenin ≥ %25'i gök mavisi İKEN ≥ %2.5 ince yapı veya
 *    ≥ %3 koyu silüet — çıplak dal fotoğrafının tek güvenilir imzası bu). */
function dgPhotoGate(m){
 return window.DG_TREE_PHOTO_QUALITY.gate(m);
}
/* Kullanıcıya NEYİ gördüğümüzü söyler (uyarı anlaşılır olsun, ezbere değil). */
function dgPhotoLabel(m){return window.DG_MEASUREMENT_PHOTO_SUMMARY.format(m,_tms);}
const DG_MEASUREMENT_PHOTO_CHECK_STATE=window.DG_MEASUREMENT_PHOTO_CHECK_STATE.create();
const DG_MEASUREMENT_PHOTO_PIXELS=window.DG_READ_MEASUREMENT_PHOTO_PIXELS_ADAPTER.create({getDocument:()=>document,getURL:()=>URL});
const DG_CHECK_MEASUREMENT_PHOTO_USE_CASE=window.DG_CHECK_MEASUREMENT_PHOTO.create({
 state:DG_MEASUREMENT_PHOTO_CHECK_STATE,element:$,setPhotoOk:value=>{photoOk=value;},selectFile:file=>window.DG_MEASUREMENT_PHOTO_FILE_UI.select(file,$),
 showInvalidType:box=>window.DG_MEASUREMENT_PHOTO_CHECK_UI.invalidType(box,_tms),showPending:box=>window.DG_MEASUREMENT_PHOTO_CHECK_UI.pending(box,_tms),
 loadImage:loadImg,readPixels:(loaded,size)=>DG_MEASUREMENT_PHOTO_PIXELS.read({image:loaded.i,url:loaded.u},size),
 scan:dgPhotoScan,gate:dgPhotoGate,label:dgPhotoLabel,showPassed:(box,metrics,label)=>window.DG_MEASUREMENT_PHOTO_CHECK_UI.passed(box,metrics,label,_tms),
 showFailed:(box,metrics)=>window.DG_MEASUREMENT_PHOTO_CHECK_UI.failed(box,metrics,_tms),showUnreadable:box=>window.DG_MEASUREMENT_PHOTO_CHECK_UI.unreadable(box,_tms),
 revokeObjectURL:url=>URL.revokeObjectURL(url)
});
function dgClearMeasurePhoto(){
 DG_MEASUREMENT_PHOTO_CHECK_STATE.invalidate();photoOk=false;
 return window.DG_MEASUREMENT_PHOTO_FILE_UI.clear($);
}
async function checkPhoto(e){return DG_CHECK_MEASUREMENT_PHOTO_USE_CASE(e);}
/* --- 3. GPS --- */
/* Ekran kilidi: saha ölçümü sırasında ekranın kararmasını engeller.
 * iOS Safari ekran kilitlendiğinde konum izlemeyi kestiği için bu, ölçümün
 * yarıda kalmasını önler. Sekme arka plana alınıp geri dönüldüğünde kilit
 * kendiliğinden bırakıldığı için visibilitychange ile yeniden alınır.
 * Desteklemeyen tarayıcılarda sessizce yok sayılır; ölçüm akışını etkilemez. */
let WAKE_LOCK=null;
const DG_MEASUREMENT_GEOLOCATION=window.DG_MEASUREMENT_GEOLOCATION_ADAPTER?window.DG_MEASUREMENT_GEOLOCATION_ADAPTER.create({getNavigator:()=>navigator}):null;
const DG_MEASUREMENT_WAKE_LOCK=window.DG_MEASUREMENT_WAKE_LOCK_ADAPTER?window.DG_MEASUREMENT_WAKE_LOCK_ADAPTER.create({getNavigator:()=>navigator,getDocument:()=>document}):null;
async function acquireWakeLock(){
 if(DG_MEASUREMENT_WAKE_LOCK)return DG_MEASUREMENT_WAKE_LOCK.acquire();
 if(!("wakeLock" in navigator))return;
 try{
  if(WAKE_LOCK)return;
  WAKE_LOCK=await navigator.wakeLock.request("screen");
  WAKE_LOCK.addEventListener("release",()=>{WAKE_LOCK=null;});
 }catch(e){WAKE_LOCK=null;}
}
if(!window._wakeLockHooked){
 window._wakeLockHooked=true;
 DG_MEASUREMENT_WAKE_LOCK?.bindVisibility(()=>{if(GPS)acquireWakeLock();});
}

/* CANLI BUTON (2026-09-26 · kullanıcı isteği): 📡 Konumu Etkinleştir, 🌿 Yüzey
 * Örtüsü Analizi butonuyla BİREBİR aynı davranışı kazanır (park-export.js
 * runLandCoverAnalysis deseni): basınca disabled + "⏳ Konum alınıyor…" +
 * opacity .65 + cursor wait; sonuçta eski metnine döner. Yeni tema/animasyon
 * YOK — aynı sınıf (.dg-png-btn primary) ve aynı mekanizma. */
function dgGpsBtnBusy(on){
 return window.DG_MEASUREMENT_GPS_BUTTON.setBusy(on,$);
}
async function startGps(){
 return window.DG_START_MEASUREMENT_GPS.start({
  geolocation:DG_MEASUREMENT_GEOLOCATION,
  isIOS:()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1),
  showIOSHint:()=>toast("<b>"+_tms("iPhone kullanıcısı mısınız?")+"</b><br>"+_tms("Ayarlar → Gizlilik ve Güvenlik → Konum Servisleri → Safari Siteleri → Uygulamayı Kullanırken."),"info","📍",12000),
  showStatus:(message,isError)=>window.DG_MEASUREMENT_GPS_STATUS_UI.show(message,isError,{element:$,setBusy:dgGpsBtnBusy,notify:message=>{if(typeof toast==="function")toast(message,"err","📍");}}),
  setBusy:dgGpsBtnBusy,setGPS:coords=>{GPS=coords;},updateGPS:updGps,
  liveSharePing:()=>{if(typeof dgLiveSharePing==="function")dgLiveSharePing();},presencePing:()=>{if(typeof dgPresencePing==="function")dgPresencePing();},
  acquireWakeLock,handleError:(error,ports)=>window.DG_HANDLE_MEASUREMENT_GPS_ERROR.handle(error,ports)
 });
}
function updGps(){
 return window.DG_REFRESH_MEASUREMENT_GPS_VIEW.refresh({
  getGPS:()=>GPS,format:coords=>window.DG_FORMAT_MEASUREMENT_GPS_READOUT.format(coords),
  renderReadout:view=>window.DG_MEASUREMENT_GPS_READOUT_UI.render(view,$),renderActive:view=>window.DG_MEASUREMENT_GPS_ACTIVE_STATE_UI.render(view,$),
  updateMarker:coords=>window.DG_UPDATE_MEASUREMENT_GPS_MAP_MARKER.update(map,coords,{getCurrentMarker:()=>window._me,setCurrentMarker:marker=>{window._me=marker;},createMarker:(...args)=>L.circleMarker(...args)}),
  drawNavigation:drawNav,suggestPoint:autoFillPointId
 });
}
/* --- 4. FORM YARDIMCILARI --- */
function fillSpecies(){return window.DG_MEASUREMENT_SPECIES_SELECTOR.fill({getElement:$,speciesData:typeof SPECIES_DATA!=="undefined"?SPECIES_DATA:null,turkishLabels:typeof DG_I18N_TR!=="undefined"?DG_I18N_TR:null,translate:value=>typeof dgT==="function"?dgT(value):value});}
function showLatin(){return window.DG_MEASUREMENT_SPECIES_SELECTOR.showLatin({getElement:$,latinNames:typeof LATIN!=="undefined"?LATIN:{}});}
const DG_TREE_MEASUREMENT_VALIDATOR=window.DG_TREE_MEASUREMENT_APPLICATION.createTreeMeasurementValidator({
 measurementGroups:typeof MEASUREMENT_GROUPS!=="undefined"?MEASUREMENT_GROUPS:[],
 resolveDensity:(species,group)=>(typeof densityKgFor==="function")?densityKgFor(species,group):null,
 isCircumferenceValid:c=>(typeof circumferenceIsValid==="function")?circumferenceIsValid(c):false
});
const DG_TREE_MEASUREMENT_ERRORS=Object.freeze({
 PROJECT_REQUIRED:["mProject","Bir çalışma projesi seçin."],
 POINT_ID_INVALID:["mPoint","Nokta ID pozitif bir tam sayı olmalı."],
 MEASUREMENT_NO_INVALID:["mNo","Ölçüm No pozitif bir tam sayı olmalı."],
 GROUP_REQUIRED:["mGroup","Ağaç grubunu seçin."],
 GROUP_UNSUPPORTED:["mGroup","Ölçüm yalnız İBRELİ veya YAPRAKLI grubunda yapılabilir."],
 SPECIES_REQUIRED:["mSpecies","Ağaç türünü seçin."],
 DENSITY_MISSING:["mSpecies","Tür/grup eşleşmesi kilitli yoğunluk tablosuna uygun değil."],
 CIRCUMFERENCE_INVALID:["mDbh","Göğüs çevresi 0’dan büyük olmalı ve çevre/π ile bulunan DBH en fazla 400 cm olabilir."],
 HEIGHT_INVALID:["mHeight","Boy 0’dan büyük, en fazla 100 m olmalı."]
});
function liveCalc(){
 const preview=window.DG_CALCULATE_LIVE_MEASUREMENT_PREVIEW.calculate({
  input:()=>window.DG_BUILD_LIVE_MEASUREMENT_PREVIEW_INPUT.build({circumference:$("mDbh").value,height:$("mHeight").value,species:$("mSpecies").value,group:$("mGroup").value}),
  validate:request=>DG_TREE_MEASUREMENT_VALIDATOR.validateBiometrics({group:request.group,species:request.species,circumferenceCm:request.circumferenceCm,heightM:request.heightM}),
  calculate:request=>calcFromCircumference(request.circumferenceCm,request.heightM,request.species,request.group)
 });
 return window.DG_RENDER_LIVE_MEASUREMENT_PREVIEW.render({preview,element:$("liveCalc"),getHint:()=>$("measureSaveHint"),translate:_tms});
}
function dgMeasureInvalid(id,message){return window.DG_SHOW_MEASUREMENT_VALIDATION_ERROR.show({fieldId:id,message,element:$,notify:toast});}
function dgResetMeasureFields(){return window.DG_RESET_MEASUREMENT_ENTRY_FIELDS.reset({element:$,clearPhoto:dgClearMeasurePhoto,setManualPoint:value=>{manualPoint=value;},liveCalc});}

/* --- 5. PROJE CRUD --- */
/* PROJE = PARK + ETİKET (2026-09-24).
 * Proje adı artık serbest metin değil: park algılanır, kullanıcı bir etiket
 * verir ("deneme") ve ad "Göksu Parkı - deneme" olur. Adı DB tarafında
 * trg_compose_project_name kurar; istemci dgProjectName() ile AYNI string'i
 * önizler. Park algılanmadan proje de ölçüm de açılamaz
 * (sunucu kapısı: trg_enforce_park_link → PARK_REQUIRED). */
let EDIT_PROJ_PARK=null;

/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
/* 0045: SON KULLANILAN PARK/PROJE hatırlanır (kullanıcı: "sayfa yenilendiğinde
 * park-proje değişmesin, en son hangisinde çalışılıyorsa onda kalsın").
 * Bellek CİHAZDA (localStorage): sunucuda yeni alan/şema/RLS yok (kırmızı çizgi).
 * Geri yükleme KOŞULLU: id hâlâ PROJ_LIST'te varsa seçilir — silinmiş/paylaşımdan
 * çıkmış proje hortlamaz; düzenleme modu (EDIT_ID) değeri zaten kendisi yazar. */
const DG_LAST_PROJ_KEY="dg_last_proj";
function dgProjectRemember(id){return window.DG_PROJECT_SELECTION_MEMORY.remember(localStorage,DG_LAST_PROJ_KEY,id);}
function dgProjectRestore(){
 const last=window.DG_PROJECT_SELECTION_MEMORY.restore(localStorage,DG_LAST_PROJ_KEY,PROJ_LIST);
 if(!last)return;
 for(const id of ["mProject","nProject"]){const select=$(id);if(select)select.value=last;}
}
function dgProjectOpenMeasure(id){
 return window.DG_OPEN_PROJECT_FOR_MEASUREMENT.open(id,{
  projects:()=>PROJ_LIST,remember:dgProjectRemember,go, schedule:(fn,delay)=>setTimeout(fn,delay),measureSelect:()=>$("mProject"),
  projectChanged:()=>{if(typeof dgProjectChanged==="function")dgProjectChanged();},parkGate:()=>{if(typeof dgParkGate==="function")dgParkGate();}
 });
}
function dgProjectCard(p,isShared){
 return window.DG_MEASUREMENT_PROJECT_CARD.render(p,isShared,{formatArea:dgFmtHa,escape:esc,isAdmin:dgIsAdmin});
}
async function loadProjects(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadProjects__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadProjects__scroll(){
 if(!USER)return;
 await window.DG_LOAD_MEASUREMENT_PROJECT_DIRECTORY.load({
  fetchOwned:()=>window.DG_OWNED_MEASUREMENT_PROJECTS.fetch({client:sb,userId:USER.id,onRelationError:dgParkSchemaMissing}),
  fetchShared:owned=>window.DG_SHARED_MEASUREMENT_PROJECTS.fetch({client:sb,ownedProjects:owned,listMyParks:typeof dgMyParks==="function"?dgMyParks:undefined}),
  merge:(owned,shared)=>window.DG_MERGE_MEASUREMENT_PROJECTS.merge(owned,shared),
  onState:state=>{PROJ_LIST=state.projects;},
  render:projects=>window.DG_MEASUREMENT_PROJECT_DIRECTORY_UI.render({projects,element:$,escape:esc,optionLabel:dgProjectOptionLabel,restore:dgProjectRestore,renderCard:dgProjectCard,editing:EDIT_PROJ,actions:{openMeasure:dgProjectOpenMeasure,publish:id=>window.dgUserPubOpen?.(id),startParkScan:id=>startParkScan({projectId:id,returnTo:"projects"}),edit:editProject,delete:deleteProject}}),
  afterRender:projects=>{dgRenderProjectParkBox();dgParkGate();if(typeof dgUserPubSync==="function")dgUserPubSync(projects);}
 });
}/* Projeler sekmesindeki "park" kutusu: hangi park algılanmış, ad nasıl olacak. */
function dgRenderProjectParkBox(){
 const park=EDIT_PROJ?EDIT_PROJ_PARK:DG_PARK;
 return window.DG_MEASUREMENT_PROJECT_PARK_BOX.render({box:$("projParkBox"),park,escape:esc,formatArea:dgFmtHa,getElement:$,previewName:dgProjectNamePreview,actions:{scan:()=>startParkScan({returnTo:"projects"})}});
}function dgProjectNamePreview(){
 const park=EDIT_PROJ?EDIT_PROJ_PARK:DG_PARK,label=($("pLabel")?$("pLabel").value:"").trim();
 return window.DG_MEASUREMENT_PROJECT_NAME_PREVIEW.render({element:$("pNamePreview"),park,label,projectName:dgProjectName});
}function editProject(id){
 return window.DG_MEASUREMENT_PROJECT_EDIT_FORM.begin(id,{projects:()=>PROJ_LIST,element:$,setEditing:(projectId,park)=>{EDIT_PROJ=projectId;EDIT_PROJ_PARK=park;},labelFromLegacy:dgLabelFromLegacy,renderParkBox:dgRenderProjectParkBox});
}function cancelProjectEdit(){
 return window.DG_MEASUREMENT_PROJECT_EDIT_FORM.cancel({projects:()=>PROJ_LIST,element:$,setEditing:(id,park)=>{EDIT_PROJ=id;EDIT_PROJ_PARK=park;},renderParkBox:dgRenderProjectParkBox});
}async function createProject(){
 await window.DG_SAVE_MEASUREMENT_PROJECT.save({
  label:()=>$("pLabel").value,
  form:()=>({editId:EDIT_PROJ,editPark:EDIT_PROJ_PARK,park:DG_PARK,userId:USER.id,country:$("pCountry").value,city:$("pCity").value,composeName:dgProjectName}),
  build:form=>window.DG_BUILD_MEASUREMENT_PROJECT_WRITE.build(form),
  persist:command=>window.DG_PERSIST_MEASUREMENT_PROJECT.persist({client:sb,command}),
  requirePark:command=>{if(command.mode==="update"){toast("Bu proje parka bağlı değil — önce park algıla.","err","🌳");startParkScan({projectId:command.projectId,returnTo:"projects"});}else{toast("Önce park algıla — park olmadan proje açılamaz.","err","🌳");startParkScan({returnTo:"projects"});}},
  failure:error=>toast("Hata: "+error.message,"err"),
  updated:()=>{toast("✓ Proje güncellendi","ok","📁");cancelProjectEdit();},
  created:command=>{toast(dgCf("✓ Proje oluşturuldu: ")+command.name,"ok","📁");$("pLabel").value="";},
  refresh:()=>loadProjects()
 });
}
async function deleteProject(id){
 return window.DG_DELETE_MEASUREMENT_PROJECT.remove(id,{
  count:projectId=>window.DG_MEASUREMENT_PROJECT_DELETION_STORE.countMeasurements({client:sb,projectId}),
  confirm:count=>window.DG_CONFIRM_MEASUREMENT_PROJECT_DELETE.confirm({count,format:dgTfs,confirm}),
  delete:projectId=>window.DG_MEASUREMENT_PROJECT_DELETION_STORE.delete({client:sb,projectId}),
  refresh:loadProjects
 });
}/* --- 6. NOKTA YÖNETİMİ --- */
let manualPoint=false;
let dgPointRequest=0;
async function autoFillPointId(){
 return window.DG_SUGGEST_NEXT_MEASUREMENT_POINT.suggest({
  canStart:()=>!manualPoint&&!EDIT_ID,
  projectId:()=>+$("mProject").value,
  pointValue:()=>$("mPoint").value,
  gps:()=>GPS,
  canSuggest:pid=>!manualPoint&&!EDIT_ID&&+$("mProject").value===pid&&!$("mPoint").value,
  fetchWaypoints:projectId=>window.DG_FETCH_UNVISITED_MEASUREMENT_WAYPOINTS.fetch({client:sb,projectId}),
  fetchLatest:projectId=>window.DG_FETCH_LATEST_MEASUREMENT_POINT.fetch({client:sb,projectId}),
  distance:(lat1,lon1,lat2,lon2)=>hav(lat1,lon1,lat2,lon2),
  setPoint:value=>{$("mPoint").value=value;}
 });
}
async function queryPointId(){
 const result=$("pointQueryResult");
 return window.DG_QUERY_MEASUREMENT_POINT.query({
  projectId:+$("mProject").value,pointId:+$("mPoint").value,
  resolve:(projectId,pointId)=>window.DG_RESOLVE_MEASUREMENT_POINT_QUERY.resolve(projectId,pointId),
  read:target=>window.DG_FETCH_MEASUREMENT_AT_PROJECT_POINT.fetch({client:sb,projectId:target.projectId,pointId:target.pointId}),
  isCurrent:target=>+$("mProject").value===target.projectId&&+$("mPoint").value===target.pointId,
  hide:()=>window.DG_MEASUREMENT_POINT_QUERY_RESULT.hide(result),
  render:(record,pointId)=>window.DG_MEASUREMENT_POINT_QUERY_RESULT.render({element:result,record,pointId,escape:esc,translate:_tms,translateFormat:_tmsf,circumferenceFromDiameter:value=>typeof circumferenceCmFromDiameter==="function"?circumferenceCmFromDiameter(+value):null,actions:{edit:id=>editRec(id),delete:id=>delRec(id)}})
 });
}/* --- 7. KAYDET (EN BÜYÜK) --- */
/* CANLI BUTON (2026-09-27 · kullanıcı isteği): 💾 Hesapla ve Kaydet, 🌿 ve 📡
 * butonlarıyla BİREBİR aynı deseni kullanır: basınca disabled + "⏳ …" +
 * soluk + wait imleci; her çıkış yolunda (başarı/hata/erken return) finally
 * ile geri gelir. Yeni tema yok — aynı aile, aynı mekanizma. */
function dgSaveBusy(on){
 dgMeasureSaving=!!on;
 return window.DG_SET_MEASUREMENT_SAVE_BUTTON.setBusy(on,{button:$("saveBtn"),editing:!!EDIT_ID,parkGate:dgParkGate});
}
let dgMeasureSaving=false;
async function saveMeas(){
 return window.DG_RUN_MEASUREMENT_SAVE.run({isBusy:()=>dgMeasureSaving,setBusy:dgSaveBusy,save:dgSaveMeasInner,failed:()=>toast(_tms("Kayıt tamamlanamadı. Bilgileriniz formda duruyor; yeniden deneyin."),"err")});
}
async function dgSaveMeasInner(){
      const form={projectId:+$("mProject").value,pointId:+$("mPoint").value,measurementNo:+$("mNo").value,group:$("mGroup").value,species:$("mSpecies").value,circumferenceCm:+$("mDbh").value,heightM:+$("mHeight").value};
      return window.DG_SUBMIT_MEASUREMENT.run({form,editId:EDIT_ID},{
        validation:{
          validateForm:value=>window.DG_VALIDATE_MEASUREMENT_SAVE_FORM.validate({form:value,element:$,validator:DG_TREE_MEASUREMENT_VALIDATOR,errors:DG_TREE_MEASUREMENT_ERRORS,translate:_tms}),
          resolveGates:value=>window.DG_RESOLVE_MEASUREMENT_SAVE_GATES.resolve({projectId:value.form.projectId,editId:EDIT_ID,projects:PROJ_LIST,parkSchemaOk:DG_PARK_SCHEMA_OK,gps:GPS,photoValid:!($("mPhoto").files[0]&&!photoOk)})
        },
        stopForValidation:result=>{
          if(result.reason==="form")return dgMeasureInvalid(result.validation.focusId,result.validation.message);
          if(result.reason==="calculation")return dgMeasureInvalid("mSpecies",_tms("Kilitli yoğunluk tablosu bu ölçüm için karbon hesabına izin vermiyor."));
          if(result.reason==="park-required"){
            toast("⛔ Bu projede park algılanmadı — ölçüm giremezsin. Park algılama ekranına yönlendiriliyorsun.","err","🌳");
            return startParkScan({projectId:form.projectId||null,returnTo:"measure"});
          }
          if(result.reason==="gps-required")return toast("Önce 📡 Konumu Etkinleştir butonuna basın","err");
          if(result.reason==="photo-invalid")return toast("Fotoğraf denetimi başarısız — uygun bir çekim yapın","err");
        },
        prepare:{
          rememberProject:dgProjectRemember,
          preparePhoto:async value=>{const file=$("mPhoto").files[0];if(!file)return{blob:null,fileName:null};const prepared=await window.DG_PREPARE_MEASUREMENT_PHOTO.prepare({file,pointId:value.pointId,measurementNo:value.measurementNo,compress,buildFileName:parts=>window.DG_BUILD_MEASUREMENT_PHOTO_FILE_NAME.build(parts)});return{blob:prepared.blob,fileName:prepared.fileName};},
          calculate:value=>calcFromCircumference(value.circumferenceCm,value.heightM,value.species,value.group),
          buildRecord:({form:value,calculation,project})=>{const record=window.DG_BUILD_MEASUREMENT_RECORD.build({owner:USER.id,projectId:value.projectId,pointId:value.pointId,measurementNo:value.measurementNo,group:value.group,species:value.species,circumferenceCm:value.circumferenceCm,dbhCm:calculation.dbh_cm,heightM:value.heightM,volumeM3:calculation.vol,carbonKg:calculation.total_carbon,parkSchemaOk:DG_PARK_SCHEMA_OK,parkId:project&&project.park_id});if(DG_PARK_SCHEMA_OK)record.park_id=(project&&project.park_id)||null;return record;},
          createClientId:uuidv4,gps:()=>GPS,reverseGeocode:fix=>reverseGeocode(fix.latitude,fix.longitude),
          buildLocationFields:({fix,geocode})=>{if(geocode)toast(dgCf("📍 Konum algılandı: ")+esc(geocode.city)+" / "+esc(geocode.country),"info","🗺️");return window.DG_BUILD_MEASUREMENT_LOCATION_FIELDS.build({fix,geocode});}
        },
        location:{
          loadPark:id=>window.DG_FETCH_MEASUREMENT_PARK.fetch({client:sb,id}),
          verifyAtPark:park=>dgVerifyAtPark(park,"measure"),stamp:dgGeoStamp
        },
        locationRejected:({decision})=>toast("⛔ "+esc(decision.message||_tmsf("Konum doğrulanamadı ({r})",{r:decision.reason})),"err","🛰"),
        persistence:{
          isOnline:()=>navigator.onLine,
          buildOfflineRecord:draft=>window.DG_BUILD_OFFLINE_MEASUREMENT_RECORD.build({record:draft.record,photoBlob:draft.photo.blob,photoFile:draft.photo.fileName,editId:EDIT_ID,clientId:uuidv4()}),
          saveOffline:saveOfflineMeasurement,uploadPhoto:blob=>window.DG_UPLOAD_MEASUREMENT_PHOTO.upload({client:sb,userId:USER.id,blob}),
          persistRecord:(record,editId)=>window["DG_"+"PERSIST_MEASUREMENT_RECORD"].persist({client:sb,record,editId}),editId:()=>EDIT_ID
        },
        writeFailed:error=>toast("Hata: "+error.message,"err"),
        complete:({draft,location,mode})=>{
          const wasEdit=draft.wasEdit,point=draft.form.pointId;
          if(location.decision?.verified)toast(dgCf("🛰 Konum doğrulandı: ")+esc(location.park.name)+(location.decision.reason==="margin"?" ("+_tms("kenar payı")+")":"")+" · ±"+Math.round(location.decision.fix.acc)+" m","ok","🛰");
          if(mode==="offline"){
            toast("Çevrimdışı kaydedildi — internet gelince senkronize","info","📴");
            if(window.DG_RECORD_MEASUREMENT_PRESENCE_ACTION)window.DG_RECORD_MEASUREMENT_PRESENCE_ACTION.record(wasEdit?"edit":"save","P"+String(point).padStart(3,"0"),dgPresenceAct);
            else if(typeof dgPresenceAct==="function"){try{dgPresenceAct(wasEdit?"edit":"save","P"+String(point).padStart(3,"0"));}catch(e){}}
            if(wasEdit)cancelEdit();
            return window.DG_REFRESH_MEASUREMENT_AFTER_SAVE.offline({wasEdit,reset:dgResetMeasureFields,autoFill:autoFillPointId,loadDashboard:loadDash,loadRecords});
          }
          if(wasEdit){toast("Kayıt güncellendi — onaya gönderildi","ok","✓");cancelEdit();}
          else{
            toast("Kaydedildi — "+draft.calculation.total_carbon.toFixed(1)+" kg karbon","ok","🌱");
            if(window.DG_RECORD_MEASUREMENT_PRESENCE_ACTION)window.DG_RECORD_MEASUREMENT_PRESENCE_ACTION.record("save","P"+String(point).padStart(3,"0"),dgPresenceAct);
            else if(typeof dgPresenceAct==="function"){try{dgPresenceAct("save","P"+String(point).padStart(3,"0"));}catch(e){}}
          }
          return window.DG_REFRESH_MEASUREMENT_AFTER_SAVE.online({wasEdit,reset:dgResetMeasureFields,autoFill:autoFillPointId,loadDashboard:loadDash,loadRecords,loadWaypoints});
        }
      });

}

/* --- 8. DÜZENLEME --- */
function cancelEdit(){
 return window.DG_CANCEL_MEASUREMENT_EDIT.cancel({setEditing:id=>{EDIT_ID=id;},setManualPoint:value=>{manualPoint=value;},element:$,parkGate:dgParkGate});
}
async function editRec(id){
 return window.DG_EDIT_MEASUREMENT_RECORD.edit(id,{
  fetch:recordId=>window.DG_FETCH_MEASUREMENT_FOR_EDIT.fetch({client:sb,id:recordId}),
  clearPhoto:dgClearMeasurePhoto,
  setEditing:value=>{EDIT_ID=value;},
  build:record=>window.DG_BUILD_MEASUREMENT_EDIT_FORM.build(record,value=>typeof circumferenceCmFromDiameter==="function"?circumferenceCmFromDiameter(value):value),
  render:form=>window.DG_RENDER_MEASUREMENT_EDIT_FORM.render(form,{element:$,fillSpecies,showLatin}),
  liveCalc,
  navigate:go,
  projectChanged:dgProjectChanged
 });
}/* --- 9. FOTOĞRAF İŞLEME --- */
async function compress(f){
 return window.DG_COMPRESS_MEASUREMENT_PHOTO.compress(f,{loadImage:loadImg,document,URL});
}
async function removePhoto(url){
 return window.DG_REMOVE_MEASUREMENT_PHOTO.remove({client:sb,url});
}
/* 0035b: dil değişince tür listesi yeniden doldurulur (görünen adlar çevrilir,
 * value'lar kanonik TR kalır). */
window.addEventListener("dg:lang",()=>{try{const g=$("mGroup");if(g&&g.value&&$("mSpecies")){const sp=$("mSpecies").value;fillSpecies();$("mSpecies").value=sp;showLatin();}if(typeof liveCalc==="function")liveCalc();}catch(e){}});
