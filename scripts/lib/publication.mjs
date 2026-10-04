/* Public study metadata. No privileges or measurements derive from these claims. */
export function parsePublication(note) {
 let p;try{p=typeof note==='string'?JSON.parse(note):note;}catch{throw Error('Yayın öncesi çalışma künyesi eksik. Yayın formunu doldurun.');}
 if(!p||p.schema!=='dendrogeo-publication/1')throw Error('Geçerli çalışma künyesi gerekli.');
 const limits={title:240,project:240,researcher:160,institution:200,department:200,supervisor:160,purpose:1600,sampling:1600,instruments:1000,funding:300};
 const required=new Set(['title','project','researcher','institution','purpose','sampling','instruments']);
 const out={schema:p.schema};
 for(const [k,max] of Object.entries(limits)){const v=typeof p[k]==='string'?p[k].trim():'';if(v.length>max||(required.has(k)&&!v))throw Error('Eksik veya fazla uzun çalışma bilgisi: '+k);out[k]=v;}
 if(!['research','thesis','inventory'].includes(p.study_type))throw Error('Geçersiz çalışma türü.');out.study_type=p.study_type;
 for(const k of ['start_date','end_date']){const d=p[k];if(!/^\d{4}-\d{2}-\d{2}$/.test(d||'')||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw Error('Geçersiz saha tarihi.');out[k]=d;}
 if(out.end_date<out.start_date||out.end_date>new Date().toISOString().slice(0,10))throw Error('Saha tarih aralığı geçersiz.');
 if(out.study_type==='thesis'&&!out.supervisor)throw Error('Tez / bitirme projesi için danışman gerekli.');
 return out;
}
export function zenodoMetadata(snap,id) {
 const p=parsePublication(snap.publication);
 return {upload_type:'publication',publication_type:'report',title:p.title,description:p.purpose+'\n\nÖrnekleme: '+p.sampling+'\n\nSaha yöntemi: '+p.instruments,creators:[{name:snap.author?.name||p.researcher,affiliation:p.institution}],keywords:['urban forestry','tree inventory','carbon stock','DendroGeo'],license:'cc-by-nc-4.0',related_identifiers:[{identifier:'https://dendrogeo.org/rapor/'+id+'/',relation:'isIdenticalTo',scheme:'url'}],notes:'Proje: '+p.project+'; saha dönemi: '+p.start_date+' – '+p.end_date+(p.supervisor?'; danışman: '+p.supervisor:'')};
}
