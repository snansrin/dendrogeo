/* Browser-side share action embedded in each immutable report page. */
export const REPORT_SHARE_SCRIPT = `/* PAYLAŞ (2026-09-27 · kullanıcı isteği: rapor site içinden paylaşılacak):
 * Web Share API varsa yerel paylaşım sayfası açılır (mobil/masaüstü); yoksa
 * kalıcı bağlantı panoya kopyalanır. Bağlantı = sayfanın kendi URL'si, yani
 * DGR kimliği + sürüm + içerik hash'i ile dondurulmuş kopya paylaşılır. */
async function dgShareReport(){
  const btn=document.getElementById('dgShareBtn');
  const url=location.href.split('#')[0];
  const title=document.title;
  const sub=document.querySelector('.sub');
  const text=title+(sub?('. '+sub.textContent):'');
  const flash=(m)=>{if(!btn)return;const eski=btn.textContent;btn.textContent=m;setTimeout(()=>{btn.textContent=eski;},2400);};
  try{
    if(navigator.share){await navigator.share({title:title,text:text,url:url});return;}
  }catch(e){/* iptal edildi veya API yok → pano yedeği */}
  try{
    await navigator.clipboard.writeText(url);
    flash('✅ Bağlantı kopyalandı');
  }catch(e){
    window.prompt('Bağlantıyı kopyalayın (Ctrl+C):',url);
  }
}`;
