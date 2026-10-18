# Rozetler, lisanslar ve arşiv kayıtları

Kontrol tarihi: 2026-10-18. Rozet, işaret ettiği kanıt kadar anlamlıdır. README'deki CI ve GIS rozetleri güncel GitHub Actions sonucunu gösterir; saha doğruluğu veya bütün parkların doğrulandığı anlamına gelmez.

| Rozet / kayıt | Durum ve kapsam | Kanıt / sonraki şart |
|---|---|---|
| Yazılım MIT | Uygulandı; kaynak kodu, test ve betikler | [LICENSE](../LICENSE), [OSI metni](https://opensource.org/license/mit) |
| Veri CC BY-NC 4.0 | Yetkili ve açıkça onaylı veri/özgün içerik kapsamı | [LICENSE-DATA](../LICENSE-DATA), [CC koşulları](https://creativecommons.org/licenses/by-nc/4.0/) |
| GitHub Release | Gerçek yayımlanmış sürümü dinamik gösterir | [Releases](https://github.com/snansrin/dendrogeo/releases) |
| Zenodo DOI | Sürüm 3.0.1: 10.5281/zenodo.22948773; kavram: 10.5281/zenodo.22646299 | [Zenodo](https://zenodo.org/records/22948773); DOI yayımdan sonra tescil edilir |
| CI | Kaynak, çekirdek, SQL, telefon ve erişilebilirlik işlerinin gerçek sonucu | [CI](https://github.com/snansrin/dendrogeo/actions/workflows/ci.yml) |
| GIS QA | Üç park için tanımlı otomatik kaynak karşılaştırması | [GIS iş akışı](https://github.com/snansrin/dendrogeo/actions/workflows/gis-three-park-qa.yml) |
| R/Python araçları | Ayrı araştırma/istemci kontrollerinin son sonucu | [İş akışı](https://github.com/snansrin/dendrogeo/actions/workflows/research-clients.yml) |
| ORCID | Yazar tanımlayıcıları CITATION.cff'e işlendi | [CITATION.cff](../CITATION.cff); ORCID bir kalite sertifikası değildir |
| Software Heritage | Zenodo v3.0.0 kaydında önceki arşiv bağlantısı mevcut | [Eski yazılım kaydı](https://zenodo.org/records/22948643); yeni sürümün SWHID'si doğrulanmadan güncel arşiv rozeti eklenmez |
| OpenSSF Best Practices | Sertifika/başarı rozeti eklenmedi | [Resmi ölçütler](https://github.com/ossf/best-practices-badge/blob/main/docs/criteria.md); proje kaydı ve her ölçüt için kanıtlı öz değerlendirme gerekir |
| REUSE uyumluluğu | Sertifika/uyumluluk rozeti eklenmedi | [REUSE](https://reuse.software/dev/); dosya bazlı telif/lisans kapsamı ve başarılı `reuse lint` gerekir. Üçüncü taraf lisansları topluca değiştirilemez |
| JOSS / dergi kabulü | Kabul/yayın rozeti eklenmedi | Makale taslağı dergi kabulü değildir; hakemlik ve yayımlanmış makale kaydı gerekir |
| Kapsama / WCAG / FAIR | Yüzde veya sertifika rozeti eklenmedi | Ölçülmüş kapsam, uygunluk kapsamı veya bağımsız değerlendirme olmadan iddia edilmez |

MIT ve CC BY-NC lisanslarını uygulamak için satın alma veya onay sertifikası gerekmez; hak sahiplerinin lisans beyanı, metinler, atıf ve kapsam açıklaması korunur. Mevcut ikili model sürdürülmüştür. Üçüncü taraf materyaller ve ayrı lisanslı veri yayınları kendi koşullarındadır: [envanter](THIRD_PARTY_LICENSES.md).

Zenodo'da sürümleme, yeni dosyaları eski kayıtla aynı sürüm ailesine bağlar: [resmi kılavuz](https://help.zenodo.org/docs/deposit/manage-versions/). Yeni bir yazılım sürümü, eski raporların veri DOI'lerini değiştirmez.
