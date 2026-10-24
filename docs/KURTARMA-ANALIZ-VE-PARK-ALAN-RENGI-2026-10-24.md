# Analiz ve park alan rengi — kurtarma

24 Ekim 2026'da kullanıcının son sağlam yapı olarak işaretlediği sürüm:

- Commit: `b97b037c3d5267b9e3e0059777e1a18bf3c1a3b7`
- Mesaj: `analiz ve park alan rengi`
- Uzak dal: `recovery/analiz-ve-park-alan-rengi-20261024`
- Sabit etiket: `recovery-analiz-ve-park-alan-rengi-20261024`
- Kaynak main: `1bf1c4750f465935d4b8e88e43561b710ce43593`
- Her ikisinin aynı kaynak ağacı: `7631019d8371f57c0c2e2ed86ecd8b9ac366e7f4`

Commit kaynakları değiştirmeyen bir işaret commit'idir. Dal ve etiket GitHub'a
gönderilip doğrulandı. Etap araştırması ayrı `feat/park-stage-scope-20261024`
dalında başladı; bu belge ve araştırma sağlam sürümün parçası değildir.

[Commit](https://github.com/snansrin/dendrogeo/commit/b97b037c3d5267b9e3e0059777e1a18bf3c1a3b7)
ve [etiket](https://github.com/snansrin/dendrogeo/tree/recovery-analiz-ve-park-alan-rengi-20261024).

İnceleme kopyası açmak için:

```powershell
git fetch origin tag recovery-analiz-ve-park-alan-rengi-20261024
git switch -c restore/analiz-ve-park-alan-rengi-review recovery-analiz-ve-park-alan-rengi-20261024
npm ci
npm run check
```

Canlıya geri dönüş ayrı inceleme ve düzeltme/geri alma PR'ıyla yapılır. Main'e
`reset --hard`, force push veya tablo geri yüklemesi uygulanmaz. Bu kod kurtarma
noktası veritabanı yedeği değildir; sonraki ölçümler/kabul edilmiş kayıtlar silinmez.
Yayında telefon, erişilebilirlik, CI ve canlı kaynak sürümleri tekrar doğrulanır.

GitHub'dan bağımsız `git archive` ZIP'i de kullanıcıya teslim edildi:
`analiz-ve-park-alan-rengi-20261024.zip`.
SHA-256: `A0C3EE3B8B7DC322DFD8DD43E45BB5E8DE14BCC19CC91D43C040FC30C1F7C335`.
