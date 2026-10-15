"use strict";
/* Render the existing alternative park selector without changing its order. */
(function(root){
 const bindings=new WeakSet(),actionsByDocument=new WeakMap();
 function bind(document,actions){if(!document||typeof document.addEventListener!=="function")return;actionsByDocument.set(document,actions||{});if(bindings.has(document))return;bindings.add(document);document.addEventListener("change",event=>{const select=event.target?.closest?.("[data-park-candidate-select]");if(select&&document.contains(select))actionsByDocument.get(document)?.select?.(Number(select.value));});}
 function renderParkCandidateSelect({candidates,selected,escape,formatArea,document,actions}){
  bind(document,actions);
  if(candidates.length<=1)return "";
  return `<select id="parkAlt" data-park-candidate-select style="font-size:.8rem;padding:4px 8px;border-radius:6px;border:1px solid var(--line)">`+
   candidates.map((candidate,index)=>`<option value="${index}"${candidate===selected?" selected":""}>${escape(candidate.name||"Alan "+(index+1))} · ${formatArea(candidate.area/10000)} ha</option>`).join("")+
   `</select>`;
 }
 root.DG_PARK_CANDIDATE_SELECT_UI=Object.freeze({render:renderParkCandidateSelect,bind});
})(window);
