# SEO ve anonim ziyaretçi özeti — 19 Ekim 2026

| Bildirilen durum | İnceleme ve uygulanan düzenleme |
|---|---|
| HTTP ve www adresleri | Üç adresin tek HTTPS/non-www canonical adrese 301 yönlendirmesi beklenen davranıştır. Bu adreslerin ayrıca dizine eklenmesi amaçlanmaz. |
| DGR-2026-0019 | Test yayını arşivi; noindex korunur ve sitemap'e eklenmez. |
| DGR-2026-0021 | Geri çekilmiş rapor bildirimi; noindex korunur ve sitemap'e eklenmez. |
| Bilgi/yöntem sayfaları | 15 sitemap belgesinde 200 yanıtı, tek H1, kendi canonical URL'si ve indekslenebilirlik denetlenir. Belgelere WebPage/BreadcrumbList ilişkisi, ana sayfaya WebSite/Organization kimliği eklendi. |
| Türkçe/İngilizce ilişkisi | Ana sayfa ve yöntem çifti sitemap'te karşılıklı hreflang ile belirtilir. |
| sitemap.xml | XML keşif dosyasıdır; bir içerik sayfası gibi dizine alınması gerekmez. |
| Ayrı arama sonuçları ve alt bağlantılar | Bilgi sayfalarının ayrı sonuç çıkması hata değildir. Sitelinks otomatik seçilir; yapılandırılmış veri veya başka bir ayar Facebook benzeri görünümü garanti etmez. |

`node scripts/seo-audit.mjs --live` canonical sayfaları ve üç yönlendirme varyantını yeniden kontrol eder. `npm run build:check`, ortak site kimliğini ve sayaç kayıtlarını da denetler. Yayınlanmış rapor dosyaları yeniden yazılmaz.

Ana sayfayı doğrudan CSV/GeoJSON dosyası gibi gösteren iki DataDownload contentUrl kaldırıldı; veri lisansı ve kaynak atıfları korundu. Yeni sayaç yapılandırması mevcut uygulama paketinde taşınır; ilk açılışın script indirme sayısı artmaz. Eski DBH/form testlerinin migration izin listesine yalnız incelenen anonim sayaç migration'ı eklendi; ölçüm/proje/park tablolarını değiştirmediğini doğrulayan koşul da eklendi.

Search Console hesabında açık oturum bulunmadığından özel doğrulama işlemi veya yeniden indeksleme isteği gönderilmedi. “Keşfedildi / tarandı, şu anda dizine eklenmiş değil” Google'ın indeks seçimi durumudur; teknik erişim hatasıyla aynı değildir. Yayın sonrası sitemap yeniden gönderilebilir ve önemli canonical sayfalarda URL Denetleme ile indeks isteği yapılabilir. Yönlendirme ve bilerek noindex olan raporlarda bu işlem gerekli değildir.

Kaynaklar: [Google sitelinks](https://developers.google.com/search/docs/appearance/sitelinks), [site adı](https://developers.google.com/search/docs/appearance/site-names), [indeksleme SSS](https://developers.google.com/search/help/crawling-index-faq).

## Ziyaretçi & Canlı

- Kurucuya özel, günlük / 7 / 30 günlük kullanım özeti; sayfa açılışı, çalışma ekranı açılışı ve yüzey analizi düğmesine basılma sayısı.
- Genel yönlendirme kaynağı, cihaz grubu, yaklaşık ülke ve görüntülenen sayfa dağılımı. Referrer paylaşılmadığında doğrudan/bilinmeyen kaynağa dahil edilir; tüm AI yönlendirmeleri tanınabilir diye sunulmaz.
- Kişi/oturum kimliği, IP, tam referrer, URL sorgusu ve parmak izi kaydedilmez. Yeni günlük toplamlar 400 gün saklanır; DNT/GPC tercihlerinde yeni özetler gönderilmez. Eski sayaç geçmişi yeni kırılımlara dönüştürülmez.
- IP yalnız sunucuda geçici ülke eşleştirmesinde kullanılır. DB-IP Lite 2026-10 kamu aralıkları yerel ikili aramayla okunur; IP üçüncü taraf sorgu servisine gönderilmez. Ülke tahminidir; VPN/proxy etkisi ve bilinmeyen değerler korunur. Kaynak dosyanın SHA-256 değeri sabitlenir; arayüzde CC BY 4.0/DB-IP atfı vardır.
- RLS açıktır; anonim roller tablo veya rapor RPC'sini okuyamaz. Ingestion RPC'sini yalnız service_role çalıştırabilir. Rapor RPC'si SECURITY INVOKER kullanır ve mevcut private.is_owner kontrolüyle sınırlıdır.
- Yeni sunucu ve istemci kodu mevcut allometri, türler, park algılama veya yüzey hesaplama motorunu çağırarak değiştirmez; analiz düğmesinin etkinleştirilmesi yalnız bağımsız bir kullanım sayısı üretir. Sayaç isteği uygulama açılışında beklenmez; başarısızlığı ana iş akışını durdurmaz.

Supabase güvenlik danışmanında yeni tablo/RPC için uyarı yoktur. Önceden bulunan davet işlevi SECURITY DEFINER uyarıları ve kapalı sızdırılmış parola kontrolü bu kapsamda değiştirilmedi: [işlev izinleri](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [parola koruması](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Arşiv yedek tablosunun RLS açık/politika yok bilgilendirmesi korunan arşive aittir.
