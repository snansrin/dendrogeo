"use strict";
/* Landing demos own only transient display state. They never load the app analysis engine. */
(function(root){
 const labels={all:'Tüm yüzeyler',green:'Yeşil alan',hard:'Sert zemin',building:'Bina',water:'Su',bare:'Çıplak zemin',sparse:'Seyrek',moderate:'Orta',dense:'Yoğun'};
 const report={
  results:{title:'1 · Analiz Özeti',subtitle:'5 · Nicel Sonuçlar',body:'Onaylı ağaç ölçümleri; tür dağılımı, biyokütle ve karbon tahminiyle birlikte sunulur. Monte Carlo model ve girdi belirsizliği ayrıca raporlanır.',items:['Ağaç envanteri','Karbon · %95 model aralığı','Yüzey örtüsü bağlamı']},
  quality:{title:'7 · Kalite Kontrol ve Doğrulama',subtitle:'Kritik hata · inceleme · geçerli',body:'Konum çiti, moderasyon, ölçüm tutarlılığı ve alan dengesi kontrolleri raporda görünür. Kritik hata ile inceleme uyarısı ayrı değerlendirilir.',items:['Konum ve moderasyon','Ölçüm tutarlılığı','Raster · park alan dengesi']},
  identity:{title:'10 · Tekrar Üretilebilirlik',subtitle:'11 · Analiz Parmak İzi',body:'Yayın anındaki veri ve yöntem sürümü sabitlenir. DGR kimliği, içerik hash’i, yayın geçmişi ve atıf bilgisi birlikte sunulur; yeni çözümleme yeni kimlik alır.',items:['DGR kimliği · sürüm','SHA-256 · kalıcı bağlantı','13 · Atıf']}
 };
 const translate=text=>typeof root.dgT==='function'?root.dgT(text):text;
 const source=url=>root.DG_PUBLIC_LANDING_SCENE.load(url);
 function mount(host){
  const mode=host.dataset.landingScene,canvas=host.querySelector('[data-scene-canvas]'),output=host.querySelector('[data-scene-output]');let data=null,loading=false,points=[],shape='polygon',selected='all';
  function showText(selector,text){const node=host.querySelector(selector);if(node)node.textContent=translate(text);}
  function selectReport(key){const section=report[key];if(!section)return;
   showText('[data-report-title]',section.title);showText('[data-report-subtitle]',section.subtitle);showText('[data-report-body]',section.body);
   host.querySelectorAll('[data-report-item]').forEach((node,i)=>{node.textContent=translate(section.items[i]);});
   host.querySelectorAll('[data-report-pick]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.reportPick===key)));
   host.dataset.reportSection=key;
  }
  if(mode==='report'){host.addEventListener('click',event=>{const button=event.target.closest('[data-report-pick]');if(button)selectReport(button.dataset.reportPick);});selectReport('results');return;}
  const controls=host.querySelectorAll('[data-scene-pick],[data-scene-shape],[data-scene-clear]');controls.forEach(button=>{button.disabled=true;});
  function pick(key){if(!data)return;selected=key;
   canvas.querySelectorAll('[data-scene-class]').forEach(path=>{path.classList.toggle('is-muted',key!=='all'&&path.dataset.sceneClass!==key);path.classList.toggle('is-selected',key!=='all'&&path.dataset.sceneClass===key);});
   host.querySelectorAll('[data-scene-pick]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scenePick===key)));
   const total=Object.values(data.areas).reduce((a,b)=>a+b,0),value=key==='all'?total:data.areas[key];
   if(mode==='ndvi'){const template=translate(key==='all'?'{n} hücre · en az 3 ayrı tarih':labels[key]+' · park içi göreli sınıf');output.textContent=template.replace('{n}',data.ndvi.count.toLocaleString(document.documentElement.lang==='en'?'en-GB':'tr-TR'));}
   else if(value!==undefined){output.textContent=translate(labels[key])+' · '+(value/10000).toLocaleString('tr-TR',{minimumFractionDigits:3,maximumFractionDigits:3})+' ha';showText('[data-scene-share]',key==='all'?'14 Ekim 2026 · kabul edilmiş kayıt':(100*value/total).toLocaleString('tr-TR',{maximumFractionDigits:1})+'%');}
  }
  function renderSketch(){const target=canvas.querySelector('[data-scene-sketch]');if(!target)return;target.replaceChildren();if(!points.length)return;
   const svg=target.ownerSVGElement,ns='http://www.w3.org/2000/svg';let node;
   if(shape==='polygon'){node=document.createElementNS(ns,points.length>2?'polygon':'polyline');node.setAttribute('points',points.map(p=>p.join(',')).join(' '));}
   else if(points.length>1){const [a,b]=points;if(shape==='rectangle'){node=document.createElementNS(ns,'rect');node.setAttribute('x',Math.min(a[0],b[0]));node.setAttribute('y',Math.min(a[1],b[1]));node.setAttribute('width',Math.abs(a[0]-b[0]));node.setAttribute('height',Math.abs(a[1]-b[1]));}else{node=document.createElementNS(ns,'circle');node.setAttribute('cx',a[0]);node.setAttribute('cy',a[1]);node.setAttribute('r',Math.hypot(a[0]-b[0],a[1]-b[1]));}}
   if(node){node.setAttribute('class','dg-scene-sketch');target.append(node);}
   for(const point of points){const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',point[0]);dot.setAttribute('cy',point[1]);dot.setAttribute('r',4);dot.setAttribute('class','dg-scene-vertex');target.append(dot);}
   svg.classList.add('has-sketch');
  }
  function addPoint(point){if(shape!=='polygon'&&points.length===2)points=[];points.push(point);renderSketch();showText('[data-scene-output]','Geçici çizim · park sınırına kırpılan görünüm');}
  async function ensure(){if(data||loading)return;loading=true;host.setAttribute('aria-busy','true');
   try{data=await source(host.dataset.source);canvas.innerHTML=root.DG_RENDER_LANDING_SPATIAL_SCENE.render({data,mode,id:'landing-clip-'+mode});host.dataset.sceneReady='true';pick('all');
    if(mode==='drawing'){showText('[data-scene-output]','Şekli seçin, haritada köşelere dokunun.');canvas.tabIndex=0;canvas.setAttribute('role','button');canvas.setAttribute('aria-label','Çizim alanı · Enter ile örnek köşe ekleyin');canvas.addEventListener('click',event=>{const svg=canvas.querySelector('svg'),matrix=svg.getScreenCTM();if(!matrix)return;const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const local=point.matrixTransform(matrix.inverse());addPoint([local.x,local.y]);});canvas.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();const sample=shape==='polygon'?[[230,180],[350,170],[340,270],[245,285]]:[[230,180],[350,280]];addPoint(sample[points.length%sample.length]);}});}
   }catch(error){data=null;showText('[data-scene-output]','Örnek yüklenemedi. Yeniden dene düğmesini kullanın.');host.dataset.sceneError='true';}finally{loading=false;controls.forEach(button=>{button.disabled=!data;});host.setAttribute('aria-busy','false');}
  }
  host.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;
   if(button.dataset.scenePick)pick(button.dataset.scenePick);
   if(button.dataset.sceneShape){shape=button.dataset.sceneShape;points=[];renderSketch();host.querySelectorAll('[data-scene-shape]').forEach(node=>node.setAttribute('aria-pressed',String(node===button)));showText('[data-scene-output]','Şekli seçin, haritada köşelere dokunun.');}
   if(button.hasAttribute('data-scene-clear')){points=[];renderSketch();showText('[data-scene-output]','Şekli seçin, haritada köşelere dokunun.');}
   if(button.hasAttribute('data-scene-retry')){delete host.dataset.sceneError;void ensure();}
  });
  const panel=host.closest('[data-showcase-panel]'),showcase=host.closest('[data-dg-showcase]');
  const activate=()=>{if(panel.classList.contains('is-active'))void ensure();};showcase.addEventListener('dg:showcase-change',activate);activate();
  root.addEventListener('dg:lang',()=>{if(data&&mode!=='drawing')pick(selected);});
 }
 root.DG_LANDING_SCENE_CONTROLLER=Object.freeze({mount});if(typeof document!=='undefined')document.querySelectorAll('[data-landing-scene]').forEach(mount);
})(window);
