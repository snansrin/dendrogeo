"use strict";

/* Render an escaped point record preview or the existing empty-result message. */
window.DG_MEASUREMENT_POINT_QUERY_RESULT={
  render({element,record,pointId,escape,translate,translateFormat,circumferenceFromDiameter}){
    if(!record){
      element.style.display="block";element.className="alert info";
      element.innerHTML=translateFormat("ℹ P{p} için kayıt yok · Yeni kayıt oluşturulacak.",{p:pointId});
      return;
    }
    const rawCirc=Number.isFinite(+record.girth_cm)&&+record.girth_cm>0?+record.girth_cm:circumferenceFromDiameter(record.dbh_cm);
    element.style.display="block";element.className="alert info";
    element.innerHTML=`✓ <b>P${record.point_id}</b> · ${escape(translate(record.species))} · ${translate("Göğüs çevresi")} ${rawCirc?rawCirc.toFixed(1):"—"} cm · DBH ${(+record.dbh_cm).toFixed(1)} cm · ${translate("Boy")} ${record.height_m} m · ${translate("Karbon")} ${(record.carbon_kg||0).toFixed(1)} kg · ${translate("Durum")}: <b>${record.status?translate(record.status):translate("Beklemede")}</b>`+
      (record.photo_url?`<br><img src="${escape(record.photo_url)}" style="width:140px;border-radius:8px;margin-top:6px">`:"")+`<br><button class="btn sm blue" onclick="editRec(${record.id})" style="margin-top:8px">✏️ Düzenle & Güncelle</button> <button class="btn sm red" onclick="delRec(${record.id})" style="margin-top:8px">🗑️ Tamamen Sil</button>`;
  }
};
