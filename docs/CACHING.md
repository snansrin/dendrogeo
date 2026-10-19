# Static hosting and cache behaviour

The application uses GitHub Pages and a service worker. Asset URLs contain release/content-derived query versions, while response Cache-Control is controlled by the hosting provider. A max-age of 600 seconds is not an immutable policy; stale responses may be revalidated, usually with conditional requests rather than downloading every byte again. Service-worker fetch policies can differ from HTTP cache behaviour.

Static assets are hosted separately from Supabase; their traffic is not automatically Supabase egress. Neither the HTTP max-age nor the number of script tags alone proves the number of network requests. The browser request waterfall and transferred bytes are the evidence.

Long immutable caching and response security headers require a separate hosting/edge decision. Public CORS headers on static files are not private database authorization. No service-worker, analysis or authentication behaviour was changed for this documentation update.
