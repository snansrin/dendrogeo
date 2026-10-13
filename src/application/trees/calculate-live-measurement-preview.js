"use strict";

/* Validate and calculate the measurement form's carbon preview in order. */
window.DG_CALCULATE_LIVE_MEASUREMENT_PREVIEW={
  calculate({input,validate,calculate}){
    const request=input();
    if(!validate(request).valid)return{show:false,request,result:null};
    const result=calculate(request);
    return{show:true,request,result:result&&result.valid?result:null};
  }
};
