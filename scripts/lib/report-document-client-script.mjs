/* Browser-only behavior embedded in immutable report documents. */
export function renderReportDocumentClientScript({hash, snapshot, shareScript}) {
  return `
// Printed documents use textual status labels; screen icons are restored after printing.
let dgPrintText=[];
window.addEventListener('beforeprint',()=>{const root=document.querySelector('.wrap');if(!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){if(['SCRIPT','STYLE'].includes(node.parentElement?.tagName))continue;const clean=node.textContent.replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]/gu,'');if(clean!==node.textContent){dgPrintText.push([node,node.textContent]);node.textContent=clean;}}});
window.addEventListener('afterprint',()=>{for(const [node,text]of dgPrintText)node.textContent=text;dgPrintText=[];});
const DG_HASH=${JSON.stringify(hash)};
const DG_DATA=${JSON.stringify(snapshot)};
(async()=>{
  try{
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(DG_DATA,(k,v)=>(v&&typeof v==='object'&&!Array.isArray(v))?Object.keys(v).sort().reduce((o,key)=>(o[key]=v[key],o),{}):v)));
    const hex=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
    document.getElementById('dgVerify').textContent=hex===DG_HASH
      ?"✅ İçerik bütünlüğü doğrulandı: sayfadaki veri, yayın hash değeri ile birebir eşleşiyor."
      :"⚠ UYARI: sayfa verisi yayın hash değeri ile eşleşmiyor; bu kopya değiştirilmiş olabilir.";
  }catch(e){document.getElementById('dgVerify').textContent='⚠ Hash doğrulanamadı: '+e.message;}
})();
${shareScript}
`;
}
