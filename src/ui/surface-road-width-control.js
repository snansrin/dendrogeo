"use strict";
window.DG_SURFACE_ROAD_WIDTH_CONTROL={
 render({preview,disabled,translate:t,escape:e}){
  if(!preview?.roadSource)return "";
  return `<div class="dg-editor-menu-section"><label class="dg-png-label" for="dgSensRoadWidth">${e(t("Yolu genişlet · toplam genişlik (m)"))}</label><input class="dg-png-input" id="dgSensRoadWidth" type="number" inputmode="decimal" min="0.5" max="60" step="0.5" value="${e(preview.roadWidthM||"")}" placeholder="8" ${disabled?"disabled":""}><p class="dg-sens-hint">${e(t("OSM yol çizgisi gerçek yol kenarı değildir. Genişliği saha ölçümüne göre girin; değişken genişlikler için Sınır çiz kullanın."))}</p><button type="button" class="dg-png-btn ghost sm" data-dg-click="roadWidth" ${disabled?"disabled":""}>${e(t("Genişliği önizle"))}</button></div>`;
 }
};
