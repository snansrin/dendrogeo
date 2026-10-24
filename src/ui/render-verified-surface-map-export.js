/* Own the verified surface-map export dialog and canvas composition. */
(function(root){
  function openDialog({document,grid,waypoints,escape,translate,renderDialog,renderPng}){
    if(document.getElementById('dgSurfaceExportDialog'))return;
    const dialog=document.createElement('dialog');dialog.id='dgSurfaceExportDialog';dialog.className='dg-export-dialog card';
    dialog.setAttribute?.('aria-label',translate('Harita katmanları'));
    dialog.innerHTML=renderDialog({grid,waypoints:waypoints.length>0,escape,translate});
    document.body.append(dialog);
    root.DG_SURFACE_EXPORT_COLOR_PICKER?.bind({dialog,translate});
    dialog.addEventListener('close',()=>dialog.remove());
    dialog.querySelector('[name="mapOnly"]')?.addEventListener('change',event=>{
      if(!event.target.checked)return;
      dialog.querySelector('[name="surface"]').checked=false;
      dialog.querySelector('[name="park"]').checked=true;
    });
    dialog.querySelector('#dgExportCancel').addEventListener('click',()=>dialog.close());
    dialog.querySelector('#dgExportDownload').addEventListener('click',()=>{
      const layers=Object.fromEntries(['park','surface','grid','waypoints'].map(key=>[key,dialog.querySelector('[name="'+key+'"]').checked]));
      layers.grid=!!grid&&layers.grid&&!dialog.querySelector('[name="grid"]').disabled;
      layers.mapOnly=!!dialog.querySelector('[name="mapOnly"]')?.checked;
      if(!layers.mapOnly&&!Object.values(layers).some(Boolean)){dialog.querySelector('#dgExportError').textContent=translate('En az bir katman seçin.');return;}
      layers.boundaryColor=dialog.querySelector('[name="boundaryColor"]')?.value||'#111827';
      dialog.close();renderPng(layers,waypoints);
    });
    dialog.showModal();
  }

  async function render({layers={park:true,surface:true},waypoints=[],state,record,cells,editSummary,toast,translate,escape,getAreas,getRasterAreas,resolveEpsg,getParkRings,getGridCells,getPark,parkAreaLabel,getParts,visualResult,displaySync,prepareFrame,drawLayers,renderInfo,colors,ha,labelForClass,document,redraw}){
    if(!record||!cells?.length||state.busy||state.saving||!state.geometry){toast(translate('Önce arazi örtüsü analizini çalıştırın.'),'warn','🖼️');return;}
    const edits=editSummary(record),decisionCount=edits.total;
    const accepted=!!record.acceptedAt&&!state.editing&&!state.rawView&&!record.draftDirty;
    const areas=getAreas()||getRasterAreas(),epsg=state.epsg||resolveEpsg(cells[0].center.lat,cells[0].center.lon);
    if(state.exporting)return;
    const epoch=state.epoch;state.exporting=true;redraw();
    try{
      const parts=layers.surface?getParts():[],displayJob=layers.surface?await visualResult(parts):null;
      const displayFeatures=layers.surface?(displayJob?.displayFeatures||displaySync(parts,epsg,state.parkGeometry)):[];
      if(epoch!==state.epoch)return;
      const parkRings=getParkRings(),frame=prepareFrame({cells,parkRings,epsg});
      const mapOnly=!!layers.mapOnly,width=1240,height=mapOnly?1240:1560,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d');
      const green='#14532d',muted='#5c6a63',ink='#182420',background='#f7f6f2';
      const palette=Object.assign({green:'#4ade80',water:'#3b82f6',hard:'#64748b',bare:'#8b5a2b',other:'#94a3b8'},colors);
      context.fillStyle=background;context.fillRect(0,0,width,height);
      const park=getPark(),x=mapOnly?0:40,y=mapOnly?0:240,mapWidth=mapOnly?width:760,mapHeight=mapOnly?height:1180;
      context.fillStyle='#fff';context.fillRect(x,y,mapWidth,mapHeight);
      context.strokeStyle='#dfe5df';context.lineWidth=2;context.strokeRect(x,y,mapWidth,mapHeight);
      const drawHeight=mapHeight-44;
      const project=(lat,lon)=>frame.canvasProject(lat,lon,{x,y,width:mapWidth,height:drawHeight,margin:20});
      let attribution='';
      if(root.DG_DRAW_SURFACE_EXPORT_BASEMAP){
        attribution=await root.DG_DRAW_SURFACE_EXPORT_BASEMAP.draw({context,project,parkRings,rect:{x,y,width:mapWidth,height:drawHeight},base:state.base||document.getElementById?.('baseLayerSelect')?.value||'osm'});
        if(epoch!==state.epoch)return;
      }
      drawLayers({context,layers,displayFeatures,project,parkRings,gridCells:layers.grid?getGridCells():[],waypoints,colors:palette,ink});
      if(!mapOnly)renderInfo({context,width,height,green,muted,ink,colors:palette,park,parkDate:new Date().toISOString().slice(0,10),decisionCount,viewLabel:accepted?'KABUL EDİLMİŞ v'+(record.serverRevision||1):'ÖNİZLEME · HENÜZ KAYDEDİLMEDİ',mapTitle:accepted?'DOĞRULANMIŞ PARK HARİTASI':'PARK ANALİZİ ÖNİZLEMESİ',areasTitle:accepted?'DOĞRULANMIŞ ALANLAR':'ANALİZ ALANLARI',footerNote:accepted?'Kesin hücre geometrisi ve doğrulanmış yüzey sınıfları.':'Kabul edilmemiş analiz önizlemesi; saha doğrulaması değildir.',parkAreaLabel:typeof parkAreaLabel==="function"?parkAreaLabel():parkAreaLabel,edits,layers,areas,ha,labelForClass,fingerprint:record.fingerprint});
      if(attribution){context.fillStyle='#fff';context.fillRect(x,y+drawHeight,mapWidth,44);context.fillStyle=ink;context.font='bold 14px Arial';context.fillText('© DendroGeo · dendrogeo.org',x+8,y+drawHeight+17,mapWidth-16);context.font='12px Arial';context.fillText(attribution,x+8,y+drawHeight+35,mapWidth-16);}
      canvas.toBlob(blob=>{
        if(!blob){toast(translate('PNG üretilemedi.'),'err','🖼️');return;}
        if(epoch!==state.epoch)return;
        const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=(mapOnly?'dendrogeo_harita_':accepted?'dendrogeo_dogrulanmis_harita_':'dendrogeo_analiz_onizlemesi_')+(park.id||'park')+'.png';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast(translate(mapOnly?'✓ Harita PNG indirildi.':accepted?'✓ Doğrulanmış harita PNG indirildi.':'✓ Analiz önizlemesi PNG indirildi.'),'ok','🖼️');
      },'image/png');
    }catch(error){if(epoch===state.epoch)toast(escape(String(error.message||error)),'err','🖼️');}
    finally{if(epoch===state.epoch){state.exporting=false;redraw();}}
  }

  root.DG_RENDER_VERIFIED_SURFACE_MAP_EXPORT=Object.freeze({openDialog,render});
})(window);
