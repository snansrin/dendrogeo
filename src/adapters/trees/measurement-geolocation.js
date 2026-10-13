"use strict";

/* Isolate the browser geolocation capability used by field measurement. */
window.DG_MEASUREMENT_GEOLOCATION_ADAPTER={
  create({getNavigator}){
    return{
      isAvailable(){const nav=getNavigator();return !!(nav&&nav.geolocation);},
      async permissionState(){
        const nav=getNavigator();
        if(!nav||!nav.permissions||!nav.permissions.query)return null;
        const permission=await nav.permissions.query({name:"geolocation"});
        return permission&&permission.state||null;
      },
      getCurrentPosition(success,error,options){return getNavigator().geolocation.getCurrentPosition(success,error,options);},
      watchPosition(success,error,options){return getNavigator().geolocation.watchPosition(success,error,options);}
    };
  }
};
