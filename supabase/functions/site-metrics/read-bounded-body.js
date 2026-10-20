export class PayloadTooLargeError extends Error {
 constructor(){super('Payload too large');this.name='PayloadTooLargeError';}
}

// Enforce bytes while streaming, including requests without Content-Length.
export async function readBoundedText(request,limit=2048){
 const declared=Number(request.headers.get('content-length'));
 if(Number.isFinite(declared)&&declared>limit){
  try{await request.body?.cancel();}catch{}
  throw new PayloadTooLargeError();
 }
 if(!request.body)return '';
 const reader=request.body.getReader(),chunks=[];
 let size=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>limit){
    try{await reader.cancel();}catch{}
    throw new PayloadTooLargeError();
   }
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
