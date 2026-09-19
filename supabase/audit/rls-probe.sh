#!/usr/bin/env bash
# ============================================================================
# RLS denetim sondası — anon key ile, GİRİŞ YAPMADAN.
#
# Her deneme için beklenen sonuç "reddedildi" ya da "boş veri". Bir deneme
# veri döndürürse ya da başarılı yazarsa RLS AÇIĞI vardır.
#
# KULLANIM:  ./supabase/audit/rls-probe.sh
# GEREKSİNİM: curl, jq (opsiyonel ama önerilir)
#
# Bu betik SADECE OKUMA ve TEK SATIRLIK zararsız yazma denemeleri yapar.
# Başarılı olursa (yani açık varsa) 1 ve 2 numaralı denemeler gerçek bir satır
# ekleyebilir — o durumda sondanın yazdığı kaydı silin. Lat/lon 0,0 ve
# dbh_cm 0 olduğu için istatistikleri kirletmez, ama yine de temizleyin.
# ============================================================================
set -uo pipefail

# Anon key'i kaynaktan oku (repoda zaten açık, tasarımı gereği)
KAYNAK="$(dirname "$0")/../../src/config/supabase.js"
[ -f "$KAYNAK" ] || { echo "❌ $KAYNAK bulunamadı — depo kökünden çalıştırın"; exit 1; }
SB_URL=$(grep -oE 'SB_URL="[^"]+"' "$KAYNAK" | cut -d'"' -f2)
SB_KEY=$(grep -oE 'SB_KEY="[^"]+"' "$KAYNAK" | cut -d'"' -f2)
[ -n "$SB_URL" ] && [ -n "$SB_KEY" ] || { echo "❌ SB_URL/SB_KEY okunamadı"; exit 1; }
command -v curl >/dev/null || { echo "❌ curl gerekli"; exit 1; }

REST="$SB_URL/rest/v1"
HDR=(-H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY" -H "Content-Type: application/json" -H "Prefer: return=representation")

ACIK=0
# $1=başlık  $2=beklenen("RED"|"IZIN")  $3=http_kodu  $4=govde
raporla() {
  local baslik="$1" beklenen="$2" kod="$3" govde="$4"
  local reddedildi="hayir"
  case "$kod" in 401|403|404) reddedildi="evet";; esac
  # 201/200 ama boş dizi de "satır filtrelenmiş" demek → kabul edilebilir
  if [ "$kod" = "200" ] && [ "$govde" = "[]" ]; then reddedildi="evet(bos)"; fi
  if [ "$kod" = "201" ] && [ "$govde" = "[]" ]; then reddedildi="evet(bos)"; fi

  local durum
  if [ "$beklenen" = "RED" ]; then
    if [ "$reddedildi" != "hayir" ]; then durum="✅ reddedildi"; else durum="🔴 AÇIK"; ACIK=1; fi
  else
    if [ "$reddedildi" = "hayir" ]; then durum="✅ izinli (beklenen)"; else durum="⚠️ beklenmedik ret"; fi
  fi
  printf "  %-6s %-46s HTTP %s\n" "$durum" "$baslik" "$kod"
  if [ "$durum" = "🔴 AÇIK" ]; then
    printf "         → yanıt: %.300s\n" "$govde"
  fi
}

deneme() {  # $1=başlık $2=beklenen $3=method $4=yol $5=govde
  local yanit kod govde
  yanit=$(curl -sS -o /tmp/rls_body -w '%{http_code}' -X "$3" "${HDR[@]}" ${5:+-d "$5"} "$REST/$4")
  kod="$yanit"; govde=$(cat /tmp/rls_body 2>/dev/null | tr -d '\n')
  raporla "$1" "$2" "$kod" "$govde"
}

echo "════════════════════════════════════════════════════════════════════"
echo " DendroGeo RLS denetimi — anon rolü, giriş YAPILMADI"
echo " Hedef: $SB_URL"
echo "════════════════════════════════════════════════════════════════════"
echo
echo "── YAZMA DENEMELERİ (hepsi REDDEDİLMELİ) ─────────────────────────"
deneme "1. measurements anonim INSERT"        RED POST   "measurements"      '{"lat":0,"lon":0,"dbh_cm":0,"height_m":0,"status":"Beklemede"}'
deneme "2. measurements anonim UPDATE"        RED PATCH  "measurements?id=eq.00000000-0000-0000-0000-000000000000" '{"status":"Onaylı"}'
deneme "3. measurements anonim DELETE"        RED DELETE "measurements?id=eq.00000000-0000-0000-0000-000000000000" ''
deneme "4. profiles.role → admin (YETKİ YÜK.)" RED PATCH "profiles?id=eq.00000000-0000-0000-0000-000000000000" '{"role":"admin"}'
deneme "5. projects anonim INSERT"            RED POST   "projects"          '{"name":"rls-probe"}'
deneme "6. data_requests anonim INSERT"       RED POST   "data_requests"     '{"note":"rls-probe"}'
deneme "7. waypoints anonim INSERT"           RED POST   "waypoints"         '{"lat":0,"lon":0,"wp_id":1}'

echo
echo "── OKUMA DENEMELERİ ──────────────────────────────────────────────"
deneme "8. measurements: ONAY BEKLEYENLER"    RED GET    "measurements?status=neq.Onaylı&select=*&limit=3" ''
deneme "9. data_requests (tüm talepler)"      RED GET    "data_requests?select=*&limit=3" ''
deneme "10. profiles (tüm kullanıcılar)"      RED GET    "profiles?select=*&limit=3" ''
deneme "11. measurements: ONAYLILAR"          IZIN GET   "measurements?status=eq.Onaylı&select=lat,lon,point_id&limit=3" ''
deneme "12. site_visits (anon sayaç yazabilmeli)" IZIN POST "site_visits" '{}'

echo
echo "── STORAGE: başkasının yoluna yazma ─────────────────────────────"
STOR=$(curl -sS -o /tmp/rls_stor -w '%{http_code}' -X POST \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY" -H "Content-Type: text/plain" \
  --data 'rls-probe' \
  "$SB_URL/storage/v1/object/dendro-photos/00000000-0000-0000-0000-000000000000/rls-probe.txt")
if [ "$STOR" = "401" ] || [ "$STOR" = "403" ] || [ "$STOR" = "400" ] || [ "$STOR" = "404" ]; then
  printf "  %-6s %-46s HTTP %s\n" "✅ reddedildi" "13. başkasının fotoğraf yoluna yükleme" "$STOR"
else
  printf "  %-6s %-46s HTTP %s\n" "🔴 AÇIK" "13. başkasının fotoğraf yoluna yükleme" "$STOR"
  printf "         → yanıt: %.300s\n" "$(cat /tmp/rls_stor | tr -d '\n')"
  ACIK=1
fi

echo
echo "── service_role sızıntısı ────────────────────────────────────────"
if grep -rq "service_role" --include='*.js' --include='*.html' . 2>/dev/null; then
  echo "  🔴 AÇIK   'service_role' dizesi kodda geçiyor — hemen kontrol edin"
  grep -rn "service_role" --include='*.js' --include='*.html' . | head -5
  ACIK=1
else
  echo "  ✅ reddedildi  service_role anahtarı kodda geçmiyor"
fi

rm -f /tmp/rls_body /tmp/rls_stor
echo
echo "════════════════════════════════════════════════════════════════════"
if [ "$ACIK" = "1" ]; then
  echo " 🔴 EN AZ BİR AÇIK BULUNDU. Supabase panelinde politikayı düzeltin,"
  echo "    sonra supabase/migrations/000N_fix_rls.sql olarak repoya yazın."
else
  echo " ✅ Tüm denemeler beklendiği gibi. Sonuçları RLS-DENETIM.md tablosuna işleyin."
fi
echo "════════════════════════════════════════════════════════════════════"
exit $ACIK
