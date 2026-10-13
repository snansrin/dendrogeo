"use strict";

/* Orchestrate project validation, RLS adapter write, feedback, and refresh. */
window.DG_SAVE_MEASUREMENT_PROJECT={
  async save(ports){
    const label=(ports.label()||"").trim();
    const command=ports.build({...ports.form(),label});
    if(command.kind==="park-required"){ports.requirePark(command);return{ok:false,reason:command.kind};}
    const result=await ports.persist(command);
    if(result.error){ports.failure(result.error);return{ok:false,reason:"write-failed",error:result.error};}
    if(command.kind==="update")ports.updated();
    else ports.created(command);
    ports.refresh();
    return{ok:true,kind:command.kind,projectId:command.id??null};
  }
};
