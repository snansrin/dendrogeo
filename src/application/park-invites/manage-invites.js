"use strict";
(function(root){
 async function respond(id,accept,ports){
  if(!ports.authenticated())return ports.onUnauthenticated();
  const{error}=await ports.store.respond(id,accept);
  if(error)return ports.onFailure(error);
  ports.onSuccess(accept);
  if(accept)ports.onAccepted();
  ports.onComplete();
 }
 async function send({parkId,email,note},ports){
  const{data,error}=await ports.store.send(parkId,email,note);
  if(error)return ports.onFailure(error);
  ports.onSuccess(data);
 }
 async function revoke({parkId,target,kind},ports){
  const{error}=await ports.store.revoke(parkId,target,kind);
  if(error)return ports.onFailure(error);
  ports.onSuccess(kind);
  ports.onComplete();
 }
 root.DG_MANAGE_PARK_INVITES=Object.freeze({respond,send,revoke});
})(window);
