"use strict";

/* Load the four independent owner activity sources without shaping their rows. */
window.DG_VISITOR_STORED_ACTIVITY_STORE={
 create(){
  async function load(client){
   const datasets={measurements:[],projects:[],dataRequests:[],reportRequests:[]};
   try{
    const{data}=await client.from("measurements").select("id,point_id,species,status,created_at,profiles!measurements_owner_fkey(full_name)").order("created_at",{ascending:false}).limit(40);
    datasets.measurements=data||[];
   }catch(e){}
   try{
    const{data}=await client.from("projects").select("id,name,created_at,profiles(full_name)").order("created_at",{ascending:false}).limit(20);
    datasets.projects=data||[];
   }catch(e){}
   try{
    const{data}=await client.from("data_requests").select("id,email,status,created_at").order("created_at",{ascending:false}).limit(20);
    datasets.dataRequests=data||[];
   }catch(e){}
   try{
    const{data}=await client.from("report_requests").select("id,status,created_at,park_id").order("created_at",{ascending:false}).limit(20);
    datasets.reportRequests=data||[];
   }catch(e){}
   return datasets;
  }
  return Object.freeze({load});
 }
};
