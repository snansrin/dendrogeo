"use strict";

/* Report the number of other park collaborators represented on the map. */
window.DG_RENDER_PARK_LIVE_COLLABORATOR_COUNT={
  render({element,count,translate}){if(element)element.textContent=count?translate("👥 {n} ortak bu parkta çevrimiçi — konumlar canlı görünüyor (üstüne gel: kimlik).",{n:count}):"";}
};
