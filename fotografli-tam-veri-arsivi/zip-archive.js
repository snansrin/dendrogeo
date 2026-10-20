"use strict";
window.DG_BACKUP_JSON_DOWNLOAD={
 download(browser,backup,name){
  const a=browser.document.createElement("a");
  a.href=browser.URL.createObjectURL(new browser.Blob([JSON.stringify(backup,null,2)],{type:"application/json"}));
  a.download=name;
  browser.document.body.appendChild(a);a.click();a.remove();
  browser.setTimeout(()=>browser.URL.revokeObjectURL(a.href),5000);
 }
,
 // ZIP STORE: pure browser code, no cloud upload and no third-party dependency.
 // Every entry gets CRC32 and SHA-256 so a recovery operator can verify it.
 async downloadComplete(browser,backup,storage,name,restoreSql){
  const encoder=new TextEncoder(),digest=browser.crypto?.subtle;
  if(!digest)throw new Error("Güvenli SHA-256 doğrulaması bulunamadı.");
  const photos=storage.photos||[],entries=[];
  const hashes=[];
  const bytes=text=>encoder.encode(text);
  const checksum=async data=>Array.from(new Uint8Array(await digest.digest("SHA-256",data))).map(b=>b.toString(16).padStart(2,"0")).join("");
  const add=async(path,data)=>{
   if(entries.some(entry=>entry.path===path))throw new Error("ZIP içinde yinelenen dosya adı: "+path);
   if(!(data instanceof Uint8Array))throw new Error("ZIP dosyası ikili veriye dönüştürülemedi.");
   if(data.byteLength>0xffffffff)throw new Error("ZIP dosyası 4 GB sınırını aşıyor.");
   entries.push({path,data});
   hashes.push({path,bytes:data.byteLength,sha256:await checksum(data)});
  };
  const imageItems=[];
  for(const photo of photos){
   const path="storage/"+storage.bucket+"/"+photo.path;
   const data=new Uint8Array(await photo.blob.arrayBuffer());
   if(data.byteLength!==photo.bytes)throw new Error("Arşiv fotoğraf boyutu doğrulanamadı: "+photo.path);
   imageItems.push({path:photo.path,bytes:photo.bytes,content_type:photo.contentType||"application/octet-stream"});
   await add(path,data);
  }
  const readme=[
   "DendroGeo fotoğraflı veri arşivi",
   "=================================",
   "Tarih: "+backup.exported_at,
   "Kapsam: Oturumun Supabase RLS izinleriyle okuyabildiği kayıtlar ve dendro-photos bucket'ında listeleyebildiği gerçek dosyalar.",
   "Bütün dosyaları doğrulamak için integrity.json SHA-256 değerlerini kullanın.",
   "data/backup.json: Tam sütunlarıyla dışa aktarılmış erişilebilir public tablo kayıtları.",
   "storage/dendro-photos/: Gerçek fotoğraf dosyaları; URL veya küçük önizleme değil.",
   "restore/data_restore.sql: Oturumun erişebildiği 13 public tablosu için kimlik koruyan kurtarma SQL'i.",
   "Kurtarma: Önce boş/izole test projesinde hesap sahipliği ve şemayı hazırlayın.",
   "Fotoğrafları dendro-photos bucket'ına aynı yollarla yükleyin; sonra SQL'i test edin.",
   "SQL mevcut satırları değiştirmez (ON CONFLICT DO NOTHING). Kayıp Auth hesaplarını veya diğer tablolardaki satırları otomatik geri yüklemez.",
   "13 tablonun tüm erişilebilir satırları JSON içindedir; Auth hesapları ve yetkiler için ayrı kurtarma gerekir.",
   "Uyarı: Bu paket Supabase Auth şifrelerini, RLS şemasını, GitHub rapor yayın arşivlerini veya cihazın çevrimdışı taslaklarını içermez.",
   "Kurtarma: ZIP'i güvenli bilgisayarda açın; python3 restore/restore_photos.py ile önce DRY-RUN doğrulaması yapın."
  ].join("\n")+"\n";
  const included={...backup,storage:{bucket:storage.bucket,source_origin:storage.sourceOrigin||null,downloaded_photo_files:imageItems,referenced_photo_count:storage.referencedCount,downloaded_photo_count:photos.length,downloaded_photo_bytes:storage.downloadedBytes}};
  await add("restore/restore_photos.py",bytes("#!/usr/bin/env python3\n\"\"\"DendroGeo trusted-local photo restoration. DRY RUN by default.\n\nRequires a valid Supabase service-role key ONLY for --apply. Never paste the\nkey into code, a browser, a chat, or a repository.\n\"\"\"\nimport hashlib\nimport json\nimport os\nimport pathlib\nimport sys\nimport urllib.error\nimport urllib.parse\nimport urllib.request\n\nROOT = pathlib.Path(__file__).resolve().parent.parent\nBUCKET = ROOT / \"storage\" / \"dendro-photos\"\nBACKUP = json.loads((ROOT / \"data\" / \"backup.json\").read_text(encoding=\"utf-8\"))\nINTEGRITY = json.loads((ROOT / \"integrity.json\").read_text(encoding=\"utf-8\"))\nITEMS = BACKUP[\"storage\"][\"downloaded_photo_files\"]\nHASHES = {x[\"path\"]: x for x in INTEGRITY[\"entries\"]}\nAPPLY = \"--apply\" in sys.argv\n\ndef error(message):\n    raise SystemExit(\"ERROR: \" + message)\n\nif BACKUP.get(\"app\") != \"DendroGeo\" or BACKUP.get(\"schema_version\") != \"2.0.0\":\n    error(\"unsupported archive\")\nif BACKUP.get(\"storage\", {}).get(\"bucket\") != \"dendro-photos\":\n    error(\"wrong storage bucket\")\nif len(ITEMS) != BACKUP[\"storage\"][\"downloaded_photo_count\"]:\n    error(\"archive image count mismatch\")\n\n# Validate every image BEFORE making any request or mutating a destination.\nverified = []\nfor item in ITEMS:\n    path = item[\"path\"]\n    if not isinstance(path, str) or path.startswith(\"/\") or \"\\\\\" in path or any(\n        part in (\"\", \".\", \"..\") for part in path.split(\"/\")\n    ):\n        error(\"invalid storage path\")\n    disk = (BUCKET / path).resolve()\n    if not disk.is_relative_to(BUCKET.resolve()) or not disk.is_file():\n        error(\"missing file: \" + path)\n    raw = disk.read_bytes()\n    name = \"storage/dendro-photos/\" + path\n    expected = HASHES.get(name)\n    digest = hashlib.sha256(raw).hexdigest()\n    if not expected or expected[\"sha256\"] != digest or expected[\"bytes\"] != len(raw):\n        error(\"SHA-256 mismatch: \" + path)\n    if item[\"bytes\"] != len(raw):\n        error(\"size mismatch: \" + path)\n    verified.append((path, raw, item.get(\"content_type\") or \"application/octet-stream\", digest))\n\nif len(verified) != len(ITEMS):\n    error(\"image inventory incomplete\")\nif sum(len(raw) for _, raw, _, _ in verified) != BACKUP[\"storage\"][\"downloaded_photo_bytes\"]:\n    error(\"total image bytes mismatch\")\nprint(\"Verified\", len(verified), \"photo files. No file was changed.\")\n\nif not APPLY:\n    print(\"Dry-run only. For controlled restoration run: python3 restore/restore_photos.py --apply\")\n    sys.exit(0)\n\ntarget = os.environ.get(\"SUPABASE_URL\", \"\").rstrip(\"/\")\nkey = os.environ.get(\"SUPABASE_SERVICE_ROLE_KEY\", \"\")\nsource = BACKUP[\"storage\"].get(\"source_origin\", \"\").rstrip(\"/\")\nparsed = urllib.parse.urlsplit(target)\nif parsed.scheme != \"https\" or not parsed.hostname or parsed.path or parsed.query or parsed.fragment:\n    error(\"SUPABASE_URL must be a base https://...supabase.co project URL\")\nif not parsed.hostname.endswith(\".supabase.co\"):\n    error(\"unsupported production destination\")\nif target != source:\n    error(\"project URL differs from archive source; refusing automatic cross-project upload\")\nif not key:\n    error(\"SUPABASE_SERVICE_ROLE_KEY must be set in the trusted terminal environment\")\n\ndef request(method, url, body=None, mime=\"application/octet-stream\"):\n    headers = {\"apikey\": key, \"Authorization\": \"Bearer \" + key}\n    if body is not None:\n        headers[\"Content-Type\"] = mime\n        headers[\"x-upsert\"] = \"false\"\n    req = urllib.request.Request(url, data=body, headers=headers, method=method)\n    try:\n        with urllib.request.urlopen(req, timeout=30) as resp:\n            return resp.status, resp.read()\n    except urllib.error.HTTPError as exc:\n        return exc.code, exc.read()\n\ncreated = skipped = 0\nfor index, (path, raw, mime, digest) in enumerate(verified, start=1):\n    encoded = urllib.parse.quote(path, safe=\"/\")\n    public_url = target + \"/storage/v1/object/authenticated/dendro-photos/\" + encoded\n    status, existing = request(\"GET\", public_url)\n    if status == 200:\n        if hashlib.sha256(existing).hexdigest() != digest:\n            error(\"existing object differs, refusing overwrite: \" + path)\n        skipped += 1\n    elif status == 404:\n        upload_url = target + \"/storage/v1/object/dendro-photos/\" + encoded\n        written, _ = request(\"POST\", upload_url, raw, mime)\n        if written not in (200, 201):\n            error(\"upload failed (\" + str(written) + \"): \" + path)\n        checked, downloaded = request(\"GET\", public_url)\n        if checked != 200 or hashlib.sha256(downloaded).hexdigest() != digest:\n            error(\"uploaded content not verified: \" + path)\n        created += 1\n    else:\n        error(\"cannot check existing object (\" + str(status) + \"): \" + path)\n    print(str(index) + \"/\" + str(len(verified)) + \" verified: \" + path)\nprint(\"Storage finished:\", created, \"created,\", skipped, \"existing verified.\")\nprint(\"Next: apply restore/data_restore.sql manually in a controlled Supabase SQL Editor session.\")\n"));
  await add("README.txt",bytes(readme));
  await add("data/backup.json",bytes(JSON.stringify(included,null,2)+"\n"));
  await add("restore/data_restore.sql",bytes(restoreSql));
  await add("integrity.json",bytes(JSON.stringify({schema:"dendrogeo-archive-integrity/1",exported_at:backup.exported_at,entries:hashes},null,2)+"\n"));
  if(entries.length>65535)throw new Error("ZIP dosya sayısı sınırı aşıldı.");

  function crc32(data){
   let crc=-1;
   for(const value of data){
    crc^=value;
    for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
   }
   return(crc^-1)>>>0;
  }
  const parts=[],directory=[];let offset=0,directorySize=0;
  for(const {path,data} of entries){
   const fileName=bytes(path),size=data.byteLength,crc=crc32(data),local=new Uint8Array(30+fileName.length);
   const view=new DataView(local.buffer);
   view.setUint32(0,0x04034b50,true);
   view.setUint16(4,20,true);view.setUint16(6,0x0800,true);
   view.setUint16(8,0,true);view.setUint32(14,crc,true);
   view.setUint32(18,size,true);view.setUint32(22,size,true);
   view.setUint16(26,fileName.length,true);
   local.set(fileName,30);
   parts.push(local,data);
   const central=new Uint8Array(46+fileName.length),c=new DataView(central.buffer);
   c.setUint32(0,0x02014b50,true);
   c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);
   c.setUint32(16,crc,true);
   c.setUint32(20,size,true);c.setUint32(24,size,true);
   c.setUint16(28,fileName.length,true);
   c.setUint32(42,offset,true);
   central.set(fileName,46);
   directory.push(central);directorySize+=central.length;
   offset+=local.length+size;
  }
  if(offset+directorySize>0xffffffff)throw new Error("ZIP toplam boyutu 4 GB sınırını aşıyor.");
  const trailer=new Uint8Array(22),end=new DataView(trailer.buffer);
  end.setUint32(0,0x06054b50,true);
  end.setUint16(8,entries.length,true);end.setUint16(10,entries.length,true);
  end.setUint32(12,directorySize,true);end.setUint32(16,offset,true);
  const archive=new browser.Blob([...parts,...directory,trailer],{type:"application/zip"});
  const url=browser.URL.createObjectURL(archive),link=browser.document.createElement("a");
  try{
   link.href=url;link.download=name;browser.document.body.appendChild(link);link.click();link.remove();
  }finally{browser.setTimeout(()=>browser.URL.revokeObjectURL(url),60000);}
  return{files:entries.length,photos:photos.length,bytes:archive.size};
 }
,
 async readComplete(browser,file){
  if(!file||typeof file.arrayBuffer!=="function")throw new Error("ZIP dosyası seçilmedi.");
  if(file.size>570000000)throw new Error("Arşiv dosyası boyut sınırını aşıyor.");
  const bytes=new Uint8Array(await file.arrayBuffer()),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.length),len=bytes.length;
  const fail=message=>{throw new Error("Fotoğraflı Tam Veri Arşivi: "+message);};
  if(len<22||v.getUint32(len-22,true)!==0x06054b50)fail("ZIP son kaydı geçersiz.");
  const count=v.getUint16(len-12,true),size=v.getUint32(len-10,true),start=v.getUint32(len-6,true);
  if(count<4||count>10020||start+size!==len-22)fail("ZIP dizin yapısı geçersiz.");
  const decoder=new TextDecoder("utf-8",{fatal:true}),files=new Map();let offset=start,total=0;
  function crc32(data){
   let c=-1;for(const byte of data){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}
   return(c^-1)>>>0;
  }
  for(let i=0;i<count;i++){
   if(offset+46>start+size||v.getUint32(offset,true)!==0x02014b50)fail("ZIP dizini kesilmiş.");
   const flags=v.getUint16(offset+8,true),method=v.getUint16(offset+10,true),crc=v.getUint32(offset+16,true);
   const packed=v.getUint32(offset+20,true),unpacked=v.getUint32(offset+24,true);
   const n=v.getUint16(offset+28,true),extra=v.getUint16(offset+30,true),comment=v.getUint16(offset+32,true);
   const local=v.getUint32(offset+42,true),next=offset+46+n+extra+comment;
   if(next>start+size||flags!==0x0800||method!==0||packed!==unpacked)fail("Sıkıştırılmış veya bozuk ZIP girdisi.");
   const name=decoder.decode(bytes.subarray(offset+46,offset+46+n));
   if(!name||name.startsWith("/")||name.includes("\\")||name.includes("//")||
       name.split("/").some(x=>x==="."||x===".."||!x)||/[\u0000-\u001f\u007f]/.test(name)||files.has(name))fail("Güvensiz ya da yinelenen dosya yolu.");
   if(local+30>start||v.getUint32(local,true)!==0x04034b50)fail("ZIP dosya başlığı eksik.");
   const nn=v.getUint16(local+26,true),ne=v.getUint16(local+28,true),position=local+30+nn+ne;
   if(position+packed>start||v.getUint16(local+8,true)!==0||v.getUint32(local+14,true)!==crc||
       v.getUint32(local+18,true)!==packed||v.getUint32(local+22,true)!==unpacked||
       decoder.decode(bytes.subarray(local+30,local+30+nn))!==name)fail("ZIP dosya başlığı uyuşmuyor.");
   const payload=bytes.subarray(position,position+unpacked);
   if(crc32(payload)!==crc)fail("CRC32 uyuşmuyor: "+name);
   files.set(name,payload);total+=unpacked;
   if(total>570000000)fail("ZIP açılmış boyut sınırı aşıldı.");
   offset=next;
  }
  if(offset!==start+size||!browser.crypto?.subtle)fail("ZIP dizin sonu veya SHA-256 desteği geçersiz.");
  const hash=async data=>Array.from(new Uint8Array(await browser.crypto.subtle.digest("SHA-256",data))).map(n=>n.toString(16).padStart(2,"0")).join("");
  const json=path=>{
   const data=files.get(path);if(!data)fail("Arşiv dosyası eksik: "+path);
   try{return JSON.parse(decoder.decode(data));}catch{fail("Arşiv JSON bozuk: "+path);}
  };
  const integrity=json("integrity.json"),seen=new Set();
  if(integrity?.schema!=="dendrogeo-archive-integrity/1"||!Array.isArray(integrity.entries)||integrity.entries.length!==files.size-1)fail("Bütünlük listesi eksik.");
  for(const entry of integrity.entries){
   if(!entry||typeof entry.path!=="string"||entry.path==="integrity.json"||seen.has(entry.path)||!files.has(entry.path))fail("Bütünlük listesi uyuşmuyor.");
   const data=files.get(entry.path);
   if(entry.bytes!==data.length||entry.sha256!==await hash(data))fail("SHA-256 uyuşmuyor: "+entry.path);
   seen.add(entry.path);
  }
  for(const path of files.keys())if(path!=="integrity.json"&&!seen.has(path))fail("Bütünlük kontrolünde eksik dosya var.");
  const backup=json("data/backup.json");
  if(backup?.app!=="DendroGeo"||backup.schema_version!=="2.0.0"||backup.scope?.photo_files_included!==true||
     backup.storage?.bucket!=="dendro-photos"||!Array.isArray(backup.storage.downloaded_photo_files))fail("Desteklenmeyen arşiv.");
  const tables=["parks","projects","measurements","waypoints","data_requests","surface_reviews","profiles","report_requests","report_retractions","park_invites","park_collaborators","site_metric_daily","site_visits"];
  for(const tab of tables)if(!Array.isArray(backup[tab])||backup.counts?.[tab]!==backup[tab].length)fail("Eksik veya bozuk veri tablosu: "+tab);
  const items=backup.storage.downloaded_photo_files;
  if(items.length!==backup.storage.downloaded_photo_count||items.length>10000)fail("Fotoğraf sayımı uyuşmuyor.");
  const seenPhotos=new Set(),photos=[];let imageBytes=0;
  for(const item of items){
   if(!item||typeof item.path!=="string"||item.path.startsWith("/")||item.path.includes("\\")||
       item.path.split("/").some(x=>!x||x==="."||x==="..")||seenPhotos.has(item.path))fail("Geçersiz fotoğraf yolu.");
   const data=files.get("storage/dendro-photos/"+item.path);
   if(!data||data.length!==item.bytes)fail("Fotoğraf eksik: "+item.path);
   photos.push({path:item.path,data:new Uint8Array(data),contentType:item.content_type||"application/octet-stream"});
   imageBytes+=data.length;seenPhotos.add(item.path);
  }
  if(imageBytes!==backup.storage.downloaded_photo_bytes)fail("Fotoğraf toplam boyutu uyuşmuyor.");
  for(const path of files.keys())if(path.startsWith("storage/dendro-photos/")&&!seenPhotos.has(path.slice(22)))fail("Bilinmeyen fotoğraf ZIP içinde.");
  if(!files.has("README.txt")||!files.has("restore/data_restore.sql"))fail("Kurtarma yönergesi/SQL eksik.");
  return{backup,photos,restoreSql:decoder.decode(files.get("restore/data_restore.sql")),photoBytes:imageBytes,fileCount:files.size};
 }
};
