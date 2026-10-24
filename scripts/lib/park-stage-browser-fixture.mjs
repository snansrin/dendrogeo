export async function installStageFixture(page){
 await page.evaluate(async()=>{
  go('map');queryDetailedCoverage=async()=>true;
  const square=(a,b,h,w)=>[[a,b],[a,b+w],[a+h,b+w],[a+h,b],[a,b]];
  const outer=square(39,32,.01,.02),parent={id:9001,osm_key:'way/990001',name:'Sentetik etap parkı',source:'osm',area_m2:polyArea({outer:[outer],inner:[]})};
  window.__stageFixture={parent,rows:[],writes:0};
  DG_PARK_SESSION.set(parent.osm_key,parent);PROJ_LIST=[{id:8001,park_id:9001,name:'Ana parkın eski projesi'}];
  WP=[{id:1,project_id:8001,lat:39.001,lon:32.001}];LAST_WP_ROWS=[...WP];
  const rpc=sb.rpc.bind(sb),from=sb.from.bind(sb);
  sb.rpc=async(name,args)=>{
   if(name==='dg_park_stage_ready')return{data:1,error:null};
   if(name==='dg_create_park_stage'){
    ++__stageFixture.writes;
    const geom={...args.p_geometry,stage_scope:{schema:'dendrogeo/park-stage/1',parentId:9001,parentKey:parent.osm_key,parentName:parent.name,label:args.p_name,definition:'user-defined'}};
    const row={id:9002+__stageFixture.rows.length,osm_key:'stage/9001/'+(__stageFixture.rows.length+1).toString(16).padStart(32,'0'),name:parent.name+' · '+args.p_name+' (kullanıcı tanımlı etap)',geom_json:geom,area_m2:polyArea(args.p_geometry),source:'manual'};
    __stageFixture.rows.push(row);return{data:row,error:null};
   }return rpc(name,args);
  };
  sb.from=table=>{
   if(table!=='parks')return from(table);
   const filters={},chain={select(){return this;},like(){return this;},order(){return this;},eq(k,v){filters[k]=v;return this;},limit:async()=>({data:__stageFixture.rows,error:null}),single:async()=>({data:__stageFixture.rows.find(r=>r.id===filters.id&&r.osm_key===filters.osm_key),error:null})};return chain;
  };
  window.__parentCandidate={name:parent.name,type:'way',id:990001,rings:{outer:[outer],inner:[]},area:parent.area_m2};
  await drawPark(__parentCandidate);
 });
}
