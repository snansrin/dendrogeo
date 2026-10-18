"use strict";

/* Preserve the full request reply content and its encoded subject. */
(function(root){
 function build(req,{count:n,totalCarbon:totalC,countries,cities}){
    const bugun = new Date().toLocaleDateString("tr-TR", { day:'numeric', month:'long', year:'numeric' });
    
    const bodyLines = [
        "Merhaba " + (req.profiles?.full_name || "Değerli Kullanıcımız") + ",",
        "",
        "DendroGeo'daki veri talebiniz başarıyla hazırlandı. 🌲",
        "",
        "📊 TALEP ÖZETİ",
        "─────────────────────────",
        "• Ülke      : " + (req.country || "Tümü"),
        "• Şehir     : " + (req.city    || "Tümü"),
        "• Proje/Park: " + (req.project_name || "Tümü"),
       (req.note ? "• Notunuz   : " + req.note : null),
        "",
        "📈 VERİ SETİ İÇERİĞİ",
        "─────────────────────────",
        "• Toplam kayıt     : " + n + " ağaç ölçümü",
        "• Toplam karbon    : " + (totalC/1000).toFixed(2) + " ton C",
        "• Kapsanan ülke    : " + countries.size,
        "• Kapsanan şehir   : " + cities.size,
        "• Hazırlanma tarihi: " + bugun,
        "",
        "📎 EKTE YER ALAN DOSYA",
        "─────────────────────────",
        "Veri seti CSV formatında hazırlanmıştır.",
        "",
        "CSV sütunları: POINT_ID, LATITUDE, LONGITUDE, TREE_GROUP, TREE_SPECIES, DBH_CM, HEIGHT_M, AGB_KG, BHB_KG, TOTAL_BIOMASS_KG, CARBON_KG, PHOTO_FILE ve daha fazlasını içerir.",
        "",
        "🗺 QGIS'DE NASIL AÇILIR?",
        "─────────────────────────",
        "1. QGIS → Layer → Add Layer → Add Delimited Text Layer",
        "2. X = LONGITUDE, Y = LATITUDE, CRS = EPSG:4326",
        "3. Fotoğraf balonu için katman özelliklerinde Map Tip özelliğini kullanabilirsiniz.",
        "   Detaylı rehber: https://dendrogeo.org/ → Dışa Aktar bölümü",
        "",
        "📜 VERİ LİSANSI",
        "─────────────────────────",
        "Bu veri CC BY-NC 4.0 lisansı altındadır. Ticari olmayan amaçlarla, kaynak gösterilerek serbestçe kullanılabilir.",
        "",
        "Atıf önerisi:",
"ŞİRİN, N. & ŞİRİN, S. (2026). DendroGeo: Küresel Ağaç Envanteri ve Karbon Veri Sistemi (Version 3.0.1) [Software]. Zenodo. https://doi.org/10.5281/zenodo.22948773",
"",
        "Herhangi bir sorunuz olursa bu e-postayı yanıtlayarak bize ulaşabilirsiniz.",
        "",
       "İyi çalışmalar dileriz,",
	"DendroGeo Ekibi",
	"Nagihan ŞİRİN — Doktora Öğrencisi · Sinan ŞİRİN — Sistem Geliştirici",
	"Küresel Ağaç Envanteri ve Karbon Veri Sistemi",
	"https://dendrogeo.org · DOI: 10.5281/zenodo.22948773",
    ];
    
    const bodyTxt = bodyLines.filter(l => l !== null).join("\n");
    const subject = encodeURIComponent("✅ DendroGeo Veri Talebiniz Hazırlandı — " + n + " kayıt, " + (totalC/1000).toFixed(2) + " t C");
    
  return{subject,body:bodyTxt};
 }
 root.DG_DATA_REQUEST_REPLY_CONTENT_UI=Object.freeze({build});
})(window);
