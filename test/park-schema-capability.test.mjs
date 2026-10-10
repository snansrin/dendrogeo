import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/domain/parks/is-schema-error.js',import.meta.url),'utf8'),context);
const classify=error=>context.window.DG_PARK_SCHEMA_CAPABILITY.isSchemaError(error);

test('Postgres missing schema objects and PostgREST schema-cache errors are classified',()=>{
  assert.equal(classify({code:'42P01',message:'relation public.parks does not exist'}),true);
  assert.equal(classify({code:'42703',message:'column park_id does not exist'}),true);
  assert.equal(classify({code:'42883',message:'function missing'}),true);
  assert.equal(classify({message:'PGRST205: schema cache'}),true);
  assert.equal(classify({code:'PGRST202'}),true);
  assert.equal(classify({message:'could not find the view v_park_compare'}),true);
});

test('permission, authentication, network, and timeout errors are not schema failures',()=>{
  for(const error of [
    {code:'42501',message:'permission denied for view v_park_compare'},
    {code:401,message:'JWT expired'},
    {message:'Failed to fetch'},
    {message:'Request timeout'}
  ])assert.equal(classify(error),false,JSON.stringify(error));
});
