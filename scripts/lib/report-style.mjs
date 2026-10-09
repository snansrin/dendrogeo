/* Styles for the immutable academic report page. */
export function reportStyles(id) {
  return `
:root{--ink:#182420;--mut:#5f6d65;--line:#e6e3d9;--green:#1e6f4b;--leaf:#2f9e44;--gd:#14532d;--tint:#eaf3ec;--amber:#9a4a08;--bg:#f7f6f2;--broad:#e8590c}
*{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--ink);font:15px/1.7 Georgia,'Times New Roman',serif}
.sans{font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
.wrap{max-width:860px;margin:0 auto;padding:48px 28px 80px;background:#fff;border:1px solid var(--line);border-top:6px solid var(--green)}
.kick{font-family:ui-monospace,Consolas,monospace;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--amber)}
h1{font-size:1.9rem;line-height:1.2;color:var(--gd);margin:10px 0 6px;font-weight:600}
.sub{color:var(--mut);font-size:.95rem;font-style:italic}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:22px 0;padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--bg);font-family:system-ui,sans-serif;font-size:.78rem}
.meta>div{min-width:0}
.meta b{display:block;color:var(--mut);font-size:.66rem;letter-spacing:.12em;text-transform:uppercase}
.meta code{display:block;max-width:100%;font-family:ui-monospace,Consolas,monospace;font-size:.72rem;white-space:normal;overflow-wrap:anywhere;word-break:normal}
.meta .meta-wide{grid-column:1/-1}
.meta .hint{display:block;color:var(--mut);font-size:.64rem;margin-top:2px}
.st{display:inline-block;font-family:system-ui,sans-serif;font-size:.72rem;font-weight:700;padding:2px 10px;border-radius:999px;background:var(--tint);color:var(--green);border:1px solid var(--green)}
.st-ok{background:var(--tint);color:var(--green);border-color:var(--green)}
.st-warn{background:#fdf7ee;color:var(--amber);border-color:var(--amber)}
.st-bad{background:#fdeceb;color:#b42318;border-color:#b42318}
.stmt{background:var(--bg);border:1px solid var(--line);border-left:4px solid var(--amber);padding:10px 14px;border-radius:0 8px 8px 0;font-family:system-ui,sans-serif;font-size:.84rem;margin:14px 0}
h2{font-size:1.15rem;color:var(--gd);margin:30px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--line);font-weight:600;break-after:avoid}
h2 .no{font-family:ui-monospace,monospace;color:var(--amber);font-size:.8rem;margin-right:8px}
p{margin:8px 0;text-align:justify}
.tscroll{margin:12px 0}\ntable{width:100%;border-collapse:collapse;margin:0;font-family:system-ui,sans-serif;font-size:.8rem}
th{background:var(--tint);color:var(--gd);text-align:left;padding:8px 10px;font-size:.66rem;letter-spacing:.1em;text-transform:uppercase}
td{padding:8px 10px;border-bottom:1px solid var(--line);font-family:ui-monospace,Consolas,monospace;font-size:.76rem}
td.tr{font-family:Georgia,serif}
td.qok{color:var(--green);font-weight:700}
td.qwarn{color:var(--amber);font-weight:700}
td.qbad{color:#b42318;font-weight:700}
/* 0032 · ÇİZELGE 4 (QA) VE UZUN AÇIKLAMALI HÜCRELER — okunur tablo düzeni.
 * SORUN: §7 ayrıntı kolonu monospace .76rem idi ve mobilde
 * th,td{overflow-wrap:anywhere} uzun Türkçe cümleleri KELİME ORTASINDAN
 * kırıyordu; sabit genişlik olmadığı için kolonlar satır satır farklı
 * hizalanıyordu → tablo şekilsiz görünüyordu (diğer çizelgeler sayısal/kısa
 * olduğu için sorun yalnız burada görünürdü).
 * ÇÖZÜM: (i) table.qa sabit kolon düzeni + colgroup yüzdeleri, (ii) .qd
 * ayrıntı hücresi orantılı (sans) yazı ve YALNIZ kelime sınırında kırma,
 * (iii) .qst sonuç hücresi tek satır ve renkli, (iv) açıklayıcı kolonu olan
 * diğer çizelgeler (§4.6 veri sözlüğü, §10 tekrar üretilebilirlik) aynı .qd
 * hücresini kullanır. Sayısal içerik değişmez; yalnız sunum. */
caption{font-family:system-ui,sans-serif;font-size:.8rem;font-weight:600;text-align:left;padding:8px 0;color:var(--gd)}
table.qa{table-layout:fixed}
table.qa col.ck{width:23%}table.qa col.cs{width:16%}table.qa col.cd{width:61%}
table.qa th{vertical-align:bottom}
table.qa td{vertical-align:top}
table.qa td.tr{font-size:.8rem;font-weight:600;color:var(--gd);overflow-wrap:normal;word-break:normal}
td.qst{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:.74rem;font-weight:700;white-space:nowrap}
td.qinfo{color:#1c5d8f;font-weight:700}
td.qd{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:.79rem;line-height:1.6;text-align:left;overflow-wrap:break-word;word-break:normal;hyphens:none}
td.qd code{font-family:ui-monospace,Consolas,monospace;font-size:.72rem;word-break:break-all}
td.qd b{font-weight:700}
table.qa tbody tr:nth-child(even) td{background:#fcfbf8}
.ci{background:var(--tint);border-left:4px solid var(--green);padding:12px 16px;border-radius:0 10px 10px 0;margin:14px 0;font-family:system-ui,sans-serif;font-size:.86rem}
.verify{border:1px dashed var(--amber);background:#fdf7ee;border-radius:10px;padding:12px 16px;margin:14px 0;font-family:system-ui,sans-serif;font-size:.8rem}
.verify code{font-family:ui-monospace,monospace;font-size:.72rem;word-break:break-all}
.cite{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:14px 16px;font-size:.86rem;margin:10px 0}
pre{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;font-family:ui-monospace,Consolas,monospace;font-size:.7rem;overflow:auto;margin:8px 0}
.fig{border:1px solid var(--line);border-radius:10px;padding:10px;margin:12px 0;background:var(--bg);break-inside:avoid}
.fig .cap{font-family:system-ui,sans-serif;font-size:.74rem;color:var(--mut);margin-top:8px}
.brow{display:flex;align-items:center;gap:10px;margin:6px 0;font-family:system-ui,sans-serif;font-size:.78rem}
.brow .bl{width:130px;flex:0 0 auto}
.brow .bar{flex:1;height:12px;border-radius:6px;background:#e9ece8;box-shadow:inset 0 0 0 1px #d3d8d0;overflow:hidden}
.brow .bar i{display:block;height:100%;background:var(--leaf);border-radius:6px}
.brow .bv{width:56px;text-align:right;font-family:ui-monospace,monospace}
.sw{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:-1px}
.grp{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.qnote{font-family:system-ui,sans-serif;font-size:.78rem;color:var(--mut)}
.lim li{margin:6px 0 6px 18px}
.refs li{margin:8px 0 8px 18px;font-size:.86rem}
.foot{margin-top:36px;padding-top:14px;border-top:1px solid var(--line);font-family:system-ui,sans-serif;font-size:.74rem;color:var(--mut)}
.btnrow{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;font-family:system-ui,sans-serif}
.btn{background:var(--green);color:#fff;border:0;border-radius:8px;padding:9px 16px;font-size:.8rem;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block}
.btn.g{background:#fff;color:var(--green);border:1.5px solid var(--green)}
@media (max-width:640px){
 /* 0024 · MOBİL v2 (0021'in dersi): tabloyu display:block'a çevirmek
  * thead/tbody'yi AYRI kutulara bölüp kolonları kaydırıyordu; overflow-x:
  * hidden da başlıkları kırpıyordu. Doğru ve basit yöntem: tablo NORMAL
  * kalır, .tscroll kabı YATAY KAYAR; metinler overflow-wrap ile kendi
  * kutusunda kırılır → sayfa gövdesi asla genişlemez, hiçbir şey kaymaz. */
 .wrap{padding:26px 12px 56px;border-left:0;border-right:0}
 h1{font-size:1.42rem}
 h2{font-size:1.05rem}
 .meta{grid-template-columns:1fr;padding:12px;gap:8px}
 .tscroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:12px -4px;padding:0 4px}
 table{font-size:.74rem;min-width:520px}
 th,td{padding:6px 7px;overflow-wrap:anywhere;word-break:break-word}
 /* 0032 · Çizelge 4 mobilde de üç kolonlu ve düzenli: sabit kolon düzeni
  * korunur, .tscroll kabı yatay kayar (diğer çizelgelerle aynı davranış),
  * ayrıntı metni KELİME ORTASINDAN KIRILMAZ (overflow-wrap:anywhere
  * yalnız tablo dışı gövde metninde kalır). */
 table.qa{min-width:540px}
 table.qa td,table.qa th{overflow-wrap:break-word;word-break:normal}
 table.qa td.qd{font-size:.75rem;line-height:1.55}
 table.qa td.tr{font-size:.76rem}
 table.qa td.qst{white-space:normal;font-size:.72rem}
 p,li,.sub,.stmt,.qnote,.fig .cap{overflow-wrap:anywhere}
 pre{font-size:.62rem}
 .btnrow .btn{flex:1 1 100%}
 .kick{font-size:.64rem}
 .verify{font-size:.76rem}
}
@media print{
 /* 0027 · PDF/print dostu (kullanıcı isteği): 🖨 Yazdır / PDF düğmesi zaten
  * künyede; bu blok kağıt çıktısını garanti eder — 0024'ün kaydırma kapları
  * ekranda kolonları kaydırarak çözer ama KAĞITTA KIRPAR; print'te kapak
  * görünür olur, tablo tam genişlik basılır. */
 @page{size:A4;margin:14mm 14mm 18mm;@bottom-left{content:${JSON.stringify(id).replace(/</g,"\\3c ")};font:8pt sans-serif;color:#5f6d65}@bottom-right{content:counter(page) " / " counter(pages);font:8pt sans-serif;color:#5f6d65}}
 body{background:#fff}
 /* 0028 · kullanıcı "arka plan grafikleri" KAPALI bassa bile renkler gelsin:
  * rozetler, Şekil 1 çubukları, kart zeminleri otherwise kayboluyordu. */
 *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
 .wrap{border:0;padding:0;max-width:none}
 .btnrow,.verify button{display:none!important}
 .tscroll{overflow:visible!important;margin:8px 0;padding:0}
 .tscroll:has(table.summary){break-inside:avoid}
 pre,.verify{break-inside:avoid}
 p{orphans:3;widows:3}
 table{min-width:0!important;font-size:9.5pt}
 th,td{padding:4px 6px;white-space:normal}
 /* 0032 · Çizelge 4 kağıtta üç kolonlu kalır (kolon kaydırma yok);
  * sonuç rozeti gerekirse iki satıra iner, hücreler taşmaz. */
 table.qa{table-layout:fixed}
 table.qa td.qd{font-size:8.8pt;line-height:1.45}
 table.qa td.tr{font-size:9pt}
 table.qa td.qst{white-space:normal;font-size:8.4pt}
 table.qa tbody tr:nth-child(even) td{background:#fcfbf8}
 .fig{break-inside:avoid;page-break-inside:avoid}
 /* 0028 · harita TEK sayfaya sığsın: eskiden figür sayfalara bölünüp yarım
  * boş sayfa bırakıyordu (canlı PDF kanıtı). 182mm + başlık A4'e sığar. */
 .fig img{max-width:100%!important;max-height:182mm!important;width:auto!important;height:auto!important;display:block;margin:0 auto}
 h2,h3{break-after:avoid;page-break-after:avoid}
 tr{break-inside:avoid}
 .meta{background:#fff}
 a{color:inherit;text-decoration:none}
}
`;
}
