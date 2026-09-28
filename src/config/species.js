"use strict";
/* species.js — kanonik tür sözlüğü + odun yoğunluğu (ρ) tablosu.
 *
 * ρ kaynakları (kg/m³, temel odun yoğunluğu):
 *   [Z09] Zanne, Lopez-Gonzalez, Coomes, Ilic, Jansen, Lewis, Miller,
 *         Swenson, Wiemann, Chave (2009). Global wood density database.
 *         Dryad. https://doi.org/10.5061/dryad.234
 *   [WD]  The Wood Database (wood-database.com), "Specific Gravity (Basic)".
 *   [T13] Tolunay (2013) — Türkiye için grup ortalamaları (NIR Turkey 2017,
 *         299 Nolu Tebliğ ile uyumlu): İBRELİ 0,446 · YAPRAKLI 0,541 g/cm³.
 * Değeri kaynaklandırılamayan türler BİLEREK null bırakılır → hesap grup
 * varsayılanına düşer (GROUP_DEFAULT_RHO). Uydurma değer yazmak yasaktır;
 * tabloya yeni ρ eklerken satır sonuna kaynağını işleyin.
 */
const SPECIES_DATA={
 "İBRELİ":[
  {tr:"GÖKNAR",lat:"Abies spp.",rho:350},                                   /* [Z09] cins ort. */
  {tr:"SEDİR",lat:"Cedrus libani",rho:430},                                 /* [Z09] */
  {tr:"HİMALAYA SEDİRİ",lat:"Cedrus deodara",rho:430},                      /* [Z09] */
  {tr:"ATLAS SEDİRİ",lat:"Cedrus atlantica",rho:490},                       /* [WD] .44/.53 → ort. */
  {tr:"ARDIÇ",lat:"Juniperus spp.",rho:460},                                /* [Z09] cins ort. */
  {tr:"LADİN",lat:"Picea orientalis",rho:358},                              /* [Z09] */
  {tr:"MAVİ LADİN",lat:"Picea pungens",rho:450},                            /* [WD] */
  {tr:"GÜMÜŞ LADİN",lat:"Picea pungens",rho:450},                           /* [WD] — MAVİ LADİN ile aynı tür */
  {tr:"KIZILÇAM",lat:"Pinus brutia",rho:478},                               /* [Z09] */
  {tr:"KARAÇAM",lat:"Pinus nigra",rho:470},                                 /* [Z09] */
  {tr:"SARIÇAM",lat:"Pinus sylvestris",rho:426},                            /* [Z09] */
  {tr:"FISTIK ÇAMI",lat:"Pinus pinea",rho:470},                             /* [Z09] */
  {tr:"HALEP ÇAMI",lat:"Pinus halepensis",rho:480},                         /* [Z09] */
  {tr:"SERVİ",lat:"Cupressus sempervirens",rho:510},                        /* [WD] */
  {tr:"MAZI (YALANCI SERVİ)",lat:"Thuja orientalis",rho:450},               /* [Z09] Thuja cinsi ort. */
  {tr:"PORSUK",lat:"Taxus baccata",rho:640},                                /* [WD] */
  {tr:"KRİPTOMERYA",lat:"Cryptomeria japonica",rho:350},                    /* [WD] .33/.36 → üst bant */
  {tr:"DİĞER İBRELİ",lat:"Coniferae spp.",rho:null}
 ],
 "YAPRAKLI":[
  {tr:"MEŞE",lat:"Quercus spp.",rho:570},                                   /* [Z09] cins ort. */
  {tr:"GÜRGEN",lat:"Carpinus betulus",rho:630},                             /* [Z09] */
  {tr:"KAYIN",lat:"Fagus orientalis",rho:530},                              /* [Z09] */
  {tr:"DİŞBUDAK",lat:"Fraxinus excelsior",rho:562},                         /* [Z09] */
  {tr:"SIĞLA",lat:"Liquidambar orientalis",rho:468},                         /* [Z09] */
  {tr:"AMBERAĞACI",lat:"Liquidambar styraciflua",rho:520},                  /* [WD] sweetgum */
  {tr:"KAVAK",lat:"Populus spp.",rho:350},                                  /* [Z09] cins ort. */
  {tr:"KIZILAĞAÇ",lat:"Alnus glutinosa",rho:407},                           /* [Z09] */
  {tr:"ÇINAR",lat:"Platanus orientalis",rho:600},                           /* [Z09] Platanus cinsi .56–.62 */
  {tr:"DOĞU ÇINARI",lat:"Platanus orientalis",rho:600},                     /* [Z09] — ÇINAR ile aynı tür */
  {tr:"SÖĞÜT",lat:"Salix alba",rho:410},                                    /* [Z09] Salix cinsi .36–.49 */
  {tr:"SALKIM SÖĞÜT",lat:"Salix babylonica",rho:400},                       /* [Z09] Salix cinsi ort. */
  {tr:"AĞLAYAN SÖĞÜT",lat:"Salix babylonica",rho:400},                      /* [Z09] — SALKIM SÖĞÜT ile aynı tür */
  {tr:"AKÇAAĞAÇ",lat:"Acer spp.",rho:540},                                  /* [Z09] Acer cinsi ort. (yumuşak-sert karışık) */
  {tr:"IHLAMUR",lat:"Tilia spp.",rho:420},                                  /* [WD] basswood .41 */
  {tr:"AT KESTANESİ",lat:"Aesculus hippocastanum",rho:490},                 /* [WD] horse chestnut */
  {tr:"KESTANE",lat:"Castanea sativa",rho:500},                             /* [Z09] */
  {tr:"HUŞ",lat:"Betula pendula",rho:540},                                  /* [Z09] */
  {tr:"KARAAĞAÇ",lat:"Ulmus minor",rho:570},                                /* [Z09] Ulmus cinsi ort. */
  {tr:"DUT",lat:"Morus alba",rho:570},                                      /* [Z09] Morus cinsi ort. */
  {tr:"CEVİZ",lat:"Juglans regia",rho:560},                                 /* [Z09]/[WD] */
  {tr:"YALANCI AKASYA",lat:"Robinia pseudoacacia",rho:660},                 /* [WD] black locust */
  {tr:"MANOLYA",lat:"Magnolia grandiflora",rho:500},                        /* [Z09] Magnolia cinsi ort. */
  {tr:"SÜS ELMASI",lat:"Malus spp.",rho:650},                               /* [WD] apple */
  {tr:"SÜS ERİĞİ",lat:"Prunus cerasifera",rho:630},                         /* [Z09] Prunus cinsi ort. */
  {tr:"KATALPA",lat:"Catalpa bignonioides",rho:400},                        /* [WD] catalpa */
  {tr:"GLEDİÇYA",lat:"Gleditsia triacanthos",rho:600},                      /* [WD] honey locust */
  {tr:"JAPON SOFORASI",lat:"Styphnolobium japonicum",rho:null},
  {tr:"DEFNE",lat:"Laurus nobilis",rho:null},
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
/* Tür rengi (analiz grafiklerinde kullanılır) */
const GROUP_COLOR={"\u0130BREL\u0130":"#1e6f4b","YAPRAKLI":"#c77d2e","D\u0130\u011eER":"#94a3b8"};

/* ---- Eşanlamlı haritası (0011 envanter QA · 2026-09-28) ----
 * Saha kayıtları ve cihaz çıktıları kanonik ad dışında yazımlar üretebiliyor
 * (Göksu envanterinde "MAVİ LADİN" sözlükte yoktu, panel Latince adı boş
 * bırakıp ρ'yu grup varsayılanına düşürüyordu). Eşanlamlılar yalnız OKUMA
 * yolunda çözülür; veritabanına her zaman kanonik ad yazılır.
 * ANAHTARLAR normSp() biçimindedir (aksansız büyük harf); DEĞERLER kanonik
 * adın kendisidir (Türkçe karakterli) ve normSp'den GEÇİRİLMEZ. */
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
Object.keys(SPECIES_SYNONYMS).forEach(k=>{
 const v=SPECIES_SYNONYMS[k];
 if(_SP_NORM[normSp(v)]===v)_SP_NORM[k]=v;  /* hedef kanonik olmalı, yoksa sessizce yok say */
});
/* Çözümleyici: kanonik adı ya da null döndürür (bilinmeyen tür). */
function resolveSpeciesName(name){
 const n=normSp(name);
 if(!n)return null;
 return _SP_NORM[n]||null;
}
