"use strict";
/* Pure pixel evidence classifier for the field-photo gate. The calibrated
 * thresholds and output proportions are intentionally unchanged. */
(function(root){
  function scan(data,size){
    const n=size*size;
    let green=0,warm=0,purple=0,woody=0,blue=0,cloud=0,dark=0,lumSum=0;
    const lum=new Float64Array(n);
    for(let i=0,p=0;i<n;i++,p+=4){
      const R=data[p],G=data[p+1],B=data[p+2];
      const L=(R+G+B)/3;lum[i]=L;lumSum+=L;
      const mx=R>G?(R>B?R:B):(G>B?G:B),mn=R<G?(R<B?R:B):(G<B?G:B),sat=mx-mn;
      const isBlue=(B>G+10&&B>R+20);
      if(isBlue)blue++;
      else if(L>185&&sat<30&&B>=R-4)cloud++;
      else if(2*G-R-B>20&&G>40&&G>=B-2&&G>=R-12)green++;
      else if(R>G+8&&G>B+5&&R>70&&L>95&&L<232&&sat>22)warm++;
      else if(R>G+12&&R>B+8&&B>G-28&&L>30&&L<215&&sat>18)purple++;
      else if(R>G&&G>=B-4&&(R-B)>12&&(R-B)<95&&R>45&&R<205&&sat>8)woody++;
      if(L<90&&!isBlue)dark++;
    }
    const hist=new Array(16).fill(0);
    for(let i=0;i<n;i++)hist[Math.min(15,(lum[i]/16)|0)]++;
    let bi=0;for(let k=1;k<16;k++)if(hist[k]>hist[bi])bi=k;
    const bgL=bi*16+8;
    let struct=0;
    for(let i=0,p=0;i<n;i++,p+=4){
      const L=lum[i];
      if(Math.abs(L-bgL)>32){
        const R=data[p],G=data[p+1],B=data[p+2];
        const mx=R>G?(R>B?R:B):(G>B?G:B),mn=R<G?(R<B?R:B):(G<B?G:B),sat=mx-mn;
        if(!((B>G+10&&B>R+20)||(L>185&&sat<30&&B>=R-4)))struct++;
      }
    }
    return{lum:lumSum/n,blue:blue/n,cloud:cloud/n,green:green/n,warm:warm/n,
           purple:purple/n,woody:woody/n,dark:dark/n,struct:struct/n};
  }
  function gate(m){
    const exp=m.lum>25&&m.lum<245;
    const fol=m.green+m.warm+m.purple;
    const winter=m.blue>=0.25&&(m.struct>=0.025||m.dark>=0.03);
    return exp&&(fol>=0.05||m.woody>=0.05||winter);
  }
  root.DG_TREE_PHOTO_QUALITY=Object.freeze({scan,gate});
})(window);
