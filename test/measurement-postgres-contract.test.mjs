import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import vm from 'node:vm';
const sql=readFileSync(new URL('../supabase/migrations/20261014201828_measurement_protocol_guard.sql',import.meta.url),'utf8');
test('isolated PostgreSQL migration enforces the locked client protocol and is idempotent',async()=>{
 const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../src/config/measurement-protocol-lock.js',import.meta.url),'utf8'),context);
 assert.ok(sql.includes(context.DG_MEASUREMENT_PROTOCOL_LOCK.fingerprint));
 const db=new PGlite();
 try{
  await db.exec("create table measurements(id serial primary key,girth_cm double precision,dbh_cm double precision,status text default 'Beklemede');insert into measurements(girth_cm,dbh_cm) values(null,57),(57,57);");
  await db.exec(sql);await db.exec(sql);
  await db.exec("create role authenticated;grant select,insert,update on measurements to authenticated;grant usage on sequence measurements_id_seq to authenticated;set role authenticated;");
  for(const girth of [0.1,57,110,400*Math.PI]){
   const diameter=context.diameterCmFromCircumference(girth);
   const result=await db.query('insert into measurements(girth_cm,dbh_cm) values($1,$2) returning girth_cm,dbh_cm',[girth,diameter]);
   assert.equal(result.rows[0].girth_cm,girth);assert.equal(result.rows[0].dbh_cm,diameter);
   const derived=await db.query('select public.dg_diameter_from_girth($1) as diameter',[girth]);assert.ok(Math.abs(derived.rows[0].diameter-diameter)<1e-12);
  }
  for(const [girth,diameter] of [[57,57],[57,18.1],[null,20],[0,20],[-1,20],[Infinity,20],[NaN,20],[400*Math.PI+1,400]]){
   await assert.rejects(db.query('insert into measurements(girth_cm,dbh_cm) values($1,$2)',[girth,diameter]),/MEASUREMENT_PROTOCOL/);
  }
  await db.query("update measurements set status='Onaylandı' where id in (1,2)");
  const legacy=await db.query('select girth_cm,dbh_cm from measurements where id in (1,2) order by id');assert.deepEqual(legacy.rows,[{girth_cm:null,dbh_cm:57},{girth_cm:57,dbh_cm:57}]);
  await assert.rejects(db.query('update measurements set girth_cm=110,dbh_cm=20 where id=2'),/MEASUREMENT_PROTOCOL/);
  await db.query('update measurements set girth_cm=110,dbh_cm=$1 where id=2',[110/Math.PI]);
 }finally{await db.close();}
});
