"use strict";
/* Tür kataloğu. Odun yoğunluğu bu dosyada TANIMLANMAZ.
 * Tek kaynak: src/config/wood-density-lock.js
 * Yeni tür kuralı: yalnız İBRELİ/YAPRAKLI grubuna rho:null ile eklenebilir.
 */
if(typeof WOOD_DENSITY_LOCK_ID==="undefined"||typeof _LOCKED_RHO==="undefined"||typeof GROUP_DEFAULT_RHO==="undefined")
 throw new Error("WOOD_DENSITY_LOCK_REQUIRED");
const SPECIES_DATA={
 "İBRELİ":[
  {tr:"GÖKNAR",lat:"Abies spp.",rho:_LOCKED_RHO["GÖKNAR"]},
  {tr:"SEDİR",lat:"Cedrus libani",rho:_LOCKED_RHO["SEDİR"]},
  {tr:"HİMALAYA SEDİRİ",lat:"Cedrus deodara",rho:_LOCKED_RHO["HİMALAYA SEDİRİ"]},
  {tr:"ATLAS SEDİRİ",lat:"Cedrus atlantica",rho:null},
  {tr:"ARDIÇ",lat:"Juniperus spp.",rho:_LOCKED_RHO["ARDIÇ"]},
  {tr:"LADİN",lat:"Picea orientalis",rho:_LOCKED_RHO["LADİN"]},
  {tr:"MAVİ LADİN",lat:"Picea pungens",rho:null},
  {tr:"KIZILÇAM",lat:"Pinus brutia",rho:_LOCKED_RHO["KIZILÇAM"]},
  {tr:"KARAÇAM",lat:"Pinus nigra",rho:_LOCKED_RHO["KARAÇAM"]},
  {tr:"SARIÇAM",lat:"Pinus sylvestris",rho:_LOCKED_RHO["SARIÇAM"]},
  {tr:"FISTIK ÇAMI",lat:"Pinus pinea",rho:_LOCKED_RHO["FISTIK ÇAMI"]},
  {tr:"HALEP ÇAMI",lat:"Pinus halepensis",rho:_LOCKED_RHO["HALEP ÇAMI"]},
  {tr:"GÜMÜŞ LADİN",lat:"Picea pungens",rho:null},
  {tr:"MAVİ SEDİR",lat:"Cedrus atlantica 'Glauca'",rho:null},
  {tr:"SERVİ",lat:"Cupressus sempervirens",rho:null},
  {tr:"MAZI (YALANCI SERVİ)",lat:"Thuja orientalis",rho:null},
  {tr:"PORSUK",lat:"Taxus baccata",rho:null},
  {tr:"KRİPTOMERYA",lat:"Cryptomeria japonica",rho:null},
  {tr:"DİĞER İBRELİ",lat:"Coniferae spp.",rho:null}
 ],
 "YAPRAKLI":[
  {tr:"MEŞE",lat:"Quercus spp.",rho:_LOCKED_RHO["MEŞE"]},
  {tr:"GÜRGEN",lat:"Carpinus betulus",rho:_LOCKED_RHO["GÜRGEN"]},
  {tr:"KAYIN",lat:"Fagus orientalis",rho:_LOCKED_RHO["KAYIN"]},
  {tr:"DİŞBUDAK",lat:"Fraxinus excelsior",rho:_LOCKED_RHO["DİŞBUDAK"]},
  {tr:"SIĞLA",lat:"Liquidambar orientalis",rho:null},
  {tr:"KAVAK",lat:"Populus spp.",rho:_LOCKED_RHO["KAVAK"]},
  {tr:"KIZILAĞAÇ",lat:"Alnus glutinosa",rho:_LOCKED_RHO["KIZILAĞAÇ"]},
  {tr:"ÇINAR",lat:"Platanus orientalis",rho:null},
  {tr:"DOĞU ÇINARI",lat:"Platanus orientalis",rho:null},
  {tr:"SÖĞÜT",lat:"Salix alba",rho:null},
  {tr:"SALKIM SÖĞÜT",lat:"Salix babylonica",rho:null},
  {tr:"AKÇAAĞAÇ",lat:"Acer spp.",rho:null},
  {tr:"IHLAMUR",lat:"Tilia spp.",rho:null},
  {tr:"AT KESTANESİ",lat:"Aesculus hippocastanum",rho:null},
  {tr:"KESTANE",lat:"Castanea sativa",rho:null},
  {tr:"HUŞ",lat:"Betula pendula",rho:null},
  {tr:"KARAAĞAÇ",lat:"Ulmus minor",rho:null},
  {tr:"DUT",lat:"Morus alba",rho:null},
  {tr:"CEVİZ",lat:"Juglans regia",rho:null},
  {tr:"AKASYA",lat:"Acacia spp.",rho:null},
  {tr:"YALANCI AKASYA",lat:"Robinia pseudoacacia",rho:null},
  {tr:"MANOLYA",lat:"Magnolia grandiflora",rho:null},
  {tr:"SÜS ELMASI",lat:"Malus spp.",rho:null},
  {tr:"SÜS ERİĞİ",lat:"Prunus cerasifera",rho:null},
  {tr:"KATALPA",lat:"Catalpa bignonioides",rho:null},
  {tr:"GLEDİÇYA",lat:"Gleditsia triacanthos",rho:null},
  {tr:"JAPON SOFORASI",lat:"Styphnolobium japonicum",rho:null},
  {tr:"DEFNE",lat:"Laurus nobilis",rho:null},
  {tr:"AMBERAĞACI",lat:"Liquidambar styraciflua",rho:null},
  {tr:"DİĞER YAPRAKLI",lat:"Angiosperm spp.",rho:null}
 ]
};
/* Geriye dönük uyumluluk + hızlı erişim haritaları */
const species={}; const rho={}; const LATIN={}; const SPECIES_GROUP={};
Object.keys(SPECIES_DATA).forEach(g=>{
 species[g]=SPECIES_DATA[g].map(s=>s.tr);
 SPECIES_DATA[g].forEach(s=>{
  if(s.rho!=null)rho[s.tr]=s.rho;
  LATIN[s.tr]=s.lat;
  SPECIES_GROUP[s.tr]=g;
 });
 Object.freeze(species[g]);
});
Object.freeze(species);
Object.freeze(rho);
Object.freeze(LATIN);
Object.freeze(SPECIES_GROUP);
/* Yoğunluk taşıyan tür satırları da çalışma anında değiştirilemesin. */
Object.keys(SPECIES_DATA).forEach(g=>{
 SPECIES_DATA[g].forEach(Object.freeze);
 Object.freeze(SPECIES_DATA[g]);
});
Object.freeze(SPECIES_DATA);

/* Tür rengi (analiz grafiklerinde DOLGU/çizgi rengi olarak kullanılır) */
const GROUP_COLOR={"İBRELİ":"#1e6f4b","YAPRAKLI":"#c77d2e","DİĞER":"#94a3b8"};
/* METİN tonları (0035 · WCAG): GROUP_COLOR dolgu içindir; küçük metinde
 * #c77d2e 3.03:1, #94a3b8 2.37:1 → AA FAIL. Metinde bu koyu tonlar kullanılır
 * (İBRELİ 5.66 · YAPRAKLI 5.78 · DİĞER 5.04, bg üzerinde). Kilit:
 * test/landing-claims.test.mjs. */
const GROUP_COLOR_INK={"İBRELİ":"#1e6f4b","YAPRAKLI":"#9a4a08","DİĞER":"#5b6b7f"};

/* Saha kayıtları ve cihaz çıktıları kanonik ad dışında yazımlar üretebilir.
 * Eşanlamlılar yalnız OKUMA yolunda çözülür; veritabanına kanonik ad yazılır. */
const SPECIES_SYNONYMS={
 "AGLAYAN SOGUT":"SALKIM SÖĞÜT",
 "MAVI SEDIR":"ATLAS SEDİRİ",
 "AKCA AGAC":"AKÇAAĞAÇ",
 "CINAR":"ÇINAR",
 "ADI CINAR":"ÇINAR",
 "SALKIMLI SOGUT":"SALKIM SÖĞÜT",
 "BABIL SOGUDU":"SALKIM SÖĞÜT",
 "CEVIZ":"CEVİZ",
 "CEVIZ AGACI":"CEVİZ",
 "ADI CEVIZ":"CEVİZ",
 "INGILIZ CEVIZI":"CEVİZ",
 "SIGLA":"SIĞLA",
};
/* Türkçe-duyarlı normalleştirme: büyük harf, aksan katlama,
 * parantez-içi ve fazla boşluk temizliği. */
function normSp(s){
 let t=String(s==null?"":s).trim();
 if(!t)return "";
 try{t=t.toLocaleUpperCase("tr-TR");}catch(e){t=t.toUpperCase();}
 t=t.replace(/[\u0300-\u036f]/g,"")
    .replace(/İ/g,"I").replace(/ı/g,"I")
    .replace(/Ş/g,"S").replace(/ş/g,"s").toUpperCase()
    .replace(/Ğ/g,"G").replace(/Ü/g,"U").replace(/Ö/g,"O").replace(/Ç/g,"C")
    .replace(/\s*\([^)]*\)\s*/g," ")
    .replace(/[^A-Z0-9]+/g," ")
    .replace(/\s+/g," ")
    .trim();
 return t;
}
const _SP_NORM={};
Object.keys(SPECIES_DATA).forEach(g=>SPECIES_DATA[g].forEach(s=>{
 _SP_NORM[normSp(s.tr)]=s.tr;
 /* Bilimsel adla gelen importlar da kanonik Türkçe türe çözülür.
  * Aynı Latince ada sahip dekoratif varyetelerde ilk kayıt korunur. */
 const ln=normSp(s.lat);
 if(ln&&s.lat!=="—"&&!_SP_NORM[ln])_SP_NORM[ln]=s.tr;
}));
Object.keys(SPECIES_SYNONYMS).forEach(k=>{
 const v=SPECIES_SYNONYMS[k];
 if(_SP_NORM[normSp(v)]===v)_SP_NORM[k]=v;
});
function resolveSpeciesName(name){
 const n=normSp(name);
 if(!n)return null;
 return _SP_NORM[n]||null;
}
/* TEK ρ çözüm yolu:
 * 1) tür katalogda bulunmalı,
 * 2) kayıt grubu katalog grubuyla aynı olmalı,
 * 3) kilitli özel ρ varsa onu, yoksa yalnız İBRELİ/YAPRAKLI genelini kullan.
 * DİĞER, bilinmeyen tür veya grup uyuşmazlığı karbon üretemez. */
function densityKgFor(name,grp){
 const canonical=resolveSpeciesName(name);
 if(!canonical)return null;
 const expectedGroup=SPECIES_GROUP[canonical];
 if(!expectedGroup||expectedGroup!==grp||!MEASUREMENT_GROUPS.includes(grp))return null;
 return rho[canonical]??GROUP_DEFAULT_RHO[grp]??null;
}

