import {makeFullArchive} from './archive.mjs';

const button=document.getElementById('downloadArchive');
const status=document.getElementById('backupStatus');
const result=document.getElementById('backupResult');
let profile=null;

function announce(message,state='info'){
 status.textContent=message;
 status.dataset.state=state;
}

async function checkAccess(){
 button.disabled=true;
 try{
  if(typeof sb==='undefined')throw new Error('DendroGeo bağlantısı yüklenemedi.');
  const {data,error}=await sb.auth.getSession();
  if(error||!data?.session?.user)throw new Error('Önce DendroGeo ana sayfasından giriş yapın.');
  const {data:account,error:profileError}=await sb.from('profiles')
   .select('role,full_name').eq('id',data.session.user.id).single();
  if(profileError||!account)throw new Error('Hesap profiliniz doğrulanamadı.');
  if(account.role!=='owner'&&account.role!=='admin')throw new Error('Fotoğraflı veri arşivini yalnız yönetici veya hesap sahibi indirebilir.');
  profile=account;
  button.disabled=false;
  announce('Yetki doğrulandı. Arşiv yalnızca düğmeye bastığınızda hazırlanır.','success');
 }catch(error){
  announce(error.message||'Hesap doğrulanamadı.','error');
 }
}

button.addEventListener('click',async()=>{
 if(!profile||button.disabled)return;
 button.disabled=true;
 result.hidden=true;
 try{
  announce('Veri tabloları okunuyor…');
  const archive=await makeFullArchive(sb,{
   exportedBy:profile.full_name||'',
   cryptoImpl:window.crypto,
   BlobClass:window.Blob,
   onProgress:message=>announce(message)
  });
  const filename='dendrogeo_fotografli_tam_yedek_'+archive.exportedAt.slice(0,10)+'.zip';
  const url=URL.createObjectURL(archive.blob);
  const link=document.createElement('a');
  try{
   link.href=url;
   link.download=filename;
   document.body.appendChild(link);
   link.click();
   link.remove();
  }finally{window.setTimeout(()=>URL.revokeObjectURL(url),60000);}
  const total=Object.values(archive.counts).reduce((sum,count)=>sum+count,0);
  announce('Arşiv hazır; indirme başlatıldı.','success');
  result.textContent=filename+' · '+archive.counts.measurements+' ölçüm · '+archive.photos+' fotoğraf · '+total+' tablo satırı · '+(archive.bytes/1048576).toFixed(2)+' MiB';
  result.hidden=false;
 }catch(error){
  // Never produce a misleading "complete" archive when an object or table failed.
  announce('Eksik arşiv oluşturulmadı: '+(error?.message||'Beklenmeyen hata'),'error');
 }finally{button.disabled=false;}
});

checkAccess();
