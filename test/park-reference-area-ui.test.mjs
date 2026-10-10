import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const c=vm.createContext({window:{}});vm.runInContext(readFileSync(new URL('../src/ui/park-reference-area.js',import.meta.url),'utf8'),c);
function setup({area=50,park=[],element={style:{},textContent:''}}={}){let reference=null,reads=0;const ui=c.window.DG_PARK_REFERENCE_AREA_UI.create({getElement:()=>element,getReference:()=>reference,setReference:v=>{reference=v;},getPark:()=>park,getAreaHa:()=>{reads++;return area;}});return{ui,element,reference:()=>reference,reads:()=>reads};}
test('reference input retains parseFloat behavior and invalid values hide the badge',()=>{const x=setup();x.ui.set('50ha');assert.equal(x.reference(),50);assert.equal(x.element.textContent,'Referans: 50.00 ha · Sapma: %0.0');for(const value of ['',0,-1,Infinity,'bad']){x.ui.set(value);assert.equal(x.reference(),null);assert.equal(x.element.style.display,'none');assert.equal(x.element.textContent,'');}});
test('comparison colors preserve strict three-percent threshold and absolute deviation',()=>{for(const [area,color,percent] of [[51,'#16a34a','2.0'],[51.5,'#b45309','3.0'],[48.5,'#b45309','3.0']]){const x=setup({area});x.ui.set(50);assert.equal(x.element.style.color,color);assert.equal(x.element.style.display,'inline-flex');assert.match(x.element.textContent,new RegExp('Sapma: %'+percent));}});
test('missing park or nonpositive measured area hides the reference comparison',()=>{for(const args of [{park:null},{area:0},{area:NaN}]){const x=setup(args);x.ui.set(50);assert.equal(x.element.style.display,'none');assert.equal(x.element.textContent,'');if(args.park===null)assert.equal(x.reads(),0);}});
test('absent badge avoids reading measured area while still accepting reference input',()=>{const x=setup({element:null});x.ui.set(50);assert.equal(x.reference(),50);assert.equal(x.reads(),0);});
