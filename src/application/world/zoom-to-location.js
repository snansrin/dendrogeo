"use strict";
(function(root){
 async function run(map,column,value,label,icon,ports){
  if(!map)return;
  const{data,count}=await ports.load(column,value);
  ports.warnIfTruncated(data,2000,label+" ("+(column==="country"?"ülke yakınlaşma":"şehir yakınlaşma")+")",count);
  ports.fit(map,data,label,icon);
 }
 root.DG_WORLD_ZOOM_TO_LOCATION=Object.freeze({run});
})(window);
