import {PngCanvas} from './png.mjs';

/* Typography uses logical pixels; geometry is rasterized at the native output resolution. */
export function createReportMapCanvas({width,height,background,pixelRatio=1}){
 const ratio=Math.min(4,Math.max(1,Math.round(Number(pixelRatio)||1)));
 const canvas=new PngCanvas(width*ratio,height*ratio,background);
 if(ratio===1)return{canvas,view:canvas,ratio};
 const view={w:width,h:height,
  set(x,y,color){canvas.rect(Math.floor(x)*ratio,Math.floor(y)*ratio,(Math.floor(x)+1)*ratio-1,(Math.floor(y)+1)*ratio-1,color);},
  rect(x0,y0,x1,y1,color){canvas.rect(x0*ratio,y0*ratio,(x1+1)*ratio-1,(y1+1)*ratio-1,color);},
  line(x0,y0,x1,y1,color){for(let oy=0;oy<ratio;oy++)for(let ox=0;ox<ratio;ox++)canvas.line(x0*ratio+ox,y0*ratio+oy,x1*ratio+ox,y1*ratio+oy,color);},
  text(x,y,text,color,scale=2){return canvas.text(x*ratio,y*ratio,text,color,scale*ratio)/ratio;}
 };
 return{canvas,view,ratio};
}
