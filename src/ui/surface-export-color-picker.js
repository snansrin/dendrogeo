"use strict";
/* Local draft/apply color control; no OS popup, data writes or map mutations. */
(function(root){
 const valid=value=>/^#[0-9a-f]{6}$/i.test(value);
 function toHex(h,s,l){s/=100;l/=100;const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};return '#'+f(0)+f(8)+f(4);}
 function toHsl(hex){const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0;if(d)h=(max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)*60;return[h,d?d/(1-Math.abs(2*l-1))*100:0,l*100];}
 function bind({dialog,translate}){
  const find=id=>dialog.querySelector('#'+id),toggle=find('dgExportColorToggle'),panel=find('dgExportColorPanel'),field=find('dgExportBoundaryColor'),hex=find('dgExportColorHex'),done=find('dgExportColorDone'),preview=find('dgExportColorPreview'),status=find('dgExportColorStatus'),ranges=['Hue','Saturation','Lightness'].map(name=>find('dgExportColor'+name));
  if(!toggle||!panel||!field)return;
  function refresh(syncRanges=false){const ok=valid(hex.value);done.disabled=!ok;hex.setAttribute('aria-invalid',String(!ok));status.textContent=ok?'':translate('Altı haneli bir HEX rengi girin.');if(!ok)return;
   if(syncRanges)toHsl(hex.value).forEach((value,i)=>ranges[i].value=String(value));
   const h=Number(ranges[0].value),s=Number(ranges[1].value);preview.style.backgroundColor=hex.value;
   ranges[1].style.background='linear-gradient(to right,hsl('+h+' 0% 50%),hsl('+h+' 100% 50%))';ranges[2].style.background='linear-gradient(to right,#000,hsl('+h+' '+s+'% 50%),#fff)';
  }
  function finish(apply){if(apply&&!valid(hex.value))return;if(apply){field.value=hex.value.toLowerCase();toggle.style.setProperty('--dg-export-color',field.value);}panel.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();}
  toggle.addEventListener('click',()=>{if(!panel.hidden){finish(false);return;}hex.value=field.value;refresh(true);panel.hidden=false;toggle.setAttribute('aria-expanded','true');hex.focus();});
  hex.addEventListener('input',()=>refresh(true));hex.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();finish(true);}});
  for(const range of ranges)range.addEventListener('input',()=>{hex.value=toHex(...ranges.map(item=>Number(item.value)));refresh();});
  done.addEventListener('click',()=>finish(true));find('dgExportColorCancel').addEventListener('click',()=>finish(false));
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(false);}});
  dialog.addEventListener('cancel',event=>{if(!panel.hidden){event.preventDefault();finish(false);}});
 }
 root.DG_SURFACE_EXPORT_COLOR_PICKER=Object.freeze({bind,toHex,toHsl});
})(window);
