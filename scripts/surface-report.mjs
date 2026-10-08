/* A publication consumes the immutable accepted result attached to its request. */
export const SURFACE_CLASSES={green:{label:'Yeşil alan',color:'#22c55e'},hard:{label:'Sert zemin',color:'#64748b'},building:{label:'Bina',color:'#475569'},water:{label:'Su',color:'#3b82f6'},pool:{label:'Havuz / süs havuzu',color:'#0ea5e9'},bare:{label:'Çıplak zemin',color:'#8b5a2b'},other:{label:'Diğer',color:'#94a3b8'}};

/* Report PRESENTATION only: water bodies and legacy pool geometries occupy
 * one water row, without changing the validated immutable source snapshot.
 * The original classes / areas / feature IDs remain available for QA. */
export function presentationSurfaceClasses(classes){
 const source=Array.isArray(classes)?classes:[];
 const oldPool=source.find(c=>c?.key==='pool');
 if(!oldPool)return source.slice();
 const poolHa=Number(oldPool.ha)||0,poolPct=Number(oldPool.pct)||0;
 let waterFound=false;
 const out=source.filter(c=>c?.key!=='pool').map(c=>{
  if(c.key!=='water')return {...c};
  waterFound=true;
  return {...c,label:'Su',ha:(Number(c.ha)||0)+poolHa,pct:(Number(c.pct)||0)+poolPct};
 });
 if(!waterFound)out.push({key:'water',label:'Su',ha:poolHa,pct:poolPct});
 return out;
}
export function reviewedSurface(snapshot,parkId){
 if(!snapshot||snapshot.schema!=='dendrogeo-surface/2'||String(snapshot.parkId)!==String(parkId)||!Number.isFinite(Date.parse(snapshot.acceptedAt)))throw Error('Kayıtlı analiz kimliği geçersiz.');
 const areas=snapshot.areas,features=snapshot.features;
 if(!areas||!Array.isArray(features)||!features.length||!Array.isArray(snapshot.outer)||!snapshot.outer.length)throw Error('Kayıtlı analiz geometrisi eksik.');
 const sums={};let count=0;
 const validRing=r=>Array.isArray(r)&&r.length>=4&&r.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90)&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1];
 for(const f of features){const k=f.properties?.class,a=f.properties?.area_m2;if(!SURFACE_CLASSES[k]||!Number.isFinite(a)||a<0||f.geometry?.type!=='MultiPolygon'||!f.geometry.coordinates?.length||!f.geometry.coordinates.every(p=>p.length&&p.every(validRing)))throw Error('Kayıtlı analiz sınıfı veya koordinatları geçersiz.');sums[k]=(sums[k]||0)+a;count++;}
 if(snapshot.displayFeatures!=null){if(!Array.isArray(snapshot.displayFeatures)||snapshot.displayFeatures.length!==features.length)throw Error('Görsel yüzey geometrisi eksik.');for(const f of snapshot.displayFeatures)if(!SURFACE_CLASSES[f.properties?.class]||!f.geometry?.coordinates?.every(p=>p.length&&p.every(validRing)))throw Error('Görsel yüzey geometrisi geçersiz.');}
 let total=0;for(const [k,a] of Object.entries(areas)){if(!SURFACE_CLASSES[k]||!Number.isFinite(a)||a<0||Math.abs(a-(sums[k]||0))>Math.max(.1,a*.00001))throw Error('Kayıtlı analiz alanı harita ile uyuşmuyor: '+k);total+=a;}
 for(const k of Object.keys(sums))if(!(k in areas))throw Error('Kayıtlı analizde sınıf alanı eksik: '+k);
 if(!(total>0))throw Error('Kayıtlı analiz alanı boş.');
 for(const ring of [...snapshot.outer,...(snapshot.holes||[])])if(!Array.isArray(ring)||ring.length<3||ring.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>90||Math.abs(p[1])>180))throw Error('Kayıtlı park sınırı geçersiz.');
 const classes=Object.fromEntries(Object.entries(SURFACE_CLASSES).map(([k,c])=>[k,{...c,areaM2:areas[k]||0}]));
 return {source:'Kullanıcının kabul ettiği son analiz · uydu / OSM / çizim',citation:'Sentinel-2 L2A; ESA WorldCover; © OpenStreetMap contributors (ODbL); kullanıcı sınır düzeltmeleri',year:new Date(snapshot.acceptedAt).getUTCFullYear(),cross:null,crossError:null,agreement:null,areaDeltaPct:null,cells:snapshot.cellCount||count,coverage_m2:total,classified_m2:total,epsg:snapshot.epsg,masked_ha:0,review:snapshot,classes:Object.entries(classes).map(([key,c])=>({key,label:c.label,ha:c.areaM2/10000,pct:100*c.areaM2/total})),mapClasses:classes};
}
