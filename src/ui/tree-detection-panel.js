"use strict";
(function(root){
 const words={
  title:['🌳 Ağaç Algılama','🌳 Tree Detection'],intro:['Üstten çekilmiş bir görüntüde ağaç adaylarını inceleyin.','Inspect tree candidates in an overhead image.'],
  file:['Görüntü seç (JPG, PNG, WebP · en fazla 10 MB)','Choose image (JPG, PNG, WebP · up to 10 MB)'],threshold:['Güven eşiği','Confidence threshold'],
  transfer:['Algılamayı başlattığınızda seçtiğiniz görüntü Roboflow’a gönderilir. Konum ve hesap bilgileri gönderilmez. Görüntü en fazla 2048 piksele ölçeklenir; dosya üst verileri aktarılmaz.','Starting detection sends your selected image to Roboflow. Location and account details are not sent. Images are resized to at most 2048 pixels; file metadata is removed.'],
  run:['Ağaçları algıla','Detect trees'],clear:['Temizle','Clear'],cancel:['İptal','Cancel'],download:['Adayları indir (JSON)','Download candidates (JSON)'],
  note:['Deneysel · Aday sayısı, doğrulanmış ağaç sayısı veya park toplamı değildir. Bu model taç maskesi, tür, DBH ve boy üretmez. Harita ve kayıtlı analiz değiştirilmez.','Experimental · Candidate count is not a confirmed tree count or park total. This model does not produce crown masks, species, DBH or height. The map and saved analysis remain unchanged.'],
  empty:['Bir uydu, ortofoto veya drone görüntüsü seçin.','Choose a satellite, orthophoto or drone image.'],ready:['Görüntü hazır. İnceledikten sonra algılamayı başlatın.','Image ready. Review it before starting detection.'],preparing:['Görüntü hazırlanıyor…','Preparing image…'],running:['Model çalışıyor…','Running model…'],complete:['ağaç adayı','tree candidates'],
  invalid_image:['Görüntü okunamadı. JPG, PNG veya WebP seçin.','Could not read image. Choose JPG, PNG or WebP.'],image_too_large:['Görüntü çok büyük. Daha küçük bir görüntü seçin.','Image is too large. Choose a smaller image.'],sign_in_required:['Algılama için giriş yapın.','Sign in to run detection.'],configuration_missing:['Model bağlantısı henüz yapılandırılmamış.','Model connection is not configured yet.'],rate_limited:['Kısa sürede çok istek gönderildi. Bir dakika sonra yeniden deneyin.','Too many requests. Try again in a minute.'],provider_quota:['Model sağlayıcısının kullanım sınırına ulaşıldı.','The model provider usage limit has been reached.'],model_timeout:['Model zaman aşımına uğradı. Yeniden deneyebilirsiniz.','Model timed out. You can try again.'],cancelled:['İstek iptal edildi.','Request cancelled.'],model_unavailable:['Model yanıtı alınamadı. Lütfen daha sonra yeniden deneyin.','Could not get a model response. Please try again later.']
 };
 function create({host,english,download}){
  const text=key=>(words[key]||words.model_unavailable)[english()?1:0];
  let latest={state:'empty'},actions;
  function render(){
   const file=host.querySelector('[data-tree-file]');
   if(!file){
    host.querySelector('summary span').dataset.treeWord='title';
    host.insertAdjacentHTML('beforeend','<div class="dg-tree-body"><p data-tree-word="intro"></p><label class="lbl"><span data-tree-word="file"></span><input data-tree-file type="file" accept="image/jpeg,image/png,image/webp"></label><label class="lbl"><span data-tree-word="threshold"></span><select data-tree-confidence><option value="0.3">0.30</option><option value="0.5" selected>0.50</option><option value="0.7">0.70</option></select></label><p class="dg-meta" data-tree-word="transfer"></p><div class="dg-tree-actions"><button type="button" class="btn sm" data-tree-run data-tree-word="run" disabled></button><button type="button" class="btn sm ghost" data-tree-cancel data-tree-word="cancel" hidden></button><button type="button" class="btn sm ghost" data-tree-clear data-tree-word="clear"></button><button type="button" class="btn sm ghost" data-tree-download data-tree-word="download" hidden></button></div><p role="status" aria-live="polite" data-tree-status></p><canvas data-tree-preview role="img" hidden></canvas><p class="dg-meta" data-tree-word="note"></p></div>');
    host.querySelector('[data-tree-file]').addEventListener('change',event=>actions.select(event.target.files[0]));
    host.querySelector('[data-tree-run]').addEventListener('click',()=>actions.run(Number(host.querySelector('[data-tree-confidence]').value)));
    host.querySelector('[data-tree-cancel]').addEventListener('click',()=>actions.cancel());
    host.querySelector('[data-tree-clear]').addEventListener('click',()=>{host.querySelector('[data-tree-file]').value='';actions.clear();});
    host.querySelector('[data-tree-download]').addEventListener('click',()=>{if(latest.result)download(latest.result);});
    host.querySelector('[data-tree-confidence]').addEventListener('change',()=>actions.cancel());
   }
   host.querySelectorAll('[data-tree-word]').forEach(node=>node.textContent=text(node.dataset.treeWord));
   const busy=['running','preparing'].includes(latest.state);
   host.querySelector('[data-tree-run]').disabled=busy||!latest.image;
   host.querySelector('[data-tree-confidence]').disabled=busy;
   host.querySelector('[data-tree-cancel]').hidden=!busy;
   host.querySelector('[data-tree-download]').hidden=!latest.result;
   host.setAttribute('aria-busy',String(busy));
   host.querySelector('[data-tree-status]').textContent=latest.state==='complete'?latest.result.candidateCount+' '+text('complete'):text(latest.state==='error'?latest.error:latest.state);
   const canvas=host.querySelector('[data-tree-preview]');canvas.hidden=!latest.image;
   canvas.setAttribute('aria-label',latest.result?latest.result.candidateCount+' '+text('complete'):text('ready'));
   if(latest.image){
    const snapshot=latest,image=new Image();image.onload=()=>{
     if(latest!==snapshot)return;
     canvas.width=snapshot.image.width;canvas.height=snapshot.image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
     ctx.strokeStyle='#fbbf24';ctx.lineWidth=Math.max(2,canvas.width/500);
     for(const candidate of snapshot.result?.candidates||[]){const [x,y,right,bottom]=candidate.boxPixels;ctx.strokeRect(x,y,right-x,bottom-y);}
    };image.src=latest.image.dataUrl;
   }
  }
  return Object.freeze({bind(value){actions=value;render();},present(value){latest=value;render();},refresh:render});
 }
 root.DG_TREE_DETECTION_PANEL=Object.freeze({create});
})(window);
