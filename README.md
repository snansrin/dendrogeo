# dendrogeo
karbon veri toplama sistemi.
## 🔒 Security Note

This repository contains the Supabase `anon` key, which is 
**safe to expose publicly** by design. All data access is 
enforced server-side via Row Level Security (RLS) policies 
and database triggers. The `service_role` key is never 
exposed in this repository.
