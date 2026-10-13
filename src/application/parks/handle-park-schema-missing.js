"use strict";

/* Decide when a park schema problem should disable the park identity gate. */
(function(root){
  function create({isSchemaError,hasWarned,markWarned,disableSchema,notifyTransient,notifyMissing,renderCard}){
    function handle(reason){
      if(!isSchemaError(reason)){
        notifyTransient(reason);
        return{status:"transient-error"};
      }
      if(hasWarned())return{status:"already-warned"};
      markWarned();
      disableSchema();
      notifyMissing(reason);
      renderCard();
      return{status:"schema-missing"};
    }
    return Object.freeze({handle});
  }
  root.DG_HANDLE_PARK_SCHEMA_MISSING_APPLICATION=Object.freeze({create});
})(window);
