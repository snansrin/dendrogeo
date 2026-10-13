"use strict";
(function(root){
 async function execute(ports){
  const select=ports.getSelect();
  if(!select)return;
  if(!ports.isAuthenticated()){
   ports.hideCard();
   select.innerHTML='<option value="">Giriş gerekli</option>';
   return;
  }
  const parks=await ports.loadParks(true),owned=ports.owned(parks),shared=ports.shared(parks);
  ports.updateOwnedCount(owned.length);
  ports.updateSharedCount(shared.length);
  if(!owned.length){
   ports.hideCard();select.innerHTML='<option value="">Sahibi olduğun proje yok</option>';
   ports.clearCollaborations();ports.render();return;
  }
  ports.showCard();
  const keep=select.value;
  const options=ports.renderOptions(owned,keep);
  select.innerHTML=options.html;
  if(options.selected!=null)select.value=options.selected;
  await ports.refresh();
 }
 root.DG_LOAD_OWNER_PARK_COLLABORATIONS=Object.freeze({execute});
})(window);
