"use strict";

/* Display-only recovery: crop the nearest available parent tile at the same
 * geographic extent. Never change map zoom, vector layers or analysis inputs. */
window.DG_RECOVER_IMAGERY_TILES={
  install(layer,{url,document,setTimeout,clearTimeout}){
    layer.createTile=function(coords,done){
      const tile=document.createElement('canvas'),size=this.getTileSize();
      tile.width=size.x;tile.height=size.y;
      let cancelled=false,finished=false,image=null,timer=null;
      const release=()=>{clearTimeout(timer);if(image){image.onload=null;image.onerror=null;image.removeAttribute('src');}};
      tile._dgCancelImagery=()=>{cancelled=true;release();};
      const complete=error=>{if(cancelled||finished)return;finished=true;release();done(error,tile);};
      const load=level=>{
        if(cancelled||finished)return;
        const scale=2**(coords.z-level),x=Math.floor(coords.x/scale),y=Math.floor(coords.y/scale);
        image=document.createElement('img');image.crossOrigin='anonymous';
        const current=image;
        const retry=()=>{
          if(cancelled||finished||current!==image)return;
          release();
          if(level>Math.max(0,coords.z-4))load(level-1);
          else complete(Error('Uydu görüntüsü şu anda alınamıyor.'));
        };
        current.onerror=retry;
        current.onload=()=>{
          if(cancelled||finished||current!==image)return;
          const context=tile.getContext('2d'),width=current.naturalWidth,height=current.naturalHeight;
          if(!context||!width||!height){retry();return;}
          const sx=(coords.x-x*scale)*width/scale,sy=(coords.y-y*scale)*height/scale;
          try{context.drawImage(current,sx,sy,width/scale,height/scale,0,0,size.x,size.y);}
          catch(error){complete(error);return;}
          tile.dataset.dgImageryZoom=String(level);
          complete(null);
        };
        timer=setTimeout(retry,8000);
        // Esri otherwise returns a successful HTTP image saying "Map data not
        // yet available", which a normal tileerror listener cannot detect.
        current.src=url.replace('{z}',level).replace('{x}',x).replace('{y}',y)+'?blankTile=false';
      };
      load(coords.z);
      return tile;
    };
    layer.on('tileunload',event=>event.tile?._dgCancelImagery?.());
    return layer;
  }
};
