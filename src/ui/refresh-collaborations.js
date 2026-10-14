"use strict";
(function(root){
 const update=(state,patch)=>state&&typeof state.setState==="function"?state.setState(patch):Object.assign(state,patch);
 async function execute(state,ports){
  const select=ports.getSelect();
  if(!select||!select.value){ports.render();return;}
  const parkId=Number(select.value);
  if(!ports.canManage(parkId)){
   update(state,{invites:[],collabs:[]});select.value="";ports.render();return;
  }
  const[invites,collaborators]=await ports.load(parkId);
  update(state,{invites:invites.error?null:(invites.data||[]),collabs:collaborators.error?null:(collaborators.data||[])});
  if(invites.error&&/42P01|relation/i.test(invites.error.message||""))ports.onMissingSchema();
  ports.render();
 }
 root.DG_REFRESH_PARK_COLLABORATIONS=Object.freeze({execute});
})(window);
