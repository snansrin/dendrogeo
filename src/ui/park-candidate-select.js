"use strict";
/* Render the existing alternative park selector without changing its order. */
(function(root){
 function renderParkCandidateSelect({candidates,selected,escape,formatArea}){
  if(candidates.length<=1)return "";
  return `<select id="parkAlt" onchange="switchPark(+this.value)" style="font-size:.8rem;padding:4px 8px;border-radius:6px;border:1px solid var(--line)">`+
   candidates.map((candidate,index)=>`<option value="${index}"${candidate===selected?" selected":""}>${escape(candidate.name||"Alan "+(index+1))} · ${formatArea(candidate.area/10000)} ha</option>`).join("")+
   `</select>`;
 }
 root.DG_PARK_CANDIDATE_SELECT_UI=Object.freeze({render:renderParkCandidateSelect});
})(window);
