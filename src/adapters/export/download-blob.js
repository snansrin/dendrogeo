"use strict";
/* Browser download resources have a bounded lifetime; no analysis data is changed. */
window.DG_DOWNLOAD_BLOB={download(name,mime,text,{BlobCtor,urlApi,document,schedule}){const blob=new BlobCtor([text],{type:mime}),url=urlApi.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();schedule(()=>urlApi.revokeObjectURL(url),1000);}};
