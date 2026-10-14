"use strict";
const SB_URL="https://xjbpounwdxrhelmixvqm.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqYnBvdW53ZHhyaGVsbWl4dnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMDA1NzIsImV4cCI6MjEwMzY3NjU3Mn0.Q5b4ys1TkyhMffGaN9bR9A3nr4L4-8G5UBJY4iC4Dkk";
const INITIAL_HASH=window.location.hash||"";
/* Keep callbacks already in flight on the old fragment flow readable; new
 * sign-ins use PKCE and therefore avoid placing bearer tokens in the URL. */
const AUTH_FLOW_TYPE=/(?:^#|&)access_token=/.test(INITIAL_HASH)?"implicit":"pkce";
const sb=supabase.createClient(SB_URL,SB_KEY,{auth:{flowType:AUTH_FLOW_TYPE,detectSessionInUrl:true}});
