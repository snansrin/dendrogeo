"use strict";
/* Accessible marking menu; labels and controls use the shared editor theme. */
(function(root){
 function create({document,types,translate}){
  const panel=document.createElement("section");panel.className="dg-drawing-cursor-menu";panel.setAttribute("aria-label",translate("Sınır çizim araçları"));
  const title=document.createElement("strong");title.textContent=translate("Sınır çizimi");panel.append(title);
  const shapes=document.createElement("div");shapes.className="dg-drawing-shapes";shapes.setAttribute("role","group");shapes.setAttribute("aria-label",translate("Çizim şekli"));
  for(const [key,label] of [["polygon","◇ Çokgen"],["rectangle","▭ Dikdörtgen"],["circle","◯ Daire"]]){const button=document.createElement("button");button.type="button";button.className="dg-png-btn ghost sm";button.dataset.shape=key;button.textContent=translate(label);shapes.append(button);}panel.append(shapes);
  const label=document.createElement("label");label.className="dg-png-label";label.textContent=translate("Sınır sınıfı");
  const select=document.createElement("select");select.setAttribute("aria-label",translate("Sınır sınıfı"));
  for(const key of ["building","hard","water","green","bare"]){const option=document.createElement("option");option.value=key;option.textContent=translate(types[key]?.label||key);select.append(option);}label.append(select);panel.append(label);
  const hint=document.createElement("p");hint.className="dg-sens-hint";hint.setAttribute("role","status");panel.append(hint);
  const actions=document.createElement("div");actions.className="dg-drawing-actions";
  for(const [key,text] of [["apply","✓ Sınırı uygula"],["back","↩ Son köşeyi sil"],["end","Çizimi bitir"]]){const button=document.createElement("button");button.type="button";button.className="dg-png-btn "+(key==="apply"?"primary":"ghost")+" sm";button.dataset.action=key;button.textContent=translate(text);actions.append(button);}panel.append(actions);
  return {panel,select,hint,update({shape,type,ready,busy}){select.value=type;select.disabled=busy;for(const button of shapes.children){button.setAttribute("aria-pressed",String(button.dataset.shape===shape));button.disabled=busy;}for(const button of actions.children)button.disabled=busy||(button.dataset.action==="apply"&&!ready);hint.textContent=translate(shape==="polygon"?"Köşeleri seçin, Sınırı uygula ile devam edin.":shape==="rectangle"?"İki karşı köşeyi seçin.":"Merkezi ve yarıçapı seçin.");}};
 }
 root.DG_SURFACE_DRAWING_CURSOR_MENU=Object.freeze({create});
})(window);
