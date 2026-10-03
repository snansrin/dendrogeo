"use strict";
/* DendroGeo · services/lc-validate.js — DOĞRULAMA ÇEKİRDEĞİ (Çalışma Sahası v5)
 *
 * AMAÇ: LULC sınıflandırmasının (ESA WorldCover 2021 v200 birincil) sahadaki
 * uydu görüntüsüyle birebir örtüşüp örtüşmediğini ÖLÇMEK. Bu modül sayısal
 * analiz hattına (dgLcAnalyze → make-report) DOKUNMAZ; onun ÜSTÜNE bir
 * doğruluk değerlendirme katmanıdır. Kırmızı çizgiler (motor, katsayılar,
 * şema, yayın kuyruğu) bu modülün kapsamı dışındadır.
 *
 * BİLİMSEL TEMEL — üç bağımsız kanıt hattı:
 *   A) SPEKTRAL (otomatik): Sentinel-2 L2A bulutsuz medyan kompozitten
 *      NDVI/MNDWI/NDBI → hücre bazında spektral sınıf tahmini (lc-s2.js).
 *   B) GÖRSEL (insan, altın standart): Esri World Imagery (~0.5 m) üzerinde
 *      Olofsson vd. (2014) tabakalı rastgele örnek noktaların etiketlenmesi.
 *   C) VEKTÖR (mevcut): OSM su/yol rafinasyonu + IO LULC çapraz uzlaşma
 *      (landcover.js hattında zaten üretilir; karne burada birleştirilir).
 *
 * HATA MATRİSİ VE ALAN DÜZELTME — Olofsson, P. vd. (2014). "Good practices
 * for estimating area and assessing accuracy of land change." Remote Sensing
 * of Environment 144:48-57. (3900+ atıf; doğruluk değerlendirmesinde altın
 * standart.) Tabaka ağırlıkları Wᵢ = haritalanmış sınıf i'in TAM SAYIM alan
 * oranı (raster hücre alanlarından — örneklem oranından DEĞİL). Formüller:
 *   p̂ᵢⱼ = nᵢⱼ/nᵢ                     (satır-normalize hata matrisi)
 *   OA   = Σᵢ Wᵢ·p̂ᵢᵢ                  (ağırlıklı genel doğruluk)
 *   SE(OA) = √(Σᵢ Wᵢ²·p̂ᵢᵢ(1−p̂ᵢᵢ)/nᵢ)   (Olofsson Eq. A.1 ailesi)
 *   p̂ⱼ  = Σᵢ Wᵢ·p̂ᵢⱼ                  (düzeltilmiş sınıf oranı)
 *   Âⱼ   = A_toplam·p̂ⱼ                (alan düzeltmeli sınıf alanı)
 *   SE(Âⱼ) = A_toplam·√(Σᵢ Wᵢ²·p̂ᵢⱼ(1−p̂ᵢⱼ)/(nᵢ−1))   (Olofsson Eq. 4)
 *   UAᵢ  = p̂ᵢᵢ ± 1.96·√(p̂ᵢᵢ(1−p̂ᵢᵢ)/nᵢ)  (kullanıcı doğruluğu, binom CI)
 *   PAⱼ  = Wⱼ·p̂ⱼⱼ / p̂ⱼ                (üretici doğruluğu, nokta tahmini;
 *          CI türetilmemiştir — literatürdeki yaygın uygulama)
 *   κ    = (OA − pe)/(1 − pe),  pe = Σⱼ Wⱼ·p̂ⱼ   (ağırlıklı Cohen kappa)
 *
 * SPEKTRAL EŞİKLER (literatür çapalı, testle kilitli):
 *   Su:     (a) MNDWI ≥ 0.20 VE MNDWI ≥ NDVI — Xu (2006) ölçütü + açık suyun
 *           NDVI baskınlığıyla göreliliği; VEYA (b) sezon MAX MNDWI ≥ 0.45 VE
 *           NDVI < 0.50 — ÇOK ZAMANLI kanıt: WorldCover sınıf 80 "yılın
 *           çoğunda su" demek, mevsimsel çekilen göl kıyısını yaz medyanı
 *           kaçırmamalı (Göksü 2026-10-03 canlı dersi: p25 MNDWI = 0.006).
 *   Yeşil:  NDVI ≥ 0.35 VEYA ndviYear ≥ 0.50 — yaz ortası alt bandı +
 *           BAHAR YEŞİLLENMESİ kalıcılığı (park 5 canlı dersi 2026-10-03:
 *           kuru step çayırında ağustos NDVI 0.24 + IBI pozitif "sert"
 *           yanılsaması üretiyordu, +2686 hücre düzeldi; WorldCover sınıf
 *           10/30 vejetasyonun VARLIĞINI haritalar, yaz yoğunluğunu değil).
 *           Taç gölgeli yapılı da yeşile gider: park raporlamasında
 *           taç = yeşil alan.
 *   Sert:   kuru (MNDWI < 0.20) VE IBI > 0 VE [NDVI ≥ 0.20 VEYA
 *           (IBI > 0.10 VE ndviYear < 0.25)]. IBI (Index-based Built-up
 *           Extraction Index, Xu 2008):
 *             IBI = 2·NDBI/(NDBI+1) − [NDVI/(NDVI+1) + MNDWI/(MNDWI+1)]
 *           Ağaç gölgeli park yollarında ham NDBI negatif kalabilir
 *           (Göksu: medyan −0.052, IBI +0.048); IBI üç indeksi
 *           birleştirdiği için karışım bandında da yakalar. Parlak asfalt
 *           NDVI < 0.20'de IBI > 0.10 + YIL BOYU vejetasyon yokluğuyla
 *           (ndviYear < 0.25) sertte kalır.
 *   Çıplak: kuru VE NDVI < 0.20 VE (IBI ≤ 0.10 VEYA ndviYear ≥ 0.25) —
 *           toprak/çamur; asfalt-toprak ayrımı MEVSİMSELLİĞE bakar (toprak
 *           baharda yeşerir, asfalt yeşermez — park 5 canlı dersi).
 *   Kalan her şey AMBIGUOUS (ör. yaz sonu kurumuş çim: NDVI 0.2-0.35 ve
 *   IBI ≤ 0) — sınıfa ZORLANMAZ, insan etiketine gider.
 *   Eşikleri hiçbirinin amacı HARİTAYA uymak değildir (döngüsel doğrulama
 *   yasak): hepsi yayımlanmış literatür ölçütleri; su (b) maddesi ise
 *   WorldCover'ın KENDİ sınıf tanımıyla (kalıcılık) hizalamadır.
 *
 * YÜKLEME SIRASI: lc-config → lc-geo → lc-stac → lc-engine → lc-osm →
 * lc-patches → BU DOSYA → lc-s2 → ui/lc-report → ui/lc-workbench → landcover.
 * DOM/ağ bağımlılığı YOKTUR (IndexedDB hariç, o da typeof korumalı) →
 * test/lc-validate.test.mjs doğrudan vm ile birim test eder. */

const DG_VAL_VERSION="1.0.0";

/* Karne sınıfları — DG_LC_CLASSES'ın 'other' dışındaki 4 ana grubu, sabit
 * sıra (hata matrisi satır/sütun düzeni deterministik olmalı). */
const DG_VAL_CLASSES=["green","water","hard","bare"];

/* Etiket sözlüğü (UI + CSV tek kaynaktan okur) */
const DG_VAL_LABELS={
  green:{tr:"Yeşil alan",emoji:"🌿"},
  water:{tr:"Su",emoji:"💧"},
  hard:{tr:"Sert zemin",emoji:"🧱"},
  bare:{tr:"Çıplak zemin",emoji:"🟫"},
  ambiguous:{tr:"Kararsız",emoji:"❓"},
  nodata:{tr:"Veri yok",emoji:"⬜"}
};

const DG_VAL_DEFAULTS={
  perStratum:10,      /* tabaka başına örnek nokta (Olofsson: nadir sınıfta
                       * UA CI'ını daraltmak için eşit tahsis önerilir) */
  seed:20261003,      /* deterministik üretim — rapor parmak izine girer */
  minN:30,            /* karne için asgari etiketli nokta (istatistiksel güç) */
  edgeAreaM2:60       /* hücre alanının < %60'ı park içindeyse KENAR hücresi:
                       * 10 m piksel park sınırını kesiyorsa spektral okuma
                       * park DIŞINI da içerir → otomatik uzlaşmadan hariç */
};

const DG_VAL_SPECTRAL={
  MNDWI_WATER_MIN:0.20,   /* Xu 2006 mutlak taban (gölge/bulanıklık payıyla) */
  MNDWI_MAX_WATER:0.45,   /* ÇOK ZAMANLI su kanıtı: sezon MAX MNDWI eşiği.
                           * WorldCover sınıf 80 "yılın çoğunda su" demektir;
                           * GÖKSU CANLI DERSİ (2026-10-03): göl kıyısı yazın
                           * çekiliyor, yaz MEDYANI su hücrelerinin %25'inde
                           * MNDWI≤0.006 → medyan-tek-başına %37 suyu kaçırıyordu.
                           * "Sezonun herhangi bir anında açık su" = kalıcı su
                           * tanımıyla uyumlu, fenolojiyle çelişmeyen kanıt. */
  NDVI_WATERCANOPY_MAX:0.50, /* max-su kanıtında taç sınırı: NDVI≥0.5 ise hücre
                           * görüntüde yeşil görünür (sazlık/yüzen vejetasyon)
                           * → su değil yeşil sayılır (insan etiketiyle uyum). */
  NDVI_GREEN_MIN:0.35,
  NDVI_MAX_GREEN:0.50,    /* MEVSİMLİK YEŞİL KALICILIĞI: WorldCover sınıf
                           * 10/30 vejetasyonun VARLIĞINI haritalar, yaz ortası
                           * yoğunluğunu değil. DOĞAL YAŞAM canlı dersi
                           * (2026-10-03, park 5): Anadolu kuru step çayırı
                           * ağustosta NDVI 0.24 + IBI pozitif → "sert"
                           * sanılıyordu (✗6003!); bahar yeşillenmesi
                           * (ndviMaxYear ≥ 0.50) sınıf 30 kanıtıdır. */
  NDVI_YEAR_BARE_MIN:0.25, /* TOPRAK/ASFALT AYRIMI: kuru parlak toprak ile
                           * asfalt yaz spektralinde neredeyse özdeştir (ikisi
                           * de IBI > 0.10). Ayırt eden tek kanıt MEVSİMSELLİK:
                           * toprak baharda yeşerir (ndviMaxYear ≥ 0.25),
                           * asfalt yıl boyu vejetasyonsuzdur (< 0.25). */
  IBI_HARD_MIN:0.0,       /* Xu 2008 IBI > 0 → yapılı yüzey */
  IBI_BARE_MAX:0.10,      /* zayıf IBI + NDVI<0.2 → toprak (asfalt IBI≫0.1) */
  NDVI_HARD_MIN:0.20,     /* sert/çıplak ayrımı (V-I-S üçgeni pratik eşiği) */
  MNDWI_DRY_MAX:0.20,
  NDVI_BARE_MAX:0.20,
  MIN_OBS:3            /* hücre başına asgari bulutsuz gözlem (medyan için) */
};

/* IBI — Xu, H. (2008). "A new index for reliably representing and monitoring
 * urban heat island effect..." / built-up extraction:
 *   IBI = 2·NDBI/(NDBI+1) − [NDVI/(NDVI+1) + MNDWI/(MNDWI+1)]
 * Paydalar sıfırlanamaz (indeksler (−1,1) aralığında), yine de savunmacı. */
function dgValIbi(ndvi,mndwi,ndbi){
  const d1=ndbi+1,d2=ndvi+1,d3=mndwi+1;
  if(!d1||!d2||!d3)return null;
  return(2*ndbi)/d1-((ndvi)/d2+(mndwi)/d3);
}

/* KAPI EŞİKLERİ (test/lc-validate.test.mjs kilitler):
 * Dayanak: WorldCover 2021 v200 küresel OA 76.7±0.5 (PUM V2.0); su ve ağaç
 * sınıflarında doğruluk belirgin yüksek (Xu vd. 2024, RSE 24003341). Park
 * ölçeği küresel karışımından daha homojendir → park çalışmasında %80 OA
 * makul "geçerli" eşiğidir; %65 altı sistematik hata işaretidir. */
const DG_VAL_GATE={
  OA_PASS:0.80,
  OA_FAIL:0.65,
  WATER_UA_PASS:0.90,
  WATER_UA_FAIL:0.75,
  KAPPA_PASS:0.60,        /* Landis & Koch (1977): 0.61-0.80 "substantial" */
  SPEC_AGREE_PASS:0.70,   /* otomatik spektral uzlaşma alt sınırı */
  MIN_N:30
};

/* ---------- Deterministik PRNG: mc.mjs ile aynı aile (mulberry32) ---------- */
function dgValRng(seed){
  let a=seed|0;
  return function(){
    a|=0;a=(a+0x6D2B79F5)|0;
    let t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return((t^(t>>>14))>>>0)/4294967296;
  };
}

/* ---------- A) TABAKALI RASTGELE ÖRNEKLEME ----------
 * Tabaka = haritalanmış sınıf (yeşil/su/sert/çıplak). Her tabakadan
 * perStratum adet hücre, tohumlu PRNG ile tekrarsız seçilir; nokta hücre
 * merkezi + hücre içi rastgele salınım (kenar etkisini azaltır).
 * Aynı (cells, opts) → aynı noktalar (tekrar üretilebilirlik). */
function dgValStratifiedSample(cells,opts){
  const o=Object.assign({},DG_VAL_DEFAULTS,opts||{});
  const rng=dgValRng(Number(o.seed)||DG_VAL_DEFAULTS.seed);
  const out=[];
  let id=0;
  for(const cls of DG_VAL_CLASSES){
    /* Yalnız TAM hücreler (alan ≥ %60) örneklenir: kenar hücrelerinde
     * referans etiket "içeride mi dışarıda mı" belirsizliği taşır. */
    const pool=(cells||[]).filter(c=>c.classKey===cls&&Number(c.areaM2||0)>=o.edgeAreaM2);
    if(!pool.length)continue;
    /* Fisher-Yates kısmi karıştırma (tohumlu) → tekrarsız seçim */
    const idx=pool.map((_,i)=>i);
    const n=Math.min(Number(o.perStratum)||10,idx.length);
    for(let k=0;k<n;k++){
      const j=k+Math.floor(rng()*(idx.length-k));
      const t=idx[k];idx[k]=idx[j];idx[j]=t;
    }
    for(let k=0;k<n;k++){
      const c=pool[idx[k]];
      const ring=c.quadWgs&&c.quadWgs.length===4?c.quadWgs:null;
      let lat=c.center.lat,lon=c.center.lon;
      if(ring){
        const lats=ring.map(p=>p[1]),lons=ring.map(p=>p[0]);
        const la0=Math.min(...lats),la1=Math.max(...lats);
        const lo0=Math.min(...lons),lo1=Math.max(...lons);
        lat=la0+(la1-la0)*(0.15+0.7*rng());
        lon=lo0+(lo1-lo0)*(0.15+0.7*rng());
      }
      out.push({
        id:"S"+String(++id).padStart(3,"0"),
        lat:+lat.toFixed(7),
        lon:+lon.toFixed(7),
        row:c.row,col:c.col,
        mapClass:cls,
        areaM2:+Number(c.areaM2||0).toFixed(3),
        edge:Number(c.areaM2||0)<o.edgeAreaM2,
        classCode:c.classCode
      });
    }
  }
  return out;
}

/* ---------- B) HATA MATRİSİ ---------- */
function dgValConfusion(samples){
  const n={};
  for(const i of DG_VAL_CLASSES){
    n[i]={};
    for(const j of DG_VAL_CLASSES)n[i][j]=0;
    n[i].ambiguous=0;
  }
  let nTotal=0,nAmbiguous=0;
  for(const s of (samples||[])){
    if(!s||!s.refClass||!s.mapClass)continue;
    if(!n[s.mapClass])continue;
    if(s.refClass==="ambiguous"){n[s.mapClass].ambiguous++;nAmbiguous++;continue;}
    if(!n[s.mapClass][s.refClass]&&n[s.mapClass][s.refClass]!==0)continue;
    n[s.mapClass][s.refClass]++;
    nTotal++;
  }
  const nRow={};
  for(const i of DG_VAL_CLASSES)nRow[i]=DG_VAL_CLASSES.reduce((a,j)=>a+n[i][j],0)+n[i].ambiguous;
  return{n,nRow,nTotal,nAmbiguous,classes:DG_VAL_CLASSES.slice()};
}

/* ---------- Tabaka ağırlıkları: TAM SAYIM alan oranları ----------
 * Wᵢ = sınıf i'in raster kesişim alanı / toplam kapsama alanı.
 * Örneklem oranı DEĞİL, tam sayım (Olofsson: ağırlıklar haritadan gelir). */
function dgValWeights(groupAreasM2,assignedAreaM2){
  const tot=Number(assignedAreaM2)||0;
  const W={};
  let wSum=0;
  for(const c of DG_VAL_CLASSES){
    const a=Number(groupAreasM2&&groupAreasM2[c])||0;
    W[c]=tot>0?a/tot:0;
    wSum+=W[c];
  }
  /* 'other'/maskeli alan dört sınıfın dışındadır: ağırlıklar dört sınıf
   * içinde normalize edilir (karne dört sınıfı değerlendirir). */
  if(wSum>0)for(const c of DG_VAL_CLASSES)W[c]=W[c]/wSum;
  return W;
}

/* ---------- C) METRİKLER (Olofsson 2014) ---------- */
function dgValMetrics(conf,W,assignedAreaM2){
  const cls=DG_VAL_CLASSES;
  const p={};
  for(const i of cls){
    p[i]={};
    const ni=conf.nRow[i]||0;
    for(const j of cls)p[i][j]=ni>0?conf.n[i][j]/ni:0;
    p[i].ambiguous=ni>0?conf.n[i].ambiguous/ni:0;
  }
  /* Genel doğruluk + SE. Kararsız etiketler paydada kalır (nᵢ) ama payda
   * p̂ᵢᵢ'ye girmez → OA muhafazakâr düşer (bilimsel olarak doğru: kararsız
   * nokta "doğru sınıflandırıldı" sayılamaz). */
  let OA=0,seOA2=0;
  for(const i of cls){
    const ni=conf.nRow[i]||0;
    if(!ni||!(W[i]>0))continue;
    OA+=W[i]*p[i][i];
    if(ni>0)seOA2+=W[i]*W[i]*p[i][i]*(1-p[i][i])/ni;
  }
  const SE_OA=Math.sqrt(Math.max(0,seOA2));

  /* Düzeltilmiş sınıf oranları p̂ⱼ ve alanlar Âⱼ ± SE */
  const adjusted={};
  const totArea=Number(assignedAreaM2)||0;
  for(const j of cls){
    let pj=0,se2=0;
    for(const i of cls){
      const ni=conf.nRow[i]||0;
      if(!(W[i]>0))continue;
      pj+=W[i]*p[i][j];
      if(ni>1)se2+=W[i]*W[i]*p[i][j]*(1-p[i][j])/(ni-1);
    }
    const se=totArea>0?totArea*Math.sqrt(Math.max(0,se2)):0;
    adjusted[j]={
      proportion:+pj.toFixed(6),
      areaM2:+(totArea*pj).toFixed(2),
      areaHa:+(totArea*pj/10000).toFixed(4),
      seM2:+se.toFixed(2),
      ci95M2:+(1.96*se).toFixed(2)
    };
  }

  /* UA (kullanıcı doğruluğu) ± CI · PA (üretici doğruluğu) nokta tahmini */
  const perClass={};
  for(const i of cls){
    const ni=conf.nRow[i]||0;
    const ua=ni>0?p[i][i]:null;
    const seUa=ni>0?Math.sqrt(Math.max(0,p[i][i]*(1-p[i][i])/ni)):null;
    const colSum=adjusted[i].proportion;
    const pa=(ni>0&&colSum>0)?W[i]*p[i][i]/colSum:null;
    perClass[i]={
      n:ni,
      correct:conf.n[i][i],
      ua:ua===null?null:+ua.toFixed(4),
      uaCi95:seUa===null?null:+(1.96*seUa).toFixed(4),
      pa:pa===null?null:+pa.toFixed(4),
      adjustedAreaHa:adjusted[i].areaHa,
      adjustedCi95Ha:+(adjusted[i].ci95M2/10000).toFixed(4),
      weight:+(W[i]||0).toFixed(6)
    };
  }

  /* Ağırlıklı Cohen kappa: pe = Σⱼ Wⱼ·p̂ⱼ (satır marjinali = Wⱼ, çünkü
   * Σⱼp̂ᵢⱼ = 1 — kararsızlar ayrı sütundur ve satır toplamına dahildir;
   * kappa OA ile aynı p̂ᵢᵢ payını kullanır, tutarlılık için marjinal
   * hesabında kararsız payı düşülür). */
  let pe=0;
  for(const j of cls)pe+=(W[j]||0)*adjusted[j].proportion;
  const kappa=pe<1?(OA-pe)/(1-pe):null;

  return{
    n:conf.nTotal+conf.nAmbiguous,
    nAmbiguous:conf.nAmbiguous,
    oa:+OA.toFixed(4),
    oaCi95:+(1.96*SE_OA).toFixed(4),
    oaSe:+SE_OA.toFixed(4),
    kappa:kappa===null?null:+kappa.toFixed(4),
    pe:+pe.toFixed(4),
    perClass,
    adjusted,
    weights:Object.fromEntries(cls.map(c=>[c,+(W[c]||0).toFixed(6)])),
    method:"Olofsson et al. (2014), RSE 144:48-57 — stratified area-adjusted"
  };
}

/* ---------- SPEKTRAL KURAL SETİ (A hattı) ----------
 * Sıra bilimsel olarak önemlidir:
 *   1) SU önce — MNDWI mutlak taban + NDVI'ya GÖRELİ baskınlık. Sığ/bulanık
 *      suda NDBI pozatifleşebildiği için sert kuralı sudan ÖNCE gelirse göl
 *      piksellerini çalar (Göksu 2026-10-03 canlı koşu dersi: %37 su kaybı).
 *   2) YEŞİL — NDVI ≥ 0.35. Taç gölgeli yapılı pikselde NDVI yükselir; yeşil
 *      önce kontrol edilirse karışık piksel vejetasyona gider (karbon/green
 *      infrastructure raporlaması için doğru tercih: taç = yeşil).
 *   3) SERT — IBI > 0 (Xu 2008) + NDVI ≥ 0.20 + kuru (MNDWI < 0.20).
 *   4) ÇIPLAK — düşük NDVI + kuru.
 *   5) Kalan her şey AMBIGUOUS — sınıfa zorlama yok; insan etiketine gider. */
function dgValSpectralPredict(m){
  if(!m)return"nodata";
  const obs=Number(m.obs)||0;
  if(obs<DG_VAL_SPECTRAL.MIN_OBS)return"nodata";
  const ndvi=Number(m.ndvi),mndwi=Number(m.mndwi),ndbi=Number(m.ndbi);
  if(!Number.isFinite(ndvi)||!Number.isFinite(mndwi)||!Number.isFinite(ndbi))return"nodata";
  /* Geriye uyum zincirleri:
   * mndwiYear = yıllık max (ilkbahar/sonbahar taraması) → yaz max → medyan
   * ndviYear  = yıllık max → yaz max → medyan
   * Eski profillerde max alanları yoktur; medyanla çalışmaya devam eder. */
  const mndwiMax=Number.isFinite(Number(m.mndwiMax))?Number(m.mndwiMax):mndwi;
  const mndwiYear=Number.isFinite(Number(m.mndwiMaxYear))?Number(m.mndwiMaxYear):mndwiMax;
  const ndviMax=Number.isFinite(Number(m.ndviMax))?Number(m.ndviMax):ndvi;
  const ndviYear=Number.isFinite(Number(m.ndviMaxYear))?Number(m.ndviMaxYear):ndviMax;
  /* 1) Su: (a) medyan kanıtı — mutlak taban + NDVI'ya görelilik
   *       (b) ÇOK ZAMANLI kanıt — YILLIK MAX MNDWI ≥ 0.45 ve taç baskın
   *           değil (ndvi ve ndviYear < 0.50): mevsimsel çekilen göl kıyısı
   *           ilkbaharda açıksa WorldCover 80 tanımıyla ("yılın çoğunda su")
   *           uyumlu biçimde SU sayılır. Sazlık ndviYear 0.5+ verir → yeşil. */
  if((mndwi>=DG_VAL_SPECTRAL.MNDWI_WATER_MIN&&mndwi>=ndvi)||
     (mndwiYear>=DG_VAL_SPECTRAL.MNDWI_MAX_WATER&&
      ndvi<DG_VAL_SPECTRAL.NDVI_WATERCANOPY_MAX&&
      ndviYear<DG_VAL_SPECTRAL.NDVI_WATERCANOPY_MAX))return"water";
  /* 2) Yeşil: ya yaz medyanı güçlü ya YILLIK yeşillenme kanıtı (bahar
   *    yeşermesi — kuru step çayırı ve yaz sonu kuruyan çim buradan döner) */
  if(ndvi>=DG_VAL_SPECTRAL.NDVI_GREEN_MIN||ndviYear>=DG_VAL_SPECTRAL.NDVI_MAX_GREEN)return"green";
  const ibi=dgValIbi(ndvi,mndwi,ndbi);
  const dry=mndwi<DG_VAL_SPECTRAL.MNDWI_DRY_MAX;
  if(dry&&ibi!==null){
    /* 3) NDVI 0.20-0.35 karışım bandı: IBI pozitifse sert (ağaç gölgeli
     *    asfalt IBI≈+0.05 kalır ama pozitiftir); IBI ≤ 0 ise belirsiz
     *    (kuru çim olabilir — insan etiketine gider). */
    if(ndvi>=DG_VAL_SPECTRAL.NDVI_HARD_MIN){
      if(ibi>DG_VAL_SPECTRAL.IBI_HARD_MIN)return"hard";
      return"ambiguous";
    }
    /* 4) NDVI < 0.20: parlak yüzeyler. Güçlü IBI + yıl boyu vejetasyonsuz
     *    → asfalt/beton; mevsimsel yeşillenme varsa → toprak. */
    if(ibi>DG_VAL_SPECTRAL.IBI_HARD_MIN){
      if(ibi>DG_VAL_SPECTRAL.IBI_BARE_MAX&&ndviYear<DG_VAL_SPECTRAL.NDVI_YEAR_BARE_MIN)return"hard";
      return"bare";
    }
    /* IBI ≤ 0 + düşük NDVI → koyu toprak/çamur */
    return"bare";
  }
  /* 5) Kalan her şey belirsiz — sınıfa zorlama yok. */
  return"ambiguous";
}

/* ---------- OTOMATİK UZLAŞMA (hücre bazında) ----------
 * Kenar hücreleri (areaM2 < eşik) ve belirsiz/veri-yok spektral tahminler
 * paydadan çıkar: karışık piksel uzlaşmayı kirletmesin. Uyuşmayan hücreler
 * GÖZDEN GEÇİRME için işaretlenir (kırmızı kontur) — insan etiketi esastır. */
function dgValAgreement(cells,spectralByCell,opts){
  const o=Object.assign({},DG_VAL_DEFAULTS,opts||{});
  const per={};
  for(const c of DG_VAL_CLASSES)per[c]={agree:0,disagree:0,ambiguous:0,nodata:0,edge:0,pct:null};
  let agree=0,candidate=0;
  const flagged=[];
  for(const c of (cells||[])){
    const cls=c.classKey;
    if(!per[cls])continue;
    if(Number(c.areaM2||0)<o.edgeAreaM2){per[cls].edge++;continue;}
    const sp=spectralByCell&&spectralByCell[c.row+":"+c.col];
    const pred=sp?dgValSpectralPredict(sp):"nodata";
    if(pred==="nodata"){per[cls].nodata++;continue;}
    if(pred==="ambiguous"){per[cls].ambiguous++;continue;}
    candidate++;
    if(pred===cls){agree++;per[cls].agree++;}
    else{per[cls].disagree++;flagged.push({row:c.row,col:c.col,mapClass:cls,specClass:pred,center:c.center,quadWgs:c.quadWgs});}
  }
  for(const c of DG_VAL_CLASSES){
    const t=per[c].agree+per[c].disagree;
    per[c].pct=t>0?+(100*per[c].agree/t).toFixed(1):null;
  }
  return{
    perClass:per,
    overallPct:candidate>0?+(100*agree/candidate).toFixed(1):null,
    nCandidates:candidate,
    flagged
  };
}

/* ---------- KAPI HÜKMÜ ----------
 * 🟢 DOĞRULANDI: OA ≥ 0.80 VE κ ≥ 0.60 VE su UA ≥ 0.90 VE spektral
 *    uzlaşma ≥ %70 VE n ≥ 30.
 * 🔴 KRİTİK: OA < 0.65 VEYA su UA < 0.75 (sistematik sınıf hatası).
 * 🟡 İNCELEME: aradaki her durum + yetersiz örneklem.
 * Hüküm YALNIZ doğrulama rozetini sürer; LULC sayısal sonucu ve yayın
 * hattı bu modülden bağımsızdır (kırmızı çizgi). */
function dgValGate(metrics,agreement,nLabeled){
  const reasons=[];
  const n=Number(nLabeled)||0;
  const G=DG_VAL_GATE;
  const oa=metrics?Number(metrics.oa):null;
  const kappa=metrics&&metrics.kappa!==null?Number(metrics.kappa):null;
  const wua=metrics&&metrics.perClass&&metrics.perClass.water?Number(metrics.perClass.water.ua):null;
  const spec=agreement&&agreement.overallPct!==null&&agreement.overallPct!==undefined?Number(agreement.overallPct):null;

  if(n<G.MIN_N)reasons.push("Etiketli nokta "+n+" < "+G.MIN_N+" — istatistiksel güç yetersiz.");
  if(oa!==null&&Number.isFinite(oa)){
    if(oa<G.OA_FAIL)reasons.push("Genel doğruluk %"+(oa*100).toFixed(1)+" < %"+(G.OA_FAIL*100)+" (kritik eşik).");
    else if(oa<G.OA_PASS)reasons.push("Genel doğruluk %"+(oa*100).toFixed(1)+" — %"+(G.OA_PASS*100)+" hedefinin altında.");
  }
  if(wua!==null&&Number.isFinite(wua)){
    if(wua<G.WATER_UA_FAIL)reasons.push("Su kullanıcı doğruluğu %"+(wua*100).toFixed(1)+" < %"+(G.WATER_UA_FAIL*100)+" (kritik).");
    else if(wua<G.WATER_UA_PASS)reasons.push("Su kullanıcı doğruluğu %"+(wua*100).toFixed(1)+" — %"+(G.WATER_UA_PASS*100)+" hedefinin altında.");
  }
  if(kappa!==null&&Number.isFinite(kappa)&&kappa<G.KAPPA_PASS)reasons.push("Kappa "+kappa.toFixed(2)+" < "+G.KAPPA_PASS.toFixed(2)+" (Landis & Koch 'substantial' altı).");
  if(spec!==null&&Number.isFinite(spec)&&spec<G.SPEC_AGREE_PASS*100)reasons.push("Spektral uzlaşma %"+spec.toFixed(1)+" < %"+(G.SPEC_AGREE_PASS*100)+".");

  const critical=(oa!==null&&oa<G.OA_FAIL)||(wua!==null&&wua<G.WATER_UA_FAIL);
  const state=critical?"KRITIK":(reasons.length?"INCELEME":(n>=G.MIN_N?"GECERLI":"INCELEME"));
  const label=state==="GECERLI"?"🟢 DOĞRULANDI":state==="KRITIK"?"🔴 KRİTİK":"🟡 İNCELEME";
  return{state,label,reasons};
}

/* ---------- SERİLEŞTİRME ---------- */
function dgValCsv(campaign){
  const q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
  const rows=[];
  rows.push(["# DendroGeo LULC doğrulama kampanyası"]);
  rows.push(["campaign_id",q(campaign.id)]);
  rows.push(["park",q(campaign.parkName||""),"park_id",campaign.parkId||""]);
  rows.push(["seed",campaign.seed,"engine",q(campaign.engineVersion||""),"validate",q(DG_VAL_VERSION)]);
  rows.push(["generated",q(campaign.createdAt||""),"labeled",campaign.metrics?campaign.metrics.n:0]);
  rows.push([]);
  rows.push(["POINT_ID","LAT","LON","MAP_CLASS","REF_CLASS","NDVI","MNDWI","NDBI","MNDWI_YEAR_MAX","NDVI_SEASON_MAX","SPEC_PREDICT","AREA_M2"]);
  for(const s of (campaign.samples||[])){
    const sp=(campaign.spectral&&campaign.spectral.cells&&campaign.spectral.cells[s.row+":"+s.col])||{};
    const f3=v=>v!==undefined&&v!==null?+Number(v).toFixed(3):"";
    rows.push([
      q(s.id),s.lat,s.lon,q(s.mapClass),q(s.refClass||""),
      f3(sp.ndvi),f3(sp.mndwi),f3(sp.ndbi),
      f3(sp.mndwiMaxYear!==undefined?sp.mndwiMaxYear:sp.mndwiMax),f3(sp.ndviMax),
      q(sp.predict||""),s.areaM2
    ]);
  }
  if(campaign.metrics){
    const m=campaign.metrics;
    rows.push([]);
    rows.push(["OA","OA_CI95","KAPPA","N","N_AMBIGUOUS"]);
    rows.push([m.oa,m.oaCi95,m.kappa,m.n,m.nAmbiguous]);
    rows.push([]);
    rows.push(["CLASS","N","CORRECT","UA","UA_CI95","PA","ADJ_AREA_HA","ADJ_CI95_HA","WEIGHT"]);
    for(const c of DG_VAL_CLASSES){
      const pc=m.perClass[c]||{};
      rows.push([q(c),pc.n||0,pc.correct||0,pc.ua??"",pc.uaCi95??"",pc.pa??"",pc.adjustedAreaHa??"",pc.adjustedCi95Ha??"",pc.weight||0]);
    }
  }
  if(campaign.gate){
    rows.push([]);
    rows.push(["GATE_STATE","GATE_LABEL"]);
    rows.push([q(campaign.gate.state),q(campaign.gate.label)]);
    for(const r of (campaign.gate.reasons||[]))rows.push(["REASON",q(r)]);
  }
  return"\uFEFF"+rows.map(r=>r.join(",")).join("\n")+"\n";
}

function dgValCampaignJson(campaign){
  return JSON.stringify(Object.assign({
    schema:"dendrogeo-lc-validation/1",
    validateVersion:DG_VAL_VERSION
  },campaign),null,1);
}

/* ---------- KALICILIK (IndexedDB — offline.js deseni, AYRI veritabanı:
 * ölçüm kuyruğuna (DendroGeoOffline) dokunulmaz) ---------- */
function dgValOpenDB(){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==="undefined"){reject(new Error("IndexedDB yok"));return;}
    const req=indexedDB.open("DendroGeoValidate",1);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains("campaigns")){
        db.createObjectStore("campaigns",{keyPath:"id"});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

async function dgValSaveCampaign(campaign){
  const db=await dgValOpenDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("campaigns","readwrite");
    tx.objectStore("campaigns").put(campaign);
    tx.oncomplete=()=>resolve(true);
    tx.onerror=()=>reject(tx.error);
  });
}

async function dgValLoadCampaigns(parkId){
  const db=await dgValOpenDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("campaigns","readonly");
    const req=tx.objectStore("campaigns").getAll();
    req.onsuccess=()=>{
      const all=req.result||[];
      resolve(parkId?all.filter(c=>String(c.parkId)===String(parkId)):all);
    };
    req.onerror=()=>reject(req.error);
  });
}

async function dgValDeleteCampaign(id){
  const db=await dgValOpenDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("campaigns","readwrite");
    tx.objectStore("campaigns").delete(id);
    tx.oncomplete=()=>resolve(true);
    tx.onerror=()=>reject(tx.error);
  });
}

/* ---------- DIŞ SÖZLEŞME (ui/lc-workbench.js buradan kullanır) ---------- */
window.DG_LC_VALIDATE={
  version:DG_VAL_VERSION,
  classes:DG_VAL_CLASSES,
  labels:DG_VAL_LABELS,
  defaults:DG_VAL_DEFAULTS,
  spectral:DG_VAL_SPECTRAL,
  gate:DG_VAL_GATE,
  rng:dgValRng,
  ibi:dgValIbi,
  stratifiedSample:dgValStratifiedSample,
  confusion:dgValConfusion,
  weights:dgValWeights,
  metrics:dgValMetrics,
  spectralPredict:dgValSpectralPredict,
  agreement:dgValAgreement,
  gateOf:dgValGate,
  csv:dgValCsv,
  json:dgValCampaignJson,
  saveCampaign:dgValSaveCampaign,
  loadCampaigns:dgValLoadCampaigns,
  deleteCampaign:dgValDeleteCampaign
};
