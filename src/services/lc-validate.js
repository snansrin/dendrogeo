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
 * SAHİPLİK: bu dosya eski DG_LC_VALIDATE adlarını ve sabit politika
 * değerlerini dışa açan ince uyumluluk facade'ıdır. Örnekleme, metrik,
 * spektral sınıflandırma, uzlaşma, serileştirme ve IndexedDB erişimi kendi
 * domain/application/adapter modüllerindedir.
 * YÜKLEME SIRASI: validation domain/application/adapter modülleri →
 * BU FACADE → lc-s2 → ui/lc-report → ui/lc-sens → landcover. */

const DG_VAL_VERSION="1.1.0";
const DG_VAL_CAMPAIGN_STORE=window.DG_VALIDATION_CAMPAIGN_STORE_ADAPTER?.create({getIndexedDB:()=>typeof indexedDB!=="undefined"?indexedDB:null})||null;
const DG_VAL_CAMPAIGN_ARCHIVE=DG_VAL_CAMPAIGN_STORE&&window.DG_VALIDATION_CAMPAIGN_ARCHIVE?.create({store:DG_VAL_CAMPAIGN_STORE})||null;

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
function dgValIbi(ndvi,mndwi,ndbi){return window.DG_VALIDATION_SPECTRAL_RULES.ibi(ndvi,mndwi,ndbi);}

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
function dgValRng(seed){return window.DG_VALIDATION_SAMPLING.rng(seed);}

/* ---------- A) TABAKALI RASTGELE ÖRNEKLEME ----------
 * Tabaka = haritalanmış sınıf (yeşil/su/sert/çıplak). Her tabakadan
 * perStratum adet hücre, tohumlu PRNG ile tekrarsız seçilir; nokta hücre
 * merkezi + hücre içi rastgele salınım (kenar etkisini azaltır).
 * Aynı (cells, opts) → aynı noktalar (tekrar üretilebilirlik). */
function dgValStratifiedSample(cells,opts){return window.DG_VALIDATION_SAMPLING.stratified(cells,opts,{defaults:DG_VAL_DEFAULTS,classes:DG_VAL_CLASSES});}

/* ---------- PARK GENELİ RASTGELE ÖRNEKLEME (omisyon taraması) ----------
 * Tabakalı örneklem, haritada hiç gösterilmeyen bir sınıfı ölçemez. Bu ikinci
 * çerçeve tüm uygun hücre havuzundan sınıftan bağımsız seçim yapar; tek başına
 * alan-düzeltilmiş doğruluk yerine geçmez, nadir/atlanmış sınıf adaylarını
 * bulup incelemeye taşır. */
function dgValSpatialSample(cells,opts){return window.DG_VALIDATION_SAMPLING.spatial(cells,opts,{defaults:DG_VAL_DEFAULTS});}

/* ---------- B) HATA MATRİSİ ---------- */
function dgValConfusion(samples){return window.DG_VALIDATION_ACCURACY_METRICS.confusion(samples,DG_VAL_CLASSES);}

/* ---------- Tabaka ağırlıkları: TAM SAYIM alan oranları ----------
 * Wᵢ = sınıf i'in raster kesişim alanı / toplam kapsama alanı.
 * Örneklem oranı DEĞİL, tam sayım (Olofsson: ağırlıklar haritadan gelir). */
function dgValWeights(groupAreasM2,assignedAreaM2){return window.DG_VALIDATION_ACCURACY_METRICS.weights(groupAreasM2,assignedAreaM2,DG_VAL_CLASSES);}

/* ---------- C) METRİKLER (Olofsson 2014) ---------- */
function dgValMetrics(conf,W,assignedAreaM2){return window.DG_VALIDATION_ACCURACY_METRICS.metrics(conf,W,assignedAreaM2,DG_VAL_CLASSES);}

/* ---------- HASSASİYET AYARLI EŞİKLER (0054 · kullanıcı isteği) ----------
 * Kullanıcı geri bildirimi: "sert zemin barını kaydırınca hassasiyet artsın,
 * harita üzerinde işaretlensin, gözümle görüp kabul edeyim."
 * Her sınıf için 0-100 kaydırıcı; 50 = literatür kalibrasyonu (Göksu +
 * park 5 canlı koşularıyla doğrulanmış taban eşikler — DEĞİŞMEZ, test
 * kilidi). Eşikler taban değerin etrafında DOĞRUSAL kayar:
 *   eşik(s) = taban + (s − 50) · eğim
 * Hassasiyet arttıkça eşik gevşer → DAHA ÇOK hücre o sınıfın adayı olur.
 * Aday = spektral tahmin ≠ raster sınıfı. Karar İNSANINDIR: adaylar
 * görüntü üzerinde onaya sunulur, onaylananlar corrections'a işlenir.
 * Bu fonksiyon hiçbir sayısal raster sonucunu değiştirmez. */
const DG_VAL_SENS_K={
  greenNdvi:-0.0030,   /* 0→0.50 · 50→0.35 · 100→0.20 */
  greenYear:-0.0030,   /* 0→0.65 · 50→0.50 · 100→0.35 */
  waterMndwi:-0.0030,  /* 0→0.35 · 50→0.20 · 100→0.05 */
  waterYear:-0.0030,   /* 0→0.60 · 50→0.45 · 100→0.30 */
  hardIbi:-0.0050,     /* 0→+0.25 · 50→0.00 · 100→−0.25 */
  hardNdvi:-0.0010,    /* karışım bandı alt sınırı: 50→0.20 */
  hardStrongIbi:-0.0030,/* asfalt dalı IBI eşiği: 50→0.10 */
  bareNdvi:+0.0015     /* 0→0.125 · 50→0.20 · 100→0.275 */
};

function dgValThr(sens){return window.DG_VALIDATION_SPECTRAL_RULES.thresholds(sens,{spectral:DG_VAL_SPECTRAL,sensitivity:DG_VAL_SENS_K});}

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
function dgValSpectralPredict(m,sens,opts={}){return window.DG_VALIDATION_SPECTRAL_RULES.predict(m,sens,opts,{spectral:DG_VAL_SPECTRAL,thresholds:dgValThr,ibi:dgValIbi});}

/* ---------- OTOMATİK UZLAŞMA (hücre bazında) ----------
 * Kenar hücreleri (areaM2 < eşik) ve belirsiz/veri-yok spektral tahminler
 * paydadan çıkar: karışık piksel uzlaşmayı kirletmesin. Uyuşmayan hücreler
 * GÖZDEN GEÇİRME için işaretlenir (kırmızı kontur) — insan etiketi esastır. */
function dgValAgreement(cells,spectralByCell,opts){return window.DG_BUILD_VALIDATION_AGREEMENT.agreement(cells,spectralByCell,opts,{defaults:DG_VAL_DEFAULTS,classes:DG_VAL_CLASSES,predict:dgValSpectralPredict});}

/* ---------- KAPI HÜKMÜ ----------
 * 🟢 DOĞRULANDI: OA ≥ 0.80 VE κ ≥ 0.60 VE su UA ≥ 0.90 VE spektral
 *    uzlaşma ≥ %70 VE n ≥ 30.
 * 🔴 KRİTİK: OA < 0.65 VEYA su UA < 0.75 (sistematik sınıf hatası).
 * 🟡 İNCELEME: aradaki her durum + yetersiz örneklem.
 * Hüküm YALNIZ doğrulama rozetini sürer; LULC sayısal sonucu ve yayın
 * hattı bu modülden bağımsızdır (kırmızı çizgi). */
function dgValGate(metrics,agreement,nLabeled){return window.DG_BUILD_VALIDATION_AGREEMENT.gate(metrics,agreement,nLabeled,DG_VAL_GATE);}

/* ---------- SERİLEŞTİRME ---------- */
function dgValCsv(campaign){return window.DG_SERIALIZE_VALIDATION_CAMPAIGN.csv(campaign,{version:DG_VAL_VERSION,classes:DG_VAL_CLASSES});}

function dgValCampaignJson(campaign){return window.DG_SERIALIZE_VALIDATION_CAMPAIGN.campaignJson(campaign,DG_VAL_VERSION);}

/* ---------- KALICILIK: legacy API delegates to the archive use-case ---------- */

function dgValSaveCampaign(campaign){if(!DG_VAL_CAMPAIGN_ARCHIVE)throw new Error("Doğrulama kalıcılık modülleri yüklenmedi.");return DG_VAL_CAMPAIGN_ARCHIVE.saveCampaign(campaign);}

function dgValLoadCampaigns(parkId){if(!DG_VAL_CAMPAIGN_ARCHIVE)throw new Error("Doğrulama kalıcılık modülleri yüklenmedi.");return DG_VAL_CAMPAIGN_ARCHIVE.loadCampaigns(parkId);}

function dgValDeleteCampaign(id){if(!DG_VAL_CAMPAIGN_ARCHIVE)throw new Error("Doğrulama kalıcılık modülleri yüklenmedi.");return DG_VAL_CAMPAIGN_ARCHIVE.deleteCampaign(id);}

/* ---------- HÜCRE KARARI (adjudication) — DOĞRULANMIŞ ALAN KATMANI ----------
 * Uyuşmazlık kuyruğunda İNSAN, hücre hücre karar verir: raster sınıfı mı
 * doğru, görüntüde görünen sınıf mı? Kararlar campaign.corrections'ta
 * {from,to,ts} olarak birikir. Bu fonksiyon raster grup alanlarını
 * DEĞİŞTİRMEZ (saf): karar verilen hücrelerin kesişim alanı eski sınıftan
 * düşülüp yeni sınıfa eklenir → "doğrulanmış alan" kısmi bir düzeltmedir
 * ve ancak karar verilen hücreleri kapsar (kalanlar raster değerinde kalır;
 * karne bunu dürüstçe beyan eder). Olofsson'un "harita + saha düzeltmesi"
 * ayrılığı: HAM raster kanıtı korunur, düzeltilmiş katman ayrıca raporlanır. */
function dgValApplyCorrections(groupAreas,cells,corrections){return window.DG_SERIALIZE_VALIDATION_CAMPAIGN.applyCorrections(groupAreas,cells,corrections);}

/* Karar verilen + bekleyen uyuşmazlık hücrelerinin GeoJSON'ı (denetim izi:
 * hangi hücre, hangi sınıftan hangi sınıfa, ne zaman, spektral kanıt neydi). */
function dgValCorrectedGeoJson(cells,corrections,spectralCells){return window.DG_SERIALIZE_VALIDATION_CAMPAIGN.correctedGeoJson(cells,corrections,spectralCells,{predict:dgValSpectralPredict,defaults:DG_VAL_DEFAULTS});}

/* ---------- DIŞ SÖZLEŞME (ui/lc-sens.js buradan kullanır) ---------- */
window.DG_LC_VALIDATE={
  version:DG_VAL_VERSION,
  classes:DG_VAL_CLASSES,
  labels:DG_VAL_LABELS,
  defaults:DG_VAL_DEFAULTS,
  spectral:DG_VAL_SPECTRAL,
  gate:DG_VAL_GATE,
  rng:dgValRng,
  ibi:dgValIbi,
  thresholds:dgValThr,
  stratifiedSample:dgValStratifiedSample,
  spatialSample:dgValSpatialSample,
  confusion:dgValConfusion,
  weights:dgValWeights,
  metrics:dgValMetrics,
  spectralPredict:dgValSpectralPredict,
  spectralLandPredict:(m,sens)=>dgValSpectralPredict(m,sens,{excludeWater:true}),
  agreement:dgValAgreement,
  applyCorrections:dgValApplyCorrections,
  correctedGeoJson:dgValCorrectedGeoJson,
  gateOf:dgValGate,
  csv:dgValCsv,
  json:dgValCampaignJson,
  saveCampaign:dgValSaveCampaign,
  loadCampaigns:dgValLoadCampaigns,
  deleteCampaign:dgValDeleteCampaign
};
