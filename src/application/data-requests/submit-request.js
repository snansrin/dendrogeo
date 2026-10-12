"use strict";

/* Preserve submission ordering and the existing duplicate-check error boundary. */
window.DG_SUBMIT_DATA_REQUEST={
 async execute({readPending,findDuplicate,onDuplicate,onCheckError,buildBody,insert,onInsertError,onSuccess}){
  try{
   const {data:pending}=await readPending();
   const duplicate=findDuplicate(pending);
   if(duplicate){onDuplicate(duplicate);return;}
  }catch(error){onCheckError(error);}
  const body=buildBody();
  const {error}=await insert(body);
  if(error){onInsertError(error);return;}
  onSuccess();
 }
};
