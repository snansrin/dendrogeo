"use strict";
/* Resolve review geometry once per stable record, geometry, and visual version. */
(function(root){
  function build({record,geometry,park,cells,epoch,partitionVersion,visualVersion,editing,features,sens,corrections,profile,epsg,memo,resolved,effective}){
    if(!record||!geometry||!park||!Array.isArray(cells)||!cells.length)return{parts:[],memo:null};
    const key=[epoch,partitionVersion,visualVersion,editing].join(":"),sensitivity=JSON.stringify(sens);
    if(memo?.key!==key||memo.geometry!==geometry||memo.record!==record||memo.sens!==sensitivity||memo.corrections!==corrections||memo.profile!==profile||memo.features.length!==features.length||!memo.features.every((feature,index)=>feature===features[index])){
      memo={key,geometry,parts:resolved(cells,effective,geometry,features,epsg,park),record,sens:sensitivity,corrections,profile,features};
    }
    return{parts:memo.parts,memo};
  }
  root.DG_BUILD_SURFACE_REVIEW_PARTS=Object.freeze({build});
})(window);
