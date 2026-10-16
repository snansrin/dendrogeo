import {createTreeDetectionHandler} from './handler.mjs';
// Auth is checked against Supabase Auth inside the handler, including ES256 sessions.
Deno.serve(createTreeDetectionHandler({env:(name:string)=>Deno.env.get(name),report:(record:unknown)=>console.warn(JSON.stringify(record))}));
