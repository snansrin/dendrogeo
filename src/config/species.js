"use strict";
const SPECIES_DATA={
 "İBRELİ":[
  {tr:"GÖKNAR",lat:"Abies spp.",rho:350},
  {tr:"SEDİR",lat:"Cedrus libani",rho:430},
  {tr:"HİMALAYA SEDİRİ",lat:"Cedrus deodara",rho:430},
  {tr:"ARDIÇ",lat:"Juniperus spp.",rho:460},
  {tr:"LADİN",lat:"Picea orientalis",rho:358},
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
  {tr:"SÖĞÜT",lat:"Salix alba",rho:null},
  {tr:"AKÇAAĞAÇ",lat:"Acer spp.",rho:null},
  {tr:"IHLAMUR",lat:"Tilia spp.",rho:null},
  {tr:"AT KESTANESİ",lat:"Aesculus hippocastanum",rho:null},
  {tr:"KESTANE",lat:"Castanea sativa",rho:null},
  {tr:"HUŞ",lat:"Betula pendula",rho:null},
  {tr:"KARAAĞAÇ",lat:"Ulmus minor",rho:null},
  {tr:"DUT",lat:"Morus alba",rho:null},
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
const GROUP_DEFAULT_RHO={"İBRELİ":446,"YAPRAKLI":541,"DİĞER":493};
/* Geriye dönük uyumluluk + hızlı erişim haritaları */
const species={}; const rho={}; const LATIN={};
Object.keys(SPECIES_DATA).forEach(g=>{
 species[g]=SPECIES_DATA[g].map(s=>s.tr);
 SPECIES_DATA[g].forEach(s=>{ if(s.rho) rho[s.tr]=s.rho; LATIN[s.tr]=s.lat; });
});
/* Tür rengi (analiz grafiklerinde kullanılır) */
const GROUP_COLOR={"İBRELİ":"#1e6f4b","YAPRAKLI":"#c77d2e","DİĞER":"#94a3b8"};
