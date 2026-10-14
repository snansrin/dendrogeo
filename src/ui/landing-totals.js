"use strict";
/* Render the existing public counts; no carbon or DBH calculations live here. */
window.DG_RENDER_LANDING_TOTALS={render(data,element){element('statRec').textContent=data.records||0;element('statCountry').textContent=data.countries||0;element('statCity').textContent=data.cities||0;element('statCarbon').textContent=data.carbon_t||0;}};
