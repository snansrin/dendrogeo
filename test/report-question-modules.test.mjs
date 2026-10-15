import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/application/reports/resolve-report-question-values.js',
 'src/ui/report-question-fields.js',
 'src/ui/report-question-confirmations.js',
 'src/ui/validate-report-question-answer.js',
 'src/ui/run-report-question-dialog.js'
];
function load(){
 const window={},context=vm.createContext({window,Promise,Object,Number,Array});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
 return window;
}

test('report question values preserve park precedence and reusable per-user park drafts',()=>{
 const api=load().DG_RESOLVE_REPORT_QUESTION_VALUES,drafts=new Map([['u:3',{title:'Saved title',purpose:'Saved purpose'}]]);
 const resolved=api.resolve({parkId:3,projectName:'Project',userId:'u',name:'Researcher',defaults:{author_name:'Profile author',project_name:'Default project'},drafts,currentPublication:{parkId:3,parkName:'Publication park'},publicationParks:[{park_id:3,park_name:'Queue park'}]});
 assert.deepEqual(JSON.parse(JSON.stringify(resolved)),{key:'u:3',parkName:'Queue park',values:{author_name:'Profile author',project_name:'Project',title:'Saved title',purpose:'Saved purpose',study_type:'Araştırma raporu'}});
 const fallback=api.resolve({parkId:4,projectName:'',userId:'u',name:'Researcher',defaults:{},drafts:new Map(),publicationParks:[]});
 assert.equal(fallback.parkName,'Park #4');assert.equal(fallback.values.author_name,'Researcher');assert.equal(fallback.values.title,'Park #4 ağaç envanteri ve karbon stoku analizi');
});

test('report question field and confirmation renderers preserve required disclosure and controls',()=>{
 const modules=load(),fields=modules.DG_REPORT_QUESTION_FIELDS.render({author_name:'A',project_name:'P',title:'T',purpose:'Research',sampling:'<plan>',instruments:'<device>'},[['institution','Institution'],['project_name','Project']],{purpose:'<purpose>',sampling:'<sampling>',instruments:'<instruments>'},{input:(...args)=>`<input data-field="${args[0]}">`,label:(key,text)=>`<span>${text}</span>`,escape:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;')});
 assert.match(fields,/name="purpose" rows="3" required minlength="20" maxlength="1600"/);assert.match(fields,/&lt;plan&gt;/);assert.match(fields,/name="independent"/);assert.match(fields,/name="study_type"/);
 const confirmations=modules.DG_REPORT_QUESTION_CONFIRMATIONS.render();
 assert.match(confirmations,/Rapor kapsamı ve DOI/);assert.match(confirmations,/name="publication_consent" required/);assert.match(confirmations,/name="review_confirmed" required/);assert.match(confirmations,/dgReportQuestionErrors/);assert.match(confirmations,/data-close/);
});

test('answer validation keeps native validity, context errors, draft and confirmation result',()=>{
 const api=load().DG_VALIDATE_REPORT_QUESTION_ANSWER,events=[],form={reportValidity:()=>true,elements:{independent:{checked:true},purpose:{focus:()=>events.push('focus')} }},ports={formData:()=>[['purpose','A sufficiently long purpose']],validate:value=>{events.push(['validate',value]);return{valid:false,errors:{purpose:'Purpose required'}};},showErrors:value=>events.push(['errors',value]),saveDraft:value=>events.push(['draft',value]),now:()=> '2026-10-13T00:00:00.000Z'};
 assert.equal(api.execute({...form,reportValidity:()=>false},ports),null);assert.equal(api.execute(form,ports),null);assert.equal(events.at(-2)[0],'errors');assert.equal(events.at(-1),'focus');
 const value={title:'Report'},valid=api.execute(form,{...ports,validate:()=>({valid:true,value}),saveDraft:draft=>events.push(['saved',draft])});
 assert.deepEqual(JSON.parse(JSON.stringify(valid)),{schema:'dendrogeo-report-context/1',study:value,publication_consent:true,confirmed_at:'2026-10-13T00:00:00.000Z'});assert.deepEqual(events.at(-1),['saved',value]);
});

test('dialog lifecycle closes on cancel and returns validated submit data once',async()=>{
 const api=load().DG_RUN_REPORT_QUESTION_DIALOG;let activeModal,restored=0,current=null,submitted;
 const previous={focus(){restored++;}},document={activeElement:previous,body:{appendChild(modal){activeModal=modal;}}};
 function makeModal(){
  const listeners={},form={addEventListener:(name,fn)=>{listeners['form:'+name]=fn;}};
  const closeButton={addEventListener:(name,fn)=>{listeners['button:'+name]=fn;}};
  const select={value:''},input={focus(){}};
  return{listeners,form,closeButton,select,input,innerHTML:'',setAttribute(){},addEventListener(name,fn){listeners[name]=fn;},querySelectorAll:()=>[closeButton],querySelector(selector){return selector==='form'?form:selector==='[name=study_type]'?select:input;},showModal(){},close(){listeners.close?.({});},remove(){}};
 }
 const documentWithModal={...document,createElement:()=>makeModal()};
 const pending=api.run('<form></form>',{document:documentWithModal,setCurrent:value=>{current=value;},studyType:'Research',submit:form=>{submitted=form;return{schema:'ok'};}});
 assert.equal(current,activeModal);activeModal.listeners.cancel({preventDefault(){}});assert.equal(await pending,null);assert.equal(current,null);assert.equal(restored,1);
 const pendingSubmit=api.run('<form></form>',{document:documentWithModal,setCurrent:value=>{current=value;},studyType:'Research',submit:form=>{submitted=form;return{schema:'ok'};}});
 activeModal.listeners['form:submit']({preventDefault(){},currentTarget:activeModal.form});assert.equal((await pendingSubmit).schema,'ok');assert.equal(submitted,activeModal.form);assert.equal(current,null);assert.equal(restored,2);
});

test('academic profile service delegates the complete question flow to its modules',()=>{
 const source=readFileSync(new URL('../src/services/academic-profile.js',import.meta.url),'utf8');
 for(const api of ['DG_RESOLVE_REPORT_QUESTION_VALUES','DG_REPORT_QUESTION_FIELDS','DG_REPORT_QUESTION_CONFIRMATIONS','DG_VALIDATE_REPORT_QUESTION_ANSWER','DG_RUN_REPORT_QUESTION_DIALOG'])assert.ok(source.includes('window.'+api));
 assert.ok(source.includes("function dgReportQuestions(parkId,projectName)"));assert.ok(source.includes("DG_RUN_REPORT_QUESTION_DIALOG.run("));
 assert.doesNotMatch(source,/document\.createElement|modal\.showModal\(/);
});

test('academic profile service runs the extracted report question path end to end',async()=>{
 const window={},listeners={};let activeModal,current=null;
 const form={elements:{independent:{checked:true}},reportValidity:()=>true,addEventListener:(name,fn)=>{listeners['form:'+name]=fn;}};
 const prior={focus(){}};
 const modal={innerHTML:'',setAttribute(){},addEventListener:(name,fn)=>{listeners[name]=fn;},querySelectorAll:()=>[{addEventListener(){}}],querySelector(selector){if(selector==='form')return form;if(selector==='#dgReportQuestionErrors')return{ textContent:''};return{value:'',focus(){}};},showModal(){},close(){listeners.close?.({});},remove(){}};
 const document={activeElement:prior,body:{appendChild(node){activeModal=node;}},createElement:()=>modal};
 const context=vm.createContext({window,document,USER:{id:'u',user_metadata:{}},PROFILE:{full_name:'Researcher'},DG_REPORT_CONTEXT:{clean:value=>value,fields:[],orcidValid:()=>true,validate:value=>({valid:true,value})},DG_PUB_STATE:{parks:[{park_id:12,park_name:'Park <A>'}]},DG_USER_PUB:{parkId:0,parkName:''},esc:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'),FormData:class{[Symbol.iterator](){return[['purpose','A sufficiently long research purpose']][Symbol.iterator]();}},Date,Map,Set,Promise,console});
 context.window=context;context.DG_REPORT_PUBLICATION_REQUEST_APPLICATION={createReportPublicationRequestCollector:()=>()=>null};
 context.DG_RESOLVE_ACADEMIC_PROFILE_DEFAULTS={resolve:()=>({author_name:'Researcher',project_name:'Project'})};context.DG_ACADEMIC_PROFILE_FIELDS={label:(key,text)=>text,input:key=>`<input name="${key}">`};
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
 vm.runInContext(readFileSync(new URL('../src/application/reports/create-academic-report-collector.js',import.meta.url),'utf8'),context);
 vm.runInContext(readFileSync(new URL('../src/services/academic-profile.js',import.meta.url),'utf8'),context);
 const pending=vm.runInContext('dgReportQuestions(12,"Project")',context);
 assert.match(activeModal.innerHTML,/Park &lt;A&gt;/);assert.match(activeModal.innerHTML,/publication_consent/);assert.equal(current,null);
 listeners['form:submit']({preventDefault(){},currentTarget:form});
 const result=await pending;assert.equal(result.schema,'dendrogeo-report-context/1');assert.equal(result.study.independent,true);assert.equal(result.study.purpose,'A sufficiently long research purpose');
});
