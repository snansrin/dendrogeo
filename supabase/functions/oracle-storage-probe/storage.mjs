// Server-only, fixed staging bucket. Never imported by the browser application.
export const BUCKET = 'dendrogeo-staging-private';
export const REGION = 'eu-paris-1';
export const NAMESPACE = 'axoyfs0bhrlc';

export function probeTarget(id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid probe identifier');
  return `https://${NAMESPACE}.compat.objectstorage.${REGION}.oraclecloud.com/${BUCKET}/connectivity-check/${id}.txt`;
}

// Only synthetic text is transmitted; no user files, tokens, or database rows.
// A unique name avoids overwriting earlier objects. No deletion permissions needed.
export async function probeStorage({sign, fetcher, id}) {
  const url = probeTarget(id);
  const payload = `DendroGeo private storage connectivity check: ${id}\n`;
  async function send(method, body) {
    const request = await sign(url, {
      method,
      headers: {'Content-Type': 'text/plain; charset=utf-8'},
      ...(body === undefined ? {} : {body})
    });
    const response = await fetcher(request, {
      redirect: 'error', signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Object storage ${method} failed (${response.status})`);
    }
    return response;
  }
  const uploaded = await send('PUT', payload);
  await uploaded.body?.cancel();
  const response = await send('GET');
  // Abort oversized/unexpected bodies instead of buffering arbitrary responses.
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty storage response');
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) throw new Error('Unexpected storage response');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if (new TextDecoder().decode(bytes) !== payload) throw new Error('Storage round-trip mismatch');
  return {bucket: BUCKET, region: REGION, bytes: new TextEncoder().encode(payload).byteLength, verified: true};
}
