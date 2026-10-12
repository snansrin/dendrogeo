import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};
vm.runInNewContext(readFileSync(new URL('../src/ui/visitor-activity-disclosure.js',import.meta.url),'utf8'),{window});
const render=window.DG_VISITOR_ACTIVITY_DISCLOSURE_UI.render;

test('activity disclosure keeps visibility, translated label and accessibility state in sync',()=>{
 const wrapper={style:{display:'none'}},attrs={},button={setAttribute(key,value){attrs[key]=value;}};
 const translate=value=>value==='⬆ Gizle'?'Hide':'Show';
 render(wrapper,button,true,{translate});
 assert.equal(wrapper.style.display,'');assert.equal(button.innerHTML,'Hide');assert.equal(attrs['aria-expanded'],'true');
 render(wrapper,button,false,{translate});
 assert.equal(wrapper.style.display,'none');assert.equal(button.innerHTML,'Show');assert.equal(attrs['aria-expanded'],'false');
});

test('activity disclosure retains Turkish defaults and tolerates missing elements',()=>{
 const wrapper={style:{}},button={setAttribute(){}};
 render(wrapper,button,true);assert.equal(button.innerHTML,'⬆ Gizle');
 render(wrapper,button,false);assert.equal(button.innerHTML,'⬇ Göster');
 render(wrapper,null,true);assert.equal(wrapper.style.display,'');
 assert.doesNotThrow(()=>render(null,button,false));
});
