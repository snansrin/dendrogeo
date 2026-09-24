# 🔵 Google ile giriş — kurulum rehberi

DendroGeo'da e-posta/parola girişinin yanında **Google ile devam et** düğmesi
var (landing → Giriş/Kayıt kartının en üstünde). Akış Supabase OAuth üzerinden
yürür; kod tarafı hazırdır, **tek seferlik iki panel ayarı** gerekir.

> Ayarlar yapılmadan düğmeye basılırsa uygulama çökmez: kullanıcıya
> "Google girişi bu projede henüz etkin değil" mesajı gösterilir ve
> e-posta/parola ile giriş çalışmaya devam eder.

---

## 1) Google Cloud Console (≈5 dk)

1. <https://console.cloud.google.com/> → proje seç veya oluştur
   (örn. `dendrogeo`).
2. **APIs & Services → OAuth consent screen**
   * User type: **External**
   * App name: `DendroGeo` · Support e-mail: kendi e-postan
   * Authorized domains: `dendrogeo.org` ve `supabase.co`
   * Scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
   * **Publishing status: In production** ← ⚠ bunu yapmazsan yalnız
     "test users" listesine eklediğin hesaplar giriş yapabilir.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   * Application type: **Web application**
   * Name: `DendroGeo Web`
   * Authorized JavaScript origins:
     ```
     https://dendrogeo.org
     ```
   * **Authorized redirect URI** (birebir böyle — Supabase'in kendi callback'i):
     ```
     https://xjbpounwdxrhelmixvqm.supabase.co/auth/v1/callback
     ```
   * Oluştur → **Client ID** ve **Client Secret**'ı kopyala.

## 2) Supabase (≈2 dk)

1. **Authentication → Providers → Google** → **Enable**
   * Client ID + Client Secret yapıştır → Save
2. **Authentication → URL Configuration**
   * Site URL: `https://dendrogeo.org`
   * Redirect URLs: `https://dendrogeo.org/**`
3. (Önerilir) **Authentication → Providers → "Allow manual linking"** → açık.
   Neden: `snansrin@gmail.com` gibi **zaten e-posta/parola ile kayıtlı** bir
   kullanıcı aynı e-postayla Google'dan girerse, kimliklerin birleşmesi için
   bu ayar gerekir. Kapalıysa `identity_already_exists` hatası alabilir.

## 3) Doğrulama

1. Gizli sekmede <https://dendrogeo.org> → **Giriş / Kayıt** → 🔵 **Google ile devam et**
2. Google hesap seçimi (`prompt=select_account`) → izin ver
3. `dendrogeo.org`'a döner, "⏳ Google girişi tamamlanıyor…" kısa bir an görünür
   → uygulama açılır, sağ üstte adın yazar
4. Kontrol: **👥 Kullanıcı Yönetimi**'nde yeni kullanıcı `user` rolüyle ve
   `active` olarak listelenmeli (profil `handle_new_user` tetikleyicisiyle
   otomatik açılır — ayrıca SQL çalıştırmana gerek yok).

---

## Kodda ne var (nasıl çalışıyor)

| Dosya | Ne yapar |
|---|---|
| `partials/landing.html` | 🔵 düğme (`#googleBtn`) + `#oauthWait` bekleme şeridi. G logosu **satır içi SVG** — dış kaynak yok (CSP, çevrimdışı ve PWA güvenli). |
| `src/services/auth.js` | `dgGoogleSignIn()` → `sb.auth.signInWithOAuth({provider:"google", options:{redirectTo, queryParams:{prompt:"select_account"}}})`. Ayrıca `dgIsOAuthCallback()`, `dgOAuthError()`, `dgWaitForOAuthSession()`, `dgCleanOAuthUrl()`. |
| `src/ui/shell.js` (`boot()`) | Geri dönüşte URL'de `?code=` varsa **takasın bitmesini bekler** (`dgWaitForOAuthSession`), sonra profili yükleyip kabuğu açar. Beklemezsek `getSession()` null döner ve kullanıcı giriş olduğu hâlde landing'i görürdü. |
| `css/style.css` | `.dg-google`, `.dg-oauth-sep`, `.dg-oauth-wait` (Google buton yönergesi: açık zemin, ince kenarlık, koyu metin, solda çok renkli G). |

### Neden Turnstile yok?
Cloudflare Turnstile parola formunda bot koruması sağlar. OAuth akışında
doğrulamayı Google kendi ekranında yaptığı için ikinci bir captcha gereksiz
sürtünmedir.

### Güvenlik notları
* `redirectTo` her zaman `window.location.origin + pathname`'den üretilir;
  sabit bir dış adrese yönlendirme yoktur. Supabase tarafındaki **Redirect
  URLs** allow-list'i ikinci kapıdır.
* Girişten sonra adres çubuğundaki `?code=…` temizlenir
  (`dgCleanOAuthUrl`) — yenilemede takas tekrar denenmez, ekran
  görüntüsünde/paylaşılan bağlantıda kod görünmez.
* Google ile gelen kullanıcı da `profiles.role='user'`, `active=true` başlar;
  ölçüm onay yetkisi yoktur (`enforce_approval` tetikleyicisi aynen geçerli).
* OAuth dönüşü başarısız/iptal olursa kullanıcı landing'e düşer ve
  "Google girişi tamamlanamadı" uyarısı görür; parola ile giriş açıktır.

### Bilinen sınırlar
* **Çevrimdışı Google girişi yok** (OAuth ağ ister). Çevrimdışı ölçüm kuyruğu
  bundan etkilenmez: zaten giriş yapılmış oturumda çalışır.
* PWA'da (`manifest.json` + service worker) OAuth yönlendirmesi tarayıcı
  sekmesinde açılıp geri döner; iOS Safari'de "uygulamayı kullanırken"
  konum izni gibi ayarlar değişmez.
* Google hesabının e-postası **doğrulanmamışsa** Supabase kullanıcıyı
  oluşturmayabilir; kurumsal hesaplarında bu nadirdir.
