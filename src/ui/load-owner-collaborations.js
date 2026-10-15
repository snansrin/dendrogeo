"use strict";
(function(root){
 const update=(state,patch)=>state&&typeof state.setState==="function"?state.setState(patch):state&&Object.assign(state,patch);
 async function execute(ports){
  const state=ports.state;
  update(state,{loading:true});
  try{
   const select=ports.getSelect();
   if(!select)return;
   if(!ports.isAuthenticated()){
    ports.hideCard();
    if(ports.setEmptyOptions)ports.setEmptyOptions(select,"Giriş gerekli");else select.innerHTML='<option value="">Giriş gerekli</option>';
    return;
   }
   const parks=await ports.loadParks(true),owned=ports.owned(parks),shared=ports.shared(parks);
   update(state,{parks});
   ports.updateOwnedCount(owned.length);
   ports.updateSharedCount(shared.length);
   if(!owned.length){
    ports.hideCard();if(ports.setEmptyOptions)ports.setEmptyOptions(select,"Sahibi olduğun proje yok");else select.innerHTML='<option value="">Sahibi olduğun proje yok</option>';
    update(state,{invites:[],collabs:[]});
    ports.clearCollaborations();ports.render();return;
   }
   ports.showCard();
   const keep=select.value;
   const options=ports.renderOptions(owned,keep);
   if(ports.setOptions)ports.setOptions(select,owned,keep);else{select.innerHTML=options.html;if(options.selected!=null)select.value=options.selected;}
   await ports.refresh();
  }finally{update(state,{loading:false});}
 }
 root.DG_LOAD_OWNER_PARK_COLLABORATIONS=Object.freeze({execute});
})(window);
