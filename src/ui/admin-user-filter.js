"use strict";
(function(root){
 function updateVisible(document,visible){const element=document.getElementById("aUsersVisible");if(element)element.textContent=visible+" kullanıcı";}
 function apply(table,{query="",role="",status=""}={}){
  const q=(query||"").trim().toLocaleLowerCase("tr-TR");let visible=0;
  table.querySelectorAll("tr").forEach(row=>{
   const text=(row.textContent||"").toLocaleLowerCase("tr-TR");
   const show=(!q||text.includes(q))&&(!role||row.dataset.role===role)&&(!status||row.dataset.status===status);
   row.style.display=show?"":"none";if(show)visible++;
  });
  return visible;
 }
 root.DG_ADMIN_USER_FILTER_UI=Object.freeze({apply,updateVisible});
})(window);
