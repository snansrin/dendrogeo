"use strict";
/* ============================================================================
 * truncation.js — sorgu limiti aşıldığında kullanıcıyı UYAR
 * ============================================================================
 *
 * SORUN
 * -----
 * Uygulama, yayınlanan istatistikleri istemci tarafında ham satırlardan
 * hesaplıyor. Supabase her sorguya `.limit(N)` koyuyor:
 *
 *   world.js:5    park karşılaştırma        limit(5000)
 *   world.js:62   ülkeye yakınlaşma         limit(2000)
 *   world.js:67   şehre yakınlaşma          limit(2000)
 *   admin.js:193  talep formu ülke/şehir    limit(5000)
 *   gridplan.js:2924                        limit(5000)
 *   map.js/dash.js/index.html  dünya haritası işaretçileri  3000 / 2000
 *
 * Eşik aşıldığında sorgu İLK N satırı döndürür ve gerisini sessizce bırakır.
 * Toplam karbon, tür dağılımı ve bölgesel istatistikler bu KESİLMİŞ kümeden
 * hesaplandığı için yayınlanan sayı yanlış olur — ve bunu kullanıcıya söyleyen
 * hiçbir şey yoktur. DOI'li, atıf alan bir veri setinde en maliyetli hata
 * sınıfı budur: yanlış sayı, sayı yokluğundan kötüdür.
 *
 * ÇÖZÜM
 * -----
 * Bu modül geçici bir güvenlik ağıdır: kesme olduğunda toast ile uyarır ve
 * `window.DG_TRUNCATED` üzerinde iz bırakır (arayüz isterse rozet basabilir).
 * Kalıcı çözüm istatistikleri veritabanı tarafında toplamaktır — örn.
 *
 *   create view v_world_agg as
 *   select date_trunc('day', created_at) as gun, country, city, grp, species,
 *          count(*) as n, sum(carbon_kg) as carbon_kg,
 *          avg(dbh_cm) as ort_dbh, avg(height_m) as ort_boy
 *   from measurements where status = 'Onaylı'
 *   group by 1,2,3,4,5;
 *
 * Böyle bir view satır sayısı gün x ülke x tür mertebesinde kalır, yani limit
 * hiç devreye girmez. Harita işaretçileri için ayrıca görünen bbox + `.range()`
 * ile sayfalama gerekir.
 *
 * KULLANIM
 * --------
 *   // sorguyu toplam sayıyla birlikte çalıştır
 *   const { data, count } = await sb.from("measurements")
 *     .select("...", { count: "exact" })
 *     .eq("status", "Onaylı")
 *     .limit(5000);
 *   dgWarnIfTruncated(data, 5000, "Park karşılaştırma", count);
 *
 * `count` verilmezse yalnızca satır sayısına bakılır; verilirse kullanıcıya
 * gerçek toplam da gösterilir ("4.812 kaydın ilk 3.000'i").
 * ========================================================================== */

/* Aynı oturumda aynı bağlam için tekrar tekrar toast basmamak üzere. */
const DG_TRUNCATION_WARNED = new Set();

/**
 * Sorgu sonucunun limite takılıp takılmadığını döndürür.
 * @param {Array}  rows   dönen satırlar
 * @param {number} limit  sorgudaki .limit() değeri
 * @param {number} [total] count:'exact' ile gelen gerçek toplam (isteğe bağlı)
 * @returns {boolean}
 */
function dgIsTruncated(rows, limit, total) {
  const n = Array.isArray(rows) ? rows.length : 0;
  if (Number.isFinite(total)) return total > n;
  return n >= limit;
}

/**
 * Kesme varsa kullanıcıyı uyarır ve window.DG_TRUNCATED üzerinde iz bırakır.
 * @returns {boolean} kesme olduysa true
 */
function dgWarnIfTruncated(rows, limit, context, total) {
  if (!dgIsTruncated(rows, limit, total)) return false;

  const n = Array.isArray(rows) ? rows.length : 0;
  window.DG_TRUNCATED = (window.DG_TRUNCATED || 0) + 1;

  const anahtar = context + '|' + limit;
  if (DG_TRUNCATION_WARNED.has(anahtar)) return true;
  DG_TRUNCATION_WARNED.add(anahtar);

  const toplam = Number.isFinite(total) && total > n
    ? `${total.toLocaleString("tr-TR")} kaydın`
    : "kayıtların";
  const mesaj =
    `${context}: ${toplam} yalnızca ilk ${n.toLocaleString("tr-TR")} tanesi ` +
    `yükleniyor — gösterilen toplamlar eksik.`;

  if (typeof toast === "function") toast(mesaj, "warn", "⚠️");
  console.warn("[DendroGeo] Veri kesilmesi:", mesaj, { rows: n, limit, total });
  return true;
}

/**
 * Sorguya count:'exact' eklenip eklenmediğini denetleyen yardımcı.
 * `total` undefined gelirse kesme yine satır sayısından sezilir, yalnızca
 * mesaj daha az bilgilendirici olur.
 */
function dgTruncationBadge(el, rows, limit, total) {
  if (!el) return;
  if (!dgIsTruncated(rows, limit, total)) {
    el.textContent = "";
    el.style.display = "none";
    return;
  }
  // Toast ile aynı biçim: tr-TR binlik ayracı. İkisi farklı biçim kullanırsa
  // aynı bilgi ekranda iki türlü görünür.
  const n = Array.isArray(rows) ? rows.length : 0;
  el.textContent = `⚠️ ilk ${n.toLocaleString("tr-TR")} kayıt`;
  el.style.display = "";
}
