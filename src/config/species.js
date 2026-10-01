"use strict";
const SPECIES_DATA={
 "İBRELİ":[
  {tr:"GÖKNAR",lat:"Abies spp.",rho:350},
  {tr:"SEDİR",lat:"Cedrus libani",rho:430},
  {tr:"HİMALAYA SEDİRİ",lat:"Cedrus deodara",rho:430},
  {tr:"ATLAS SEDİRİ",lat:"Cedrus atlantica",rho:490},   /* [WD] .44/.53 → ort. (0011e: kullanıcı onayıyla listede) */
  {tr:"ARDIÇ",lat:"Juniperus spp.",rho:460},
  {tr:"LADİN",lat:"Picea orientalis",rho:358},
  {tr:"MAVİ LADİN",lat:"Picea pungens",rho:450},        /* [WD] (0011e: kullanıcı onayıyla listede) */
  {tr:"KIZILÇAM",lat:"Pinus brutia",rho:478},
  {tr:"KARAÇAM",lat:"Pinus nigra",rho:470},
  {tr:"SARIÇAM",lat:"Pinus sylvestris",rho:426},
  {tr:"FISTIK ÇAMI",lat:"Pinus pinea",rho:470},
  {tr:"HALEP ÇAMI",lat:"Pinus halepensis",rho:480},
  {tr:"GÜMÜŞ LADİN",lat:"Picea pungens",rho:null},
  {tr:"MAVİ SEDİR",lat:"Cedrus atlantica 'Glauca'",rho:null},
  {tr:"SERVİ",lat:"Cupressus sempervirens",rho:null},
  {tr:"MAZI (YALANCI SERVİ)",lat:"Thuja orientalis",rho:null},
  {tr:"PORSUK",lat:"Taxus baccata",rho:null},
  {tr:"KRİPTOMERYA",lat:"Cryptomeria japonica",rho:null},
  {tr:"DİĞER İBRELİ",lat:"Coniferae spp.",rho:null}
 ],
 "YAPRAKLI":[
  {tr:"MEŞE",lat:"Quercus spp.",rho:570},
  {tr:"GÜRGEN",lat:"Carpinus betulus",rho:630},
  {tr:"KAYIN",lat:"Fagus orientalis",rho:530},
  {tr:"DİŞBUDAK",lat:"Fraxinus excelsior",rho:562},
  {tr:"SIĞLA",lat:"Liquidambar orientalis",rho:468},
  {tr:"KAVAK",lat:"Populus spp.",rho:350},
  {tr:"KIZILAĞAÇ",lat:"Alnus glutinosa",rho:407},
  {tr:"ÇINAR",lat:"Platanus orientalis",rho:null},
  {tr:"DOĞU ÇINARI",lat:"Platanus orientalis",rho:600}, /* [Z09] Platanus .56–.62 (0011e: kullanıcı onayıyla listede) */
  {tr:"SÖĞÜT",lat:"Salix alba",rho:null},
  {tr:"SALKIM SÖĞÜT",lat:"Salix babylonica",rho:400},   /* [Z09] Salix cinsi ort. (0011e: kullanıcı onayıyla listede) */
  {tr:"AKÇAAĞAÇ",lat:"Acer spp.",rho:null},
  {tr:"IHLAMUR",lat:"Tilia spp.",rho:null},
  {tr:"AT KESTANESİ",lat:"Aesculus hippocastanum",rho:null},
  {tr:"KESTANE",lat:"Castanea sativa",rho:null},
  {tr:"HUŞ",lat:"Betula pendula",rho:null},
  {tr:"KARAAĞAÇ",lat:"Ulmus minor",rho:null},
  {tr:"DUT",lat:"Morus alba",rho:null},
  {tr:"CEVİZ",lat:"Juglans regia",rho:560},             /* [Z09]/[WD] (0011e: kullanıcı onayıyla listede) */
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
 ],
 "DİĞER":[
  {tr:"BELİRLENEMEDİ",lat:"—",rho:null},
  {tr:"DİĞER",lat:"—",rho:null}
 ]
};
/* Tabloda olmayanlar → GENEL satırları: İbreliler 0,446 · Yapraklılar 0,541 (Tolunay 2013; NIR Turkey 2017; 299 Nolu Tebliğ 2017) */
const GROUP_DEFAULT_RHO={"\u0130BREL\u0130":446,"YAPRAKLI":541,"D\u0130\u011eER":493};
/* Geriye dönük uyumluluk + hızlı erişim haritaları */
const species={}; const rho={}; const LATIN={};
Object.keys(SPECIES_DATA).forEach(g=>{
 species[g]=SPECIES_DATA[g].map(s=>s.tr);
 SPECIES_DATA[g].forEach(s=>{ if(s.rho) rho[s.tr]=s.rho; LATIN[s.tr]=s.lat; });
});
/* Tür rengi (analiz grafiklerinde DOLGU/çizgi rengi olarak kullanılır) */
const GROUP_COLOR={"\u0130BREL\u0130":"#1e6f4b","YAPRAKLI":"#c77d2e","D\u0130\u011eER":"#94a3b8"};
/* METİN tonları (0035 · WCAG): GROUP_COLOR dolgu içindir; küçük metinde
 * #c77d2e 3.03:1, #94a3b8 2.37:1 → AA FAIL. Metinde bu koyu tonlar kullanılır
 * (İBRELİ 5.66 · YAPRAKLI 5.78 · DİĞER 5.04, bg üzerinde). Kilit:
 * test/landing-claims.test.mjs. */
const GROUP_COLOR_INK={"\u0130BREL\u0130":"#1e6f4b","YAPRAKLI":"#9a4a08","D\u0130\u011eER":"#5b6b7f"};

/* ---- GİZLİ ÇÖZÜM KAYITLARI (0011e · 2026-09-28 · kullanıcı kararı) ----
 * Kullanıcı kararı: Göksu'nun 5 türü (SALKIM SÖĞÜT, MAVİ LADİN, DOĞU ÇINARI,
 * ATLAS SEDİRİ, CEVİZ) kaynaklı ρ'larıyla seçim listesinde KALIR;
 * "AĞLAYAN SÖĞÜT" ise listeye KONMAZ (yalnız eşanlamlı çözümlemede tanınır —
 * SALKIM SÖĞÜT'ün diğer adı). Gizli kayıtlar seçim kutusunda, panel
 * hesaplarında görünmez; yalnız resolveSpeciesName() ve rapor QA'sı bilir. */
const RESOLVE_ONLY_SPECIES=[
 {tr:"AĞLAYAN SÖĞÜT",lat:"Salix babylonica",rho:400}  /* [Z09] eşanlamlı; kullanıcı isteği: seçim listesinde GÖRÜNMEZ, yalnız çözümlemede tanınır */
];

/* ---- Eşanlamlı haritası (0011 envanter QA · 2026-09-28) ----
 * Saha kayıtları ve cihaz çıktıları kanonik ad dışında yazımlar üretebilir.
 * Eşanlamlılar yalnız OKUMA yolunda çözülür; veritabanına her zaman kanonik
 * ad yazılır. ANAHTARLAR normSp() biçimindedir (aksansız büyük harf);
 * DEĞERLER kanonik adın kendisidir ve normSp'den GEÇİRİLMEZ. */
const SPECIES_SYNONYMS={
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
 "AKASYA":"YALANCI AKASYA"
};
/* Türkçe-duyarlı normalleştirme: büyük harf (İ/ı doğru), aksan katlama,
 * parantez-içi ve fazla boşluk temizliği. Anahtarlar bu biçimde saklanır. */
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
Object.keys(SPECIES_DATA).forEach(g=>SPECIES_DATA[g].forEach(s=>{_SP_NORM[normSp(s.tr)]=s.tr;}));
RESOLVE_ONLY_SPECIES.forEach(s=>{_SP_NORM[normSp(s.tr)]=s.tr;});
Object.keys(SPECIES_SYNONYMS).forEach(k=>{
 const v=SPECIES_SYNONYMS[k];
 if(_SP_NORM[normSp(v)]===v)_SP_NORM[k]=v;  /* hedef kanonik olmalı, yoksa yok say */
});
/* Çözümleyici: kanonik adı ya da null döndürür (bilinmeyen tür). */
function resolveSpeciesName(name){
 const n=normSp(name);
 if(!n)return null;
 return _SP_NORM[n]||null;
}
