"use strict";
(function(root){
 async function execute(format,ports){
  const options=ports.resolve(format);
  if(!options)throw new Error("Bilinmeyen dışa aktarım biçimi: "+format);
  ports.onActivity(options.activity);
  const rows=await ports.load();
  const content=ports.serialize(format,rows,{preview:false});
  ports.download(content,options.fileName);
  return{format,rows:rows.length,content,fileName:options.fileName};
 }
 root.DG_DOWNLOAD_USER_MEASUREMENT_EXPORT=Object.freeze({execute});
})(window);
