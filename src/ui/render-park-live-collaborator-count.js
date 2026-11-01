"use strict";

/* Report the number of other park collaborators represented on the map. */
window.DG_RENDER_PARK_LIVE_COLLABORATOR_COUNT={
  render({element,count,connected=false,translate}){
    if(!element)return;
    element.textContent=count?translate("👥 {n} ortak bu parkta çevrimiçi — konumlar canlı görünüyor (üstüne gel: kimlik).",{n:count}):connected?translate("✓ Bağlandı · Bu parkta konumunu paylaşan başka ortak yok. Diğer ortak da GPS ve konum paylaşımını açmalı."):"";
  }
};
