"use strict";

/* Render an escaped point record preview or the existing empty-result message. */
window.DG_MEASUREMENT_POINT_QUERY_RESULT=(()=>{
 const bindings=new WeakSet(),actionsByElement=new WeakMap();
 function bind(element,actions){
  if(!element||typeof element.addEventListener!=="function")return;
  actionsByElement.set(element,actions||{});if(bindings.has(element))return;bindings.add(element);
  element.addEventListener("click",event=>{
   const button=event.target?.closest?.("[data-point-query-action]");if(!button||!element.contains(button))return;
   const id=Number(button.dataset.recordId),action=button.dataset.pointQueryAction,handlers=actionsByElement.get(element)||{};
   if(!Number.isSafeInteger(id)||id<1)return;
   if(action==="edit")handlers.edit?.(id);else if(action==="delete")handlers.delete?.(id);
  });
 }
 return {
  hide(element){if(element)element.style.display="none";},
  render({element,record,pointId,escape,translate,translateFormat,circumferenceFromDiameter,actions}){
    bind(element,actions);
    if(!record){
      element.style.display="block";element.className="alert info";
      element.innerHTML=translateFormat("ℹ P{p} için kayıt yok · Yeni kayıt oluşturulacak.",{p:pointId});
      return;
    }
    const rawCirc=Number.isFinite(+record.girth_cm)&&+record.girth_cm>0?+record.girth_cm:circumferenceFromDiameter(record.dbh_cm);
    element.style.display="block";element.className="alert info";
    element.innerHTML=`✓ <b>P${record.point_id}</b> · ${escape(translate(record.species))} · ${translate("Göğüs çevresi")} ${rawCirc?rawCirc.toFixed(1):"—"} cm · DBH ${(+record.dbh_cm).toFixed(1)} cm · ${translate("Boy")} ${record.height_m} m · ${translate("Karbon")} ${(record.carbon_kg||0).toFixed(1)} kg · ${translate("Durum")}: <b>${record.status?translate(record.status):translate("Beklemede")}</b>`+
      (record.photo_url?`<br><img src="${escape(record.photo_url)}" style="width:140px;border-radius:8px;margin-top:6px">`:"")+`<br><button class="btn sm blue" data-point-query-action="edit" data-record-id="${escape(record.id)}" style="margin-top:8px">✏️ Düzenle & Güncelle</button> <button class="btn sm red" data-point-query-action="delete" data-record-id="${escape(record.id)}" style="margin-top:8px">🗑️ Tamamen Sil</button>`;
  }
 };
})();
