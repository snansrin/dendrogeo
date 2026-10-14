import {isCriticalRuntimeModule} from './runtime-module-inventory.mjs';
export function validateRuntimeModules(inventory,precached){const errors=[],duplicates=paths=>paths.filter((p,i)=>paths.indexOf(p)<i);
 for(const path of inventory.physical){if(!inventory.loaded.has(path))errors.push(path+': runtime yükleme zincirine bağlı değil');if(!precached.has(path))errors.push(path+': offline precache kaydı eksik');if(isCriticalRuntimeModule(path)&&!inventory.protected.has(path))errors.push(path+': kritik modül hash kilidinde değil');}
 for(const path of new Set([...inventory.loaded,...inventory.dependencies,...precached]))if(!inventory.exists(path))errors.push(path+': modül dosyası bulunamadı');
 for(const path of new Set([...duplicates(inventory.initial),...duplicates(inventory.lazy)]))errors.push(path+': aynı script zincirinde iki kez çalıştırılıyor');
 for(const path of new Set(inventory.initial.filter(p=>inventory.lazy.includes(p))))errors.push(path+': başlangıç ve lazy zincirinde tekrar çalıştırılıyor');
 return{checked:inventory.physical.length,protected:inventory.physical.filter(p=>isCriticalRuntimeModule(p)&&inventory.protected.has(p)).length,errors};
}
