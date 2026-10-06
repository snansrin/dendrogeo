"use strict";
/*
 * DendroGeo · DEĞİŞTİRİLEMEZ KANONİK ODUN YOĞUNLUĞU KİLİDİ
 * Karar: 2026-10-06
 *
 * Bu dosya ölçüm/karbon hesabındaki TEK ρ kaynağıdır.
 * - Mevcut satırlar, sıra, kaynaklar ve yoğunluklar değiştirilemez.
 * - Yeni tür bu dosyaya EKLENMEZ.
 * - Yeni tür yalnız species.js içinde İBRELİ veya YAPRAKLI grubuna rho:null
 *   olarak eklenebilir; hesap sırasıyla 446 veya 541 kg/m³ genel değere düşer.
 * - DİĞER/UNKNOWN için karbon yoğunluğu YOKTUR.
 *
 * CI parmak izi:
 * 1312379570ccf39d4ca6a3dbd7eb3fef0ba894dd12d34cfe87ee39cb0ab480cc
 */
const WOOD_DENSITY_LOCK_ID="DG-WD-LOCK-2026-10-06-FINAL";
const WOOD_DENSITY_LOCK_FINGERPRINT="1312379570ccf39d4ca6a3dbd7eb3fef0ba894dd12d34cfe87ee39cb0ab480cc";
const MEASUREMENT_GROUPS=Object.freeze(["İBRELİ","YAPRAKLI"]);
const GROUP_DEFAULT_RHO=Object.freeze({"İBRELİ":446,"YAPRAKLI":541});
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
