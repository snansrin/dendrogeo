"use strict";

/* Verify the written row; retry only explicitly missing optional columns. */
window.DG_PERSIST_MEASUREMENT_RECORD={
  async persist({client,record,editId,baseline}){
    try{
      if(editId){
        const result=await window.DG_UPDATE_MEASUREMENT_IF_CURRENT.update({client,payload:record,editId,owner:record.owner,baseline});
        if(result.error)return result;
        return result.data?.length===1?{error:null,data:result.data}:{error:{code:"DG_EDIT_CONFLICT",message:"Kayıt başka bir oturumda değişmiş, silinmiş veya erişim kapanmış olabilir. Değişiklikleriniz formda korundu; güncel kaydı açıp karşılaştırın."}};
      }
      const payload={...record};
      for(let attempt=0;attempt<3;attempt++){
        const result=await client.from("measurements").insert(payload).select("id");
        if(!result.error)return result.data?.length===1?{error:null,data:result.data}:{error:{code:"DG_WRITE_UNCONFIRMED",message:"Sunucu kaydı doğrulanamadı. Bilgileriniz formda korundu; Kayıtlarım ekranından kontrol edin."}};
        const error=result.error;
        const missing=['PGRST204','42703'].includes(error.code)&&["altitude_m","photo_file"].find(key=>Object.hasOwn(payload,key)&&new RegExp("['\\\"]"+key+"['\\\"]").test(error.message||""));
        if(!missing)return result;
        delete payload[missing];
      }
      return{error:{code:"DG_SCHEMA_MISMATCH",message:"Kayıt alanları sunucu şemasıyla uyuşmuyor; bilgileriniz formda korundu."}};
    }catch(error){return{error};}
  }
};
