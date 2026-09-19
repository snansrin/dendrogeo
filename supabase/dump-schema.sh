#!/usr/bin/env bash
# ============================================================================
# Supabase şemasını repoya aktarır.
#
# NEDEN GEREKLİ
# -------------
# Bu repoda şu ana kadar TEK SATIR SQL yoktu. Yani projenin güvenlik modelinin
# tamamını taşıyan RLS politikaları, trigger'lar, view tanımları ve
# constraint'ler yalnızca Supabase kontrol panelinde yaşıyordu. Sonuçları:
#
#   · Politikalar code review'dan geçemiyor — SECURITY.md "tüm tablolarda RLS
#     var" diyor ama bunu depodan kimse doğrulayamıyor
#   · Anon key repoda açık (tasarım gereği, README'de belgeli). Yani güvenliğin
#     TEK dayanağı RLS'in doğru olması ve bunu denetleyecek hiçbir kayıt yok
#   · Felaket kurtarma yok: proje silinirse şemayı yeniden kurmanın belgesi yok
#   · "Bu alan neden var?" sorusunun cevabı yok
#
# KULLANIM
# --------
#   1. Supabase CLI kurulu olmalı:  brew install supabase/tap/supabase
#      (veya https://supabase.com/docs/guides/cli)
#   2. Proje referansı: xjbpounwdxrhelmixvqm  (src/config/supabase.js'teki SB_URL)
#   3. Depo kökünden çalıştır:     ./supabase/dump-schema.sh
#
# Çıktı supabase/migrations/0001_init.sql olarak yazılır. Sonra bu dosyayı
# okuyup supabase/audit/RLS-DENETIM.md'deki listeyi işaretleyin.
# ============================================================================
set -euo pipefail

PROJE_REF="${SUPABASE_PROJE_REF:-xjbpounwdxrhelmixvqm}"
CIKTI="$(dirname "$0")/migrations/0001_init.sql"

if ! command -v supabase >/dev/null 2>&1; then
  echo "❌ supabase CLI bulunamadı. Kurulum: brew install supabase/tap/supabase" >&2
  echo "   veya: npm i -g supabase" >&2
  exit 1
fi

echo "→ supabase login gerekiyor olabilir (tarayıcı açılır)"
echo "→ Proje: $PROJE_REF"
echo "→ Çıktı: $CIKTI"
echo

mkdir -p "$(dirname "$CIKTI")"

{
  echo "-- ============================================================================"
  echo "-- DendroGeo şema dökümü"
  echo "-- Proje : $PROJE_REF"
  echo "-- Tarih : $(date -u '+%Y-%m-%d %H:%M UTC')"
  echo "-- Komut : supabase db dump --schema public"
  echo "--"
  echo "-- Bu dosya ÜRETİLMİŞ bir anlık görüntüdür, elle düzenlenmeyin."
  echo "-- Sonraki değişiklikler yeni numaralı dosyalar olarak eklenmeli:"
  echo "--   0002_<degisiklik>.sql, 0003_<degisiklik>.sql, ..."
  echo "-- ============================================================================"
  echo
  # Not: --linked bir proje gerekiyorsa önce `supabase link --project-ref $PROJE_REF`
  supabase db dump --project-ref "$PROJE_REF" --schema public
} > "$CIKTI"

echo
echo "✅ Yazıldı: $CIKTI ($(wc -l < "$CIKTI") satır)"
echo
echo "Şimdi yapmanız gerekenler:"
echo "  1. Dosyayı okuyun — RLS politikaları beklendiği gibi mi?"
echo "  2. supabase/audit/RLS-DENETIM.md listesindeki maddeleri işaretleyin"
echo "  3. git add supabase/ && git commit -m 'chore(db): şema dökümü repoya eklendi'"
