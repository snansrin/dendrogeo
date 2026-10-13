"use strict";
/* Memoize review geometry across preview, acceptance, and export; use accepted geometry when authoritative. */
(function(root){
  function render({epoch,partitionVersion,parts,geometry,epsg,park,record,rawView,editing,memo,getMemo,setMemo,workerJob,mergeSync,displaySync}){
    const key=[epoch,partitionVersion,parts.map(part=>part.type).join(",")].join(":");
    if(memo?.key===key&&memo.geometry===geometry)return memo.promise;
    const current={key,geometry};setMemo(current);
    const accepted=record?.acceptedResult;
    if(!rawView&&!editing&&!record?.draftDirty&&accepted?.displayMethod?.version===4&&accepted.features?.length&&accepted.displayFeatures?.length===accepted.features.length){
      current.promise=Promise.resolve({features:accepted.features,displayFeatures:accepted.displayFeatures});return current.promise;
    }
    current.promise=(async()=>{
      const job=await workerJob({job:"merge",parts:parts.map(part=>({type:part.type,geom:part.geom,areaM2:part.areaM2,method:part.method})),epsg,display:true,park});
      const features=job?.features||mergeSync(parts,epsg);
      return job||{features,displayFeatures:displaySync(parts,epsg,park,features)};
    })().catch(error=>{if(getMemo()===current)setMemo(null);throw error;});
    return current.promise;
  }
  root.DG_RENDER_SURFACE_REVIEW_GEOMETRY=Object.freeze({render});
})(window);
