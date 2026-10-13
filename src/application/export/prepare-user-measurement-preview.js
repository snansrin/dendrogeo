"use strict";
(function(root){
 async function execute(format,ports){
  const options=ports.resolve(format);
  if(!options||!options.previewTitle)throw new Error("Önizleme biçimi desteklenmiyor: "+format);
  const rows=await ports.load();
  const content=ports.serialize(format,rows,{preview:true});
  return{title:options.previewTitle,content,isCSV:options.isCSV,fileName:options.fileName};
 }
 root.DG_PREPARE_USER_MEASUREMENT_PREVIEW=Object.freeze({execute});
})(window);
