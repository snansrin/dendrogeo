import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const source=readFileSync(new URL('../src/adapters/trees/update-measurement-if-current.js',import.meta.url),'utf8');
function adapter(){
  const window={};vm.runInNewContext(source,{window});return window.DG_UPDATE_MEASUREMENT_IF_CURRENT;
}
function postgresClient(db){
  const requests=[];
  return {requests,from(table){
    assert.equal(table,'measurements');
    let updates,filters=[];const q={
      update(value){updates=value;return q;},
      eq(key,value){filters.push([key,value]);return q;},
      is(key,value){assert.equal(value,null);filters.push([key,null]);return q;},
      async select(){
        requests.push({updates:{...updates},filters:[...filters]});
        const parameters=[];
        const parameter=value=>{parameters.push(value);return '$'+parameters.length;};
        const set=Object.entries(updates).map(([key,value])=>'"'+key+'"='+parameter(value));
        const where=filters.map(([key,value])=>'"'+key+'"'+(value===null?' is null':'='+parameter(value)));
        const rows=await db.query('update measurements set '+set.join(',')+' where '+where.join(' and ')+' returning id',parameters);
        return{data:rows.rows,error:null};
      }
    };return q;
  }};
}
async function fixture(fn){
  const db=new PGlite();
  try{
    await db.exec(`create table measurements(
      id bigint primary key,owner text not null,client_id text not null unique,
      status text not null,deleted_at timestamptz,
      project_id bigint,point_id integer,measurement_no integer,
      grp text,species text,girth_cm double precision,dbh_cm double precision,
      height_m double precision,volume_m3 double precision,carbon_kg double precision,
      photo_url text,photo_file text,shared boolean,slope_deg double precision,park_id bigint
    );`);
    await db.query(`insert into measurements
      (id,owner,client_id,status,project_id,point_id,measurement_no,grp,species,
       girth_cm,dbh_cm,height_m,volume_m3,carbon_kg,photo_url,shared,slope_deg,park_id)
      values (7,'u','v1','Onaylı',25,7,1,'YAPRAKLI','SÜS ERİĞİ',
      100,100/pi(),9,0.8,310,'original.jpg',false,3,25)`);
    return await fn(db,postgresClient(db));
  }finally{await db.close();}
}

test('PostgreSQL: changing species does not overwrite untouched scientific dimensions, photos or metadata',async()=>{
 await fixture(async(db,client)=>{
   const baseline=(await db.query('select * from measurements where id=7')).rows[0];
   // Real scientific input may differ by a microscopic double-precision value
   // without the owner having submitted any edit of that dimension.
   await db.query('update measurements set girth_cm=100.00000000000001 where id=7');
   const result=await adapter().update({client,editId:7,owner:'u',baseline,payload:{
     owner:'u',client_id:'v2',project_id:25,point_id:7,measurement_no:1,
     grp:'YAPRAKLI',species:'ZEYTİN',girth_cm:100,dbh_cm:100/Math.PI,
     height_m:9,volume_m3:0.8,carbon_kg:420,status:'Beklemede',
     park_id:25,shared:true,slope_deg:0
   }});
   assert.equal(result.error,null);assert.equal(result.data.length,1);
   const row=(await db.query('select * from measurements where id=7')).rows[0];
   assert.equal(row.species,'ZEYTİN');assert.equal(row.carbon_kg,420);
   assert.equal(row.girth_cm,100.00000000000001);
   assert.equal(row.photo_url,'original.jpg');
   assert.equal(row.dbh_cm,100/Math.PI);
   assert.equal(row.shared,false);assert.equal(row.slope_deg,3);
   assert.equal(row.client_id,'v2');
   const sent=client.requests[0];
   assert.deepEqual(Object.keys(sent.updates).sort(),['carbon_kg','client_id','species','status']);
   assert.deepEqual(sent.filters.map(([k])=>k),['id','owner','client_id','status','deleted_at']);
 });
});

test('PostgreSQL: a stale client revision or changed approval state cannot be overwritten',async()=>{
 await fixture(async(db,client)=>{
   const baseline=(await db.query('select * from measurements where id=7')).rows[0];
   await db.query("update measurements set client_id='new-revision' where id=7");
   const stale=await adapter().update({client,editId:7,owner:'u',baseline,payload:{owner:'u',client_id:'v2',species:'ZEYTİN'}});
   assert.equal(stale.data.length,0);
   await db.query("update measurements set client_id='v1',status='Beklemede' where id=7");
   const reviewed=await adapter().update({client,editId:7,owner:'u',baseline,payload:{owner:'u',client_id:'v2',species:'ZEYTİN'}});
   assert.equal(reviewed.data.length,0);
   assert.equal((await db.query('select species from measurements where id=7')).rows[0].species,'SÜS ERİĞİ');
 });
});

test('owner mismatch and a stale photo replacement are both rejected without overwriting evidence',async()=>{
 await fixture(async(db,client)=>{
   const baseline=(await db.query('select * from measurements where id=7')).rows[0];
   await assert.rejects(adapter().update({client,editId:7,owner:'other',baseline,payload:{owner:'other',client_id:'v2',species:'ZEYTİN'}}),/başlangıç kaydı/);
   await db.query("update measurements set photo_url='new.jpg' where id=7");
   const result=await adapter().update({client,editId:7,owner:'u',baseline,payload:{owner:'u',client_id:'v2',photo_url:'replacement.jpg'}});
   assert.equal(result.data.length,0);
   assert.equal((await db.query('select photo_url from measurements where id=7')).rows[0].photo_url,'new.jpg');
 });
});
