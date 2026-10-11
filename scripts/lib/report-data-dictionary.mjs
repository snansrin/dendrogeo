/* Static report variable definitions; scientific calculations stay with the engine. */
export const REPORT_DATA_DICTIONARY = `<p><b>4.6 Veri sözlüğü.</b> Raporda ve <code>data.json</code>/<code>olcum.csv</code> çıktılarında kullanılan değişkenlerin anlamı ve birimi aşağıdadır.</p>
<div class="tscroll"><table><thead><tr><th>Değişken</th><th>Açıklama</th><th>Birim</th></tr></thead><tbody>
<tr><td class="tr">Göğüs çevresi (C)</td><td class="qd">Mezura ile yerden 1,30 m yükseklikte ölçülen ham gövde çevresi (<code>girth_cm</code>)</td><td class="qd">cm</td></tr>
<tr><td class="tr">DBH (D)</td><td class="qd">Türetilmiş göğüs çapı: <b>D = C / π</b> (<code>dbh_cm</code>)</td><td class="qd">cm</td></tr>
<tr><td class="tr">Boy (H)</td><td class="qd">Ağaç boyu</td><td class="qd">m</td></tr>
<tr><td class="tr">ρ (rho)</td><td class="qd">Odun yoğunluğu (tür bazlı; bulunamazsa grup varsayılanı)</td><td class="qd">g/cm³</td></tr>
<tr><td class="tr">AGB</td><td class="qd">Toprak üstü biyokütle</td><td class="qd">kg</td></tr>
<tr><td class="tr">BGB</td><td class="qd">Toprak altı (kök) biyokütlesi = AGB × 0,26</td><td class="qd">kg</td></tr>
<tr><td class="tr">Karbon</td><td class="qd">Tahmini karbon stoku = (AGB + BGB) × 0,47</td><td class="qd">kg C</td></tr>
<tr><td class="tr">GA</td><td class="qd">%95 model belirsizlik aralığı (Monte Carlo, korele model hatası)</td><td class="qd">kg C</td></tr>
<tr><td class="tr">h/DBH</td><td class="qd">Boy/çap oranı — yalnız inceleme göstergesi, hata hükmü değildir</td><td class="qd">birimsiz</td></tr>
</tbody></table></div>
<p class="qnote"><b>Ölçüm notu:</b> Sahada doğrudan çap ölçülmemiştir. Mezura ile 1,30 m yükseklikte göğüs çevresi ölçülmüş; DBH çapı her kayıt için <b>çevre / π</b> ile türetilmiştir. Allometrik modele yalnız türetilmiş DBH uygulanır; ham çevre ayrıca saklanır.</p>

`;
