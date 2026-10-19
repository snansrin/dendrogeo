import {AwsClient} from 'npm:aws4fetch@1.0.20';
import {probeStorage, REGION} from './storage.mjs';

const ALLOWED_ORIGIN = 'https://dendrogeo.org';
const corsHeaders = (origin: string | null) => origin === ALLOWED_ORIGIN ? {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '600',
  'Vary': 'Origin'
} : {};

// Staging-only manual probe. Browser access is limited to the first-party site.
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response(null, {
    status: origin === ALLOWED_ORIGIN ? 204 : 403,
    headers: corsHeaders(origin)
  });
  if (origin !== ALLOWED_ORIGIN) return new Response(JSON.stringify({error: 'Origin not permitted'}), {
    status: 403, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}
  });
  if (req.method !== 'POST') return new Response(JSON.stringify({error: 'POST required'}), {
    status: 405, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(origin)}
  });
  const respond = (status: number, value: unknown) => new Response(JSON.stringify(value), {
    status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(origin)}
  });
  if (Deno.env.get('OCI_STORAGE_PROBE_ENABLED') !== 'true') return respond(503, {error: 'Probe disabled'});
  const owner = Deno.env.get('OCI_STORAGE_PROBE_USER_ID');
  const accessKeyId = Deno.env.get('OCI_STORAGE_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('OCI_STORAGE_SECRET_ACCESS_KEY');
  const base = Deno.env.get('SUPABASE_URL');
  const apiKey = Deno.env.get('SUPABASE_ANON_KEY');
  const token = req.headers.get('Authorization');
  if (!owner || !accessKeyId || !secretAccessKey || !base || !apiKey) return respond(503, {error: 'Probe not configured'});
  if (!token?.match(/^Bearer \S+$/)) return respond(401, {error: 'Authentication required'});
  try {
    // Verify a real user session with Auth, not by decoding an untrusted JWT.
    const auth = await fetch(new URL('/auth/v1/user', base), {
      headers: {apikey: apiKey, Authorization: token},
      redirect: 'error', signal: AbortSignal.timeout(10000)
    });
    if (!auth.ok) { await auth.body?.cancel(); return respond(401, {error: 'Invalid session'}); }
    const user = await auth.json();
    if (user.id !== owner) return respond(403, {error: 'Not permitted'});
    const client = new AwsClient({accessKeyId, secretAccessKey, service: 's3', region: REGION});
    const result = await probeStorage({
      sign: (url: string, init: RequestInit) => client.sign(url, init),
      fetcher: fetch, id: crypto.randomUUID()
    });
    return respond(200, result);
  } catch {
    // Never log credentials, authorization headers, signed URLs, or provider bodies.
    return respond(502, {error: 'Private storage verification failed'});
  }
});
