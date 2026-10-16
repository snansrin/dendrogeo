"use strict";
(function(root){
 const key='dg_appearance';
 function read(){try{return root.localStorage.getItem(key);}catch(error){return null;}}
 function write(value){try{root.localStorage.setItem(key,value);return true;}catch(error){return false;}}
 root.DG_APPEARANCE_PREFERENCE=Object.freeze({key,read,write});
})(window);
