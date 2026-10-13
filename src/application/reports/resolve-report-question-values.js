"use strict";
(function(root){
 function resolve(input){
  let parkName="Park #"+input.parkId;
  if(input.currentPublication&&Number(input.currentPublication.parkId)===Number(input.parkId))parkName=input.currentPublication.parkName||parkName;
  const publishedPark=(input.publicationParks||[]).find(park=>Number(park.park_id)===Number(input.parkId));
  if(publishedPark)parkName=publishedPark.park_name||parkName;
  const key=input.userId+":"+input.parkId,draft=input.drafts.get(key)||{};
  const defaults=input.defaults||{},name=input.name||"";
  const values={...defaults,...draft,author_name:draft.author_name||defaults.author_name||name,project_name:draft.project_name||input.projectName||defaults.project_name,title:draft.title||parkName+" ağaç envanteri ve karbon stoku analizi",purpose:draft.purpose||"",study_type:draft.study_type||"Araştırma raporu"};
  return{key,parkName,values};
 }
 root.DG_RESOLVE_REPORT_QUESTION_VALUES=Object.freeze({resolve});
})(window);
