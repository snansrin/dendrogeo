# 🔵 Google ile giriş — TAM kurulum rehberi

DendroGeo'da e-posta/parola girişinin yanında **Google ile devam et** düğmesi
var (landing → Giriş/Kayıt kartının en üstünde). Kod tarafı hazırdır; çalışması
için **bir kez** iki panelde ayar gerekir:

1. **Google Cloud** → OAuth istemcisi (Client ID + Secret) üretmek
2. **Supabase** → Google sağlayıcısını bu bilgilerle etkinleştirmek

> Ayarlar yapılmadan düğmeye basılırsa uygulama çökmez: "Google girişi bu
> projede henüz etkin değil" mesajı gösterilir, e-posta/parola çalışmaya devam
> eder.

**Süre:** ~10 dakika · **Ücret:** yok (OAuth ücretsiz, faturalandırma hesabı
gerekmez) · **Kod değişikliği:** gerekmez · **SQL/migration:** gerekmez
(`handle_new_user` tetikleyicisi Google metadata'sından profili zaten kurar).

---

# BÖLÜM A — GOOGLE CLOUD

## A0. Proje
1. <https://console.cloud.google.com/> → Google hesabınla gir
   (DendroGeo'nun sahibi olarak kullanmak istediğin hesap).
2. Üstteki **proje seçici** (solda "Select a project") → **New Project**
   * Name: `DendroGeo`
   * Organization/Location: boş bırakılabilir
   * **Create** → sonra üst barda projenin **seçili** olduğundan emin ol.

## A1. Branding (kullanıcının göreceği onay ekranı)
Sol menü: **APIs & Services → Google Auth Platform → Branding**
(direkt: <https://console.cloud.google.com/auth/branding>)

| Alan | Ne yazılır |
|---|---|
| App name | `DendroGeo` |
| User support email | kendi e-postan (açılır listeden seç) |
| Application home page | `https://dendrogeo.org` |
| Application privacy policy link | `https://dendrogeo.org/hakkimizda/` (yoksa ana sayfa) |
| Application terms of service link | `https://dendrogeo.org/hakkimizda/` (yoksa ana sayfa) |
| Authorized domains | `dendrogeo.org` → **ADD DOMAIN** |
| Developer contact information | kendi e-postan |
| App logo | (opsiyonel) repodaki `logo.png` |

* **Save**
* Not: Google, yönlendirme adresinin alan adını (`supabase.co`) genelde kendi
  tarafında tanır. "Domain not authorized" hatası alırsan Authorized domains'e
  `supabase.co` da ekle.
* Branding'de **verification (marka doğrulaması)** bu senaryoda GEREKMEZ:
  yalnız hassas olmayan scope'lar kullanıyoruz (A3). Logo/ad doğrulaması
  isteğe bağlıdır ve birkaç iş günü sürebilir.

## A2. Audience ⚠ en çok unutulan adım
Sol menü: **Google Auth Platform → Audience**
(direkt: <https://console.cloud.google.com/auth/audience>)

* **Publishing status:** `Testing` ise → **PUBLISH APP** → yayın durumunu
  **In production** yap.
* ⚠ **Testing'de bırakırsan yalnız "Test users" listesindeki hesaplar giriş
  yapabilir.** Yayına almadan test etmek istiyorsan aynı sayfada
  **Test users → ADD USERS** ile kendi ve ekip arkadaşlarının Google
  e-postalarını ekle (üst sınır 100).
* `In production` + hassas scope yoksa ek onay gerekmez; herkes girebilir.

## A3. Data Access (Scopes)
Sol menü: **Google Auth Platform → Data Access**
(direkt: <https://console.cloud.google.com/auth/scopes>)

Supabase Auth'un ihtiyacı olan üç scope:

| Scope | Durum |
|---|---|
| `.../auth/userinfo.email` | varsayılan gelir |
| `.../auth/userinfo.profile` | varsayılan gelir |
| `openid` | **elle eklenmeli** → `ADD OR REMOVE SCOPES` → aramaya `openid` yaz → işaretle → **UPDATE** → **SAVE** |

* ⚠ **Başka scope ekleme.** Drive/Sheets gibi hassas (sensitive) veya
  kısıtlı (restricted) scope'lar Google **verification** sürecini tetikler
  (günler/haftalar sürebilir) ve giriş o süreçte çalışmaz.

## A4. Clients → OAuth client ID (asıl kimlik bilgileri)
Sol menü: **Google Auth Platform → Clients** → **+ CREATE CLIENT**
(direkt: <https://console.cloud.google.com/auth/clients/create>)

1. **Application type:** `Web application` ← **kritik**, başka tip seçilirse
   tarayıcı girişi `unauthorized_client` hatası verir.
2. **Name:** `DendroGeo Web`
3. **Authorized JavaScript origins** → `ADD URI`:
   ```
   https://dendrogeo.org
   ```
   * Sonda `/` **yok**, `http://` değil `https://`.
   * Yerelde deneyeceksen `http://localhost:8000` ekle; canlıya çıkarken sil.
4. **Authorized redirect URIs** → `ADD URI` (Supabase'in callback'i — birebir):
   ```
   https://xjbpounwdxrhelmixvqm.supabase.co/auth/v1/callback
   ```
   * Bu adresi **Supabase panelinden kopyala** (B1'de görünüyor); elle yazarken
     `/auth/v1/callback` bölümü ve büyük/küçük harf birebir olmalı, sonda `/`
     olmamalı. Uyuşmazsa Google `redirect_uri_mismatch` verir.
5. **CREATE** → açılan pencerede **Client ID** ve **Client Secret** görünür.
   * ⚠ Secret bir kez tam gösterilir → **kopyala ve sakla** (sonradan
     istemci listesinden ⬇ indirerek JSON'dan da alabilirsin).
   * Bu iki değer Supabase'e yapıştırılacak (B1).

---

# BÖLÜM B — SUPABASE

## B1. Google sağlayıcısını etkinleştir
1. <https://supabase.com/dashboard> → **DendroGeo** projesi
   (proje ref: `xjbpounwdxrhelmixvqm`)
2. Sol menü: **Authentication** → **Sign In / Providers**
   (bazı sürümlerde sadece **Providers**)
3. Listede **Google** → tıkla
4. **Enable Sign in with Google** anahtarını **AÇ**
5. Alanları doldur:
   * **Client ID** → A4'teki Client ID (`…apps.googleusercontent.com`)
   * **Client Secret** → A4'teki Secret
   * **Skip Nonce Check** → **kapalı** bırak
   * (opsiyonel) Allow Refresh Token rotation → kapalı kalabilir
6. **Save**
7. Bu sayfada **Callback URL** yazar:
   ```
   https://xjbpounwdxrhelmixvqm.supabase.co/auth/v1/callback
   ```
   → A4 adım 4'e yazdığın adresle **birebir aynı** olduğunu kontrol et.

## B2. URL Configuration (nereye geri dönülecek)
**Authentication → URL Configuration**

* **Site URL:**
  ```
  https://dendrogeo.org
  ```
* **Redirect URLs** → `ADD URL`:
  ```
  https://dendrogeo.org/**
  ```
  * Wildcard'lı biçim bazen sorun çıkarabiliyor; garantici olmak için hem
    `https://dendrogeo.org` hem `https://dendrogeo.org/**` ekle.
  * Yerel geliştirme için ayrıca `http://localhost:8000/**` ekleyebilirsin.
* **Save**

## B3. Kayıtlar açık mı? (kontrol)
* **Authentication → Sign In / Providers → Email:** `Enable Email provider`
  **AÇIK** kalmalı (parola ile giriş devam etsin).
* **Authentication → Sign In / Up** (veya Providers sayfasının üstü):
  `Allow new users to sign up` **AÇIK** olmalı — Google ile ilk girişte
  kullanıcı bu sayede oluşturulur.

## B4. (Sorun çıkarsa) Allow manual linking
Supabase, **doğrulanmış** aynı e-postaya sahip kimlikleri normalde
**otomatik birleştirir** (Google e-postaları doğrulanmış sayılır). Yani
`snansrin@gmail.com` hem parola hem Google ile giriş yapabilir; tek kullanıcı,
iki kimlik (`auth.identities`) olur.

Yine de `identity_already_exists` hatası alırsan:
**Authentication → Sign In / Providers** sayfasındaki genel ayarlarda (bazı
sürümlerde **Authentication → Attack Protection / Settings**) bulunan
**Allow manual linking** seçeneğini aç.

---

# BÖLÜM C — TEST VE DOĞRULAMA

1. **Gizli/incognito** sekmede <https://dendrogeo.org> → **Giriş / Kayıt**
2. 🔵 **Google ile devam et** → Google hesap seçimi (`prompt=select_account`)
   → izin ver
3. `dendrogeo.org`'a döner → kısa bir an **"⏳ Google girişi tamamlanıyor…"**
   → uygulama açılır, sağ üstte adın görünür
4. **👥 Kullanıcı Yönetimi** → yeni satır: e-posta, ad soyad, rol `KULLANICI`,
   durum `Aktif`
5. SQL ile kontrol (Supabase → SQL Editor):
   ```sql
   select email, full_name, role, active, created_at
     from public.profiles order by created_at desc limit 5;

   -- hangi sağlayıcıdan gelmiş?
   select provider, provider_id, identity_data->>'email' as email, created_at
     from auth.identities order by created_at desc limit 5;
   -- Google ile gelen satırda provider = 'google'
   ```
6. Çıkış yapıp **e-posta/parola** ile de girebildiğini doğrula (iki yol birlikte
   çalışmalı).

---

# SORUN GİDERME

| Belirti | Sebep | Çözüm |
|---|---|---|
| `redirect_uri_mismatch` | Google'daki redirect URI, Supabase callback'i ile birebir aynı değil | İki adresi yan yana koy: `https://xjbpounwdxrhelmixvqm.supabase.co/auth/v1/callback` (sonda `/` yok) |
| `Access blocked: Authorization Error` / `access_denied` | Uygulama hâlâ **Testing** ve hesabın Test users'ta değil | A2 → **Publish app** (In production) ya da Test users'a ekle |
| `unauthorized_client` / `disallowed_useragent` | Client tipi `Web application` değil | A4 → yeni client oluştur (Web application) |
| `origin_mismatch` | Authorized JavaScript origins'te `https://dendrogeo.org` yok | A4 adım 3 |
| `invalid_client` / Secret hatası | Client Secret yanlış/eski | A4'ten yeniden kopyala → B1 |
| Buton "Google girişi bu projede henüz etkin değil" diyor | Supabase'de Enable kapalı ya da ID/Secret boş | B1 |
| Google'dan dönüyor ama landing'de kalıyorum | Eski kod sürümü (takas bekleme mantığı yok) veya `?error=` ile dönüş | Son patch'i uygula + **Ctrl+Shift+R**; hata mesajı ekranda yazıyorsa tabloya bak |
| `identity_already_exists` | Aynı e-posta parola ile zaten kayıtlı, otomatik bağlanma olmamış | B4 → Allow manual linking |
| Giriş oldu ama yetki yok | Normal: Google ile gelen herkes `role='user'` başlar | 👥 Kullanıcı Yönetimi → rolü `Denetçi` yap (owner'dan başka admin) |

---

# KODDA NE VAR (nasıl çalışıyor)

| Dosya | Ne yapar |
|---|---|
| `partials/landing.html` | 🔵 düğme (`#googleBtn`) + `#oauthWait` bekleme şeridi. G logosu **satır içi SVG** — dış kaynak yok (CSP, çevrimdışı, PWA güvenli). |
| `src/services/auth.js` | `dgGoogleSignIn()` → `sb.auth.signInWithOAuth({provider:"google", options:{redirectTo, queryParams:{prompt:"select_account"}}})`. Ayrıca `dgIsOAuthCallback()`, `dgOAuthError()`, `dgWaitForOAuthSession()`, `dgCleanOAuthUrl()`, `dgShowOAuthWait/dgHideOAuthWait()`. |
| `src/ui/shell.js` (`boot()`) | Dönüşte URL'de `?code=` varsa **takasın bitmesini bekler**, sonra profili yükleyip kabuğu açar. `?error=` varsa iptal mesajı gösterir. Başarılı girişte `?code=` adres çubuğundan temizlenir. |
| `css/style.css` | `.dg-google`, `.dg-oauth-sep`, `.dg-oauth-wait` (Google buton yönergesi: açık zemin, `#dadce0` kenarlık, koyu metin, solda çok renkli G). |

### Neden `dgWaitForOAuthSession` şart?
supabase-js, dönüş adresindeki `?code=…` değerini **arka planda** access
token'a çevirir. O anda `getSession()` `null` döner; beklemeden landing'e
düşersek kullanıcı Google'da başarılı olduğu hâlde giriş olmamış görür.
Bekleme mantığı: `SIGNED_IN`/`USER_UPDATED` → oturum; `INITIAL_SESSION` boş
gelirse 1.5 sn ek süre; 9 sn mutlak zaman aşımı → `null` (landing + uyarı).
Hazır oturum varsa dinleyici beklenmez (yarış koruması).

### Neden Turnstile yok?
Cloudflare Turnstile parola formunda bot koruması sağlar. OAuth akışında
doğrulamayı Google kendi ekranında yapar; ikinci captcha gereksiz sürtünmedir.

### Güvenlik notları
* `redirectTo` **sabit yazılmaz**, `window.location.origin + pathname`'den
  üretilir. Supabase tarafındaki **Redirect URLs** listesi ikinci kapıdır.
* Girişten sonra `?code=…` temizlenir: yenilemede takas tekrar denenmez,
  ekran görüntüsü/paylaşılan bağlantıda kod görünmez.
* Google ile gelen kullanıcı da `role='user'`, `active=true` başlar; ölçüm
  onay yetkisi yoktur (`enforce_approval` tetikleyicisi aynen geçerli).
* OAuth iptal/hata olursa kullanıcı landing'e düşer, uyarı görür; parola ile
  giriş her zaman açıktır.

### Bilinen sınırlar
* **Çevrimdışı Google girişi yok** (OAuth ağ ister). Çevrimdışı ölçüm kuyruğu
  etkilenmez: zaten giriş yapılmış oturumda çalışır.
* PWA'da yönlendirme tarayıcı sekmesinde açılıp geri döner; iOS Safari'de
  konum izni gibi ayarlar değişmez.
* Marka doğrulaması (logo/ad) yapılmazsa onay ekranında proje adı yerine
  Client ID görünebilir — güven algısı için A1'i doldurmak yeterli.
