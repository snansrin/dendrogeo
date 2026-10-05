"use strict";
/*
 * DendroGeo kanonik odun yoğunluğu tablosu
 * Kilit: DG-WD-LOCK-2026-10-06-v1
 *
 * KURAL:
 * - Bu tablo kullanıcı tarafından 2026-10-06 tarihinde kanonik kaynak olarak onaylandı.
 * - Tür eklemek bu tablodaki hiçbir yoğunluğu değiştiremez.
 * - Tabloda olmayan türler kendi grubunun genel yoğunluğuna düşer:
 *   İbreliler 0,446 ton/m³; Yapraklılar 0,541 ton/m³.
 * - Birimler uygulama içinde kg/m³ tutulur (0,468 ton/m³ = 468 kg/m³).
 */
const WOOD_DENSITY_LOCK_ID="DG-WD-LOCK-2026-10-06-v1";
const WOOD_DENSITY_CANONICAL=[
 {key:"GROUP:İBRELİ",tr:"İbreliler (Genel)",taxon:null,rho_t_m3:0.446,rho:446,source:"Tolunay, 2013; NIR Turkey, 2017; 299 Nolu Tebliğ, 2017"},
 {key:"GÖKNAR",tr:"GÖKNAR",taxon:"Abies sp.",rho_t_m3:0.350,rho:350,source:"As ve ark., 2001"},
 {key:"HİMALAYA SEDİRİ",tr:"HİMALAYA SEDİRİ",taxon:"Cedrus deodora",rho_t_m3:0.430,rho:430,source:"Bozkurt ve Erdin (2000), Demetçi (1986)"},
 {key:"SEDİR",tr:"SEDİR",taxon:"Cedrus libani",rho_t_m3:0.430,rho:430,source:"As ve ark., 2001"},
 {key:"ARDIÇ",tr:"ARDIÇ",taxon:"Juniperus sp.",rho_t_m3:0.460,rho:460,source:"As ve ark., 2001"},
 {key:"LADİN",tr:"LADİN",taxon:"Picea orientalis",rho_t_m3:0.358,rho:358,source:"As ve ark., 2001"},
 {key:"KIZILÇAM",tr:"KIZILÇAM",taxon:"Pinus brutia",rho_t_m3:0.478,rho:478,source:"As ve ark., 2001"},
 {key:"HALEP ÇAMI",tr:"HALEP ÇAMI",taxon:"Pinus halepensis",rho_t_m3:0.480,rho:480,source:"Erten ve Sözen, 1997b"},
 {key:"KARAÇAM",tr:"KARAÇAM",taxon:"Pinus nigra",rho_t_m3:0.470,rho:470,source:"As ve ark., 2001"},
 {key:"FISTIK ÇAMI",tr:"FISTIK ÇAMI",taxon:"Pinus pinea",rho_t_m3:0.470,rho:470,source:"Erten ve Sözen, 1997a"},
 {key:"SARIÇAM",tr:"SARIÇAM",taxon:"Pinus sylvestris",rho_t_m3:0.426,rho:426,source:"As ve ark., 2001"},
 {key:"GROUP:YAPRAKLI",tr:"Yapraklılar (Genel)",taxon:null,rho_t_m3:0.541,rho:541,source:"Tolunay, 2013; NIR Turkey, 2017; 299 Nolu Tebliğ, 2017"},
 {key:"KIZILAĞAÇ",tr:"KIZILAĞAÇ",taxon:"Alnus sp.",rho_t_m3:0.407,rho:407,source:"As ve ark., 2001"},
 {key:"GÜRGEN",tr:"GÜRGEN",taxon:"Carpinus sp.",rho_t_m3:0.630,rho:630,source:"IPCC, 2003"},
 {key:"KAYIN",tr:"KAYIN",taxon:"Fagus orientalis",rho_t_m3:0.530,rho:530,source:"As ve ark., 2001"},
 {key:"DİŞBUDAK",tr:"DİŞBUDAK",taxon:"Fraxinus excelsior",rho_t_m3:0.562,rho:562,source:"Gürsu, 1971"},
 {key:"SIĞLA",tr:"SIĞLA",taxon:"Liquidambar orientalis",rho_t_m3:0.468,rho:468,source:"Tolunay (2013)"},
 {key:"KAVAK",tr:"KAVAK",taxon:"Populus sp.",rho_t_m3:0.350,rho:350,source:"IPCC, 2003"},
 {key:"MEŞE",tr:"MEŞE",taxon:"Quercus sp.",rho_t_m3:0.570,rho:570,source:"As ve ark., 2001"}
];
WOOD_DENSITY_CANONICAL.forEach(Object.freeze);
Object.freeze(WOOD_DENSITY_CANONICAL);
const _LOCKED_RHO={};
WOOD_DENSITY_CANONICAL.forEach(row=>{
 if(!row.key.startsWith("GROUP:"))_LOCKED_RHO[row.key]=row.rho;
});
Object.freeze(_LOCKED_RHO);

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
  {tr:"SIĞLA",lat:"Liquidambar orientalis",rho:_LOCKED_RHO["SIĞLA"]},
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
 ],
 "DİĞER":[
  {tr:"BELİRLENEMEDİ",lat:"—",rho:null},
  {tr:"DİĞER",lat:"—",rho:null}
 ]
};
/* Kilitli genel satırlar: İbreliler 0,446 · Yapraklılar 0,541.
 * DİĞER=493 yalnız eski/belirsiz kayıtların geriye dönük uyumluluk fallback'idir;
 * kanonik yoğunluk tablosunun parçası değildir ve bilinen tür/grupları ezemez. */
const GROUP_DEFAULT_RHO=Object.freeze({"İBRELİ":446,"YAPRAKLI":541,"DİĞER":493});

/* Geriye dönük uyumluluk + hızlı erişim haritaları */
const species={}; const rho={}; const LATIN={};
Object.keys(SPECIES_DATA).forEach(g=>{
 species[g]=SPECIES_DATA[g].map(s=>s.tr);
 SPECIES_DATA[g].forEach(s=>{ if(s.rho!=null) rho[s.tr]=s.rho; LATIN[s.tr]=s.lat; });
});
Object.freeze(rho);
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

/* Gizli eşanlamlı kayıt: seçim listesine girmez, yalnız çözümlemede tanınır.
 * Özel yoğunluk VERİLMEZ; tablodaki Yapraklılar (Genel) değerine düşer. */
const RESOLVE_ONLY_SPECIES=[
 {tr:"AĞLAYAN SÖĞÜT",lat:"Salix babylonica",rho:null}
];

/* Saha kayıtları ve cihaz çıktıları kanonik ad dışında yazımlar üretebilir.
 * Eşanlamlılar yalnız OKUMA yolunda çözülür; veritabanına kanonik ad yazılır. */
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
RESOLVE_ONLY_SPECIES.forEach(s=>{
 _SP_NORM[normSp(s.tr)]=s.tr;
 const ln=normSp(s.lat); if(ln&&!_SP_NORM[ln])_SP_NORM[ln]=s.tr;
});
Object.keys(SPECIES_SYNONYMS).forEach(k=>{
 const v=SPECIES_SYNONYMS[k];
 if(_SP_NORM[normSp(v)]===v)_SP_NORM[k]=v;
});
function resolveSpeciesName(name){
 const n=normSp(name);
 if(!n)return null;
 return _SP_NORM[n]||null;
}

/* Test/denetim katmanının kanonik tabloyu okuyabilmesi için salt-okunur dışa aktarım. */
window.DG_WOOD_DENSITY_LOCK=Object.freeze({
 id:WOOD_DENSITY_LOCK_ID,
 unit:"kg/m3",
 rows:WOOD_DENSITY_CANONICAL
});
