"use strict";
window.DG_USER_ADMIN_STORE={
 load(client){return client.from("profiles").select("*");},
 setRole(client,id,role){return client.from("profiles").update({role}).eq("id",id);},
 setActive(client,id,active){return client.from("profiles").update({active}).eq("id",id);}
};
