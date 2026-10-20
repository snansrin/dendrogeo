// Oracle staging was retired to protect DendroGeo's Free Plan.
// Fail closed for every request. There are deliberately no imports, secrets,
// database calls, network requests, retry loops or storage operations.
Deno.serve(() => new Response('{"error":"Oracle staging probe disabled"}', {
  status: 503,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }
}));
